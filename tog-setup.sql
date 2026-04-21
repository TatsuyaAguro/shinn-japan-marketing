-- =====================================================
-- ToG（自治体公募案件）管理機能 セットアップSQL
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tog_cases (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT        NOT NULL,
  organization            TEXT        NOT NULL DEFAULT '',
  prefecture              TEXT        NOT NULL DEFAULT '',
  category                TEXT        NOT NULL DEFAULT '',
  description             TEXT        NOT NULL DEFAULT '',
  budget                  NUMERIC     DEFAULT 0,
  deadline                DATE,
  recruitment_date        TEXT        DEFAULT '',
  winner                  TEXT        DEFAULT '',
  url                     TEXT        DEFAULT '',
  status                  TEXT        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','considering','preparing','applied','waiting','accepted','rejected','passed','archive')),
  priority                TEXT        DEFAULT '',
  ai_score                INTEGER     DEFAULT 0 CHECK (ai_score BETWEEN 0 AND 5),
  ai_reason               TEXT        DEFAULT '',
  ai_matching_services    JSONB       DEFAULT '[]',
  ai_action_recommendation TEXT       DEFAULT '',
  analysis_data           JSONB       DEFAULT '{}',
  prediction_data         JSONB       DEFAULT '{}',
  gdrive_link             TEXT        DEFAULT '',
  memo                    TEXT        DEFAULT '',
  assigned_to             TEXT        DEFAULT '',
  linked_client_id        UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  status_history          JSONB       DEFAULT '[]',
  uploaded_files          JSONB       DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER tog_cases_updated_at
  BEFORE UPDATE ON public.tog_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tog_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users full access" ON public.tog_cases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon full access tog_cases" ON public.tog_cases
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 未来予測の保存テーブル
CREATE TABLE IF NOT EXISTS public.tog_predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prefecture      TEXT        NOT NULL,
  organization    TEXT        DEFAULT '',
  prediction_data JSONB       NOT NULL DEFAULT '{}',
  chat_messages   JSONB       DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER tog_predictions_updated_at
  BEFORE UPDATE ON public.tog_predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tog_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users full access" ON public.tog_predictions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon full access tog_predictions" ON public.tog_predictions
  FOR ALL TO anon USING (true) WITH CHECK (true);
