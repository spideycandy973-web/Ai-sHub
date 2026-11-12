package com.aishub.ui.screens.developer

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.aishub.data.github.GitHubClient
import com.aishub.data.github.GhRelease
import com.aishub.data.github.GhRepo
import com.aishub.data.github.GhWorkflowRun
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch

private const val GH_TOKEN_PREF = "github_token"

/**
 * Developer Hub: connect GitHub via the official device flow using the app owner's
 * public OAuth client ID, then browse real repository data.
 */
@Composable
fun DeveloperScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val gh = remember { GitHubClient() }
    val prefs = remember { context.getSharedPreferences("aishub_dev", android.content.Context.MODE_PRIVATE) }
    var clientId by remember { mutableStateOf(prefs.getString("gh_client_id", "") ?: "") }
    var connected by remember { mutableStateOf(prefs.contains(GH_TOKEN_PREF)) }
    var deviceCodePrompt by remember { mutableStateOf<String?>(null) }
    var pendingFlow by remember { mutableStateOf<com.aishub.data.github.DeviceFlowPrompt?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var repos by remember { mutableStateOf<List<GhRepo>>(emptyList()) }
    var selectedRepo by remember { mutableStateOf<GhRepo?>(null) }
    var releases by remember { mutableStateOf<List<GhRelease>>(emptyList()) }
    var runs by remember { mutableStateOf<List<GhWorkflowRun>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }

    fun token(): String? = runCatching {
        prefs.getString(GH_TOKEN_PREF, null)?.let { locator.vault.decrypt(it) }
    }.getOrNull()

    fun loadRepos() {
        val t = token() ?: return
        busy = true
        scope.launch {
            try { repos = gh.listRepos(t); status = "Loaded ${repos.size} repositories" }
            catch (e: Throwable) { status = "Error: ${e.message}" }
            finally { busy = false }
        }
    }

    fun inspect(repo: GhRepo) {
        selectedRepo = repo
        val t = token()
        val parts = repo.full_name.split("/")
        scope.launch {
            releases = runCatching { gh.listReleases(parts[0], parts[1], t) }.getOrDefault(emptyList())
            runs = runCatching { gh.listWorkflowRuns(parts[0], parts[1], t) }.getOrDefault(emptyList())
        }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard(
                "GitHub connection (official device flow)",
                "Create a free GitHub OAuth App (github.com/settings/developers, enable Device Flow) and paste its public Client ID below. " +
                    "No client secret is needed or embedded. You authorize on github.com — this app never sees your password."
            )
        }
        if (!connected) {
            item {
                OutlinedTextField(clientId, { clientId = it; prefs.edit().putString("gh_client_id", it).apply() },
                    label = { Text("OAuth App Client ID (public)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
            item {
                Button(enabled = clientId.isNotBlank() && !busy, onClick = {
                    busy = true
                    scope.launch {
                        try {
                            val flow = com.aishub.data.github.GitHubDeviceFlow()
                            val prompt = flow.start(clientId.trim())
                            pendingFlow = prompt
                            deviceCodePrompt = prompt.userCode
                            clipboard.setText(AnnotatedString(prompt.userCode))
                            status = "Enter code ${prompt.userCode} at ${prompt.verificationUri} (copied). Waiting for approval…"
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(prompt.verificationUri))) }
                            val tokenValue = flow.poll(clientId.trim(), prompt.deviceCode, prompt.interval)
                            prefs.edit().putString(GH_TOKEN_PREF, locator.vault.encrypt(tokenValue)).apply()
                            connected = true
                            deviceCodePrompt = null
                            pendingFlow = null
                            status = "Connected to GitHub ✓"
                        } catch (e: Throwable) { status = "Error: ${e.message}" }
                        finally { busy = false }
                    }
                }) { Text("Start GitHub device flow") }
            }
            deviceCodePrompt?.let { code ->
                item { Text("Code: $code — approve in the browser, then return here.", style = MaterialTheme.typography.bodyMedium) }
            }
        } else {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { loadRepos() }, enabled = !busy) { Text(if (busy) "Loading…" else "Load my repositories") }
                    OutlinedButton(onClick = {
                        prefs.edit().remove(GH_TOKEN_PREF).apply()
                        connected = false; repos = emptyList(); selectedRepo = null
                        status = "Disconnected. Token removed from this device."
                    }) { Text("Disconnect") }
                }
            }
        }
        status?.let { item { Text(it, style = MaterialTheme.typography.bodySmall) } }
        items(repos, key = { it.full_name }) { repo ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text(repo.full_name, style = MaterialTheme.typography.titleSmall)
                    repo.description?.let { Text(it, style = MaterialTheme.typography.bodySmall, maxLines = 2) }
                    Text("${if (repo.private) "Private" else "Public"} · ${repo.default_branch} · ★ ${repo.stargazers_count}", style = MaterialTheme.typography.labelSmall)
                    TextButton(onClick = { inspect(repo) }) { Text("Inspect releases & CI") }
                }
            }
        }
        selectedRepo?.let { repo ->
            item { Text("${repo.full_name} — releases", style = MaterialTheme.typography.titleSmall) }
            if (releases.isEmpty()) item { Text("No releases.", style = MaterialTheme.typography.bodySmall) }
            items(releases, key = { it.tag_name }) { rel ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(rel.tag_name + (rel.name?.let { " — $it" } ?: ""), style = MaterialTheme.typography.titleSmall)
                        rel.assets.forEach { a ->
                            Text("📦 ${a.name} · ${a.size / 1024} KB · ${a.state}", style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(rel.html_url))) }) { Text("Open release") }
                    }
                }
            }
            item { Text("Workflow runs", style = MaterialTheme.typography.titleSmall) }
            if (runs.isEmpty()) item { Text("No workflow runs visible.", style = MaterialTheme.typography.bodySmall) }
            items(runs, key = { it.id }) { run ->
                Text("• ${run.name ?: "workflow"} — ${run.status} ${run.conclusion ?: ""}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
