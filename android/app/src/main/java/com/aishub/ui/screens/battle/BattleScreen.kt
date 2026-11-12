package com.aishub.ui.screens.battle

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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.core.Redactor
import com.aishub.data.db.BattleEntity
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.domain.Capability
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.EmptyState
import com.aishub.ui.common.InfoCard
import com.aishub.ui.common.MarkdownText
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.util.UUID

private val categories = listOf("General", "Coding", "Reasoning", "Writing", "Instruction-following")

@Composable
fun BattleScreen(locator: ServiceLocator) {
    val scope = rememberCoroutineScope()
    val dao = locator.database.battleDao()
    val battles by dao.observeAll().collectAsStateWithLifecycle(initialValue = emptyList())
    var prompt by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General") }
    var catMenu by remember { mutableStateOf(false) }
    var running by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val eligible = remember { FreeModelRegistry.routes.filter { Capability.CHAT in it.capabilities && it.provider != com.aishub.domain.ProviderId.LOCAL } }

    fun runBattle() {
        if (prompt.isBlank() || running) return
        running = true; error = null
        val p = prompt.trim(); prompt = ""
        scope.launch {
            try {
                // Two distinct routes, same prompt, independent requests.
                val decisionA = locator.router.select(Capability.CHAT, null)
                val decisionB = locator.router.select(Capability.CHAT, null, exclude = setOf(decisionA.route.id))
                val id = UUID.randomUUID().toString()
                val shuffled = listOf(decisionA.route, decisionB.route).shuffled()
                val battle = BattleEntity(
                    id, p, category, System.currentTimeMillis(),
                    routeA = shuffled[0].id, routeB = shuffled[1].id
                )
                dao.insert(battle)
                val req = GenerationRequest(listOf(ChatTurn("user", p)), maxOutputTokens = 1536, temperature = 0.7f)
                val adapters = com.aishub.data.repo.ChatRepository.defaultAdapters()
                suspend fun ask(route: com.aishub.domain.ModelRoute): Pair<String?, String?> {
                    val key = locator.keys.get(route.provider)
                        ?: return null to "No key for ${route.provider.displayName}"
                    return try {
                        val result = adapters[route.provider]!!.generate(route, req, key)
                        locator.router.recordSuccess(route.id)
                        result.text to null
                    } catch (e: Throwable) {
                        locator.router.recordFailure(route.id, e)
                        null to Redactor.redact(e.message ?: "failed")
                    }
                }
                val a = async { ask(shuffled[0]) }
                val b = async { ask(shuffled[1]) }
                val (ra, ea) = a.await()
                val (rb, eb) = b.await()
                dao.update(battle.copy(responseA = ra, responseB = rb, errorA = ea, errorB = eb))
            } catch (e: Throwable) {
                error = Redactor.redact(e.message ?: "Battle failed")
            } finally { running = false }
        }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard("AI Battle", "One prompt, two different free models, independent responses. Identities stay hidden until you vote. Rankings are your personal results only.")
        }
        item {
            OutlinedTextField(prompt, { prompt = it }, label = { Text("Prompt for both models") },
                modifier = Modifier.fillMaxWidth(), minLines = 2)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { catMenu = true }) { Text(category) }
                DropdownMenu(catMenu, { catMenu = false }) {
                    categories.forEach { c -> DropdownMenuItem({ Text(c) }, { category = c; catMenu = false }) }
                }
                Button(onClick = { runBattle() }, enabled = prompt.isNotBlank() && !running) {
                    Text(if (running) "Running…" else "Battle!")
                }
            }
        }
        error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (battles.isEmpty()) {
            item { EmptyState("No battles yet", "Enter a prompt to compare two free models side by side.") }
        }
        items(battles, key = { it.id }) { battle ->
            BattleCard(battle) { vote ->
                scope.launch {
                    dao.byId(battle.id)?.let { dao.update(it.copy(vote = vote, revealed = true)) }
                }
            }
        }
        item { PersonalRankings(battles) }
    }
}

@Composable
private fun BattleCard(battle: BattleEntity, onVote: (String) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(battle.prompt, style = MaterialTheme.typography.titleSmall)
            Text("${battle.category} · ${if (battle.revealed) "revealed" else "blind"}", style = MaterialTheme.typography.labelSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("A" to (battle.responseA to battle.errorA), "B" to (battle.responseB to battle.errorB)).forEach { (label, pair) ->
                    val (response, err) = pair
                    Card(Modifier.weight(1f)) {
                        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                if (battle.revealed) "Model $label: ${FreeModelRegistry.byId(if (label == "A") battle.routeA else battle.routeB)?.displayName ?: "?"}"
                                else "Model $label",
                                style = MaterialTheme.typography.labelMedium
                            )
                            when {
                                err != null -> Text("Failed: $err", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                response == null -> Text("Waiting…", style = MaterialTheme.typography.bodySmall)
                                else -> MarkdownText(response.take(2000))
                            }
                        }
                    }
                }
            }
            if (!battle.revealed && (battle.responseA != null || battle.responseB != null)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = { onVote("A") }) { Text("A wins") }
                    OutlinedButton(onClick = { onVote("B") }) { Text("B wins") }
                    OutlinedButton(onClick = { onVote("tie") }) { Text("Tie") }
                    OutlinedButton(onClick = { onVote("unsatisfactory") }) { Text("Neither") }
                }
            } else if (battle.vote != null) {
                Text("Your vote: ${battle.vote}", style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

@Composable
private fun PersonalRankings(battles: List<BattleEntity>) {
    val voted = battles.filter { it.revealed && it.vote in listOf("A", "B") }
    if (voted.isEmpty()) return
    val wins = mutableMapOf<String, Int>()
    val losses = mutableMapOf<String, Int>()
    voted.forEach { b ->
        val winner = if (b.vote == "A") b.routeA else b.routeB
        val loser = if (b.vote == "A") b.routeB else b.routeA
        wins[winner] = (wins[winner] ?: 0) + 1
        losses[loser] = (losses[loser] ?: 0) + 1
    }
    InfoCard(
        "Your personal rankings (${voted.size} decisive votes)",
        (wins.keys + losses.keys).distinct().sortedByDescending { wins[it] ?: 0 }.joinToString("\n") { id ->
            "${FreeModelRegistry.byId(id)?.displayName ?: id}: ${wins[id] ?: 0} W – ${losses[id] ?: 0} L"
        } + "\n\nPersonal preference from your votes only — not a global leaderboard."
    )
}
