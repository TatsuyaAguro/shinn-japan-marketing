'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { ROICalculationResult } from '@/lib/roi-calculator'
import { formatJPY } from '@/lib/roi-calculator'

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']

interface Props {
  results: ROICalculationResult[]
}

export default function EfficiencySection({ results }: Props) {
  if (results.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">施策を確定すると施策別比較が表示されます。</div>
  }

  const cpaData = results.map((r, i) => ({
    name: r.strategyName.slice(0, 10),
    CPA: r.cpa,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => a.CPA - b.CPA)

  const roiData = results.map((r, i) => ({
    name: r.strategyName.slice(0, 10),
    ROI: r.roi,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.ROI - a.ROI)

  const visitorsData = results.map((r, i) => ({
    name: r.strategyName.slice(0, 10),
    来訪者数: r.visitors,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.来訪者数 - a.来訪者数)

  // 最適配分提案
  const bestROI    = results.reduce((best, r) => r.roi > best.roi ? r : best, results[0])
  const bestCPA    = results.reduce((best, r) => r.cpa < best.cpa ? r : best, results[0])
  const totalBudget = results.reduce((s, r) => s + r.budget, 0)

  return (
    <div className="p-5 space-y-5">

      {/* ランキングカード */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
          <p className="text-xs font-bold text-indigo-700 mb-2">最高ROI施策 🏆</p>
          <p className="text-sm font-semibold text-slate-800">{bestROI.strategyName}</p>
          <p className="text-xl font-extrabold text-indigo-600 mt-1">{bestROI.roi.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-0.5">予算 {formatJPY(bestROI.budget)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs font-bold text-emerald-700 mb-2">最低CPA施策 ⚡</p>
          <p className="text-sm font-semibold text-slate-800">{bestCPA.strategyName}</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">¥{bestCPA.cpa.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">顧客獲得単価</p>
        </div>
      </div>

      {/* CPA比較グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-600">CPA（顧客獲得単価）比較</p>
          <span className="text-xs text-slate-400">低いほど効率的</span>
        </div>
        <ResponsiveContainer width="100%" height={results.length * 40 + 20}>
          <BarChart data={cpaData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} tickLine={false} axisLine={false} />
            <Tooltip formatter={v => [`¥${Number(v).toLocaleString()}`, 'CPA']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="CPA" radius={[0, 4, 4, 0]}>
              {cpaData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ROI比較グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-600">ROI比較</p>
          <span className="text-xs text-slate-400">高いほど効率的</span>
        </div>
        <ResponsiveContainer width="100%" height={results.length * 40 + 20}>
          <BarChart data={roiData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} tickLine={false} axisLine={false} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1)}%`, 'ROI']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="ROI" radius={[0, 4, 4, 0]}>
              {roiData.map((d, i) => <Cell key={i} fill={d.ROI >= 0 ? d.color : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 来訪者数比較 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-600">推定来訪者数比較</p>
          <span className="text-xs text-slate-400">標準シナリオ</span>
        </div>
        <ResponsiveContainer width="100%" height={results.length * 40 + 20}>
          <BarChart data={visitorsData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v.toLocaleString()}人`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={72} tickLine={false} axisLine={false} />
            <Tooltip formatter={v => [`${Number(v).toLocaleString()}人`, '来訪者数']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="来訪者数" radius={[0, 4, 4, 0]}>
              {visitorsData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 予算配分提案 */}
      {results.length >= 2 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs font-bold text-amber-700 mb-2">予算配分の最適化提案</p>
          <div className="space-y-2">
            {results.sort((a, b) => b.roi - a.roi).map((r, i) => {
              const pct = totalBudget > 0 ? Math.round(r.budget / totalBudget * 100) : 0
              const isTop = i === 0
              return (
                <div key={r.strategyId} className="flex items-center gap-3">
                  <p className="text-xs text-slate-700 flex-1 font-medium">{r.strategyName.slice(0, 16)}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-white rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
                    {isTop && <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">最適</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-amber-600 mt-3">
            ROIが最も高い「{bestROI.strategyName}」への配分を増やし、
            CPA改善のため予算集中を検討してください。詳細はAIに相談できます。
          </p>
        </div>
      )}
    </div>
  )
}
