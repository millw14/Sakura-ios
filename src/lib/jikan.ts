import { Capacitor, CapacitorHttp } from '@capacitor/core';

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

async function requestJikan(url: string) {
    if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({ url });
        if (response.status >= 400) throw new Error(`HTTP Error: ${response.status}`);
        return response.data;
    } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
    }
}

export async function fetchJikanSearch(query: string): Promise<JikanAnime[]> {
    try {
        const data = await requestJikan(`${JIKAN_API}/anime?q=${encodeURIComponent(query)}&order_by=popularity&sort=asc&sfw=true`);
        return data.data || [];
    } catch (e) {
        console.error("Jikan Search Error", e);
        return [];
    }
}

export async function fetchJikanTrending(): Promise<JikanAnime[]> {
    try {
        const data = await requestJikan(`${JIKAN_API}/top/anime?filter=airing&limit=12`);
        return data.data || [];
    } catch (e) {
        console.error("Jikan Trending Error", e);
        return [];
    }
}

export async function fetchJikanInfo(id: string | number): Promise<JikanAnime | null> {
    try {
        const data = await requestJikan(`${JIKAN_API}/anime/${id}/full`);
        return data.data || null;
    } catch (e) {
        console.error("Jikan Info Error", e);
        return null;
    }
}
