'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { TogCase, TogPrediction } from '@/lib/types/tog'
import { saveTogPrediction, upsertTogCase } from '@/lib/actions/tog'

interface Props {
  predictions: TogPrediction[]
  archiveCases: TogCase[]
  onRefresh: () => void
}

// ── 新フォーマットの型定義 ──────────────────────────────────────
interface PastCase {
  name: string
  issuer: string
  year: string
  amount: number
  timing: string
  fit: '◎' | '○' | '△'
  fit_reason: string
  url?: string
}

interface PatternData {
  summary: string
  recurring: string[]
  seasonal_pattern: string
  budget_trend: string
  budget_history: { year: string; amount: number }[]
}

interface PredictedCase {
  name: string
  confidence: '高' | '中' | '低'
  confidence_reason: string
  estimated_timing: string
  estimated_budget_min: number
  estimated_budget_max: number
  past_winner: string
  fit: '◎' | '○' | '△'
  ai_reason: string
  matching_services: string[]
}

interface ChecklistItem {
  item: string
  detail: string
  contact: string
}

interface ParsedPrediction {
  municipality: string
  analysis_date: string
  step1_past_cases: PastCase[]
  step2_patterns: PatternData | null
  step3_predictions: PredictedCase[]
  step4_checklist: ChecklistItem[]
  caution: string
  // 後方互換：旧フォーマット
  isLegacy?: boolean
  legacy_summary?: string
  legacy_cards?: LegacyCard[]
}

// 旧フォーマット後方互換
interface LegacyCard {
  title: string
  likelihood?: number
  budget_range?: string
  deadline_forecast?: string
  category?: string
  description?: string
  recommended_action?: string
}

// ── ヘルパー ───────────────────────────────────────────────────
function tryParsePrediction(data: Record<string, unknown>): ParsedPrediction | null {
  if (!data || Object.keys(data).length === 0) return null

  // 新フォーマット
  if (data.step1_past_cases !== undefined || data.step3_predictions !== undefined) {
    const patterns = data.step2_patterns as PatternData | null ?? null
    return {
      municipality:     String(data.municipality ?? ''),
      analysis_date:    String(data.analysis_date ?? ''),
      step1_past_cases: Array.isArray(data.step1_past_cases) ? data.step1_past_cases as PastCase[] : [],
      step2_patterns:   patterns,
      step3_predictions: Array.isArray(data.step3_predictions) ? data.step3_predictions as PredictedCase[] : [],
      step4_checklist:  Array.isArray(data.step4_checklist) ? data.step4_checklist as ChecklistItem[] : [],
      caution:          String(data.caution ?? ''),
    }
  }

  // 旧フォーマット (predicted_cases or cards)
  const legacyCards: LegacyCard[] = (
    Array.isArray(data.predicted_cases) ? data.predicted_cases :
    Array.isArray(data.cards) ? data.cards : []
  ) as LegacyCard[]

  return {
    municipality:      String(data.municipality ?? ''),
    analysis_date:     '',
    step1_past_cases:  [],
    step2_patterns:    null,
    step3_predictions: [],
    step4_checklist:   [],
    caution:           String(data.caution ?? ''),
    isLegacy:          true,
    legacy_summary:    String(data.summary ?? ''),
    legacy_cards:      legacyCards,
  }
}

function formatBudget(yen: number): string {
  if (!yen || yen <= 0) return '不明'
  if (yen >= 100_000_000) return `${(yen / 100_000_000).toFixed(1)}億円`
  if (yen >= 10_000) return `${Math.round(yen / 10_000)}万円`
  return `${yen.toLocaleString()}円`
}

function FitBadge({ fit }: { fit: '◎' | '○' | '△' }) {
  const cls =
    fit === '◎' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' :
    fit === '○' ? 'bg-green-100 text-green-700 ring-1 ring-green-200' :
                  'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cls}`}>
      {fit}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: '高' | '中' | '低' }) {
  const cls =
    confidence === '高' ? 'bg-green-100 text-green-700' :
    confidence === '中' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-500'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      確度：{confidence}
    </span>
  )
}

// ── メインコンポーネント ────────────────────────────────────────
export default function PredictionTab({ predictions, archiveCases, onRefresh }: Props) {
  const [prefecture, setPrefecture] = useState('')
  const [organization, setOrganization] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedPrediction | null>(null)
  const [selectedPredId, setSelectedPredId] = useState<string | null>(null)
  const [addingCard, setAddingCard] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  const handlePredict = async () => {
    if (!prefecture.trim()) return
    setLoading(true)
    setCheckedItems(new Set())

    // 過去案件タブのデータをコンテキストとして渡す
    const relevantArchive = archiveCases.filter(c =>
      c.prefecture === prefecture ||
      (organization && c.organization?.includes(organization))
    )

    try {
      const res = await fetch('/api/tog/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefecture: prefecture.trim(),
          organization: organization.trim() || undefined,
          archiveCases: relevantArchive,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast('エラーが発生しました: ' + (data.error ?? ''))
        return
      }

      const p = tryParsePrediction(data.predictionData ?? {})
      setParsed(p)

      if (data.savedToArchive && data.savedToArchive.length > 0) {
        showToast(`${data.savedToArchive.length}件の過去案件を自動保存しました`)
        onRefresh()
      }

      // DB保存
      const saved = await saveTogPrediction({
        id: selectedPredId ?? undefined,
        prefecture: prefecture.trim(),
        organization: organization.trim(),
        predictionData: data.predictionData ?? {},
        chatMessages: [],
      })
      if (saved) setSelectedPredId(saved.id)
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const loadPrediction = (pred: TogPrediction) => {
    setSelectedPredId(pred.id)
    setPrefecture(pred.prefecture)
    setOrganization(pred.organization ?? '')
    setCheckedItems(new Set())
    const p = tryParsePrediction(pred.predictionData)
    setParsed(p)
  }

  const handleAddToActive = async (pred: PredictedCase) => {
    setAddingCard(pred.name)
    try {
      await upsertTogCase({
        id: crypto.randomUUID(),
        name: pred.name,
        organization: organization || prefecture,
        prefecture,
        category: pred.matching_services.join(', '),
        description: pred.ai_reason,
        budget: pred.estimated_budget_max || 0,
        deadline: null,
        status: 'considering',
        aiScore: pred.fit === '◎' ? 5 : pred.fit === '○' ? 4 : 3,
        aiReason: `先読みリサーチ予測案件（確度：${pred.confidence}）: ${pred.ai_reason}`,
        aiMatchingServices: pred.matching_services,
        aiActionRecommendation: '',
      })
      onRefresh()
      showToast(`「${pred.name}」を対応中に追加しました`)
    } finally {
      setAddingCard(null)
    }
  }

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-16rem)]">
      {/* ── 左パネル ── */}
      <div className="flex flex-col w-72 shrink-0 gap-4">
        {/* 入力エリア */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">先読みリサーチ</h3>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">都道府県 *</label>
            <input
              type="text"
              value={prefecture}
              onChange={e => setPrefecture(e.target.value)}
              placeholder="例: 北海道"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">機関名（省略可）</label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              placeholder="例: 北海道観光局"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={handlePredict}
            disabled={loading || !prefecture.trim()}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI分析中（1〜2分）...
              </span>
            ) : 'リサーチ実行'}
          </button>
          <p className="text-xs text-slate-400 text-center">過去案件タブのデータも自動参照します</p>
        </div>

        {/* 予測履歴 */}
        {predictions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-600">過去の分析履歴</p>
            </div>
            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
              {predictions.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadPrediction(p)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${selectedPredId === p.id ? 'bg-indigo-50' : ''}`}
                >
                  <p className="text-xs font-medium text-slate-800">
                    {p.prefecture}{p.organization ? ` ・ ${p.organization}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(p.updatedAt).toLocaleDateString('ja-JP')}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 右パネル ── */}
      <div className="flex-1 overflow-y-auto">
        {parsed ? (
          parsed.isLegacy ? (
            /* 旧フォーマット表示 */
            <LegacyView
              parsed={parsed}
              prefecture={prefecture}
              organization={organization}
              addingCard={addingCard}
              onRefresh={onRefresh}
              showToast={showToast}
              setAddingCard={setAddingCard}
            />
          ) : (
            /* 新フォーマット 4セクション表示 */
            <NewFormatView
              parsed={parsed}
              prefecture={prefecture}
              organization={organization}
              addingCard={addingCard}
              checkedItems={checkedItems}
              onToggleCheck={toggleCheck}
              onAddToActive={handleAddToActive}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">都道府県を入力してリサーチを実行</p>
              <p className="text-xs text-slate-400 mt-1">過去案件の探索・パターン分析・今年度予測を行います</p>
            </div>
          </div>
        )}
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── 新フォーマット 4セクション ────────────────────────────────
function NewFormatView({
  parsed, prefecture, organization,
  addingCard, checkedItems, onToggleCheck, onAddToActive,
}: {
  parsed: ParsedPrediction
  prefecture: string
  organization: string
  addingCard: string | null
  checkedItems: Set<number>
  onToggleCheck: (idx: number) => void
  onAddToActive: (pred: PredictedCase) => void
}) {
  const title = parsed.municipality || `${prefecture}${organization ? ` ${organization}` : ''}`

  return (
    <div className="space-y-5 pb-8">
      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {parsed.analysis_date && (
            <p className="text-xs text-slate-400 mt-0.5">分析日: {parsed.analysis_date}</p>
          )}
        </div>
        {parsed.caution && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 max-w-xs">{parsed.caution}</p>
        )}
      </div>

      {/* STEP 1: 過去案件一覧 */}
      {parsed.step1_past_cases.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">STEP 1</span>
            <h3 className="text-sm font-bold text-slate-800">過去案件一覧</h3>
            <span className="ml-auto text-xs text-slate-400">{parsed.step1_past_cases.length}件</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">事業名</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">発注元</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">年度</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">金額</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">公募時期</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-500 whitespace-nowrap">適合度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsed.step1_past_cases.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline font-medium">{c.name}</a>
                      ) : (
                        <span className="text-slate-800 font-medium">{c.name}</span>
                      )}
                      {c.fit_reason && (
                        <p className="text-slate-400 mt-0.5 text-xs">{c.fit_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{c.issuer}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{c.year}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium text-right whitespace-nowrap">
                      {formatBudget(c.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{c.timing || '─'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <FitBadge fit={c.fit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* STEP 2: パターン分析 */}
      {parsed.step2_patterns && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">STEP 2</span>
            <h3 className="text-sm font-bold text-slate-800">パターン分析</h3>
          </div>
          <div className="p-5 space-y-4">
            {parsed.step2_patterns.summary && (
              <p className="text-sm text-slate-700 leading-relaxed">{parsed.step2_patterns.summary}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 定番案件 */}
              {parsed.step2_patterns.recurring.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">定番案件</p>
                  <ul className="space-y-1">
                    {parsed.step2_patterns.recurring.map((r, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2">
                        <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 時期・予算トレンド */}
              <div className="space-y-2">
                {parsed.step2_patterns.seasonal_pattern && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">時期パターン</p>
                    <p className="text-xs text-blue-600">{parsed.step2_patterns.seasonal_pattern}</p>
                  </div>
                )}
                {parsed.step2_patterns.budget_trend && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">予算トレンド</p>
                    <p className="text-xs text-slate-600">{parsed.step2_patterns.budget_trend}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 予算推移グラフ */}
            {parsed.step2_patterns.budget_history.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">予算推移</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={parsed.step2_patterns.budget_history.map(b => ({
                        year: b.year,
                        amount: b.amount > 0 ? Math.round(b.amount / 10_000) : 0,
                      }))}
                      margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                    >
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="万" width={52} />
                      <Tooltip
                        formatter={(v) => [`${Number(v).toLocaleString()}万円`, '予算']}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 3: 今年度の予測案件 */}
      {parsed.step3_predictions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">STEP 3</span>
            <h3 className="text-sm font-bold text-slate-800">今年度の予測案件（令和8年度）</h3>
            <span className="ml-auto text-xs text-slate-400">{parsed.step3_predictions.length}件</span>
          </div>
          <div className="space-y-3">
            {parsed.step3_predictions.map((pred, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-slate-800">{pred.name}</p>
                      <FitBadge fit={pred.fit} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ConfidenceBadge confidence={pred.confidence} />
                      <span className="text-xs text-slate-400">{pred.confidence_reason}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAddToActive(pred)}
                    disabled={addingCard === pred.name}
                    className="shrink-0 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {addingCard === pred.name ? '追加中...' : '対応中に追加'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <p className="text-slate-400 mb-0.5">想定公募時期</p>
                    <p className="text-slate-700 font-medium">{pred.estimated_timing || '─'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">想定予算</p>
                    <p className="text-slate-700 font-medium">
                      {pred.estimated_budget_min > 0 || pred.estimated_budget_max > 0
                        ? `${formatBudget(pred.estimated_budget_min)} 〜 ${formatBudget(pred.estimated_budget_max)}`
                        : '不明'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">過去落札者</p>
                    <p className="text-slate-700 font-medium">{pred.past_winner || '不明'}</p>
                  </div>
                </div>

                {pred.ai_reason && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{pred.ai_reason}</p>
                )}

                {pred.matching_services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pred.matching_services.map((s, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* STEP 4: 確認すべきこと */}
      {parsed.step4_checklist.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">STEP 4</span>
            <h3 className="text-sm font-bold text-slate-800">確認すべきこと</h3>
            <span className="ml-auto text-xs text-slate-400">
              {checkedItems.size}/{parsed.step4_checklist.length} 完了
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {parsed.step4_checklist.map((item, i) => (
              <div
                key={i}
                className={`px-5 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${checkedItems.has(i) ? 'opacity-60' : ''}`}
                onClick={() => onToggleCheck(i)}
              >
                <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${checkedItems.has(i) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                  {checkedItems.has(i) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${checkedItems.has(i) ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {item.item}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</p>
                  )}
                  {item.contact && (
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="font-medium">問い合わせ先: </span>{item.contact}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* データなし */}
      {parsed.step1_past_cases.length === 0 &&
       !parsed.step2_patterns &&
       parsed.step3_predictions.length === 0 &&
       parsed.step4_checklist.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">分析データを取得できませんでした。</p>
          {parsed.caution && (
            <p className="mt-2 text-xs text-amber-600">{parsed.caution}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 旧フォーマット後方互換表示 ────────────────────────────────
function LegacyView({
  parsed, prefecture, organization,
  addingCard, onRefresh, showToast, setAddingCard,
}: {
  parsed: ParsedPrediction
  prefecture: string
  organization: string
  addingCard: string | null
  onRefresh: () => void
  showToast: (msg: string) => void
  setAddingCard: (v: string | null) => void
}) {
  const handleAdd = async (card: LegacyCard) => {
    setAddingCard(card.title)
    try {
      await upsertTogCase({
        id: crypto.randomUUID(),
        name: card.title,
        organization: organization || prefecture,
        prefecture,
        category: card.category ?? '',
        description: card.description ?? '',
        budget: 0,
        deadline: card.deadline_forecast || null,
        status: 'considering',
        aiScore: 3,
        aiReason: `先読みリサーチ予測案件: ${card.description ?? ''}`,
        aiMatchingServices: [],
        aiActionRecommendation: card.recommended_action ?? '',
      })
      onRefresh()
      showToast(`「${card.title}」を対応中に追加しました`)
    } finally {
      setAddingCard(null)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      {parsed.legacy_summary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            {parsed.municipality || `${prefecture} 予測サマリー`}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">{parsed.legacy_summary}</p>
          {parsed.caution && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{parsed.caution}</p>
          )}
        </div>
      )}
      {(parsed.legacy_cards ?? []).map((card, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm font-bold text-slate-800">{card.title}</p>
            <button
              onClick={() => handleAdd(card)}
              disabled={addingCard === card.title}
              className="shrink-0 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-60 transition-colors"
            >
              {addingCard === card.title ? '追加中...' : '対応中に追加'}
            </button>
          </div>
          {card.description && <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>}
        </div>
      ))}
    </div>
  )
}
