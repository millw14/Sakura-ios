"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { fetchAnimeInfo, type AnimeInfo } from "@/lib/anime";
import Link from "next/link";

function AnimeDetailsInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get("id") || "";

    const [anime, setAnime] = useState<AnimeInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchAnimeInfo(id);
                if (data) {
                    setAnime(data);
                } else {
                    setError("Failed to resolve this Anime.");
                }
            } catch (e: any) {
                setError(e.message || "Failed to load Anime details.");
            }
            setLoading(false);
        }
        if (id) {
            load();
        }
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
                            anime.episodes.map((ep) => (
                                <Link
                                    key={ep.id}
                                    href={`/anime/watch?id=${encodeURIComponent(anime.id)}&ep=${encodeURIComponent(ep.id)}`}
                                    className="chapter-item"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div className="chapter-item-left">
                                        <span className="chapter-number" style={{ width: 80, color: 'rgba(88, 101, 242, 1)' }}>
                                            Ep {ep.number}
                                        </span>
                                        <span className="chapter-title" style={{ color: 'white' }}>
                                            {ep.title || `Episode ${ep.number}`}
                                        </span>
                                    </div>
                                    <div className="chapter-item-right">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                                    </div>
                                </Link>
                            ))
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
