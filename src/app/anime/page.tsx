"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/Header";
import AnimeCard from "@/components/AnimeCard";
import { searchAnime, fetchAiringAnime, type AnimeResult } from "@/lib/anime";
import { getLocal, setLocal, STORAGE_KEYS } from "@/lib/storage";

// Debounce hook
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const MAX_RECENT_SEARCHES = 8;

export default function AnimeBrowsePage() {
    const [searchResults, setSearchResults] = useState<AnimeResult[]>([]);
    const [airingAnime, setAiringAnime] = useState<AnimeResult[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [airingLoading, setAiringLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const debouncedSearch = useDebounce(search, 800);

    // Recent searches
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [showRecent, setShowRecent] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Load airing anime on mount
    useEffect(() => {
        async function loadAiring() {
            setAiringLoading(true);
            try {
                const data = await fetchAiringAnime();
                setAiringAnime(data);
            } catch (e) {
                console.error("Failed to load airing anime", e);
            }
            setAiringLoading(false);
        }
        loadAiring();
    }, []);

    useEffect(() => {
        setRecentSearches(getLocal<string[]>(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", []));
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowRecent(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const saveRecentSearch = useCallback((query: string) => {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 2) return;
        const existing = getLocal<string[]>(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", []);
        const filtered = existing.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        setLocal(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", updated);
        setRecentSearches(updated);
    }, []);

    const removeRecentSearch = useCallback((query: string) => {
        const existing = getLocal<string[]>(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", []);
        const updated = existing.filter(s => s !== query);
        setLocal(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", updated);
        setRecentSearches(updated);
    }, []);

    const clearRecentSearches = useCallback(() => {
        setLocal(STORAGE_KEYS.RECENT_SEARCHES + "_ANIME", []);
        setRecentSearches([]);
    }, []);

    const fetchAnimeData = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const results = await searchAnime(query);
            setSearchResults(results);
            if (query.trim().length >= 2) saveRecentSearch(query);
        } catch (e: any) {
            console.error("Search failed", e);
            setError(e.message || "Search failed.");
        }
        setLoading(false);
    }, [saveRecentSearch]);

    useEffect(() => {
        fetchAnimeData(debouncedSearch);
    }, [debouncedSearch, fetchAnimeData]);

    const handleRecentClick = (query: string) => {
        setSearch(query);
        setShowRecent(false);
    };

    const isSearching = search.trim().length > 0;

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40 }}>
                    <div className="section-header">
                        <h2 className="section-title">アニメ一覧</h2>
                        <p className="section-subtitle">
                            {isSearching
                                ? (loading ? "Searching..." : `${searchResults.length} Results`)
                                : "Browse & Discover Anime"
                            }
                        </p>
                    </div>

                    {/* Search */}
                    <div className="search-bar-wrapper" ref={searchRef}>
                        <div className="search-bar" style={{ borderColor: "rgba(88, 101, 242, 0.4)" }}>
                            <span className="search-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(88, 101, 242, 1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>
                            </span>
                            <input
                                type="text"
                                placeholder="アニメを検索... Search anime..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setShowRecent(true)}
                            />
                            {search && (
                                <button className="search-clear" onClick={() => { setSearch(""); setShowRecent(true); }} aria-label="Clear">
                                    ✕
                                </button>
                            )}
                        </div>

                        {showRecent && recentSearches.length > 0 && !search && (
                            <div className="recent-searches">
                                <div className="recent-searches-header">
                                    <span className="recent-searches-title">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        Recent
                                    </span>
                                    <button className="recent-searches-clear" onClick={clearRecentSearches}>Clear All</button>
                                </div>
                                {recentSearches.map((q) => (
                                    <div key={q} className="recent-search-item">
                                        <button className="recent-search-text" onClick={() => handleRecentClick(q)}>{q}</button>
                                        <button className="recent-search-remove" onClick={(e) => { e.stopPropagation(); removeRecentSearch(q); }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="error-container" style={{ margin: "40px auto", maxWidth: 600 }}>
                            <p className="error-message">{error}</p>
                        </div>
                    )}

                    {/* Search Results */}
                    {isSearching && (
                        <>
                            {loading ? (
                                <div className="manga-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="loading-skeleton" style={{ aspectRatio: "2/3", borderRadius: "var(--radius-md)" }} />
                                    ))}
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="manga-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                                    {searchResults.map((anime) => (
                                        <AnimeCard key={anime.id} id={anime.id} title={anime.title} image={anime.image} type={anime.type} />
                                    ))}
                                </div>
                            ) : !error ? (
                                <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                                    <p style={{ fontFamily: "var(--font-jp)", fontSize: 18 }}>アニメが見つかりませんでした</p>
                                    <p style={{ fontSize: 14 }}>No results found.</p>
                                </div>
                            ) : null}
                        </>
                    )}

                    {/* Airing/Trending — shown when not searching */}
                    {!isSearching && (
                        <>
                            <div className="section-header" style={{ marginTop: 24 }}>
                                <h2 className="section-title" style={{ fontSize: 20 }}>🔥 放送中</h2>
                                <p className="section-subtitle">Currently Airing</p>
                            </div>

                            {airingLoading ? (
                                <div className="manga-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="loading-skeleton" style={{ aspectRatio: "2/3", borderRadius: "var(--radius-md)" }} />
                                    ))}
                                </div>
                            ) : airingAnime.length > 0 ? (
                                <div className="manga-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                                    {airingAnime.map((anime) => (
                                        <AnimeCard key={anime.id} id={anime.id} title={anime.title} image={anime.image} type={anime.type} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                                    <p style={{ fontSize: 14 }}>Could not load airing anime. Try searching instead.</p>
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
