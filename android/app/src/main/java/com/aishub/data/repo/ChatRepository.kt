package com.aishub.data.repo

import com.aishub.data.db.ChatDao
import com.aishub.data.db.ConversationEntity
import com.aishub.data.db.MessageEntity
import com.aishub.data.db.UsageDao
import com.aishub.data.db.UsageRecordEntity
import com.aishub.data.errors.ErrorCenter
import com.aishub.data.provider.GeminiAdapter
import com.aishub.data.provider.OpenAiCompatAdapter
import com.aishub.data.provider.ProviderAdapter
import com.aishub.data.keys.KeyStore
import com.aishub.data.router.ModelRouter
import com.aishub.data.settings.SettingsStore
import com.aishub.domain.Capability
import com.aishub.domain.ChatTurn
import com.aishub.domain.GenerationRequest
import com.aishub.domain.ModelRoute
import com.aishub.domain.ProviderError
import com.aishub.domain.ProviderId
import com.aishub.domain.StreamChunk
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.putJsonArray
import java.util.UUID

data class SendOutcome(val assistantMessageId: String, val switchedFrom: String?)

/** Chat engine: routing, streaming persistence, retries, attribution. */
class ChatRepository(
    private val dao: ChatDao,
    private val usageDao: UsageDao,
    private val router: ModelRouter,
    private val keys: KeyStore,
    private val settings: SettingsStore,
    private val errors: ErrorCenter,
    private val adapters: Map<ProviderId, ProviderAdapter>
) {
    fun conversations(): Flow<List<ConversationEntity>> = dao.observeConversations()
    fun archived(): Flow<List<ConversationEntity>> = dao.observeArchived()
    fun search(q: String): Flow<List<ConversationEntity>> = dao.search(q)
    fun messages(cid: String): Flow<List<MessageEntity>> = dao.observeMessages(cid)

    suspend fun createConversation(title: String): String {
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        dao.insertConversation(ConversationEntity(id, title, now, now))
        return id
    }

    suspend fun rename(cid: String, title: String) {
        dao.conversation(cid)?.let { dao.updateConversation(it.copy(title = title, updatedAt = System.currentTimeMillis())) }
    }

    suspend fun togglePin(cid: String) {
        dao.conversation(cid)?.let { dao.updateConversation(it.copy(pinned = !it.pinned)) }
    }

    suspend fun archive(cid: String, archived: Boolean) {
        dao.conversation(cid)?.let { dao.updateConversation(it.copy(archived = archived, updatedAt = System.currentTimeMillis())) }
    }

    suspend fun deleteConversation(cid: String) = dao.deleteConversation(cid)

    suspend fun setSystemInstruction(cid: String, instruction: String?) {
        dao.conversation(cid)?.let { dao.updateConversation(it.copy(systemInstruction = instruction?.ifBlank { null })) }
    }

    suspend fun exportConversation(cid: String): String {
        val c = dao.conversation(cid) ?: return "{}"
        val msgs = dao.messages(cid)
        val obj = kotlinx.serialization.json.buildJsonObject {
            put("format", kotlinx.serialization.json.JsonPrimitive("aishub-conversation-v1"))
            put("title", kotlinx.serialization.json.JsonPrimitive(c.title))
            put("exportedAt", kotlinx.serialization.json.JsonPrimitive(System.currentTimeMillis()))
            putJsonArray("messages") {
                msgs.forEach { m ->
                    add(kotlinx.serialization.json.buildJsonObject {
                        put("role", kotlinx.serialization.json.JsonPrimitive(m.role))
                        put("text", kotlinx.serialization.json.JsonPrimitive(m.text))
                        put("createdAt", kotlinx.serialization.json.JsonPrimitive(m.createdAt))
                        put("model", kotlinx.serialization.json.JsonPrimitive(m.actualModelId ?: ""))
                        put("provider", kotlinx.serialization.json.JsonPrimitive(m.providerName ?: ""))
                    })
                }
            }
        }
        return kotlinx.serialization.json.Json { prettyPrint = true }.encodeToString(kotlinx.serialization.json.JsonObject.serializer(), obj)
    }

    private fun adapterFor(route: ModelRoute): ProviderAdapter =
        adapters[route.provider] ?: throw ProviderError.Unsupported("No adapter for ${route.provider}")

    /**
     * Sends the user message and streams the assistant reply, persisting partial output.
     * Emits progress via the messages Flow; the returned flow emits switch notices and completion.
     */
    fun send(cid: String, userText: String, capability: Capability = Capability.CHAT): Flow<String> = flow {
        val s = settings.settings.first()
        val now = System.currentTimeMillis()
        val userMsg = MessageEntity(UUID.randomUUID().toString(), cid, "user", userText, now)
        dao.insertMessage(userMsg)
        dao.conversation(cid)?.let {
            val title = if (it.title == "New chat") userText.take(40).ifBlank { it.title } else it.title
            dao.updateConversation(it.copy(updatedAt = now, title = title))
        }

        val assistantId = UUID.randomUUID().toString()
        val history = dao.messages(cid).filter { it.status == "complete" || it.id == userMsg.id }
            .map { ChatTurn(it.role, it.text) }
        val conv = dao.conversation(cid)
        val request = GenerationRequest(
            turns = history,
            temperature = s.temperature,
            maxOutputTokens = s.maxOutputTokens,
            systemInstruction = conv?.systemInstruction
        )

        val preferred = s.preferredChatRoute.takeIf { it != "auto" }
        val excluded = mutableSetOf<String>()
        var attempt = 0
        var lastError: Throwable? = null

        while (attempt < 3) {
            attempt++
            val decision = try {
                router.select(capability, preferred, excluded)
            } catch (e: ProviderError.NoEligibleRoute) {
                lastError = e
                break
            }
            val route = decision.route
            if (decision.switchedFrom != null) {
                if (!s.allowProviderSwitch) {
                    lastError = ProviderError.NoEligibleRoute("Preferred model unavailable and switching is disabled in Settings.")
                    break
                }
                emit("switched:${route.displayName}")
            }
            val key = keys.get(route.provider)
            if (key == null) {
                excluded += route.id
                lastError = ProviderError.MissingKey("No key for ${route.provider.displayName}")
                continue
            }
            dao.insertMessage(
                MessageEntity(assistantId, cid, "assistant", "", System.currentTimeMillis(),
                    routeId = route.id, status = "streaming")
            )
            val sb = StringBuilder()
            try {
                if (s.streamingEnabled && route.supportsStreaming) {
                    var done: com.aishub.domain.GenerationResult? = null
                    adapterFor(route).stream(route, request, key).collect { chunk ->
                        when (chunk) {
                            is StreamChunk.Delta -> {
                                sb.append(chunk.text)
                                if (sb.length % 256 < chunk.text.length) {
                                    dao.updateMessage(dao.message(assistantId)!!.copy(text = sb.toString()))
                                }
                            }
                            is StreamChunk.Done -> done = chunk.result
                        }
                    }
                    val result = done ?: throw ProviderError.Malformed("Stream ended without completion")
                    finishSuccess(assistantId, cid, route, result, "chat")
                    emit("done:${result.actualModelId}")
                    return@flow
                } else {
                    val result = adapterFor(route).generate(route, request, key)
                    finishSuccess(assistantId, cid, route, result, "chat")
                    emit("done:${result.actualModelId}")
                    return@flow
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                dao.message(assistantId)?.let {
                    dao.updateMessage(it.copy(text = sb.toString(), status = "cancelled"))
                }
                throw e
            } catch (e: Throwable) {
                lastError = e
                router.recordFailure(route.id, e)
                errors.record("provider", "Chat request failed on ${route.displayName}", e, module = "chat")
                usageDao.insert(UsageRecordEntity(UUID.randomUUID().toString(), route.id, route.provider.displayName, null, "chat", false, createdAt = System.currentTimeMillis()))
                dao.message(assistantId)?.let { dao.deleteMessage(it.id) }
                excluded += route.id
                if (e is ProviderError.Auth || e is ProviderError.MissingKey) continue
                if (e is ProviderError.Malformed && e.message?.contains("Bad request") == true) break
                continue
            }
        }
        val message = com.aishub.core.Redactor.redact(lastError?.message ?: "Unknown error")
        dao.insertMessage(
            MessageEntity(assistantId, cid, "assistant", "", System.currentTimeMillis(), status = "failed", errorMessage = message)
        )
        emit("error:$message")
    }

    private suspend fun finishSuccess(
        assistantId: String, cid: String, route: ModelRoute,
        result: com.aishub.domain.GenerationResult, module: String
    ) {
        dao.message(assistantId)?.let {
            dao.updateMessage(
                it.copy(
                    text = result.text, status = "complete",
                    actualModelId = result.actualModelId,
                    providerName = result.provider.displayName,
                    finishReason = result.finishReason,
                    inputTokens = result.usage?.inputTokens,
                    outputTokens = result.usage?.outputTokens
                )
            )
        }
        router.recordSuccess(route.id)
        usageDao.insert(
            UsageRecordEntity(
                UUID.randomUUID().toString(), route.id, result.provider.displayName,
                result.actualModelId, module, true,
                result.usage?.inputTokens, result.usage?.outputTokens, System.currentTimeMillis()
            )
        )
        dao.conversation(cid)?.let { dao.updateConversation(it.copy(updatedAt = System.currentTimeMillis())) }
    }

    /** Regenerate: delete the last assistant message and re-send from prior user turn. */
    suspend fun deleteAssistantForRetry(cid: String, assistantId: String) {
        dao.deleteMessage(assistantId)
    }

    suspend fun retryLast(cid: String): String? {
        val msgs = dao.messages(cid)
        val lastUser = msgs.lastOrNull { it.role == "user" } ?: return null
        msgs.lastOrNull { it.role == "assistant" }?.let { dao.deleteMessage(it.id) }
        dao.deleteMessage(lastUser.id)
        return lastUser.text
    }

    companion object {
        fun defaultAdapters(): Map<ProviderId, ProviderAdapter> = mapOf(
            ProviderId.GEMINI to GeminiAdapter(),
            ProviderId.GROQ to OpenAiCompatAdapter.groq(),
            ProviderId.OPENROUTER to OpenAiCompatAdapter.openRouter()
        )
    }
}
