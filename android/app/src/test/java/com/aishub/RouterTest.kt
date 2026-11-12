package com.aishub

import com.aishub.data.registry.FreeModelRegistry
import com.aishub.data.router.ModelRouter
import com.aishub.domain.Capability
import com.aishub.domain.Eligibility
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * Routing policy tests. These run against the real registry with injected clock/keys.
 * They are policy tests, NOT live provider verification.
 *
 * v0.1.1 policy: normal chat is zero-setup. Anonymous VERIFIED_FREE routes are eligible
 * without any user key. Optional BYOK routes remain available only when their key exists.
 * Fail-closed still applies to stale/unverified/free-eligibility and cooldowns.
 */
class RouterTest {
    private val now = java.time.LocalDate.parse(FreeModelRegistry.VERIFICATION_DATE)
        .atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli() + 3_600_000

    @Test
    fun `zero setup - no user keys still selects an anonymous free chat route`() = runTest {
        val router = ModelRouter(keyPresence = { false }, now = { now })
        val decision = router.select(Capability.CHAT, null)
        assertEquals(ProviderId.POLLINATIONS, decision.route.provider)
        assertTrue(!decision.route.requiresUserKey)
    }

    @Test
    fun `zero setup - anonymous fallback is used when first anonymous route cools down`() = runTest {
        val router = ModelRouter(keyPresence = { false }, now = { now })
        router.recordFailure("pollinations-openai-fast", ProviderError.RateLimited("free slot wait", 31))
        val decision = router.select(Capability.CHAT, null)
        assertEquals(ProviderId.AI_HORDE, decision.route.provider)
        assertTrue(!decision.route.requiresUserKey)
    }

    @Test
    fun `prefers user choice when healthy`() = runTest {
        val router = ModelRouter(keyPresence = { true }, now = { now })
        val decision = router.select(Capability.CHAT, "groq-gpt-oss-120b")
        assertEquals("groq-gpt-oss-120b", decision.route.id)
        assertEquals(null, decision.switchedFrom)
    }

    @Test
    fun `optional keyed route without key falls back to zero-setup route with disclosure`() = runTest {
        val router = ModelRouter(keyPresence = { false }, now = { now })
        val decision = router.select(Capability.CHAT, "groq-gpt-oss-120b")
        assertEquals("groq-gpt-oss-120b", decision.switchedFrom)
        assertEquals(ProviderId.POLLINATIONS, decision.route.provider)
    }

    @Test
    fun `switches with disclosure when preferred is in cooldown`() = runTest {
        val router = ModelRouter(keyPresence = { true }, now = { now })
        router.recordFailure("groq-gpt-oss-120b", ProviderError.RateLimited("429", 60))
        val decision = router.select(Capability.CHAT, "groq-gpt-oss-120b")
        assertEquals("groq-gpt-oss-120b", decision.switchedFrom)
        assertTrue(decision.route.id != "groq-gpt-oss-120b")
    }

    @Test
    fun `stale verification disables ALL cloud routes`() = runTest {
        val farFuture = now + 365L * 86_400_000L
        val router = ModelRouter(keyPresence = { true }, now = { farFuture })
        try {
            router.select(Capability.CHAT, null)
            fail("Expected NoEligibleRoute for stale registry")
        } catch (e: ProviderError.NoEligibleRoute) {
            // expected: fail closed
        }
    }

    @Test
    fun `quota exhaustion cools route down and next selection avoids it`() = runTest {
        val router = ModelRouter(keyPresence = { true }, now = { now })
        router.recordFailure("gemini-3.5-flash-lite", ProviderError.QuotaExhausted("quota"))
        val decision = router.select(Capability.CHAT, "gemini-3.5-flash-lite")
        assertTrue(decision.route.id != "gemini-3.5-flash-lite")
    }

    @Test
    fun `capability filter never returns image gen for chat`() = runTest {
        val router = ModelRouter(keyPresence = { true }, now = { now })
        val decision = router.select(Capability.CHAT, null)
        assertTrue(Capability.CHAT in decision.route.capabilities)
    }

    @Test
    fun `no IMAGE_GEN cloud route exists - zero-paid image policy`() {
        val imageRoutes = FreeModelRegistry.routes.filter {
            Capability.IMAGE_GEN in it.capabilities && it.provider != ProviderId.LOCAL &&
                it.eligibility == Eligibility.VERIFIED_FREE
        }
        assertTrue("No free verified image generation route should exist until one is verified", imageRoutes.isEmpty())
    }

    @Test
    fun `all cloud registry entries are free-verified with sources and dates`() {
        FreeModelRegistry.routes.filter { it.provider != ProviderId.LOCAL }.forEach { r ->
            assertEquals(Eligibility.VERIFIED_FREE, r.eligibility)
            assertTrue(r.verificationSource.isNotBlank())
            assertNotNull(java.time.LocalDate.parse(r.verificationDate))
        }
    }

    @Test
    fun `auth failure suspends route long-term`() = runTest {
        val router = ModelRouter(keyPresence = { true }, now = { now })
        router.recordFailure("openrouter-free", ProviderError.Auth("401"))
        val h = router.health.value["openrouter-free"]
        assertNotNull(h)
        assertTrue(h!!.cooldownUntilMillis > now + 30L * 86_400_000L)
    }

    @Test
    fun `optional keys do not remove anonymous routes`() = runTest {
        val router = ModelRouter(keyPresence = { it == ProviderId.GROQ }, now = { now })
        val decision = router.select(Capability.CHAT, null)
        // Automatic mode still prefers the first healthy no-setup route.
        assertEquals(ProviderId.POLLINATIONS, decision.route.provider)
        val explicit = router.select(Capability.CHAT, "groq-gpt-oss-120b")
        assertEquals(ProviderId.GROQ, explicit.route.provider)
    }

    @Test
    fun `zero-setup routes are marked keyless and have privacy notes`() {
        val pollinations = FreeModelRegistry.byId("pollinations-openai-fast")!!
        val horde = FreeModelRegistry.byId("ai-horde-auto")!!
        assertTrue(!pollinations.requiresUserKey)
        assertTrue(!horde.requiresUserKey)
        assertTrue(pollinations.privacyNote.isNotBlank())
        assertTrue(horde.privacyNote.isNotBlank())
    }
}
