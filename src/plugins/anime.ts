import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface DownloadProgressEvent {
    episodeId: string;
    progress: number;
    state: 'extracting' | 'downloading' | 'completed' | 'error';
    filePath?: string;
}

export interface PlaybackEndedEvent {
    episodeId: string;
    completed: boolean;
}

interface AnimePlugin {
    playEpisode(options: {
        streamUrl: string;
        referer?: string;
        title?: string;
        episodeId?: string;
        hasNext?: boolean;
        nextEpisodeTitle?: string;
    }): Promise<{ success: boolean; completed: boolean }>;

    playLocalEpisode(options: {
        filePath: string;
        title?: string;
        episodeId?: string;
        hasNext?: boolean;
        nextEpisodeTitle?: string;
    }): Promise<{ success: boolean; completed: boolean }>;

    downloadEpisode(options: {
        episodeId: string;
        m3u8Url: string;
        title?: string;
        animeTitle?: string;
    }): Promise<{ success: boolean; filePath?: string }>;

    clearCache(): Promise<{ cleared: boolean }>;
    addListener(eventName: 'downloadProgress', handler: (event: DownloadProgressEvent) => void): Promise<PluginListenerHandle>;
    addListener(eventName: 'playbackEnded', handler: (event: PlaybackEndedEvent) => void): Promise<PluginListenerHandle>;
}

export const Anime = registerPlugin<AnimePlugin>('Anime');
