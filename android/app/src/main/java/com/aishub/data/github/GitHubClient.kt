package com.aishub.data.github

import com.aishub.core.Redactor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

@Serializable
data class GhRepo(val full_name: String, val description: String? = null, val private: Boolean = false,
                  val default_branch: String = "main", val stargazers_count: Int = 0, val html_url: String = "")

@Serializable
data class GhRelease(val tag_name: String, val name: String? = null, val html_url: String = "",
                     val assets: List<GhAsset> = emptyList())

@Serializable
data class GhAsset(val name: String, val size: Long = 0, val browser_download_url: String = "",
                   val state: String = "", val digest: String? = null)

@Serializable
data class GhWorkflowRun(val id: Long, val name: String? = null, val status: String = "",
                         val conclusion: String? = null, val html_url: String = "")

/**
 * GitHub REST client using a user-authorized token (device flow) held in the encrypted vault.
 * Read operations plus explicitly authorized commits. No password ever touches this app.
 */
class GitHubClient(client: OkHttpClient? = null) {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true }
    private val base = "https://api.github.com"

    private fun get(url: String, token: String?): String {
        val b = Request.Builder().url(url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
        if (token != null) b.header("Authorization", "Bearer $token")
        http.newCall(b.build()).execute().use { resp ->
            val body = resp.body?.string() ?: ""
            if (!resp.isSuccessful) error("GitHub ${resp.code}: ${Redactor.redact(body.take(200))}")
            return body
        }
    }

    suspend fun listRepos(token: String): List<GhRepo> = withContext(Dispatchers.IO) {
        json.decodeFromString<List<GhRepo>>(get("$base/user/repos?per_page=50&sort=updated", token))
    }

    suspend fun getRepo(owner: String, name: String, token: String?): GhRepo = withContext(Dispatchers.IO) {
        json.decodeFromString<GhRepo>(get("$base/repos/$owner/$name", token))
    }

    suspend fun listReleases(owner: String, name: String, token: String?): List<GhRelease> = withContext(Dispatchers.IO) {
        json.decodeFromString<List<GhRelease>>(get("$base/repos/$owner/$name/releases?per_page=10", token))
    }

    suspend fun listWorkflowRuns(owner: String, name: String, token: String?): List<GhWorkflowRun> = withContext(Dispatchers.IO) {
        val obj = json.parseToJsonElement(get("$base/repos/$owner/$name/actions/runs?per_page=10", token)).jsonObject
        val runs = obj["workflow_runs"]?.jsonArray ?: return@withContext emptyList()
        runs.map { json.decodeFromString<GhWorkflowRun>(it.toString()) }
    }

    suspend fun listBranches(owner: String, name: String, token: String?): List<String> = withContext(Dispatchers.IO) {
        json.parseToJsonElement(get("$base/repos/$owner/$name/branches?per_page=50", token)).jsonArray
            .map { it.jsonObject["name"]!!.jsonPrimitive.content }
    }

    suspend fun readFile(owner: String, name: String, path: String, ref: String?, token: String?): String = withContext(Dispatchers.IO) {
        val url = "$base/repos/$owner/$name/contents/$path" + (ref?.let { "?ref=$it" } ?: "")
        val obj = json.parseToJsonElement(get(url, token)).jsonObject
        val encoding = obj["encoding"]?.jsonPrimitive?.content
        val content = obj["content"]?.jsonPrimitive?.content ?: error("No content")
        if (encoding == "base64") String(android.util.Base64.decode(content, android.util.Base64.DEFAULT))
        else content
    }

    /** Create or update a file — an explicitly user-authorized commit. */
    suspend fun commitFile(
        owner: String, name: String, path: String, content: String,
        message: String, branch: String, token: String
    ): String = withContext(Dispatchers.IO) {
        val existingSha = runCatching {
            json.parseToJsonElement(get("$base/repos/$owner/$name/contents/$path?ref=$branch", token))
                .jsonObject["sha"]?.jsonPrimitive?.content
        }.getOrNull()
        val payload = kotlinx.serialization.json.buildJsonObject {
            put("message", kotlinx.serialization.json.JsonPrimitive(message))
            put("content", kotlinx.serialization.json.JsonPrimitive(
                android.util.Base64.encodeToString(content.toByteArray(), android.util.Base64.NO_WRAP)))
            put("branch", kotlinx.serialization.json.JsonPrimitive(branch))
            existingSha?.let { put("sha", kotlinx.serialization.json.JsonPrimitive(it)) }
        }
        val req = Request.Builder()
            .url("$base/repos/$owner/$name/contents/$path")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .put(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(req).execute().use { resp ->
            val body = resp.body?.string() ?: ""
            if (!resp.isSuccessful) error("GitHub commit failed ${resp.code}: ${Redactor.redact(body.take(200))}")
            json.parseToJsonElement(body).jsonObject["commit"]?.jsonObject?.get("html_url")?.jsonPrimitive?.content ?: "committed"
        }
    }
}
