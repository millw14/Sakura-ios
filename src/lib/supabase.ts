import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Safe initialization for build/dev without keys
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export interface FavoriteManga {
    wallet_address: string;
    manga_id: string;
    title: string;
    cover_url: string;
    created_at: string;
}

export interface ReadingHistory {
    wallet_address: string;
    manga_id: string;
    chapter_id: string;
    last_page: number;
    updated_at: string;
}

// ============ Favorites ============

export async function getFavorites(walletAddress: string): Promise<FavoriteManga[]> {
    if (!walletAddress || !supabase) return [];

    const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching favorites:", error);
        return [];
    }
    return data || [];
}

export async function addFavorite(walletAddress: string, manga: { id: string, title: string, cover: string }) {
    if (!walletAddress || !supabase) return;

    const { error } = await supabase
        .from("favorites")
        .upsert({
            wallet_address: walletAddress,
            manga_id: manga.id,
            title: manga.title,
            cover_url: manga.cover,
        }, { onConflict: "wallet_address, manga_id" });

    if (error) console.error("Error adding favorite:", error);
}

export async function removeFavorite(walletAddress: string, mangaId: string) {
    if (!walletAddress || !supabase) return;

    const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("wallet_address", walletAddress)
        .eq("manga_id", mangaId);

    if (error) console.error("Error removing favorite:", error);
}

// ============ History ============

export async function getHistory(walletAddress: string): Promise<ReadingHistory[]> {
    if (!walletAddress || !supabase) return [];

    const { data, error } = await supabase
        .from("reading_history")
        .select("*")
        .eq("wallet_address", walletAddress)
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("Error fetching history:", error);
        return [];
    }
    return data || [];
}

export async function updateHistory(
    walletAddress: string,
    mangaId: string,
    chapterId: string,
    page: number
) {
    if (!walletAddress || !supabase) return;

    const { error } = await supabase
        .from("reading_history")
        .upsert({
            wallet_address: walletAddress,
            manga_id: mangaId,
            chapter_id: chapterId,
            last_page: page,
            updated_at: new Date().toISOString(),
        }, { onConflict: "wallet_address, manga_id" });

    if (error) console.error("Error updating history:", error);
}
