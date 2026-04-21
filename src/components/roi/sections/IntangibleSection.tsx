'use client'

import type { IntangibleValues, ROICalculationResult, ROIDefaults, SpendBreakdown } from '@/lib/roi-calculator'
import { formatJPY, calculateAwarenessDecay } from '@/lib/roi-calculator'

interface Props {
  results: ROICalculationResult[]
  intangible: IntangibleValues
  defaults: ROIDefaults
  spendBreakdown: SpendBreakdown
}

export default function IntangibleSection({ results, intangible, defaults, spendBreakdown }: Props) {
  if (results.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">施策を確定すると見えない価値の試算が表示されます。</div>
  }

  const totalVisitors = results.reduce((s, r) => s + r.visitors, 0)
  const avgSpend      = results[0]?.averageSpend ?? 25000

  // 認知減衰グラフ用データ
  const awarenessData = [0, 3, 6, 9, 12, 18, 24].map(m => ({
    month: `${m}ヶ月後`,
    rate: calculateAwarenessDecay(100, defaults.awarenessDecayRate, m),
  }))

  const cards = [
    {
      icon: '📣',
      title: '口コミ乗数効果',
      main: `+${intangible.womVisitors.toLocaleString()}人`,
      sub: `来訪者1人が平均${defaults.womMultiplier}人に影響`,
      body: `${totalVisitors.toLocaleString()}人 × (${defaults.womMultiplier} − 1) = ${intangible.womVisitors.toLocaleString()}人の追加来訪（2年目以降推計）`,
      source: 'TripAdvisor調査（口コミ乗数 2.3）',
      color: 'indigo',
    },
    {
      icon: '🧠',
      title: '認知の蓄積効果',
      main: `${intangible.year2AwarenessRate}%`,
      sub: `広告終了12ヶ月後の残存認知率`,
      body: `認知は広告終了後も${100 - Math.round(defaults.awarenessDecayRate * 100)}%/月のペースで緩やかに減衰。2年目以降も一定の来訪効果が継続します。`,
      source: '認知減衰モデル（月${Math.round(defaults.awarenessDecayRate * 100)}%減衰）',
      color: 'blue',
    },
    {
      icon: '🔄',
      title: 'LTV（生涯顧客価値）',
      main: formatJPY(intangible.ltv3Year),
      sub: `初年度来訪者の3年間累計売上推計`,
      body: `リピート率${Math.round(defaults.repeatRate * 100)}%を考慮した3年間の累計売上。\n年1: ${totalVisitors.toLocaleString()}人 × ¥${avgSpend.toLocaleString()} = ${formatJPY(totalVisitors * avgSpend)}\n年2: ${Math.floor(totalVisitors * defaults.repeatRate).toLocaleString()}人 / 年3: ${Math.floor(totalVisitors * defaults.repeatRate * defaults.repeatRate).toLocaleString()}人`,
      source: '観光業界リピート率平均 7%（JTB調査）',
      color: 'emerald',
    },
    {
      icon: '🌏',
      title: '地域経済波及効果',
      main: formatJPY(intangible.regionalEconomicEffect),
      sub: `地域全体への経済効果`,
      body: `来訪者の直接消費（${formatJPY(results.reduce((s, r) => s + r.revenue, 0))}）× 乗数効果${defaults.economicMultiplier}倍。\n宿泊業・交通・飲食・小売など関連産業への波及を含む。`,
      source: '経済産業省 観光産業乗数効果 1.3〜1.5倍',
      color: 'amber',
    },
  ]

  const colorClasses: Record<string, { bg: string; title: string; main: string; border: string }> = {
    indigo: { bg: 'bg-indigo-50', title: 'text-indigo-700', main: 'text-indigo-600', border: 'border-indigo-200' },
    blue:   { bg: 'bg-blue-50',   title: 'text-blue-700',   main: 'text-blue-600',   border: 'border-blue-200' },
    emerald:{ bg: 'bg-emerald-50', title: 'text-emerald-700', main: 'text-emerald-600', border: 'border-emerald-200' },
    amber:  { bg: 'bg-amber-50',  title: 'text-amber-700',  main: 'text-amber-600',  border: 'border-amber-200' },
  }

  // 12ヶ月後認知率の可視化バー
  const awarenessMonths = [0, 3, 6, 9, 12]

  return (
    <div className="p-5 space-y-4">

      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
        直接ROIに現れない「見えない価値」を定量化します。
        これらを含めた総合価値は直接ROIの3〜5倍になることが多く、長期的な意思決定に重要です。
      </div>

      {cards.map(card => {
        const cs = colorClasses[card.color]
        return (
          <div key={card.title} className={`rounded-xl border p-4 ${cs.bg} ${cs.border}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">{card.icon}</span>
              <div className="flex-1">
                <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${cs.title}`}>{card.title}</p>
                <p className={`text-2xl font-extrabold mb-1 ${cs.main}`}>{card.main}</p>
                <p className="text-xs text-slate-600 font-medium mb-2">{card.sub}</p>
                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">{card.body}</p>
                <p className="text-[10px] text-slate-400 mt-2">出典: {card.source}</p>
              </div>
            </div>
          </div>
        )
      })}

      {/* 認知減衰ビジュアライザー */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-3">認知減衰シミュレーション（月{Math.round(defaults.awarenessDecayRate * 100)}%減衰モデル）</p>
        <div className="flex items-end gap-2 h-16">
          {awarenessData.slice(0, 7).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-indigo-400 rounded-t-sm transition-all"
                style={{ height: `${d.rate / 100 * 56}px`, opacity: 0.3 + d.rate / 100 * 0.7 }}
              />
              <p className="text-[9px] text-slate-400 text-center leading-tight">{d.month.replace('ヶ月後', 'M')}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          広告終了後も{intangible.year2AwarenessRate}%の認知が残ります
        </p>
      </div>

      {/* 合計インパクト */}
      <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
        <p className="text-xs font-bold text-purple-700 mb-2">3年間の総合インパクト試算</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-slate-500">直接売上（初年度）</p>
            <p className="font-bold text-slate-800">{formatJPY(results.reduce((s, r) => s + r.revenue, 0))}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">LTV（3年累計）</p>
            <p className="font-bold text-indigo-700">{formatJPY(intangible.ltv3Year)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">口コミ追加来訪</p>
            <p className="font-bold text-slate-800">{intangible.womVisitors.toLocaleString()}人</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">地域経済波及</p>
            <p className="font-bold text-amber-700">{formatJPY(intangible.regionalEconomicEffect)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
