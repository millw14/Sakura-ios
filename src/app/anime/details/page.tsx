"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { fetchAnimeInfo, getCachedAnimeInfo, refreshAnimeInfo, type AnimeInfo } from "@/lib/anime";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { getLocal, setLocal, STORAGE_KEYS } from "@/lib/storage";
import type { DownloadProgressEvent } from "@/plugins/anime";

interface AnimeDownloadEntry {
    episodeId: string;
    animeId: string;
    animeTitle: string;
    episodeTitle: string;
    episodeNumber: number;
    state: string;
    progress: number;
    filePath?: string;
    timestamp: number;
}

function AnimeDetailsInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get("id") || "";
    const isNative = Capacitor.isNativePlatform();

    const [anime, setAnime] = useState<AnimeInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dlMap, setDlMap] = useState<Record<string, AnimeDownloadEntry>>({});
    const listenerRef = useRef<{ remove: () => void } | null>(null);

    useEffect(() => {
        setDlMap(getLocal<Record<string, AnimeDownloadEntry>>(STORAGE_KEYS.ANIME_DOWNLOADS, {}));
    }, []);

    useEffect(() => {
        if (!isNative) return;
        let handle: { remove: () => void } | null = null;
        (async () => {
            const { Anime } = await import("@/plugins/anime");
            handle = await Anime.addListener("downloadProgress", (event: DownloadProgressEvent) => {
                setDlMap(prev => {
                    const updated = { ...prev };
                    if (updated[event.episodeId]) {
                        updated[event.episodeId] = { ...updated[event.episodeId], state: event.state, progress: event.progress };
                        if (event.filePath) updated[event.episodeId].filePath = event.filePath;
                    }
                    setLocal(STORAGE_KEYS.ANIME_DOWNLOADS, updated);
                    return updated;
                });
            });
            listenerRef.current = handle;
        })();
        return () => { handle?.remove(); };
    }, [isNative]);

    const handleDownload = useCallback(async (ep: { id: string; number: number; title: string }) => {
        if (!anime) return;
        const existing = dlMap[ep.id];
        if (existing?.state === 'downloading' || existing?.state === 'extracting') return;
        if (existing?.state === 'completed' && existing.filePath) {
            try {
                const { Anime } = await import("@/plugins/anime");
                await Anime.playLocalEpisode({ filePath: existing.filePath, title: ep.title || `Episode ${ep.number}` });
            } catch (e) { console.error(e); }
            return;
        }

        const entry: AnimeDownloadEntry = {
            episodeId: ep.id,
            animeId: id,
            animeTitle: anime.title,
            episodeTitle: ep.title || `Episode ${ep.number}`,
            episodeNumber: ep.number,
            state: 'extracting',
            progress: 0,
            timestamp: Date.now()
        };
        setDlMap(prev => {
            const updated = { ...prev, [ep.id]: entry };
            setLocal(STORAGE_KEYS.ANIME_DOWNLOADS, updated);
            return updated;
        });

        try {
            const { Anime } = await import("@/plugins/anime");
            const result = await Anime.downloadEpisode({
                episodeId: ep.id,
                title: ep.title || `Episode ${ep.number}`,
                animeTitle: anime.title
            });
            if (result.filePath) {
                setDlMap(prev => {
                    const updated = { ...prev };
                    if (updated[ep.id]) updated[ep.id] = { ...updated[ep.id], filePath: result.filePath!, state: 'completed', progress: 100 };
                    setLocal(STORAGE_KEYS.ANIME_DOWNLOADS, updated);
                    return updated;
                });
            }
        } catch (e: any) {
            console.error("Download failed:", e);
            setDlMap(prev => {
                const updated = { ...prev };
                if (updated[ep.id]) updated[ep.id] = { ...updated[ep.id], state: 'error', progress: 0 };
                setLocal(STORAGE_KEYS.ANIME_DOWNLOADS, updated);
                return updated;
            });
        }
    }, [anime, id, dlMap]);

    useEffect(() => {
        if (!id) return;

        const cached = getCachedAnimeInfo(id);
        if (cached) {
            setAnime(cached);
            setLoading(false);
            refreshAnimeInfo(id).then(fresh => {
                if (fresh) setAnime(fresh);
            }).catch(() => {});
            return;
        }

        setLoading(true);
        fetchAnimeInfo(id).then(data => {
            if (data) setAnime(data);
            else setError("Failed to resolve this Anime.");
        }).catch((e: any) => {
            setError(e.message || "Failed to load Anime details.");
        }).finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <>
                <Header />
                <main className="main-content" style={{ padding: 40, textAlign: "center", color: "white" }}>
                    <div className="spinner">🌸 Loading Anime...</div>
                </main>
            </>
        );
    }

    if (error || !anime) {
        return (
            <>
                <Header />
                <main className="main-content" style={{ padding: 40, textAlign: "center", color: "white" }}>
                    <h2>Error loading Anime</h2>
                    <p>{error}</p>
                    <button onClick={() => router.back()} className="btn-secondary" style={{ marginTop: 24 }}>
                        Go Back
                    </button>
                </main>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="main-content">
                {/* Hero Banner */}
                <div className="series-hero" style={{ position: 'relative' }}>
                    <button className="back-button" onClick={() => router.back()} aria-label="Go back" style={{
                        position: 'absolute', top: 20, left: 20, zIndex: 10,
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                        width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', cursor: 'pointer', backdropFilter: 'blur(10px)'
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>

                    <div className="series-hero-bg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={anime.image || "/sakura.png"} alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="series-hero-content">
                        <div className="series-cover">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={anime.image || "/sakura.png"} alt={anime.title} referrerPolicy="no-referrer" />
                        </div>
                        <div className="series-info">
                            <h1>{anime.title}</h1>

                            <div className="series-meta" style={{ marginBottom: 16 }}>
                                <span className={`status ${anime.status === 'Finished Airing' || anime.status === 'Completed' ? 'completed' : 'ongoing'}`}>
                                    {anime.status || "Ongoing"}
                                </span>
                                {anime.score && (
                                    <span style={{ color: '#facc15', fontSize: 13, fontWeight: 600 }}>
                                        ★ {anime.score}
                                    </span>
                                )}
                                {anime.episodes?.length > 0 && (
                                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                        {anime.episodes.length} Episodes
                                    </span>
                                )}
                            </div>

                            <p className="series-desc">
                                {anime.description
                                    ? anime.description.replace(/<[^>]+>/g, '')
                                    : "No description available."
                                }
                            </p>

                            <div className="series-actions">
                                {anime.episodes && anime.episodes.length > 0 && (
                                    <Link
                                        href={`/anime/watch?id=${encodeURIComponent(anime.id)}&ep=${encodeURIComponent(anime.episodes[0].id)}`}
                                        className="btn-primary"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }}>
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                        Watch Ep 1
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <section className="section" style={{ padding: "0 20px 40px" }}>
                    <div className="section-header" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border-color)" }}>
                        <h2 className="section-title" style={{ fontSize: 24 }}>エピソード Episodes</h2>
                        <span style={{ color: "var(--text-muted)" }}>{anime.episodes?.length || 0} Total</span>
                    </div>

                    <div className="chapters-list">
                        {anime.episodes && anime.episodes.length > 0 ? (
                            anime.episodes.map((ep) => {
                                const dl = dlMap[ep.id];
                                const isCompleted = dl?.state === 'completed';
                                const isActive = dl?.state === 'downloading' || dl?.state === 'extracting';
                                const pct = dl?.progress || 0;

                                return (
                                    <Link
                                        key={ep.id}
                                        href={`/anime/watch?id=${encodeURIComponent(anime.id)}&ep=${encodeURIComponent(ep.id)}`}
                                        className="chapter-item"
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <div className="chapter-item-left">
                                            <span className="chapter-number" style={{ width: 80, color: isCompleted ? '#4CAF50' : 'rgba(88, 101, 242, 1)' }}>
                                                Ep {ep.number}
                                            </span>
                                            <span className="chapter-title" style={{ color: 'white' }}>
                                                {ep.title || `Episode ${ep.number}`}
                                            </span>
                                            {isCompleted && (
                                                <span style={{ fontSize: 11, color: '#4CAF50', marginLeft: 8 }}>Offline</span>
                                            )}
                                        </div>
                                        <div className="chapter-item-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {isNative && (() => {
                                                if (isCompleted) {
                                                    return (
                                                        <button
                                                            className="dl-btn dl-completed"
                                                            title="Downloaded — tap to play offline"
                                                            onClick={(e) => { e.preventDefault(); handleDownload(ep); }}
                                                        >
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                        </button>
                                                    );
                                                }
                                                if (isActive) {
                                                    return (
                                                        <button className="dl-btn dl-active" title={`Downloading ${pct}%`} onClick={(e) => e.preventDefault()}>
                                                            <div className="dl-progress-circle" style={{ width: 28, height: 28, borderRadius: '50%', background: `conic-gradient(var(--sakura-pink) ${pct}%, rgba(255,255,255,0.1) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-primary, #1a1a2e)' }} />
                                                            </div>
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        className="dl-btn"
                                                        title="Download"
                                                        onClick={(e) => { e.preventDefault(); handleDownload(ep); }}
                                                    >
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                                    </button>
                                                );
                                            })()}
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                                        </div>
                                    </Link>
                                );
                            })
                        ) : (
                            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                No episodes found.
                            </div>
                        )}
                    </div>
                </section>

                <footer className="footer" style={{ marginTop: 0 }}>
                    <p className="footer-jp">桜 — マンガの新しい形</p>
                    <p className="footer-text">© 2026 Sakura. Read manga on the blockchain.</p>
                </footer>
            </main>
        </>
    );
}

export default function AnimeDetailsPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "white" }}>🌸 Loading...</div>}>
            <AnimeDetailsInner />
        </Suspense>
    );
}
