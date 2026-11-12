package com.aishub.data.research

import com.aishub.core.UrlGuard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

@Serializable
data class ResearchSource(
    val title: String,
    val url: String,
    val snippet: String,
    val retrievedAt: Long,
    val kind: String // "wikipedia" | "web"
)

/**
 * Research engine using the official free Wikipedia/MediaWiki API for search
 * and direct HTTPS page fetches (SSRF-guarded) for reading. No scraped private
 * endpoints, no paid search API. Search breadth is intentionally bounded.
 */
class ResearchEngine(client: OkHttpClient? = null) {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun searchWikipedia(query: String, limit: Int = 5): List<ResearchSource> = withContext(Dispatchers.IO) {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=$encoded&srlimit=$limit&format=json&origin=*"
        val req = Request.Builder().url(url).header("User-Agent", "AisHub/0.1 (research module)").build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Wikipedia API ${resp.code}")
            val obj = json.parseToJsonElement(resp.body?.string() ?: "{}").jsonObject
            val results = obj["query"]?.jsonObject?.get("search")?.jsonArray ?: return@withContext emptyList()
            results.map { r ->
                val o = r.jsonObject
                val title = o["title"]!!.jsonPrimitive.content
                ResearchSource(
                    title = title,
                    url = "https://en.wikipedia.org/wiki/" + java.net.URLEncoder.encode(title.replace(' ', '_'), "UTF-8"),
                    snippet = o["snippet"]?.jsonPrimitive?.content
                        ?.replace(Regex("<[^>]+>"), "") ?: "",
                    retrievedAt = System.currentTimeMillis(),
                    kind = "wikipedia"
                )
            }
        }
    }

    /** Fetch a page's readable text (bounded). HTTPS + SSRF guard enforced. */
    suspend fun fetchPageText(url: String, maxChars: Int = 12000): String = withContext(Dispatchers.IO) {
        UrlGuard.validate(url).getOrThrow()
        val req = Request.Builder().url(url).header("User-Agent", "AisHub/0.1 (research module)").build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Fetch failed ${resp.code}")
            val type = resp.body?.contentType()?.toString() ?: ""
            require(type.contains("text") || type.contains("json") || type.isEmpty()) { "Unsupported content type: $type" }
            val raw = resp.body?.string()?.take(400_000) ?: ""
            extractText(raw).take(maxChars)
        }
    }

    suspend fun wikipediaArticleText(title: String, maxChars: Int = 12000): String = withContext(Dispatchers.IO) {
        val encoded = java.net.URLEncoder.encode(title, "UTF-8")
        val url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=$encoded&format=json&origin=*"
        val req = Request.Builder().url(url).header("User-Agent", "AisHub/0.1 (research module)").build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("Wikipedia API ${resp.code}")
            val obj = json.parseToJsonElement(resp.body?.string() ?: "{}").jsonObject
            val pages = obj["query"]?.jsonObject?.get("pages")?.jsonObject ?: return@withContext ""
            pages.values.firstOrNull()?.jsonObject?.get("extract")?.jsonPrimitive?.content?.take(maxChars) ?: ""
        }
    }

    private fun extractText(html: String): String {
        var s = html
        s = s.replace(Regex("(?is)<script[^>]*>.*?</script>"), " ")
        s = s.replace(Regex("(?is)<style[^>]*>.*?</style>"), " ")
        s = s.replace(Regex("(?is)<(nav|footer|header|aside)[^>]*>.*?</\\1>"), " ")
        s = s.replace(Regex("<[^>]+>"), " ")
        s = android.text.Html.fromHtml(s, android.text.Html.FROM_HTML_MODE_LEGACY).toString()
        return s.replace(Regex("[ \t]+"), " ").replace(Regex("\n{3,}"), "\n\n").trim()
    }
}
