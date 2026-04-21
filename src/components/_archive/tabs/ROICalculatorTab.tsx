'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Client } from '@/lib/data'
import { checkAnthropicKey } from '@/lib/actions/analyses'

// ── 型定義 ──────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; price: number
  capacityPerSession: number; maxSessionsPerMonth: number; currentMonthlyBookings: number
}
interface BookingChannel {
  id: string; label: string; type: string
  percentage: number; commissionRate: number; cvr: number
}
interface ProposedStrategy {
  title: string; platform: string; contentType: string; description: string; frequency: string
  budgetSuggestion: number; estimatedImpressions: number; estimatedReach: number
  engagementRate: number; ctr: number
}
interface ConfirmedStrategy extends ProposedStrategy { id: string; budget: number }
interface ChatMessage { role: 'user' | 'assistant'; content: string; proposedStrategies?: ProposedStrategy[] }

// ── 定数 ────────────────────────────────────────────────────────────────────

const BUSINESS_MODELS = [
  { id: 'experience', label: '体験型', description: 'ツアー・アクティビティ' },
  { id: 'accommodation', label: '宿泊型', description: '旅館・ホテル' },
  { id: 'municipality', label: '自治体型', description: '地域全体の観光誘客' },
  { id: 'other', label: 'その他', description: '自由入力' },
]

const DEFAULT_CHANNELS: BookingChannel[] = [
  { id: 'direct', label: '自社サイト直接予約', type: 'direct', percentage: 30, commissionRate: 0, cvr: 3.0 },
  { id: 'ota', label: 'OTA（Viator / GetYourGuide 等）', type: 'ota', percentage: 50, commissionRate: 20, cvr: 5.0 },
  { id: 'agent', label: '海外旅行エージェント経由', type: 'agent', percentage: 10, commissionRate: 25, cvr: 8.0 },
  { id: 'sns', label: 'SNSからの問い合わせ', type: 'sns', percentage: 10, commissionRate: 0, cvr: 1.5 },
  { id: 'other', label: 'その他経路', type: 'other', percentage: 0, commissionRate: 0, cvr: 2.0 },
]

const SCENARIOS = [
  { id: 'pessimistic', label: '悲観', factor: 0.7, color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  { id: 'standard',    label: '標準', factor: 1.0, color: '#3b82f6', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  { id: 'optimistic',  label: '楽観', factor: 1.3, color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
]

const INNER_TABS = [
  { id: 'settings', label: '① ビジネス設定', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'ai_chat', label: '② AI戦略相談', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'funnel', label: '③ ファネル試算', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'regional', label: '④ 地域経済効果', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString('ja-JP') }
function fmtM(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}万`
  return fmt(n)
}
function uid() { return Math.random().toString(36).slice(2, 9) }

function calcFunnel(s: ConfirmedStrategy, channels: BookingChannel[], products: Product[], factor: number) {
  const impressions = Math.round(s.estimatedImpressions * factor)
  const reach = Math.round(s.estimatedReach * factor)
  const engagements = Math.round(reach * s.engagementRate)
  const siteVisitors = Math.round(reach * s.ctr)

  const totalPct = channels.reduce((acc, c) => acc + c.percentage, 0) || 100
  const avgPrice = products.length > 0 ? products.reduce((acc, p) => acc + p.price, 0) / products.length : 15000

  let totalBookings = 0, grossRevenue = 0
  for (const ch of channels) {
    const chVisitors = siteVisitors * (ch.percentage / totalPct)
    const chBookings = chVisitors * (ch.cvr / 100)
    totalBookings += chBookings
    grossRevenue += chBookings * avgPrice
  }

  const weightedCommRate = channels.reduce((acc, ch) => acc + (ch.percentage / totalPct) * (ch.commissionRate / 100), 0)
  const commission = grossRevenue * weightedCommRate
  const netRevenue = grossRevenue - commission
  const roi = s.budget > 0 ? (netRevenue - s.budget) / s.budget * 100 : 0
  const cpa = totalBookings > 0 ? s.budget / totalBookings : 0
  const roas = s.budget > 0 ? grossRevenue / s.budget * 100 : 0
  const priceAfterComm = avgPrice * (1 - weightedCommRate)
  const breakEvenBookings = priceAfterComm > 0 ? Math.ceil(s.budget / priceAfterComm) : 0

  return {
    impressions, reach, engagements, siteVisitors,
    totalBookings: Math.round(totalBookings),
    grossRevenue: Math.round(grossRevenue),
    commission: Math.round(commission),
    netRevenue: Math.round(netRevenue),
    roi, cpa: Math.round(cpa), roas: Math.round(roas), breakEvenBookings,
  }
}

// ── コンポーネント ────────────────────────────────────────────────────────────

export default function ROICalculatorTab({ client }: { client: Client }) {
  type InnerTab = 'settings' | 'ai_chat' | 'funnel' | 'regional'
  const [innerTab, setInnerTab] = useState<InnerTab>('settings')

  // ── Section 1 State ───────────────────────────────────────────────────────
  const [businessModel, setBusinessModel] = useState('experience')
  const [businessModelOther, setBusinessModelOther] = useState('')
  const [products, setProducts] = useState<Product[]>(() => [
    { id: uid(), name: '', price: 15000, capacityPerSession: 6, maxSessionsPerMonth: 20, currentMonthlyBookings: 5 },
  ])
  const [channels, setChannels] = useState<BookingChannel[]>(DEFAULT_CHANNELS)
  const [monthlyBudget, setMonthlyBudget] = useState(500_000)
  const [spendPerVisitor, setSpendPerVisitor] = useState(180_000)

  // ── Section 2 State ───────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Section 3 State ───────────────────────────────────────────────────────
  const [confirmedStrategies, setConfirmedStrategies] = useState<ConfirmedStrategy[]>([])
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(1)

  useEffect(() => { checkAnthropicKey().then(setHasApiKey) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── 計算 ──────────────────────────────────────────────────────────────────
  const totalBudget = useMemo(() => confirmedStrategies.reduce((s, st) => s + st.budget, 0), [confirmedStrategies])

  const strategyResults = useMemo(() =>
    confirmedStrategies.map(s => calcFunnel(s, channels, products, SCENARIOS[selectedScenarioIdx].factor)),
    [confirmedStrategies, channels, products, selectedScenarioIdx]
  )

  const combinedByScenario = useMemo(() =>
    SCENARIOS.map(sc => {
      const results = confirmedStrategies.map(s => calcFunnel(s, channels, products, sc.factor))
      const totalBookings = results.reduce((s, r) => s + r.totalBookings, 0)
      const totalGross = results.reduce((s, r) => s + r.grossRevenue, 0)
      const totalNet = results.reduce((s, r) => s + r.netRevenue, 0)
      return {
        scenario: sc,
        totalBookings,
        totalGrossRevenue: totalGross,
        totalNetRevenue: totalNet,
        totalROI: totalBudget > 0 ? (totalNet - totalBudget) / totalBudget * 100 : 0,
        totalCPA: totalBookings > 0 ? totalBudget / totalBookings : 0,
      }
    }),
    [confirmedStrategies, channels, products, totalBudget]
  )

  // ── ハンドラー ────────────────────────────────────────────────────────────
  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }
  function removeProduct(id: string) { setProducts(prev => prev.filter(p => p.id !== id)) }
  function updateChannel(id: string, patch: Partial<BookingChannel>) {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }
  function confirmStrategy(proposed: ProposedStrategy) {
    if (confirmedStrategies.some(s => s.title === proposed.title)) return
    setConfirmedStrategies(prev => [...prev, { ...proposed, id: uid(), budget: proposed.budgetSuggestion }])
    setInnerTab('funnel')
  }
  function removeStrategy(id: string) { setConfirmedStrategies(prev => prev.filter(s => s.id !== id)) }
  function updateStrategyBudget(id: string, budget: number) {
    setConfirmedStrategies(prev => prev.map(s => s.id === id ? { ...s, budget } : s))
  }

  async function sendMessage() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true); setChatError(null)
    try {
      const allMsgs = [...chatMessages, userMsg]
      const res = await fetch('/api/roi-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
          client, businessModel, products, channels, monthlyBudget, confirmedStrategies,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setChatError(data.error); return }
      setChatMessages(prev => [...prev, {
        role: 'assistant', content: data.content,
        proposedStrategies: data.strategies?.length > 0 ? data.strategies : undefined,
      }])
    } catch { setChatError('通信エラーが発生しました') }
    finally { setChatLoading(false) }
  }

  function exportCSV() {
    const headers = ['施策', '予算(円)', '推定リーチ', 'サイト流入', '予約数', '粗売上(円)', '手数料(円)', '純売上(円)', 'ROI(%)', 'CPA(円)', 'ROAS(%)']
    const rows = confirmedStrategies.map((s, i) => {
      const r = strategyResults[i]
      return [s.title, s.budget, r?.reach, r?.siteVisitors, r?.totalBookings, r?.grossRevenue, r?.commission, r?.netRevenue, r?.roi.toFixed(1), r?.cpa, r?.roas]
    })
    const total = combinedByScenario[1]
    rows.push(['合計（標準）', totalBudget, '—', '—', total.totalBookings, total.totalGrossRevenue, '—', total.totalNetRevenue, total.totalROI.toFixed(1), Math.round(total.totalCPA), '—'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'roi_simulation.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 共通スタイル ──────────────────────────────────────────────────────────
  const inputCls = 'px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const channelTotalPct = channels.reduce((s, c) => s + c.percentage, 0)

  // ── レンダリング ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">ROI試算</h2>
          <p className="text-xs text-slate-500 mt-0.5">AIと一緒にマーケティング戦略を設計し、効果を試算する</p>
        </div>
        {confirmedStrategies.length > 0 && (
          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${combinedByScenario[1].totalROI >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            ROI（標準）: {combinedByScenario[1].totalROI >= 0 ? '+' : ''}{combinedByScenario[1].totalROI.toFixed(0)}%
          </div>
        )}
      </div>

      {/* 内部タブ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto">
          {INNER_TABS.map(tab => (
            <button key={tab.id} onClick={() => setInnerTab(tab.id as InnerTab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 cursor-pointer shrink-0 ${
                innerTab === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
              {tab.id === 'funnel' && confirmedStrategies.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {confirmedStrategies.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/* Tab 1: ビジネス設定                                     */}
      {/* ─────────────────────────────────────────────────────── */}
      {innerTab === 'settings' && (
        <div className="space-y-5">
          {/* ビジネスモデル */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">ビジネスモデル</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {BUSINESS_MODELS.map(bm => (
                <label key={bm.id} className={`flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-all ${businessModel === bm.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="bm" value={bm.id} checked={businessModel === bm.id} onChange={() => setBusinessModel(bm.id)} className="sr-only" />
                  <span className="text-sm font-medium text-slate-700">{bm.label}</span>
                  <span className="text-xs text-slate-400">{bm.description}</span>
                </label>
              ))}
            </div>
            {businessModel === 'other' && (
              <input value={businessModelOther} onChange={e => setBusinessModelOther(e.target.value)}
                placeholder="ビジネスモデルを入力してください" className={`mt-3 w-full ${inputCls}`} />
            )}
          </div>

          {/* 商品・サービス */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">商品・サービス一覧</h3>
              <button onClick={() => setProducts(prev => [...prev, { id: uid(), name: '', price: 15000, capacityPerSession: 6, maxSessionsPerMonth: 20, currentMonthlyBookings: 0 }])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                商品を追加
              </button>
            </div>
            <div className="space-y-4">
              {products.map((p, i) => {
                const maxCapacity = p.capacityPerSession * p.maxSessionsPerMonth
                const occupancyRate = maxCapacity > 0 ? Math.round(p.currentMonthlyBookings / maxCapacity * 100) : 0
                return (
                  <div key={p.id} className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">商品{i + 1}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-slate-400">稼働率 {occupancyRate}%</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(occupancyRate, 100)}%` }} />
                        </div>
                      </div>
                      {products.length > 1 && (
                        <button onClick={() => removeProduct(p.id)} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="lg:col-span-3">
                        <label className="text-xs text-slate-500 mb-1 block">商品名・サービス名</label>
                        <input value={p.name} onChange={e => updateProduct(p.id, { name: e.target.value })}
                          placeholder="例：金沢お母さんご飯作り体験" className={`w-full ${inputCls}`} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">単価（円/人）</label>
                        <input type="number" value={p.price} onChange={e => updateProduct(p.id, { price: Number(e.target.value) })} className={`w-full ${inputCls}`} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">1回の定員（人）</label>
                        <input type="number" value={p.capacityPerSession} onChange={e => updateProduct(p.id, { capacityPerSession: Number(e.target.value) })} className={`w-full ${inputCls}`} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">月最大開催数（回）</label>
                        <input type="number" value={p.maxSessionsPerMonth} onChange={e => updateProduct(p.id, { maxSessionsPerMonth: Number(e.target.value) })} className={`w-full ${inputCls}`} />
                      </div>
                      <div className="lg:col-span-3">
                        <label className="text-xs text-slate-500 mb-1 block">現在の月間予約数（人）</label>
                        <input type="number" value={p.currentMonthlyBookings} onChange={e => updateProduct(p.id, { currentMonthlyBookings: Number(e.target.value) })} className={`w-48 ${inputCls}`} />
                        <span className="text-xs text-slate-400 ml-2">月最大受入 {fmt(maxCapacity)}人 · 残り {fmt(Math.max(0, maxCapacity - p.currentMonthlyBookings))}人分の余裕</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 予約経路 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">予約経路設定</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${Math.abs(channelTotalPct - 100) > 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                合計: {channelTotalPct}%{Math.abs(channelTotalPct - 100) > 1 ? ' ⚠' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="text-left font-medium pb-2 pr-3">経路</th>
                    <th className="text-center font-medium pb-2 px-2">割合%</th>
                    <th className="text-center font-medium pb-2 px-2">手数料%</th>
                    <th className="text-center font-medium pb-2 px-2">CVR%</th>
                    <th className="text-left font-medium pb-2 pl-2 text-slate-400">根拠</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {channels.map(ch => (
                    <tr key={ch.id}>
                      <td className="py-2 pr-3 font-medium text-slate-700 whitespace-nowrap">{ch.label}</td>
                      <td className="py-2 px-2">
                        <input type="number" min={0} max={100} value={ch.percentage} onChange={e => updateChannel(ch.id, { percentage: Number(e.target.value) })}
                          className="w-14 text-center px-1.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min={0} max={100} value={ch.commissionRate} onChange={e => updateChannel(ch.id, { commissionRate: Number(e.target.value) })}
                          className="w-14 text-center px-1.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min={0} max={100} step={0.5} value={ch.cvr} onChange={e => updateChannel(ch.id, { cvr: Number(e.target.value) })}
                          className="w-14 text-center px-1.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="py-2 pl-2 text-slate-400 text-xs">
                        {ch.type === 'direct' && '自社サイト平均 2〜5%'}
                        {ch.type === 'ota' && 'Viator/GYG 平均 20%手数料'}
                        {ch.type === 'agent' && 'エージェント 20〜30%手数料'}
                        {ch.type === 'sns' && 'SNS直接問い合わせ CVR低め'}
                        {ch.type === 'other' && '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 予算 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">月次マーケティング予算</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-slate-500 shrink-0">¥</span>
              <input type="number" value={monthlyBudget} step={100_000}
                onChange={e => setMonthlyBudget(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-xl font-bold text-blue-700 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input type="range" min={100_000} max={10_000_000} step={100_000} value={monthlyBudget}
              onChange={e => setMonthlyBudget(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>¥10万</span><span>¥1,000万</span>
            </div>
            <p className="text-xs text-slate-400 mt-3">この予算をAI相談で施策ごとに配分します。AIが最適な配分を提案します。</p>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setInnerTab('ai_chat')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors cursor-pointer font-medium">
              AI戦略相談へ進む
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* Tab 2: AI戦略相談                                       */}
      {/* ─────────────────────────────────────────────────────── */}
      {innerTab === 'ai_chat' && (
        <div className="space-y-4">
          {/* 確定済み施策チップ */}
          {confirmedStrategies.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 mb-2">確定済み施策 {confirmedStrategies.length}件</p>
              <div className="flex flex-wrap gap-2">
                {confirmedStrategies.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-full text-xs text-emerald-700 font-medium">
                    {s.title}
                    <button onClick={() => removeStrategy(s.id)} className="text-emerald-400 hover:text-red-500 cursor-pointer">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => setInnerTab('funnel')}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-full hover:bg-emerald-700 cursor-pointer font-medium">
                  試算結果を見る →
                </button>
              </div>
            </div>
          )}

          {!hasApiKey ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm text-slate-500">ANTHROPIC_API_KEY を .env.local に設定すると</p>
              <p className="text-sm text-slate-500">AIによる戦略コンサルティングが利用できます</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 flex flex-col" style={{ height: '520px' }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm">AIマーケティングコンサルタントに相談してください</p>
                    <div className="flex flex-col gap-2 mt-2">
                      {[
                        `月${fmtM(monthlyBudget)}円の予算でインバウンド集客を最大化したい`,
                        `${client.targetMarket}向けにSNSで効果的な施策を提案して`,
                        '今すぐ始められる施策を優先度順に教えて',
                      ].map(suggestion => (
                        <button key={suggestion} onClick={() => setChatInput(suggestion)}
                          className="text-xs text-blue-600 border border-blue-100 bg-blue-50 rounded-full px-3 py-1.5 hover:bg-blue-100 cursor-pointer text-left">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-violet-100 text-violet-700'}`}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className="max-w-[82%] space-y-2">
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'}`}>
                        {msg.content.split('\n').map((line, j) => <p key={j} className="empty:h-2">{line}</p>)}
                      </div>
                      {/* 施策提案カード */}
                      {msg.proposedStrategies?.map((ps, j) => (
                        <div key={j} className="border-2 border-violet-200 bg-violet-50/50 rounded-xl p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-violet-800">{ps.title}</p>
                              <p className="text-xs text-violet-600">{ps.platform} · {ps.contentType} · {ps.frequency}</p>
                            </div>
                            <span className="text-sm font-bold text-violet-700 shrink-0">¥{fmtM(ps.budgetSuggestion)}/月</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{ps.description}</p>
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 bg-white rounded-lg p-2">
                            <div><span className="text-slate-400">推定リーチ</span><br /><span className="font-semibold">{fmt(ps.estimatedReach)}人</span></div>
                            <div><span className="text-slate-400">エンゲージ率</span><br /><span className="font-semibold">{(ps.engagementRate * 100).toFixed(1)}%</span></div>
                            <div><span className="text-slate-400">サイトCTR</span><br /><span className="font-semibold">{(ps.ctr * 100).toFixed(1)}%</span></div>
                          </div>
                          <button onClick={() => confirmStrategy(ps)}
                            disabled={confirmedStrategies.some(s => s.title === ps.title)}
                            className={`w-full py-2 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                              confirmedStrategies.some(s => s.title === ps.title)
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-violet-600 text-white hover:bg-violet-700'
                            }`}>
                            {confirmedStrategies.some(s => s.title === ps.title) ? '✓ 試算に追加済み' : 'この施策で試算する'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {chatError && <div className="px-4 py-2 bg-red-50 text-red-700 text-xs border-t border-red-100">{chatError}</div>}
              <div className="border-t border-slate-100 p-3 flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="AIに相談（例：「月50万円でフランス人旅行者にリールで訴求したい」）"
                  disabled={chatLoading}
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={sendMessage} disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* Tab 3: ファネル試算                                     */}
      {/* ─────────────────────────────────────────────────────── */}
      {innerTab === 'funnel' && (
        <div className="space-y-5">
          {confirmedStrategies.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="text-sm text-slate-400 mb-4">施策がまだ確定されていません</p>
              <button onClick={() => setInnerTab('ai_chat')}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer">
                AI相談で施策を確定する
              </button>
            </div>
          ) : (
            <>
              {/* シナリオ選択 + 合計 */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {confirmedStrategies.length}施策 · 合計予算 <span className="font-semibold text-slate-700">¥{fmtM(totalBudget)}/月</span>
                </p>
                <div className="flex gap-1.5">
                  {SCENARIOS.map((sc, i) => (
                    <button key={sc.id} onClick={() => setSelectedScenarioIdx(i)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${selectedScenarioIdx === i ? 'text-white' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`}
                      style={selectedScenarioIdx === i ? { backgroundColor: sc.color } : undefined}>
                      {sc.label} ×{sc.factor}
                    </button>
                  ))}
                </div>
              </div>

              {/* 施策別ファネル */}
              {confirmedStrategies.map((strategy, i) => {
                const r = strategyResults[i]
                if (!r) return null
                const sc = SCENARIOS[selectedScenarioIdx]
                const STEPS = [
                  { n: 1, label: 'インプレッション', value: `${fmt(r.impressions)}回`, sub: `${strategy.platform}で配信`, note: 'CPM換算' },
                  { n: 2, label: 'リーチ数', value: `${fmt(r.reach)}人`, sub: `ユニーク（${sc.label}×${sc.factor}）`, note: `視聴率×市場係数` },
                  { n: 3, label: 'エンゲージメント', value: `${fmt(r.engagements)}件`, sub: `${(strategy.engagementRate*100).toFixed(1)}% · いいね・保存等`, note: `出典：${strategy.platform} Insights` },
                  { n: 4, label: 'サイト流入', value: `${fmt(r.siteVisitors)}人`, sub: `CTR ${(strategy.ctr*100).toFixed(1)}%`, note: '業界平均クリック率' },
                  { n: 5, label: '予約数', value: `${fmt(r.totalBookings)}件`, sub: '全予約経路の合算', note: 'CVR加重平均' },
                  { n: 6, label: '純売上増加', value: `¥${fmtM(r.netRevenue)}`, sub: `粗売上¥${fmtM(r.grossRevenue)} - 手数料¥${fmtM(r.commission)}`, note: '' },
                ]
                return (
                  <div key={strategy.id} className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800">{strategy.title}</h4>
                        <p className="text-xs text-slate-500">{strategy.platform} · {strategy.contentType} · {strategy.frequency}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{strategy.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-1">施策予算/月</p>
                          <input type="number" value={strategy.budget} step={50000}
                            onChange={e => updateStrategyBudget(strategy.id, Number(e.target.value))}
                            className="w-28 text-right px-2 py-1 text-sm font-bold text-blue-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <button onClick={() => removeStrategy(strategy.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 6-step funnel */}
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                      {STEPS.map((step, j) => (
                        <div key={step.n} className="bg-slate-50 rounded-xl p-3 relative">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{step.n}</span>
                            <span className="text-xs text-slate-500 leading-tight">{step.label}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{step.value}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{step.sub}</p>
                          {step.note && <p className="text-xs text-slate-300 mt-0.5 truncate" title={step.note}>{step.note}</p>}
                          {j < STEPS.length - 1 && (
                            <div className="hidden lg:flex absolute -right-1 top-1/2 -translate-y-1/2 z-10">
                              <svg className="w-2 h-2 text-slate-400 fill-current" viewBox="0 0 8 8">
                                <path d="M0 0L8 4L0 8z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">ROI</p>
                        <p className={`text-2xl font-bold ${r.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {r.roi >= 0 ? '+' : ''}{r.roi.toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">CPA（顧客獲得単価）</p>
                        <p className="text-2xl font-bold text-slate-800">¥{fmt(r.cpa)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 mb-0.5">ROAS</p>
                        <p className="text-2xl font-bold text-blue-700">{fmt(r.roas)}%</p>
                      </div>
                    </div>

                    {/* Break-even */}
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <span className="font-semibold">損益分岐点:</span> 月<span className="font-bold">{fmt(r.breakEvenBookings)}件</span>の予約で広告費を回収。
                        現在の月間予約数（{products.reduce((s, p) => s + p.currentMonthlyBookings, 0)}人）との差を確認してください。
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* 3シナリオ比較 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-5">3シナリオ比較（全施策合算）</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {combinedByScenario.map(sc => (
                    <div key={sc.scenario.id} className={`rounded-xl border-2 ${sc.scenario.border} ${sc.scenario.bg} p-5`}>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sc.scenario.badge}`}>
                        {sc.scenario.label}シナリオ ×{sc.scenario.factor}
                      </span>
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className={`text-xs ${sc.scenario.text} opacity-70`}>予約数</p>
                          <p className={`text-3xl font-bold ${sc.scenario.text}`}>{fmt(sc.totalBookings)}<span className="text-base font-normal ml-1">件</span></p>
                        </div>
                        <div>
                          <p className={`text-xs ${sc.scenario.text} opacity-70`}>純売上増加</p>
                          <p className={`text-xl font-bold ${sc.scenario.text}`}>¥{fmtM(sc.totalNetRevenue)}</p>
                        </div>
                        <div className={`pt-3 border-t ${sc.scenario.border} grid grid-cols-2 gap-2`}>
                          <div>
                            <p className="text-xs text-slate-500">ROI</p>
                            <p className={`text-lg font-bold ${sc.totalROI >= 0 ? sc.scenario.text : 'text-red-500'}`}>
                              {sc.totalROI >= 0 ? '+' : ''}{sc.totalROI.toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">CPA</p>
                            <p className="text-lg font-bold text-slate-700">¥{fmtM(sc.totalCPA)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={combinedByScenario.map(sc => ({ name: sc.scenario.label, value: sc.totalNetRevenue, fill: sc.scenario.color }))} barSize={56}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `¥${fmtM(v)}`} />
                    <Tooltip formatter={(v) => [`¥${fmt(Number(v))}`, '純売上増加']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {combinedByScenario.map((_, i) => <Cell key={i} fill={combinedByScenario[i].scenario.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 書き出しボタン */}
              <div className="flex gap-3">
                <button onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSVで書き出し
                </button>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  提案書に反映する
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* Tab 4: 地域経済波及効果                                 */}
      {/* ─────────────────────────────────────────────────────── */}
      {innerTab === 'regional' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">地域経済波及効果（参考）</h3>
            <p className="text-xs text-slate-500 mb-5">来訪者がもたらす地域全体への経済効果。クライアントの売上とは別に、地域貢献として提案書で活用できます。</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">来訪者一人当たり消費額（円）</label>
                <input type="number" value={spendPerVisitor} step={10_000}
                  onChange={e => setSpendPerVisitor(Number(e.target.value))}
                  className={`w-full text-lg font-bold ${inputCls}`} />
                <input type="range" min={50_000} max={500_000} step={10_000} value={spendPerVisitor}
                  onChange={e => setSpendPerVisitor(Number(e.target.value))}
                  className="w-full mt-2 accent-blue-600 cursor-pointer" />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>¥5万</span><span>¥50万</span></div>
                <p className="text-xs text-slate-400 mt-1.5">出典：JNTO 訪日外客消費動向調査 2024年（欧米圏平均 ¥182,000）</p>
              </div>

              <div className="space-y-3">
                {combinedByScenario.map(sc => (
                  <div key={sc.scenario.id} className={`p-4 rounded-xl border ${sc.scenario.border} ${sc.scenario.bg}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-semibold ${sc.scenario.text}`}>{sc.scenario.label}シナリオ</span>
                      <span className={`text-xs ${sc.scenario.text}`}>来訪者 {fmt(sc.totalBookings)}人</span>
                    </div>
                    <p className={`text-2xl font-bold ${sc.scenario.text}`}>¥{fmtM(sc.totalBookings * spendPerVisitor)}</p>
                    <p className="text-xs text-slate-400">地域への経済波及効果</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {totalBudget > 0 && combinedByScenario[1].totalBookings > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-blue-700 mb-2">自治体向け提案ポイント</p>
              <p className="text-sm text-blue-800 leading-relaxed">
                月次マーケティング投資 <span className="font-bold">¥{fmtM(totalBudget)}</span> に対して、
                地域全体への経済波及効果は <span className="font-bold">¥{fmtM(combinedByScenario[1].totalBookings * spendPerVisitor)}</span>（標準シナリオ）。
                経済波及倍率 <span className="font-bold">{(combinedByScenario[1].totalBookings * spendPerVisitor / totalBudget).toFixed(1)}倍</span>。
                来訪者の消費は宿泊・飲食・体験・交通・土産購入等に分散し、地域全体の経済を活性化します。
              </p>
            </div>
          )}

          {confirmedStrategies.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-400">③ファネル試算で施策を確定すると、地域経済効果が表示されます</p>
              <button onClick={() => setInnerTab('ai_chat')} className="mt-3 text-xs text-blue-600 hover:underline cursor-pointer">
                AI相談で施策を確定する →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
