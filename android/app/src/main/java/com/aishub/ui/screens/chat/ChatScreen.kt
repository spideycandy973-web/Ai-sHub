package com.aishub.ui.screens.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.db.MessageEntity
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.MarkdownText
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@Composable
fun ChatScreen(locator: ServiceLocator, conversationId: String) {
    val scope = rememberCoroutineScope()
    val repo = locator.chatRepository
    val messages by repo.messages(conversationId).collectAsStateWithLifecycle(initialValue = emptyList())
    var input by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    var sendJob by remember { mutableStateOf<Job?>(null) }
    val listState = rememberLazyListState()
    val clipboard = LocalClipboardManager.current

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    fun doSend(text: String) {
        if (text.isBlank() || sending) return
        sending = true
        notice = null
        input = ""
        sendJob = scope.launch {
            try {
                repo.send(conversationId, text.trim()).collect { event ->
                    when {
                        event.startsWith("switched:") -> notice = "Model switched: now using ${event.removePrefix("switched:")}"
                        event.startsWith("error:") -> notice = event.removePrefix("error:")
                    }
                }
            } finally {
                sending = false
                sendJob = null
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        notice?.let {
            Card(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Text(it, Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { m -> MessageBubble(m, sending, clipboard, onRetry = {
                scope.launch {
                    repo.retryLast(conversationId)?.let { doSend(it) }
                }
            }) }
        }
        Row(
            Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = input, onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message (free models only)") },
                maxLines = 5
            )
            if (sending) {
                FilledIconButton(onClick = { sendJob?.cancel() }) {
                    Icon(Icons.Default.Stop, contentDescription = "Stop generation")
                }
            } else {
                FilledIconButton(onClick = { doSend(input) }, enabled = input.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send message")
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(
    m: MessageEntity, sending: Boolean,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
    onRetry: () -> Unit
) {
    val isUser = m.role == "user"
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (isUser) Alignment.End else Alignment.Start) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = when {
                    m.status == "failed" -> MaterialTheme.colorScheme.errorContainer
                    isUser -> MaterialTheme.colorScheme.primaryContainer
                    else -> MaterialTheme.colorScheme.surfaceVariant
                }
            ),
            modifier = Modifier.fillMaxWidth(0.92f)
        ) {
            Column(Modifier.padding(12.dp)) {
                when {
                    m.status == "failed" -> {
                        Text("Request failed", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onErrorContainer)
                        Text(m.errorMessage ?: "Unknown error", style = MaterialTheme.typography.bodySmall)
                        IconButton(onClick = onRetry) { Icon(Icons.Default.Refresh, contentDescription = "Retry") }
                    }
                    m.status == "streaming" && m.text.isEmpty() -> CircularProgressIndicator(Modifier.padding(4.dp))
                    isUser -> Text(m.text, style = MaterialTheme.typography.bodyMedium)
                    else -> MarkdownText(m.text)
                }
                if (m.status == "cancelled") {
                    Text("⏹ Cancelled — partial response saved", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        if (!isUser && m.status == "complete") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    buildString {
                        append(m.providerName ?: "?")
                        append(" · ")
                        append(m.actualModelId ?: "?")
                        m.outputTokens?.let { append(" · $it out tokens") }
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp)
                )
                IconButton(onClick = { clipboard.setText(AnnotatedString(m.text)) }) {
                    Icon(Icons.Default.ContentCopy, contentDescription = "Copy response",
                        modifier = Modifier.padding(4.dp))
                }
            }
        }
    }
}
