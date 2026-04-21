'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { StrategyData } from '@/lib/types/strategy'
import { CATEGORY_META } from '@/lib/types/strategy'
import type { SharedScheduleItem } from '@/lib/actions/strategy'
import {
  calculateSingleStrategyROI, inferChannelType, inferCVRType, parseBudgetToYen,
  DEFAULT_ROI_VALUES, DEFAULT_SPEND_BREAKDOWN, formatJPY,
} from '@/lib/roi-calculator'

const COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']

const SCENARIO_COLORS = { red: '#ef4444', blue: '#3b82f6', green: '#10b981' }

const SCHED_CATEGORY_COLOR: Record<string, string> = {
  sns: 'bg-blue-100 text-blue-700', tour: 'bg-emerald-100 text-emerald-700',
  research: 'bg-purple-100 text-purple-700', pr: 'bg-red-100 text-red-700',
  partner: 'bg-orange-100 text-orange-700', content: 'bg-indigo-100 text-indigo-700',
  milestone: 'bg-amber-100 text-amber-700', other: 'bg-slate-100 text-slate-600',
}
const SCHED_CATEGORY_LABEL: Record<string, string> = {
  sns: 'SNS', tour: 'ツアー', research: '調査', pr: 'PR',
  partner: '提携', content: 'コンテンツ', milestone: 'マイルストーン', other: 'その他',
}

// ── ガント表示レンジ（今月から12ヶ月）──
const ganttStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })()
const ganttEnd   = (() => { const d = new Date(ganttStart); d.setMonth(d.getMonth() + 12); return d })()
const ganttTotalDays = (ganttEnd.getTime() - ganttStart.getTime()) / 86400000
const months12 = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(ganttStart); d.setMonth(d.getMonth() + i); return d
})

function SectionTitle({ number, label, sub, color }: {
  number: string; label: string; sub: string
  color: 'emerald' | 'blue' | 'amber' | 'indigo' | 'purple' | 'teal'
}) {
  const cm: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue:    'bg-blue-100 text-blue-600',
    amber:   'bg-amber-100 text-amber-600',
    indigo:  'bg-indigo-100 text-indigo-600',
    purple:  'bg-purple-100 text-purple-600',
    teal:    'bg-teal-100 text-teal-600',
  }
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cm[color]}`}>
        <span className="text-sm font-bold">{number}</span>
      </div>
      <h3 className="text-base font-bold text-slate-800">{label}</h3>
      <span className="ml-auto text-xs text-slate-400">{sub}</span>
    </div>
  )
}

interface Props {
  strategyData: StrategyData
  schedules: SharedScheduleItem[]
}

export default function SharedStrategyView({ strategyData, schedules }: Props) {
  const confirmed = strategyData.strategies.filter(s => s.selected)
  const displayed = confirmed.length > 0 ? confirmed : strategyData.strategies

  const { marketMatrix } = strategyData

  // ── ROI計算（確定施策ベース）──
  const roiResults = useMemo(() => displayed.map(s =>
    calculateSingleStrategyROI({
      strategyId: s.id,
      strategyName: s.name,
      targetCountries: s.targetCountries,
      budget: parseBudgetToYen(s.recommendedBudget),
      channelType: inferChannelType(s.name, s.description),
      cvrType: inferCVRType(s.name, s.description),
    }, DEFAULT_ROI_VALUES, DEFAULT_SPEND_BREAKDOWN)
  ), [displayed])

  const totalBudget  = roiResults.reduce((s, r) => s + r.budget, 0)
  const totalVisitors = roiResults.reduce((s, r) => s + r.visitors, 0)
  const totalRevenue  = roiResults.reduce((s, r) => s + r.revenue, 0)
  const blendedROI    = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget) * 100 : 0

  // ── ガントバースタイル ──
  const barStyle = (s: SharedScheduleItem) => {
    const start = new Date(s.startDate)
    const end   = new Date(s.endDate)
    const cs = start < ganttStart ? ganttStart : start
    const ce = end > ganttEnd ? ganttEnd : end
    if (cs >= ce) return null
    const leftPct  = ((cs.getTime() - ganttStart.getTime()) / 86400000 / ganttTotalDays) * 100
    const widthPct = ((ce.getTime() - cs.getTime()) / 86400000 / ganttTotalDays) * 100
    return { left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }
  }

  return (
    <div className="space-y-6">

      {/* ── ① 観光資源リスト ── */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle number="1" label="観光資源リスト" sub="プロダクトアウト視点" color="emerald" />
        {strategyData.touristResources.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 mt-5 sm:grid-cols-3">
            {strategyData.touristResources.map(r => {
              const meta = CATEGORY_META[r.category]
              return (
                <div key={r.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border mb-2 ${meta?.color ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    {meta?.icon} {r.category}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">{r.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{r.description}</p>
                  <div className="flex gap-0.5 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-3 h-1.5 rounded-full ${i < r.uniquenessScore ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-4 text-center py-6">データなし</p>
        )}
      </section>

      {/* ── ② 市場データ ── */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle number="2" label="市場データ" sub="マーケットイン視点" color="blue" />

        {marketMatrix.resources.length > 0 && marketMatrix.countries.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <p className="text-xs font-semibold text-slate-500 mb-3">国別関心度マトリクス（0–100）</p>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-3 text-slate-500 font-medium w-32">観光資源</th>
                  {marketMatrix.countries.map(c => (
                    <th key={c} className="px-2 py-1.5 text-slate-500 font-medium text-center whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marketMatrix.resources.map((res, ri) => (
                  <tr key={res}>
                    <td className="py-1.5 pr-3 text-slate-700 font-medium truncate max-w-[128px]">{res}</td>
                    {marketMatrix.countries.map((_, ci) => {
                      const score = marketMatrix.scores[ri]?.[ci] ?? 0
                      const opacity = score / 100
                      return (
                        <td key={ci} className="px-2 py-1.5 text-center">
                          <div
                            className="inline-flex items-center justify-center w-10 h-7 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: `rgba(99,102,241,${0.1 + opacity * 0.85})`,
                              color: opacity > 0.55 ? 'white' : '#4338ca',
                            }}
                          >
                            {score}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {marketMatrix.searchTrends.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 mb-3">検索トレンド推移</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {marketMatrix.searchTrends.slice(0, 4).map((t, idx) => (
                <div key={t.resourceName}>
                  <p className="text-xs text-slate-600 font-medium mb-1">{t.resourceName}</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={t.data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Line type="monotone" dataKey="value" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>
        )}

        {marketMatrix.socialMentions.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 mb-3">SNSメンション数</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart
                data={marketMatrix.socialMentions.map(m => ({ name: m.resourceName.slice(0, 8), count: m.count }))}
                margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {marketMatrix.socialMentions.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {marketMatrix.successCases.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 mb-3">成功事例</p>
            <div className="space-y-2">
              {marketMatrix.successCases.map((c, i) => (
                <div key={i} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-800 mb-0.5">📌 {c.region}</p>
                  <p className="text-xs text-blue-700">{c.description}</p>
                  <p className="text-xs font-medium text-blue-600 mt-1">→ {c.result}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {marketMatrix.competitorAnalysis.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <p className="text-xs font-semibold text-slate-500 mb-3">競合分析</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2 px-3 text-slate-600 font-semibold rounded-tl-lg">競合</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-semibold">強み</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-semibold">弱み</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-semibold rounded-tr-lg">差別化</th>
                </tr>
              </thead>
              <tbody>
                {marketMatrix.competitorAnalysis.map((c, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-slate-50/50'}>
                    <td className="py-2 px-3 font-medium text-slate-700">{c.name}</td>
                    <td className="py-2 px-3 text-slate-600">{c.strengths}</td>
                    <td className="py-2 px-3 text-slate-500">{c.weaknesses}</td>
                    <td className="py-2 px-3 text-indigo-600">{c.differentiation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {marketMatrix.dataSources.length > 0 && (
          <p className="text-xs text-slate-400 mt-4">
            データソース: {marketMatrix.dataSources.join(' · ')}
          </p>
        )}
      </section>

      {/* ── ③ ブランディングストーリー ── */}
      <section className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-8 text-white relative">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">3</span>
            </div>
            <h3 className="text-sm font-bold text-white">ブランディングストーリー＆勝ち筋</h3>
          </div>

          {strategyData.directionSummary && (
            <div className="bg-white/10 rounded-xl p-4 mb-5 border border-white/10">
              <p className="text-xs font-semibold text-indigo-300 mb-1.5 uppercase tracking-wide">戦略的方向性</p>
              <p className="text-sm text-white/90 leading-relaxed">{strategyData.directionSummary}</p>
            </div>
          )}

          <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight tracking-tight">
            {strategyData.brandingStory.catchphrase}
          </h2>
          <p className="text-indigo-100 text-sm leading-relaxed mb-5">
            {strategyData.brandingStory.story}
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-5 border border-white/10">
            <p className="text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wide">このストーリーの根拠</p>
            <p className="text-sm text-white/90 leading-relaxed">{strategyData.brandingStory.rationale}</p>
          </div>

          {strategyData.brandingStory.winningPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-indigo-300 mb-3 uppercase tracking-wide">勝ち筋</p>
              <div className="space-y-3">
                {strategyData.brandingStory.winningPoints.map((wp, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/50 border border-indigo-400/50 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-white">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{wp.point}</p>
                      {wp.evidence && (
                        <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">{wp.evidence}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── ④ 施策提案 ── */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle
          number="4"
          label="施策提案"
          sub={confirmed.length > 0 ? `確定済み ${confirmed.length}件` : `提案 ${displayed.length}件`}
          color="amber"
        />
        {displayed.length > 0 ? (
          <div className="grid gap-4 mt-5 sm:grid-cols-2">
            {displayed.map((s, idx) => (
              <div key={s.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                    {idx + 1}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 leading-snug">{s.name}</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.targetCountries.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                      🎯 {s.targetCountries.join('・')}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                    📈 {s.estimatedEffect}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                    💰 {s.recommendedBudget}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    ⏱️ {s.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-4 text-center py-6">施策データなし</p>
        )}
      </section>

      {/* ── ⑤ 実施スケジュール ── */}
      {schedules.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionTitle number="5" label="実施スケジュール" sub={`${schedules.length}件`} color="indigo" />

          {/* ガント（読み取り専用）*/}
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
            {/* 月ヘッダー */}
            <div className="flex bg-slate-50 border-b border-slate-100">
              <div className="w-36 shrink-0 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-slate-100">
                施策名
              </div>
              <div className="flex-1 flex">
                {months12.map((m, i) => (
                  <div key={i} className="flex-1 text-center py-2 text-xs text-slate-400 border-r border-slate-100 last:border-r-0">
                    {m.toLocaleDateString('ja-JP', { month: 'short' })}
                  </div>
                ))}
              </div>
            </div>

            {/* バー行 */}
            <div className="divide-y divide-slate-50">
              {schedules.map(s => {
                const bs = barStyle(s)
                return (
                  <div key={s.id} className="flex items-center h-9 hover:bg-slate-50/50">
                    <div className="w-36 shrink-0 px-3 flex items-center gap-1.5 border-r border-slate-100 h-full">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-slate-700 truncate">{s.name}</span>
                    </div>
                    <div className="flex-1 relative h-full">
                      {/* グリッド */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {months12.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-slate-100 last:border-r-0" />
                        ))}
                      </div>
                      {bs && (
                        <div
                          className="absolute top-1.5 h-6 rounded flex items-center px-2 text-white text-xs font-medium shadow-sm"
                          style={{ ...bs, backgroundColor: s.color }}
                        >
                          <span className="truncate pointer-events-none">{s.name.slice(0, 10)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* カテゴリ凡例 */}
          <div className="flex flex-wrap gap-2 mt-4">
            {Array.from(new Set(schedules.map(s => s.category))).map(cat => (
              <span key={cat} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCHED_CATEGORY_COLOR[cat] ?? 'bg-slate-100 text-slate-600'}`}>
                {SCHED_CATEGORY_LABEL[cat] ?? cat}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── ⑥ ROI試算 ── */}
      {roiResults.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <SectionTitle number="6" label="ROI試算" sub="標準シナリオ" color="purple" />

          {/* ポートフォリオサマリー */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: '総投資予算',    value: formatJPY(totalBudget),                 cls: 'text-slate-800' },
              { label: '期待来訪者数',  value: `${totalVisitors.toLocaleString()}人`,   cls: 'text-indigo-700' },
              { label: '期待収益',      value: formatJPY(totalRevenue),                cls: 'text-emerald-700' },
              { label: '総合ROI',       value: `${blendedROI.toFixed(1)}%`,            cls: blendedROI >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                <p className={`text-lg font-extrabold ${kpi.cls}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* 施策別シナリオ */}
          <div className="mt-5 space-y-3">
            {roiResults.map((r, idx) => (
              <div key={r.strategyId} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <p className="text-xs font-semibold text-slate-800">{r.strategyName}</p>
                  <span className="ml-auto text-xs text-slate-400">予算 {formatJPY(r.budget)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {r.scenarios.map(sc => (
                    <div
                      key={sc.label}
                      className="rounded-lg p-2.5 text-center"
                      style={{ backgroundColor: `${SCENARIO_COLORS[sc.colorKey]}15` }}
                    >
                      <p className="text-xs font-bold mb-1" style={{ color: SCENARIO_COLORS[sc.colorKey] }}>
                        {sc.label}
                      </p>
                      <p className="text-sm font-extrabold text-slate-800">{sc.roi.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">{sc.visitors.toLocaleString()}人</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 施策別来訪者数グラフ */}
          {roiResults.length >= 2 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 mb-3">施策別推定来訪者数（標準シナリオ）</p>
              <ResponsiveContainer width="100%" height={roiResults.length * 40 + 20}>
                <BarChart
                  data={roiResults.map((r, i) => ({ name: r.strategyName.slice(0, 10), 来訪者数: r.visitors, color: COLORS[i % COLORS.length] }))}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v.toLocaleString()}人`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => [`${Number(v).toLocaleString()}人`, '来訪者数']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="来訪者数" radius={[0, 4, 4, 0]}>
                    {roiResults.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-4">
            ※ ROI試算は業界平均値を使用した参考値です。実際の結果は市場環境・実施条件により異なります。
          </p>
        </section>
      )}
    </div>
  )
}
