-- =============================================
-- プロジェクト設計機能 マイグレーション
-- Supabase SQL Editorで実行してください
-- =============================================

-- analyses テーブルに title/content/ai_model カラムを追加
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS title     text NOT NULL DEFAULT '';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS content   text NOT NULL DEFAULT '';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS ai_model  text DEFAULT 'claude-sonnet-4-6';

CREATE INDEX IF NOT EXISTS analyses_client_title_idx ON analyses(client_id, title);

-- clients テーブルにプロジェクト設計カラムを追加
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hearing_data          jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS analysis_report       jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS direction_summary     text  DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS selected_strategies   jsonb DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS project_design_status text  DEFAULT 'new';

-- schedules テーブルが未作成の場合は作成
CREATE TABLE IF NOT EXISTS schedules (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  start_date  date          NOT NULL,
  end_date    date          NOT NULL,
  manager     text          NOT NULL DEFAULT '',
  status      text          NOT NULL DEFAULT 'pending',
  memo        text          NOT NULL DEFAULT '',
  color       text          NOT NULL DEFAULT '#3B82F6',
  sort_order  integer       NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT schedules_status_check CHECK (status IN ('pending','in_progress','completed','proposed'))
);

CREATE INDEX IF NOT EXISTS schedules_client_id_idx ON schedules(client_id);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_schedules" ON schedules;
CREATE POLICY "auth_all_schedules" ON schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS schedules_updated_at ON schedules;
CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
