package com.millw14.sakura.anime

import android.content.Intent
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.OkHttpClient
import okhttp3.Request
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

        Thread {
            try {
                ensureInitialized()
                val scr = scraper!!
                val wve = webViewExtractor!!

                Log.d(TAG, "Starting native playback for episode: $episodeId")

                // Step 1: Solve Cloudflare for hianime.to
                scr.ensureCfCookies()

                // Step 2: Get all embed URLs from available servers
                val embedUrls = scr.resolveAllEmbedUrls(episodeId)
                if (embedUrls.isEmpty()) {
                    throw Exception("No servers found for episode $episodeId")
                }
                Log.d(TAG, "Found ${embedUrls.size} servers")

                // Step 3: Try each server until one works
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

                // Step 3.5: Fetch subtitles from MegaCloud API (safe, won't affect playback)
                var allSubs = stream.subtitles.toMutableList()
                if (allSubs.isEmpty() && workingEmbedUrl.isNotEmpty()) {
                    val apiSubs = fetchSubtitlesFromApi(workingEmbedUrl)
                    allSubs.addAll(apiSubs)
                }

                // Step 4: Launch ExoPlayer on the main thread
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
                    }
                    context.startActivity(intent)
                    call.resolve(JSObject().put("success", true).put("url", stream.m3u8Url))
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
