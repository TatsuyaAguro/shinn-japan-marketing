-- =============================================
-- インバウンドマーケティング管理アプリ スキーマ
-- Supabase SQL Editorで実行してください
-- =============================================

-- ----- テーブル定義 -----

CREATE TABLE IF NOT EXISTS clients (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  region          text        NOT NULL DEFAULT '',
  category        text        NOT NULL DEFAULT '観光協会',
  target_market   text        NOT NULL DEFAULT '',
  tourist_resources text      DEFAULT '',
  budget          text        DEFAULT '未定',
  manager         text        DEFAULT '',
  status          text        NOT NULL DEFAULT 'draft',
  description     text        DEFAULT '',
  campaigns_count integer     NOT NULL DEFAULT 0,
  last_activity   date        DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive', 'draft'))
);

CREATE TABLE IF NOT EXISTS documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  storage_path text        NOT NULL,
  size_bytes   bigint      NOT NULL DEFAULT 0,
  file_type    text        NOT NULL DEFAULT 'other',
  uploaded_by  text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_name   text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role        text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE TABLE IF NOT EXISTS analyses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  storage_path text        DEFAULT '',
  format       text        NOT NULL DEFAULT 'pdf',
  status       text        NOT NULL DEFAULT 'draft',
  size_bytes   bigint      DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_format_check CHECK (format IN ('pdf', 'pptx')),
  CONSTRAINT proposals_status_check CHECK (status IN ('draft', 'delivered'))
);

-- ----- updated_at 自動更新トリガー -----

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS analyses_updated_at ON analyses;
CREATE TRIGGER analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----- インデックス -----

CREATE INDEX IF NOT EXISTS documents_client_id_idx  ON documents(client_id);
CREATE INDEX IF NOT EXISTS comments_client_id_idx   ON comments(client_id);
CREATE INDEX IF NOT EXISTS chat_messages_client_id_idx ON chat_messages(client_id, created_at);
CREATE INDEX IF NOT EXISTS proposals_client_id_idx  ON proposals(client_id);

-- ----- Row Level Security -----

ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals     ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは全操作可（チーム内部ツール想定）
DROP POLICY IF EXISTS "auth_all_clients"       ON clients;
DROP POLICY IF EXISTS "auth_all_documents"     ON documents;
DROP POLICY IF EXISTS "auth_all_comments"      ON comments;
DROP POLICY IF EXISTS "auth_all_chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "auth_all_analyses"      ON analyses;
DROP POLICY IF EXISTS "auth_all_proposals"     ON proposals;

CREATE POLICY "auth_all_clients"       ON clients       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_documents"     ON documents     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_comments"      ON comments      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_chat_messages" ON chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_analyses"      ON analyses      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_proposals"     ON proposals     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----- Supabase Storage バケット -----

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-documents', 'client-documents', false, 104857600)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_documents"   ON storage.objects;
DROP POLICY IF EXISTS "auth_read_documents"     ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_documents"   ON storage.objects;

CREATE POLICY "auth_upload_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "auth_read_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents');

CREATE POLICY "auth_delete_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents');
