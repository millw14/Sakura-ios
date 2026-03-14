"use client";

import Header from "@/components/Header";
import Link from "next/link";
import { useDownloads, downloadManager } from "@/lib/downloads";
import { useMemo, useState, useEffect } from "react";
import { getLocal, setLocal, STORAGE_KEYS } from "@/lib/storage";

interface AnimeDownloadEntry {
    episodeId: string;
    animeId: string;
    animeTitle: string;
    episodeTitle: string;
    episodeNumber: number;
    state: string;
    progress: number;
    timestamp: number;
}

function useAnimeDownloads() {
    const [data, setData] = useState<Record<string, AnimeDownloadEntry>>({});
    useEffect(() => {
        setData(getLocal<Record<string, AnimeDownloadEntry>>(STORAGE_KEYS.ANIME_DOWNLOADS, {}));
    }, []);
    return data;
}

export default function DownloadsPage() {
    const downloads = useDownloads();
    const animeDownloads = useAnimeDownloads();

    // Group downloads by Manga
    const groupedDownloads = useMemo(() => {
        const groups: Record<string, typeof downloads[string][]> = {};
        Object.values(downloads).forEach(task => {
            if (!groups[task.mangaId]) groups[task.mangaId] = [];
            groups[task.mangaId].push(task);
        });
        return groups;
    }, [downloads]);

    const groupedAnime = useMemo(() => {
        const groups: Record<string, AnimeDownloadEntry[]> = {};
        Object.values(animeDownloads).forEach(entry => {
            if (!groups[entry.animeId]) groups[entry.animeId] = [];
            groups[entry.animeId].push(entry);
        });
        for (const key of Object.keys(groups)) {
            groups[key].sort((a, b) => a.episodeNumber - b.episodeNumber);
        }
        return groups;
    }, [animeDownloads]);

    const deleteAnimeDownload = (episodeId: string) => {
        if (!confirm("Remove this entry? (The video in your gallery is not affected.)")) return;
        const all = getLocal<Record<string, AnimeDownloadEntry>>(STORAGE_KEYS.ANIME_DOWNLOADS, {});
        delete all[episodeId];
        setLocal(STORAGE_KEYS.ANIME_DOWNLOADS, all);
        window.location.reload();
    };

    const hasAny = Object.keys(groupedDownloads).length > 0 || Object.keys(groupedAnime).length > 0;

    const handlePauseAll = () => downloadManager.pauseAll();

    const handleAction = (chapterId: string) => {
        const task = downloads[chapterId];
        if (!task) return;
        if (task.state === 'downloading') {
            downloadManager.pause(chapterId);
        } else if (task.state === 'paused' || task.state === 'error') {
            downloadManager.resume(chapterId);
        }
    };

    const handleDelete = async (chapterId: string) => {
        if (confirm("Are you sure you want to delete this chapter from your device?")) {
            await downloadManager.remove(chapterId);
        }
    };

    return (
        <>
            <Header />
            <main className="main-content" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2>Downloads <span className="jp" style={{ color: 'var(--text-muted)', fontSize: '18px' }}>ダウンロード</span></h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Manage your offline content.</p>
                    </div>
                </div>

                {!hasAny ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--sakura-pink)" strokeWidth="1" style={{ opacity: 0.5, marginBottom: 12 }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                        <h3 style={{ marginBottom: 8 }}>No Downloads Yet</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Manga chapters and anime episodes you download will appear here.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
                            <Link href="/manga" className="btn-primary">Browse Manga</Link>
                            <Link href="/anime" className="btn-primary" style={{ background: 'rgba(255,105,180,0.15)', border: '1px solid var(--sakura-pink)' }}>Browse Anime</Link>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Anime Downloads */}
                        {Object.entries(groupedAnime).map(([animeId, episodes]) => {
                            const firstEp = episodes[0];
                            return (
                                <div key={animeId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden' }}>
                                    <div style={{ padding: '16px', display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: 60, height: 85, borderRadius: '8px', background: 'linear-gradient(135deg, rgba(255,105,180,0.3), rgba(88,101,242,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                                            🎬
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>{firstEp.animeTitle}</h3>
                                            <span style={{ color: 'var(--sakura-pink)', fontSize: '13px' }}>{episodes.length} Episode{episodes.length > 1 ? 's' : ''} — Gallery/Sakura</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {episodes.map(ep => (
                                            <div key={ep.episodeId} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ display: 'block', fontWeight: 600, fontSize: '15px' }}>{ep.episodeTitle}</span>
                                                    <div style={{ marginTop: '4px' }}>
                                                        {ep.state === 'completed' && <span style={{ color: '#4CAF50', fontSize: '12px' }}>✓ Saved to Gallery</span>}
                                                        {ep.state === 'downloading' && <span style={{ color: 'var(--sakura-pink)', fontSize: '12px' }}>Downloading {ep.progress}%</span>}
                                                        {ep.state === 'extracting' && <span style={{ color: 'var(--sakura-pink)', fontSize: '12px' }}>Extracting stream...</span>}
                                                        {ep.state === 'error' && <span style={{ color: '#ff6b6b', fontSize: '12px' }}>Download failed</span>}
                                                    </div>
                                                    {ep.state !== 'completed' && ep.state !== 'error' && (
                                                        <div style={{ height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${ep.progress}%`, background: 'var(--sakura-pink)', transition: 'width 0.3s' }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => deleteAnimeDownload(ep.episodeId)}
                                                    style={{ width: 36, height: 36, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,105,180,0.05)', color: '#ff6b6b', border: 'none', cursor: 'pointer', marginLeft: '16px' }}
                                                    title="Remove entry"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Manga Downloads */}
                        {Object.entries(groupedDownloads).map(([mangaId, tasks]) => {
                            const firstTask = tasks[0];
                            return (
                                <div key={mangaId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden' }}>
                                    {/* Manga Header */}
                                    <div style={{ padding: '16px', display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={firstTask.cover || "/placeholder.png"}
                                            alt="Cover"
                                            style={{ width: 60, height: 85, objectFit: 'cover', borderRadius: '8px' }}
                                        />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text-primary)' }}>{firstTask.title.split(' - ')[0] || "Manga"}</h3>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{tasks.length} Chapters processing/downloaded</span>
                                        </div>
                                    </div>

                                    {/* Chapter List */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {tasks.map(task => {
                                            const pct = task.pages.length > 0 ? (task.downloadedPages / task.pages.length) * 100 : 0;
                                            return (
                                                <div key={task.chapterId} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ display: 'block', fontWeight: 600, fontSize: '15px' }}>{task.title}</span>
                                                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', alignItems: 'center' }}>
                                                            {task.state === 'downloading' && (
                                                                <span style={{ color: 'var(--sakura-pink)', fontSize: '12px' }}>Downloading {Math.round(pct)}%</span>
                                                            )}
                                                            {task.state === 'completed' && (
                                                                <span style={{ color: '#4CAF50', fontSize: '12px' }}>✓ Downloaded</span>
                                                            )}
                                                            {task.state === 'paused' && (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Paused</span>
                                                            )}
                                                            {task.state === 'queued' && (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Queued...</span>
                                                            )}
                                                            {task.state === 'error' && (
                                                                <span style={{ color: '#ff6b6b', fontSize: '12px' }}>Error: {task.error}</span>
                                                            )}
                                                        </div>
                                                        {/* Linear Progress bar */}
                                                        {task.state !== 'completed' && (
                                                            <div style={{ height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: task.state === 'paused' || task.state === 'error' ? 'var(--text-muted)' : 'var(--sakura-pink)', transition: 'width 0.3s' }} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Controls */}
                                                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                                        {task.state !== 'completed' && (
                                                            <button
                                                                onClick={() => handleAction(task.chapterId)}
                                                                style={{ width: 36, height: 36, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 105, 180, 0.1)', color: 'var(--sakura-pink)', border: 'none', cursor: 'pointer' }}
                                                            >
                                                                {task.state === 'downloading' ? (
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                                                ) : (
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                                                )}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(task.chapterId)}
                                                            style={{ width: 36, height: 36, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 105, 180, 0.05)', color: '#ff6b6b', border: 'none', cursor: 'pointer' }}
                                                            title="Delete"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </>
    );
}
