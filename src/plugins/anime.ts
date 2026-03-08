import { registerPlugin } from '@capacitor/core';

interface AnimePlugin {
    playEpisode(options: { episodeId: string; title?: string }): Promise<{ success: boolean; url: string }>;
    clearCache(): Promise<{ cleared: boolean }>;
}

export const Anime = registerPlugin<AnimePlugin>('Anime');
