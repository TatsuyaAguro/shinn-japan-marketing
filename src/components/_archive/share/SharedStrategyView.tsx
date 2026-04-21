'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { StrategyData } from '@/lib/types/strategy'

const COUNTRY_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5']

export default function SharedStrategyView({ strategyData }: { strategyData: StrategyData }) {
  const confirmed = strategyData.strategies.filter(s => s.selected)
  const displayed = confirmed.length > 0 ? confirmed : strategyData.strategies

  return (
    <div className="space-y-6">

      {/* ① 観光資源リスト */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle number="1" label="観光資源リスト" sub="プロダクトアウト視点" color="emerald" />
        <div className="grid grid-cols-2 gap-4 mt-5 sm:grid-cols-3">
          {strategyData.touristResources.map(r => (
            <div key={r.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all">
              <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 mb-2">
                {r.category}
              </span>
              <h4 className="text-sm font-semibold text-slate-800 mb-1">{r.name}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{r.features}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ② 市場データ */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle number="2" label="市場データ" sub="マーケットイン視点" color="blue" />
        <div className="mt-5 space-y-8">
          {strategyData.marketData.map((mData, idx) => (
            <div key={mData.resourceId} className={idx > 0 ? 'pt-8 border-t border-slate-100' : ''}>
              <h4 className="text-sm font-semibold text-slate-700 mb-4">{mData.resourceName}</h4>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">国別関心度</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={mData.countryInterest} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={56} tickLine={false} axisLine={false} />
                      <Tooltip formatter={v => [`${v}pt`, '関心度']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {mData.countryInterest.map((_, i) => <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">検索トレンド推移</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={mData.searchTrend} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                      <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2 bg-pink-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-pink-700 font-medium">SNSメンション <strong>{mData.socialMentions.toLocaleString()}</strong> 件</span>
                </div>
                {mData.successCases.length > 0 && (
                  <div className="flex-1 space-y-1.5">
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
      </section>

      {/* ③ ブランディングストーリー */}
      <section className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-800 to-purple-900 p-8 text-white relative">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">3</span>
            </div>
            <h3 className="text-sm font-bold text-white">ブランディングストーリー＆勝ち筋</h3>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-5 leading-tight tracking-tight">
            {strategyData.brandingStory.headline}
          </h2>
          <p className="text-indigo-100 text-sm leading-relaxed mb-5">{strategyData.brandingStory.story}</p>
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
      </section>

      {/* ④ 施策提案 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionTitle number="4" label="施策提案" sub={confirmed.length > 0 ? '確定済み施策' : '提案施策'} color="amber" />
        <div className="grid gap-4 mt-5 sm:grid-cols-2">
          {displayed.map(s => (
            <div key={s.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">{s.name}</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">🎯 {s.target}</span>
                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">📈 {s.estimatedEffect}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">⏱️ {s.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ number, label, sub, color }: { number: string; label: string; sub: string; color: 'emerald' | 'blue' | 'amber' }) {
  const cm = { emerald: 'bg-emerald-100 text-emerald-600', blue: 'bg-blue-100 text-blue-600', amber: 'bg-amber-100 text-amber-600' }
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
