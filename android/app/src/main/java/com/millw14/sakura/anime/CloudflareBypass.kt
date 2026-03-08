package com.millw14.sakura.anime

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.Context
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Solves Cloudflare JS challenges by loading the target URL in a hidden WebView.
 * The WebView's built-in Chromium engine executes the challenge JS automatically.
 * Once cf_clearance cookie appears, the cookies are captured for OkHttp use.
 *
 * Based on the Aniyomi CloudflareInterceptor pattern.
 */
class CloudflareBypass(private val context: Context) {

    companion object {
        private const val CF_CLEARANCE = "cf_clearance"
        private const val TIMEOUT_SECONDS = 30L

        @Volatile
        private var cachedCookies: Map<String, Map<String, String>> = emptyMap()

        @Volatile
        private var cacheTimestamp: Long = 0L

        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes

        fun getCachedCookiesForDomain(domain: String): Map<String, String>? {
            if (System.currentTimeMillis() - cacheTimestamp > CACHE_TTL_MS) {
                cachedCookies = emptyMap()
                return null
            }
            return cachedCookies[domain]
        }

        fun clearCache() {
            cachedCookies = emptyMap()
            cacheTimestamp = 0L
        }
    }

    /**
     * Resolves Cloudflare for the given URL. Returns a map of cookie name -> value.
     * Must NOT be called from the main thread.
     */
    fun resolve(url: String): Map<String, String> {
        val domain = extractDomain(url)

        val cached = getCachedCookiesForDomain(domain)
        if (cached != null && cached.containsKey(CF_CLEARANCE)) {
            return cached
        }

        val latch = CountDownLatch(1)
        val result = mutableMapOf<String, String>()
        val handler = Handler(Looper.getMainLooper())

        handler.post {
            createBypassWebView(url, result, latch)
        }

        latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)

        if (result.isNotEmpty()) {
            val mutable = cachedCookies.toMutableMap()
            mutable[domain] = result.toMap()
            cachedCookies = mutable
            cacheTimestamp = System.currentTimeMillis()
        }

        return result
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createBypassWebView(
        url: String,
        result: MutableMap<String, String>,
        latch: CountDownLatch
    ) {
        val webView = WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = buildUserAgent()
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        val handler = Handler(Looper.getMainLooper())
        var resolved = false

        val checkCookies = object : Runnable {
            var attempts = 0
            override fun run() {
                if (resolved) return
                attempts++

                val cookies = cookieManager.getCookie(url)
                if (cookies != null && cookies.contains(CF_CLEARANCE)) {
                    resolved = true
                    parseCookies(cookies, result)
                    webView.stopLoading()
                    webView.destroy()
                    latch.countDown()
                    return
                }

                if (attempts < (TIMEOUT_SECONDS * 2).toInt()) {
                    handler.postDelayed(this, 500)
                } else {
                    // Timeout — collect whatever cookies we have
                    if (cookies != null) {
                        parseCookies(cookies, result)
                    }
                    resolved = true
                    webView.stopLoading()
                    webView.destroy()
                    latch.countDown()
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, loadUrl: String?) {
                super.onPageFinished(view, loadUrl)
                handler.post(checkCookies)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                return false
            }
        }

        webView.loadUrl(url)
    }

    private fun parseCookies(cookieHeader: String, target: MutableMap<String, String>) {
        cookieHeader.split(";").forEach { part ->
            val trimmed = part.trim()
            val eqIndex = trimmed.indexOf('=')
            if (eqIndex > 0) {
                val name = trimmed.substring(0, eqIndex).trim()
                val value = trimmed.substring(eqIndex + 1).trim()
                target[name] = value
            }
        }
    }

    private fun extractDomain(url: String): String {
        return try {
            java.net.URL(url).host
        } catch (e: Exception) {
            url
        }
    }

    private fun buildUserAgent(): String {
        return "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    }
}
