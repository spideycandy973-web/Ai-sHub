package com.aishub.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "conversations", indices = [Index("updatedAt")])
data class ConversationEntity(
    @PrimaryKey val id: String,
    val title: String,
    val createdAt: Long,
    val updatedAt: Long,
    val pinned: Boolean = false,
    val archived: Boolean = false,
    val systemInstruction: String? = null
)

@Entity(
    tableName = "messages",
    foreignKeys = [ForeignKey(
        entity = ConversationEntity::class,
        parentColumns = ["id"], childColumns = ["conversationId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("conversationId"), Index("createdAt")]
)
data class MessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val role: String,
    val text: String,
    val createdAt: Long,
    val routeId: String? = null,
    val actualModelId: String? = null,
    val providerName: String? = null,
    val status: String = "complete", // complete | streaming | failed | cancelled
    val finishReason: String? = null,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val errorMessage: String? = null
)

@Entity(tableName = "battles", indices = [Index("createdAt")])
data class BattleEntity(
    @PrimaryKey val id: String,
    val prompt: String,
    val category: String,
    val createdAt: Long,
    val routeA: String,
    val routeB: String,
    val modelAActual: String? = null,
    val modelBActual: String? = null,
    val responseA: String? = null,
    val responseB: String? = null,
    val errorA: String? = null,
    val errorB: String? = null,
    val vote: String? = null, // "A" | "B" | "tie" | "unsatisfactory"
    val revealed: Boolean = false
)

@Entity(tableName = "projects", indices = [Index("updatedAt")])
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val instructions: String = "",
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "notes",
    foreignKeys = [ForeignKey(
        entity = ProjectEntity::class,
        parentColumns = ["id"], childColumns = ["projectId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("projectId")]
)
data class NoteEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val title: String,
    val body: String,
    val updatedAt: Long
)

@Entity(tableName = "agent_tasks", indices = [Index("projectId"), Index("createdAt")])
data class AgentTaskEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val goal: String,
    val mode: String,
    val state: String, // planned | awaiting_approval | running | paused | completed | failed | cancelled
    val planJson: String = "[]",
    val logJson: String = "[]",
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "error_records", indices = [Index("createdAt")])
data class ErrorRecordEntity(
    @PrimaryKey val id: String,
    val category: String,
    val title: String,
    val details: String,
    val appVersion: String,
    val module: String? = null,
    val createdAt: Long
)

@Entity(tableName = "usage_records", indices = [Index("createdAt"), Index("routeId")])
data class UsageRecordEntity(
    @PrimaryKey val id: String,
    val routeId: String,
    val providerName: String,
    val actualModelId: String?,
    val module: String,
    val success: Boolean,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val createdAt: Long
)

@Entity(tableName = "research_reports", indices = [Index("createdAt")])
data class ResearchReportEntity(
    @PrimaryKey val id: String,
    val question: String,
    val reportMarkdown: String,
    val sourcesJson: String,
    val createdAt: Long
)

@Dao
interface ChatDao {
    @Query("SELECT * FROM conversations WHERE archived = 0 ORDER BY pinned DESC, updatedAt DESC")
    fun observeConversations(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE archived = 1 ORDER BY updatedAt DESC")
    fun observeArchived(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE title LIKE '%' || :q || '%' ORDER BY updatedAt DESC")
    fun search(q: String): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun conversation(id: String): ConversationEntity?

    @Insert suspend fun insertConversation(c: ConversationEntity)
    @Update suspend fun updateConversation(c: ConversationEntity)
    @Query("DELETE FROM conversations WHERE id = :id") suspend fun deleteConversation(id: String)

    @Query("SELECT * FROM messages WHERE conversationId = :cid ORDER BY createdAt ASC")
    fun observeMessages(cid: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE conversationId = :cid ORDER BY createdAt ASC")
    suspend fun messages(cid: String): List<MessageEntity>

    @Insert suspend fun insertMessage(m: MessageEntity)
    @Update suspend fun updateMessage(m: MessageEntity)
    @Query("DELETE FROM messages WHERE id = :id") suspend fun deleteMessage(id: String)
    @Query("DELETE FROM messages WHERE conversationId = :cid AND createdAt >= :from") suspend fun deleteFrom(cid: String, from: Long)
    @Query("SELECT * FROM messages WHERE id = :id") suspend fun message(id: String): MessageEntity?
}

@Dao
interface BattleDao {
    @Insert suspend fun insert(b: BattleEntity)
    @Update suspend fun update(b: BattleEntity)
    @Query("SELECT * FROM battles ORDER BY createdAt DESC") fun observeAll(): Flow<List<BattleEntity>>
    @Query("SELECT * FROM battles WHERE id = :id") suspend fun byId(id: String): BattleEntity?
    @Query("DELETE FROM battles WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface WorkspaceDao {
    @Insert suspend fun insertProject(p: ProjectEntity)
    @Update suspend fun updateProject(p: ProjectEntity)
    @Query("SELECT * FROM projects ORDER BY updatedAt DESC") fun observeProjects(): Flow<List<ProjectEntity>>
    @Query("SELECT * FROM projects WHERE name LIKE '%' || :q || '%' ORDER BY updatedAt DESC") fun searchProjects(q: String): Flow<List<ProjectEntity>>
    @Query("SELECT * FROM projects WHERE id = :id") suspend fun project(id: String): ProjectEntity?
    @Query("DELETE FROM projects WHERE id = :id") suspend fun deleteProject(id: String)

    @Insert suspend fun insertNote(n: NoteEntity)
    @Update suspend fun updateNote(n: NoteEntity)
    @Query("SELECT * FROM notes WHERE projectId = :pid ORDER BY updatedAt DESC") fun observeNotes(pid: String): Flow<List<NoteEntity>>
    @Query("DELETE FROM notes WHERE id = :id") suspend fun deleteNote(id: String)
}

@Dao
interface AgentDao {
    @Insert suspend fun insert(t: AgentTaskEntity)
    @Update suspend fun update(t: AgentTaskEntity)
    @Query("SELECT * FROM agent_tasks WHERE projectId = :pid ORDER BY createdAt DESC") fun observe(pid: String): Flow<List<AgentTaskEntity>>
    @Query("SELECT * FROM agent_tasks WHERE id = :id") suspend fun byId(id: String): AgentTaskEntity?
    @Query("SELECT * FROM agent_tasks WHERE state IN ('running','awaiting_approval','paused')") suspend fun unfinished(): List<AgentTaskEntity>
    @Query("DELETE FROM agent_tasks WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface ErrorDao {
    @Insert suspend fun insert(e: ErrorRecordEntity)
    @Query("SELECT * FROM error_records ORDER BY createdAt DESC LIMIT 200") fun observe(): Flow<List<ErrorRecordEntity>>
    @Query("SELECT * FROM error_records ORDER BY createdAt DESC LIMIT 200") suspend fun all(): List<ErrorRecordEntity>
    @Query("DELETE FROM error_records") suspend fun clear()
    @Query("DELETE FROM error_records WHERE id = :id") suspend fun delete(id: String)
    @Query("DELETE FROM error_records WHERE createdAt < :before") suspend fun trim(before: Long)
}

@Dao
interface UsageDao {
    @Insert suspend fun insert(u: UsageRecordEntity)
    @Query("SELECT * FROM usage_records ORDER BY createdAt DESC LIMIT 500") fun observe(): Flow<List<UsageRecordEntity>>
    @Query("SELECT COUNT(*) FROM usage_records WHERE routeId = :routeId AND createdAt >= :since") suspend fun countSince(routeId: String, since: Long): Long
    @Query("DELETE FROM usage_records WHERE createdAt < :before") suspend fun trim(before: Long)
    @Query("DELETE FROM usage_records") suspend fun clear()
}

@Dao
interface ResearchDao {
    @Insert suspend fun insert(r: ResearchReportEntity)
    @Query("SELECT * FROM research_reports ORDER BY createdAt DESC") fun observe(): Flow<List<ResearchReportEntity>>
    @Query("DELETE FROM research_reports WHERE id = :id") suspend fun delete(id: String)
}

@Database(
    entities = [
        ConversationEntity::class, MessageEntity::class, BattleEntity::class,
        ProjectEntity::class, NoteEntity::class, AgentTaskEntity::class,
        ErrorRecordEntity::class, UsageRecordEntity::class, ResearchReportEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class AiHubDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao
    abstract fun battleDao(): BattleDao
    abstract fun workspaceDao(): WorkspaceDao
    abstract fun agentDao(): AgentDao
    abstract fun errorDao(): ErrorDao
    abstract fun usageDao(): UsageDao
    abstract fun researchDao(): ResearchDao
}
