package com.aishub.data.errors

import com.aishub.BuildConfig
import com.aishub.core.Redactor
import com.aishub.data.db.ErrorDao
import com.aishub.data.db.ErrorRecordEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.UUID

/** Error Center: bounded, redacted local diagnostics. Never auto-uploads. */
class ErrorCenter(
    private val dao: ErrorDao,
    private val scope: CoroutineScope
) {
    fun observe(): Flow<List<ErrorRecordEntity>> = dao.observe()

    fun record(category: String, title: String, throwable: Throwable? = null, details: String = "", module: String? = null) {
        scope.launch(Dispatchers.IO) {
            insert(category, title, throwable, details, module)
        }
    }

    /** Synchronous path used only by the crash handler before process death. */
    fun recordBlocking(category: String, title: String, throwable: Throwable? = null, details: String = "") {
        runBlocking(Dispatchers.IO) { insert(category, title, throwable, details, null) }
    }

    private suspend fun insert(category: String, title: String, throwable: Throwable?, details: String, module: String?) {
        val stack = throwable?.stackTraceToString()?.take(4000) ?: ""
        val combined = buildString {
            if (details.isNotBlank()) appendLine(details)
            if (throwable != null) appendLine("${throwable.javaClass.name}: ${throwable.message}")
            if (stack.isNotBlank()) append(stack)
        }
        dao.insert(
            ErrorRecordEntity(
                id = UUID.randomUUID().toString(),
                category = category,
                title = Redactor.redact(title).take(200),
                details = Redactor.redact(combined).take(6000),
                appVersion = BuildConfig.VERSION_NAME,
                module = module,
                createdAt = System.currentTimeMillis()
            )
        )
        dao.trim(System.currentTimeMillis() - 30L * 86_400_000L)
    }

    suspend fun clear() = dao.clear()
    suspend fun delete(id: String) = dao.delete(id)
    suspend fun exportAll(): String = dao.all().joinToString("\n\n") { e ->
        "## [${e.category}] ${e.title}\nTime: ${java.util.Date(e.createdAt)} | App: ${e.appVersion} | Module: ${e.module ?: "-"}\n${e.details}"
    }
}
