package com.aishub

import com.aishub.data.provider.OpenAiCompatAdapter
import com.aishub.data.provider.ProviderRequestGate
import com.aishub.data.provider.classifyHttp
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import com.aishub.domain.StreamChunk
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * Zero-setup adapter contract tests (MockWebServer).
 * These verify the app sends anonymous requests correctly and never leaks a user key
 * to public no-setup routes. They are NOT live provider verification.
 */
class ZeroSetupAdapterTest {
    private lateinit var server: MockWebServer

    @Before fun setUp() { server = MockWebServer(); server.start() }
    @After fun tearDown() { server.shutdown() }

    private val pollinationsRoute = FreeModelRegistry.byId("pollinations-openai-fast")!!
    private val hordeRoute = FreeModelRegistry.byId("ai-horde-auto")!!
    private val noGate = ProviderRequestGate(0L)

    @Test
    fun `pollinations classic sends no authorization header even if a key is passed`() = runTest {
        server.enqueue(MockResponse().setBody("""
            {"model":"gpt-oss-20b","choices":[{"message":{"role":"assistant","content":"Hello!"},"finish_reason":"stop"}],
             "usage":{"prompt_tokens":5,"completion_tokens":2}}
        """.trimIndent()))
        val adapter = OpenAiCompatAdapter(
            ProviderId.POLLINATIONS, server.url("/").toString().trimEnd('/'),
            chatPath = "/openai", requestGate = noGate
        )
        val result = adapter.generate(
            pollinationsRoute,
            GenerationRequest(listOf(ChatTurn("user", "hi")), maxOutputTokens = 64),
            "THIS-MUST-NOT-BE-SENT"
        )
        assertEquals("Hello!", result.text)
        assertEquals("gpt-oss-20b", result.actualModelId)
        val recorded = server.takeRequest()
        assertEquals("/openai", recorded.path)
        assertNull(recorded.getHeader("Authorization"))
        assertTrue(recorded.body.readUtf8().contains("\"model\":\"openai-fast\""))
    }

    @Test
    fun `pollinations stream shows content only and ignores reasoning fields`() = runTest {
        val sse = """
            data: {"model":"gpt-oss-20b","choices":[{"delta":{"reasoning":"secret thinking"}}]}

            data: {"model":"gpt-oss-20b","choices":[{"delta":{"content":"Hi"}}]}

            data: {"model":"gpt-oss-20b","choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}

            data: [DONE]

        """.trimIndent()
        server.enqueue(MockResponse().setBody(sse).setHeader("Content-Type", "text/event-stream"))
        val adapter = OpenAiCompatAdapter(
            ProviderId.POLLINATIONS, server.url("/").toString().trimEnd('/'),
            chatPath = "/openai", requestGate = noGate
        )
        val deltas = mutableListOf<String>()
        var finalText: String? = null
        adapter.stream(pollinationsRoute, GenerationRequest(listOf(ChatTurn("user", "hi"))), "").collect { chunk ->
            when (chunk) {
                is StreamChunk.Delta -> deltas += chunk.text
                is StreamChunk.Done -> finalText = chunk.result.text
            }
        }
        assertEquals(listOf("Hi", "!"), deltas)
        assertEquals("Hi!", finalText)
        assertNull(server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `classic 402 is a free-slot rate limit with Retry-After, not a purchase`() {
        val e = classifyHttp(402, "wait for next free slot", "17", pollinationsClassic = true)
        assertTrue(e is ProviderError.RateLimited)
        assertEquals(17L, (e as ProviderError.RateLimited).retryAfterSeconds)
        assertTrue(e.retryable)
    }

    @Test
    fun `non-classic 402 remains quota or payment refusal and never retries paid`() {
        val e = classifyHttp(402, "insufficient credits", null)
        assertTrue(e is ProviderError.QuotaExhausted)
        assertTrue(!e.retryable)
    }

    @Test
    fun `ai horde resolves online models and sends anonymous models array`() = runTest {
        server.enqueue(MockResponse().setBody("""
            {"data":[
              {"id":"koboldcpp/gemma-test","context_length":8192,
               "top_provider":{"max_completion_tokens":1024},
               "architecture":{"input_modalities":["text"]},
               "x_horde":{"workers":2,"queued":0}},
              {"id":"nsfw/roleplay-model","context_length":8192,
               "top_provider":{"max_completion_tokens":1024},
               "architecture":{"input_modalities":["text"]},
               "x_horde":{"workers":9,"queued":0}}
            ]}
        """.trimIndent()))
        server.enqueue(MockResponse().setBody("""
            {"model":"koboldcpp/gemma-test","choices":[{"message":{"role":"assistant","content":"Hi!"},"finish_reason":"stop"}]}
        """.trimIndent()))
        val adapter = OpenAiCompatAdapter(
            ProviderId.AI_HORDE, server.url("/v1").toString().trimEnd('/'), requestGate = noGate
        )
        val result = adapter.generate(
            hordeRoute,
            GenerationRequest(listOf(ChatTurn("user", "hi")), maxOutputTokens = 2048),
            "THIS-MUST-NOT-BE-SENT"
        )
        assertEquals("Hi!", result.text)
        assertEquals("koboldcpp/gemma-test", result.actualModelId)
        val modelsRequest = server.takeRequest()
        assertEquals("/v1/models", modelsRequest.path)
        assertNull(modelsRequest.getHeader("Authorization"))
        val chatRequest = server.takeRequest()
        assertEquals("/v1/chat/completions", chatRequest.path)
        assertNull(chatRequest.getHeader("Authorization"))
        val body = chatRequest.body.readUtf8()
        assertTrue(body.contains("\"models\":[\"koboldcpp/gemma-test\"]"))
        assertTrue(!body.contains("nsfw/roleplay-model"))
        // Anonymous Horde output is capped to stay inside the free allowance.
        assertTrue(body.contains("\"max_tokens\":512"))
    }

    @Test
    fun `ai horde with no online general worker fails honestly`() = runTest {
        server.enqueue(MockResponse().setBody("""{"data":[]}"""))
        val adapter = OpenAiCompatAdapter(
            ProviderId.AI_HORDE, server.url("/v1").toString().trimEnd('/'), requestGate = noGate
        )
        try {
            adapter.generate(hordeRoute, GenerationRequest(listOf(ChatTurn("user", "hi"))), "")
            fail("Expected Unavailable")
        } catch (e: ProviderError.Unavailable) {
            assertTrue(e.message!!.contains("No general AI Horde worker"))
        }
    }
}
