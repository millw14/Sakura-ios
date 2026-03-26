-- Sakura Novel System - Supabase Migration
-- Run this in the Supabase SQL Editor

-- 1. Novels table
CREATE TABLE IF NOT EXISTS novels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_wallet text NOT NULL,
    title text NOT NULL,
    description text DEFAULT '',
    cover_url text DEFAULT '',
    genres text[] DEFAULT '{}',
    status text DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'hiatus')),
    language text DEFAULT 'en',
    free_until_chapter int DEFAULT 3,
    paid_from_chapter int DEFAULT 4,
    price_per_chapter numeric DEFAULT 3,
    allow_pass boolean DEFAULT true,
    published boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Novel chapters
CREATE TABLE IF NOT EXISTS novel_chapters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number int NOT NULL,
    title text DEFAULT '',
    content text DEFAULT '',
    word_count int DEFAULT 0,
    is_free_override boolean DEFAULT false,
    published boolean DEFAULT false,
    release_time timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(novel_id, chapter_number)
);

-- 3. Novel unlocks (payment records)
CREATE TABLE IF NOT EXISTS novel_unlocks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_wallet text NOT NULL,
    novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number int NOT NULL,
    tx_signature text NOT NULL,
    amount numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_wallet, novel_id, chapter_number)
);

-- 4. Novel reading progress
CREATE TABLE IF NOT EXISTS novel_progress (
    user_wallet text NOT NULL,
    novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number int DEFAULT 1,
    scroll_position float DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_wallet, novel_id)
);

-- 5. Novel milestones
CREATE TABLE IF NOT EXISTS novel_milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_wallet text NOT NULL,
    novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
    milestone_type text NOT NULL CHECK (milestone_type IN ('unlock', 'complete', 'support', 'early_reader', 'first_100')),
    chapter_number int,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_wallet, novel_id, milestone_type, chapter_number)
);

-- 6. Novel comments
CREATE TABLE IF NOT EXISTS novel_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_wallet text NOT NULL,
    novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number int,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_novels_creator ON novels(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_novels_published ON novels(published);
CREATE INDEX IF NOT EXISTS idx_novel_chapters_novel ON novel_chapters(novel_id);
CREATE INDEX IF NOT EXISTS idx_novel_unlocks_user ON novel_unlocks(user_wallet, novel_id);
CREATE INDEX IF NOT EXISTS idx_novel_progress_user ON novel_progress(user_wallet);
CREATE INDEX IF NOT EXISTS idx_novel_milestones_user ON novel_milestones(user_wallet, novel_id);
CREATE INDEX IF NOT EXISTS idx_novel_comments_novel ON novel_comments(novel_id, chapter_number);

-- Enable RLS
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_comments ENABLE ROW LEVEL SECURITY;

-- Permissive policies (anon key, client-side app)
CREATE POLICY "novels_public_read" ON novels FOR SELECT USING (true);
CREATE POLICY "novels_creator_write" ON novels FOR ALL USING (true);
CREATE POLICY "chapters_public_read" ON novel_chapters FOR SELECT USING (true);
CREATE POLICY "chapters_creator_write" ON novel_chapters FOR ALL USING (true);
CREATE POLICY "unlocks_all" ON novel_unlocks FOR ALL USING (true);
CREATE POLICY "progress_all" ON novel_progress FOR ALL USING (true);
CREATE POLICY "milestones_all" ON novel_milestones FOR ALL USING (true);
CREATE POLICY "comments_all" ON novel_comments FOR ALL USING (true);
