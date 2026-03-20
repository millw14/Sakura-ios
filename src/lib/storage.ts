import { Preferences } from '@capacitor/preferences';

export const STORAGE_KEYS = {
    FAVORITES: 'sakura_favorites',
    HISTORY: 'sakura_history',
    SETTINGS: 'sakura_settings',
    READING_MODE: 'sakura_reading_mode',
    CHAPTER_CACHE: 'sakura_chapter_cache',
    READ_CHAPTERS: 'sakura_read_chapters',
    CHAPTER_PROGRESS: 'sakura_chapter_progress',
    RECENT_SEARCHES: 'sakura_recent_searches',
    COMMENTS_CACHE: 'sakura_comments_cache',
    PROFILES_CACHE: 'sakura_profiles_cache',
    WALLET_ADDRESS: 'sakura_wallet_address',
    CONNECTED_WALLET_NAME: 'sakura_connected_wallet_name',
    DOWNLOADS: 'sakura_downloads',
    ANIME_DOWNLOADS: 'sakura_anime_downloads',
    ANIME_WATCH_PROGRESS: 'sakura_anime_watch_progress',
    ANIME_HISTORY: 'sakura_anime_history',
    PASS_RECEIPTS: 'sakura_pass_receipts',
};

// ── Secure Storage (Capacitor Preferences) ──

export async function setSecure(key: string, value: any): Promise<void> {
    await Preferences.set({
        key,
        value: JSON.stringify(value)
    });
}

export async function getSecure<T>(key: string, defaultValue: T): Promise<T> {
    const { value } = await Preferences.get({ key });
    if (!value) return defaultValue;
    try {
        return JSON.parse(value);
    } catch (e) {
        return defaultValue;
    }
}

export async function removeSecure(key: string): Promise<void> {
    await Preferences.remove({ key });
}

// ── Local Storage (Synchronous) ──

export function getLocal<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
        return defaultValue;
    }
}

export function setLocal<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Error writing ${key} to localStorage`, e);
    }
}

export function removeLocal(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error(`Error removing ${key} from localStorage`, e);
    }
}

/* ── Read Chapter Tracking ── */

/** Threshold: chapter is "read" when progress >= this % */
export const READ_THRESHOLD = 85;

export function markChapterRead(mangaId: string, chapterId: string): void {
    const all = getLocal<Record<string, string[]>>(STORAGE_KEYS.READ_CHAPTERS, {});
    const list = all[mangaId] || [];
    if (!list.includes(chapterId)) {
        list.push(chapterId);
        all[mangaId] = list;
        setLocal(STORAGE_KEYS.READ_CHAPTERS, all);
    }
}

export function getReadChapters(mangaId: string): string[] {
    const all = getLocal<Record<string, string[]>>(STORAGE_KEYS.READ_CHAPTERS, {});
    return all[mangaId] || [];
}

/* ── Chapter Progress Tracking (Netflix-style) ── */

/**
 * Save reading progress for a chapter (0–100%).
 * Automatically marks the chapter as "read" if progress >= READ_THRESHOLD.
 */
export function setChapterProgress(mangaId: string, chapterId: string, percent: number): void {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));

    // Save progress
    const all = getLocal<Record<string, Record<string, number>>>(STORAGE_KEYS.CHAPTER_PROGRESS, {});
    if (!all[mangaId]) all[mangaId] = {};
    all[mangaId][chapterId] = clamped;
    setLocal(STORAGE_KEYS.CHAPTER_PROGRESS, all);

    // Auto-mark as read when threshold reached
    if (clamped >= READ_THRESHOLD) {
        markChapterRead(mangaId, chapterId);
    }
}

/**
 * Get reading progress for a chapter (0–100%).
 */
export function getChapterProgress(mangaId: string, chapterId: string): number {
    const all = getLocal<Record<string, Record<string, number>>>(STORAGE_KEYS.CHAPTER_PROGRESS, {});
    return all[mangaId]?.[chapterId] || 0;
}

/**
 * Get all chapter progress for a manga.
 * Returns { chapterId: percent }
 */
export function getAllChapterProgress(mangaId: string): Record<string, number> {
    const all = getLocal<Record<string, Record<string, number>>>(STORAGE_KEYS.CHAPTER_PROGRESS, {});
    return all[mangaId] || {};
}

/* ── Anime Watch History ── */

export interface AnimeHistoryEntry {
    animeId: string;
    episodeId: string;
    animeTitle: string;
    episodeTitle: string;
    episodeNumber: number;
    image?: string;
    timestamp: number;
}

const MAX_ANIME_HISTORY = 20;

export function saveAnimeWatchEntry(entry: AnimeHistoryEntry): void {
    const all = getLocal<AnimeHistoryEntry[]>(STORAGE_KEYS.ANIME_HISTORY, []);
    const filtered = all.filter(e => e.animeId !== entry.animeId);
    const updated = [entry, ...filtered].slice(0, MAX_ANIME_HISTORY);
    setLocal(STORAGE_KEYS.ANIME_HISTORY, updated);
}

export function getAnimeHistory(): AnimeHistoryEntry[] {
    return getLocal<AnimeHistoryEntry[]>(STORAGE_KEYS.ANIME_HISTORY, []);
}

/* ── Library System ── */

export interface LibraryItem {
    id: string;
    title: string;
    image?: string;
    type: 'anime' | 'manga';
    addedAt: number;
}

export interface LibraryCategory {
    name: string;
    items: LibraryItem[];
}

const LIBRARY_KEY = 'sakura_library';
const DEFAULT_CATEGORY = 'Default';

function getLibrary(): LibraryCategory[] {
    const lib = getLocal<LibraryCategory[]>(LIBRARY_KEY, []);
    if (lib.length === 0) return [{ name: DEFAULT_CATEGORY, items: [] }];
    if (!lib.find(c => c.name === DEFAULT_CATEGORY)) {
        lib.unshift({ name: DEFAULT_CATEGORY, items: [] });
    }
    return lib;
}

function saveLibrary(lib: LibraryCategory[]): void {
    setLocal(LIBRARY_KEY, lib);
}

export function getLibraryCategories(): LibraryCategory[] {
    return getLibrary();
}

export function addToLibrary(categoryName: string, item: LibraryItem): void {
    const lib = getLibrary();
    let cat = lib.find(c => c.name === categoryName);
    if (!cat) {
        cat = { name: categoryName, items: [] };
        lib.push(cat);
    }
    if (!cat.items.find(i => i.id === item.id && i.type === item.type)) {
        cat.items.unshift(item);
    }
    saveLibrary(lib);
}

export function removeFromLibrary(categoryName: string, itemId: string, itemType: 'anime' | 'manga'): void {
    const lib = getLibrary();
    const cat = lib.find(c => c.name === categoryName);
    if (cat) {
        cat.items = cat.items.filter(i => !(i.id === itemId && i.type === itemType));
        saveLibrary(lib);
    }
}

export function createLibraryCategory(name: string): void {
    const lib = getLibrary();
    if (!lib.find(c => c.name === name)) {
        lib.push({ name, items: [] });
        saveLibrary(lib);
    }
}

export function deleteLibraryCategory(name: string): void {
    if (name === DEFAULT_CATEGORY) return;
    const lib = getLibrary().filter(c => c.name !== name);
    saveLibrary(lib);
}

export function getItemCategories(itemId: string, itemType: 'anime' | 'manga'): string[] {
    return getLibrary()
        .filter(c => c.items.some(i => i.id === itemId && i.type === itemType))
        .map(c => c.name);
}

export function isInLibrary(itemId: string, itemType: 'anime' | 'manga'): boolean {
    return getLibrary().some(c => c.items.some(i => i.id === itemId && i.type === itemType));
}
