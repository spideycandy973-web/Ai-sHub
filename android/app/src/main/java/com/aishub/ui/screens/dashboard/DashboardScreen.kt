package com.aishub.ui.screens.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.data.repo.ChatRepository
import com.aishub.di.ServiceLocator
import com.aishub.domain.ProviderId
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun DashboardScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val health by locator.router.health.collectAsStateWithLifecycle()
    val routingLog by locator.router.routingLog.collectAsStateWithLifecycle()
    val keyPresence by locator.keys.presence.collectAsStateWithLifecycle()
    val usage by locator.database.usageDao().observe().collectAsStateWithLifecycle(initialValue = emptyList())
    val checkResults = remember { mutableStateMapOf<String, String>() }
    var checking by remember { mutableStateOf<String?>(null) }
    val adapters = remember { ChatRepository.defaultAdapters() }
    val now = System.currentTimeMillis()

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard(
                "Free AI Access Dashboard",
                "Only verified data is shown. 'Documented limits' come from provider pages (checked ${FreeModelRegistry.VERIFICATION_DATE}); " +
                    "'locally counted' is this device's own request log — NOT authoritative provider quota. Remaining quota shows Unknown unless a provider reports it."
            )
        }
        items(FreeModelRegistry.routes, key = { it.id }) { route ->
            val h = health[route.id]
            val stale = FreeModelRegistry.isStale(route, now)
            val hasKey = !route.requiresUserKey || keyPresence[route.provider] == true
            val inCooldown = (h?.cooldownUntilMillis ?: 0L) > now
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(route.displayName, style = MaterialTheme.typography.titleSmall)
                    Text(
                        buildString {
                            append(route.eligibility.name)
                            if (stale) append(" · STALE — routing disabled")
                            if (route.requiresUserKey) append(if (hasKey) " · key set" else " · no key")
                            if (inCooldown) append(" · cooldown until ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(h!!.cooldownUntilMillis))}")
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = if (stale || inCooldown) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                    Text("Capabilities: ${route.capabilities.joinToString()}", style = MaterialTheme.typography.bodySmall)
                    Text("Documented limits: ${route.knownLimits}", style = MaterialTheme.typography.bodySmall)
                    Text("Remaining quota: Unknown (not reported by provider)", style = MaterialTheme.typography.bodySmall)
                    Text("Verified: ${route.verificationDate} · ${route.verificationSource}", style = MaterialTheme.typography.labelSmall)
                    Text("Privacy: ${route.privacyNote.ifBlank { "On-device / see provider terms" }}", style = MaterialTheme.typography.labelSmall)
                    if (h != null) {
                        Text(
                            "Locally counted: ${h.locallyCountedRequests} requests, ${h.locallyCountedSuccesses} succeeded" +
                                (if (h.lastSuccessMillis > 0) " · last success ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(h.lastSuccessMillis))}" else " · no successful request yet"),
                            style = MaterialTheme.typography.bodySmall
                        )
                        h.lastErrorMessage?.let { Text("Last error: $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                    }
                    if (route.provider != ProviderId.LOCAL && hasKey && !stale) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(enabled = checking == null, onClick = {
                                checking = route.id
                                checkResults[route.id] = "Checking (uses ~1 request)…"
                                scope.launch {
                                    val key = locator.keys.get(route.provider)
                                    val result = if (key == null) Result.failure(IllegalStateException("No key"))
                                    else adapters[route.provider]!!.healthCheck(route, key)
                                    result.onSuccess {
                                        checkResults[route.id] = "✓ Live check passed: ${it.take(50)}"
                                        locator.router.recordSuccess(route.id)
                                    }.onFailure { e ->
                                        checkResults[route.id] = "✗ ${com.aishub.core.Redactor.redact(e.message ?: "failed")}"
                                        locator.router.recordFailure(route.id, e)
                                    }
                                    checking = null
                                }
                            }) { Text(if (checking == route.id) "Checking…" else "Live check") }
                            if (inCooldown) {
                                TextButton(onClick = { scope.launch { locator.router.clearCooldown(route.id) } }) { Text("Clear cooldown") }
                            }
                        }
                    }
                    checkResults[route.id]?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
        item {
            InfoCard("Recent routing history (this session)", routingLog.takeLast(15).joinToString("\n").ifBlank { "No routing events yet." })
        }
        item {
            InfoCard(
                "Local usage summary (last 500 records)",
                "Total: ${usage.size} · Success: ${usage.count { it.success }} · Failed: ${usage.count { !it.success }}\n" +
                    "This is local counting only and never represents provider-side quota."
            )
        }
    }
}
