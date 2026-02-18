"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { getSource } from "@/lib/sources";
import { type Manga, type Chapter } from "@/lib/sources/types";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getFavorites, addFavorite, removeFavorite } from "@/lib/supabase";

function FavoriteButton({ manga }: { manga: Manga }) {
    const { publicKey } = useWallet();
    const { setVisible } = useWalletModal();
    const [isFav, setIsFav] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (publicKey) {
            getFavorites(publicKey.toBase58()).then(favs => {
                setIsFav(favs.some(f => f.manga_id === manga.id));
            });
        } else {
            setIsFav(false);
        }
    }, [publicKey, manga.id]);

    const toggleFavorite = async () => {
        if (!publicKey) {
            setVisible(true);
            return;
        }

        setLoading(true);
        if (isFav) {
            await removeFavorite(publicKey.toBase58(), manga.id);
            setIsFav(false);
        } else {
            await addFavorite(publicKey.toBase58(), {
                id: manga.id,
                title: manga.title,
                cover: manga.cover
            });
            setIsFav(true);
        }
        setLoading(false);
    };

    return (
        <button
            onClick={toggleFavorite}
            className="btn-secondary"
            disabled={loading}
            style={{ color: isFav ? "var(--sakura-pink)" : "currentColor" }}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.28 3.6-2.34 3.6-4.44a5.15 5.15 0 0 0-3-4.44c-2.96-1.5-6.1.45-6.1.45S10.23 3.6 7.4 5.12c-1.8.92-3.4 2.37-3.4 4.44C4 11.66 6.1 12.72 7.6 14a16.84 16.84 0 0 0 4.4 3.6 16.8 16.8 0 0 0 4-3.6z" /></svg>
            {loading ? "Saving..." : (isFav ? "お気に入り Saved" : "お気に入り Favorite")}
        </button>
    );
}

function SeriesContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id"); // Series ID
    const sourceStr = searchParams.get("source") || "weebcentral";

    const [series, setSeries] = useState<Manga | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        async function loadData() {
            setLoading(true);
            try {
                const source = getSource(sourceStr);
                const [mangaData, chaptersData] = await Promise.all([
                    source.getMangaDetails(id!),
                    source.getChapters(id!)
                ]);
                setSeries(mangaData);
                setChapters(chaptersData);
            } catch (error) {
                console.error("Failed to load series:", error);
            }
            setLoading(false);
        }

        loadData();
    }, [id, sourceStr]);

    if (!id) {
        return (
            <div className="error-container">
                <p>Invalid Series ID.</p>
                <Link href="/manga" className="btn-primary">Back to Browse</Link>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <p>Loading Series...</p>
            </div>
        );
    }

    if (!series) {
        return (
            <div className="error-container">
                <p>Manga not found.</p>
                <Link href="/manga" className="btn-primary">Back to Browse</Link>
            </div>
        );
    }

    return (
        <main className="main-content">
            {/* Hero Banner */}
            <div className="series-hero">
                <div className="series-hero-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={series.cover} alt="" />
                </div>
                <div className="series-hero-content">
                    <div className="series-cover">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={series.cover} alt={series.title} />
                    </div>
                    <div className="series-info">
                        <h1>{series.title}</h1>
                        <div className="genre-tags">
                            {series.tags.map((g) => (
                                <span key={g} className="genre-tag">{g}</span>
                            ))}
                        </div>
                        <p className="series-synopsis">{series.description.slice(0, 300)}...</p>
                        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                            <div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--sakura-pink)" }}>
                                    {chapters.length}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                                    章 Chapters
                                </span>
                            </div>
                            <div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: "var(--purple-accent)" }}>
                                    {series.year || "Unknown"}
                                </span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                                    Year
                                </span>
                            </div>
                        </div>
                        <div className="series-actions">
                            {chapters.length > 0 && (
                                <Link
                                    href={`/chapter?id=${chapters[chapters.length - 1].id}&manga=${id}&source=${sourceStr}`} // Pass manga ID for back link
                                    className="btn-primary"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg> 読む — Read First
                                </Link>
                            )}
                            <FavoriteButton manga={series} />
                            <Link href="/pass" className="btn-secondary">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg> 週間パス — Get Pass
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chapter List */}
            <div className="chapter-list">
                <div className="chapter-list-header">
                    <h2 className="chapter-list-title">
                        Chapters <span className="jp">チャプター一覧</span>
                    </h2>
                </div>

                {chapters.map((chapter) => (
                    <Link
                        key={chapter.id}
                        href={`/chapter?id=${chapter.id}&manga=${id}&source=${sourceStr}`}
                        className="chapter-item"
                    >
                        <div className="chapter-item-left">
                            <span className="chapter-number">
                                Vol.{chapter.volume} Ch.{chapter.chapter}
                            </span>
                            <div>
                                <div className="chapter-title">
                                    {chapter.title || `Chapter ${chapter.chapter}`}
                                </div>
                                <div className="chapter-pages">
                                    {new Date(chapter.publishAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        <span className="chapter-read-btn">読む Read</span>
                    </Link>
                ))}
            </div>

            <footer className="footer">
                <p className="footer-jp">桜 — マンガの新しい形</p>
                <p className="footer-text">© 2026 Sakura. Read manga on the blockchain.</p>
                <div className="footer-solana">
                    <span className="sol-dot" />
                    Built on Solana
                </div>
            </footer>
        </main>
    );
}

export default function SeriesPage() {
    return (
        <>
            <Header />
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
                <SeriesContent />
            </Suspense>
        </>
    );
}
