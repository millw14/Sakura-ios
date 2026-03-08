package com.millw14.sakura.anime

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.ui.PlayerView

/**
 * Fullscreen ExoPlayer activity for HLS (.m3u8) anime playback.
 * Launched by AnimePlugin with the stream URL passed via Intent extras.
 */
@OptIn(UnstableApi::class)
class PlayerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_STREAM_URL = "stream_url"
        const val EXTRA_REFERER = "referer"
        const val EXTRA_TITLE = "title"
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        hideSystemUI()

        playerView = PlayerView(this)
        playerView.keepScreenOn = true
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

        val mediaSource: MediaSource = HlsMediaSource.Factory(httpDataSourceFactory)
            .createMediaSource(MediaItem.fromUri(url))

        player = ExoPlayer.Builder(this).build().also { exo ->
            playerView.player = exo
            exo.setMediaSource(mediaSource)
            exo.playWhenReady = true
            exo.prepare()

            exo.addListener(object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    android.util.Log.e("PlayerActivity", "Playback error", error)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        finish()
                    }
                }
            })
        }
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
