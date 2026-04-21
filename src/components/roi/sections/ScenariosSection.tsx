'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import type { ROICalculationResult } from '@/lib/roi-calculator'
import { formatJPY } from '@/lib/roi-calculator'

interface Props {
  results: ROICalculationResult[]
}

const SCENARIO_STYLES = {
  red:   { bg: 'bg-red-50',    border: 'border-red-200',   title: 'text-red-700',   value: 'text-red-600',   bar: '#ef4444' },
  blue:  { bg: 'bg-blue-50',   border: 'border-blue-200',  title: 'text-blue-700',  value: 'text-blue-600',  bar: '#6366f1' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-700', value: 'text-emerald-600', bar: '#10b981' },
}

export default function ScenariosSection({ results }: Props) {
  if (results.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">施策を確定するとシナリオ比較が表示されます。</div>
  }

  // 全施策を合算してシナリオを作る
  const merged = results[0].scenarios.map((_, si) => {
    const totalVisitors = results.reduce((s, r) => s + r.scenarios[si].visitors, 0)
    const totalRevenue  = results.reduce((s, r) => s + r.scenarios[si].revenue, 0)
    const totalBudget   = results.reduce((s, r) => s + r.budget, 0)
    const roi  = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget * 100) : 0
    const roas = totalBudget > 0 ? totalRevenue / totalBudget : 0
    const cpa  = totalVisitors > 0 ? Math.round(totalBudget / totalVisitors) : 0
    return {
      label:    results[0].scenarios[si].label,
      colorKey: results[0].scenarios[si].colorKey,
      multiplier: results[0].scenarios[si].multiplier,
      totalVisitors,
      totalRevenue,
      totalBudget,
      roi: Math.round(roi * 10) / 10,
      roas: Math.round(roas * 100) / 100,
      cpa,
    }
  })

  const chartData = [
    {
      name: '来訪者数',
      悲観: merged[0].totalVisitors,
      標準: merged[1].totalVisitors,
      楽観: merged[2].totalVisitors,
    },
  ]

  const roiData = [
    { name: 'ROI比較（%）', 悲観: merged[0].roi, 標準: merged[1].roi, 楽観: merged[2].roi },
  ]

  return (
    <div className="p-5 space-y-5">

      {/* 3シナリオカード */}
      <div className="grid grid-cols-3 gap-3">
        {merged.map(s => {
          const st = SCENARIO_STYLES[s.colorKey]
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${st.bg} ${st.border}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-bold ${st.title}`}>{s.label}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${st.title}`}>
                  ×{s.multiplier}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500">来訪者数</p>
                  <p className={`text-lg font-extrabold ${st.value}`}>
                    {s.totalVisitors.toLocaleString()}<span className="text-xs font-normal ml-0.5">人</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">売上（推定）</p>
                  <p className={`text-base font-bold ${st.value}`}>{formatJPY(s.totalRevenue)}</p>
                </div>
                <div className="pt-2 border-t border-white/50 grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[10px] text-slate-500">ROI</p>
                    <p className={`text-sm font-extrabold ${st.value}`}>{s.roi.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">ROAS</p>
                    <p className={`text-sm font-extrabold ${st.value}`}>{s.roas.toFixed(1)}x</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-500">CPA（顧客獲得単価）</p>
                    <p className={`text-sm font-bold ${st.value}`}>¥{s.cpa.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 来訪者数比較グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-3">来訪者数比較（シナリオ別）</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toLocaleString()}`} />
            <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString()}人`, name]} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="悲観" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="標準" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="楽観" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ROI比較グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-3">ROI比較（シナリオ別）</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={roiData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} tickLine={false} axisLine={false} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1)}%`, 'ROI']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="悲観" radius={[0, 4, 4, 0]}>
              <Cell fill="#ef4444" />
            </Bar>
            <Bar dataKey="標準" radius={[0, 4, 4, 0]}>
              <Cell fill="#6366f1" />
            </Bar>
            <Bar dataKey="楽観" radius={[0, 4, 4, 0]}>
              <Cell fill="#10b981" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
        <p className="text-xs font-semibold text-amber-700 mb-1">シナリオの計算方法</p>
        <p className="text-xs text-amber-600 leading-relaxed">
          標準シナリオは業界平均値で計算。悲観（×0.7）は想定よりCVR・CTRが低い場合、楽観（×1.3）は施策効果が高い場合を想定。
          実績CPM・CTR・CVRが分かれば前提条件で入力することで精度が上がります。
        </p>
      </div>
    </div>
  )
}
