import { MangaSource } from './types';
// import { MangaDexSource } from './mangadex';
import { WeebCentralSource } from './weebcentral';

// const mangadex = new MangaDexSource();
const weebcentral = new WeebCentralSource();

// Registry
const sources: Record<string, MangaSource> = {
    // [mangadex.id]: mangadex,
    [weebcentral.id]: weebcentral,
};

export function getSource(id: string): MangaSource {
    return sources[id] || weebcentral; // Default to WC
}

export function getAllSources(): MangaSource[] {
    return Object.values(sources);
}

// Multi-source Search
export async function searchAllSources(query: string) {
    // Run in parallel
    const promises = Object.values(sources).map(s => s.searchManga(query).catch(e => {
        console.error(`Search failed for ${s.name}:`, e);
        return [];
    }));

    const results = await Promise.all(promises);
    return results.flat();
}
