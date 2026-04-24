-- Migration: 自社応募履歴用ステータス・カラム追加
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて Run

-- CHECK制約を更新（新ステータス追加）
ALTER TABLE public.tog_cases DROP CONSTRAINT IF EXISTS tog_cases_status_check;
ALTER TABLE public.tog_cases ADD CONSTRAINT tog_cases_status_check
  CHECK (status IN (
    'new', 'considering', 'preparing', 'applied', 'waiting',
    'accepted', 'rejected', 'passed', 'dismissed', 'archive',
    'passed_unrelated', 'passed_prep'
  ));

-- 結果記録日時カラムを追加
ALTER TABLE public.tog_cases ADD COLUMN IF NOT EXISTS result_recorded_at TIMESTAMPTZ;

-- 既存の dismissed → passed_unrelated に移行
UPDATE public.tog_cases SET status = 'passed_unrelated' WHERE status = 'dismissed';
