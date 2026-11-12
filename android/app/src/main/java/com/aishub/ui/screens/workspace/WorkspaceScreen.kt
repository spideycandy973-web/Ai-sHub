package com.aishub.ui.screens.workspace

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
import androidx.compose.material.icons.filled.Delete
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.db.NoteEntity
import com.aishub.data.db.ProjectEntity
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.EmptyState
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

@Composable
fun WorkspaceScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val dao = locator.database.workspaceDao()
    val context = LocalContext.current
    val projects by dao.observeProjects().collectAsStateWithLifecycle(initialValue = emptyList())
    var showCreate by remember { mutableStateOf(false) }
    var openProject by remember { mutableStateOf<ProjectEntity?>(null) }
    var deleteTarget by remember { mutableStateOf<ProjectEntity?>(null) }
    var query by remember { mutableStateOf("") }
    val filtered = if (query.isBlank()) projects else projects.filter { it.name.contains(query, true) }

    Scaffold(floatingActionButton = {
        FloatingActionButton(onClick = { showCreate = true }) { Icon(Icons.Default.Add, "Create project") }
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(query, { query = it }, label = { Text("Search projects") },
                modifier = Modifier.fillMaxWidth().padding(16.dp), singleLine = true)
            if (filtered.isEmpty()) {
                EmptyState("No projects", "Create a project to organize notes, instructions, agent tasks, and generated files. Everything stays on this device unless you export it.")
            } else {
                LazyColumn(contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(filtered, key = { it.id }) { p ->
                        Card(Modifier.fillMaxWidth().clickable { openProject = p }) {
                            Row(Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text(p.name, style = MaterialTheme.typography.titleSmall)
                                    if (p.description.isNotBlank()) Text(p.description, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                                }
                                IconButton(onClick = { deleteTarget = p }) { Icon(Icons.Default.Delete, "Delete project") }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        var name by remember { mutableStateOf("") }
        var desc by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreate = false },
            title = { Text("New project") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                    OutlinedTextField(desc, { desc = it }, label = { Text("Description") })
                }
            },
            confirmButton = {
                TextButton(enabled = name.isNotBlank(), onClick = {
                    scope.launch {
                        val now = System.currentTimeMillis()
                        dao.insertProject(ProjectEntity(UUID.randomUUID().toString(), name.trim(), desc.trim(), createdAt = now, updatedAt = now))
                    }
                    showCreate = false
                }) { Text("Create") }
            },
            dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel") } }
        )
    }

    deleteTarget?.let { p ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete project?") },
            text = { Text("\"${p.name}\" with its notes will be deleted. Agent sandbox files are also removed.") },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        dao.deleteProject(p.id)
                        File(context.filesDir, "agent_projects/${p.id.replace(Regex("[^A-Za-z0-9_-]"), "_")}").deleteRecursively()
                    }
                    deleteTarget = null
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } }
        )
    }

    openProject?.let { p -> ProjectDetail(locator, p) { openProject = null } }
}

@Composable
private fun ProjectDetail(locator: ServiceLocator, project: ProjectEntity, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    val dao = locator.database.workspaceDao()
    val notes by dao.observeNotes(project.id).collectAsStateWithLifecycle(initialValue = emptyList())
    var noteTitle by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var instructions by remember { mutableStateOf(project.instructions) }

    AlertDialog(
        onDismissRequest = close,
        title = { Text(project.name) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    OutlinedTextField(instructions, { instructions = it },
                        label = { Text("Project instructions (sent as context to AI when you choose)") },
                        modifier = Modifier.fillMaxWidth(), minLines = 2)
                }
                item {
                    TextButton(onClick = {
                        scope.launch { dao.updateProject(project.copy(instructions = instructions, updatedAt = System.currentTimeMillis())) }
                    }) { Text("Save instructions") }
                }
                item { Text("Notes", style = MaterialTheme.typography.titleSmall) }
                items(notes, key = { it.id }) { n ->
                    Card(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(start = 12.dp, top = 8.dp, bottom = 8.dp, end = 4.dp)) {
                            Column(Modifier.weight(1f)) {
                                Text(n.title, style = MaterialTheme.typography.titleSmall)
                                Text(n.body, style = MaterialTheme.typography.bodySmall, maxLines = 4)
                            }
                            IconButton(onClick = { scope.launch { dao.deleteNote(n.id) } }) { Icon(Icons.Default.Delete, "Delete note") }
                        }
                    }
                }
                item {
                    OutlinedTextField(noteTitle, { noteTitle = it }, label = { Text("Note title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
                item {
                    OutlinedTextField(noteBody, { noteBody = it }, label = { Text("Note body") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
                item {
                    TextButton(enabled = noteTitle.isNotBlank(), onClick = {
                        scope.launch {
                            dao.insertNote(NoteEntity(UUID.randomUUID().toString(), project.id, noteTitle.trim(), noteBody.trim(), System.currentTimeMillis()))
                            noteTitle = ""; noteBody = ""
                        }
                    }) { Text("Add note") }
                }
            }
        },
        confirmButton = { TextButton(onClick = close) { Text("Close") } }
    )
}
