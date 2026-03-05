"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchEpisodeSources, type StreamingSource, fetchAnimeInfo, type AnimeInfo } from "@/lib/anime";
import Link from "next/link";
import Hls from "hls.js";

function AnimeWatchInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get("id") || "";
    const episodeId = searchParams.get("ep") || "";

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    const [anime, setAnime] = useState<AnimeInfo | null>(null);
    const [source, setSource] = useState<StreamingSource | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load anime meta and video sources
    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [animeData, sourceData] = await Promise.all([
                    fetchAnimeInfo(id),
                    fetchEpisodeSources(episodeId)
                ]);

                if (animeData) setAnime(animeData);
                if (sourceData) {
                    setSource(sourceData);
                } else {
                    setError("Failed to extract video feeds for this episode.");
                }
            } catch (e: any) {
                setError(e.message || "Failed to load episode stream.");
            }
            setLoading(false);
        }
        if (id && episodeId) {
            load();
        }
    }, [id, episodeId]);

    // Mount HLS.js when source changes
    useEffect(() => {
        if (!source || !source.isM3U8 || !videoRef.current) return;

        const video = videoRef.current;

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                // Spoof referer via custom loader if needed
                xhrSetup: (xhr) => {
                    xhr.setRequestHeader('Referer', 'https://megacloud.tv/');
                },
            });
            hls.loadSource(source.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => { /* autoplay blocked */ });
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    console.error('[HLS] Fatal error:', data.type, data.details);
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad(); // Retry
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        setError('HLS playback failed. The stream may be temporarily unavailable.');
                    }
                }
            });
            hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS support
            video.src = source.url;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(() => { });
            });
        } else {
            setError('HLS playback is not supported in this browser.');
        }

        // Load subtitle tracks
        if (source.tracks) {
            for (const track of source.tracks) {
                if (track.kind === 'captions' || track.kind === 'subtitles') {
                    const trackEl = document.createElement('track');
                    trackEl.kind = 'subtitles';
                    trackEl.label = track.label || 'Unknown';
                    trackEl.src = track.file;
                    video.appendChild(trackEl);
                }
            }
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [source]);

    // Find current episode and next episode for auto-next logic
    const currentEpisodeIndex = anime?.episodes.findIndex(e => e.id === episodeId) ?? -1;
    const currentEpisode = currentEpisodeIndex >= 0 ? anime?.episodes[currentEpisodeIndex] : null;
    const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < (anime?.episodes.length || 0) - 1
        ? anime?.episodes[currentEpisodeIndex + 1]
        : null;

    if (loading) {
        return (
            <main className="cinema-page" style={{ height: "100vh", display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <div className="spinner" style={{ color: "var(--sakura-pink)" }}>🌸 Decrypting Stream...</div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="cinema-page" style={{ height: "100vh", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', padding: 20 }}>
                <h2>Playback Error</h2>
                <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                <button onClick={() => router.back()} className="btn-secondary" style={{ marginTop: 24 }}>
                    Go Back
                </button>
            </main>
        );
    }

    return (
        <main className="cinema-page" style={{
            minHeight: "100vh",
            background: "#000",
            color: "#fff",
            display: "flex",
            flexDirection: "column"
        }}>
            {/* Cinematic Header Overlay */}
            <header style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => router.back()} aria-label="Go back" style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none', borderRadius: '50%',
                        width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', cursor: 'pointer',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <div>
                        <h1 style={{ fontSize: 16, margin: 0, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                            {anime?.title || "Anime"}
                        </h1>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--sakura-pink)' }}>
                            {currentEpisode?.title || `Episode ${currentEpisode?.number || "?"}`}
                        </p>
                    </div>
                </div>

                <Link href={`/anime/details?id=${encodeURIComponent(id)}`} style={{ color: 'white', textDecoration: 'none', fontSize: 14, opacity: 0.8 }}>
                    Series Details
                </Link>
            </header>

            {/* HLS Video Player */}
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                width: "100%",
                paddingTop: "60px",
                paddingBottom: "10px"
            }}>
                <video
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    style={{
                        width: "100%",
                        height: "100%",
                        maxHeight: "85vh",
                        objectFit: "contain",
                        boxShadow: "0 0 100px rgba(88, 101, 242, 0.15)",
                        background: "black"
                    }}
                />
            </div>

            {/* Cinematic Footer / Auto-Next */}
            <footer style={{
                padding: "20px",
                background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: 18 }}>{currentEpisode?.title || `Episode ${currentEpisode?.number}`}</h3>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                        Streaming via Sakura Engine
                    </p>
                </div>

                {nextEpisode && (
                    <Link
                        href={`/anime/watch?id=${encodeURIComponent(id)}&ep=${encodeURIComponent(nextEpisode.id)}`}
                        className="btn-primary"
                        style={{ background: 'rgba(88, 101, 242, 0.2)', border: '1px solid rgba(88, 101, 242, 0.4)' }}
                    >
                        Next Episode {"→"}
                    </Link>
                )}
            </footer>
        </main>
    );
}

export default function AnimeWatchPage() {
    return (
        <Suspense fallback={<div style={{ height: "100vh", display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white' }}>🌸 Buffering...</div>}>
            <AnimeWatchInner />
        </Suspense>
    );
}
