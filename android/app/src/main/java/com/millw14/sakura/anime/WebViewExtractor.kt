package com.millw14.sakura.anime

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class WebViewExtractor(private val context: Context) {

    companion object {
        private const val TAG = "WebViewExtractor"
        private const val TIMEOUT_SECONDS = 60L
        private const val USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    }

    data class ExtractedStream(
        val m3u8Url: String,
        val referer: String,
        val headers: Map<String, String> = emptyMap()
    )

    data class ExtractionResult(
        val stream: ExtractedStream?,
        val debugLog: String,
        val isFileNotFound: Boolean = false
    )

    fun extract(embedUrl: String): ExtractionResult {
        val url = ensureAutoPlay(embedUrl)
        Log.d(TAG, "Extracting stream from: $url")

        val latch = CountDownLatch(1)
        var result: ExtractedStream? = null
        var fileNotFound = false
        val debugLines = mutableListOf<String>()

        fun addDebug(msg: String) {
            synchronized(debugLines) { debugLines.add(msg) }
            Log.d(TAG, msg)
            if (msg.contains("error:We're Sorry") || msg.contains("can't find the file")) {
                fileNotFound = true
                if (latch.count > 0) latch.countDown()
            }
        }

        addDebug("Starting extraction for: $url")

        Handler(Looper.getMainLooper()).post {
            createExtractorWebView(url, { stream ->
                if (result == null) {
                    result = stream
                    if (latch.count > 0) latch.countDown()
                }
            }, latch, ::addDebug)
        }

        latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)

        val log = synchronized(debugLines) { debugLines.joinToString("\n") }

        if (result != null) {
            addDebug("SUCCESS: ${result!!.m3u8Url}")
        } else if (fileNotFound) {
            addDebug("FILE_NOT_FOUND on MegaCloud")
        } else {
            addDebug("FAILED: No m3u8 found")
        }

        return ExtractionResult(stream = result, debugLog = log, isFileNotFound = fileNotFound)
    }

    private fun ensureAutoPlay(url: String): String {
        val sep = if (url.contains("?")) "&" else "?"
        var r = url
        if (!r.contains("autoPlay=")) r += "${sep}autoPlay=1"
        if (!r.contains("oa=")) r += "&oa=0"
        if (!r.contains("asi=")) r += "&asi=1"
        return r
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createExtractorWebView(
        embedUrl: String,
        onResult: (ExtractedStream?) -> Unit,
        latch: CountDownLatch,
        addDebug: (String) -> Unit
    ) {
        val parsedEmbed = java.net.URL(embedUrl)
        val referer = "${parsedEmbed.protocol}://${parsedEmbed.host}/"
        var webView: WebView? = null
        var finished = false
        val allUrls = mutableListOf<String>()

        fun finish(stream: ExtractedStream?) {
            if (finished) return
            finished = true
            webView?.stopLoading()
            webView?.destroy()
            webView = null
            onResult(stream)
        }

        val jsInterface = object {
            @JavascriptInterface
            fun onSourceFound(url: String) {
                addDebug("JS_SOURCE: $url")
                if (!finished && url.isNotEmpty()) {
                    Handler(Looper.getMainLooper()).post {
                        finish(ExtractedStream(m3u8Url = url, referer = referer))
                    }
                }
            }

            @JavascriptInterface
            fun logDebug(msg: String) {
                addDebug("JS: $msg")
            }
        }

        webView = WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.userAgentString = USER_AGENT
            settings.allowContentAccess = true
            settings.allowFileAccess = true
            addJavascriptInterface(jsInterface, "Extractor")
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView!!, true)

        webView!!.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    addDebug("CONSOLE[${it.messageLevel()}]: ${it.message()}")
                }
                return true
            }
        }

        webView!!.webViewClient = object : WebViewClient() {

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url?.toString() ?: return null

                synchronized(allUrls) { allUrls.add(url) }

                if (isStreamUrl(url)) {
                    addDebug("STREAM_FOUND: $url")
                    if (!finished) {
                        val headers = mutableMapOf<String, String>()
                        request.requestHeaders?.forEach { (k, v) -> headers[k] = v }
                        Handler(Looper.getMainLooper()).post {
                            finish(ExtractedStream(m3u8Url = url, referer = referer, headers = headers))
                        }
                    }
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, loadUrl: String?) {
                super.onPageFinished(view, loadUrl)
                addDebug("PAGE_LOADED: $loadUrl")
                injectAutoPlayAndPoll(view, addDebug)
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                addDebug("WV_ERROR[$errorCode]: $description @ $failingUrl")
            }
        }

        val loadHeaders = mapOf(
            "Referer" to "https://hianime.to/",
            "Origin" to "https://hianime.to"
        )
        addDebug("Loading URL with Referer: hianime.to")
        webView!!.loadUrl(embedUrl, loadHeaders)

        Handler(Looper.getMainLooper()).postDelayed({
            if (!finished) {
                synchronized(allUrls) {
                    addDebug("TIMEOUT after ${TIMEOUT_SECONDS}s. URLs seen: ${allUrls.size}")
                    allUrls.takeLast(20).forEach { addDebug("  URL: $it") }
                }
                finish(null)
            }
        }, TIMEOUT_SECONDS * 1000)
    }

    private fun isStreamUrl(url: String): Boolean {
        return url.contains(".m3u8") ||
            url.contains("master.txt") ||
            url.contains("type=video") ||
            (url.contains("/hls/") && !url.contains(".js") && !url.contains(".css"))
    }

    private fun injectAutoPlayAndPoll(view: WebView?, addDebug: (String) -> Unit) {
        if (view == null) return
        val handler = Handler(Looper.getMainLooper())

        val forcePlayScript = """
            (function() {
                try {
                    if (window.playerSettings) {
                        window.playerSettings.autoPlay = 1;
                        Extractor.logDebug('playerSettings.autoPlay set to 1');
                    } else {
                        Extractor.logDebug('No playerSettings found');
                    }
                    setTimeout(function() {
                        try {
                            if (typeof jwplayer === 'function') {
                                var p = jwplayer();
                                Extractor.logDebug('JWP state=' + (p.getState ? p.getState() : '?'));
                                p.play();
                                Extractor.logDebug('JWP play() called');
                            } else {
                                Extractor.logDebug('No jwplayer function');
                            }
                        } catch(e) { Extractor.logDebug('Play err: ' + e.message); }
                    }, 3000);
                } catch(e) { Extractor.logDebug('Init err: ' + e.message); }
            })();
        """.trimIndent()

        view.evaluateJavascript(forcePlayScript, null)

        val pollScript = """
            (function() {
                try {
                    if (typeof jwplayer === 'function') {
                        var p = jwplayer();
                        if (p && p.getPlaylistItem) {
                            var item = p.getPlaylistItem();
                            if (item && item.file) {
                                Extractor.onSourceFound(item.file);
                                return 'found';
                            }
                        }
                        if (p && p.getPlaylist) {
                            var pl = p.getPlaylist();
                            if (pl && pl.length > 0 && pl[0].file) {
                                Extractor.onSourceFound(pl[0].file);
                                return 'found';
                            }
                        }
                        return 'jwp:' + (p && p.getState ? p.getState() : 'no-state');
                    }
                    var vid = document.querySelector('video');
                    if (vid) {
                        var s = vid.src || vid.currentSrc || '';
                        if (s && s.startsWith('http')) {
                            Extractor.onSourceFound(s);
                            return 'video:' + s.substring(0, 60);
                        }
                        return 'video-no-src';
                    }
                    var err = document.querySelector('.error-content');
                    if (err && err.offsetParent !== null) {
                        return 'error:' + err.textContent.trim().substring(0, 80);
                    }
                    return 'waiting';
                } catch(e) { return 'err:' + e.message; }
            })();
        """.trimIndent()

        var attempts = 0

        val poller = object : Runnable {
            override fun run() {
                if (attempts >= 25) return
                attempts++
                view.evaluateJavascript(pollScript) { result ->
                    val clean = result?.trim('"') ?: "null"
                    if (attempts % 3 == 0 || clean != "waiting") {
                        addDebug("POLL[$attempts]: $clean")
                    }
                }
                handler.postDelayed(this, 2000)
            }
        }

        handler.postDelayed(poller, 3000)
    }
}
