/**
 * Simple in-memory cache with TTL.
 * Prevents re-fetching when navigating between pages.
 * Data survives within a single session (cleared on full reload).
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function cacheGet<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
    store.set(key, { data, expiresAt: Date.now() + ttl });
}

/**
 * Wraps an async fetch function with caching.
 * If cached data exists and isn't expired, returns it immediately.
 * Otherwise calls fetchFn, caches the result, and returns it.
 */
export async function cacheWrap<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl = DEFAULT_TTL
): Promise<T> {
    const cached = cacheGet<T>(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    cacheSet(key, data, ttl);
    return data;
}
