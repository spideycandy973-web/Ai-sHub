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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
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
 * OpenAI-compatible chat-completions adapter used for Groq and OpenRouter.
 * Only free-verified routes from the registry may be passed here; the router enforces that.
 */
class OpenAiCompatAdapter(
    private val provider: ProviderId,
    private val baseUrl: String,
    client: OkHttpClient? = null,
    private val extraHeaders: Map<String, String> = emptyMap()
) : ProviderAdapter {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()
    private val json = Json { ignoreUnknownKeys = true }

    private fun body(route: ModelRoute, request: GenerationRequest, stream: Boolean): String {
        val obj = buildJsonObject {
            put("model", route.modelId)
            put("stream", stream)
            request.temperature?.let { put("temperature", it) }
            request.maxOutputTokens?.let { put("max_tokens", it) }
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

    private fun request(route: ModelRoute, req: GenerationRequest, apiKey: String, stream: Boolean): Request {
        val b = Request.Builder()
            .url("$baseUrl/chat/completions")
            .header("Authorization", "Bearer $apiKey")
            .post(body(route, req, stream).toRequestBody("application/json".toMediaType()))
        extraHeaders.forEach { (k, v) -> b.header(k, v) }
        return b.build()
    }

    override suspend fun generate(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult =
        withContext(Dispatchers.IO) {
            http.newCall(request(route, request, apiKey, false)).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                if (!resp.isSuccessful) throw classifyHttp(resp.code, text, resp.header("Retry-After"))
                val obj = json.parseToJsonElement(text).jsonObject
                val choice = obj["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                    ?: throw ProviderError.Malformed("No choices in response")
                val content = choice["message"]?.jsonObject?.get("content")?.jsonPrimitive?.content
                    ?: throw ProviderError.Malformed("No message content")
                val usageObj = obj["usage"]?.jsonObject
                GenerationResult(
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
        }

    override fun stream(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk> = callbackFlow {
        val call = http.newCall(request(route, request, apiKey, true))
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { close(e) }
            override fun onResponse(call: Call, response: Response) {
                response.use { resp ->
                    if (!resp.isSuccessful) {
                        close(classifyHttp(resp.code, resp.body?.string() ?: "", resp.header("Retry-After")))
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
                            obj["model"]?.jsonPrimitive?.content?.let { actualModel = it }
                            val choice = obj["choices"]?.jsonArray?.firstOrNull()?.jsonObject ?: continue
                            choice["finish_reason"]?.jsonPrimitive?.content?.let { finish = it }
                            obj["usage"]?.jsonObject?.let {
                                usage = Usage(
                                    it["prompt_tokens"]?.jsonPrimitive?.content?.toIntOrNull(),
                                    it["completion_tokens"]?.jsonPrimitive?.content?.toIntOrNull()
                                )
                            }
                            val delta = choice["delta"]?.jsonObject?.get("content")?.jsonPrimitive?.content
                            if (!delta.isNullOrEmpty()) {
                                sb.append(delta)
                                trySend(StreamChunk.Delta(delta))
                            }
                        }
                        trySend(StreamChunk.Done(GenerationResult(sb.toString(), actualModel, provider, finish, usage)))
                        close()
                    } catch (t: Throwable) { close(t) }
                }
            }
        })
        awaitClose { call.cancel() }
    }

    override suspend fun healthCheck(route: ModelRoute, apiKey: String): Result<String> = runCatching {
        generate(route, GenerationRequest(listOf(ChatTurn("user", "Reply with OK")), maxOutputTokens = 8), apiKey).text
    }

    companion object {
        fun groq(client: OkHttpClient? = null) =
            OpenAiCompatAdapter(ProviderId.GROQ, "https://api.groq.com/openai/v1", client)

        fun openRouter(client: OkHttpClient? = null) =
            OpenAiCompatAdapter(
                ProviderId.OPENROUTER, "https://openrouter.ai/api/v1", client,
                extraHeaders = mapOf("HTTP-Referer" to "https://github.com/spideycandy973-web/Ai-sHub", "X-Title" to "Ai'sHub")
            )
    }
}
