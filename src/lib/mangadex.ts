import axios from "axios";
import { cacheWrap } from "./cache";

const MANGADEX_API_URL = "https://api.mangadex.org";
const UPLOADS_URL = "https://uploads.mangadex.org";

export interface Manga {
    id: string;
    title: string;
    description: string;
    cover: string;
    author: string;
    authorId?: string;
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
    externalUrl?: string;
}

// Helper to get cover URL
function getCoverUrl(mangaId: string, filename: string) {
    return `${UPLOADS_URL}/covers/${mangaId}/${filename}.256.jpg`;
}

// Search Manga
export async function searchManga(query: string = "", limit = 20, offset = 0): Promise<Manga[]> {
    const cacheKey = `search:${query}:${limit}:${offset}`;
    return cacheWrap(cacheKey, async () => {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
                "order[followedCount]": "desc",
            });

            params.append("includes[]", "cover_art");
            params.append("includes[]", "author");
            params.append("contentRating[]", "safe");
            params.append("contentRating[]", "suggestive");

            if (query) {
                params.append("title", query);
            }

            const url = `${MANGADEX_API_URL}/manga?${params.toString()}`;
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
                    cover: coverFileName ? getCoverUrl(item.id, coverFileName) : "/placeholder.png",
                    author: authorRel?.attributes?.name || "Unknown Author",
                    authorId: authorRel?.id,
                    tags: attributes.tags.map((t: any) => t.attributes.name.en),
                    status: attributes.status,
                    year: attributes.year,
                };
            });
        } catch (error) {
            console.error("MangaDex Search Error:", error);
            return [];
        }
    });
}

// Get Author Details
export async function getAuthorDetails(authorId: string) {
    const cacheKey = `author:${authorId}`;
    return cacheWrap(cacheKey, async () => {
        try {
            const url = `${MANGADEX_API_URL}/author/${authorId}`;
            const response = await axios.get(url);
            const attrs = response.data.data.attributes;
            return {
                id: response.data.data.id,
                name: attrs.name,
                biography: attrs.biography?.en || "",
                twitter: attrs.twitter || null,
                pixiv: attrs.pixiv || null,
                youtube: attrs.youtube || null,
            };
        } catch (error) {
            console.error("MangaDex Author Error:", error);
            return null;
        }
    });
}

// Get Manga by Author
export async function getMangaByAuthor(authorId: string, limit = 20, offset = 0): Promise<Manga[]> {
    const cacheKey = `author_manga:${authorId}:${limit}:${offset}`;
    return cacheWrap(cacheKey, async () => {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
                "authors[]": authorId,
                "order[followedCount]": "desc",
            });

            params.append("includes[]", "cover_art");
            params.append("includes[]", "author");
            params.append("contentRating[]", "safe");
            params.append("contentRating[]", "suggestive");

            const url = `${MANGADEX_API_URL}/manga?${params.toString()}`;
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
                    cover: coverFileName ? getCoverUrl(item.id, coverFileName) : "/placeholder.png",
                    author: authorRel?.attributes?.name || "Unknown Author",
                    authorId: authorRel?.id,
                    tags: attributes.tags.map((t: any) => t.attributes.name.en),
                    status: attributes.status,
                    year: attributes.year,
                };
            });
        } catch (error) {
            console.error("MangaDex Author Manga Error:", error);
            return [];
        }
    });
}
// Get Manga Statistics (Rating, Follows)
export async function getMangaStatistics(mangaIds: string[]) {
    const cacheKey = `stats:${mangaIds.sort().join(',')}`;
    return cacheWrap(cacheKey, async () => {
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
    });
}

// Get Manga Details
export async function getMangaDetails(id: string): Promise<Manga | null> {
    return cacheWrap(`details:${id}`, async () => {
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
                authorId: authorRel?.id,
                tags: attributes.tags.map((t: any) => t.attributes.name.en),
                status: attributes.status,
                year: attributes.year,
            };
        } catch (error) {
            console.error("MangaDex Details Error:", error);
            return null;
        }
    });
}

// Get Chapters
export async function getChapters(mangaId: string, limit = 100, offset = 0): Promise<Chapter[]> {
    const cacheKey = `chapters:${mangaId}:${limit}:${offset}`;
    return cacheWrap(cacheKey, async () => {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
                manga: mangaId,
                "translatedLanguage[]": "en",
                "order[chapter]": "desc",
            });

            const url = `${MANGADEX_API_URL}/chapter?${params.toString()}`;
            const response = await axios.get(url);

            return response.data.data
                .map((item: any) => {
                    // Check for official Bilibili Comics takedowns which were replaced by MangaDex placeholders
                    const isBilibiliTakedown = item.relationships?.some(
                        (rel: any) => rel.type === 'scanlation_group' && rel.id === '17fb59e5-718c-4a1a-935d-d80dba70454a'
                    );

                    return {
                        id: item.id,
                        volume: item.attributes.volume,
                        chapter: item.attributes.chapter,
                        title: item.attributes.title,
                        publishAt: item.attributes.publishAt,
                        pages: item.attributes.pages,
                        externalUrl: isBilibiliTakedown ? "https://www.bilibilicomics.com" : item.attributes.externalUrl,
                    };
                })
                .filter((c: any) => {
                    if (c.externalUrl) return true;
                    return c.pages > 0;
                });
        } catch (error) {
            console.error("MangaDex Chapters Error:", error);
            return [];
        }
    });
}

// Get Single Chapter Details
export async function getChapterDetails(chapterId: string): Promise<Chapter | null> {
    try {
        const url = `${MANGADEX_API_URL}/chapter/${chapterId}`;
        const response = await axios.get(url);
        const item = response.data.data;

        // Handle Bilibili Comics official takedowns
        const isBilibiliTakedown = item.relationships?.some(
            (rel: any) => rel.type === 'scanlation_group' && rel.id === '17fb59e5-718c-4a1a-935d-d80dba70454a'
        );

        return {
            id: item.id,
            volume: item.attributes.volume,
            chapter: item.attributes.chapter,
            title: item.attributes.title,
            publishAt: item.attributes.publishAt,
            pages: item.attributes.pages,
            externalUrl: isBilibiliTakedown ? "https://www.bilibilicomics.com" : item.attributes.externalUrl,
        };
    } catch (error) {
        console.error("MangaDex Chapter Details Error:", error);
        return null;
    }
}

// Get Chapter Pages
// Get Chapter Pages
export async function getChapterPages(chapterId: string): Promise<string[]> {
    try {
        // 1. Get Base URL
        const url = `${MANGADEX_API_URL}/at-home/server/${chapterId}`;
        const response = await axios.get(url);
        const { baseUrl, chapter } = response.data;

        // 2. Check Data Saver Setting
        let useDataSaver = false;
        if (typeof window !== 'undefined') {
            try {
                const { getLocal, STORAGE_KEYS } = require("./storage");
                const settings = getLocal(STORAGE_KEYS.SETTINGS, { dataSaver: false });
                useDataSaver = settings.dataSaver;
            } catch (e) {
                // Ignore error, default to high quality
            }
        }

        const mode = useDataSaver ? "data-saver" : "data";
        const fileList = useDataSaver ? chapter.dataSaver : chapter.data;

        // 3. Construct Page URLs
        return fileList.map((filename: string) =>
            `${baseUrl}/${mode}/${chapter.hash}/${filename}`
        );
    } catch (error) {
        console.error("MangaDex Pages Error:", error);
        throw error; // Rethrow to let UI handle it
    }
}

// Get Featured Manga (Curated list for Home - Dynamic Top Followed)
export async function getFeaturedManga(): Promise<Manga[]> {
    return cacheWrap('featured', async () => {
        try {
            const params = new URLSearchParams({
                limit: "12",
                offset: "0",
                "order[followedCount]": "desc",
                "contentRating[]": "safe",
            });

            params.append("includes[]", "cover_art");
            params.append("includes[]", "author");

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
                    authorId: authorRel?.id,
                    tags: attributes.tags.map((t: any) => t.attributes.name.en),
                    status: attributes.status,
                    year: attributes.year,
                };
            });

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
    });
}

