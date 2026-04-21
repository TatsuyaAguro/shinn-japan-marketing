'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@/lib/data'
import { fetchConfirmedStrategies } from '@/lib/actions/strategy'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

interface ROIItem {
  id: string
  name: string
  targetCountries: string[]
  recommendedBudget: string
  duration: string
  estimatedCost: number
  estimatedRevenue: number
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']

function parseInitialBudget(budget: string): number {
  const m = budget.match(/[\d,]+/)
  if (!m) return 500000
  return parseInt(m[0].replace(/,/g, '')) * 10000
}

function formatJPY(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000)}万円`
  return `${n.toLocaleString()}円`
}

export default function ROITab({ client }: { client: Client }) {
  const [items, setItems] = useState<ROIItem[]>([])
  const [status, setStatus] = useState('initial')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConfirmedStrategies(client.id).then(s => {
      setStatus(s.status)
      if (s.strategies.length > 0) {
        setItems(s.strategies.map(st => ({
          id: st.id,
          name: st.name,
          targetCountries: st.targetCountries,
          recommendedBudget: st.recommendedBudget,
          duration: st.duration,
          estimatedCost: parseInitialBudget(st.recommendedBudget),
          estimatedRevenue: parseInitialBudget(st.recommendedBudget) * 3,
        })))
      }
      setLoading(false)
    })
  }, [client.id])

  const updateItem = (id: string, field: 'estimatedCost' | 'estimatedRevenue', value: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-600 mb-2">確定施策がありません</p>
        <p className="text-sm text-slate-400">「AI戦略室」タブで施策を確定するとROI試算ができます。</p>
      </div>
    )
  }

  const chartData = items.map((item, i) => {
    const roi = item.estimatedCost > 0
      ? ((item.estimatedRevenue - item.estimatedCost) / item.estimatedCost * 100)
      : 0
    return { name: item.name.slice(0, 10), roi, color: COLORS[i % COLORS.length] }
  })

  const totalCost = items.reduce((s, i) => s + i.estimatedCost, 0)
  const totalRevenue = items.reduce((s, i) => s + i.estimatedRevenue, 0)
  const blendedROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost * 100) : 0

  return (
    <div className="space-y-5">
      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '総投資額', value: formatJPY(totalCost), color: 'text-slate-800', sub: '全施策合計' },
          { label: '期待リターン', value: formatJPY(totalRevenue), color: 'text-emerald-700', sub: '推定合計' },
          { label: 'ブレンドROI', value: `${blendedROI.toFixed(0)}%`, color: blendedROI >= 0 ? 'text-indigo-700' : 'text-red-600', sub: '全体収益率' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ROI棒グラフ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">施策別 ROI比較</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={v => [`${Number(v).toFixed(0)}%`, 'ROI']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.roi >= 0 ? d.color : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 施策ごとの入力テーブル */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">施策別 試算入力</h3>
        <div className="space-y-4">
          {items.map((item, idx) => {
            const roi = item.estimatedCost > 0
              ? ((item.estimatedRevenue - item.estimatedCost) / item.estimatedCost * 100)
              : 0
            return (
              <div key={item.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.targetCountries?.join('・')} · {item.duration}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">AI推奨予算: {item.recommendedBudget}</p>
                  </div>
                  <div className={`text-lg font-extrabold ${roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {roi.toFixed(0)}%
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">投資額（万円）</label>
                    <input
                      type="number"
                      value={Math.round(item.estimatedCost / 10000)}
                      onChange={e => updateItem(item.id, 'estimatedCost', Number(e.target.value) * 10000)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">期待売上（万円）</label>
                    <input
                      type="number"
                      value={Math.round(item.estimatedRevenue / 10000)}
                      onChange={e => updateItem(item.id, 'estimatedRevenue', Number(e.target.value) * 10000)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
