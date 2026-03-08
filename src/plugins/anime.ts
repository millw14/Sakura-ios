import { registerPlugin } from '@capacitor/core';

interface AnimePlugin {
    playEpisode(options: { episodeId: string; title?: string }): Promise<{ success: boolean; url: string }>;
    searchHiAnime(options: { query: string }): Promise<{ results: string }>;
    getEpisodes(options: { animeId: string }): Promise<{ episodes: string }>;
    clearCache(): Promise<{ cleared: boolean }>;
}

export const Anime = registerPlugin<AnimePlugin>('Anime');
