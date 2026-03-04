import * as cheerio from "cheerio";

const BASE_URL = "https://hianime.to";

export async function searchHiAnime(query: string) {
    try {
        const res = await fetch(`${BASE_URL}/search?keyword=${encodeURIComponent(query)}`);
        const html = await res.text();
        const $ = cheerio.load(html);

        const results: any[] = [];
        $('.flw-item').each((_, el) => {
            const a = $(el).find('a.dynamic-name');
            const title = a.attr('title') || a.text();
            let href = a.attr('href') || ''; // e.g. /naruto-20

            // Extract the ID from the href 
            const idMatch = href.match(/-(\d+)(?:\?|$)/);
            if (idMatch && title) {
                results.push({ id: idMatch[1], title });
            }
        });
        return results;
    } catch (e) {
        console.error("HiAnime Search Error", e);
        return [];
    }
}

export async function getHiAnimeEpisodes(animeId: string) {
    try {
        const res = await fetch(`${BASE_URL}/ajax/v2/episode/list/${animeId}`);
        const data = await res.json();
        const $ = cheerio.load(data.html);

        const episodes: any[] = [];
        $('.ep-item').each((_, el) => {
            const epId = $(el).attr('data-id');
            const epNum = $(el).attr('data-number');
            const title = $(el).attr('title');
            if (epId) {
                episodes.push({
                    id: epId,
                    number: Number(epNum),
                    title: title || `Episode ${epNum}`
                });
            }
        });
        return episodes;
    } catch (e) {
        console.error("HiAnime Episodes Error", e);
        return [];
    }
}

export async function getHiAnimeServers(episodeId: string) {
    try {
        const res = await fetch(`${BASE_URL}/ajax/v2/episode/servers?episodeId=${episodeId}`);
        const data = await res.json();
        const $ = cheerio.load(data.html);

        const servers: any[] = [];
        $('.server-item').each((_, el) => {
            servers.push({
                serverId: $(el).attr('data-id'),
                name: $(el).find('a').text().trim(),
                type: $(el).attr('data-type') // sub or dub
            });
        });
        return servers;
    } catch (e) {
        console.error("HiAnime Servers Error", e);
        return [];
    }
}

export async function getHiAnimeSources(serverId: string) {
    try {
        const res = await fetch(`${BASE_URL}/ajax/v2/episode/sources?id=${serverId}`);
        const data = await res.json();
        return {
            url: data.link,
            isIframe: data.type === 'iframe'
        };
    } catch (e) {
        console.error("HiAnime Sources Error", e);
        return null;
    }
}
