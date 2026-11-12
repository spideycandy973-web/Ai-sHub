package com.aishub.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetAddress
import java.net.URI

/**
 * Client-side URL safety checks for research fetches: HTTPS only, no localhost,
 * no private/link-local/loopback addresses, no cloud metadata endpoints.
 * (The app fetches directly from the device; there is no server-side fetcher.)
 */
object UrlGuard {
    private val blockedHosts = setOf(
        "localhost", "metadata.google.internal", "169.254.169.254", "100.100.100.200"
    )

    suspend fun validate(url: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val uri = URI(url)
            require(uri.scheme == "https") { "Only HTTPS URLs are allowed" }
            val host = uri.host ?: error("Missing host")
            require(host.lowercase() !in blockedHosts) { "Blocked host" }
            val addresses = InetAddress.getAllByName(host)
            for (addr in addresses) {
                require(
                    !addr.isLoopbackAddress && !addr.isLinkLocalAddress &&
                        !addr.isSiteLocalAddress && !addr.isAnyLocalAddress
                ) { "Blocked private address" }
            }
            url
        }
    }
}
