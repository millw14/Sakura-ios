package com.millw14.sakura.anime

import android.content.Context
import android.util.Base64
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * MegaCloud / RabbitStream Extractor — Kotlin port of megacloud.ts.
 *
 * Flow:
 * 1. Fetch encrypted sources JSON from getSources API
 * 2. Fetch the obfuscated e1-player.min.js script
 * 3. Extract variable index pairs from the script via regex
 * 4. Use indices to slice the "secret" from the encrypted string
 * 5. Derive AES-256-CBC key + IV using MD5 (OpenSSL EVP_BytesToKey)
 * 6. Decrypt ciphertext to get JSON array of .m3u8 URLs
 */
class MegaCloudExtractor(
    private val context: Context,
    private val client: OkHttpClient
) {

    companion object {
        private const val TAG = "MegaCloudExtractor"
        private const val FALLBACK_KEY_URL =
            "https://raw.githubusercontent.com/itzzzme/megacloud-keys/main/key.txt"
        private const val USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    }

    private var baseUrl = "https://megacloud.blog"

    private val cfBypass = CloudflareBypass(context)

    data class VideoSource(val file: String, val type: String)
    data class Track(val file: String, val label: String?, val kind: String?)
    data class TimeRange(val start: Int, val end: Int)

    data class MegaCloudResult(
        val sources: List<VideoSource>,
        val tracks: List<Track>,
        val intro: TimeRange?,
        val outro: TimeRange?
    )

    /**
     * Extracts the embed path prefix from the URL.
     * e.g. "/embed-2/v3/e-1/videoId" -> "/embed-2/v3"
     * e.g. "/embed-2/e-1/videoId"    -> "/embed-2"
     */
    private fun extractEmbedPrefix(embedUrl: String): String {
        val path = java.net.URL(embedUrl).path // e.g. /embed-2/v3/e-1/vSW2gETgoOgO
        val parts = path.split("/").filter { it.isNotEmpty() }
        // Find "e-1" segment and take everything before it
        val eIdx = parts.indexOfFirst { it.startsWith("e-") }
        return if (eIdx > 0) {
            "/" + parts.subList(0, eIdx).joinToString("/")
        } else {
            "/embed-2"
        }
    }

    /**
     * Main entry point: given a MegaCloud embed URL, returns decrypted .m3u8 sources.
     */
    fun extract(embedUrl: String): MegaCloudResult? {
        return try {
            val parsedUrl = java.net.URL(embedUrl)
            baseUrl = "${parsedUrl.protocol}://${parsedUrl.host}"
            val videoId = extractVideoId(embedUrl)
            val embedPrefix = extractEmbedPrefix(embedUrl)
            Log.d(TAG, "Base URL: $baseUrl, Prefix: $embedPrefix, Video ID: $videoId")

            ensureMegaCloudCookies()

            // Try versioned API path first (e.g. /embed-2/v3/ajax/e-1/getSources)
            // then fall back to classic path (/embed-2/ajax/e-1/getSources)
            val apiPaths = listOf(
                "$baseUrl$embedPrefix/ajax/e-1/getSources?id=$videoId",
                "$baseUrl/embed-2/ajax/e-1/getSources?id=$videoId"
            ).distinct()

            var srcsJson: JSONObject? = null
            var lastError: Exception? = null

            for (apiUrl in apiPaths) {
                try {
                    Log.d(TAG, "Trying sources URL: $apiUrl")
                    val body = fetchString(apiUrl)
                    Log.d(TAG, "Response body (first 200): ${body.take(200)}")
                    srcsJson = JSONObject(body)
                    if (srcsJson.has("sources")) {
                        Log.d(TAG, "Got valid sources response from: $apiUrl")
                        break
                    }
                    Log.w(TAG, "Response has no 'sources' key, trying next...")
                    srcsJson = null
                } catch (e: Exception) {
                    Log.w(TAG, "API path failed: $apiUrl -> ${e.message}")
                    lastError = e
                }
            }

            if (srcsJson == null) {
                throw lastError ?: Exception("All API paths failed for video $videoId")
            }

            val encrypted = srcsJson.optBoolean("encrypted", false)
            val sourcesRaw = srcsJson.opt("sources")
            Log.d(TAG, "Encrypted: $encrypted, Sources type: ${sourcesRaw?.javaClass?.simpleName}")

            if (!encrypted || sourcesRaw is JSONArray) {
                Log.d(TAG, "Sources not encrypted, returning directly")
                return MegaCloudResult(
                    sources = parseSourcesArray(if (sourcesRaw is JSONArray) sourcesRaw else JSONArray()),
                    tracks = parseTracksArray(srcsJson.optJSONArray("tracks")),
                    intro = parseTimeRange(srcsJson.optJSONObject("intro")),
                    outro = parseTimeRange(srcsJson.optJSONObject("outro"))
                )
            }

            val encryptedSources = sourcesRaw as? String
                ?: throw Exception("Expected encrypted sources string, got: ${sourcesRaw?.javaClass?.simpleName}")
            Log.d(TAG, "Encrypted payload length: ${encryptedSources.length}")

            var decryptedJson: String? = null

            // Try script-based decryption first
            try {
                decryptedJson = decryptViaScript(encryptedSources)
                Log.d(TAG, "Script decryption succeeded, result length: ${decryptedJson.length}")
            } catch (e: Exception) {
                Log.w(TAG, "Script-based decryption failed: ${e.message}", e)
            }

            // Fallback to hosted key
            if (decryptedJson == null) {
                try {
                    decryptedJson = decryptViaFallbackKey(encryptedSources)
                    Log.d(TAG, "Fallback key decryption succeeded, result length: ${decryptedJson.length}")
                } catch (e: Exception) {
                    Log.e(TAG, "Fallback key decryption also failed: ${e.message}", e)
                }
            }

            if (decryptedJson == null) {
                Log.e(TAG, "All decryption methods failed")
                return null
            }

            val sourcesArray = JSONArray(decryptedJson)
            MegaCloudResult(
                sources = parseSourcesArray(sourcesArray),
                tracks = parseTracksArray(srcsJson.optJSONArray("tracks")),
                intro = parseTimeRange(srcsJson.optJSONObject("intro")),
                outro = parseTimeRange(srcsJson.optJSONObject("outro"))
            )
        } catch (e: Exception) {
            Log.e(TAG, "Extraction failed: ${e.message}", e)
            null
        }
    }

    @Volatile
    private var megaCloudCookies: Map<String, String> = emptyMap()

    @Volatile
    private var lastCfDomain: String = ""

    private fun ensureMegaCloudCookies() {
        if (megaCloudCookies.isEmpty() || lastCfDomain != baseUrl) {
            Log.d(TAG, "Resolving Cloudflare for $baseUrl ...")
            megaCloudCookies = cfBypass.resolve("$baseUrl/")
            lastCfDomain = baseUrl
            Log.d(TAG, "MegaCloud CF cookies: ${megaCloudCookies.keys}")
        }
    }

    // ── HTTP helpers ───────────────────────────────────────────────────

    private fun fetchString(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .header("Referer", "https://hianime.to/")
            .header("X-Requested-With", "XMLHttpRequest")
            .header("Accept", "*/*")
            .apply {
                val cookieStr = megaCloudCookies.entries.joinToString("; ") { "${it.key}=${it.value}" }
                if (cookieStr.isNotEmpty()) header("Cookie", cookieStr)
            }
            .build()

        var response = client.newCall(request).execute()
        if (response.code == 403 || response.code == 503) {
            response.close()
            Log.d(TAG, "Got ${response.code}, refreshing CF cookies for $baseUrl")
            CloudflareBypass.clearCache()
            megaCloudCookies = cfBypass.resolve("$baseUrl/")
            val retryRequest = Request.Builder()
                .url(url)
                .header("User-Agent", USER_AGENT)
                .header("Referer", "https://hianime.to/")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Accept", "*/*")
                .header("Cookie", megaCloudCookies.entries.joinToString("; ") { "${it.key}=${it.value}" })
                .build()
            response = client.newCall(retryRequest).execute()
        }

        if (!response.isSuccessful) {
            val code = response.code
            response.close()
            throw Exception("HTTP $code for $url")
        }
        return response.body?.string() ?: throw Exception("Empty body from $url")
    }

    private fun fetchJson(url: String): JSONObject {
        return JSONObject(fetchString(url))
    }

    // ── Script-Based Decryption ────────────────────────────────────────

    private fun decryptViaScript(encryptedSources: String): String {
        val scriptUrl = "$baseUrl/js/player/a/prod/e1-player.min.js?v=${System.currentTimeMillis()}"
        val script = fetchString(scriptUrl)
        Log.d(TAG, "Player script length: ${script.length}")

        val vars = extractVariables(script)
        if (vars.isEmpty()) throw Exception("Failed to extract variables from player script")
        Log.d(TAG, "Extracted ${vars.size} variable pairs")

        val (secret, encryptedSource) = getSecret(encryptedSources, vars)
        Log.d(TAG, "Secret length: ${secret.length}, Remaining cipher length: ${encryptedSource.length}")

        val decrypted = decrypt(encryptedSource, secret)
        if (decrypted.isEmpty()) throw Exception("Decryption produced empty result")
        return decrypted
    }

    /**
     * Extract [start, length] index pairs from the obfuscated e1-player.min.js.
     * Regex: case 0x...:(?![^;]*=partKey) var1 = val1, var2 = val2;
     */
    private fun extractVariables(script: String): List<IntArray> {
        val regex = Regex("""case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);""")
        val vars = mutableListOf<IntArray>()

        for (match in regex.findAll(script)) {
            try {
                val key1 = matchingKey(match.groupValues[1], script)
                val key2 = matchingKey(match.groupValues[2], script)
                vars.add(intArrayOf(key1.toInt(16), key2.toInt(16)))
            } catch (_: Exception) {
                // Skip failed matches
            }
        }
        return vars
    }

    /**
     * Resolve a variable name to its hex value in the script.
     */
    private fun matchingKey(value: String, script: String): String {
        if (Regex("^0x[0-9a-fA-F]+$").matches(value)) {
            return value.removePrefix("0x")
        }
        val regex = Regex(""",${Regex.escape(value)}=((?:0x)?([0-9a-fA-F]+))""")
        val match = regex.find(script)
            ?: throw Exception("Failed to match key for: $value")
        return match.groupValues[1].removePrefix("0x")
    }

    /**
     * Slice the "secret" out of the encrypted string using index pairs.
     * Returns (secret, remainingCiphertext).
     */
    private fun getSecret(encryptedString: String, values: List<IntArray>): Pair<String, String> {
        val secret = StringBuilder()
        val arr = CharArray(encryptedString.length) { encryptedString[it] }
        var currentIndex = 0

        for (pair in values) {
            val start = pair[0]
            val length = pair[1]
            val actualStart = start + currentIndex
            val actualEnd = actualStart + length
            for (i in actualStart until actualEnd) {
                if (i < encryptedString.length) {
                    secret.append(encryptedString[i])
                    arr[i] = '\u0000'
                }
            }
            currentIndex += length
        }

        val encryptedSource = String(arr).replace("\u0000", "")
        return Pair(secret.toString(), encryptedSource)
    }

    /**
     * Decrypt ciphertext using AES-256-CBC with OpenSSL EVP_BytesToKey KDF.
     *
     * Base64-decoded structure:
     *   bytes 0-7:  "Salted__" magic
     *   bytes 8-15: 8-byte salt
     *   bytes 16+:  AES ciphertext
     */
    private fun decrypt(encrypted: String, secret: String): String {
        val raw = Base64.decode(encrypted, Base64.DEFAULT)

        // Extract salt (bytes 8-15) and ciphertext (bytes 16+)
        val salt = raw.sliceArray(8..15)
        val ciphertext = raw.sliceArray(16 until raw.size)

        val password = secret.toByteArray(Charsets.UTF_8)
        val (key, iv) = evpBytesToKey(password, salt)

        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        val decrypted = cipher.doFinal(ciphertext)
        return String(decrypted, Charsets.UTF_8)
    }

    /**
     * OpenSSL EVP_BytesToKey: derives 32-byte key + 16-byte IV using MD5.
     */
    private fun evpBytesToKey(password: ByteArray, salt: ByteArray): Pair<ByteArray, ByteArray> {
        val keySize = 32
        val ivSize = 16
        val totalSize = keySize + ivSize

        val derived = mutableListOf<Byte>()
        var block: ByteArray? = null

        while (derived.size < totalSize) {
            val md = MessageDigest.getInstance("MD5")
            if (block != null) md.update(block)
            md.update(password)
            md.update(salt)
            block = md.digest()
            derived.addAll(block.toList())
        }

        val all = derived.toByteArray()
        val key = all.sliceArray(0 until keySize)
        val iv = all.sliceArray(keySize until keySize + ivSize)
        return Pair(key, iv)
    }

    // ── Fallback Key Decryption ────────────────────────────────────────

    /**
     * Uses a hosted passphrase key to decrypt. The passphrase goes through the
     * same OpenSSL "Salted__" format decryption.
     */
    private fun decryptViaFallbackKey(encryptedSources: String): String {
        val keyText = fetchString(FALLBACK_KEY_URL).trim()
        Log.d(TAG, "Using fallback key: ${keyText.take(8)}...")

        val decrypted = decrypt(encryptedSources, keyText)
        if (decrypted.isEmpty()) throw Exception("Fallback key produced empty result")
        return decrypted
    }

    // ── JSON Parsing Helpers ───────────────────────────────────────────

    private fun extractVideoId(embedUrl: String): String {
        val path = java.net.URL(embedUrl).path
        val lastSegment = path.split("/").last()
        return lastSegment.split("?").first()
    }

    private fun parseSourcesArray(arr: JSONArray?): List<VideoSource> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val obj = arr.optJSONObject(i) ?: return@mapNotNull null
            VideoSource(
                file = obj.optString("file", ""),
                type = obj.optString("type", "hls")
            )
        }.filter { it.file.isNotEmpty() }
    }

    private fun parseTracksArray(arr: JSONArray?): List<Track> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val obj = arr.optJSONObject(i) ?: return@mapNotNull null
            Track(
                file = obj.optString("file", ""),
                label = obj.optString("label", null),
                kind = obj.optString("kind", null)
            )
        }
    }

    private fun parseTimeRange(obj: JSONObject?): TimeRange? {
        if (obj == null) return null
        return TimeRange(obj.optInt("start", 0), obj.optInt("end", 0))
    }
}
