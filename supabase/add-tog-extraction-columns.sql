-- Migration: AIスクリーニング抽出カラムを tog_cases に追加
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて Run

ALTER TABLE public.tog_cases ADD COLUMN IF NOT EXISTS budget_note    TEXT;
ALTER TABLE public.tog_cases ADD COLUMN IF NOT EXISTS deadline_note  TEXT;
ALTER TABLE public.tog_cases ADD COLUMN IF NOT EXISTS url_source_type TEXT;
