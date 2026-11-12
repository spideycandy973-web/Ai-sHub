package com.aishub.data.provider

import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.domain.GenerationResult
import com.aishub.domain.ModelRoute
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import com.aishub.domain.StreamChunk
import com.aishub.domain.Usage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Serializes anonymous requests per provider and enforces documented spacing.
 * Shared across adapter instances in this process; the provider still enforces per-IP limits.
 */
class ProviderRequestGate(private val minIntervalMillis: Long = 0L) {
    private val mutex = Mutex()
    private var lastStartMillis = 0L

    suspend fun <T> withSlot(block: suspend () -> T): T = mutex.withLock {
        if (minIntervalMillis > 0L) {
            val wait = lastStartMillis + minIntervalMillis - System.currentTimeMillis()
            if (wait > 0L) delay(wait)
        }
        lastStartMillis = System.currentTimeMillis()
        block()
    }

    companion object {
        // Pollinations Classic: one anonymous text request at a time, at least 30s apart.
        val pollinations = ProviderRequestGate(31_000L)
        val aiHorde = ProviderRequestGate(0L)
    }
}

/**
 * OpenAI-compatible chat-completions adapter.
 *
 * Zero-setup routes (Pollinations Classic, AI Horde anonymous) send NO Authorization header.
 * Optional keyed routes (Gemini/Groq/OpenRouter) send the user's own free-tier key only to
 * that provider. The router never selects a paid route.
 */
class OpenAiCompatAdapter(
    private val provider: ProviderId,
    private val baseUrl: String,
    client: OkHttpClient? = null,
    private val extraHeaders: Map<String, String> = emptyMap(),
    private val chatPath: String = "/chat/completions",
    private val requestGate: ProviderRequestGate? = null
) : ProviderAdapter {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(if (provider == ProviderId.AI_HORDE) 240 else 120, TimeUnit.SECONDS)
        .build()
    private val json = Json { ignoreUnknownKeys = true }

    private fun gate(): ProviderRequestGate? = requestGate ?: when (provider) {
        ProviderId.POLLINATIONS -> ProviderRequestGate.pollinations
        ProviderId.AI_HORDE -> ProviderRequestGate.aiHorde
        else -> null
    }

    private fun classify(code: Int, body: String, retryAfter: String?): ProviderError =
        classifyHttp(code, body, retryAfter, provider == ProviderId.POLLINATIONS, provider == ProviderId.AI_HORDE)

    /** AI Horde: choose up to 5 currently-online text models (official `models` array). */
    private suspend fun resolveHordeModels(): List<String> = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("$baseUrl/models").apply {
            extraHeaders.forEach { (k, v) -> header(k, v) }
        }.build()
        val body = http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw classify(resp.code, resp.body?.string() ?: "", resp.header("Retry-After"))
            resp.body?.string() ?: throw ProviderError.Unavailable("AI Horde model list was empty")
        }
        val data = json.parseToJsonElement(body).jsonObject["data"]?.jsonArray
            ?: throw ProviderError.Unavailable("AI Horde returned no model list")
        data class Candidate(val id: String, val queue: Double, val workers: Int, val knownFamily: Boolean)
        val candidates = data.mapNotNull { element ->
            val m = element.jsonObject
            val id = m["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            val lower = id.lowercase()
            val excluded = listOf("uncensored", "heretic", "debug", "nsfw", "roleplay", "rp", "erp").any { lower.contains(it) }
            val workers = m["x_horde"]?.jsonObject?.get("workers")?.jsonPrimitive?.content?.toIntOrNull() ?: 0
            val queue = m["x_horde"]?.jsonObject?.get("queued")?.jsonPrimitive?.content?.toDoubleOrNull() ?: Double.MAX_VALUE
            val maxOut = m["top_provider"]?.jsonObject?.get("max_completion_tokens")?.jsonPrimitive?.content?.toIntOrNull() ?: 0
            val ctx = m["context_length"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
            val modalities = m["architecture"]?.jsonObject?.get("input_modalities")?.jsonArray
            val textIn = modalities == null || modalities.any { it.jsonPrimitive.content == "text" }
            val knownFamily = listOf("gemma", "llama", "phi", "qwen", "mistral", "granite").any { lower.contains(it) }
            if (!id.contains(":") && !excluded && workers >= 1 && maxOut >= 64 && ctx >= 4096 && textIn) {
                Candidate(id, queue, workers, knownFamily)
            } else null
        }
        val preferred = candidates.filter { it.knownFamily }.ifEmpty { candidates }
        preferred.sortedWith(compareBy<Candidate> { it.queue }.thenByDescending { it.workers })
            .take(5).map { it.id }
            .also { if (it.isEmpty()) throw ProviderError.Unavailable("No general AI Horde worker is online right now") }
    }

    private fun body(route: ModelRoute, request: GenerationRequest, stream: Boolean, hordeModels: List<String>?): String {
        val obj = buildJsonObject {
            if (hordeModels != null) {
                putJsonArray("models") { hordeModels.forEach { add(JsonPrimitive(it)) } }
            } else {
                put("model", route.modelId)
            }
            put("stream", stream)
            request.temperature?.let { put("temperature", it) }
            request.maxOutputTokens?.let {
                // Anonymous Horde has a free output allowance; keep default chats inside it.
                put("max_tokens", if (provider == ProviderId.AI_HORDE) it.coerceAtMost(512) else it)
            }
            putJsonArray("messages") {
                val sys = request.systemInstruction
                if (!sys.isNullOrBlank()) add(buildJsonObject { put("role", "system"); put("content", sys) })
                request.turns.filter { it.role != "system" }.forEach { t ->
                    add(buildJsonObject { put("role", t.role); put("content", t.text) })
                }
            }
        }
        return obj.toString()
    }

    private suspend fun request(route: ModelRoute, req: GenerationRequest, apiKey: String, stream: Boolean): Request {
        val hordeModels = if (provider == ProviderId.AI_HORDE) resolveHordeModels() else null
        val b = Request.Builder()
            .url("$baseUrl$chatPath")
            .post(body(route, req, stream, hordeModels).toRequestBody("application/json".toMediaType()))
        // Zero-setup public routes are anonymous: no Authorization header at all.
        if (route.requiresUserKey && apiKey.isNotBlank()) b.header("Authorization", "Bearer $apiKey")
        extraHeaders.forEach { (k, v) -> b.header(k, v) }
        return b.build()
    }

    private fun parseResult(obj: JsonObject, route: ModelRoute): GenerationResult {
        val choice = obj["choices"]?.jsonArray?.firstOrNull()?.jsonObject
            ?: throw ProviderError.Malformed("No choices in response")
        val content = choice["message"]?.jsonObject?.get("content")?.jsonPrimitive?.content
            ?: throw ProviderError.Malformed("No message content")
        if (content.isBlank()) throw ProviderError.Malformed("Model returned no visible answer")
        val usageObj = obj["usage"]?.jsonObject
        return GenerationResult(
            text = content,
            actualModelId = obj["model"]?.jsonPrimitive?.content ?: route.modelId,
            provider = provider,
            finishReason = choice["finish_reason"]?.jsonPrimitive?.content,
            usage = usageObj?.let {
                Usage(
                    it["prompt_tokens"]?.jsonPrimitive?.content?.toIntOrNull(),
                    it["completion_tokens"]?.jsonPrimitive?.content?.toIntOrNull()
                )
            }
        )
    }

    override suspend fun generate(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult {
        val g = gate()
        return if (g != null) g.withSlot { generateOnce(route, request, apiKey) } else generateOnce(route, request, apiKey)
    }

    private suspend fun generateOnce(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult =
        withContext(Dispatchers.IO) {
            http.newCall(request(route, request, apiKey, false)).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                if (!resp.isSuccessful) throw classify(resp.code, text, resp.header("Retry-After"))
                parseResult(json.parseToJsonElement(text).jsonObject, route)
            }
        }

    override fun stream(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk> = flow {
        val g = gate()
        if (g != null) {
            g.withSlot { streamOnce(route, request, apiKey).collect { emit(it) } }
        } else {
            streamOnce(route, request, apiKey).collect { emit(it) }
        }
    }

    private fun streamOnce(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk> = callbackFlow {
        val call = http.newCall(request(route, request, apiKey, true))
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { close(e) }
            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    if (!resp.isSuccessful) {
                        close(classify(resp.code, resp.body?.string() ?: "", resp.header("Retry-After")))
                        return
                    }
                    try {
                        val source = resp.body?.source() ?: throw ProviderError.Malformed("Empty stream")
                        val sb = StringBuilder()
                        var finish: String? = null
                        var actualModel = route.modelId
                        var usage: Usage? = null
                        while (true) {
                            val line = source.readUtf8Line() ?: break
                            if (!line.startsWith("data:")) continue
                            val payload = line.removePrefix("data:").trim()
                            if (payload.isEmpty()) continue
                            if (payload == "[DONE]") break
                            val obj = json.parseToJsonElement(payload).jsonObject
                            obj["error"]?.jsonObject?.let { err ->
                                throw ProviderError.Unavailable(err["message"]?.jsonPrimitive?.content ?: "AI stream error")
                            }
                            obj["model"]?.jsonPrimitive?.content?.let { actualModel = it }
                            val choice = obj["choices"]?.jsonArray?.firstOrNull()?.jsonObject ?: continue
                            choice["finish_reason"]?.jsonPrimitive?.content?.let { finish = it }
                            obj["usage"]?.jsonObject?.let {
                                usage = Usage(
                                    it["prompt_tokens"]?.jsonPrimitive?.content?.toIntOrNull(),
                                    it["completion_tokens"]?.jsonPrimitive?.content?.toIntOrNull()
                                )
                            }
                            // Only visible assistant content is shown; provider reasoning fields are ignored.
                            val delta = choice["delta"]?.jsonObject?.get("content")?.jsonPrimitive?.content
                            if (!delta.isNullOrEmpty()) {
                                sb.append(delta)
                                trySend(StreamChunk.Delta(delta))
                            }
                        }
                        if (sb.isBlank()) throw ProviderError.Malformed("Model returned no visible answer")
                        trySend(StreamChunk.Done(GenerationResult(sb.toString(), actualModel, provider, finish, usage)))
                        close()
                    } catch (t: Throwable) { close(t) }
                }
            }
        })
        awaitClose { call.cancel() }
    }

    override suspend fun healthCheck(route: ModelRoute, apiKey: String): Result<String> = runCatching {
        val tokens = if (provider == ProviderId.POLLINATIONS || provider == ProviderId.AI_HORDE) 128 else 32
        generate(route, GenerationRequest(listOf(ChatTurn("user", "Reply with OK")), maxOutputTokens = tokens), apiKey).text
    }

    companion object {
        /** Official Pollinations Classic API: free, anonymous, rate-limited. No key, no signup. */
        fun pollinations(client: OkHttpClient? = null, gate: ProviderRequestGate? = null) = OpenAiCompatAdapter(
            provider = ProviderId.POLLINATIONS,
            baseUrl = "https://text.pollinations.ai",
            client = client,
            chatPath = "/openai",
            extraHeaders = mapOf("User-Agent" to "AisHub/0.1.1 (https://github.com/spideycandy973-web/Ai-sHub)"),
            requestGate = gate
        )

        /** Official AI Horde OpenAI-compatible front: anonymous volunteer compute. No key, no signup. */
        fun aiHorde(client: OkHttpClient? = null, gate: ProviderRequestGate? = null) = OpenAiCompatAdapter(
            provider = ProviderId.AI_HORDE,
            baseUrl = "https://oai.aihorde.net/v1",
            client = client,
            extraHeaders = mapOf(
                "X-Title" to "Ai'sHub",
                "User-Agent" to "AisHub/0.1.1 (https://github.com/spideycandy973-web/Ai-sHub)"
            ),
            requestGate = gate
        )

        fun groq(client: OkHttpClient? = null) =
            OpenAiCompatAdapter(ProviderId.GROQ, "https://api.groq.com/openai/v1", client)

        fun openRouter(client: OkHttpClient? = null) =
            OpenAiCompatAdapter(
                ProviderId.OPENROUTER, "https://openrouter.ai/api/v1", client,
                extraHeaders = mapOf("HTTP-Referer" to "https://github.com/spideycandy973-web/Ai-sHub", "X-Title" to "Ai'sHub")
            )
    }
}
