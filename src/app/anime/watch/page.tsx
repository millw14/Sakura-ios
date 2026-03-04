"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchEpisodeSources, type StreamingSource, fetchAnimeInfo, type AnimeInfo } from "@/lib/anime";
import Link from "next/link";

function AnimeWatchInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get("id") || "";
    const episodeId = searchParams.get("ep") || "";

    const [anime, setAnime] = useState<AnimeInfo | null>(null);
    const [source, setSource] = useState<StreamingSource | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load anime meta and video sources
    useEffect(() => {
        async function load() {
            setLoading(true);
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

    // Find current episode and next episode for auto-next logic
    const currentEpisodeIndex = anime?.episodes.findIndex(e => e.id === episodeId) ?? -1;
    const currentEpisode = currentEpisodeIndex >= 0 ? anime?.episodes[currentEpisodeIndex] : null;
    const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < (anime?.episodes.length || 0) - 1
        ? anime?.episodes[currentEpisodeIndex + 1]
        : null;

    if (loading) {
        return (
            <main className="cinema-page" style={{ height: "100vh", display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <div className="spinner" style={{ color: "var(--sakura-pink)" }}>🌸 Buffering Stream...</div>
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

            {/* Video Player Container */}
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
                {source?.isIframe ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                        <div style={{
                            padding: 24,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 16,
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center',
                            maxWidth: 400
                        }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, color: 'white' }}>Stream Ready</h3>
                            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-muted)' }}>
                                This episode uses a premium external stream. Tap below to launch the native embedded video player.
                            </p>

                            <button
                                onClick={async () => {
                                    const { Browser } = await import('@capacitor/browser');
                                    await Browser.open({ url: source.url, presentationStyle: 'fullscreen', windowName: '_blank' });
                                }}
                                style={{
                                    background: 'var(--sakura-pink)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '14px 32px',
                                    borderRadius: 30,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    boxShadow: '0 8px 24px rgba(255, 107, 158, 0.4)'
                                }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                Open Native Player
                            </button>
                        </div>
                    </div>
                ) : (
                    <video
                        controls
                        autoPlay
                        src={source?.url}
                        style={{
                            width: "100%",
                            height: "100%",
                            maxHeight: "85vh",
                            objectFit: "contain",
                            boxShadow: "0 0 100px rgba(88, 101, 242, 0.15)",
                            background: "black"
                        }}
                    />
                )}
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
