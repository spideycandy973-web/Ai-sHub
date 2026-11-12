package com.aishub.data.settings

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "aishub_settings")

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class AppSettings(
    val theme: ThemeMode = ThemeMode.SYSTEM,
    val preferredChatRoute: String = "auto",
    val streamingEnabled: Boolean = true,
    val temperature: Float = 0.7f,
    val maxOutputTokens: Int = 2048,
    val cloudSyncEnabled: Boolean = false,
    val allowProviderSwitch: Boolean = true,
    val diagnosticsConsent: Boolean = false,
    val onboardingDone: Boolean = false,
    val ttsSpeechRate: Float = 1.0f
)

class SettingsStore(private val context: Context) {
    companion object {
        val THEME = stringPreferencesKey("theme")
        val CHAT_ROUTE = stringPreferencesKey("chat_route")
        val STREAMING = booleanPreferencesKey("streaming")
        val TEMPERATURE = floatPreferencesKey("temperature")
        val MAX_TOKENS = intPreferencesKey("max_tokens")
        val CLOUD_SYNC = booleanPreferencesKey("cloud_sync")
        val ALLOW_SWITCH = booleanPreferencesKey("allow_switch")
        val DIAG_CONSENT = booleanPreferencesKey("diag_consent")
        val ONBOARDED = booleanPreferencesKey("onboarded")
        val TTS_RATE = floatPreferencesKey("tts_rate")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            theme = runCatching { ThemeMode.valueOf(p[THEME] ?: "SYSTEM") }.getOrDefault(ThemeMode.SYSTEM),
            preferredChatRoute = p[CHAT_ROUTE] ?: "auto",
            streamingEnabled = p[STREAMING] ?: true,
            temperature = p[TEMPERATURE] ?: 0.7f,
            maxOutputTokens = p[MAX_TOKENS] ?: 2048,
            cloudSyncEnabled = p[CLOUD_SYNC] ?: false,
            allowProviderSwitch = p[ALLOW_SWITCH] ?: true,
            diagnosticsConsent = p[DIAG_CONSENT] ?: false,
            onboardingDone = p[ONBOARDED] ?: false,
            ttsSpeechRate = p[TTS_RATE] ?: 1.0f
        )
    }

    suspend fun setTheme(mode: ThemeMode) = context.dataStore.edit { it[THEME] = mode.name }.let {}
    suspend fun setChatRoute(id: String) = context.dataStore.edit { it[CHAT_ROUTE] = id }.let {}
    suspend fun setStreaming(v: Boolean) = context.dataStore.edit { it[STREAMING] = v }.let {}
    suspend fun setTemperature(v: Float) = context.dataStore.edit { it[TEMPERATURE] = v.coerceIn(0f, 2f) }.let {}
    suspend fun setMaxTokens(v: Int) = context.dataStore.edit { it[MAX_TOKENS] = v.coerceIn(64, 8192) }.let {}
    suspend fun setAllowSwitch(v: Boolean) = context.dataStore.edit { it[ALLOW_SWITCH] = v }.let {}
    suspend fun setDiagConsent(v: Boolean) = context.dataStore.edit { it[DIAG_CONSENT] = v }.let {}
    suspend fun setOnboarded(v: Boolean) = context.dataStore.edit { it[ONBOARDED] = v }.let {}
    suspend fun setTtsRate(v: Float) = context.dataStore.edit { it[TTS_RATE] = v.coerceIn(0.5f, 2f) }.let {}
}
