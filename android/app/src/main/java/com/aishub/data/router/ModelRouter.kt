package com.aishub.data.router

import com.aishub.core.Redactor
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.domain.Capability
import com.aishub.domain.ModelRoute
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class RouteHealth(
    val routeId: String,
    var cooldownUntilMillis: Long = 0L,
    var lastSuccessMillis: Long = 0L,
    var lastErrorMessage: String? = null,
    var lastErrorMillis: Long = 0L,
    var locallyCountedRequests: Long = 0L,
    var locallyCountedSuccesses: Long = 0L
)

data class RoutingDecision(val route: ModelRoute, val switchedFrom: String?, val reason: String)

/**
 * Free-only capability-aware router.
 *
 * Hard rules (in order):
 *  1. Only VERIFIED_FREE, non-stale cloud routes (fail closed).
 *  2. Capability + user key availability.
 *  3. Cooldowns from classified errors.
 *  4. Prefer the user's explicit choice; otherwise first healthy route.
 * There is no paid fallback path in this codebase.
 */
class ModelRouter(
    private val keyPresence: (ProviderId) -> Boolean,
    private val now: () -> Long = System::currentTimeMillis
) {
    private val mutex = Mutex()
    private val _health = MutableStateFlow<Map<String, RouteHealth>>(emptyMap())
    val health: StateFlow<Map<String, RouteHealth>> = _health.asStateFlow()

    private val _routingLog = MutableStateFlow<List<String>>(emptyList())
    val routingLog: StateFlow<List<String>> = _routingLog.asStateFlow()

    private fun healthFor(id: String): RouteHealth =
        _health.value[id] ?: RouteHealth(id)

    suspend fun select(
        capability: Capability,
        preferredRouteId: String?,
        exclude: Set<String> = emptySet()
    ): RoutingDecision {
        return mutex.withLock {
            val eligible = FreeModelRegistry.eligibleCloudRoutes(now())
                .filter { capability in it.capabilities }
                .filter { it.id !in exclude }
                .filter { !it.requiresUserKey || keyPresence(it.provider) }
                .filter { healthFor(it.id).cooldownUntilMillis <= now() }
            if (eligible.isEmpty()) {
                throw ProviderError.NoEligibleRoute(
                    "No eligible free route for $capability. Add a free provider key in Settings, " +
                        "wait for cooldowns, or use offline features. Paid fallbacks do not exist."
                )
            }
            val preferred = preferredRouteId?.let { id -> eligible.find { it.id == id } }
            val chosen = preferred ?: eligible.first()
            val switchedFrom = if (preferredRouteId != null && chosen.id != preferredRouteId) preferredRouteId else null
            val reason = when {
                switchedFrom != null -> "Preferred route unavailable; switched to ${chosen.displayName}"
                preferred != null -> "User-selected route"
                else -> "Automatic free-route selection"
            }
            log("select: ${chosen.id} ($reason)")
            RoutingDecision(chosen, switchedFrom, reason)
        }
    }

    suspend fun recordSuccess(routeId: String) = mutex.withLock {
        val h = healthFor(routeId)
        h.lastSuccessMillis = now()
        h.locallyCountedRequests++
        h.locallyCountedSuccesses++
        h.cooldownUntilMillis = 0L
        h.lastErrorMessage = null
        _health.value = _health.value + (routeId to h)
        log("success: $routeId")
    }

    suspend fun recordFailure(routeId: String, error: Throwable) = mutex.withLock {
        val h = healthFor(routeId)
        h.locallyCountedRequests++
        h.lastErrorMessage = Redactor.redact(error.message ?: error.javaClass.simpleName).take(400)
        h.lastErrorMillis = now()
        h.cooldownUntilMillis = now() + when (error) {
            is ProviderError.RateLimited -> (error.retryAfterSeconds ?: 60L) * 1000L
            is ProviderError.QuotaExhausted -> 6 * 3600_000L
            is ProviderError.Auth -> 365 * 86_400_000L // until user fixes the key
            is ProviderError.Unavailable -> 120_000L
            is ProviderError.Unsupported -> 86_400_000L
            else -> 30_000L
        }
        _health.value = _health.value + (routeId to h)
        log("failure: $routeId -> ${h.lastErrorMessage}")
    }

    suspend fun clearCooldown(routeId: String) = mutex.withLock {
        val h = healthFor(routeId)
        h.cooldownUntilMillis = 0L
        _health.value = _health.value + (routeId to h)
    }

    private fun log(entry: String) {
        val stamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date(now()))
        _routingLog.value = (_routingLog.value + "[$stamp] $entry").takeLast(100)
    }
}
