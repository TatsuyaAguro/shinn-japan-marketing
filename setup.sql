-- ① clients（クライアント情報）
create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  region           text not null default '',
  category         text not null default '',
  target_market    text not null default '',
  tourist_resources text not null default '',
  budget           text not null default '未定',
  manager          text not null default '',
  status           text not null default 'draft' check (status in ('active','inactive','draft')),
  description      text not null default '',
  campaigns_count  integer not null default 0,
  last_activity    date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ② documents（アップロード資料）
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  size_bytes   bigint not null default 0,
  file_type    text not null default '',
  uploaded_by  text not null default '',
  created_at   timestamptz not null default now()
);

-- ③ comments（コメント）
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  user_name  text not null default '',
  content    text not null,
  created_at timestamptz not null default now()
);

-- ④ chat_messages（AIチャット履歴）
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- ⑤ analyses（市場分析結果）
create table if not exists public.analyses (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null default '',
  content    text not null,
  ai_model   text not null default '',
  created_at timestamptz not null default now()
);

-- ⑥ proposals（提案書）
create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  file_name    text not null,
  storage_path text not null,
  format       text not null default 'pdf' check (format in ('pdf','pptx')),
  status       text not null default 'draft' check (status in ('draft','delivered')),
  size_bytes   bigint not null default 0,
  created_at   timestamptz not null default now()
);

-- ⑦ schedules（施策スケジュール）
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  manager     text not null default '',
  status      text not null default 'pending' check (status in ('pending','in_progress','completed','proposed')),
  memo        text not null default '',
  color       text not null default '#3b82f6',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at 自動更新トリガー
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- Row Level Security 有効化
alter table public.clients       enable row level security;
alter table public.documents     enable row level security;
alter table public.comments      enable row level security;
alter table public.chat_messages enable row level security;
alter table public.analyses      enable row level security;
alter table public.proposals     enable row level security;

-- 認証済みユーザーに全操作を許可
create policy "authenticated users can do everything" on public.clients
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.documents
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.comments
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.chat_messages
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.analyses
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.proposals
  for all to authenticated using (true) with check (true);

-- schedules トリガー & RLS
create or replace trigger schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

alter table public.schedules enable row level security;
create policy "authenticated users can do everything" on public.schedules
  for all to authenticated using (true) with check (true);

-- =====================================================
-- AI戦略室 マイグレーション v2
-- =====================================================

-- strategy_status の制約を一旦削除して再作成
alter table public.clients
  drop constraint if exists clients_strategy_status_check;

-- clients テーブルに戦略カラムを追加（存在しない場合のみ）
alter table public.clients
  add column if not exists strategy_data        jsonb,
  add column if not exists branding_story       text,
  add column if not exists direction_summary    text,
  add column if not exists confirmed_strategies jsonb,
  add column if not exists share_token          text unique,
  add column if not exists strategy_status      text default 'initial',
  add column if not exists strategy_versions    jsonb default '[]'::jsonb,
  add column if not exists uploaded_files       jsonb default '[]'::jsonb;

-- strategy_status に新しい制約を追加
alter table public.clients
  add constraint clients_strategy_status_check
    check (strategy_status in ('initial','hearing','analyzing','confirmed'));

-- 共有URLで公開された戦略レポートへの匿名アクセスを許可（重複しないよう）
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clients' and policyname = 'public can read shared clients'
  ) then
    create policy "public can read shared clients" on public.clients
      for select using (share_token is not null);
  end if;
end $$;

-- =====================================================
-- ROI試算タブ マイグレーション v3
-- =====================================================

-- ROIチャット履歴（clients テーブルに JSONB で保存）
alter table public.clients
  add column if not exists roi_chat_messages jsonb default '[]'::jsonb;

-- =====================================================
-- Supabase Storage バケット（Dashboardで手動作成すること）
-- =====================================================
-- バケット名: strategy-docs
-- 公開設定: Private
-- RLS: 認証済みユーザーに full access
-- INSERT/SELECT/DELETE ポリシーを追加:
--   CREATE POLICY "auth users manage strategy docs" ON storage.objects
--     FOR ALL TO authenticated USING (bucket_id = 'strategy-docs')
--     WITH CHECK (bucket_id = 'strategy-docs');
