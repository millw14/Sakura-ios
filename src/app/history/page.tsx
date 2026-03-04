"use client";

import Header from "@/components/Header";
import MangaCard from "@/components/MangaCard";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getLocal, STORAGE_KEYS } from "@/lib/storage";

interface HistoryItem {
    mangaId: string;
    chapterId: string;
    title: string;
    cover: string;
    lastReadAt: number;
    chapterNum?: string;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cached = getLocal<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
        // Sort by lastReadAt desc
        setHistory(cached.sort((a, b) => b.lastReadAt - a.lastReadAt));
        setLoading(false);
    }, []);

    const clearHistory = () => {
        if (confirm("Clear history?")) {
            const { removeLocal } = require("@/lib/storage");
            removeLocal(STORAGE_KEYS.HISTORY);
            setHistory([]);
        }
    }

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40 }}>
                    <div className="section-header">
                        <h2 className="section-title">閲覧履歴 History</h2>
                        <p className="section-subtitle">Recently Read Manga</p>
                    </div>

                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📖</div>
                            <h3 className="empty-title">履歴がありません</h3>
                            <p className="empty-text">You haven&apos;t read any manga yet.</p>
                            <Link href="/manga" className="btn-primary" style={{ marginTop: 16 }}>
                                マンガを探す — Start Reading
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                                <button onClick={clearHistory} className="btn-secondary" style={{ fontSize: 12 }}>Clear History</button>
                            </div>
                            <div className="manga-grid">
                                {history.map((item) => (
                                    <MangaCard
                                        key={item.mangaId}
                                        slug={item.mangaId}
                                        title={item.title}
                                        cover={item.cover}
                                        genres={[]}
                                        follows={0}
                                        rating={0}
                                        source="mangadex"
                                    />
                                ))}
                            </div>
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
