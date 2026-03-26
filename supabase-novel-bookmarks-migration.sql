-- Novel Bookmarks & Highlights (cloud sync)
CREATE TABLE IF NOT EXISTS novel_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet text NOT NULL,
  novel_id text NOT NULL,
  chapter_id text NOT NULL,
  source text NOT NULL DEFAULT 'sakura',
  type text NOT NULL CHECK (type IN ('bookmark', 'highlight')),
  position_percent float,
  selected_text text,
  note text,
  color text DEFAULT 'yellow',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_novel_bookmarks_user ON novel_bookmarks(user_wallet);
CREATE INDEX IF NOT EXISTS idx_novel_bookmarks_novel ON novel_bookmarks(novel_id, chapter_id);
ALTER TABLE novel_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON novel_bookmarks FOR ALL USING (true);

-- Novel Downloads Index (cloud sync - tracks what was downloaded so user can re-download on new device)
CREATE TABLE IF NOT EXISTS novel_downloads_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  data jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_novel_downloads_wallet ON novel_downloads_index(wallet_address);
ALTER TABLE novel_downloads_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own download index" ON novel_downloads_index FOR ALL USING (true);
