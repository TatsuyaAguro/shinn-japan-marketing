'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { MarketMatrix } from '@/lib/types/strategy'

// ── ヒートマップ ──────────────────────────────────────────────
function Heatmap({ matrix }: { matrix: MarketMatrix }) {
  const { resources, countries, scores } = matrix
  if (resources.length === 0 || countries.length === 0) return null

  const getColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-indigo-600', text: 'text-white' }
    if (score >= 60) return { bg: 'bg-indigo-400', text: 'text-white' }
    if (score >= 40) return { bg: 'bg-indigo-200', text: 'text-indigo-800' }
    if (score >= 20) return { bg: 'bg-indigo-100', text: 'text-indigo-700' }
    return { bg: 'bg-slate-100', text: 'text-slate-400' }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left p-2 font-medium text-slate-500 bg-slate-50 border border-slate-200 min-w-[100px]">
              観光資源
            </th>
            {countries.map(c => (
              <th key={c} className="p-2 font-medium text-slate-600 bg-slate-50 border border-slate-200 text-center min-w-[68px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource, ri) => (
            <tr key={resource}>
              <td className="p-2 font-medium text-slate-700 border border-slate-200 bg-white whitespace-nowrap">
                {resource}
              </td>
              {countries.map((_, ci) => {
                const score = scores[ri]?.[ci] ?? 0
                const { bg, text } = getColor(score)
                return (
                  <td
                    key={ci}
                    className={`p-2 text-center border border-slate-200 font-semibold tabular-nums ${bg} ${text}`}
                    title={`${resource} × ${countries[ci]}: ${score}pt`}
                  >
                    {score}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
        <span className="font-medium">関心度スケール:</span>
        {[
          { label: '80+', cls: 'bg-indigo-600' },
          { label: '60+', cls: 'bg-indigo-400' },
          { label: '40+', cls: 'bg-indigo-200' },
          { label: '20+', cls: 'bg-indigo-100' },
          { label: '〜20', cls: 'bg-slate-100' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-4 h-4 rounded inline-block border border-slate-200 ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 検索トレンド ──────────────────────────────────────────────
function SearchTrends({ trends }: { trends: MarketMatrix['searchTrends'] }) {
  if (trends.length === 0) return null
  const first = trends[0]

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={first.data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        />
        <Line
          type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5}
          dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── SNSメンション ──────────────────────────────────────────────
function SocialBar({ mentions }: { mentions: MarketMatrix['socialMentions'] }) {
  if (mentions.length === 0) return null
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={mentions} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis dataKey="resourceName" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={v => [Number(v).toLocaleString(), 'メンション数']}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {mentions.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── メインコンポーネント ──────────────────────────────────────
export default function MarketSection({ matrix }: { matrix: MarketMatrix | null }) {
  if (!matrix || matrix.resources.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">市場データはAI分析後に表示されます。</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヒートマップ */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
          観光資源 × 国別関心度マトリクス
        </h5>
        <Heatmap matrix={matrix} />
      </div>

      {/* 検索トレンド + SNS */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            検索トレンド（6ヶ月）
          </h5>
          <SearchTrends trends={matrix.searchTrends} />
        </div>
        <div>
          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            SNSメンション数
          </h5>
          <SocialBar mentions={matrix.socialMentions} />
        </div>
      </div>

      {/* 成功事例 */}
      {matrix.successCases.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            類似地域の成功事例
          </h5>
          <div className="grid grid-cols-1 gap-3">
            {matrix.successCases.map((c, i) => (
              <div key={i} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm font-semibold text-blue-900 mb-1">📌 {c.region}</p>
                <p className="text-xs text-blue-700 mb-1">{c.description}</p>
                <p className="text-xs text-blue-600 font-medium">→ {c.result}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 競合分析 */}
      {matrix.competitorAnalysis.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            競合分析
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {['競合地域', '強み', '弱み', '差別化ポイント'].map(h => (
                    <th key={h} className="p-2.5 text-left font-semibold text-slate-600 border border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.competitorAnalysis.map((c, i) => (
                  <tr key={i} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2.5 border border-slate-200 font-semibold text-slate-700">{c.name}</td>
                    <td className="p-2.5 border border-slate-200 text-slate-600">{c.strengths}</td>
                    <td className="p-2.5 border border-slate-200 text-slate-600">{c.weaknesses}</td>
                    <td className="p-2.5 border border-slate-200 text-emerald-700 font-medium">{c.differentiation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* データソース */}
      {matrix.dataSources?.length > 0 && (
        <p className="text-xs text-slate-400">
          データソース: {matrix.dataSources.join(' / ')}
        </p>
      )}
    </div>
  )
}
