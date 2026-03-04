-- Migration script to add highlighted comments to Sakura
ALTER TABLE public.chapter_comments ADD COLUMN IF NOT EXISTS is_highlighted boolean default false;
ALTER TABLE public.chapter_comments ADD COLUMN IF NOT EXISTS highlight_tx text;

-- Update the comments schema file to track this change permanently
