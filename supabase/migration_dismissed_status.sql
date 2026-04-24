-- Migration: 'dismissed' ステータスを tog_cases に追加
-- 実行方法: Supabase Dashboard > SQL Editor に貼り付けて Run

ALTER TABLE tog_cases
  DROP CONSTRAINT IF EXISTS tog_cases_status_check;

ALTER TABLE tog_cases
  ADD CONSTRAINT tog_cases_status_check
  CHECK (status IN (
    'new', 'considering', 'preparing', 'applied', 'waiting',
    'accepted', 'rejected', 'passed', 'dismissed', 'archive'
  ));
