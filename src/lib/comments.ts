import { supabase } from "./supabase";
import { getLocal, setLocal, STORAGE_KEYS } from "./storage";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface UserProfile {
    wallet_address: string;
    display_name: string | null;
    bio: string | null;
    avatar_seed: string;
    has_pass: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChapterComment {
    id: number;
    wallet_address: string;
    manga_id: string;
    chapter_id: string;
    content: string;
    created_at: string;
    edited: boolean;
    is_highlighted?: boolean;
    highlight_tx?: string;
    // Joined/enriched fields
    profile?: UserProfile | null;
    reactions?: ReactionSummary[];
}

export interface CommentReaction {
    id: number;
    comment_id: number;
    wallet_address: string;
    emoji: string;
}

export interface ReactionSummary {
    emoji: string;
    count: number;
    reacted: boolean; // whether current user reacted
}

/* Available emoji reactions */
export const REACTION_EMOJIS = ["🌸", "👍", "🔥", "😂", "💀", "❤️"];

/* Cache TTL */
const COMMENTS_TTL = 60_000;  // 60s
const PROFILES_TTL = 300_000; // 5min

/* ═══════════════════════════════════════════
   Profiles
   ═══════════════════════════════════════════ */

export async function getProfile(walletAddress: string): Promise<UserProfile | null> {
    if (!walletAddress || !supabase) return null;

    // Check local cache first
    const cacheKey = `profile_${walletAddress}`;
    const cached = getCachedData<UserProfile>(STORAGE_KEYS.PROFILES_CACHE, cacheKey, PROFILES_TTL);
    if (cached) return cached;

    const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows
        console.error("Error fetching profile:", error);
        return null;
    }

    if (data) {
        setCachedData(STORAGE_KEYS.PROFILES_CACHE, cacheKey, data);
    }

    return data || null;
}

export async function upsertProfile(
    walletAddress: string,
    displayName: string | null,
    hasPass: boolean,
    bio?: string | null
): Promise<UserProfile | null> {
    if (!walletAddress || !supabase) return null;

    const avatarSeed = walletAddress.slice(0, 8);

    const payload: Record<string, unknown> = {
        wallet_address: walletAddress,
        display_name: displayName,
        avatar_seed: avatarSeed,
        has_pass: hasPass,
        updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) payload.bio = bio?.slice(0, 140) || null;

    const { data, error } = await supabase
        .from("user_profiles")
        .upsert(payload, { onConflict: "wallet_address" })
        .select()
        .single();

    if (error) {
        console.error("Error updating profile:", error);
        return null;
    }

    if (data) {
        const cacheKey = `profile_${walletAddress}`;
        setCachedData(STORAGE_KEYS.PROFILES_CACHE, cacheKey, data);
    }

    return data;
}

export interface ProfileStats {
    chaptersRead: number;
    commentsPosted: number;
    reactionsReceived: number;
    favoritesCount: number;
    memberSince: string | null;
}

export async function getPublicProfile(walletAddress: string): Promise<{
    profile: UserProfile | null;
    favorites: { manga_id: string; title: string; cover_url: string }[];
    stats: ProfileStats;
}> {
    const profile = await getProfile(walletAddress);

    let favorites: { manga_id: string; title: string; cover_url: string }[] = [];
    let stats: ProfileStats = {
        chaptersRead: 0,
        commentsPosted: 0,
        reactionsReceived: 0,
        favoritesCount: 0,
        memberSince: profile?.created_at || null,
    };

    if (supabase) {
        // Favorites
        const { data: favData } = await supabase
            .from("favorites")
            .select("manga_id, title, cover_url")
            .eq("wallet_address", walletAddress)
            .order("created_at", { ascending: false })
            .limit(20);
        favorites = favData || [];
        stats.favoritesCount = favorites.length;

        // Chapters read (from reading_history)
        const { count: chapCount } = await supabase
            .from("reading_history")
            .select("*", { count: "exact", head: true })
            .eq("wallet_address", walletAddress);
        stats.chaptersRead = chapCount || 0;

        // Comments posted
        const { count: commentCount } = await supabase
            .from("chapter_comments")
            .select("*", { count: "exact", head: true })
            .eq("wallet_address", walletAddress);
        stats.commentsPosted = commentCount || 0;

        // Reactions received on their comments
        const { data: userComments } = await supabase
            .from("chapter_comments")
            .select("id")
            .eq("wallet_address", walletAddress);
        if (userComments && userComments.length > 0) {
            const ids = userComments.map((c: { id: number }) => c.id);
            const { count: rxCount } = await supabase
                .from("comment_reactions")
                .select("*", { count: "exact", head: true })
                .in("comment_id", ids);
            stats.reactionsReceived = rxCount || 0;
        }
    }

    return { profile, favorites, stats };
}

/* Batch fetch profiles for a list of wallets (for comment display) */
export async function getProfilesBatch(wallets: string[]): Promise<Record<string, UserProfile>> {
    if (!wallets.length || !supabase) return {};

    const result: Record<string, UserProfile> = {};
    const toFetch: string[] = [];

    // Check cache first
    for (const w of wallets) {
        const cached = getCachedData<UserProfile>(STORAGE_KEYS.PROFILES_CACHE, `profile_${w}`, PROFILES_TTL);
        if (cached) {
            result[w] = cached;
        } else {
            toFetch.push(w);
        }
    }

    if (toFetch.length > 0) {
        const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .in("wallet_address", toFetch);

        if (data) {
            for (const p of data) {
                result[p.wallet_address] = p;
                setCachedData(STORAGE_KEYS.PROFILES_CACHE, `profile_${p.wallet_address}`, p);
            }
        }
    }

    return result;
}

/* ═══════════════════════════════════════════
   Comments
   ═══════════════════════════════════════════ */

export async function getComments(
    mangaId: string,
    chapterId: string,
    currentWallet?: string
): Promise<ChapterComment[]> {
    if (!supabase) return [];

    // Check local cache
    const cacheKey = `${mangaId}:${chapterId}`;
    const cached = getCachedData<ChapterComment[]>(STORAGE_KEYS.COMMENTS_CACHE, cacheKey, COMMENTS_TTL);
    if (cached) return cached;

    // Fetch comments
    const { data: comments, error } = await supabase
        .from("chapter_comments")
        .select("*")
        .eq("manga_id", mangaId)
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching comments:", error);
        return [];
    }

    if (!comments || comments.length === 0) return [];

    // Batch fetch profiles
    const wallets = [...new Set(comments.map((c: ChapterComment) => c.wallet_address))];
    const profiles = await getProfilesBatch(wallets);

    // Batch fetch reactions
    const commentIds = comments.map((c: ChapterComment) => c.id);
    const reactions = await getReactionsBatch(commentIds, currentWallet);

    // Enrich comments
    const enriched: ChapterComment[] = comments.map((c: ChapterComment) => ({
        ...c,
        profile: profiles[c.wallet_address] || null,
        reactions: reactions[c.id] || [],
    }));

    // Cache
    setCachedData(STORAGE_KEYS.COMMENTS_CACHE, cacheKey, enriched);

    return enriched;
}

export async function postComment(
    walletAddress: string,
    mangaId: string,
    chapterId: string,
    content: string
): Promise<ChapterComment | null> {
    if (!walletAddress || !supabase || !content.trim()) return null;

    const { data, error } = await supabase
        .from("chapter_comments")
        .insert({
            wallet_address: walletAddress,
            manga_id: mangaId,
            chapter_id: chapterId,
            content: content.trim().slice(0, 500),
        })
        .select()
        .single();

    if (error) {
        console.error("Error posting comment:", error);
        return null;
    }

    // Invalidate cache for this chapter
    invalidateCache(STORAGE_KEYS.COMMENTS_CACHE, `${mangaId}:${chapterId}`);

    return data;
}

export async function deleteComment(commentId: number, walletAddress: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from("chapter_comments")
        .delete()
        .eq("id", commentId)
        .eq("wallet_address", walletAddress); // Only owner can delete

    if (error) {
        console.error("Error deleting comment:", error);
        return false;
    }

    return true;
}

/* ═══════════════════════════════════════════
   Reactions
   ═══════════════════════════════════════════ */

async function getReactionsBatch(
    commentIds: number[],
    currentWallet?: string
): Promise<Record<number, ReactionSummary[]>> {
    if (!commentIds.length || !supabase) return {};

    const { data, error } = await supabase
        .from("comment_reactions")
        .select("*")
        .in("comment_id", commentIds);

    if (error) {
        console.error("Error fetching reactions:", error);
        return {};
    }

    // Group by comment_id → emoji
    const result: Record<number, ReactionSummary[]> = {};

    for (const cid of commentIds) {
        const commentReactions = (data || []).filter((r: CommentReaction) => r.comment_id === cid);
        const emojiMap: Record<string, { count: number; reacted: boolean }> = {};

        for (const r of commentReactions) {
            if (!emojiMap[r.emoji]) {
                emojiMap[r.emoji] = { count: 0, reacted: false };
            }
            emojiMap[r.emoji].count++;
            if (currentWallet && r.wallet_address === currentWallet) {
                emojiMap[r.emoji].reacted = true;
            }
        }

        result[cid] = Object.entries(emojiMap).map(([emoji, info]) => ({
            emoji,
            count: info.count,
            reacted: info.reacted,
        }));
    }

    return result;
}

export async function toggleReaction(
    commentId: number,
    walletAddress: string,
    emoji: string
): Promise<boolean> {
    if (!supabase || !walletAddress) return false;

    // Check if already reacted
    const { data: existing } = await supabase
        .from("comment_reactions")
        .select("id")
        .eq("comment_id", commentId)
        .eq("wallet_address", walletAddress)
        .eq("emoji", emoji)
        .single();

    if (existing) {
        // Remove reaction
        await supabase
            .from("comment_reactions")
            .delete()
            .eq("id", existing.id);
        return false; // now un-reacted
    } else {
        // Add reaction
        await supabase
            .from("comment_reactions")
            .insert({
                comment_id: commentId,
                wallet_address: walletAddress,
                emoji,
            });
        return true; // now reacted
    }
}

/* ═══════════════════════════════════════════
   Cache Helpers (localStorage with timestamps)
   ═══════════════════════════════════════════ */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

function getCachedData<T>(storeKey: string, itemKey: string, ttl: number): T | null {
    try {
        const store = getLocal<Record<string, CacheEntry<T>>>(storeKey, {});
        const entry = store[itemKey];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > ttl) {
            delete store[itemKey];
            setLocal(storeKey, store);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

function setCachedData<T>(storeKey: string, itemKey: string, data: T): void {
    try {
        const store = getLocal<Record<string, CacheEntry<T>>>(storeKey, {});
        // Keep cache under 50 entries
        const keys = Object.keys(store);
        if (keys.length > 50) {
            const oldest = keys.sort((a, b) =>
                (store[a]?.timestamp || 0) - (store[b]?.timestamp || 0)
            );
            for (let i = 0; i < 10; i++) delete store[oldest[i]];
        }
        store[itemKey] = { data, timestamp: Date.now() };
        setLocal(storeKey, store);
    } catch {
        // localStorage full, ignore
    }
}

function invalidateCache(storeKey: string, itemKey: string): void {
    try {
        const store = getLocal<Record<string, unknown>>(storeKey, {});
        delete store[itemKey];
        setLocal(storeKey, store);
    } catch {
        // ignore
    }
}
