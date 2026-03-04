import { load } from 'cheerio';

const BASE_URL = 'https://animepahe.si';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function headers(referer = BASE_URL) {
    return {
        'User-Agent': USER_AGENT,
        'Referer': referer,
        'Accept': 'application/json, text/javascript, */*; q=0.01'
    };
}

export async function searchAnimepahe(query: string) {
    try {
        const res = await fetch(`${BASE_URL}/api?m=search&q=${encodeURIComponent(query)}`, { headers: headers() });
        const data = await res.json();
        return (data.data || []).map((item: any) => ({
            id: item.session,
            title: item.title,
            image: item.poster,
            type: item.type,
            releaseDate: item.year
        }));
    } catch (e: any) {
        console.error("Search failed:", e);
        return [];
    }
}

export async function fetchAiringAnimepahe() {
    try {
        const res = await fetch(`${BASE_URL}/api?m=airing&page=1`, { headers: headers() });
        const data = await res.json();
        return (data.data || []).map((item: any) => ({
            id: item.anime_session || item.session,
            title: item.anime_title || item.title,
            image: item.anime_poster || item.poster || item.snapshot,
            type: 'Airing'
        }));
    } catch (e: any) {
        console.error("Airing fetch failed:", e);
        return [];
    }
}

export async function getAnimepaheInfo(id: string) {
    try {
        const res = await fetch(`${BASE_URL}/anime/${id}`, { headers: headers(`${BASE_URL}/anime/${id}`) });
        const html = await res.text();
        const $ = load(html);

        const title = $('div.title-wrapper > h1 > span').first().text();
        const image = $('div.anime-poster a').attr('href');
        const cover = `https:${$('div.anime-cover').attr('data-src')}`;
        const description = $('div.anime-summary').text().trim();

        let status = 'Unknown';
        const statusText = $('div.anime-info p:contains("Status:") a').text().trim();
        if (statusText === 'Currently Airing') status = 'Ongoing';
        else if (statusText === 'Finished Airing') status = 'Completed';

        const rawEpisodes = await fetch(`${BASE_URL}/api?m=release&id=${id}&sort=episode_asc&page=1`, { headers: headers(`${BASE_URL}/anime/${id}`) });
        const episodesData = await rawEpisodes.json();

        const episodes = episodesData.data.map((ep: any) => ({
            id: `${id}/${ep.session}`,
            number: ep.episode,
            title: ep.title || `Episode ${ep.episode}`,
            image: ep.snapshot
        }));

        // Fetch rest of episodes if there are multiple pages
        for (let i = 2; i <= episodesData.last_page; i++) {
            const nextP = await fetch(`${BASE_URL}/api?m=release&id=${id}&sort=episode_asc&page=${i}`, { headers: headers(`${BASE_URL}/anime/${id}`) });
            const nextData = await nextP.json();
            episodes.push(...nextData.data.map((ep: any) => ({
                id: `${id}/${ep.session}`,
                number: ep.episode,
                title: ep.title || `Episode ${ep.episode}`,
                image: ep.snapshot
            })));
        }

        return {
            id,
            title,
            image,
            cover,
            description,
            status,
            episodes
        };
    } catch (e) {
        console.error("Fetch Info Failed", e);
        return null;
    }
}

// ----------------------------------------------------
// Kwik Extractor
// ----------------------------------------------------
function deobfuscate(payload: string, key: string, offset: number, radix: number) {
    let result = '';
    const delimiter = key[radix];
    const chunks = payload.split(delimiter);
    const map: any = {};
    for (let i = 0; i < key.length; i++) {
        map[key[i]] = i;
    }
    for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        let val = 0;
        for (let i = 0; i < chunk.length; i++) {
            val = val * radix + map[chunk[i]];
        }
        result += String.fromCharCode(val - offset);
    }
    try {
        return decodeURIComponent(escape(result));
    } catch {
        return result;
    }
}

function safeUnpack(packedSource: string) {
    const argsRegex = /}\s*\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^'\\]|\\.)*)'\./;
    const match = argsRegex.exec(packedSource);
    if (!match) return packedSource;

    let [_, p, aStr, cStr, kStr] = match;
    const a = parseInt(aStr);
    const c = parseInt(cStr);
    let k = kStr.split('|');

    const base62 = (n: number): string => {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return n < a ? chars[n] : base62(Math.floor(n / a)) + chars[n % a];
    };

    const dict: any = {};
    for (let i = 0; i < c; i++) {
        const key = base62(i);
        const word = k[i] || key;
        dict[key] = word;
    }

    return p.replace(/\b\w+\b/g, word => dict[word] || word);
}

export async function getAnimepaheSources(episodeId: string) {
    try {
        // episodeId comes in like: animeId/episodeSession
        const sessionParts = episodeId.split('/');
        const epSession = sessionParts[1] || sessionParts[0];

        const res = await fetch(`${BASE_URL}/play/${episodeId}`, { headers: headers(`${BASE_URL}/anime/${sessionParts[0]}`) });
        const html = await res.text();
        const $ = load(html);

        const links = $('div#resolutionMenu > button').map((i, el) => ({
            url: $(el).attr('data-src'),
            quality: $(el).text(),
            audio: $(el).attr('data-audio'),
        })).get();

        const sources = [];
        for (const link of links) {
            if (!link.url) continue;

            // Extract from KWIK
            const kwikRes = await fetch(link.url, { headers: { Referer: BASE_URL } });
            const kwikHtml = await kwikRes.text();

            try {
                // Mimic Consumet string unpacker
                const unpackRegex = /;(eval)(\(f[\s\S]*?)(\n<\/script>)/.exec(kwikHtml);
                if (unpackRegex && unpackRegex[2]) {
                    const unpacked = safeUnpack(unpackRegex[2]);
                    const sourceMatch = unpacked.match(/https.*?m3u8/);
                    if (sourceMatch && sourceMatch[0]) {
                        sources.push({
                            url: sourceMatch[0],
                            quality: link.quality,
                            isM3U8: sourceMatch[0].includes('.m3u8')
                        });
                    }
                }
            } catch (ignore) { }
        }
        return sources;
    } catch (e) {
        console.error("Sources fetch failed", e);
        return [];
    }
}
