'use client'

import type { ROICalculationResult } from '@/lib/roi-calculator'
import { formatJPY, formatPercent } from '@/lib/roi-calculator'

interface Props {
  results: ROICalculationResult[]
}

export default function SummarySection({ results }: Props) {
  if (results.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">施策を確定するとROIサマリーが表示されます。</div>
  }

  const totalBudget   = results.reduce((s, r) => s + r.budget, 0)
  const totalVisitors = results.reduce((s, r) => s + r.visitors, 0)
  const totalRevenue  = results.reduce((s, r) => s + r.revenue, 0)
  const blendedROI    = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget * 100) : 0
  const blendedROAS   = totalBudget > 0 ? totalRevenue / totalBudget : 0
  const avgCPA        = totalVisitors > 0 ? Math.round(totalBudget / totalVisitors) : 0
  const totalBreakeven = results.reduce((s, r) => s + r.breakevenVisitors, 0)

  // 投資回収期間（月）: 月あたり来訪者を均等と仮定
  // 施策の平均期間は3〜6ヶ月と仮定
  const avgDurationMonths = 3
  const monthlyVisitors = totalVisitors / avgDurationMonths
  const breakevenMonths = monthlyVisitors > 0
    ? Math.ceil(totalBreakeven / monthlyVisitors)
    : 0

  const isPositive = blendedROI >= 0

  const kpis = [
    {
      label: 'ROI（標準シナリオ）',
      value: formatPercent(blendedROI, 1),
      sub: '(売上−投資額) ÷ 投資額',
      color: isPositive ? 'text-emerald-700' : 'text-red-600',
      bg: isPositive ? 'bg-emerald-50' : 'bg-red-50',
      border: isPositive ? 'border-emerald-200' : 'border-red-200',
      size: 'text-4xl',
    },
    {
      label: '総投資額',
      value: formatJPY(totalBudget),
      sub: '全施策合計',
      color: 'text-slate-800',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      size: 'text-2xl',
    },
    {
      label: '期待売上（推定）',
      value: formatJPY(totalRevenue),
      sub: '標準シナリオ・直接売上',
      color: 'text-indigo-700',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      size: 'text-2xl',
    },
    {
      label: 'CPA（顧客獲得単価）',
      value: `¥${avgCPA.toLocaleString()}`,
      sub: '投資額 ÷ 来訪者数',
      color: 'text-slate-700',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      size: 'text-2xl',
    },
    {
      label: 'ROAS',
      value: `${blendedROAS.toFixed(1)}x`,
      sub: '売上 ÷ 広告費',
      color: blendedROAS >= 1 ? 'text-indigo-700' : 'text-red-600',
      bg: blendedROAS >= 1 ? 'bg-indigo-50' : 'bg-red-50',
      border: blendedROAS >= 1 ? 'border-indigo-200' : 'border-red-200',
      size: 'text-2xl',
    },
    {
      label: '損益分岐点',
      value: `${totalBreakeven.toLocaleString()}人`,
      sub: `月 ${monthlyVisitors > 0 ? Math.ceil(monthlyVisitors).toLocaleString() : '—'}人で投資回収`,
      color: 'text-slate-700',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      size: 'text-2xl',
    },
  ]

  return (
    <div className="p-5 space-y-5">

      {/* ヒーローカード: ROI */}
      <div className={`rounded-2xl border p-6 text-center ${kpis[0].bg} ${kpis[0].border}`}>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">ROI（全施策・標準シナリオ）</p>
        <p className={`font-extrabold leading-none mb-2 ${kpis[0].color} ${kpis[0].size}`}>
          {kpis[0].value}
        </p>
        <p className="text-xs text-slate-500">{kpis[0].sub}</p>
        <div className="mt-3 text-xs text-slate-500">
          ({formatJPY(totalRevenue)} − {formatJPY(totalBudget)}) ÷ {formatJPY(totalBudget)} × 100
        </div>
      </div>

      {/* KPIグリッド */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.slice(1).map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg} ${kpi.border}`}>
            <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
            <p className={`font-extrabold ${kpi.color} ${kpi.size}`}>{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* 投資回収ステータス */}
      <div className={`rounded-xl border p-4 ${
        blendedROI >= 100
          ? 'bg-emerald-50 border-emerald-200'
          : blendedROI >= 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
      }`}>
        <p className="text-xs font-semibold text-slate-600 mb-1">投資回収ステータス</p>
        <p className={`text-sm font-bold ${
          blendedROI >= 100 ? 'text-emerald-700' : blendedROI >= 0 ? 'text-amber-700' : 'text-red-700'
        }`}>
          {blendedROI >= 100
            ? `投資回収 + 純利益 ${formatJPY(totalRevenue - totalBudget)} の黒字`
            : blendedROI >= 0
              ? `投資回収中 — あと ${formatJPY(totalBudget - totalRevenue)} の売上で回収完了`
              : `赤字 ${formatJPY(totalBudget - totalRevenue)} — 認知構築フェーズでは一般的`
          }
        </p>
        {breakevenMonths > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            損益分岐点: {totalBreakeven.toLocaleString()}人来訪で投資回収（月{Math.ceil(monthlyVisitors).toLocaleString()}人ペースの場合 約{breakevenMonths}ヶ月）
          </p>
        )}
      </div>

      {/* 注記 */}
      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        <strong>注：</strong>この試算は業界平均値をベースとした推計です。実際のROIはターゲット市場・施策の質・競合環境により大きく変動します。
        「見えない価値」タブには口コミ・LTV・地域経済効果など間接効果の試算があります。
      </div>
    </div>
  )
}
