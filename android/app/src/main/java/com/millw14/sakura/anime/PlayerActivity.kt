package com.millw14.sakura.anime

import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AlphaAnimation
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

@OptIn(UnstableApi::class)
class PlayerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_STREAM_URL = "stream_url"
        const val EXTRA_REFERER = "referer"
        const val EXTRA_TITLE = "title"
        const val EXTRA_SUBTITLES = "subtitles_json"
        const val EXTRA_IS_LOCAL = "is_local"
        const val EXTRA_EPISODE_ID = "episode_id"
        const val EXTRA_HAS_NEXT = "has_next"
        const val EXTRA_NEXT_TITLE = "next_title"
        private const val PREFS_NAME = "sakura_player_prefs"
        private const val UP_NEXT_THRESHOLD_MS = 60_000L
        private const val COUNTDOWN_SECONDS = 5
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private var hasSubtitles = false
    private var retriedWithoutSubs = false

    private var episodeId: String = ""
    private var hasNext = false
    private var nextTitle: String = ""
    private var resultSent = false
    private var positionRestored = false

    private lateinit var upNextCard: LinearLayout
    private lateinit var countdownText: TextView
    private var upNextShown = false
    private val handler = Handler(Looper.getMainLooper())
    private var countdownValue = COUNTDOWN_SECONDS

    private val positionChecker = object : Runnable {
        override fun run() {
            val p = player ?: return
            val duration = p.duration
            val position = p.currentPosition
            if (duration > 0 && hasNext && !upNextShown) {
                if (duration - position <= UP_NEXT_THRESHOLD_MS) {
                    showUpNextCard()
                }
            }
            if (p.isPlaying) {
                handler.postDelayed(this, 1000)
            }
        }
    }

    private val countdownRunner = object : Runnable {
        override fun run() {
            countdownValue--
            if (countdownValue <= 0) {
                finishWithResult(true)
            } else {
                countdownText.text = "Starting in ${countdownValue}s\u2026"
                handler.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        hideSystemUI()

        episodeId = intent.getStringExtra(EXTRA_EPISODE_ID) ?: ""
        hasNext = intent.getBooleanExtra(EXTRA_HAS_NEXT, false)
        nextTitle = intent.getStringExtra(EXTRA_NEXT_TITLE) ?: ""

        val root = FrameLayout(this)

        playerView = PlayerView(this).apply {
            keepScreenOn = true
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            setShowSubtitleButton(true)
        }
        root.addView(playerView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))

        upNextCard = buildUpNextCard()
        upNextCard.visibility = View.GONE
        root.addView(upNextCard, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            marginEnd = dp(24)
            bottomMargin = dp(80)
        })

        setContentView(root)

        val streamUrl = intent.getStringExtra(EXTRA_STREAM_URL)
        if (streamUrl.isNullOrEmpty()) {
            finishWithResult(false)
            return
        }

        val isLocal = intent.getBooleanExtra(EXTRA_IS_LOCAL, false)
        if (isLocal) {
            initializeLocalPlayer(streamUrl)
        } else {
            val referer = intent.getStringExtra(EXTRA_REFERER) ?: "https://hianime.to/"
            initializePlayer(streamUrl, referer)
        }
    }

    private fun buildUpNextCard(): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                colors = intArrayOf(
                    Color.parseColor("#E91E7B"),
                    Color.parseColor("#C2185B")
                )
                orientation = GradientDrawable.Orientation.LEFT_RIGHT
            }
            elevation = dp(8).toFloat()
            isClickable = true
            isFocusable = true
        }

        card.addView(TextView(this).apply {
            text = "\uD83C\uDF38 Up Next"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            alpha = 0.9f
        })

        card.addView(TextView(this).apply {
            text = nextTitle.ifEmpty { "Next Episode" }
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            maxWidth = dp(220)
            ellipsize = TextUtils.TruncateAt.END
        })

        countdownText = TextView(this).apply {
            setTextColor(Color.parseColor("#FFE0F0"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            visibility = View.GONE
        }
        card.addView(countdownText)

        card.setOnClickListener {
            handler.removeCallbacks(countdownRunner)
            finishWithResult(true)
        }

        return card
    }

    private fun showUpNextCard() {
        if (upNextShown) return
        upNextShown = true
        upNextCard.visibility = View.VISIBLE
        upNextCard.startAnimation(AlphaAnimation(0f, 1f).apply { duration = 500 })
    }

    private fun startCountdown() {
        countdownValue = COUNTDOWN_SECONDS
        countdownText.text = "Starting in ${countdownValue}s\u2026"
        countdownText.visibility = View.VISIBLE
        handler.postDelayed(countdownRunner, 1000)
    }

    private fun finishWithResult(completed: Boolean) {
        if (resultSent) return
        resultSent = true
        handler.removeCallbacks(positionChecker)
        handler.removeCallbacks(countdownRunner)

        if (completed && episodeId.isNotEmpty()) {
            clearSavedPosition()
        }

        setResult(Activity.RESULT_OK, Intent().apply {
            putExtra("completed", completed)
            putExtra("episodeId", episodeId)
        })
        finish()
    }

    /* ── Position persistence ── */

    private fun getPrefs(): SharedPreferences =
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

    private fun savePosition() {
        val pos = player?.currentPosition ?: return
        if (episodeId.isEmpty() || pos <= 0) return
        getPrefs().edit().putLong("anime_pos_$episodeId", pos).apply()
    }

    private fun restorePosition() {
        if (positionRestored || episodeId.isEmpty()) return
        positionRestored = true
        val pos = getPrefs().getLong("anime_pos_$episodeId", 0L)
        if (pos > 0) {
            player?.seekTo(pos)
            android.util.Log.d("PlayerActivity", "Restored position to ${pos}ms for $episodeId")
        }
    }

    private fun clearSavedPosition() {
        if (episodeId.isEmpty()) return
        getPrefs().edit().remove("anime_pos_$episodeId").apply()
    }

    /* ── Player initialization ── */

    private fun initializePlayer(url: String, referer: String) {
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()

        val dataSourceFactory = OkHttpDataSource.Factory(okHttpClient)
            .setUserAgent(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            )
            .setDefaultRequestProperties(
                mapOf(
                    "Referer" to referer,
                    "Origin" to referer.trimEnd('/'),
                    "Accept" to "*/*"
                )
            )

        val subtitleConfigs = if (!retriedWithoutSubs) buildSubtitleConfigs() else emptyList()
        hasSubtitles = subtitleConfigs.isNotEmpty()

        val mediaItem = MediaItem.Builder()
            .setUri(url)
            .setMimeType(MimeTypes.APPLICATION_M3U8)
            .apply {
                if (subtitleConfigs.isNotEmpty()) {
                    setSubtitleConfigurations(subtitleConfigs)
                }
            }
            .build()

        val mediaSource = DefaultMediaSourceFactory(dataSourceFactory)
            .createMediaSource(mediaItem)

        if (hasSubtitles) {
            android.util.Log.d("PlayerActivity", "Loading ${subtitleConfigs.size} subtitle tracks")
        }

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(30_000, 120_000, 5_000, 8_000)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        player = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .build().also { exo ->
            playerView.player = exo

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                .build()
            exo.setAudioAttributes(audioAttributes, true)

            exo.trackSelectionParameters = TrackSelectionParameters.Builder(this)
                .setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
                .setPreferredAudioLanguage("ja")
                .setPreferredTextLanguage("en")
                .build()
            exo.setMediaSource(mediaSource)
            exo.playWhenReady = true
            exo.prepare()

            exo.addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    android.util.Log.e("PlayerActivity", "Playback error", error)
                    if (hasSubtitles && !retriedWithoutSubs) {
                        android.util.Log.d("PlayerActivity", "Retrying without subtitles")
                        retriedWithoutSubs = true
                        player?.release()
                        player = null
                        initializePlayer(url, referer)
                        return
                    }
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        restorePosition()
                        handler.post(positionChecker)
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        onPlaybackEnded()
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) handler.post(positionChecker)
                }
            })
        }
    }

    private fun initializeLocalPlayer(uri: String) {
        val mediaItem = MediaItem.fromUri(android.net.Uri.parse(uri))

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15_000, 60_000, 1_000, 2_000)
            .build()

        player = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .build().also { exo ->
            playerView.player = exo

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                .build()
            exo.setAudioAttributes(audioAttributes, true)

            exo.setMediaItem(mediaItem)
            exo.playWhenReady = true
            exo.prepare()

            exo.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY) {
                        restorePosition()
                        handler.post(positionChecker)
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        onPlaybackEnded()
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) handler.post(positionChecker)
                }
            })
        }
    }

    private fun onPlaybackEnded() {
        clearSavedPosition()
        if (hasNext) {
            showUpNextCard()
            startCountdown()
        } else {
            finishWithResult(true)
        }
    }

    private fun buildSubtitleConfigs(): List<MediaItem.SubtitleConfiguration> {
        val json = intent.getStringExtra(EXTRA_SUBTITLES) ?: return emptyList()
        if (json.isEmpty() || json == "[]") return emptyList()

        val configs = mutableListOf<MediaItem.SubtitleConfiguration>()
        try {
            val arr = org.json.JSONArray(json)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val subUrl = obj.getString("url")
                val label = obj.optString("label", "Subtitle")

                val mimeType = when {
                    subUrl.lowercase().endsWith(".srt") -> MimeTypes.APPLICATION_SUBRIP
                    subUrl.lowercase().endsWith(".ass") || subUrl.lowercase().endsWith(".ssa") -> MimeTypes.TEXT_SSA
                    else -> MimeTypes.TEXT_VTT
                }

                configs.add(
                    MediaItem.SubtitleConfiguration.Builder(Uri.parse(subUrl))
                        .setMimeType(mimeType)
                        .setLabel(label)
                        .setLanguage("en")
                        .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                        .build()
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Failed to parse subtitle configs", e)
        }
        return configs
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics
        ).toInt()

    private fun hideSystemUI() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    @Deprecated("Use onBackPressedDispatcher", ReplaceWith("onBackPressedDispatcher"))
    override fun onBackPressed() {
        finishWithResult(false)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        player?.playWhenReady = true
    }

    override fun onPause() {
        super.onPause()
        player?.playWhenReady = false
        savePosition()
    }

    override fun onStop() {
        super.onStop()
        player?.playWhenReady = false
        savePosition()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        player?.release()
        player = null
    }
}
