package com.aishub.ui.screens.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.db.ConversationEntity
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.EmptyState
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun ChatListScreen(locator: ServiceLocator, openChat: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val repo = locator.chatRepository
    val conversations by repo.conversations().collectAsStateWithLifecycle(initialValue = emptyList())
    var query by remember { mutableStateOf("") }
    val filtered = if (query.isBlank()) conversations else conversations.filter { it.title.contains(query, true) }
    var renameTarget by remember { mutableStateOf<ConversationEntity?>(null) }
    var deleteTarget by remember { mutableStateOf<ConversationEntity?>(null) }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = {
                scope.launch { openChat(repo.createConversation("New chat")) }
            }) { Icon(Icons.Default.Add, contentDescription = "New conversation") }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                label = { Text("Search conversations") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                singleLine = true
            )
            if (filtered.isEmpty()) {
                EmptyState(
                    "No conversations yet",
                    "Tap + and type a message. No account, API key, or setup is needed.\nFree public AI services are best effort; avoid sensitive data."
                )
            } else {
                LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(filtered, key = { it.id }) { c ->
                        Card(Modifier.fillMaxWidth().clickable { openChat(c.id) }) {
                            Row(Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp, end = 4.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        (if (c.pinned) "📌 " else "") + c.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        maxLines = 1
                                    )
                                    Text(
                                        DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(c.updatedAt)),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                IconButton(onClick = { scope.launch { repo.togglePin(c.id) } }) {
                                    Icon(Icons.Default.PushPin, contentDescription = if (c.pinned) "Unpin" else "Pin")
                                }
                                IconButton(onClick = { scope.launch { repo.archive(c.id, true) } }) {
                                    Icon(Icons.Default.Archive, contentDescription = "Archive")
                                }
                                IconButton(onClick = { deleteTarget = c }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete conversation")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    renameTarget?.let { c ->
        var title by remember { mutableStateOf(c.title) }
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text("Rename conversation") },
            text = { OutlinedTextField(value = title, onValueChange = { title = it }, singleLine = true) },
            confirmButton = {
                TextButton(onClick = { scope.launch { repo.rename(c.id, title) }; renameTarget = null }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { renameTarget = null }) { Text("Cancel") } }
        )
    }

    deleteTarget?.let { c ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete conversation?") },
            text = { Text("\"${c.title}\" and all its messages will be permanently deleted from this device. Copies already sent to AI providers are governed by their retention policies.") },
            confirmButton = {
                TextButton(onClick = { scope.launch { repo.deleteConversation(c.id) }; deleteTarget = null }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } }
        )
    }
}
