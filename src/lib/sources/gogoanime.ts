import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Consumet API base URL — self-host required.
 * One-click deploy on Vercel: https://github.com/consumet/api.consumet.org
 * Set NEXT_PUBLIC_CONSUMET_URL in .env.local to your instance URL.
 */
const CONSUMET_BASE = (
    process.env.NEXT_PUBLIC_CONSUMET_URL || ""
).replace(/\/+$/, '');

const PROVIDER = process.env.NEXT_PUBLIC_ANIME_PROVIDER || "gogoanime";

async function consumetGet(path: string) {
    if (!CONSUMET_BASE) throw new Error("NEXT_PUBLIC_CONSUMET_URL not set");
    const url = `${CONSUMET_BASE}${path}`;
    const isWatch = path.includes('/watch');
    const timeout = isWatch ? 30000 : 15000;
    if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
            url,
            connectTimeout: timeout,
            readTimeout: timeout,
        });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        } finally {
            clearTimeout(timer);
        }
    }
}

export function isConfigured(): boolean {
    return !!CONSUMET_BASE;
}

let _lastError = '';
export function getLastConsumetError(): string { return _lastError; }

export async function searchAnimeSource(query: string): Promise<{ id: string; title: string }[]> {
    try {
        _lastError = '';
        const url = `/anime/${PROVIDER}/${encodeURIComponent(query)}`;
        console.log(`[Consumet] Searching: ${CONSUMET_BASE}${url}`);
        const data = await consumetGet(url);
        if (!data.results || !Array.isArray(data.results)) {
            _lastError = `No results array for "${query}"`;
            return [];
        }
        console.log(`[Consumet] Found ${data.results.length} results for "${query}"`);
        return data.results.map((r: any) => ({
            id: r.id || '',
            title: r.title || '',
        })).filter((r: any) => r.id && r.title);
    } catch (e: any) {
        _lastError = `Search "${query}": ${e.message || e}`;
        console.error(`[${PROVIDER}] Search error:`, e);
        return [];
    }
}

export async function getAnimeSourceEpisodes(animeId: string): Promise<{ id: string; number: number; title: string }[]> {
    try {
        const useQueryParam = PROVIDER === 'animesaturn';
        const url = useQueryParam
            ? `/anime/${PROVIDER}/info?id=${encodeURIComponent(animeId)}`
            : `/anime/${PROVIDER}/info/${encodeURIComponent(animeId)}`;
        console.log(`[Consumet] Fetching episodes: ${CONSUMET_BASE}${url}`);
        const data = await consumetGet(url);
        if (!data.episodes || !Array.isArray(data.episodes)) {
            console.warn(`[Consumet] No episodes array for "${animeId}" — response keys:`, Object.keys(data));
            return [];
        }
        console.log(`[Consumet] Got ${data.episodes.length} episodes for "${animeId}"`);
        return data.episodes.map((ep: any) => ({
            id: ep.id || '',
            number: ep.number ?? 0,
            title: ep.title || `Episode ${ep.number ?? '?'}`,
        })).filter((ep: any) => ep.id);
    } catch (e) {
        console.error(`[${PROVIDER}] Episodes error:`, e);
        return [];
    }
}

export interface StreamSource {
    url: string;
    isM3U8: boolean;
    quality: string;
}

function parseSourceResponse(data: any): {
    sources: StreamSource[];
    subtitles: { file: string; label?: string }[];
    referer?: string;
} | null {
    const sources: StreamSource[] = (data.sources || []).map((s: any) => ({
        url: s.url || '',
        isM3U8: s.isM3U8 ?? true,
        quality: s.quality || 'default',
    })).filter((s: any) => s.url);

    const ENGLISH_LANGS = ['english', 'eng', 'en', 'english (us)', 'english (uk)'];
    const subtitles = (data.subtitles || []).map((s: any) => ({
        file: s.url || '',
        label: s.lang || s.label || 'Subtitle',
    })).filter((s: any) => {
        if (!s.file) return false;
        const lang = (s.label || '').toLowerCase();
        return ENGLISH_LANGS.some(e => lang.includes(e));
    });

    if (sources.length === 0) return null;

    const referer = data.headers?.Referer || '';
    return { sources, subtitles, referer };
}

export async function getStreamingSources(episodeId: string): Promise<{
    sources: StreamSource[];
    subtitles: { file: string; label?: string }[];
    referer?: string;
} | null> {
    const hasSlash = episodeId.includes('/');
    const basePath = hasSlash
        ? `/anime/${PROVIDER}/watch?episodeId=${encodeURIComponent(episodeId)}`
        : `/anime/${PROVIDER}/watch/${encodeURIComponent(episodeId)}`;

    try {
        console.log(`[Consumet] Fetching sources for ${episodeId} (provider=${PROVIDER})`);
        const data = await consumetGet(basePath);
        const result = parseSourceResponse(data);
        if (result) {
            console.log(`[Consumet] Got ${result.sources.length} sources (qualities: ${result.sources.map(s => s.quality).join(', ')})`);
            return result;
        }
    } catch (e) {
        console.error(`[${PROVIDER}] Streaming sources error:`, e);
    }

    return null;
}
