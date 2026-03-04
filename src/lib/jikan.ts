const JIKAN_API = 'https://api.jikan.moe/v4';

export interface JikanAnime {
    mal_id: number;
    title: string;
    title_english: string | null;
    images: {
        webp: {
            image_url: string;
            large_image_url: string;
        }
    };
    synopsis: string;
    status: string;
    type: string;
    year: number;
    score: number;
    genres: { name: string }[];
}

export async function fetchJikanSearch(query: string): Promise<JikanAnime[]> {
    try {
        const res = await fetch(`${JIKAN_API}/anime?q=${encodeURIComponent(query)}&order_by=popularity&sort=asc&sfw=true`);
        // Jikan rate limits: be careful
        const data = await res.json();
        return data.data || [];
    } catch (e) {
        console.error("Jikan Search Error", e);
        return [];
    }
}

export async function fetchJikanTrending(): Promise<JikanAnime[]> {
    try {
        const res = await fetch(`${JIKAN_API}/top/anime?filter=airing&limit=12`);
        const data = await res.json();
        return data.data || [];
    } catch (e) {
        console.error("Jikan Trending Error", e);
        return [];
    }
}

export async function fetchJikanInfo(id: string | number): Promise<JikanAnime | null> {
    try {
        const res = await fetch(`${JIKAN_API}/anime/${id}/full`);
        const data = await res.json();
        return data.data || null;
    } catch (e) {
        console.error("Jikan Info Error", e);
        return null;
    }
}
