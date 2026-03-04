"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { truncateAddress } from "@/lib/solana";
import { getPublicProfile, type UserProfile, type ProfileStats } from "@/lib/comments";
import Link from "next/link";

/* ─── Otaku Level System ─── */
const LEVELS = [
    { min: 0, name: "新人 Rookie", emoji: "🌱", color: "#6ee7b7" },
    { min: 5, name: "読者 Reader", emoji: "📖", color: "#93c5fd" },
    { min: 15, name: "オタク Otaku", emoji: "⭐", color: "#c084fc" },
    { min: 30, name: "マニア Maniac", emoji: "🔥", color: "#fb923c" },
    { min: 50, name: "師範 Sensei", emoji: "🎌", color: "#f472b6" },
    { min: 100, name: "漫画家 Mangaka", emoji: "👑", color: "#fbbf24" },
];

function getLevel(chaptersRead: number) {
    let level = LEVELS[0];
    for (const l of LEVELS) {
        if (chaptersRead >= l.min) level = l;
    }
    const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
    const progress = nextLevel
        ? ((chaptersRead - level.min) / (nextLevel.min - level.min)) * 100
        : 100;
    return { ...level, progress: Math.min(progress, 100), nextLevel };
}

/* ─── Achievements ─── */
interface Achievement {
    id: string;
    name: string;
    desc: string;
    emoji: string;
    earned: boolean;
}

function computeAchievements(stats: ProfileStats, hasPass: boolean): Achievement[] {
    return [
        {
            id: "first-read",
            name: "初読み First Read",
            desc: "Read your first chapter",
            emoji: "📖",
            earned: stats.chaptersRead >= 1,
        },
        {
            id: "bookworm",
            name: "本の虫 Bookworm",
            desc: "Read 10+ chapters",
            emoji: "📚",
            earned: stats.chaptersRead >= 10,
        },
        {
            id: "social",
            name: "社交的 Social",
            desc: "Post your first comment",
            emoji: "💬",
            earned: stats.commentsPosted >= 1,
        },
        {
            id: "popular",
            name: "人気者 Popular",
            desc: "Receive 5+ reactions",
            emoji: "✨",
            earned: stats.reactionsReceived >= 5,
        },
        {
            id: "collector",
            name: "収集家 Collector",
            desc: "Add 5+ favorites",
            emoji: "💎",
            earned: stats.favoritesCount >= 5,
        },
        {
            id: "pass-holder",
            name: "桜メンバー Sakura Member",
            desc: "Own a Monthly Pass",
            emoji: "🌸",
            earned: hasPass,
        },
        {
            id: "otaku",
            name: "オタク Otaku",
            desc: "Read 15+ chapters",
            emoji: "⭐",
            earned: stats.chaptersRead >= 15,
        },
        {
            id: "chatterbox",
            name: "おしゃべり Chatterbox",
            desc: "Post 10+ comments",
            emoji: "🎤",
            earned: stats.commentsPosted >= 10,
        },
    ];
}

/* ─── Stat Card ─── */
function StatCard({ value, label, emoji }: { value: number | string; label: string; emoji: string }) {
    return (
        <div className="stat-card">
            <span className="stat-emoji">{emoji}</span>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}

/* ─── Profile Content ─── */
function ProfileContent() {
    const searchParams = useSearchParams();
    const walletAddress = searchParams.get("wallet");

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [favorites, setFavorites] = useState<{ manga_id: string; title: string; cover_url: string }[]>([]);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!walletAddress) return;
        async function load() {
            setLoading(true);
            const data = await getPublicProfile(walletAddress!);
            setProfile(data.profile);
            setFavorites(data.favorites);
            setStats(data.stats);
            setLoading(false);
        }
        load();
    }, [walletAddress]);

    if (!walletAddress) {
        return (
            <>
                <Header />
                <main className="main-content">
                    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                        <p>No wallet specified.</p>
                    </div>
                </main>
            </>
        );
    }

    const displayName = profile?.display_name || truncateAddress(walletAddress);
    const avatarHue = hashCode(walletAddress) % 360;
    const level = getLevel(stats?.chaptersRead || 0);
    const achievements = computeAchievements(
        stats || { chaptersRead: 0, commentsPosted: 0, reactionsReceived: 0, favoritesCount: 0, memberSince: null },
        profile?.has_pass || false
    );
    const earnedCount = achievements.filter(a => a.earned).length;

    return (
        <>
            <Header />
            <main className="main-content">
                <section className="section" style={{ paddingTop: 40, maxWidth: 800, margin: "0 auto" }}>
                    {loading ? (
                        <div className="profile-loading">
                            <div className="swm-spinner" />
                            <span>Loading profile...</span>
                        </div>
                    ) : (
                        <>
                            {/* ═══ Hero Card ═══ */}
                            <div className="profile-hero" style={{ '--hero-hue': avatarHue } as React.CSSProperties}>
                                <div className="profile-hero-glow" />
                                <div className="profile-hero-content">
                                    <div
                                        className="profile-avatar-lg"
                                        style={{ background: `linear-gradient(135deg, hsl(${avatarHue}, 70%, 55%), hsl(${(avatarHue + 40) % 360}, 60%, 45%))` }}
                                    >
                                        {displayName[0].toUpperCase()}
                                    </div>
                                    <div className="profile-hero-info">
                                        <h1 className="profile-hero-name">
                                            {displayName}
                                            {profile?.has_pass && <span className="pass-badge-lg" title="Pass Holder">🌸</span>}
                                        </h1>
                                        <p className="profile-hero-wallet">{truncateAddress(walletAddress)}</p>
                                        {profile?.bio && (
                                            <p className="profile-hero-bio">{profile.bio}</p>
                                        )}
                                        {stats?.memberSince && (
                                            <p className="profile-member-since">
                                                Member since {new Date(stats.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Level Badge */}
                                <div className="level-badge" style={{ borderColor: level.color }}>
                                    <span className="level-emoji">{level.emoji}</span>
                                    <span className="level-name" style={{ color: level.color }}>{level.name}</span>
                                    {level.nextLevel && (
                                        <div className="level-progress-bar">
                                            <div
                                                className="level-progress-fill"
                                                style={{ width: `${level.progress}%`, background: level.color }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ═══ Stats Grid ═══ */}
                            <div className="stats-grid">
                                <StatCard value={stats?.chaptersRead || 0} label="Chapters Read" emoji="📖" />
                                <StatCard value={stats?.commentsPosted || 0} label="Comments" emoji="💬" />
                                <StatCard value={stats?.reactionsReceived || 0} label="Reactions" emoji="✨" />
                                <StatCard value={stats?.favoritesCount || 0} label="Favorites" emoji="❤️" />
                            </div>

                            {/* ═══ Achievements ═══ */}
                            <div className="profile-section">
                                <h2 className="profile-section-title">
                                    実績 Achievements
                                    <span className="profile-count">{earnedCount}/{achievements.length}</span>
                                </h2>
                                <div className="achievements-grid">
                                    {achievements.map(a => (
                                        <div key={a.id} className={`achievement-card ${a.earned ? "earned" : "locked"}`}>
                                            <span className="achievement-emoji">{a.emoji}</span>
                                            <span className="achievement-name">{a.name}</span>
                                            <span className="achievement-desc">{a.desc}</span>
                                            {!a.earned && <div className="achievement-lock">🔒</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ═══ Favorites ═══ */}
                            <div className="profile-section">
                                <h2 className="profile-section-title">
                                    お気に入り Favorites
                                    {favorites.length > 0 && <span className="profile-count">{favorites.length}</span>}
                                </h2>
                                {favorites.length === 0 ? (
                                    <div className="profile-empty">
                                        <p>No public favorites yet.</p>
                                    </div>
                                ) : (
                                    <div className="profile-favorites-grid">
                                        {favorites.map(fav => (
                                            <Link
                                                key={fav.manga_id}
                                                href={`/title?id=${fav.manga_id}&source=mangadex`}
                                                className="profile-fav-card"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={fav.cover_url} alt={fav.title} className="profile-fav-cover" referrerPolicy="no-referrer" />
                                                <span className="profile-fav-title">{fav.title}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
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

export default function ProfilePage() {
    return (
        <Suspense fallback={<div style={{ textAlign: "center", padding: 60 }}>Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}
