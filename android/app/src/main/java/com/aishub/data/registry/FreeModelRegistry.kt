package com.aishub.data.registry

import com.aishub.domain.Capability
import com.aishub.domain.Eligibility
import com.aishub.domain.ModelRoute
import com.aishub.domain.ProviderId

/**
 * Verified free-model registry.
 *
 * Entries verified 2026-11-13 against official sources:
 *  - Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing (fetched live)
 *    gemini-2.5-flash is DEPRECATED (auto-routes to 3.5-flash-lite after 2026-12-01) — excluded.
 *    Image models (Nano Banana line) are paid-only on the API — no free image gen route.
 *  - Groq free plan: https://console.groq.com/docs/rate-limits (fetched live)
 *  - OpenRouter: https://openrouter.ai/api/v1/models (live API check: openrouter/free priced $0)
 *
 * Quotas shown are documented limits, NOT remaining quota. Live availability is only
 * claimed after a real successful request. The router fails closed on stale entries.
 */
object FreeModelRegistry {
    const val STALE_DAYS = 30L
    const val VERIFICATION_DATE = "2026-11-13"

    val routes: List<ModelRoute> = listOf(
        ModelRoute(
            id = "gemini-3.5-flash-lite",
            provider = ProviderId.GEMINI,
            modelId = "gemini-3.5-flash-lite",
            displayName = "Gemini 3.5 Flash-Lite",
            capabilities = setOf(Capability.CHAT, Capability.CODING, Capability.VISION, Capability.LONG_CONTEXT),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://ai.google.dev/gemini-api/docs/pricing",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free tier: per-project RPM/RPD shown in AI Studio; no card required. RPD resets midnight Pacific.",
            contextWindow = 1_000_000,
            privacyNote = "Free-tier content is used by Google to improve products. Do not send sensitive data."
        ),
        ModelRoute(
            id = "gemini-3.8-flash",
            provider = ProviderId.GEMINI,
            modelId = "gemini-3.8-flash",
            displayName = "Gemini 3.8 Flash",
            capabilities = setOf(Capability.CHAT, Capability.CODING, Capability.REASONING, Capability.VISION, Capability.LONG_CONTEXT, Capability.TOOLS),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://ai.google.dev/gemini-api/docs/pricing",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free tier: per-project RPM/RPD shown in AI Studio; no card required.",
            contextWindow = 1_000_000,
            privacyNote = "Free-tier content is used by Google to improve products."
        ),
        ModelRoute(
            id = "groq-gpt-oss-120b",
            provider = ProviderId.GROQ,
            modelId = "openai/gpt-oss-120b",
            displayName = "GPT-OSS 120B (Groq)",
            capabilities = setOf(Capability.CHAT, Capability.CODING, Capability.REASONING, Capability.TOOLS),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://console.groq.com/docs/rate-limits",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free plan (official): 30 RPM, 1K RPD, 8K TPM, 200K TPD. No card required.",
            contextWindow = 131_072,
            privacyNote = "Groq processes prompts under its own data policy; review before sending private code."
        ),
        ModelRoute(
            id = "groq-gpt-oss-20b",
            provider = ProviderId.GROQ,
            modelId = "openai/gpt-oss-20b",
            displayName = "GPT-OSS 20B (Groq)",
            capabilities = setOf(Capability.CHAT, Capability.CODING, Capability.TOOLS),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://console.groq.com/docs/rate-limits",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free plan (official): 30 RPM, 1K RPD, 8K TPM, 200K TPD.",
            contextWindow = 131_072,
            privacyNote = "Groq processes prompts under its own data policy."
        ),
        ModelRoute(
            id = "openrouter-free",
            provider = ProviderId.OPENROUTER,
            modelId = "openrouter/free",
            displayName = "OpenRouter Free Router",
            capabilities = setOf(Capability.CHAT, Capability.CODING),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://openrouter.ai/api/v1/models (live check: pricing $0)",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free routes: ~20 RPM, 50 RPD without credit purchase. Underlying model rotates; actual model reported per response.",
            contextWindow = null,
            privacyNote = "Some free providers train on prompts. Check the specific model's policy."
        ),
        ModelRoute(
            id = "groq-whisper-turbo",
            provider = ProviderId.GROQ,
            modelId = "whisper-large-v3-turbo",
            displayName = "Whisper Large v3 Turbo (Groq STT)",
            capabilities = setOf(Capability.STT),
            eligibility = Eligibility.VERIFIED_FREE,
            verificationSource = "https://console.groq.com/docs/rate-limits",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Free plan (official): 20 RPM, 2K RPD, 7.2K audio-seconds/hour, 28.8K/day.",
            supportsStreaming = false,
            privacyNote = "Audio is sent to Groq for transcription."
        ),
        ModelRoute(
            id = "android-stt",
            provider = ProviderId.LOCAL,
            modelId = "android.speech",
            displayName = "Android Speech Recognition",
            capabilities = setOf(Capability.STT),
            eligibility = Eligibility.VERIFIED_LOCAL,
            verificationSource = "https://developer.android.com/reference/android/speech/SpeechRecognizer",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Depends on device recognizer; may require network. Availability varies by device.",
            supportsStreaming = false,
            requiresUserKey = false
        ),
        ModelRoute(
            id = "android-tts",
            provider = ProviderId.LOCAL,
            modelId = "android.tts",
            displayName = "Android TextToSpeech",
            capabilities = setOf(Capability.TTS),
            eligibility = Eligibility.VERIFIED_LOCAL,
            verificationSource = "https://developer.android.com/reference/android/speech/tts/TextToSpeech",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Depends on installed TTS engine and voice data.",
            supportsStreaming = false,
            requiresUserKey = false
        ),
        ModelRoute(
            id = "wikipedia-search",
            provider = ProviderId.LOCAL,
            modelId = "wikipedia.api",
            displayName = "Wikipedia Search API",
            capabilities = setOf(Capability.SEARCH),
            eligibility = Eligibility.VERIFIED_LOCAL,
            verificationSource = "https://www.mediawiki.org/wiki/API:Main_page",
            verificationDate = VERIFICATION_DATE,
            knownLimits = "Official free MediaWiki API; be respectful of rate limits (sequential queries).",
            supportsStreaming = false,
            requiresUserKey = false
        )
    )

    fun byId(id: String): ModelRoute? = routes.find { it.id == id }

    /** Cloud routes eligible for routing right now (fails closed on stale/unverified). */
    fun eligibleCloudRoutes(nowMillis: Long): List<ModelRoute> = routes.filter { route ->
        route.eligibility == Eligibility.VERIFIED_FREE &&
            route.provider != ProviderId.LOCAL &&
            !isStale(route, nowMillis)
    }

    fun isStale(route: ModelRoute, nowMillis: Long): Boolean {
        val verified = runCatching {
            java.time.LocalDate.parse(route.verificationDate)
                .atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
        }.getOrNull() ?: return true
        val ageDays = (nowMillis - verified) / 86_400_000L
        return ageDays > STALE_DAYS
    }
}
