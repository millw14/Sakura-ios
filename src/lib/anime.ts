import { fetchJikanSearch, fetchJikanTrending, fetchJikanInfo } from "./jikan";
import { searchHiAnime, getHiAnimeEpisodes, getHiAnimeServers, getHiAnimeSources } from "./sources/hianime";
import { extractMegaCloudSources } from "./sources/megacloud";

export interface AnimeResult {
    id: string; // Will store Jikan ID
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
        id: string; // HiAnime Episode ID
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

/**
 * Searches for an anime series using Jikan API (MAL).
 */
export async function searchAnime(query: string): Promise<AnimeResult[]> {
    const results = await fetchJikanSearch(query);
    return results.map(r => ({
        id: String(r.mal_id),
        title: r.title_english || r.title,
        image: r.images?.webp?.large_image_url || r.images?.webp?.image_url,
        type: r.type,
        releaseDate: r.year ? String(r.year) : undefined,
        score: r.score
    }));
}

/**
 * Fetches currently airing/trending anime using Jikan API.
 */
export async function fetchAiringAnime(): Promise<AnimeResult[]> {
    const results = await fetchJikanTrending();
    return results.map(r => ({
        id: String(r.mal_id),
        title: r.title_english || r.title,
        image: r.images?.webp?.large_image_url || r.images?.webp?.image_url,
        type: 'Trending',
        score: r.score
    }));
}

/**
 * Gets metadata from Jikan, then maps it to HiAnime to fetch episodes.
 */
export async function fetchAnimeInfo(id: string): Promise<AnimeInfo | null> {
    const jikanData = await fetchJikanInfo(id);
    if (!jikanData) return null;

    const romajiTitle = jikanData.title;
    const engTitle = jikanData.title_english;

    // 1. Search HiAnime using Romaji Title first
    let hiSearch = await searchHiAnime(romajiTitle);

    // Fallback to English title if Romaji yields nothing
    if ((!hiSearch || hiSearch.length === 0) && engTitle) {
        hiSearch = await searchHiAnime(engTitle);
    }

    let hiAnimeId = '';

    if (hiSearch && hiSearch.length > 0) {
        // Try to find exact match
        const findMatch = [...hiSearch].find((p: any) =>
            p.title.toLowerCase() === romajiTitle.toLowerCase() ||
            (engTitle && p.title.toLowerCase() === engTitle.toLowerCase())
        );
        hiAnimeId = findMatch ? findMatch.id : hiSearch[0].id;
    }

    let episodes: AnimeInfo['episodes'] = [];

    // 2. Fetch episodes from HiAnime using the mapped ID
    if (hiAnimeId) {
        episodes = await getHiAnimeEpisodes(hiAnimeId);
    }

    return {
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

        // Decrypt the Megacloud sources to get raw .m3u8
        const megaResult = await extractMegaCloudSources(iframeSource.url);
        if (!megaResult || megaResult.sources.length === 0) {
            console.error('[Anime] MegaCloud extraction returned no sources');
            return null;
        }

        const m3u8Source = megaResult.sources[0];
        console.log('[Anime] Decrypted .m3u8:', m3u8Source.file);

        return {
            url: m3u8Source.file,
            isM3U8: true,
            tracks: megaResult.tracks,
            intro: megaResult.intro,
            outro: megaResult.outro,
        };
    } catch (e) {
        console.error('[Anime] fetchEpisodeSources failed:', e);
        return null;
    }
}

