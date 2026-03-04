"use client";

import Header from "@/components/Header";
import MangaCard from "@/components/MangaCard";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getFeaturedManga, searchManga, type Manga } from "@/lib/mangadex";
import { useRouter } from "next/navigation";
import { getLocal, setLocal, STORAGE_KEYS } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const [featured, setFeatured] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimerRef = useRef<any>(null);

  useEffect(() => {
    async function loadFeatured() {
      const data = await getFeaturedManga();
      setFeatured(data);
      setLoading(false);
    }
    loadFeatured();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    setShowSearch(true);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchManga(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      }
      setSearching(false);
    }, 600);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  return (
    <>
      <Header />
      <main className="main-content">
        {/* Compact Hero Banner */}
        <section className="home-hero-compact">
          <div className="home-hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sakura.png" alt="Sakura" className="home-hero-logo" />
            <div className="home-hero-text">
              <h1>桜 <span>Sakura</span></h1>
              <p>読む。集める。所有する。— Read. Collect. Own.</p>
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <section className="section" style={{ paddingTop: 8, paddingBottom: 0 }}>
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>
            </span>
            <input
              type="text"
              placeholder="マンガを検索... Search manga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Search Results (conditionally shown) */}
        {showSearch && (
          <section className="section" style={{ paddingTop: 12 }}>
            <div className="section-header">
              <h2 className="section-title">検索結果</h2>
              <p className="section-subtitle">{searching ? "Searching..." : `${searchResults.length} Results`}</p>
            </div>
            {searching ? (
              <div className="manga-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="loading-skeleton" style={{ aspectRatio: "2/3", borderRadius: "var(--radius-md)" }} />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="manga-grid">
                {searchResults.map((series) => (
                  <MangaCard
                    key={series.id}
                    slug={series.id}
                    title={series.title}
                    cover={series.cover}
                    genres={series.tags.slice(0, 3)}
                    follows={series.follows}
                    rating={series.rating}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </section>
        )}

        {/* Recommended Manga — Main Focus (Hidden during search) */}
        {!showSearch && (
          <section className="section" style={{ paddingTop: 12 }}>
            <div className="section-header">
              <h2 className="section-title">おすすめ</h2>
              <p className="section-subtitle">Recommended For You</p>
            </div>

            {loading ? (
              <div className="manga-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="loading-skeleton"
                    style={{ aspectRatio: "2/3", borderRadius: "var(--radius-md)" }}
                  />
                ))}
              </div>
            ) : (
              <div className="manga-grid">
                {featured.map((series) => (
                  <MangaCard
                    key={series.id}
                    slug={series.id}
                    title={series.title}
                    cover={series.cover}
                    genres={series.tags.slice(0, 3)}
                    follows={series.follows}
                    rating={series.rating}
                  />
                ))}
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Link href="/manga" className="btn-secondary">
                全てのマンガを見る — View All Manga →
              </Link>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <p className="footer-jp">桜 — マンガの新しい形</p>
          <p className="footer-text">
            © 2026 Sakura. Read manga on the blockchain.
          </p>
          <div className="footer-solana">
            <span className="sol-dot" />
            Built on Solana
          </div>
        </footer>
      </main>
    </>
  );
}
