package com.aishub.ui.screens.research

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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.db.ResearchReportEntity
import com.aishub.data.research.ResearchEngine
import com.aishub.data.research.ResearchSource
import com.aishub.di.ServiceLocator
import com.aishub.domain.Capability
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.ui.common.EmptyState
import com.aishub.ui.common.InfoCard
import com.aishub.ui.common.MarkdownText
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.text.DateFormat
import java.util.Date
import java.util.UUID

@Composable
fun ResearchScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val engine = remember { ResearchEngine() }
    val dao = locator.database.researchDao()
    val reports by dao.observe().collectAsStateWithLifecycle(initialValue = emptyList())
    var question by remember { mutableStateOf("") }
    var progress by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val json = remember { Json { ignoreUnknownKeys = true } }

    fun runResearch() {
        if (question.isBlank() || busy) return
        busy = true
        val q = question.trim(); question = ""
        scope.launch {
            try {
                progress = "1/4 Searching Wikipedia (official free API)…"
                val sources = engine.searchWikipedia(q, limit = 4)
                if (sources.isEmpty()) {
                    progress = "No sources found. Try different wording."
                    return@launch
                }
                progress = "2/4 Reading ${sources.size} sources…"
                val evidence = mutableListOf<Pair<ResearchSource, String>>()
                sources.forEach { s ->
                    runCatching { engine.wikipediaArticleText(s.title, maxChars = 6000) }
                        .getOrNull()?.takeIf { it.isNotBlank() }
                        ?.let { evidence += s to it }
                }
                if (evidence.isEmpty()) {
                    progress = "Sources found but could not be read. Partial results preserved below."
                }
                progress = "3/4 Synthesizing with a free model…"
                val decision = locator.router.select(Capability.REASONING, null)
                val key = if (decision.route.requiresUserKey) {
                    locator.keys.get(decision.route.provider) ?: error("No provider key — add one in Settings")
                } else ""
                val adapter = com.aishub.data.repo.ChatRepository.defaultAdapters()[decision.route.provider]!!
                val evidenceText = evidence.mapIndexed { i, (s, text) ->
                    "[Source ${i + 1}] ${s.title} (${s.url})\n${text.take(5000)}"
                }.joinToString("\n\n")
                val prompt = """
                    Write a structured research report answering: "$q"

                    Use ONLY the evidence below. Cite sources as [1], [2] etc.
                    Distinguish verified facts (in sources), claims, and your inference. Note contradictions and gaps.
                    Do NOT invent citations. If evidence is insufficient, say so.

                    $evidenceText
                """.trimIndent()
                val result = adapter.generate(
                    decision.route,
                    GenerationRequest(listOf(ChatTurn("user", prompt)), maxOutputTokens = 2048, temperature = 0.3f),
                    key
                )
                locator.router.recordSuccess(decision.route.id)
                progress = "4/4 Saving report…"
                val refs = sources.mapIndexed { i, s -> "${i + 1}. ${s.title} — ${s.url} (retrieved ${DateFormat.getDateInstance().format(Date(s.retrievedAt))})" }
                val report = result.text + "\n\n## Sources actually accessed\n" + refs.joinToString("\n") +
                    "\n\nSynthesis model: ${result.actualModelId} (${result.provider.displayName}). Wikipedia content: CC BY-SA."
                dao.insert(
                    ResearchReportEntity(
                        UUID.randomUUID().toString(), q, report,
                        json.encodeToString(sources), System.currentTimeMillis()
                    )
                )
                progress = "Done — report saved."
            } catch (e: Throwable) {
                locator.errorCenter.record("research", "Research failed", e, module = "research")
                progress = "Failed: ${com.aishub.core.Redactor.redact(e.message ?: "?")}"
            } finally { busy = false }
        }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard("Deep Research (free sources)", "Searches the official Wikipedia API, reads the articles, and synthesizes a cited report with a free model. Only sources actually accessed are cited. General web search APIs are not free — this is the honest free-tier scope.")
        }
        item {
            OutlinedTextField(question, { question = it }, label = { Text("Research question") },
                modifier = Modifier.fillMaxWidth(), minLines = 2)
        }
        item {
            Button(onClick = { runResearch() }, enabled = question.isNotBlank() && !busy) {
                Text(if (busy) "Researching…" else "Research")
            }
        }
        progress?.let { item { Text(it, style = MaterialTheme.typography.bodySmall) } }
        if (reports.isEmpty()) {
            item { EmptyState("No reports yet", "Ask a question to produce a cited research report. Reports are saved locally and can be copied as Markdown.") }
        }
        items(reports, key = { it.id }) { r ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(r.question, style = MaterialTheme.typography.titleSmall)
                    Text(DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(r.createdAt)), style = MaterialTheme.typography.labelSmall)
                    MarkdownText(r.reportMarkdown.take(6000))
                    Row {
                        TextButton(onClick = { clipboard.setText(AnnotatedString(r.reportMarkdown)) }) { Text("Copy Markdown") }
                        TextButton(onClick = { scope.launch { dao.delete(r.id) } }) { Text("Delete") }
                    }
                }
            }
        }
    }
}
