"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAuthorDetails, getMangaByAuthor, type Manga } from "@/lib/mangadex";
import { getCreatorProfile, type CreatorProfile } from "@/lib/creator";
import MangaCard from "@/components/MangaCard";
import Link from "next/link";
import TipButton from "./TipButton";

function CreatorPageContent() {
    const searchParams = useSearchParams();
    const id = searchParams?.get("id");

    const [author, setAuthor] = useState<any>(null);
    const [creator, setCreator] = useState<CreatorProfile | null>(null);
    const [mangaList, setMangaList] = useState<Manga[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            setError("No creator ID provided.");
            return;
        }

        async function loadProfile() {
            setLoading(true);
            try {
                const [authorData, creatorData, worksData] = await Promise.all([
                    getAuthorDetails(id!),
                    getCreatorProfile(id!),
                    getMangaByAuthor(id!)
                ]);

                if (!authorData && !creatorData) {
                    setError("Creator not found.");
                } else {
                    setAuthor(authorData);
                    setCreator(creatorData);
                    setMangaList(worksData || []);
                }
            } catch (err: any) {
                console.error("Profile load error:", err);
                setError("Failed to load creator profile.");
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, [id]);

    if (loading) {
        return (
            <div className="page-container" style={{ paddingBottom: '100px', display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (error || (!author && !creator)) {
        return (
            <div className="page-container" style={{ paddingBottom: '100px', textAlign: 'center', paddingTop: '100px' }}>
                <h2 style={{ marginBottom: '16px' }}>{error || "Creator Not Found"}</h2>
                <Link href="/" className="btn-primary">Return Home</Link>
            </div>
        );
    }

    const displayName = creator?.display_name || author?.name || "Unknown Creator";
    const bio = creator?.bio || author?.biography || "No biography available.";
    const isVerified = creator?.is_verified === true;
    const avatarUrl = creator?.avatar_url || `https://robohash.org/${id}?set=set4&bgset=bg1`;

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            <div className="title-header" style={{ marginBottom: '20px' }}>
                <Link href="/" className="back-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </Link>
                <div className="title-header-text">Creator Profile</div>
                <div style={{ width: 40 }} />
            </div>

            <div className="creator-hero" style={{
                position: 'relative',
                borderRadius: '24px',
                padding: '30px',
                background: 'linear-gradient(135deg, rgba(255, 183, 197, 0.15) 0%, rgba(138, 43, 226, 0.15) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
                marginBottom: '40px'
            }}>
                <div style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid var(--sakura-pink)',
                            boxShadow: '0 8px 32px rgba(255, 183, 197, 0.3)'
                        }}
                    />
                    {isVerified && (
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            background: 'var(--sakura-pink)',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            border: '2px solid var(--bg-dark)'
                        }} title="Verified Creator">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                    )}
                </div>

                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {displayName}
                    </h1>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                        {author?.twitter && (
                            <a href={`https://twitter.com/${author.twitter}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
                            </a>
                        )}
                        {author?.pixiv && (
                            <a href={`https://www.pixiv.net/en/users/${author.pixiv}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            </a>
                        )}
                    </div>

                    <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
                        {bio}
                    </p>
                </div>

                {isVerified && creator?.wallet_address && (
                    <div style={{ marginTop: '10px' }}>
                        <TipButton receiverAddress={creator.wallet_address} />
                    </div>
                )}

                {!isVerified && id && (
                    <div style={{ marginTop: '10px' }}>
                        <Link href={`/creator/apply?authorId=${id}`} className="btn-secondary btn-sm" style={{ opacity: 0.8 }}>
                            Claim this profile
                        </Link>
                    </div>
                )}
            </div>

            <div className="section-header">
                <h2>Published Works</h2>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{mangaList.length} Series</span>
            </div>

            {mangaList.length > 0 ? (
                <div className="manga-grid">
                    {mangaList.map((manga) => (
                        <MangaCard
                            key={manga.id}
                            slug={manga.id}
                            title={manga.title}
                            cover={manga.cover}
                            genres={manga.tags}
                            follows={manga.follows}
                            rating={manga.rating}
                            source="mangadex"
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <p className="empty-text">No works found for this creator.</p>
                </div>
            )}
        </div>
    );
}

export default function CreatorPage() {
    return (
        <Suspense fallback={<div className="page-container" style={{ paddingBottom: '100px', display: 'flex', justifyContent: 'center', paddingTop: '100px' }}><div className="spinner" /></div>}>
            <CreatorPageContent />
        </Suspense>
    );
}
