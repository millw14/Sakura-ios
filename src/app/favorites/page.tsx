"use client";

import Header from "@/components/Header";
import MangaCard from "@/components/MangaCard";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getFavorites, type FavoriteManga } from "@/lib/supabase";

export default function FavoritesPage() {
    const { publicKey } = useWallet();
    const { setVisible } = useWalletModal();
    const [favorites, setFavorites] = useState<FavoriteManga[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFavorites() {
            if (!publicKey) {
                setFavorites([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const data = await getFavorites(publicKey.toBase58());
            setFavorites(data);
            setLoading(false);
        }

        fetchFavorites();
    }, [publicKey]);

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40 }}>
                    <div className="section-header">
                        <h2 className="section-title">お気に入り Favorites</h2>
                        <p className="section-subtitle">Your Cloud Collection</p>
                    </div>

                    {!publicKey ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <h3 className="empty-title">ウォレットを接続</h3>
                            <p className="empty-text">Connect your wallet to see your cloud favorites.</p>
                            <button
                                className="btn-primary"
                                onClick={() => setVisible(true)}
                                style={{ marginTop: 16 }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><circle cx="18" cy="16" r="1" /></svg>
                                Connect Wallet
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                        </div>
                    ) : favorites.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💔</div>
                            <h3 className="empty-title">まだありません</h3>
                            <p className="empty-text">You haven&apos;t added any manga to favorites yet.</p>
                            <Link href="/manga" className="btn-primary" style={{ marginTop: 16 }}>
                                マンガを探す — Browse Manga
                            </Link>
                        </div>
                    ) : (
                        <div className="manga-grid">
                            {favorites.map((fav) => (
                                <MangaCard
                                    key={fav.manga_id}
                                    slug={fav.manga_id}
                                    title={fav.title}
                                    cover={fav.cover_url}
                                    genres={[]} // Favorites from DB might not have genres, handled gracefully
                                    follows={0} // Placeholder
                                    rating={0}  // Placeholder
                                />
                            ))}
                        </div>
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
