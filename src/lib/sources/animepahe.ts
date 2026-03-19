import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * AnimePahe API proxy URL.
 * AnimePahe has Cloudflare protection, so a server-side proxy is required.
 * Deploy https://github.com/Pal-droid/Animepahe-API on Railway/Render (free).
 * Set NEXT_PUBLIC_ANIME_API_URL in .env.local to your proxy URL.
 */
const API_BASE = (
    process.env.NEXT_PUBLIC_ANIME_API_URL || ""
).replace(/\/+$/, '');

async function apiGet(path: string) {
    if (!API_BASE) throw new Error("NEXT_PUBLIC_ANIME_API_URL not configured");
    const url = `${API_BASE}${path}`;
    if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
            url,
            connectTimeout: 15000,
            readTimeout: 15000,
        });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        } finally {
            clearTimeout(timer);
        }
    }
}

export interface AnimePaheSearchResult {
    id: number;
    title: string;
    session: string;
    poster?: string;
    year?: number;
    type?: string;
}

export async function searchAnimePahe(query: string): Promise<AnimePaheSearchResult[]> {
    try {
        const data = await apiGet(`/search?q=${encodeURIComponent(query)}`);
        if (!Array.isArray(data)) return [];
        return data.map((r: any) => ({
            id: r.id,
            title: r.title || '',
            session: r.session || '',
            poster: r.poster,
            year: r.year,
            type: r.type,
        })).filter((r: any) => r.session && r.title);
    } catch (e) {
        console.error("[AnimePahe] Search error:", e);
        return [];
    }
}

export interface AnimePaheEpisode {
    id: number;
    number: number;
    title: string;
    session: string;
    snapshot?: string;
}

export async function getAnimePaheEpisodes(animeSession: string): Promise<AnimePaheEpisode[]> {
    try {
        const data = await apiGet(`/episodes?session=${encodeURIComponent(animeSession)}`);
        if (!Array.isArray(data)) return [];
        return data.map((ep: any) => ({
            id: ep.id,
            number: ep.number ?? 0,
            title: ep.title || `Episode ${ep.number ?? '?'}`,
            session: ep.session || '',
            snapshot: ep.snapshot,
        })).filter((ep: any) => ep.session);
    } catch (e) {
        console.error("[AnimePahe] Episodes error:", e);
        return [];
    }
}

export interface AnimePaheSource {
    url: string;
    quality: string;
    fansub?: string;
    audio?: string;
}

export async function getAnimePaheSources(animeSession: string, episodeSession: string): Promise<AnimePaheSource[]> {
    try {
        const data = await apiGet(
            `/sources?anime_session=${encodeURIComponent(animeSession)}&episode_session=${encodeURIComponent(episodeSession)}`
        );
        if (!Array.isArray(data)) return [];
        return data.map((s: any) => ({
            url: s.url || '',
            quality: s.quality || 'default',
            fansub: s.fansub,
            audio: s.audio,
        })).filter((s: any) => s.url);
    } catch (e) {
        console.error("[AnimePahe] Sources error:", e);
        return [];
    }
}

export async function resolveM3U8(kwikUrl: string): Promise<string | null> {
    try {
        const data = await apiGet(`/m3u8?url=${encodeURIComponent(kwikUrl)}`);
        return data.m3u8 || null;
    } catch (e) {
        console.error("[AnimePahe] M3U8 resolve error:", e);
        return null;
    }
}

export function isConfigured(): boolean {
    return !!API_BASE;
}
