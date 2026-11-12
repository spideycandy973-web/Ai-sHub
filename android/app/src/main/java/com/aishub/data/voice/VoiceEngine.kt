package com.aishub.data.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.Locale
import java.util.UUID

sealed class SttEvent {
    data object Listening : SttEvent()
    data class Partial(val text: String) : SttEvent()
    data class Final(val text: String) : SttEvent()
    data class Error(val message: String) : SttEvent()
}

/**
 * On-device speech: Android SpeechRecognizer (STT) and TextToSpeech (TTS).
 * The selected system recognizer may use the network — this is disclosed in the UI.
 * No paid voice API is used.
 */
class VoiceEngine(private val context: Context) {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recognizer: SpeechRecognizer? = null

    fun sttAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun initTts(onReady: (Boolean) -> Unit) {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.US
            }
            onReady(ttsReady)
        }
    }

    fun availableTtsLanguages(): List<String> {
        val engine = tts ?: return emptyList()
        return runCatching {
            engine.availableLanguages?.mapNotNull { loc ->
                val r = engine.isLanguageAvailable(loc)
                if (r >= TextToSpeech.LANG_AVAILABLE) loc.toLanguageTag() else null
            }?.distinct() ?: emptyList()
        }.getOrDefault(emptyList())
    }

    fun setTtsLanguage(tag: String): Boolean {
        val loc = Locale.forLanguageTag(tag)
        val r = tts?.isLanguageAvailable(loc) ?: TextToSpeech.LANG_NOT_SUPPORTED
        if (r >= TextToSpeech.LANG_AVAILABLE) { tts?.language = loc; return true }
        return false
    }

    fun setSpeechRate(rate: Float) { tts?.setSpeechRate(rate) }

    fun speak(text: String, onDone: () -> Unit = {}): Boolean {
        val engine = tts ?: return false
        if (!ttsReady) return false
        val id = UUID.randomUUID().toString()
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { if (utteranceId == id) onDone() }
            @Deprecated("deprecated") override fun onError(utteranceId: String?) { if (utteranceId == id) onDone() }
        })
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
        return true
    }

    fun stopSpeaking() { tts?.stop() }

    /** One-shot listening session. Caller must hold RECORD_AUDIO permission. */
    fun listen(languageTag: String = "en-US"): Flow<SttEvent> = callbackFlow {
        if (!sttAvailable()) {
            trySend(SttEvent.Error("No speech recognizer available on this device. Use text input instead."))
            close()
            return@callbackFlow
        }
        val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
        mainHandler.post {
            val rec = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer = rec
            rec.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) { trySend(SttEvent.Listening) }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    trySend(SttEvent.Error(when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission missing"
                        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Recognizer network error (the system recognizer may need internet)"
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized — try again"
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech heard"
                        else -> "Recognition error ($error)"
                    }))
                    close()
                }
                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
                    trySend(SttEvent.Final(text))
                    close()
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                        ?.let { trySend(SttEvent.Partial(it)) }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            rec.startListening(intent)
        }
        awaitClose {
            mainHandler.post {
                recognizer?.stopListening()
                recognizer?.destroy()
                recognizer = null
            }
        }
    }

    fun stopListening() {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            recognizer?.stopListening()
        }
    }

    fun release() {
        tts?.stop(); tts?.shutdown(); tts = null
        recognizer?.destroy(); recognizer = null
    }
}
