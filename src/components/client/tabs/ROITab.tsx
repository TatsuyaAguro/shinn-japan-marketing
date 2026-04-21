'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Client } from '@/lib/data'
import type { StrategyItem } from '@/lib/types/strategy'
import { fetchConfirmedStrategies } from '@/lib/actions/strategy'
import { fetchROIChatHistory, saveROIChatHistory } from '@/lib/actions/roi'
import {
  type StrategyROIInput, type ROIDefaults, type SpendBreakdown,
  type ROICalculationResult, type IntangibleValues,
  DEFAULT_ROI_VALUES, DEFAULT_SPEND_BREAKDOWN,
  calculateSingleStrategyROI, calculateIntangibleValues,
  inferChannelType, inferCVRType, parseBudgetToYen, formatJPY,
} from '@/lib/roi-calculator'
import ROIChatPanel    from '@/components/roi/ROIChatPanel'
import ROIResultsPanel from '@/components/roi/ROIResultsPanel'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

const INIT_MSG = (client: Client): Message => ({
  id: 'init',
  role: 'assistant',
  content: `${client.name}のROI分析を開始します。\n\n確定施策の予算と業界平均値をもとに、フルファネルで自動計算しています。右のパネルで各数値を確認してください。\n\n「予算を20%削減したらROIはどう変わる？」「最もコスパの良い施策はどれ？」など、数値の調整・最適化についてご相談ください。各計算の根拠も丁寧に説明します。`,
})

function buildStrategyInput(s: StrategyItem): StrategyROIInput {
  return {
    strategyId: s.id,
    strategyName: s.name,
    targetCountries: s.targetCountries ?? [],
    budget: parseBudgetToYen(s.recommendedBudget ?? ''),
    channelType: inferChannelType(s.name, s.description ?? ''),
    cvrType: inferCVRType(s.name, s.description ?? ''),
  }
}

export default function ROITab({ client }: { client: Client }) {
  const [messages, setMessages]         = useState<Message[]>([])
  const [strategyInputs, setStrategyInputs] = useState<StrategyROIInput[]>([])
  const [defaults, setDefaults]         = useState<ROIDefaults>(DEFAULT_ROI_VALUES)
  const [spendBreakdown, setSpendBreakdown] = useState<SpendBreakdown>(DEFAULT_SPEND_BREAKDOWN)
  const [isLoading, setIsLoading]       = useState(false)
  const [loadingData, setLoadingData]   = useState(true)
  const [isMobile, setIsMobile]         = useState(false)
  const [mobileView, setMobileView]     = useState<'chat' | 'roi'>('roi')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // モバイル判定
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 初期データ読み込み
  useEffect(() => {
    Promise.all([
      fetchConfirmedStrategies(client.id),
      fetchROIChatHistory(client.id),
    ]).then(([stratData, chatHistory]) => {
      const strategies: StrategyItem[] = stratData.strategies
      setStrategyInputs(strategies.map(buildStrategyInput))

      if (chatHistory.length > 0) {
        setMessages(chatHistory.map((m, i) => ({ id: `loaded-${i}`, role: m.role, content: m.content })))
      } else {
        setMessages([INIT_MSG(client)])
      }
      setLoadingData(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  // チャット履歴の自動保存（デバウンス2秒）
  useEffect(() => {
    if (messages.length <= 1) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveROIChatHistory(client.id, messages.map(m => ({ role: m.role, content: m.content }))).catch(() => {})
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [messages, client.id])

  // ── ROI計算（リアルタイム） ─────────────────────────────
  const results: ROICalculationResult[] = strategyInputs.map(inp =>
    calculateSingleStrategyROI(inp, defaults, spendBreakdown)
  )

  const totalVisitors = results.reduce((s, r) => s + r.visitors, 0)
  const intangible: IntangibleValues = calculateIntangibleValues(totalVisitors, defaults, spendBreakdown)

  // AIに渡すROIサマリー（コンテキスト用）
  const roiSummary = strategyInputs.length > 0 ? {
    クライアント: client.name,
    地域: client.region,
    総予算: formatJPY(results.reduce((s, r) => s + r.budget, 0)),
    総来訪者数: `${totalVisitors.toLocaleString()}人`,
    総売上推計: formatJPY(results.reduce((s, r) => s + r.revenue, 0)),
    ブレンドROI: `${results.length > 0 ? (() => {
      const tb = results.reduce((s, r) => s + r.budget, 0)
      const tr = results.reduce((s, r) => s + r.revenue, 0)
      return tb > 0 ? ((tr - tb) / tb * 100).toFixed(1) : '0'
    })() : 0}%`,
    施策別: results.map(r => ({
      施策名: r.strategyName,
      予算: formatJPY(r.budget),
      チャネル: r.channelType,
      インプレッション: r.impressions.toLocaleString(),
      来訪者数: `${r.visitors.toLocaleString()}人`,
      売上: formatJPY(r.revenue),
      ROI: `${r.roi.toFixed(1)}%`,
      ROAS: `${r.roas.toFixed(1)}x`,
      CPA: `¥${r.cpa.toLocaleString()}`,
    })),
  } : null

  // ── チャット送信 ───────────────────────────────────────
  const handleSend = async (text: string) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setIsLoading(true)
    try {
      const res = await fetch('/api/roi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          client,
          roiSummary,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // ── パラメータ更新 ─────────────────────────────────────
  const handleUpdateInput = useCallback((id: string, field: keyof StrategyROIInput, value: unknown) => {
    setStrategyInputs(prev => prev.map(inp => inp.strategyId === id ? { ...inp, [field]: value } : inp))
  }, [])

  const handleUpdateDefault = useCallback((field: string, value: number) => {
    setDefaults(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleUpdateSpend = useCallback((field: keyof SpendBreakdown, value: number) => {
    setSpendBreakdown(prev => ({ ...prev, [field]: value }))
  }, [])

  // ── ローディング ───────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const resultsProps = {
    client, results, intangible, strategyInputs, defaults, spendBreakdown,
    onUpdateInput: handleUpdateInput,
    onUpdateDefault: handleUpdateDefault,
    onUpdateSpend: handleUpdateSpend,
  }

  // モバイル表示
  if (isMobile) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}>
        <div className="flex mb-3 bg-slate-100 rounded-xl p-1 shrink-0">
          {(['roi', 'chat'] as const).map(view => (
            <button key={view} onClick={() => setMobileView(view)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${mobileView === view ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}
            >
              {view === 'chat' ? '💬 ROI相談' : '💰 ROI分析'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {mobileView === 'chat'
            ? <ROIChatPanel messages={messages} isLoading={isLoading} onSend={handleSend} />
            : (
              <div className="bg-white rounded-2xl border border-slate-200 h-full overflow-hidden">
                <ROIResultsPanel {...resultsProps} />
              </div>
            )
          }
        </div>
      </div>
    )
  }

  // デスクトップ: 2カラム（40% / 60%）
  return (
    <div className="flex gap-5" style={{ height: 'calc(100vh - 280px)', minHeight: 640 }}>
      <div style={{ width: '40%' }}>
        <ROIChatPanel messages={messages} isLoading={isLoading} onSend={handleSend} />
      </div>
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <ROIResultsPanel {...resultsProps} />
      </div>
    </div>
  )
}
