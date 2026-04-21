// ============================================================
// ToG（自治体公募案件）型定義
// ============================================================

export type TogStatus =
  | 'new'         // 新着（AIスクリーニング済み）
  | 'considering' // 検討中
  | 'preparing'   // 応募準備中
  | 'applied'     // 応募済み
  | 'waiting'     // 結果待ち
  | 'accepted'    // 採択
  | 'rejected'    // 不採択
  | 'passed'      // 見送り
  | 'archive'     // 過去案件（CSV等からインポート）

export type TogScore = 0 | 1 | 2 | 3 | 4 | 5

export interface TogCase {
  id: string
  name: string
  organization: string
  prefecture: string
  category: string
  description: string
  budget: number
  deadline: string | null       // ISO date string or null
  recruitmentDate: string
  winner: string
  url: string
  status: TogStatus
  priority: string
  aiScore: TogScore
  aiReason: string
  aiMatchingServices: string[]
  aiActionRecommendation: string
  analysisData: Record<string, unknown>
  predictionData: Record<string, unknown>
  gdriveLink: string
  memo: string
  assignedTo: string
  linkedClientId: string | null
  statusHistory: { status: TogStatus; date: string; note?: string }[]
  uploadedFiles: { id: string; name: string; url: string }[]
  createdAt: string
  updatedAt: string
}

export interface TogPrediction {
  id: string
  prefecture: string
  organization: string
  predictionData: Record<string, unknown>
  chatMessages: { role: 'user' | 'assistant'; content: string }[]
  createdAt: string
  updatedAt: string
}

// ── UI メタデータ ────────────────────────────────────────────

export const SCORE_META: Record<number, { hex: string; label: string; stars: string }> = {
  5: { hex: '#EF9F27', label: '最高一致',  stars: '★★★★★' },
  4: { hex: '#378ADD', label: '高関連',    stars: '★★★★☆' },
  3: { hex: '#639922', label: '部分関連',  stars: '★★★☆☆' },
  2: { hex: '#888780', label: '低関連',    stars: '★★☆☆☆' },
  1: { hex: '#B4B2A9', label: '関連度低',  stars: '★☆☆☆☆' },
  0: { hex: '#D1D5DB', label: '未評価',    stars: '─' },
}

export const STATUS_META: Record<TogStatus, { label: string; color: string; kanban?: boolean }> = {
  new:         { label: '新着',       color: 'bg-indigo-100 text-indigo-700' },
  considering: { label: '検討中',     color: 'bg-blue-100 text-blue-700',     kanban: true },
  preparing:   { label: '応募準備中', color: 'bg-amber-100 text-amber-700',   kanban: true },
  applied:     { label: '応募済み',   color: 'bg-purple-100 text-purple-700', kanban: true },
  waiting:     { label: '結果待ち',   color: 'bg-orange-100 text-orange-700' },
  accepted:    { label: '採択',       color: 'bg-emerald-100 text-emerald-700', kanban: true },
  rejected:    { label: '不採択',     color: 'bg-red-100 text-red-700' },
  passed:      { label: '見送り',     color: 'bg-slate-100 text-slate-500' },
  archive:     { label: '過去案件',   color: 'bg-slate-100 text-slate-600' },
}

export const KANBAN_COLUMNS: { status: TogStatus; label: string; color: string }[] = [
  { status: 'considering', label: '検討中',     color: 'border-blue-200 bg-blue-50/50' },
  { status: 'preparing',   label: '応募準備中', color: 'border-amber-200 bg-amber-50/50' },
  { status: 'applied',     label: '応募済み',   color: 'border-purple-200 bg-purple-50/50' },
  { status: 'accepted',    label: '採択',       color: 'border-emerald-200 bg-emerald-50/50' },
]

// CSV カラムマッピング（ヘッダー名 → フィールド名）
export const CSV_COLUMN_MAP: Record<string, keyof TogCase> = {
  '都道府県': 'prefecture',
  '優先度': 'priority',
  '公示元名': 'organization',
  '案件種類': 'category',
  '案件名': 'name',
  '募集日': 'recruitmentDate',
  '業務種類詳細': 'description',
  '提案上限額': 'budget',
  '落札者': 'winner',
}
