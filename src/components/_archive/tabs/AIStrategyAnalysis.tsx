'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { StrategyData, StrategyItem } from '@/lib/types/strategy'

const COUNTRY_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#4f46e5', '#7c3aed',
]

interface Props {
  strategyData: StrategyData
  onToggleStrategy: (id: string) => void
  onConfirmStrategies: () => void
  onGenerateShareUrl: () => void
  onCopyShareUrl: () => void
  shareToken: string | null
  copiedUrl: boolean
  isConfirming: boolean
}

export default function AIStrategyAnalysis({
  strategyData,
  onToggleStrategy,
  onConfirmStrategies,
  onGenerateShareUrl,
  onCopyShareUrl,
  shareToken,
  copiedUrl,
  isConfirming,
}: Props) {
  const selectedCount = strategyData.strategies.filter(s => s.selected).length

  return (
    <div className="space-y-5">

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">戦略分析レポート</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            最終更新: {new Date(strategyData.lastUpdated).toLocaleString('ja-JP', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!shareToken ? (
            <button
              onClick={onGenerateShareUrl}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              共有URLを発行
            </button>
          ) : (
            <button
              onClick={onCopyShareUrl}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                copiedUrl
                  ? 'text-emerald-600 border border-emerald-200 bg-emerald-50'
                  : 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {copiedUrl ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                )}
              </svg>
              {copiedUrl ? 'コピーしました！' : 'URLをコピー'}
            </button>
          )}
        </div>
      </div>

      {/* ① 観光資源リスト */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader number="1" label="観光資源リスト" sub="プロダクトアウト視点" color="emerald" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          {strategyData.touristResources.map(r => (
            <div
              key={r.id}
              className="border border-slate-100 rounded-xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all"
            >
              <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 mb-2">
                {r.category}
              </span>
              <h5 className="text-sm font-semibold text-slate-800 mb-1">{r.name}</h5>
              <p className="text-xs text-slate-500 leading-relaxed">{r.features}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ② 市場データ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader number="2" label="市場データ" sub="マーケットイン視点" color="blue" />
        <div className="mt-4 space-y-8">
          {strategyData.marketData.map((mData, idx) => (
            <div key={mData.resourceId} className={idx > 0 ? 'pt-6 border-t border-slate-100' : ''}>
              <h5 className="text-sm font-semibold text-slate-700 mb-4">{mData.resourceName}</h5>

              <div className="grid grid-cols-2 gap-5">
                {/* 国別関心度 */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">国別関心度</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart
                      data={mData.countryInterest}
                      layout="vertical"
                      margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={56} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v) => [`${v}pt`, '関心度']}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {mData.countryInterest.map((_, i) => (
                          <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 検索トレンド */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">検索トレンド推移</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart
                      data={mData.searchTrend}
                      margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* SNSメンション & 成功事例 */}
              <div className="mt-4 flex items-start gap-4">
                <div className="flex items-center gap-2 bg-pink-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                  </svg>
                  <span className="text-xs text-pink-700 font-medium">
                    SNSメンション <strong>{mData.socialMentions.toLocaleString()}</strong> 件
                  </span>
                </div>

                {mData.successCases.length > 0 && (
                  <div className="flex-1 space-y-2">
                    {mData.successCases.map((c, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-blue-800">📌 {c.title}</p>
                        <p className="text-xs text-blue-600 mt-0.5">{c.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ③ ブランディングストーリー */}
      <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-indigo-950 via-indigo-800 to-purple-900 p-7 text-white">
        {/* 装飾円 */}
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">3</span>
            </div>
            <h4 className="text-sm font-bold text-white">ブランディングストーリー＆勝ち筋</h4>
          </div>

          <h2 className="text-2xl font-extrabold text-white mb-5 leading-tight tracking-tight">
            {strategyData.brandingStory.headline}
          </h2>

          <p className="text-indigo-100 text-sm leading-relaxed mb-5">
            {strategyData.brandingStory.story}
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-5 border border-white/10">
            <p className="text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wide">このストーリーの根拠</p>
            <p className="text-sm text-white/90 leading-relaxed">{strategyData.brandingStory.rationale}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-indigo-300 mb-3 uppercase tracking-wide">勝ち筋</p>
            <div className="space-y-2.5">
              {strategyData.brandingStory.winningPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/50 border border-indigo-400/50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ④ 総合戦略＆施策提案 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-amber-600">4</span>
          </div>
          <h4 className="text-sm font-bold text-slate-800">総合戦略＆施策提案</h4>
          {selectedCount > 0 && (
            <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {selectedCount}件選択中
            </span>
          )}
        </div>

        <div className="space-y-3 mb-4">
          {strategyData.strategies.map(s => (
            <StrategyCard key={s.id} strategy={s} onToggle={() => onToggleStrategy(s.id)} />
          ))}
        </div>

        <button
          onClick={onConfirmStrategies}
          disabled={selectedCount === 0 || isConfirming}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
        >
          {isConfirming ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              保存中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              選択した施策を確定 → ROI試算・スケジュールに反映
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---- 施策カード ----
function StrategyCard({ strategy, onToggle }: { strategy: StrategyItem; onToggle: () => void }) {
  return (
    <div
      className={`border rounded-xl p-4 cursor-pointer transition-all select-none ${
        strategy.selected
          ? 'border-amber-300 bg-amber-50 shadow-sm'
          : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/40'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            strategy.selected ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
          }`}
        >
          {strategy.selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-semibold text-slate-800 mb-1">{strategy.name}</h5>
          <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{strategy.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge icon="🎯" text={strategy.target} color="slate" />
            <Badge icon="📈" text={strategy.estimatedEffect} color="emerald" />
            <Badge icon="⏱️" text={strategy.duration} color="blue" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ icon, text, color }: { icon: string; text: string; color: 'slate' | 'emerald' | 'blue' }) {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${colorMap[color]}`}>
      {icon} {text}
    </span>
  )
}

function SectionHeader({
  number, label, sub, color,
}: {
  number: string
  label: string
  sub: string
  color: 'emerald' | 'blue' | 'amber'
}) {
  const colorMap = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  }
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <span className="text-sm font-bold">{number}</span>
      </div>
      <h4 className="text-sm font-bold text-slate-800">{label}</h4>
      <span className="ml-auto text-xs text-slate-400">{sub}</span>
    </div>
  )
}
