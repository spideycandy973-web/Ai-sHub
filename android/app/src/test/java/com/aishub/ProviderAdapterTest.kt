package com.aishub

import com.aishub.data.provider.GeminiAdapter
import com.aishub.data.provider.OpenAiCompatAdapter
import com.aishub.data.provider.classifyHttp
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import com.aishub.data.registry.FreeModelRegistry
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * Adapter contract tests against MockWebServer fixtures.
 * These are MOCKED tests — they verify request/response handling, not live providers.
 */
class ProviderAdapterTest {
    private lateinit var server: MockWebServer

    @Before fun setUp() { server = MockWebServer(); server.start() }
    @After fun tearDown() { server.shutdown() }

    private val geminiRoute = FreeModelRegistry.byId("gemini-3.5-flash-lite")!!
    private val groqRoute = FreeModelRegistry.byId("groq-gpt-oss-120b")!!

    @Test
    fun `gemini parses candidates and usage`() = runTest {
        server.enqueue(MockResponse().setBody("""
            {"candidates":[{"content":{"parts":[{"text":"Hello "},{"text":"world"}]},"finishReason":"STOP"}],
             "usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5},
             "modelVersion":"gemini-3.5-flash-lite-001"}
        """.trimIndent()))
        val adapter = GeminiAdapter(base = server.url("/v1beta/models").toString().trimEnd('/'))
        val result = adapter.generate(geminiRoute, GenerationRequest(listOf(ChatTurn("user", "hello"))), "test-key")
        assertEquals("Hello world", result.text)
        assertEquals("gemini-3.5-flash-lite-001", result.actualModelId)
        assertEquals(10, result.usage?.inputTokens)
        assertEquals(5, result.usage?.outputTokens)
        val recorded = server.takeRequest()
        assertTrue(recorded.path!!.contains(":generateContent"))
        assertEquals("test-key", recorded.getHeader("x-goog-api-key"))
    }

    @Test
    fun `gemini safety-blocked response becomes Malformed not fake text`() = runTest {
        server.enqueue(MockResponse().setBody("""{"promptFeedback":{"blockReason":"SAFETY"}}"""))
        val adapter = GeminiAdapter(base = server.url("/v1beta/models").toString().trimEnd('/'))
        try {
            adapter.generate(geminiRoute, GenerationRequest(listOf(ChatTurn("user", "x"))), "k")
            fail("Expected Malformed")
        } catch (e: ProviderError.Malformed) { /* expected */ }
    }

    @Test
    fun `gemini streams SSE deltas`() = runTest {
        val sse = """
            data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}],"modelVersion":"m"}

            data: {"candidates":[{"content":{"parts":[{"text":"!"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2}}

        """.trimIndent()
        server.enqueue(MockResponse().setBody(sse).setHeader("Content-Type", "text/event-stream"))
        val adapter = GeminiAdapter(base = server.url("/v1beta/models").toString().trimEnd('/'))
        var finalText: String? = null
        val deltas = mutableListOf<String>()
        adapter.stream(geminiRoute, GenerationRequest(listOf(ChatTurn("user", "hi"))), "k").collect { chunk ->
            when (chunk) {
                is com.aishub.domain.StreamChunk.Delta -> deltas += chunk.text
                is com.aishub.domain.StreamChunk.Done -> finalText = chunk.result.text
            }
        }
        assertEquals(listOf("Hi", "!"), deltas)
        assertEquals("Hi!", finalText)
    }

    @Test
    fun `openai-compat adapter parses response and records actual model`() = runTest {
        server.enqueue(MockResponse().setBody("""
            {"model":"openai/gpt-oss-120b-2026-01","choices":[{"message":{"role":"assistant","content":"Hi there"},"finish_reason":"stop"}],
             "usage":{"prompt_tokens":12,"completion_tokens":3}}
        """.trimIndent()))
        val adapter = OpenAiCompatAdapter(ProviderId.GROQ, server.url("/v1").toString().trimEnd('/'))
        val result = adapter.generate(groqRoute, GenerationRequest(listOf(ChatTurn("user", "hello"))), "test-key")
        assertEquals("Hi there", result.text)
        assertEquals("openai/gpt-oss-120b-2026-01", result.actualModelId)
        assertEquals(12, result.usage?.inputTokens)
        val recorded = server.takeRequest()
        assertTrue(recorded.path!!.endsWith("/chat/completions"))
        assertTrue(recorded.getHeader("Authorization") == "Bearer test-key")
    }

    @Test
    fun `429 with quota text becomes QuotaExhausted`() {
        val e = classifyHttp(429, """{"error":{"message":"You exceeded your current quota"}}""", null)
        assertTrue(e is ProviderError.QuotaExhausted)
    }

    @Test
    fun `429 without quota text becomes RateLimited with retry-after`() {
        val e = classifyHttp(429, "slow down", "30")
        assertTrue(e is ProviderError.RateLimited)
        assertEquals(30L, (e as ProviderError.RateLimited).retryAfterSeconds)
    }

    @Test
    fun `401 becomes Auth error`() {
        assertTrue(classifyHttp(401, "bad key", null) is ProviderError.Auth)
    }

    @Test
    fun `402 payment required never retries and is quota-class`() {
        val e = classifyHttp(402, "insufficient credits", null)
        assertTrue(e is ProviderError.QuotaExhausted)
        assertTrue(!e.retryable)
    }

    @Test
    fun `500 is retryable unavailable`() {
        val e = classifyHttp(503, "maintenance", null)
        assertTrue(e is ProviderError.Unavailable)
        assertTrue(e.retryable)
    }

    @Test
    fun `adapter surfaces server error as classified ProviderError`() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"invalid key"}"""))
        val adapter = OpenAiCompatAdapter(ProviderId.GROQ, server.url("/v1").toString().trimEnd('/'))
        try {
            adapter.generate(groqRoute, GenerationRequest(listOf(ChatTurn("user", "hi"))), "bad")
            fail("Expected Auth error")
        } catch (e: ProviderError.Auth) { /* expected */ }
    }

    @Test
    fun `streaming parses SSE deltas and DONE`() = runTest {
        val sse = """
            data: {"model":"m1","choices":[{"delta":{"content":"Hel"}}]}

            data: {"model":"m1","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}

            data: [DONE]

        """.trimIndent()
        server.enqueue(MockResponse().setBody(sse).setHeader("Content-Type", "text/event-stream"))
        val adapter = OpenAiCompatAdapter(ProviderId.GROQ, server.url("/v1").toString().trimEnd('/'))
        val chunks = mutableListOf<String>()
        var finalText: String? = null
        adapter.stream(groqRoute, GenerationRequest(listOf(ChatTurn("user", "hi"))), "k").collect { chunk ->
            when (chunk) {
                is com.aishub.domain.StreamChunk.Delta -> chunks += chunk.text
                is com.aishub.domain.StreamChunk.Done -> finalText = chunk.result.text
            }
        }
        assertEquals(listOf("Hel", "lo"), chunks)
        assertEquals("Hello", finalText)
    }
}
