package com.aishub.data.provider

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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Google Gemini Developer API adapter (generativelanguage.googleapis.com). */
class GeminiAdapter(
    client: OkHttpClient? = null,
    private val base: String = "https://generativelanguage.googleapis.com/v1beta/models"
) : ProviderAdapter {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()
    private val json = Json { ignoreUnknownKeys = true }

    private fun body(request: GenerationRequest): String {
        val obj = buildJsonObject {
            putJsonArray("contents") {
                request.turns.filter { it.role != "system" }.forEach { turn ->
                    add(buildJsonObject {
                        put("role", if (turn.role == "assistant") "model" else "user")
                        putJsonArray("parts") { add(buildJsonObject { put("text", turn.text) }) }
                    })
                }
            }
            val sys = request.systemInstruction ?: request.turns.firstOrNull { it.role == "system" }?.text
            if (!sys.isNullOrBlank()) {
                putJsonObject("systemInstruction") {
                    putJsonArray("parts") { add(buildJsonObject { put("text", sys) }) }
                }
            }
            if (request.temperature != null || request.maxOutputTokens != null) {
                putJsonObject("generationConfig") {
                    request.temperature?.let { put("temperature", it) }
                    request.maxOutputTokens?.let { put("maxOutputTokens", it) }
                }
            }
        }
        return obj.toString()
    }

    private fun parseResult(obj: JsonObject, modelId: String): GenerationResult {
        val candidates = obj["candidates"]?.jsonArray
        val text = candidates?.firstOrNull()?.jsonObject
            ?.get("content")?.jsonObject
            ?.get("parts")?.jsonArray
            ?.joinToString("") { it.jsonObject["text"]?.jsonPrimitive?.content ?: "" }
            ?: throw ProviderError.Malformed("Gemini response had no candidates (possibly safety-blocked)")
        val finish = candidates.firstOrNull()?.jsonObject?.get("finishReason")?.jsonPrimitive?.content
        val usageMeta = obj["usageMetadata"]?.jsonObject
        val usage = usageMeta?.let {
            Usage(
                inputTokens = it["promptTokenCount"]?.jsonPrimitive?.content?.toIntOrNull(),
                outputTokens = it["candidatesTokenCount"]?.jsonPrimitive?.content?.toIntOrNull()
            )
        }
        val actualModel = obj["modelVersion"]?.jsonPrimitive?.content ?: modelId
        return GenerationResult(text, actualModel, ProviderId.GEMINI, finish, usage)
    }

    override suspend fun generate(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult =
        withContext(Dispatchers.IO) {
            val req = Request.Builder()
                .url("$base/${route.modelId}:generateContent")
                .header("x-goog-api-key", apiKey)
                .post(body(request).toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(req).execute().use { resp ->
                val text = resp.body?.string() ?: ""
                if (!resp.isSuccessful) throw classifyHttp(resp.code, text, resp.header("Retry-After"))
                parseResult(json.parseToJsonElement(text).jsonObject, route.modelId)
            }
        }

    override fun stream(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk> = callbackFlow {
        val req = Request.Builder()
            .url("$base/${route.modelId}:streamGenerateContent?alt=sse")
            .header("x-goog-api-key", apiKey)
            .post(body(request).toRequestBody("application/json".toMediaType()))
            .build()
        val call = http.newCall(req)
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
                        var usage: Usage? = null
                        var actualModel = route.modelId
                        while (true) {
                            val line = source.readUtf8Line() ?: break
                            if (!line.startsWith("data:")) continue
                            val payload = line.removePrefix("data:").trim()
                            if (payload.isEmpty() || payload == "[DONE]") continue
                            val obj = json.parseToJsonElement(payload).jsonObject
                            obj["modelVersion"]?.jsonPrimitive?.content?.let { actualModel = it }
                            val cand = obj["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
                            cand?.get("finishReason")?.jsonPrimitive?.content?.let { finish = it }
                            obj["usageMetadata"]?.jsonObject?.let {
                                usage = Usage(
                                    it["promptTokenCount"]?.jsonPrimitive?.content?.toIntOrNull(),
                                    it["candidatesTokenCount"]?.jsonPrimitive?.content?.toIntOrNull()
                                )
                            }
                            val delta = cand?.get("content")?.jsonObject?.get("parts")?.jsonArray
                                ?.joinToString("") { p -> p.jsonObject["text"]?.jsonPrimitive?.content ?: "" }
                            if (!delta.isNullOrEmpty()) {
                                sb.append(delta)
                                trySend(StreamChunk.Delta(delta))
                            }
                        }
                        trySend(StreamChunk.Done(GenerationResult(sb.toString(), actualModel, ProviderId.GEMINI, finish, usage)))
                        close()
                    } catch (t: Throwable) { close(t) }
                }
            }
        })
        awaitClose { call.cancel() }
    }

    override suspend fun healthCheck(route: ModelRoute, apiKey: String): Result<String> = runCatching {
        generate(route, GenerationRequest(listOf(com.aishub.domain.ChatTurn("user", "Reply with OK")), maxOutputTokens = 8), apiKey).text
    }
}
