# プロジェクト引き継ぎ資料

**作成日**: 2026-04-27  
**引き継ぎ先**: SND さん  
**前担当**: AG  

---

## 1. プロジェクトの概要

### 何のアプリか

**インバウンドマーケティング管理システム**

SHINN JAPAN株式会社（訪日インバウンド向けDMC）の社内業務管理ツール。
以下の業務をひとつのアプリで一元管理できる。

| 機能 | 説明 |
|---|---|
| 顧客管理 | 旅行会社・代理店などの取引先を管理 |
| 戦略・施策管理 | マーケティング施策の立案・進捗管理 |
| ROI計算 | 施策の費用対効果シミュレーション |
| スケジュール管理 | プロジェクトのスケジュール計画 |
| **ToG管理** | 自治体公募案件の調査・応募・結果管理（メイン開発中） |
| 共有ページ | 外部向けの資料共有リンク発行 |

### 誰が使うか

SHINN JAPAN社内メンバー（MARI, KS, TMD, AG, JETH, SND）

---

## 2. 技術スタック

| 分類 | 内容 |
|---|---|
| フレームワーク | Next.js 16.2.2（App Router） |
| 言語 | TypeScript 5（strict モード） |
| スタイリング | Tailwind CSS 4 |
| データベース | Supabase（PostgreSQL） |
| 認証 | Supabase Auth（`@supabase/ssr`） |
| AI | Anthropic Claude API（`@anthropic-ai/sdk`） |
| グラフ | Recharts |
| PDF解析 | pdf-parse |
| Word解析 | mammoth |
| デプロイ | Vercel |
| 定期実行 | Vercel Cron Jobs |

---

## 3. フォルダ構成

```
marketing/
├── src/
│   ├── app/                         # ページ・APIルート（Next.js App Router）
│   │   ├── (dashboard)/             # ログイン後の画面
│   │   │   ├── home/                # トップページ（顧客一覧）
│   │   │   ├── dashboard/           # 顧客詳細
│   │   │   │   └── [id]/            # 顧客ID別ページ
│   │   │   └── tog/                 # ToG管理
│   │   │       ├── page.tsx         # ToGメイン（タブ切替）
│   │   │       └── [id]/            # 案件詳細ページ
│   │   ├── api/                     # APIルート
│   │   │   ├── tog/                 # ToG関連API
│   │   │   │   ├── research/        # AIリサーチ（手動実行）
│   │   │   │   ├── cron-research/   # AIリサーチ（定期実行）
│   │   │   │   ├── analyze/         # 案件分析
│   │   │   │   ├── predict/         # 先読みリサーチ
│   │   │   │   └── score/           # AIスコアリング
│   │   │   ├── ai-strategy/         # 戦略AI
│   │   │   ├── chat/                # AIチャット
│   │   │   ├── market-research/     # 市場調査AI
│   │   │   └── ...（その他AI系API）
│   │   ├── auth/                    # 認証コールバック
│   │   ├── login/                   # ログインページ
│   │   └── share/[token]/           # 外部共有ページ
│   │
│   ├── components/                  # UIコンポーネント
│   │   ├── tog/tabs/                # ToGタブコンポーネント（メイン開発箇所）
│   │   │   ├── NewCasesTab.tsx      # 新着案件タブ
│   │   │   ├── ActiveTab.tsx        # 対応中タブ（カンバン）
│   │   │   ├── ArchiveTab.tsx       # 過去案件タブ（サブタブあり）
│   │   │   └── PredictionTab.tsx    # 先読みリサーチタブ
│   │   ├── client/                  # 顧客管理コンポーネント
│   │   ├── layout/                  # ヘッダー・サイドバー等
│   │   └── _archive/               # 旧バージョン（使用しない）
│   │
│   └── lib/
│       ├── actions/                 # Supabaseとのデータ操作関数
│       │   ├── tog.ts               # ToG案件のCRUD操作
│       │   ├── clients.ts           # 顧客データ操作
│       │   └── ...
│       ├── types/
│       │   ├── tog.ts               # ToG関連の型定義・定数
│       │   └── strategy.ts
│       ├── supabase/                # Supabaseクライアント初期化
│       ├── tog-prompts.ts           # AIへの指示文（プロンプト）
│       └── tog-research-runner.ts   # AIリサーチの実行ロジック
│
├── supabase/                        # DBマイグレーションSQL
│   ├── schema.sql                   # テーブル定義（初期）
│   ├── tog-setup.sql                # ToGテーブル定義
│   ├── add-tog-extraction-columns.sql   # ★未実行の可能性あり
│   └── add-archive-distinction-columns.sql  # ★未実行の可能性あり
│
├── knowledge/                       # 会社情報・ナレッジベース
│   ├── company-profile.md
│   ├── services.md
│   ├── team.md
│   └── tools/
│
├── vercel.json                      # Vercel設定（Cronジョブ定義）
├── CLAUDE.md                        # このプロジェクト用のClaudeルール
└── handoff.md                       # この資料
```

---

## 4. 環境構築の手順

### 手順1: パッケージをインストールする

```bash
npm install
```

### 手順2: 環境変数ファイルを作成する

プロジェクトのルートに `.env.local` というファイルを作り、後述の「環境変数一覧」を設定する。  
（既存メンバーから値を共有してもらうこと）

### 手順3: 開発サーバーを起動する

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

### 手順4: Supabaseのテーブルを確認する

Supabase のダッシュボードにログインし、`supabase/schema.sql` と `supabase/tog-setup.sql` がすでに適用済みか確認する。  
未適用の場合は Supabase の「SQL Editor」で実行する。

### 手順5: 未適用のマイグレーションを確認する（重要）

以下のSQLが **まだ適用されていない可能性がある**。Supabase SQL Editor で確認・実行すること。

```
supabase/add-tog-extraction-columns.sql
supabase/add-archive-distinction-columns.sql
supabase/migration_dismissed_status.sql
```

---

## 5. 現在の開発状況

### 完成しているもの

| 機能 | 状態 |
|---|---|
| ログイン・認証（Supabase Auth） | 完成 |
| 顧客管理（一覧・詳細・追加） | 完成 |
| 戦略管理・ROI計算 | 完成 |
| **ToG ① 新着案件タブ** | 完成（AIスコア表示・見送りモーダル・案件詳細リンク） |
| **ToG ② 対応中タブ** | 完成（カンバンボード形式） |
| **ToG ③ 過去案件タブ** | 完成（サブタブ: 案件カードグリッド / 過去データベース表） |
| **ToG ④ 先読みリサーチタブ** | 完成 |
| **ToG 案件詳細ページ** `/tog/[id]` | 完成 |
| AI自動リサーチ（毎日02:00 JST） | 完成・Vercelにデプロイ済み |
| CSVインポート（業界DB用） | 完成 |

### 残っているもの・未着手のもの

| タスク | 優先度 | 備考 |
|---|---|---|
| Supabase SQLマイグレーション3件の本番適用確認 | 高 | 上記「手順5」参照 |
| Vercel環境変数 `CRON_SECRET` の設定確認 | 高 | Vercelダッシュボードで確認 |
| ToG案件詳細ページのUI改善 | 中 | 現状は基本情報のみ |
| 外部共有ページの機能拡張 | 低 | `/share/[token]` |

---

## 6. 既知の問題・注意点

### 開発時の注意

- **`createClient()` の呼び出し場所**: `'use client'` のコンポーネントでは、トップレベルで `createClient()` を呼ばないこと。イベントハンドラや `useEffect` の内部で呼ぶこと。（Supabase SSRの制約）
- **`_archive/` フォルダ**: `src/components/_archive/` に古いコンポーネントが残っており、TypeScriptエラーが出ているが、実際には使われていないファイルのため無視してよい。
- **`budget` フィールドが null になる**: ToG案件の予算額は記載がない場合 `null` になる。`budget ?? 0` のように null ガードが必要。

### 本番環境（Vercel）の注意

- AIリサーチのCronジョブは **毎日17:00 UTC（= 02:00 JST）** に自動実行される。
- Cronジョブには `CRON_SECRET` 環境変数が必要。Vercelのダッシュボードに設定されているか確認すること。
- `SKIP_AUTH=true` は**開発環境でのみ**使用する。本番では設定しないこと。

### DBの注意

- `tog_cases` テーブルの `status` カラムにはCHECK制約がある。新しいステータスを追加する場合はマイグレーションSQLが必要。
- `dismissed` ステータスは旧バージョンとの後方互換のために残してある。新規データでは使わない。

---

## 7. 環境変数一覧

`.env.local` に設定が必要な変数。**値は既存メンバーから共有してもらうこと。**

| 変数名 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトのURL（ブラウザからも参照される） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase の公開キー（anon key）（ブラウザからも参照される） |
| `ANTHROPIC_API_KEY` | Claude AI API を呼び出すためのキー（サーバーサイドのみ） |
| `CRON_SECRET` | Vercel Cronジョブの認証キー（不正アクセス防止用） |
| `SKIP_AUTH` | `true` にするとログインをスキップできる（開発時のみ使用） |

---

## 8. よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# TypeScript の型エラーチェック
npm run tsc

# Lint（コードの書き方チェック）
npm run lint
```

---

## 9. 参考資料

- `knowledge/` フォルダ内に会社概要・サービス情報・チーム情報がある
- Claude Code での開発ルールは `CLAUDE.md`（このフォルダ）と `~/.claude/CLAUDE.md`（全プロジェクト共通）を参照すること
