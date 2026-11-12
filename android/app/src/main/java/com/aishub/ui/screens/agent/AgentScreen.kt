package com.aishub.ui.screens.agent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.agent.AgentEngine
import com.aishub.agent.AgentMode
import com.aishub.agent.AgentStep
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.EmptyState
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

@Composable
fun AgentScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val engine = remember {
        AgentEngine(context, locator.database.agentDao(), locator.router, locator.keys,
            com.aishub.data.repo.ChatRepository.defaultAdapters(), locator.errorCenter)
    }
    val projectId = "default"
    val tasks by engine.observe(projectId).collectAsStateWithLifecycle(initialValue = emptyList())
    var goal by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(AgentMode.SUPERVISED) }
    var modeMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    val json = remember { Json { ignoreUnknownKeys = true } }

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            InfoCard(
                "On-device agent (v0.1)",
                "Plans with free models and executes real file tools inside an app-private sandbox. " +
                    "No shell execution on the phone — build/test runs belong in GitHub Actions (Developer Hub). " +
                    "Supervised mode asks approval before every write."
            )
        }
        item {
            OutlinedTextField(
                value = goal, onValueChange = { goal = it },
                label = { Text("Task goal (e.g. Create a small website about cats)") },
                modifier = Modifier.fillMaxWidth(), minLines = 2
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { modeMenu = true }) { Text("Mode: ${mode.label}") }
                DropdownMenu(expanded = modeMenu, onDismissRequest = { modeMenu = false }) {
                    AgentMode.entries.forEach { m ->
                        DropdownMenuItem(text = { Text(m.label) }, onClick = { mode = m; modeMenu = false })
                    }
                }
                Button(enabled = goal.isNotBlank() && !busy, onClick = {
                    busy = true; status = "Planning…"
                    scope.launch {
                        try {
                            val task = engine.createTask(projectId, goal.trim(), mode)
                            val planned = engine.plan(task)
                            status = if (planned.state == "failed") "Planning failed — see task log" else "Plan ready — run steps"
                            goal = ""
                        } catch (e: Throwable) {
                            status = "Error: ${e.message}"
                        } finally { busy = false }
                    }
                }) { Text("Plan task") }
            }
        }
        status?.let { item { Text(it, style = MaterialTheme.typography.bodySmall) } }
        if (tasks.isEmpty()) {
            item { EmptyState("No agent tasks yet", "Describe a goal above. The agent will plan with a free model, then execute real file operations step by step.") }
        }
        items(tasks, key = { it.id }) { task ->
            val steps = remember(task.planJson) {
                runCatching { json.decodeFromString<List<AgentStep>>(task.planJson) }.getOrDefault(emptyList())
            }
            val log = remember(task.logJson) {
                runCatching { json.decodeFromString<List<String>>(task.logJson) }.getOrDefault(emptyList())
            }
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(task.goal, style = MaterialTheme.typography.titleSmall)
                    Text("${AgentMode.valueOf(task.mode).label} · ${task.state}", style = MaterialTheme.typography.labelMedium)
                    steps.forEachIndexed { i, s ->
                        Text("${i + 1}. [${s.status}] ${s.title}", style = MaterialTheme.typography.bodySmall)
                    }
                    if (log.isNotEmpty()) {
                        Text("Log:", style = MaterialTheme.typography.labelMedium)
                        log.takeLast(5).forEach { Text(it, style = MaterialTheme.typography.bodySmall, maxLines = 4) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        when (task.state) {
                            "planned", "running", "paused" -> Button(enabled = !busy, onClick = {
                                busy = true
                                scope.launch {
                                    try { engine.executeNextStep(task.id) }
                                    catch (e: Throwable) { status = "Error: ${e.message}" }
                                    finally { busy = false }
                                }
                            }) { Text("Run next step") }
                            "awaiting_approval" -> {
                                Button(onClick = { scope.launch { engine.approveAndExecute(task.id) } }) { Text("Approve write") }
                                OutlinedButton(onClick = { scope.launch { engine.rejectPending(task.id) } }) { Text("Reject") }
                            }
                        }
                        if (task.state !in listOf("completed", "cancelled")) {
                            TextButton(onClick = { scope.launch { engine.cancel(task.id) } }) { Text("Cancel") }
                        }
                    }
                }
            }
        }
    }
}
