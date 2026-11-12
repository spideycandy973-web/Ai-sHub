package com.aishub.data.provider

import com.aishub.domain.GenerationRequest
import com.aishub.domain.GenerationResult
import com.aishub.domain.ModelRoute
import com.aishub.domain.ProviderError
import com.aishub.domain.StreamChunk
import kotlinx.coroutines.flow.Flow

/** Stable contract every provider adapter implements. */
interface ProviderAdapter {
    /** Non-streaming generation. */
    suspend fun generate(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult

    /** Streaming generation; falls back to single-chunk for non-streaming providers. */
    fun stream(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk>

    /** Lightweight real availability check (small real request). Uses quota; call sparingly. */
    suspend fun healthCheck(route: ModelRoute, apiKey: String): Result<String>
}

internal fun classifyHttp(
    code: Int,
    body: String,
    retryAfter: String?,
    pollinationsClassic: Boolean = false,
    aiHorde: Boolean = false
): ProviderError {
    val snippet = body.take(300)
    return when {
        code == 402 && pollinationsClassic -> ProviderError.RateLimited(
            "Free anonymous slot is not ready yet (HTTP 402). Wait for Retry-After; no payment is made.",
            retryAfter?.toLongOrNull() ?: 31L
        )
        code == 403 && aiHorde && (snippet.contains("KudosUpfront", true) || snippet.contains("max_kudos", true)) ->
            ProviderError.QuotaExhausted("AI Horde free allowance refused this request: $snippet")
        code == 401 || code == 403 -> ProviderError.Auth("Authentication failed ($code): $snippet")
        code == 429 -> {
            val isQuota = snippet.contains("quota", true) || snippet.contains("exceeded your current", true)
            if (isQuota) ProviderError.QuotaExhausted("Provider quota exhausted: $snippet")
            else ProviderError.RateLimited("Rate limited ($code)", retryAfter?.toLongOrNull())
        }
        code == 402 -> ProviderError.QuotaExhausted("Provider requires credit balance (402) — route suspended, never pay: $snippet")
        code == 404 -> ProviderError.Unsupported("Model not found or not available ($code): $snippet")
        code == 400 -> ProviderError.Malformed("Bad request ($code): $snippet")
        code == 408 -> ProviderError.Unavailable("Provider request timeout ($code): $snippet")
        code >= 500 -> ProviderError.Unavailable("Provider server error ($code)")
        else -> ProviderError.Malformed("Unexpected HTTP $code: $snippet")
    }
}
