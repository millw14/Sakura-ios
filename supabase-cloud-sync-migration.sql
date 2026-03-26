-- Sakura Cloud Sync - Supabase Migration
-- Run this in the Supabase SQL Editor

-- 1. User library (categories + items)
CREATE TABLE IF NOT EXISTS user_library (
    wallet_address text NOT NULL,
    data jsonb NOT NULL DEFAULT '[]',
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (wallet_address)
);

-- 2. User settings
CREATE TABLE IF NOT EXISTS user_settings (
    wallet_address text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (wallet_address)
);

-- 3. Anime watch history
CREATE TABLE IF NOT EXISTS anime_history (
    wallet_address text NOT NULL,
    data jsonb NOT NULL DEFAULT '[]',
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (wallet_address)
);

-- 4. Manga chapter progress (read chapters + progress %)
CREATE TABLE IF NOT EXISTS manga_progress (
    wallet_address text NOT NULL,
    chapter_progress jsonb NOT NULL DEFAULT '{}',
    read_chapters jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (wallet_address)
);

-- 5. Recent searches
CREATE TABLE IF NOT EXISTS user_searches (
    wallet_address text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (wallet_address)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_library_wallet ON user_library(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_settings_wallet ON user_settings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_anime_history_wallet ON anime_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_manga_progress_wallet ON manga_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_searches_wallet ON user_searches(wallet_address);

-- Enable RLS
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE manga_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_searches ENABLE ROW LEVEL SECURITY;

-- Permissive policies (anon key, client-side app)
CREATE POLICY "user_library_all" ON user_library FOR ALL USING (true);
CREATE POLICY "user_settings_all" ON user_settings FOR ALL USING (true);
CREATE POLICY "anime_history_all" ON anime_history FOR ALL USING (true);
CREATE POLICY "manga_progress_all" ON manga_progress FOR ALL USING (true);
CREATE POLICY "user_searches_all" ON user_searches FOR ALL USING (true);
