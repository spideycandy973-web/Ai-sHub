package com.aishub.ui.screens.errors

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.EmptyState
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun ErrorCenterScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val errors by locator.errorCenter.observe().collectAsStateWithLifecycle(initialValue = emptyList())
    val clipboard = LocalClipboardManager.current

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            InfoCard("Error Center", "Redacted local diagnostics (max 200, 30-day retention). Nothing is uploaded automatically. Copy or export explicitly if you want to share.")
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = {
                    scope.launch { clipboard.setText(AnnotatedString(locator.errorCenter.exportAll())) }
                }) { Text("Copy full report") }
                TextButton(onClick = { scope.launch { locator.errorCenter.clear() } }) { Text("Clear history") }
            }
        }
        if (errors.isEmpty()) {
            item { EmptyState("No errors recorded", "Provider failures, crashes, and integration errors will appear here with redacted details.") }
        }
        items(errors, key = { it.id }) { e ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("[${e.category}] ${e.title}", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(e.createdAt))} · app ${e.appVersion} · ${e.module ?: "general"}",
                        style = MaterialTheme.typography.labelSmall
                    )
                    if (e.details.isNotBlank()) {
                        Text(e.details.take(1200), style = MaterialTheme.typography.bodySmall, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                    }
                    Row {
                        TextButton(onClick = { clipboard.setText(AnnotatedString("${e.title}\n${e.details}")) }) { Text("Copy") }
                        TextButton(onClick = { scope.launch { locator.errorCenter.delete(e.id) } }) { Text("Delete") }
                    }
                }
            }
        }
    }
}
