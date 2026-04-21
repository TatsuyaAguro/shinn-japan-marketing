'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'
import type { ROICalculationResult, StrategyROIInput, ROIDefaults, SpendBreakdown } from '@/lib/roi-calculator'
import { calculateDiminishingReturns, formatJPY } from '@/lib/roi-calculator'

interface Props {
  results: ROICalculationResult[]
  strategyInputs: StrategyROIInput[]
  defaults: ROIDefaults
  spendBreakdown: SpendBreakdown
}

export default function DiminishingSection({ results, strategyInputs, defaults, spendBreakdown }: Props) {
  if (results.length === 0 || strategyInputs.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">施策を確定すると収穫逓減カーブが表示されます。</div>
  }

  // 全施策の合算カーブを描画
  const totalBudget = strategyInputs.reduce((s, i) => s + i.budget, 0)

  // 各施策の逓減データを合算
  const multipliers = [0.25, 0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0]
  const chartData = multipliers.map(mult => {
    const scaledBudget = totalBudget * mult
    let totalRevenue = 0
    strategyInputs.forEach(inp => {
      const scaledInput = { ...inp, budget: inp.budget * mult }
      const pts = calculateDiminishingReturns(inp.budget, defaults, scaledInput, spendBreakdown)
      // Find the closest multiplier point
      const closestPt = pts.find(p => Math.abs(p.budget - scaledInput.budget) / inp.budget < 0.15) ?? pts[4]
      // Calculate revenue from ROI
      const roi = closestPt?.roi ?? 0
      totalRevenue += scaledInput.budget * (1 + roi / 100)
    })
    const roi = scaledBudget > 0 ? ((totalRevenue - scaledBudget) / scaledBudget * 100) : 0
    return {
      budget: scaledBudget,
      budgetLabel: formatJPY(scaledBudget),
      roi: Math.round(roi * 10) / 10,
    }
  })

  // Simplified: use calculateDiminishingReturns from first strategy as representative
  const diminishingPoints = calculateDiminishingReturns(
    strategyInputs[0].budget,
    defaults,
    strategyInputs[0],
    spendBreakdown
  )

  // Find optimal point (highest ROI)
  const optimalPoint = diminishingPoints.reduce((best, pt) => pt.roi > best.roi ? pt : best, diminishingPoints[0])
  const currentROI = diminishingPoints.find(p => Math.abs(p.budget / strategyInputs[0].budget - 1.0) < 0.05) ?? { roi: results[0]?.roi ?? 0 }
  const currentBudget = strategyInputs[0].budget

  return (
    <div className="p-5 space-y-5">

      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
        予算を増減させた場合のROI変化をシミュレーションします。
        予算が一定を超えると広告単価（CPM）の上昇・広告疲弊（CTR低下）によりROIが逓減します。
      </div>

      {/* 収穫逓減カーブ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-600">
            収穫逓減カーブ（施策1: {results[0]?.strategyName}）
          </p>
          <span className="text-xs text-slate-400">
            現在予算: {formatJPY(currentBudget)}
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={diminishingPoints} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="budget"
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => formatJPY(v).replace('万円', 'M').replace('億円', 'B')}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              formatter={(v, name) => [`${Number(v).toFixed(1)}%`, 'ROI']}
              labelFormatter={v => `予算: ${formatJPY(Number(v))}`}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            {/* 効率的な範囲のハイライト */}
            {optimalPoint && (
              <ReferenceArea
                x1={diminishingPoints[0].budget}
                x2={optimalPoint.budget}
                fill="#10b981"
                fillOpacity={0.05}
              />
            )}
            {/* 現在予算ライン */}
            <ReferenceLine
              x={currentBudget}
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{ value: '現在', position: 'top', fontSize: 10, fill: '#6366f1' }}
            />
            {/* 最適予算ライン */}
            {optimalPoint && (
              <ReferenceLine
                x={optimalPoint.budget}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{ value: '最適', position: 'top', fontSize: 10, fill: '#10b981' }}
              />
            )}
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="roi"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#6366f1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 詳細テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <p className="text-xs font-semibold text-slate-600 px-4 py-3 border-b border-slate-100">
          予算別 ROIシミュレーション
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">予算</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">現在比</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">ROI</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium">評価</th>
              </tr>
            </thead>
            <tbody>
              {diminishingPoints.map((pt, i) => {
                const ratio = Math.round(pt.budget / currentBudget * 10) / 10
                const isCurrent = Math.abs(ratio - 1.0) < 0.05
                const isOptimal = pt.budget === optimalPoint?.budget
                return (
                  <tr key={i} className={`border-t border-slate-50 ${isCurrent ? 'bg-indigo-50/50' : ''}`}>
                    <td className="py-2 px-3 font-medium text-slate-700">{formatJPY(pt.budget)}</td>
                    <td className="py-2 px-3 text-right text-slate-500">×{ratio}</td>
                    <td className={`py-2 px-3 text-right font-bold ${pt.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pt.roi.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3">
                      {isCurrent && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">現在</span>}
                      {isOptimal && !isCurrent && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">最適</span>}
                      {pt.roi < 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">赤字</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 最適予算提案 */}
      {optimalPoint && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-700 mb-1">AIによる予算最適化提案</p>
          <p className="text-sm text-emerald-800 font-semibold">
            最適予算ポイント: {formatJPY(optimalPoint.budget)}（ROI {optimalPoint.roi.toFixed(1)}%）
          </p>
          <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
            {optimalPoint.budget < currentBudget
              ? `現在の予算（${formatJPY(currentBudget)}）を${formatJPY(currentBudget - optimalPoint.budget)}削減するとROIが改善します。`
              : optimalPoint.budget > currentBudget
                ? `現在の予算（${formatJPY(currentBudget)}）を${formatJPY(optimalPoint.budget - currentBudget)}増やすと更に効率的です。`
                : '現在の予算は最適ポイント付近です。'
            }
            この施策のみを対象とした計算です。詳細はROIアナリストにご相談ください。
          </p>
        </div>
      )}
    </div>
  )
}
