package com.aishub.ui.screens.voice

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.aishub.data.voice.SttEvent
import com.aishub.data.voice.VoiceEngine
import com.aishub.di.ServiceLocator
import com.aishub.domain.Capability
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.ui.common.InfoCard
import kotlinx.coroutines.launch

@Composable
fun VoiceScreen(locator: ServiceLocator) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val engine = remember { VoiceEngine(context) }
    var ttsReady by remember { mutableStateOf(false) }
    var ttsLangs by remember { mutableStateOf<List<String>>(emptyList()) }
    var listening by remember { mutableStateOf(false) }
    var speaking by remember { mutableStateOf(false) }
    var transcript by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("Idle") }
    var reply by remember { mutableStateOf<String?>(null) }
    var hasMicPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
    }
    val history = remember { mutableStateListOf<ChatTurn>() }
    val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasMicPermission = granted
        if (!granted) status = "Microphone denied — text input still works."
    }

    DisposableEffect(Unit) {
        engine.initTts { ready ->
            ttsReady = ready
            if (ready) ttsLangs = engine.availableTtsLanguages()
        }
        onDispose { engine.release() }
    }

    fun askAndSpeak(text: String) {
        if (text.isBlank()) return
        status = "Thinking (free model)…"
        history += ChatTurn("user", text)
        scope.launch {
            try {
                val decision = locator.router.select(Capability.CHAT, null)
                val key = locator.keys.get(decision.route.provider) ?: error("No provider key — add one in Settings")
                val adapter = com.aishub.data.repo.ChatRepository.defaultAdapters()[decision.route.provider]!!
                val result = adapter.generate(
                    decision.route,
                    GenerationRequest(history.toList(), maxOutputTokens = 512,
                        systemInstruction = "You are a voice assistant. Answer briefly and conversationally in 2-4 sentences."),
                    key
                )
                locator.router.recordSuccess(decision.route.id)
                history += ChatTurn("assistant", result.text)
                reply = result.text
                status = "Speaking (${decision.route.displayName})…"
                speaking = true
                engine.speak(result.text) { speaking = false; status = "Idle" }
            } catch (e: Throwable) {
                locator.errorCenter.record("voice", "Voice conversation failed", e, module = "voice")
                status = "Error: ${com.aishub.core.Redactor.redact(e.message ?: "?")}"
            }
        }
    }

    fun startListening() {
        if (!hasMicPermission) { micLauncher.launch(Manifest.permission.RECORD_AUDIO); return }
        listening = true
        status = "Listening…"
        scope.launch {
            engine.listen().collect { event ->
                when (event) {
                    is SttEvent.Listening -> status = "Listening… (system recognizer; may use network)"
                    is SttEvent.Partial -> transcript = event.text
                    is SttEvent.Final -> {
                        transcript = event.text
                        listening = false
                        status = "Transcribed — sending"
                        askAndSpeak(event.text)
                    }
                    is SttEvent.Error -> {
                        listening = false
                        status = event.message
                    }
                }
            }
        }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard(
                "Voice AI (on-device)",
                "Uses Android's speech recognizer and TextToSpeech engine — no paid voice API. " +
                    "The system recognizer may require network access. Available: " +
                    (if (engine.sttAvailable()) "STT ✓" else "STT ✗ (use text)") + " · " +
                    (if (ttsReady) "TTS ✓ (${ttsLangs.size} languages)" else "TTS initializing/unavailable")
            )
        }
        item { Text("Status: $status", style = MaterialTheme.typography.bodyMedium) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { if (listening) { engine.stopListening(); listening = false; status = "Stopped" } else startListening() }) {
                    Text(if (listening) "Stop listening" else "🎤 Speak")
                }
                OutlinedButton(enabled = speaking, onClick = { engine.stopSpeaking(); speaking = false; status = "Stopped speaking" }) {
                    Text("Stop speech")
                }
            }
        }
        item {
            OutlinedTextField(transcript, { transcript = it },
                label = { Text("Transcript (editable) — or type here") },
                modifier = Modifier.fillMaxWidth(), minLines = 2)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = transcript.isNotBlank(), onClick = { askAndSpeak(transcript) }) { Text("Send") }
                OutlinedButton(onClick = { transcript = ""; history.clear(); reply = null }) { Text("Clear conversation") }
            }
        }
        reply?.let {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Text("Assistant", style = MaterialTheme.typography.labelMedium)
                        Text(it, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        if (ttsLangs.isNotEmpty()) {
            item {
                Text("TTS language", style = MaterialTheme.typography.titleSmall)
            }
            items(ttsLangs.take(8)) { lang ->
                OutlinedButton(onClick = { engine.setTtsLanguage(lang); status = "TTS language: $lang" }) { Text(lang) }
            }
        }
    }
}
