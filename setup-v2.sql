-- =====================================================
-- marketing app マイグレーション v2（setup-v2.sql）
-- setup.sql を実行済みの環境に追加で適用する
-- =====================================================

-- ① clients テーブル追加カラム（すでに存在する場合は IF NOT EXISTS で対応）
alter table public.clients
  add column if not exists strategy_data        jsonb    default '{}'::jsonb,
  add column if not exists branding_story       text     default '',
  add column if not exists direction_summary    text     default '',
  add column if not exists confirmed_strategies jsonb    default '[]'::jsonb,
  add column if not exists share_token          text,
  add column if not exists strategy_status      text     default 'initial',
  add column if not exists strategy_versions    jsonb    default '[]'::jsonb,
  add column if not exists uploaded_files       jsonb    default '[]'::jsonb,
  add column if not exists roi_chat_messages    jsonb    default '[]'::jsonb;

-- share_token UNIQUE 制約（既存の場合はスキップ）
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clients'::regclass and conname = 'clients_share_token_key'
  ) then
    alter table public.clients add constraint clients_share_token_key unique (share_token);
  end if;
end $$;

-- strategy_status CHECK 制約（既存を削除して再作成）
alter table public.clients
  drop constraint if exists clients_strategy_status_check;
alter table public.clients
  add constraint clients_strategy_status_check
    check (strategy_status in ('initial','hearing','analyzing','confirmed'));

-- 共有URLへの匿名アクセスポリシー（重複なし）
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clients' and policyname = 'public can read shared clients'
  ) then
    create policy "public can read shared clients" on public.clients
      for select using (share_token is not null);
  end if;
end $$;

-- ② schedules テーブル追加カラム
alter table public.schedules
  add column if not exists category            text    default 'other',
  add column if not exists budget_allocation   numeric default 0,
  add column if not exists is_ai_suggested     boolean default false,
  add column if not exists source_strategy_id  text    default '';

-- schedules status CHECK（'proposed' 含む）
alter table public.schedules
  drop constraint if exists schedules_status_check;
alter table public.schedules
  add constraint schedules_status_check
    check (status in ('pending','in_progress','completed','proposed'));

-- ③ roi_calculations テーブル（ROI計算結果のスナップショット保存用）
create table if not exists public.roi_calculations (
  id               uuid        primary key default gen_random_uuid(),
  client_id        uuid        not null references public.clients(id) on delete cascade,
  calculation_data jsonb       not null default '{}',
  scenario         text        not null default 'standard',
  version          integer     not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace trigger roi_calculations_updated_at
  before update on public.roi_calculations
  for each row execute function public.set_updated_at();

alter table public.roi_calculations enable row level security;
create policy "authenticated users can do everything" on public.roi_calculations
  for all to authenticated using (true) with check (true);

-- ④ roi_parameters テーブル（業界平均値のマスタ）
create table if not exists public.roi_parameters (
  id               uuid        primary key default gen_random_uuid(),
  parameter_name   text        not null,
  default_value    numeric     not null,
  source           text        not null default '業界平均',
  category         text        not null default 'general',
  description      text        default '',
  is_custom        boolean     default false,
  created_at       timestamptz not null default now()
);

alter table public.roi_parameters enable row level security;
create policy "authenticated users can do everything" on public.roi_parameters
  for all to authenticated using (true) with check (true);
create policy "anyone can read roi_parameters" on public.roi_parameters
  for select using (true);

-- デフォルトパラメータ INSERT（重複しないよう ON CONFLICT DO NOTHING 使用）
alter table public.roi_parameters
  add constraint if not exists roi_parameters_name_key unique (parameter_name);

insert into public.roi_parameters (parameter_name, default_value, source, category, description)
values
  ('instagram_cpm',           2500, 'Meta Business Suite 2025',    'advertising', 'Instagram海外向け観光広告のCPM（¥）'),
  ('youtube_cpm',             3000, 'Google Ads 2025',              'advertising', 'YouTube海外向け観光広告のCPM（¥）'),
  ('influencer_cpm',           800, '業界平均 2025',                'advertising', 'インフルエンサー施策のCPM（¥）'),
  ('instagram_engagement_rate',2.0, 'HubSpot 2025',                'engagement',  'Instagramエンゲージメント率（%）'),
  ('instagram_ctr',            1.2, 'WordStream 2025',              'conversion',  'Instagram広告CTR（%）'),
  ('youtube_ctr',              0.8, 'Google Ads 2025',              'conversion',  'YouTube広告CTR（%）'),
  ('website_cvr',              2.0, '観光業界平均 2025',            'conversion',  '自社サイトCVR（%）'),
  ('ota_cvr',                  4.0, '観光業界平均 2025',            'conversion',  'OTA経由CVR（%）'),
  ('frequency',                3,   'Meta推奨値',                   'reach',       'フリークエンシー（回）'),
  ('no_show_rate',             5,   '観光業界平均',                 'conversion',  'ノーショー率（%）'),
  ('wom_multiplier',           2.3, 'TripAdvisor調査 2024',         'indirect',    '口コミ乗数'),
  ('awareness_decay_rate',     5,   'マーケティング理論値',         'indirect',    '認知減衰率（月 %）'),
  ('repeat_rate',              7,   '地方観光平均',                 'indirect',    'リピート率（%）'),
  ('economic_multiplier',      1.4, '観光庁経済波及効果モデル',    'indirect',    '地域経済乗数効果')
on conflict (parameter_name) do nothing;

-- ⑤ Supabase Realtime 有効化
-- ※ Supabase Dashboard の Replication → Source Tables でも設定必要
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.schedules;

-- =====================================================
-- Supabase Storage バケット（Dashboardで手動作成）
-- バケット名: strategy-docs / Private
-- =====================================================
