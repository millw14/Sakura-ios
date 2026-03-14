package com.millw14.sakura.anime

import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.util.concurrent.TimeUnit

/**
 * Capacitor plugin that exposes anime playback to the React frontend.
 * Handles the full native pipeline:
 *   episodeId → CF bypass → HiAnime scrape → MegaCloud decrypt → ExoPlayer
 */
@CapacitorPlugin(name = "Anime")
class AnimePlugin : Plugin() {

    companion object {
        private const val TAG = "AnimePlugin"
    }

    private var scraper: AnimeScraper? = null
    private var webViewExtractor: WebViewExtractor? = null

    private fun ensureInitialized() {
        if (scraper == null) {
            scraper = AnimeScraper(context)
        }
        if (webViewExtractor == null) {
            webViewExtractor = WebViewExtractor(context)
        }
    }

    /**
     * Called from JS: Anime.playEpisode({ episodeId: "...", title: "..." })
     *
     * Pipeline: episodeId → HiAnime scrape → embed URL → WebView extraction → m3u8 → ExoPlayer
     */
    @PluginMethod
    fun playEpisode(call: PluginCall) {
        val episodeId = call.getString("episodeId")
        if (episodeId.isNullOrEmpty()) {
            call.reject("Missing episodeId parameter")
            return
        }

        val title = call.getString("title") ?: "Episode"
        val hasNext = call.getBoolean("hasNext", false) ?: false
        val nextEpisodeTitle = call.getString("nextEpisodeTitle") ?: ""

        Thread {
            try {
                ensureInitialized()
                val scr = scraper!!
                val wve = webViewExtractor!!

                Log.d(TAG, "Starting native playback for episode: $episodeId")

                scr.ensureCfCookies()

                val embedUrls = scr.resolveAllEmbedUrls(episodeId)
                if (embedUrls.isEmpty()) {
                    throw Exception("No servers found for episode $episodeId")
                }
                Log.d(TAG, "Found ${embedUrls.size} servers")

                var lastDebugLog = ""
                var stream: WebViewExtractor.ExtractedStream? = null
                var workingEmbedUrl = ""

                for ((embedUrl, serverName) in embedUrls) {
                    Log.d(TAG, "Trying server $serverName: $embedUrl")
                    val extraction = wve.extract(embedUrl)
                    lastDebugLog += "=== $serverName ===\n${extraction.debugLog}\n\n"

                    if (extraction.stream != null) {
                        stream = extraction.stream
                        workingEmbedUrl = embedUrl
                        Log.d(TAG, "Server $serverName worked!")
                        break
                    }

                    if (extraction.isFileNotFound) {
                        Log.d(TAG, "Server $serverName: file not found, trying next...")
                        continue
                    }

                    Log.d(TAG, "Server $serverName: extraction failed, trying next...")
                }

                if (stream == null) {
                    throw Exception("All ${embedUrls.size} servers failed.\n\n$lastDebugLog")
                }

                Log.d(TAG, "Stream URL: ${stream.m3u8Url}")

                var allSubs = stream.subtitles.toMutableList()
                if (allSubs.isEmpty() && workingEmbedUrl.isNotEmpty()) {
                    val apiSubs = fetchSubtitlesFromApi(workingEmbedUrl)
                    allSubs.addAll(apiSubs)
                }

                val subsJson = org.json.JSONArray()
                allSubs.forEach { sub ->
                    subsJson.put(org.json.JSONObject().apply {
                        put("url", sub.url)
                        put("label", sub.label)
                    })
                }
                Log.d(TAG, "Passing ${allSubs.size} subtitle tracks to player")

                activity.runOnUiThread {
                    val intent = Intent(context, PlayerActivity::class.java).apply {
                        putExtra(PlayerActivity.EXTRA_STREAM_URL, stream.m3u8Url)
                        putExtra(PlayerActivity.EXTRA_REFERER, stream.referer)
                        putExtra(PlayerActivity.EXTRA_TITLE, title)
                        putExtra(PlayerActivity.EXTRA_SUBTITLES, subsJson.toString())
                        putExtra(PlayerActivity.EXTRA_EPISODE_ID, episodeId)
                        putExtra(PlayerActivity.EXTRA_HAS_NEXT, hasNext)
                        putExtra(PlayerActivity.EXTRA_NEXT_TITLE, nextEpisodeTitle)
                    }
                    startActivityForResult(call, intent, "handlePlayerResult")
                }
            } catch (e: Exception) {
                Log.e(TAG, "playEpisode failed", e)
                call.reject("Native playback failed: ${e.message}", e)
            }
        }.start()
    }

    /**
     * Called from JS: Anime.searchHiAnime({ query: "..." })
     * Uses the native scraper with CF bypass to search HiAnime.
     */
    @PluginMethod
    fun searchHiAnime(call: PluginCall) {
        val query = call.getString("query") ?: ""
        Thread {
            try {
                ensureInitialized()
                val scr = scraper!!
                scr.ensureCfCookies()
                val results = scr.searchHiAnime(query)

                val arr = org.json.JSONArray()
                results.forEach { r ->
                    arr.put(org.json.JSONObject().apply {
                        put("id", r.id)
                        put("title", r.title)
                    })
                }
                call.resolve(JSObject().put("results", arr.toString()))
            } catch (e: Exception) {
                Log.e(TAG, "searchHiAnime failed", e)
                call.reject("Search failed: ${e.message}", e)
            }
        }.start()
    }

    /**
     * Called from JS: Anime.getEpisodes({ animeId: "..." })
     * Uses the native scraper with CF bypass to fetch episode list.
     */
    @PluginMethod
    fun getEpisodes(call: PluginCall) {
        val animeId = call.getString("animeId") ?: ""
        if (animeId.isEmpty()) {
            call.reject("Missing animeId parameter")
            return
        }
        Thread {
            try {
                ensureInitialized()
                val scr = scraper!!
                scr.ensureCfCookies()
                val episodes = scr.getEpisodes(animeId)

                val arr = org.json.JSONArray()
                episodes.forEach { ep ->
                    arr.put(org.json.JSONObject().apply {
                        put("id", ep.id)
                        put("number", ep.number)
                        put("title", ep.title)
                    })
                }
                call.resolve(JSObject().put("episodes", arr.toString()))
            } catch (e: Exception) {
                Log.e(TAG, "getEpisodes failed", e)
                call.reject("Episodes failed: ${e.message}", e)
            }
        }.start()
    }

    @PluginMethod
    fun downloadEpisode(call: PluginCall) {
        val episodeId = call.getString("episodeId")
        if (episodeId.isNullOrEmpty()) {
            call.reject("Missing episodeId")
            return
        }
        val title = call.getString("title") ?: "Episode"
        val animeTitle = call.getString("animeTitle") ?: "Anime"

        Thread {
            try {
                ensureInitialized()
                val scr = scraper!!
                val wve = webViewExtractor!!

                notifyDownload(episodeId, 0, "extracting")

                scr.ensureCfCookies()
                val embedUrls = scr.resolveAllEmbedUrls(episodeId)
                if (embedUrls.isEmpty()) throw Exception("No servers found")

                var stream: WebViewExtractor.ExtractedStream? = null
                for ((embedUrl, serverName) in embedUrls) {
                    val extraction = wve.extract(embedUrl)
                    if (extraction.stream != null) {
                        stream = extraction.stream
                        break
                    }
                }
                if (stream == null) throw Exception("Failed to extract stream")

                notifyDownload(episodeId, 3, "downloading")

                val client = OkHttpClient.Builder()
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .build()

                val m3u8Content = httpGet(client, stream.m3u8Url, stream.referer)
                val baseUrl = stream.m3u8Url.substringBeforeLast("/") + "/"
                var segments = parseM3u8Segments(m3u8Content, baseUrl, stream.m3u8Url)

                if (segments.isEmpty()) throw Exception("No segments in manifest")

                // If master playlist returned a variant URL, fetch that playlist
                if (segments.size == 1 && segments[0].endsWith(".m3u8")) {
                    val variantContent = httpGet(client, segments[0], stream.referer)
                    val variantBase = segments[0].substringBeforeLast("/") + "/"
                    segments = parseM3u8Segments(variantContent, variantBase, segments[0])
                    if (segments.isEmpty()) throw Exception("No segments in variant playlist")
                }

                notifyDownload(episodeId, 5, "downloading")

                val safeName = "$animeTitle - $title"
                    .replace(Regex("[^a-zA-Z0-9 \\-]"), "")
                    .trim()
                    .take(200)

                val outputStream = createGalleryOutputStream(safeName)
                    ?: throw Exception("Failed to create file in gallery")

                outputStream.use { out ->
                    for ((index, segUrl) in segments.withIndex()) {
                        downloadSegmentToStream(client, segUrl, stream.referer, out)
                        val progress = 5 + ((index + 1).toFloat() / segments.size * 95).toInt()
                        notifyDownload(episodeId, progress, "downloading")
                    }
                }

                finalizeGalleryEntry()

                val filePath = pendingMediaUri?.toString() ?: ""
                notifyDownload(episodeId, 100, "completed", filePath)
                call.resolve(JSObject().put("success", true).put("filePath", filePath))
            } catch (e: Exception) {
                Log.e(TAG, "downloadEpisode failed", e)
                notifyDownload(episodeId ?: "", 0, "error")
                call.reject("Download failed: ${e.message}", e)
            }
        }.start()
    }

    private var pendingMediaUri: android.net.Uri? = null

    private fun createGalleryOutputStream(fileName: String): OutputStream? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.DISPLAY_NAME, "$fileName.ts")
                put(MediaStore.Video.Media.MIME_TYPE, "video/mp2t")
                put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/Sakura")
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
            val uri = context.contentResolver.insert(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values
            ) ?: return null
            pendingMediaUri = uri
            context.contentResolver.openOutputStream(uri)
        } else {
            @Suppress("DEPRECATION")
            val dir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
                "Sakura"
            )
            dir.mkdirs()
            val file = File(dir, "$fileName.ts")
            pendingMediaUri = null
            FileOutputStream(file)
        }
    }

    private fun finalizeGalleryEntry() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && pendingMediaUri != null) {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.IS_PENDING, 0)
            }
            context.contentResolver.update(pendingMediaUri!!, values, null, null)
            pendingMediaUri = null
        }
    }

    private fun notifyDownload(episodeId: String, progress: Int, state: String, filePath: String = "") {
        notifyListeners("downloadProgress", JSObject().apply {
            put("episodeId", episodeId)
            put("progress", progress)
            put("state", state)
            if (filePath.isNotEmpty()) put("filePath", filePath)
        })
    }

    @PluginMethod
    fun playLocalEpisode(call: PluginCall) {
        val filePath = call.getString("filePath")
        val title = call.getString("title") ?: "Episode"
        val episodeId = call.getString("episodeId") ?: ""
        val hasNext = call.getBoolean("hasNext", false) ?: false
        val nextEpisodeTitle = call.getString("nextEpisodeTitle") ?: ""
        if (filePath.isNullOrEmpty()) {
            call.reject("Missing filePath")
            return
        }
        activity.runOnUiThread {
            val intent = Intent(context, PlayerActivity::class.java).apply {
                putExtra(PlayerActivity.EXTRA_STREAM_URL, filePath)
                putExtra(PlayerActivity.EXTRA_TITLE, title)
                putExtra(PlayerActivity.EXTRA_IS_LOCAL, true)
                putExtra(PlayerActivity.EXTRA_EPISODE_ID, episodeId)
                putExtra(PlayerActivity.EXTRA_HAS_NEXT, hasNext)
                putExtra(PlayerActivity.EXTRA_NEXT_TITLE, nextEpisodeTitle)
            }
            startActivityForResult(call, intent, "handlePlayerResult")
        }
    }

    @ActivityCallback
    fun handlePlayerResult(call: PluginCall, result: ActivityResult) {
        val data = result.data
        val completed = data?.getBooleanExtra("completed", false) ?: false
        val episodeId = data?.getStringExtra("episodeId") ?: ""

        notifyListeners("playbackEnded", JSObject().apply {
            put("episodeId", episodeId)
            put("completed", completed)
        })

        call.resolve(JSObject().apply {
            put("success", true)
            put("completed", completed)
        })
    }

    private fun httpGet(client: OkHttpClient, url: String, referer: String): String {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
            .header("Referer", referer)
            .header("Origin", referer.substringBeforeLast("/"))
            .build()
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
        return response.body?.string() ?: throw Exception("Empty response")
    }

    private fun downloadSegmentToStream(client: OkHttpClient, url: String, referer: String, output: OutputStream) {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
            .header("Referer", referer)
            .header("Origin", referer.substringBeforeLast("/"))
            .build()
        val response = client.newCall(request).execute()
        if (!response.isSuccessful) throw Exception("HTTP ${response.code} for segment")
        response.body?.byteStream()?.use { input ->
            input.copyTo(output, bufferSize = 8192)
        } ?: throw Exception("Empty segment body")
    }

    private fun parseM3u8Segments(content: String, baseUrl: String, manifestUrl: String): List<String> {
        val lines = content.lines().map { it.trim() }

        // Check for master playlist
        val variants = mutableListOf<Pair<Int, String>>()
        for (i in lines.indices) {
            if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
                val bw = Regex("BANDWIDTH=(\\d+)").find(lines[i])?.groupValues?.get(1)?.toIntOrNull() ?: 0
                val next = lines.getOrNull(i + 1)?.trim() ?: continue
                if (next.isNotEmpty() && !next.startsWith("#")) {
                    variants.add(bw to resolveUrl(next, baseUrl, manifestUrl))
                }
            }
        }
        if (variants.isNotEmpty()) {
            val best = variants.maxByOrNull { it.first }?.second ?: return emptyList()
            return listOf(best)
        }

        // Media playlist — collect segment URLs
        val segments = mutableListOf<String>()
        for (line in lines) {
            if (line.isEmpty() || line.startsWith("#")) continue
            segments.add(resolveUrl(line, baseUrl, manifestUrl))
        }
        return segments
    }

    private fun resolveUrl(path: String, baseUrl: String, manifestUrl: String): String {
        return when {
            path.startsWith("http://") || path.startsWith("https://") -> path
            path.startsWith("/") -> {
                val url = java.net.URL(manifestUrl)
                "${url.protocol}://${url.host}$path"
            }
            else -> baseUrl + path
        }
    }

    /**
     * Fetches subtitle tracks directly from MegaCloud's getSources API.
     * The tracks array is always in plaintext even when sources are encrypted.
     * This runs after stream extraction succeeds — if it fails, playback still works.
     */
    private fun fetchSubtitlesFromApi(embedUrl: String): List<WebViewExtractor.SubtitleTrack> {
        try {
            val parsed = java.net.URL(embedUrl)
            val baseUrl = "${parsed.protocol}://${parsed.host}"
            val pathParts = parsed.path.split("/").filter { it.isNotEmpty() }
            val videoId = pathParts.last().split("?")[0]

            val eIdx = pathParts.indexOfFirst { it.startsWith("e-") }
            val prefix = if (eIdx > 0) "/" + pathParts.subList(0, eIdx).joinToString("/") else "/embed-2"
            val eVersion = if (eIdx >= 0) pathParts[eIdx] else "e-1"
            val apiUrl = "$baseUrl$prefix/ajax/$eVersion/getSources?id=$videoId"

            Log.d(TAG, "Fetching subtitles from API: $apiUrl")

            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build()

            val request = Request.Builder()
                .url(apiUrl)
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
                .header("Referer", "https://hianime.to/")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Accept", "*/*")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "Subtitle API returned ${response.code}")
                response.close()
                return emptyList()
            }

            val body = response.body?.string() ?: return emptyList()
            val json = org.json.JSONObject(body)
            val tracks = json.optJSONArray("tracks") ?: return emptyList()

            val subtitles = mutableListOf<WebViewExtractor.SubtitleTrack>()
            for (i in 0 until tracks.length()) {
                val track = tracks.getJSONObject(i)
                val file = track.optString("file", "")
                val label = track.optString("label", "Track ${i + 1}")
                val kind = track.optString("kind", "")
                if (file.isNotEmpty() && kind != "thumbnails") {
                    subtitles.add(WebViewExtractor.SubtitleTrack(url = file, label = label))
                }
            }

            Log.d(TAG, "API returned ${subtitles.size} subtitle tracks")
            return subtitles
        } catch (e: Exception) {
            Log.w(TAG, "Subtitle API fetch failed (non-fatal): ${e.message}")
            return emptyList()
        }
    }

    /**
     * Utility method to clear cached Cloudflare cookies.
     * Call this from JS if streaming consistently fails (forces a fresh CF solve).
     */
    @PluginMethod
    fun clearCache(call: PluginCall) {
        CloudflareBypass.clearCache()
        call.resolve(JSObject().put("cleared", true))
    }
}
