package com.aishub.data.github

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class DeviceFlowPrompt(val userCode: String, val verificationUri: String, val expiresIn: Int, val deviceCode: String, val interval: Int)

/**
 * Official GitHub OAuth device flow for the app's own Developer Hub.
 * The client ID is a public identifier (not a secret) configured by the app owner.
 * No client secret is embedded; device flow does not require one.
 */
class GitHubDeviceFlow(client: OkHttpClient? = null) {
    private val http = client ?: OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun start(clientId: String): DeviceFlowPrompt = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("https://github.com/login/device/code")
            .header("Accept", "application/json")
            .post("client_id=$clientId&scope=repo".toRequestBody("application/x-www-form-urlencoded".toMediaType()))
            .build()
        http.newCall(req).execute().use { resp ->
            val body = resp.body?.string() ?: error("Empty response")
            val obj = json.parseToJsonElement(body).jsonObject
            obj["error"]?.let { error("Device flow error: ${it.jsonPrimitive.content}") }
            DeviceFlowPrompt(
                userCode = obj["user_code"]!!.jsonPrimitive.content,
                verificationUri = obj["verification_uri"]!!.jsonPrimitive.content,
                expiresIn = obj["expires_in"]!!.jsonPrimitive.content.toInt(),
                deviceCode = obj["device_code"]!!.jsonPrimitive.content,
                interval = obj["interval"]?.jsonPrimitive?.content?.toIntOrNull() ?: 5
            )
        }
    }

    /** Polls until authorized, denied, or expired. Returns the token (caller stores it in the vault). */
    suspend fun poll(clientId: String, deviceCode: String, intervalSeconds: Int): String = withContext(Dispatchers.IO) {
        var interval = intervalSeconds
        repeat(150) {
            delay(interval * 1000L)
            val req = Request.Builder().url("https://github.com/login/oauth/access_token")
                .header("Accept", "application/json")
                .post(
                    ("client_id=$clientId&device_code=$deviceCode&grant_type=urn:ietf:params:oauth:grant-type:device_code")
                        .toRequestBody("application/x-www-form-urlencoded".toMediaType())
                )
                .build()
            val obj = http.newCall(req).execute().use { resp ->
                json.parseToJsonElement(resp.body?.string() ?: "{}").jsonObject
            }
            obj["access_token"]?.jsonPrimitive?.content?.let { return@withContext it }
            when (obj["error"]?.jsonPrimitive?.content) {
                "authorization_pending" -> {}
                "slow_down" -> interval += 5
                "expired_token" -> error("Code expired. Start again.")
                "access_denied" -> error("Authorization was denied.")
                null -> {}
                else -> error("Device flow failed: ${obj["error"]?.jsonPrimitive?.content}")
            }
        }
        error("Device flow timed out")
    }
}
