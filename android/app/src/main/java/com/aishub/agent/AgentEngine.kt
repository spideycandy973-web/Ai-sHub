package com.aishub.agent

import android.content.Context
import com.aishub.data.db.AgentDao
import com.aishub.data.db.AgentTaskEntity
import com.aishub.data.errors.ErrorCenter
import com.aishub.data.keys.KeyStore
import com.aishub.data.provider.ProviderAdapter
import com.aishub.data.router.ModelRouter
import com.aishub.domain.Capability
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.domain.ProviderId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

@Serializable
data class AgentStep(val title: String, val detail: String, var status: String = "pending", var result: String? = null)

@Serializable
data class ToolCall(val tool: String, val path: String = "", val content: String = "", val query: String = "")

enum class AgentMode(val label: String, val allowsWrites: Boolean, val requiresApprovalPerWrite: Boolean) {
    PLANNING("Planning", false, false),
    SUPERVISED("Supervised", true, true),
    AUTONOMOUS("Autonomous", true, false),
    RESEARCH("Research", false, false),
    DEBUG("Debug", true, true),
    DEVELOPMENT("Development", true, true)
}

/**
 * Real on-device agent engine.
 *
 * Scope and safety model (v0.1.0):
 *  - Tools operate ONLY inside the app-private project sandbox:
 *      filesDir/agent_projects/<projectId>/
 *  - Path traversal and symlink escapes are rejected.
 *  - No shell/terminal execution on the device (untrusted code execution belongs in
 *    an isolated cloud runner; GitHub Actions integration is the documented path).
 *  - Writes in supervised modes pause for explicit user approval.
 *  - Task state, plan, and log are persisted to Room after every step (crash recovery).
 */
class AgentEngine(
    context: Context,
    private val dao: AgentDao,
    private val router: ModelRouter,
    private val keys: KeyStore,
    private val adapters: Map<ProviderId, ProviderAdapter>,
    private val errors: ErrorCenter
) {
    private val root = File(context.filesDir, "agent_projects").apply { mkdirs() }
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun observe(projectId: String): Flow<List<AgentTaskEntity>> = dao.observe(projectId)

    fun projectDir(projectId: String): File = File(root, sanitizeId(projectId)).apply { mkdirs() }

    private fun sanitizeId(id: String): String = id.replace(Regex("[^A-Za-z0-9_-]"), "_")

    /** Resolve a relative path strictly inside the project sandbox. */
    fun resolveSafe(projectId: String, relative: String): File =
        SandboxPaths.resolve(projectDir(projectId), relative)

    suspend fun createTask(projectId: String, goal: String, mode: AgentMode): AgentTaskEntity {
        val now = System.currentTimeMillis()
        val task = AgentTaskEntity(
            id = UUID.randomUUID().toString(), projectId = projectId, goal = goal,
            mode = mode.name, state = "planned", createdAt = now, updatedAt = now
        )
        dao.insert(task)
        return task
    }

    suspend fun plan(task: AgentTaskEntity): AgentTaskEntity = withContext(Dispatchers.IO) {
        val decision = router.select(Capability.CODING, null)
        val key = keys.get(decision.route.provider)
            ?: error("No API key for ${decision.route.provider.displayName}. Add one in Settings.")
        val adapter = adapters[decision.route.provider] ?: error("No adapter")
        val files = projectDir(task.projectId).walkTopDown().filter { it.isFile }
            .take(50).joinToString("\n") { it.relativeTo(projectDir(task.projectId)).path }
        val prompt = """
            You are the planning module of an on-device development agent.
            Goal: ${task.goal}
            Mode: ${AgentMode.valueOf(task.mode).label} (writes ${if (AgentMode.valueOf(task.mode).allowsWrites) "allowed" else "NOT allowed"})
            Existing project files:
            ${files.ifBlank { "(empty project)" }}

            Produce a JSON array of 3-7 concrete steps. Reply with ONLY the JSON array, no prose.
            Format: [{"title":"short step name","detail":"what exactly to do"}]
            Steps must be achievable with these tools: create/edit text files, read files, search files.
            No shell commands are available on-device.
        """.trimIndent()
        try {
            val result = adapter.generate(
                decision.route,
                GenerationRequest(listOf(ChatTurn("user", prompt)), maxOutputTokens = 1024, temperature = 0.3f),
                key
            )
            router.recordSuccess(decision.route.id)
            val cleaned = result.text.substringAfter("[").substringBeforeLast("]")
            val steps = json.decodeFromString<List<AgentStep>>("[$cleaned]")
            task.copy(planJson = json.encodeToString(steps), state = "planned", updatedAt = System.currentTimeMillis())
                .also { dao.update(it) }
        } catch (e: Throwable) {
            router.recordFailure(decision.route.id, e)
            errors.record("agent", "Planning failed", e, module = "agent")
            task.copy(state = "failed", updatedAt = System.currentTimeMillis(),
                logJson = appendLog(task.logJson, "Planning failed: ${com.aishub.core.Redactor.redact(e.message ?: "?")}"))
                .also { dao.update(it) }
        }
    }

    /**
     * Execute one pending step. Returns updated task.
     * In supervised modes, file-writing steps return state=awaiting_approval with the proposed
     * tool call persisted in the log; call [approveAndExecute] to proceed.
     */
    suspend fun executeNextStep(taskId: String): AgentTaskEntity = withContext(Dispatchers.IO) {
        var task = dao.byId(taskId) ?: error("Task not found")
        val steps = json.decodeFromString<List<AgentStep>>(task.planJson).toMutableList()
        val idx = steps.indexOfFirst { it.status == "pending" }
        if (idx == -1) {
            return@withContext task.copy(state = "completed", updatedAt = System.currentTimeMillis()).also { dao.update(it) }
        }
        val mode = AgentMode.valueOf(task.mode)
        val step = steps[idx]
        val decision = router.select(Capability.CODING, null)
        val key = keys.get(decision.route.provider) ?: error("Missing provider key")
        val adapter = adapters[decision.route.provider] ?: error("No adapter")

        val existing = projectDir(task.projectId).walkTopDown().filter { it.isFile }.take(30)
            .joinToString("\n\n") { f ->
                "### ${f.relativeTo(projectDir(task.projectId)).path}\n${f.readText().take(2000)}"
            }
        val prompt = """
            You are the execution module of a development agent. Perform ONE step.
            Overall goal: ${task.goal}
            Current step: ${step.title} — ${step.detail}
            Project files (truncated):
            ${existing.ifBlank { "(empty)" }}

            Respond with ONLY a JSON object choosing ONE tool:
            {"tool":"write_file","path":"relative/path.ext","content":"full file content"}
            {"tool":"read_file","path":"relative/path.ext"}
            {"tool":"list_files"}
            {"tool":"search","query":"text to find"}
            {"tool":"done","content":"summary of why the step is complete"}
            ${if (!mode.allowsWrites) "NOTE: writes are forbidden in this mode; use read/list/search/done only." else ""}
        """.trimIndent()
        try {
            val result = adapter.generate(
                decision.route,
                GenerationRequest(listOf(ChatTurn("user", prompt)), maxOutputTokens = 3072, temperature = 0.2f),
                key
            )
            router.recordSuccess(decision.route.id)
            val call = json.decodeFromString<ToolCall>(
                result.text.substringAfter("{").substringBeforeLast("}").let { "{$it}" }
            )
            if (call.tool == "write_file" && !mode.allowsWrites) {
                steps[idx] = step.copy(status = "failed", result = "Write blocked by ${mode.label} mode")
                task = task.copy(planJson = json.encodeToString(steps),
                    logJson = appendLog(task.logJson, "BLOCKED write in ${mode.label} mode: ${call.path}"))
                dao.update(task)
                return@withContext task
            }
            if (call.tool == "write_file" && mode.requiresApprovalPerWrite) {
                task = task.copy(state = "awaiting_approval",
                    logJson = appendLog(task.logJson, "APPROVAL NEEDED: write ${call.path}\n--- content preview ---\n${call.content.take(800)}"))
                pendingCalls[taskId] = call to idx
                dao.update(task)
                return@withContext task
            }
            val outcome = applyTool(task.projectId, call)
            steps[idx] = step.copy(status = if (call.tool == "done") "done" else "done", result = outcome.take(500))
            task = task.copy(planJson = json.encodeToString(steps), state = "running",
                logJson = appendLog(task.logJson, "${call.tool} ${call.path} -> ${outcome.take(200)}"),
                updatedAt = System.currentTimeMillis())
            if (steps.all { it.status != "pending" }) task = task.copy(state = "completed")
            dao.update(task)
            task
        } catch (e: Throwable) {
            router.recordFailure(decision.route.id, e)
            errors.record("agent", "Step execution failed", e, module = "agent")
            steps[idx] = step.copy(status = "failed", result = com.aishub.core.Redactor.redact(e.message ?: "?"))
            task.copy(planJson = json.encodeToString(steps), state = "failed",
                logJson = appendLog(task.logJson, "Step failed: ${com.aishub.core.Redactor.redact(e.message ?: "?")}"),
                updatedAt = System.currentTimeMillis()).also { dao.update(it) }
        }
    }

    private val pendingCalls = mutableMapOf<String, Pair<ToolCall, Int>>()

    suspend fun approveAndExecute(taskId: String): AgentTaskEntity = withContext(Dispatchers.IO) {
        var task = dao.byId(taskId) ?: error("Task not found")
        val (call, idx) = pendingCalls.remove(taskId) ?: error("No pending approval")
        val outcome = applyTool(task.projectId, call)
        val steps = json.decodeFromString<List<AgentStep>>(task.planJson).toMutableList()
        steps[idx] = steps[idx].copy(status = "done", result = outcome.take(500))
        task = task.copy(planJson = json.encodeToString(steps), state = "running",
            logJson = appendLog(task.logJson, "APPROVED: ${call.tool} ${call.path} -> ${outcome.take(200)}"),
            updatedAt = System.currentTimeMillis())
        if (steps.all { it.status != "pending" }) task = task.copy(state = "completed")
        dao.update(task)
        task
    }

    suspend fun rejectPending(taskId: String): AgentTaskEntity = withContext(Dispatchers.IO) {
        var task = dao.byId(taskId) ?: error("Task not found")
        val (call, idx) = pendingCalls.remove(taskId) ?: return@withContext task
        val steps = json.decodeFromString<List<AgentStep>>(task.planJson).toMutableList()
        steps[idx] = steps[idx].copy(status = "failed", result = "Rejected by user")
        task = task.copy(planJson = json.encodeToString(steps), state = "paused",
            logJson = appendLog(task.logJson, "REJECTED by user: ${call.tool} ${call.path}"),
            updatedAt = System.currentTimeMillis())
        dao.update(task)
        task
    }

    suspend fun cancel(taskId: String) {
        pendingCalls.remove(taskId)
        dao.byId(taskId)?.let { dao.update(it.copy(state = "cancelled", updatedAt = System.currentTimeMillis())) }
    }

    /** Recover tasks interrupted by process death: running -> paused (no auto-resume side effects). */
    suspend fun recoverInterrupted() {
        dao.unfinished().forEach { t ->
            if (t.state == "running") {
                dao.update(t.copy(state = "paused",
                    logJson = appendLog(t.logJson, "Recovered after interruption; resume manually to avoid duplicate side effects."),
                    updatedAt = System.currentTimeMillis()))
            }
        }
    }

    private fun applyTool(projectId: String, call: ToolCall): String = when (call.tool) {
        "write_file" -> {
            val f = resolveSafe(projectId, call.path)
            f.parentFile?.mkdirs()
            require(call.content.length <= 512_000) { "File content too large" }
            f.writeText(call.content)
            "Wrote ${f.length()} bytes to ${call.path}"
        }
        "read_file" -> {
            val f = resolveSafe(projectId, call.path)
            if (f.exists()) f.readText().take(8000) else "File not found: ${call.path}"
        }
        "list_files" -> projectDir(projectId).walkTopDown().filter { it.isFile }
            .joinToString("\n") { it.relativeTo(projectDir(projectId)).path }.ifBlank { "(empty)" }
        "search" -> projectDir(projectId).walkTopDown().filter { it.isFile && it.length() < 200_000 }
            .mapNotNull { f ->
                val hits = f.readText().lines().withIndex().filter { it.value.contains(call.query, true) }
                if (hits.isEmpty()) null else f.name + ": " + hits.take(5).joinToString("; ") { "L${it.index + 1}: ${it.value.trim().take(80)}" }
            }.joinToString("\n").ifBlank { "No matches for '${call.query}'" }
        "done" -> call.content.ifBlank { "Step marked done" }
        else -> "Unknown tool: ${call.tool}"
    }

    private fun appendLog(logJson: String, entry: String): String {
        val list = runCatching { json.decodeFromString<List<String>>(logJson) }.getOrDefault(emptyList())
        val stamp = java.text.SimpleDateFormat("MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        return json.encodeToString((list + "[$stamp] $entry").takeLast(200))
    }
}
