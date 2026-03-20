"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import {
    getLibraryCategories,
    removeFromLibrary,
    deleteLibraryCategory,
    type LibraryCategory,
    type LibraryItem,
} from "@/lib/storage";

export default function LibraryPage() {
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [activeTab, setActiveTab] = useState(0);

    const reload = useCallback(() => {
        const cats = getLibraryCategories();
        setCategories(cats);
        if (activeTab >= cats.length) setActiveTab(0);
    }, [activeTab]);

    useEffect(() => { reload(); }, [reload]);

    const activeCat = categories[activeTab];

    const handleRemoveItem = (item: LibraryItem) => {
        if (!activeCat) return;
        removeFromLibrary(activeCat.name, item.id, item.type);
        reload();
    };

    const handleDeleteCategory = (name: string) => {
        deleteLibraryCategory(name);
        setActiveTab(0);
        reload();
    };

    const allItems = categories.flatMap(c => c.items);
    const uniqueAll = allItems.filter((item, idx, arr) =>
        arr.findIndex(i => i.id === item.id && i.type === item.type) === idx
    );

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40 }}>
                    <div className="section-header">
                        <h2 className="section-title">ライブラリ</h2>
                        <p className="section-subtitle">Your Library</p>
                    </div>

                    {/* Category Tabs */}
                    <div className="genre-filters" style={{ maxWidth: 700, margin: "0 auto 24px" }}>
                        <button
                            className={`genre-chip ${activeTab === -1 ? "active" : ""}`}
                            onClick={() => setActiveTab(-1)}
                        >
                            All ({uniqueAll.length})
                        </button>
                        {categories.map((cat, idx) => (
                            <button
                                key={cat.name}
                                className={`genre-chip ${activeTab === idx ? "active" : ""}`}
                                onClick={() => setActiveTab(idx)}
                            >
                                {cat.name} ({cat.items.length})
                            </button>
                        ))}
                    </div>

                    {/* Delete Category Button */}
                    {activeTab >= 0 && activeCat && activeCat.name !== "Default" && (
                        <div style={{ textAlign: "center", marginBottom: 16 }}>
                            <button
                                onClick={() => handleDeleteCategory(activeCat.name)}
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-muted)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    opacity: 0.7,
                                }}
                            >
                                Delete &quot;{activeCat.name}&quot; category
                            </button>
                        </div>
                    )}

                    {/* Items Grid */}
                    {(() => {
                        const items = activeTab === -1 ? uniqueAll : (activeCat?.items || []);
                        if (items.length === 0) {
                            return (
                                <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 16 }}>
                                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                    </svg>
                                    <p style={{ fontFamily: "var(--font-jp)", fontSize: 18 }}>まだ何もありません</p>
                                    <p style={{ fontSize: 14, marginTop: 4 }}>No items in this category yet.</p>
                                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
                                        <Link href="/manga" className="genre-chip active" style={{ textDecoration: "none" }}>
                                            Browse Manga
                                        </Link>
                                        <Link href="/anime" className="genre-chip active" style={{ textDecoration: "none" }}>
                                            Browse Anime
                                        </Link>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div className="manga-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                                {items.map((item) => {
                                    const href = item.type === "anime"
                                        ? `/anime/details?id=${encodeURIComponent(item.id)}`
                                        : `/title?id=${encodeURIComponent(item.id)}&source=mangadex`;

                                    return (
                                        <div key={`${item.type}-${item.id}`} style={{ position: "relative" }}>
                                            <Link href={href} className="manga-card" style={{ display: "block" }}>
                                                <div className="manga-card-cover">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={item.image || "/sakura.png"}
                                                        alt={item.title}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <span className="manga-card-badge" style={{
                                                        background: item.type === "anime"
                                                            ? "rgba(88, 101, 242, 0.85)"
                                                            : "rgba(255, 107, 157, 0.85)",
                                                    }}>
                                                        {item.type === "anime" ? "Anime" : "Manga"}
                                                    </span>
                                                </div>
                                                <div className="manga-card-info">
                                                    <h3 className="manga-card-title">{item.title}</h3>
                                                </div>
                                            </Link>
                                            {activeTab >= 0 && (
                                                <button
                                                    onClick={() => handleRemoveItem(item)}
                                                    title="Remove from category"
                                                    style={{
                                                        position: "absolute",
                                                        top: 8,
                                                        left: 8,
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: "50%",
                                                        background: "rgba(0,0,0,0.6)",
                                                        backdropFilter: "blur(8px)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "var(--text-muted)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        cursor: "pointer",
                                                        zIndex: 5,
                                                        fontSize: 14,
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
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
