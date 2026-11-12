package com.aishub.di

import android.content.Context
import androidx.room.Room
import com.aishub.core.SecureVault
import com.aishub.data.db.AiHubDatabase
import com.aishub.data.errors.ErrorCenter
import com.aishub.data.keys.KeyStore
import com.aishub.data.registry.FreeModelRegistry
import com.aishub.data.repo.ChatRepository
import com.aishub.data.router.ModelRouter
import com.aishub.data.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Manual DI container: singletons with clear ownership, no framework overhead. */
class ServiceLocator(context: Context) {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val database: AiHubDatabase = Room.databaseBuilder(context, AiHubDatabase::class.java, "aishub.db")
        .fallbackToDestructiveMigrationOnDowngrade()
        .build()
    val vault = SecureVault()
    val keys = KeyStore(context, vault)
    val settings = SettingsStore(context)
    val errorCenter = ErrorCenter(database.errorDao(), appScope)
    val router = ModelRouter(keyPresence = { keys.has(it) })
    val chatRepository = ChatRepository(
        dao = database.chatDao(),
        usageDao = database.usageDao(),
        router = router,
        keys = keys,
        settings = settings,
        errors = errorCenter,
        adapters = ChatRepository.defaultAdapters()
    )
    val registry = FreeModelRegistry
}
