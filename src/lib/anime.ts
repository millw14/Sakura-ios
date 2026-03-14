import { fetchJikanSearch, fetchJikanTrending, fetchJikanInfo } from "./jikan";
import { searchHiAnime, getHiAnimeEpisodes, getHiAnimeServers, getHiAnimeSources } from "./sources/hianime";
import { extractMegaCloudSources } from "./sources/megacloud";

export interface AnimeResult {
    id: string;
    title: string;
    image?: string;
    type?: string;
    releaseDate?: string;
    score?: number;
}

export interface AnimeInfo extends AnimeResult {
    cover?: string;
    description?: string;
    status?: string;
    genres?: string[];
    episodes: {
        id: string;
        number: number;
        title: string;
        image?: string;
    }[];
}

export interface StreamingSource {
    url: string;
    isM3U8: boolean;
    tracks?: { file: string; label?: string; kind?: string }[];
    intro?: { start: number; end: number };
    outro?: { start: number; end: number };
}

/* ─── Cache Helpers ─── */

const CACHE_PREFIX = "sakura_anime_cache_";
const TTL_SEARCH = 30 * 60 * 1000;       // 30 min
const TTL_TRENDING = 2 * 60 * 60 * 1000; // 2 hours
const TTL_INFO = 24 * 60 * 60 * 1000;    // 24 hours
const TTL_EPISODES = 6 * 60 * 60 * 1000; // 6 hours
const TTL_HI_MAP = 7 * 24 * 60 * 60 * 1000; // 7 days (MAL→HiAnime ID mapping rarely changes)

function cacheGet<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const { data, exp } = JSON.parse(raw);
        if (Date.now() > exp) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data as T;
    } catch { return null; }
}

function cacheSet<T>(key: string, data: T, ttl: number): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, exp: Date.now() + ttl }));
    } catch { /* quota exceeded — ignore */ }
}

export async function searchAnime(query: string): Promise<AnimeResult[]> {
    const cacheKey = `search_${query.toLowerCase().trim()}`;
    const cached = cacheGet<AnimeResult[]>(cacheKey);
    if (cached) return cached;

    const results = await fetchJikanSearch(query);
    const mapped = results.map(r => ({
        id: String(r.mal_id),
        title: r.title_english || r.title,
        image: r.images?.webp?.large_image_url || r.images?.webp?.image_url,
        type: r.type,
        releaseDate: r.year ? String(r.year) : undefined,
        score: r.score
    }));
    cacheSet(cacheKey, mapped, TTL_SEARCH);
    return mapped;
}

export async function fetchAiringAnime(): Promise<AnimeResult[]> {
    const cacheKey = "trending";
    const cached = cacheGet<AnimeResult[]>(cacheKey);
    if (cached) return cached;

    const results = await fetchJikanTrending();
    const mapped = results.map(r => ({
        id: String(r.mal_id),
        title: r.title_english || r.title,
        image: r.images?.webp?.large_image_url || r.images?.webp?.image_url,
        type: 'Trending',
        score: r.score
    }));
    cacheSet(cacheKey, mapped, TTL_TRENDING);
    return mapped;
}

export async function fetchAnimeInfo(id: string): Promise<AnimeInfo | null> {
    const cacheKey = `info_${id}`;
    const cached = cacheGet<AnimeInfo>(cacheKey);
    if (cached) return cached;

    const jikanData = await fetchJikanInfo(id);
    if (!jikanData) return null;

    const romajiTitle = jikanData.title;
    const engTitle = jikanData.title_english;

    // Check cached MAL→HiAnime ID mapping first
    const mapKey = `himap_${id}`;
    let hiAnimeId = cacheGet<string>(mapKey) || '';

    if (!hiAnimeId) {
        let hiSearch = await searchHiAnime(romajiTitle);
        if ((!hiSearch || hiSearch.length === 0) && engTitle) {
            hiSearch = await searchHiAnime(engTitle);
        }

        if (hiSearch && hiSearch.length > 0) {
            const findMatch = [...hiSearch].find((p: any) =>
                p.title.toLowerCase() === romajiTitle.toLowerCase() ||
                (engTitle && p.title.toLowerCase() === engTitle.toLowerCase())
            );
            hiAnimeId = findMatch ? findMatch.id : hiSearch[0].id;
            cacheSet(mapKey, hiAnimeId, TTL_HI_MAP);
        }
    }

    let episodes: AnimeInfo['episodes'] = [];

    if (hiAnimeId) {
        const epKey = `episodes_${hiAnimeId}`;
        const cachedEps = cacheGet<AnimeInfo['episodes']>(epKey);
        if (cachedEps) {
            episodes = cachedEps;
        } else {
            episodes = await getHiAnimeEpisodes(hiAnimeId);
            if (episodes.length > 0) cacheSet(epKey, episodes, TTL_EPISODES);
        }
    }

    const info: AnimeInfo = {
        id: String(jikanData.mal_id),
        title: jikanData.title_english || jikanData.title,
        image: jikanData.images?.webp?.large_image_url || jikanData.images?.webp?.image_url,
        cover: jikanData.images?.webp?.large_image_url || jikanData.images?.webp?.image_url,
        description: jikanData.synopsis,
        status: jikanData.status,
        genres: jikanData.genres?.map(g => g.name) || [],
        score: jikanData.score,
        episodes
    };
    cacheSet(cacheKey, info, TTL_INFO);
    return info;
}

/** Returns cached anime info instantly (no network calls). */
export function getCachedAnimeInfo(id: string): AnimeInfo | null {
    return cacheGet<AnimeInfo>(`info_${id}`);
}

/** Fetches fresh anime info, bypassing cache. Updates cache on success. */
export async function refreshAnimeInfo(id: string): Promise<AnimeInfo | null> {
    const jikanData = await fetchJikanInfo(id);
    if (!jikanData) return null;

    const romajiTitle = jikanData.title;
    const engTitle = jikanData.title_english;

    let hiAnimeId = cacheGet<string>(`himap_${id}`) || '';

    if (!hiAnimeId) {
        let hiSearch = await searchHiAnime(romajiTitle);
        if ((!hiSearch || hiSearch.length === 0) && engTitle) {
            hiSearch = await searchHiAnime(engTitle);
        }
        if (hiSearch && hiSearch.length > 0) {
            const findMatch = [...hiSearch].find((p: any) =>
                p.title.toLowerCase() === romajiTitle.toLowerCase() ||
                (engTitle && p.title.toLowerCase() === engTitle.toLowerCase())
            );
            hiAnimeId = findMatch ? findMatch.id : hiSearch[0].id;
            cacheSet(`himap_${id}`, hiAnimeId, TTL_HI_MAP);
        }
    }

    let episodes: AnimeInfo['episodes'] = [];
    if (hiAnimeId) {
        episodes = await getHiAnimeEpisodes(hiAnimeId);
        if (episodes.length > 0) cacheSet(`episodes_${hiAnimeId}`, episodes, TTL_EPISODES);
    }

    const info: AnimeInfo = {
        id: String(jikanData.mal_id),
        title: jikanData.title_english || jikanData.title,
        image: jikanData.images?.webp?.large_image_url || jikanData.images?.webp?.image_url,
        cover: jikanData.images?.webp?.large_image_url || jikanData.images?.webp?.image_url,
        description: jikanData.synopsis,
        status: jikanData.status,
        genres: jikanData.genres?.map(g => g.name) || [],
        score: jikanData.score,
        episodes
    };
    cacheSet(`info_${id}`, info, TTL_INFO);
    return info;
}

/**
 * Resolves an Episode ID into a decrypted .m3u8 streaming source.
 * 1. Gets the Megacloud embed URL from HiAnime
 * 2. Passes it through our MegaCloud AES decryptor
 * 3. Returns the raw .m3u8 URL for direct HLS.js playback
 */
export async function fetchEpisodeSources(episodeId: string): Promise<StreamingSource | null> {
    try {
        // Get server list for this episode
        const servers = await getHiAnimeServers(episodeId);
        const subServer = servers.find(s => s.type === 'sub') || servers[0];
        if (!subServer) return null;

        // Get the Megacloud embed URL
        const iframeSource = await getHiAnimeSources(subServer.serverId);
        if (!iframeSource || !iframeSource.url) return null;

        console.log('[Anime] Got embed URL:', iframeSource.url);

        // Instead of trying to natively extract M3U8 (which fails Cloudflare challenge on Dalvik clients),
        // we return the embed URL directly so the mobile frontend can mount it natively in a Browser overlay.
        return {
            url: iframeSource.url,
            isM3U8: false
        };
    } catch (e) {
        console.error('[Anime] fetchEpisodeSources failed:', e);
        return null;
    }
}

