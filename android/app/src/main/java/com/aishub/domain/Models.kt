package com.aishub.domain

import kotlinx.serialization.Serializable

/** Free-access eligibility states. Cloud routing fails closed unless VERIFIED_FREE. */
enum class Eligibility { VERIFIED_FREE, VERIFIED_LOCAL, UNVERIFIED, REVIEW_REQUIRED, INELIGIBLE, DISABLED }

enum class Capability { CHAT, CODING, REASONING, VISION, LONG_CONTEXT, TOOLS, IMAGE_GEN, STT, TTS, SEARCH }

enum class ProviderId(val displayName: String) {
    GEMINI("Google Gemini"), GROQ("Groq"), OPENROUTER("OpenRouter"), LOCAL("On-device")
}

/** A registry entry describing one model route and its verification evidence. */
@Serializable
data class ModelRoute(
    val id: String,
    val provider: ProviderId,
    val modelId: String,
    val displayName: String,
    val capabilities: Set<Capability>,
    val eligibility: Eligibility,
    val verificationSource: String,
    val verificationDate: String,
    val knownLimits: String,
    val contextWindow: Int? = null,
    val supportsStreaming: Boolean = true,
    val privacyNote: String = "",
    val requiresUserKey: Boolean = true
)

@Serializable
data class ChatTurn(
    val role: String, // "user" | "assistant" | "system"
    val text: String
)

data class GenerationRequest(
    val turns: List<ChatTurn>,
    val temperature: Float? = null,
    val maxOutputTokens: Int? = null,
    val systemInstruction: String? = null
)

data class Usage(val inputTokens: Int? = null, val outputTokens: Int? = null)

data class GenerationResult(
    val text: String,
    val actualModelId: String,
    val provider: ProviderId,
    val finishReason: String? = null,
    val usage: Usage? = null
)

sealed class ProviderError(message: String, val retryable: Boolean = false) : Exception(message) {
    class Auth(message: String) : ProviderError(message)
    class RateLimited(message: String, val retryAfterSeconds: Long? = null) : ProviderError(message, true)
    class QuotaExhausted(message: String) : ProviderError(message)
    class Unavailable(message: String) : ProviderError(message, true)
    class Malformed(message: String) : ProviderError(message)
    class Unsupported(message: String) : ProviderError(message)
    class NoEligibleRoute(message: String) : ProviderError(message)
    class MissingKey(message: String) : ProviderError(message)
}

/** Streaming chunk emitted by adapters. */
sealed class StreamChunk {
    data class Delta(val text: String) : StreamChunk()
    data class Done(val result: GenerationResult) : StreamChunk()
}
