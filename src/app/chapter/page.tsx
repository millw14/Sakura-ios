"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { checkPassStatus, formatPassTimeRemaining } from "@/lib/pass-check";
import { getSource } from "@/lib/sources";
import { Browser } from '@capacitor/browser';

function ReaderContent() {
    const searchParams = useSearchParams();
    const chapterId = searchParams.get("id");
    const mangaId = searchParams.get("manga");
    const sourceStr = searchParams.get("source") || "weebcentral";

    const { publicKey } = useWallet();
    const { setVisible } = useWalletModal();

    const [pages, setPages] = useState<string[]>([]);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasAccess, setHasAccess] = useState<boolean | null>(null); // null = checking
    const [passExpiry, setPassExpiry] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPremiumChapter, setIsPremiumChapter] = useState(false);

    const [externalUrl, setExternalUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check Access & Fetch Content
    useEffect(() => {
        let isMounted = true;

        async function checkAccessAndLoad() {
            if (!chapterId) {
                if (isMounted) setError("No Chapter ID provided.");
                return;
            }

            try {
                setLoading(true);
                setError(null);
                setExternalUrl(null);

                const source = getSource(sourceStr);
                let requiresPass = false;

                // 1. Check Premium Status & External URL (only if mangaId exists)
                // For now, only MangaDex supports "Premium/Pass" logic in our app
                // WeebCentral and others are assumed free or we apply general rules later.
                if (sourceStr === 'mangadex' && mangaId) {
                    // Use dynamic import for source-specific logic if needed, or just use the source interface
                    // But our Premium logic is business logic ON TOP of the source.
                    // So we fetch the chapters to check "latest" status.

                    const [manga, chapters] = await Promise.all([
                        source.getMangaDetails(mangaId),
                        source.getChapters(mangaId, 100, 0)
                    ]);

                    // Find current chapter to check for external URL
                    const currentChapter = chapters.find(ch => ch.id === chapterId);
                    if ((currentChapter as any)?.externalUrl) {
                        if (isMounted) {
                            setExternalUrl((currentChapter as any).externalUrl);
                            setLoading(false);
                        }
                        return; // Stop loading here, we can't read it in-app
                    }

                    if (manga?.status === "ongoing") {
                        const latestChapters = chapters.slice(0, 3);
                        const isLatest = latestChapters.some(ch => ch.id === chapterId);
                        if (isLatest) requiresPass = true;
                    }
                }

                // 2. Check User Pass (Only if requiresPass is true)
                let userHasPass = false;
                if (requiresPass) {
                    setIsPremiumChapter(true); // Flag UI
                    if (publicKey) {
                        const status = await checkPassStatus(publicKey.toBase58());
                        userHasPass = status.valid;
                        if (status.expiresAt && isMounted) setPassExpiry(status.expiresAt);
                    }
                } else {
                    userHasPass = true;
                }

                if (isMounted) setHasAccess(userHasPass);

                // 3. Load Pages
                if (userHasPass) {
                    const urls = await source.getChapterPages(chapterId);
                    if (isMounted) {
                        if (urls.length > 0) {
                            setPages(urls);
                        } else {
                            throw new Error("No pages returned from Source.");
                        }
                    }
                }

            } catch (err: any) {
                console.error("Error loading chapter:", err);
                if (isMounted) setError(err.message || "Failed to load chapter.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        checkAccessAndLoad();

        return () => { isMounted = false; };
    }, [chapterId, mangaId, publicKey, sourceStr]);

    const handleScroll = useCallback(() => {
        const scrollY = window.scrollY;
        setHeaderVisible(scrollY < 100);

        const images = document.querySelectorAll(".reader-page");
        images.forEach((img, idx) => {
            const rect = img.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
                setCurrentPage(idx + 1);
            }
        });
    }, []);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    if (!chapterId) return null;

    if (error) {
        return (
            <div className="error-container" style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 16 }}>
                <h3>Error Loading Chapter</h3>
                <p style={{ color: "var(--love)", textAlign: "center", maxWidth: "80%" }}>{error}</p>
                <button className="btn-primary" onClick={() => window.location.reload()}>
                    Retry
                </button>
                <Link href={`/title?id=${mangaId}`} className="btn-secondary">
                    Back to Series
                </Link>
            </div>
        );
    }

    if (externalUrl) {
        return (
            <div className="pass-gate">
                <div className="pass-gate-content">
                    <div className="pass-gate-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" x2="21" y1="14" y2="3" />
                        </svg>
                    </div>
                    <div className="premium-badge">External Source</div>
                    <h2 style={{ fontFamily: "var(--font-jp)", fontSize: 24, marginBottom: 8 }}>
                        Official Source Only
                    </h2>
                    <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 16, textAlign: "center" }}>
                        This chapter is hosted on an official publisher's website (e.g., MangaPlus).
                        <br />It cannot be read inside Sakura.
                    </p>

                    <button
                        onClick={() => Browser.open({ url: externalUrl })}
                        className="btn-primary"
                        style={{ minWidth: 280, justifyContent: "center" }}
                    >
                        Read on Official Site (In-App)
                    </button>
                    <Link href={`/title?id=${mangaId}`} style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
                        ← Back to Series
                    </Link>
                </div>
            </div >
        );
    }

    // Pass gate screen
    if (loading) {
        return (
            <div className="reader">
                <div className="loading-container" style={{ height: "100vh" }}>
                    <div className="spinner" />
                    <p>Loading Chapter...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess && isPremiumChapter) {
        return (
            <div className="pass-gate">
                <div className="pass-gate-content">
                    <div className="pass-gate-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <div className="premium-badge">Sakura Premium</div>
                    <h2 style={{ fontFamily: "var(--font-jp)", fontSize: 28, marginBottom: 8 }}>
                        最新話はプレミアム限定です
                    </h2>
                    <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 8 }}>
                        This is one of the latest chapters. <br />
                        <strong>Sakura Premium</strong> is required to read it.
                    </p>
                    <div style={{ display: "flex", gap: 12, flexDirection: "column", alignItems: "center" }}>
                        <Link href="/pass" className="btn-primary" style={{ minWidth: 280, justifyContent: "center" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                            プレミアムに参加 — Get Premium ($10/mo)
                        </Link>

                        {!publicKey && (
                            <button
                                className="btn-secondary"
                                style={{ minWidth: 280, justifyContent: "center" }}
                                onClick={() => setVisible(true)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><circle cx="18" cy="16" r="1" /></svg>
                                ウォレット接続 — Connect Wallet
                            </button>
                        )}
                        <Link href={`/title?id=${mangaId}`} style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                            ← シリーズに戻る — Back to Series
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="reader">
            <div className={`reader-header ${headerVisible ? "" : "hidden"}`}>
                <Link href={`/title?id=${mangaId}&source=${sourceStr}`} className="reader-back">
                    ← 戻る Back
                </Link>
                <span className="reader-title">
                    Chapter Viewer
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {passExpiry && (
                        <span style={{ fontSize: 11, color: "#4ade80" }}>
                            🎴 {formatPassTimeRemaining(passExpiry)}
                        </span>
                    )}
                    <span className="reader-progress">
                        {currentPage} / {pages.length} ページ
                    </span>
                </div>
            </div>

            <div className="reader-pages">
                {pages.map((pageUrl, idx) => (
                    <div key={idx} className="reader-page">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={pageUrl}
                            alt={`Page ${idx + 1}`}
                            loading={idx < 3 ? "eager" : "lazy"}
                        />
                    </div>
                ))}
            </div>

            {pages.length > 0 && (
                <div className="reader-end">
                    <h3>おわり — End of Chapter</h3>
                    <Link href={`/title?id=${mangaId}&source=${sourceStr}`} className="btn-primary">
                        ← シリーズに戻る — Back to Series
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function ReaderPage() {
    return (
        <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
            <ReaderContent />
        </Suspense>
    );
}
