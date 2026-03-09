package com.millw14.sakura.anime

import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

@OptIn(UnstableApi::class)
class PlayerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_STREAM_URL = "stream_url"
        const val EXTRA_REFERER = "referer"
        const val EXTRA_TITLE = "title"
        const val EXTRA_SUBTITLES = "subtitles_json"
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private var hasSubtitles = false
    private var retriedWithoutSubs = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        hideSystemUI()

        playerView = PlayerView(this)
        playerView.keepScreenOn = true
        playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        playerView.setShowSubtitleButton(true)
        setContentView(playerView)

        val streamUrl = intent.getStringExtra(EXTRA_STREAM_URL)
        if (streamUrl.isNullOrEmpty()) {
            finish()
            return
        }

        val referer = intent.getStringExtra(EXTRA_REFERER) ?: "https://hianime.to/"
        initializePlayer(streamUrl, referer)
    }

    private fun initializePlayer(url: String, referer: String) {
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
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

        val mediaSource = DefaultMediaSourceFactory(httpDataSourceFactory)
            .createMediaSource(mediaItem)

        if (hasSubtitles) {
            android.util.Log.d("PlayerActivity", "Loading ${subtitleConfigs.size} subtitle tracks via DefaultMediaSourceFactory")
        }

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                50_000,
                150_000,
                2_500,
                5_000
            )
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
                .setMaxAudioChannelCount(Int.MAX_VALUE)
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
                    if (playbackState == Player.STATE_ENDED) {
                        finish()
                    }
                }
            })
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
                android.util.Log.d("PlayerActivity", "Subtitle[$i]: $label -> $subUrl (mime=$mimeType)")
            }
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Failed to parse subtitle configs", e)
        }
        return configs
    }

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

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        player?.playWhenReady = true
    }

    override fun onPause() {
        super.onPause()
        player?.playWhenReady = false
    }

    override fun onStop() {
        super.onStop()
        player?.playWhenReady = false
    }

    override fun onDestroy() {
        super.onDestroy()
        player?.release()
        player = null
    }
}
