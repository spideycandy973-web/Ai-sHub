package com.aishub.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.data.settings.AppSettings
import com.aishub.data.settings.ThemeMode
import com.aishub.di.ServiceLocator
import com.aishub.domain.Capability
import com.aishub.domain.ProviderId
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(locator: ServiceLocator, settings: AppSettings) {
    val scope = rememberCoroutineScope()
    val keyPresence by locator.keys.presence.collectAsStateWithLifecycle()
    var keyDialogProvider by remember { mutableStateOf<ProviderId?>(null) }
    var routeMenu by remember { mutableStateOf(false) }
    var showAdvancedKeys by remember { mutableStateOf(false) }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Appearance", style = MaterialTheme.typography.titleSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ThemeMode.entries.forEach { m ->
                            OutlinedButton(onClick = { scope.launch { locator.settings.setTheme(m) } }) {
                                Text((if (settings.theme == m) "● " else "") + m.name.lowercase().replaceFirstChar { it.uppercase() })
                            }
                        }
                    }
                }
            }
        }
        item {
            InfoCard(
                "Ready to chat — no setup",
                "Chat works without an account or API key. Ai'sHub automatically uses free anonymous routes (Pollinations Classic, then AI Horde). " +
                    "They are best effort and rate-limited; if all are busy, wait and try again. No paid fallback exists."
            )
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Optional advanced keys", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Not required for normal chat. You may optionally add your own FREE-tier key for Gemini, Groq, or OpenRouter. " +
                            "Keys are encrypted with an Android Keystore-backed vault and never unlock paid routes.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedButton(onClick = { showAdvancedKeys = !showAdvancedKeys }) {
                        Text(if (showAdvancedKeys) "Hide optional keys" else "Show optional keys")
                    }
                    if (showAdvancedKeys) listOf(
                        ProviderId.GEMINI to "aistudio.google.com/api-keys",
                        ProviderId.GROQ to "console.groq.com/keys",
                        ProviderId.OPENROUTER to "openrouter.ai/settings/keys"
                    ).forEach { (provider, where) ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f)) {
                                Text(provider.displayName, style = MaterialTheme.typography.bodyMedium)
                                Text("Free key from: $where", style = MaterialTheme.typography.labelSmall)
                            }
                            if (keyPresence[provider] == true) {
                                TextButton(onClick = { locator.keys.remove(provider) }) { Text("Remove") }
                            } else {
                                TextButton(onClick = { keyDialogProvider = provider }) { Text("Add key") }
                            }
                        }
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Chat model", style = MaterialTheme.typography.titleSmall)
                    OutlinedButton(onClick = { routeMenu = true }) {
                        Text(FreeModelRegistry.byId(settings.preferredChatRoute)?.displayName ?: "Automatic (no-setup free routes)")
                    }
                    DropdownMenu(routeMenu, { routeMenu = false }) {
                        DropdownMenuItem({ Text("Automatic (no-setup free routes)") }, {
                            scope.launch { locator.settings.setChatRoute("auto") }; routeMenu = false
                        })
                        FreeModelRegistry.routes.filter { Capability.CHAT in it.capabilities && it.provider != ProviderId.LOCAL }.forEach { r ->
                            DropdownMenuItem({ Text(r.displayName) }, {
                                scope.launch { locator.settings.setChatRoute(r.id) }; routeMenu = false
                            })
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Stream responses")
                        Switch(settings.streamingEnabled, { v -> scope.launch { locator.settings.setStreaming(v) } })
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Allow disclosed model switching")
                        Switch(settings.allowProviderSwitch, { v -> scope.launch { locator.settings.setAllowSwitch(v) } })
                    }
                    Text("Temperature: ${"%.1f".format(settings.temperature)}", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0.2f, 0.7f, 1.0f).forEach { t ->
                            OutlinedButton(onClick = { scope.launch { locator.settings.setTemperature(t) } }) { Text("$t") }
                        }
                    }
                    Text("Max output tokens: ${settings.maxOutputTokens}", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(512, 2048, 4096).forEach { t ->
                            OutlinedButton(onClick = { scope.launch { locator.settings.setMaxTokens(t) } }) { Text("$t") }
                        }
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Privacy & data", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Conversations, projects, and diagnostics stay on this device. When you send a message, its prompt and relevant context go to the AI provider shown on the response. " +
                            "No-setup routes: Pollinations Classic may cache results; AI Horde volunteer workers can see prompts and the service logs IP/usage data. " +
                            "Optional free-tier Gemini content may be used by Google to improve products. Avoid sensitive data on all free routes.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    var confirmWipe by remember { mutableStateOf(false) }
                    TextButton(onClick = { confirmWipe = true }) { Text("Clear ALL local data (conversations, projects, diagnostics)") }
                    if (confirmWipe) {
                        AlertDialog(
                            onDismissRequest = { confirmWipe = false },
                            title = { Text("Delete all local data?") },
                            text = { Text("All conversations, battles, projects, agent tasks, reports, and diagnostics on this device will be permanently deleted. Provider-side copies follow each provider's retention policy. API keys are kept unless removed separately.") },
                            confirmButton = {
                                TextButton(onClick = {
                                    scope.launch { locator.database.clearAllTables() }
                                    confirmWipe = false
                                }) { Text("Delete everything") }
                            },
                            dismissButton = { TextButton(onClick = { confirmWipe = false }) { Text("Cancel") } }
                        )
                    }
                }
            }
        }
        item {
            InfoCard("About", "Ai'sHub v${com.aishub.BuildConfig.VERSION_NAME} · package com.aishub\nZero-setup chat: no account or API key required. Zero-paid policy: no paid models, endpoints, or fallbacks exist in this app. English UI; Bengali-ready resource structure (translation not yet complete).")
        }
    }

    keyDialogProvider?.let { provider ->
        var keyValue by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { keyDialogProvider = null },
            title = { Text("${provider.displayName} API key") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Paste your FREE-tier key. It is encrypted on-device and only sent to ${provider.displayName}.", style = MaterialTheme.typography.bodySmall)
                    OutlinedTextField(keyValue, { keyValue = it }, label = { Text("API key") },
                        visualTransformation = PasswordVisualTransformation(), singleLine = true)
                }
            },
            confirmButton = {
                TextButton(enabled = keyValue.isNotBlank(), onClick = {
                    locator.keys.set(provider, keyValue)
                    keyDialogProvider = null
                }) { Text("Save encrypted") }
            },
            dismissButton = { TextButton(onClick = { keyDialogProvider = null }) { Text("Cancel") } }
        )
    }
}
