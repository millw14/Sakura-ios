import { Manga, Chapter, MangaSource } from './types';
import * as api from '../mangadex'; // Import existing functions

export class MangaDexSource implements MangaSource {
    name = "MangaDex";
    id = "mangadex";

    async searchManga(query: string, limit = 20, offset = 0): Promise<Manga[]> {
        const results = await api.searchManga(query, limit, offset);
        return results.map(m => ({
            ...m,
            sourceStr: this.id
        }));
    }

    async getMangaDetails(id: string): Promise<Manga | null> {
        const manga = await api.getMangaDetails(id);
        if (!manga) return null;
        return {
            ...manga,
            sourceStr: this.id
        };
    }

    async getChapters(mangaId: string, limit = 100, offset = 0): Promise<Chapter[]> {
        const chapters = await api.getChapters(mangaId, limit, offset);
        return chapters.map(c => ({
            ...c,
            mangaId: mangaId,
            sourceStr: this.id
        }));
    }

    async getChapterPages(chapterId: string): Promise<string[]> {
        return await api.getChapterPages(chapterId);
    }

    async getTrending(limit = 20): Promise<Manga[]> {
        const results = await api.getFeaturedManga();
        return results.map(m => ({
            ...m,
            sourceStr: this.id
        }));
    }
}
