package com.millw14.sakura.anime

import android.content.Context
import android.util.Log
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.jsoup.Jsoup
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Scrapes HiAnime using OkHttp + Jsoup, with Cloudflare bypass cookies.
 * Mirrors the endpoints from src/lib/sources/hianime.ts.
 */
class AnimeScraper(private val context: Context) {

    companion object {
        private const val TAG = "AnimeScraper"
        private const val BASE_URL = "https://hianime.to"
        private val USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    }

    private val cfBypass = CloudflareBypass(context)

    @Volatile
    private var cfCookies: Map<String, String> = emptyMap()

    private val cookieJar = object : CookieJar {
        private val store = mutableMapOf<String, List<Cookie>>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            store[url.host] = cookies
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            val saved = store[url.host].orEmpty().toMutableList()
            cfCookies.forEach { (name, value) ->
                saved.add(
                    Cookie.Builder()
                        .domain(url.host)
                        .name(name)
                        .value(value)
                        .build()
                )
            }
            return saved
        }
    }

    val client: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    /**
     * Ensures Cloudflare cookies are available. Call before any HiAnime request.
     */
    fun ensureCfCookies() {
        if (cfCookies.isEmpty() || !cfCookies.containsKey("cf_clearance")) {
            Log.d(TAG, "Resolving Cloudflare challenge for $BASE_URL ...")
            cfCookies = cfBypass.resolve(BASE_URL)
            Log.d(TAG, "CF cookies obtained: ${cfCookies.keys}")
        }
    }

    /**
     * Retries the CF bypass if a request gets 403/503.
     */
    private fun refreshCfCookies() {
        Log.d(TAG, "Refreshing Cloudflare cookies...")
        CloudflareBypass.clearCache()
        cfCookies = cfBypass.resolve(BASE_URL)
    }

    private fun buildRequest(url: String): Request {
        return Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .header("Referer", "$BASE_URL/")
            .header("X-Requested-With", "XMLHttpRequest")
            .build()
    }

    /**
     * Executes a GET request with automatic CF retry on 403/503.
     */
    fun fetch(url: String): String {
        val request = buildRequest(url)
        var response = client.newCall(request).execute()

        if (response.code == 403 || response.code == 503) {
            response.close()
            refreshCfCookies()
            response = client.newCall(buildRequest(url)).execute()
        }

        if (!response.isSuccessful) {
            val code = response.code
            response.close()
            throw Exception("HTTP $code for $url")
        }

        return response.body?.string() ?: throw Exception("Empty response body from $url")
    }

    /**
     * Fetches a URL and parses the response as JSON.
     */
    fun fetchJson(url: String): JSONObject {
        val body = fetch(url)
        return JSONObject(body)
    }

    // ── HiAnime Endpoints ──────────────────────────────────────────────

    data class SearchResult(val id: String, val title: String)

    /**
     * /search?keyword= — returns list of anime with HiAnime IDs.
     * CSS: .flw-item a.dynamic-name → title, href → /-(\d+)(?:\?|$)/ → id
     */
    fun searchHiAnime(query: String): List<SearchResult> {
        val encoded = URLEncoder.encode(query, "UTF-8")
        val html = fetch("$BASE_URL/search?keyword=$encoded")
        val doc = Jsoup.parse(html)

        val results = mutableListOf<SearchResult>()
        doc.select(".flw-item").forEach { el ->
            val a = el.selectFirst("a.dynamic-name") ?: return@forEach
            val title = a.attr("title").ifEmpty { a.text() }
            val href = a.attr("href")
            val idMatch = Regex("-(\\d+)(?:\\?|$)").find(href)
            if (idMatch != null && title.isNotEmpty()) {
                results.add(SearchResult(idMatch.groupValues[1], title))
            }
        }
        return results
    }

    data class Episode(val id: String, val number: Int, val title: String)

    /**
     * /ajax/v2/episode/list/{animeId} — returns JSON with .html field.
     * CSS: .ep-item → data-id, data-number, title
     */
    fun getEpisodes(animeId: String): List<Episode> {
        val json = fetchJson("$BASE_URL/ajax/v2/episode/list/$animeId")
        val html = json.optString("html", "")
        val doc = Jsoup.parse(html)

        val episodes = mutableListOf<Episode>()
        doc.select(".ep-item").forEach { el ->
            val epId = el.attr("data-id")
            val epNum = el.attr("data-number")
            val title = el.attr("title").ifEmpty { "Episode $epNum" }
            if (epId.isNotEmpty()) {
                episodes.add(Episode(epId, epNum.toIntOrNull() ?: 0, title))
            }
        }
        return episodes
    }

    data class Server(val serverId: String, val name: String, val type: String)

    /**
     * /ajax/v2/episode/servers?episodeId= — returns JSON with .html field.
     * CSS: .server-item → data-id, data-type; .server-item a → name
     */
    fun getServers(episodeId: String): List<Server> {
        val json = fetchJson("$BASE_URL/ajax/v2/episode/servers?episodeId=$episodeId")
        val html = json.optString("html", "")
        val doc = Jsoup.parse(html)

        val servers = mutableListOf<Server>()
        doc.select(".server-item").forEach { el ->
            val serverId = el.attr("data-id")
            val name = el.selectFirst("a")?.text()?.trim() ?: ""
            val type = el.attr("data-type") // "sub" or "dub"
            if (serverId.isNotEmpty()) {
                servers.add(Server(serverId, name, type))
            }
        }
        return servers
    }

    data class SourceResult(val url: String, val isIframe: Boolean)

    /**
     * /ajax/v2/episode/sources?id= — returns JSON with link and type fields.
     */
    fun getSources(serverId: String): SourceResult? {
        val json = fetchJson("$BASE_URL/ajax/v2/episode/sources?id=$serverId")
        val link = json.optString("link", "")
        if (link.isEmpty()) return null
        val isIframe = json.optString("type", "") == "iframe"
        return SourceResult(link, isIframe)
    }

    /**
     * Returns embed URLs for all available servers (sub preferred, then dub),
     * so the caller can try each one until a working video is found.
     */
    fun resolveAllEmbedUrls(episodeId: String): List<Pair<String, String>> {
        val servers = getServers(episodeId)
        val subServers = servers.filter { it.type == "sub" }
        val dubServers = servers.filter { it.type == "dub" }
        val ordered = subServers + dubServers

        val urls = mutableListOf<Pair<String, String>>()
        for (server in ordered) {
            try {
                val source = getSources(server.serverId) ?: continue
                Log.d(TAG, "Server ${server.name}(${server.type}): ${source.url}")
                urls.add(Pair(source.url, "${server.name} ${server.type}"))
            } catch (e: Exception) {
                Log.w(TAG, "Failed to get source for server ${server.name}: ${e.message}")
            }
        }
        return urls
    }
}
