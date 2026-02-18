import axios from "axios";

const MANGADEX_API_URL = "https://api.mangadex.org";
const UPLOADS_URL = "https://uploads.mangadex.org";

export interface Manga {
    id: string;
    title: string;
    description: string;
    cover: string;
    author: string;
    tags: string[];
    status: string;
    year: number;
    rating?: number;
    follows?: number;
}

export interface Chapter {
    id: string;
    volume: string;
    chapter: string;
    title: string;
    publishAt: string;
    pages: number;
}

// Helper to get cover URL
function getCoverUrl(mangaId: string, filename: string) {
    return `${UPLOADS_URL}/covers/${mangaId}/${filename}.256.jpg`;
}

// Search Manga
export async function searchManga(query: string = "", limit = 20, offset = 0): Promise<Manga[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            "order[followedCount]": "desc", // Sort by popularity
        });

        params.append("includes[]", "cover_art");
        params.append("includes[]", "author");
        params.append("contentRating[]", "safe");
        params.append("contentRating[]", "suggestive");

        if (query) {
            params.append("title", query);
        }

        const url = `${MANGADEX_API_URL}/manga?${params.toString()}`;
        // Direct call (CORS enabled on MangaDex)
        const response = await axios.get(url);

        return response.data.data.map((item: any) => {
            const attributes = item.attributes;
            const coverRel = item.relationships.find((r: any) => r.type === "cover_art");
            const authorRel = item.relationships.find((r: any) => r.type === "author");
            const coverFileName = coverRel?.attributes?.fileName;

            return {
                id: item.id,
                title: attributes.title.en || Object.values(attributes.title)[0] || "Unknown Title",
                description: attributes.description.en || "",
                cover: coverFileName ? getCoverUrl(item.id, coverFileName) : "/placeholder.png", // Fallback
                author: authorRel?.attributes?.name || "Unknown Author",
                tags: attributes.tags.map((t: any) => t.attributes.name.en),
                status: attributes.status,
                year: attributes.year,
            };
        });
    } catch (error) {
        console.error("MangaDex Search Error:", error);
        return [];
    }
}

// Get Manga Statistics (Rating, Follows)
export async function getMangaStatistics(mangaIds: string[]) {
    try {
        const params = new URLSearchParams();
        mangaIds.forEach(id => params.append("manga[]", id));

        const url = `${MANGADEX_API_URL}/statistics/manga?${params.toString()}`;
        const response = await axios.get(url);
        return response.data.statistics;
    } catch (error) {
        console.error("MangaDex Stats Error:", error);
        return {};
    }
}

// Get Manga Details
export async function getMangaDetails(id: string): Promise<Manga | null> {
    try {
        const url = `${MANGADEX_API_URL}/manga/${id}?includes[]=cover_art&includes[]=author`;
        const response = await axios.get(url);
        const item = response.data.data;
        const attributes = item.attributes;
        const coverRel = item.relationships.find((r: any) => r.type === "cover_art");
        const authorRel = item.relationships.find((r: any) => r.type === "author");
        const coverFileName = coverRel?.attributes?.fileName;

        return {
            id: item.id,
            title: attributes.title.en || Object.values(attributes.title)[0] || "Unknown Title",
            description: attributes.description.en || "",
            cover: coverFileName ? getCoverUrl(item.id, coverFileName) : "/placeholder.png",
            author: authorRel?.attributes?.name || "Unknown Author",
            tags: attributes.tags.map((t: any) => t.attributes.name.en),
            status: attributes.status,
            year: attributes.year,
        };
    } catch (error) {
        console.error("MangaDex Details Error:", error);
        return null;
    }
}

// Get Chapters
export async function getChapters(mangaId: string, limit = 100, offset = 0): Promise<Chapter[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            manga: mangaId,
            "translatedLanguage[]": "en", // English chapters
            "order[chapter]": "desc", // Newest first
        });

        const url = `${MANGADEX_API_URL}/chapter?${params.toString()}`;
        const response = await axios.get(url);

        return response.data.data.map((item: any) => ({
            id: item.id,
            volume: item.attributes.volume,
            chapter: item.attributes.chapter,
            title: item.attributes.title,
            publishAt: item.attributes.publishAt,
            pages: item.attributes.pages,
            externalUrl: item.attributes.externalUrl,
        }));
    } catch (error) {
        console.error("MangaDex Chapters Error:", error);
        return [];
    }
}

// Get Chapter Pages
export async function getChapterPages(chapterId: string): Promise<string[]> {
    try {
        // 1. Get Base URL
        const url = `${MANGADEX_API_URL}/at-home/server/${chapterId}`;
        const response = await axios.get(url);
        const { baseUrl, chapter } = response.data;

        // 2. Construct Page URLs
        return chapter.data.map((filename: string) =>
            `${baseUrl}/data/${chapter.hash}/${filename}`
        );
    } catch (error) {
        console.error("MangaDex Pages Error:", error);
        throw error; // Rethrow to let UI handle it
    }
}

// Get Featured Manga (Curated list for Home - Dynamic Top Followed)
export async function getFeaturedManga(): Promise<Manga[]> {
    try {
        const params = new URLSearchParams({
            limit: "12",
            offset: "0",
            "order[followedCount]": "desc", // Most popular
            "contentRating[]": "safe", // Ensure safe content for home
        });

        params.append("includes[]", "cover_art");
        params.append("includes[]", "author");
        // params.append("contentRating[]", "suggestive"); // Optional: include suggestive if desired, keeping it safe for now

        const url = `${MANGADEX_API_URL}/manga?${params.toString()}`;
        const response = await axios.get(url);

        const mangaList = response.data.data.map((item: any) => {
            const attributes = item.attributes;
            const coverRel = item.relationships.find((r: any) => r.type === "cover_art");
            const authorRel = item.relationships.find((r: any) => r.type === "author");
            const coverFileName = coverRel?.attributes?.fileName;

            return {
                id: item.id,
                title: attributes.title.en || Object.values(attributes.title)[0] || "Unknown Title",
                description: attributes.description.en || "",
                cover: coverFileName ? getCoverUrl(item.id, coverFileName) : "/placeholder.png",
                author: authorRel?.attributes?.name || "Unknown Author",
                tags: attributes.tags.map((t: any) => t.attributes.name.en),
                status: attributes.status,
                year: attributes.year,
            };
        });

        // Add stats
        const stats = await getMangaStatistics(mangaList.map((m: any) => m.id));
        return mangaList.map((m: any) => ({
            ...m,
            rating: stats[m.id]?.rating?.average,
            follows: stats[m.id]?.follows
        }));

    } catch (error) {
        console.error("Featured Manga Error:", error);
        return [];
    }
}

