package com.aishub.data.keys

import android.content.Context
import com.aishub.core.SecureVault
import com.aishub.domain.ProviderId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Encrypted storage for user-supplied free-provider API keys.
 * Keys are encrypted with the Keystore-backed vault; only presence flags are exposed to UI state.
 */
class KeyStore(context: Context, private val vault: SecureVault) {
    private val prefs = context.getSharedPreferences("aishub_keys_encrypted", Context.MODE_PRIVATE)
    private val _presence = MutableStateFlow(readPresence())
    val presence: StateFlow<Map<ProviderId, Boolean>> = _presence.asStateFlow()

    private fun readPresence(): Map<ProviderId, Boolean> =
        ProviderId.entries.filter { it != ProviderId.LOCAL }.associateWith { prefs.contains(it.name) }

    fun has(provider: ProviderId): Boolean = prefs.contains(provider.name)

    fun set(provider: ProviderId, key: String) {
        require(provider != ProviderId.LOCAL)
        prefs.edit().putString(provider.name, vault.encrypt(key.trim())).apply()
        _presence.value = readPresence()
    }

    fun get(provider: ProviderId): String? {
        val enc = prefs.getString(provider.name, null) ?: return null
        return runCatching { vault.decrypt(enc) }.getOrNull()
    }

    fun remove(provider: ProviderId) {
        prefs.edit().remove(provider.name).apply()
        _presence.value = readPresence()
    }
}
