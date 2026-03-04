import { MangaSource } from './types';
import { MangaDexSource } from './mangadex';
// import { WeebCentralSource } from './weebcentral';

const mangadex = new MangaDexSource();
// const weebcentral = new WeebCentralSource();

// Registry
const sources: Record<string, MangaSource> = {
    [mangadex.id]: mangadex,
    // [weebcentral.id]: weebcentral,
};

export function getSource(id: string): MangaSource {
    return sources[id] || mangadex; // Default to MD
}

export function getAllSources(): MangaSource[] {
    return Object.values(sources);
}

// Multi-source Search with De-duplication
export async function searchAllSources(query: string) {
    const errors: any[] = [];

    // Run searches in parallel
    const promises = Object.values(sources).map(async s => {
        try {
            if (!query || query.trim() === "") {
                if (s.getTrending) {
                    return await s.getTrending();
                }
                return [];
            }
            return await s.searchManga(query);
        } catch (e) {
            console.error(`Search/Featured failed for ${s.name}:`, e);
            errors.push(e);
            return [];
        }
    });

    const rawResults = (await Promise.all(promises)).flat();

    // If no results and we had errors, throw appropriately
    if (rawResults.length === 0 && errors.length > 0) {
        // If all failed, throw first error
        if (errors.length === Object.keys(sources).length) throw errors[0];
    }

    // De-duplication / Merging Logic
    // We want to prioritize MangaDex. If a title exists in MD, show that.
    // If it ONLY exists in WeebCentral, show that.
    // Matching strategy: Normalized Title.

    // 1. Create a map of Title -> Result
    const uniqueMap = new Map<string, any>();

    for (const manga of rawResults) {
        const key = manga.title.toLowerCase().trim();

        // If not in map, add it
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, manga);
            continue;
        }

        // If already in map, check priority.
        // Priority: MangaDex > WeebCentral
        const existing = uniqueMap.get(key);
        if (existing.sourceStr !== 'mangadex' && manga.sourceStr === 'mangadex') {
            // Replace with MangaDex version
            uniqueMap.set(key, manga);
        }
    }

    return Array.from(uniqueMap.values());
}
