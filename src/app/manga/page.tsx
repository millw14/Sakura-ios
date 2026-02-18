"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import MangaCard from "@/components/MangaCard";
import { searchAllSources } from "@/lib/sources";
import { type Manga } from "@/lib/sources/types";

// Debounce hook for search
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function BrowsePage() {
    const [mangaList, setMangaList] = useState<Manga[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const debouncedSearch = useDebounce(search, 500);

    const fetchManga = useCallback(async (query: string) => {
        setLoading(true);
        try {
            // Use multi-source search
            const results = await searchAllSources(query);
            setMangaList(results);

            // Fetch stats (ratings) only for MangaDex items (WeebCentral doesn't have reliable stats API yet)
            // We can optimize this later
            const mangadexIds = results.filter(m => m.sourceStr === 'mangadex').map(m => m.id);
            if (mangadexIds.length > 0) {
                const { getMangaStatistics } = await import("@/lib/mangadex");
                const stats = await getMangaStatistics(mangadexIds);
                setMangaList(prev => prev.map(m => {
                    if (m.sourceStr !== 'mangadex') return m;
                    const stat = stats[m.id];
                    return {
                        ...m,
                        rating: stat?.rating?.average,
                        follows: stat?.follows
                    };
                }));
            }
        } catch (e) {
            console.error("Search failed", e);
        }
        setLoading(false);
    }, []);

    // Initial load & Search effect
    useEffect(() => {
        fetchManga(debouncedSearch);
    }, [debouncedSearch, fetchManga]);

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40 }}>
                    <div className="section-header">
                        <h2 className="section-title">マンガ一覧</h2>
                        <p className="section-subtitle">Browse Series — {loading ? "Loading..." : `${mangaList.length} Results`}</p>
                    </div>

                    {/* Search */}
                    <div className="search-bar">
                        <span className="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg></span>
                        <input
                            type="text"
                            placeholder="マンガを検索... Search for your favorite manga..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Grid */}
                    {loading ? (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: 24,
                                maxWidth: 1400,
                                margin: "0 auto",
                            }}
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="loading-skeleton"
                                    style={{ aspectRatio: "2/3", borderRadius: "var(--radius-md)" }}
                                />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="manga-grid">
                                {mangaList.map((manga) => (
                                    <MangaCard
                                        key={manga.id}
                                        slug={manga.id} // We use ID as slug now
                                        title={manga.title}
                                        cover={manga.cover}
                                        genres={manga.tags.slice(0, 3)}
                                        follows={manga.follows}
                                        rating={manga.rating}
                                        source={manga.sourceStr}
                                    />
                                ))}
                            </div>
                            {mangaList.length === 0 && !loading && (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: 60,
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    <div style={{ fontSize: 48, marginBottom: 16 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="var(--sakura-pink)" stroke="none" opacity="0.5"><path d="M12 2C9.5 5 7 8 7 11a5 5 0 0 0 10 0c0-3-2.5-6-5-9z" /></svg></div>
                                    <p style={{ fontFamily: "var(--font-jp)", fontSize: 18 }}>
                                        見つかりませんでした
                                    </p>
                                    <p style={{ fontSize: 14 }}>No manga found.</p>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <footer className="footer">
                    <p className="footer-jp">桜 — マンガの新しい形</p>
                    <p className="footer-text">© 2026 Sakura. Read manga on the blockchain.</p>
                    <div className="footer-solana">
                        <span className="sol-dot" />
                        Built on Solana
                    </div>
                </footer>
            </main>
        </>
    );
}
