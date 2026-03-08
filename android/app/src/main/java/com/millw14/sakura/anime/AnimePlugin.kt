package com.millw14.sakura.anime

import android.content.Intent
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

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

                for ((embedUrl, serverName) in embedUrls) {
                    Log.d(TAG, "Trying server $serverName: $embedUrl")
                    val extraction = wve.extract(embedUrl)
                    lastDebugLog += "=== $serverName ===\n${extraction.debugLog}\n\n"

                    if (extraction.stream != null) {
                        stream = extraction.stream
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

                // Step 4: Launch ExoPlayer on the main thread
                activity.runOnUiThread {
                    val intent = Intent(context, PlayerActivity::class.java).apply {
                        putExtra(PlayerActivity.EXTRA_STREAM_URL, stream.m3u8Url)
                        putExtra(PlayerActivity.EXTRA_REFERER, stream.referer)
                        putExtra(PlayerActivity.EXTRA_TITLE, title)
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
     * Utility method to clear cached Cloudflare cookies.
     * Call this from JS if streaming consistently fails (forces a fresh CF solve).
     */
    @PluginMethod
    fun clearCache(call: PluginCall) {
        CloudflareBypass.clearCache()
        call.resolve(JSObject().put("cleared", true))
    }
}
