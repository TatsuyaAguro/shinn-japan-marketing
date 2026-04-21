'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Client } from '@/lib/data'
import {
  fetchSchedules, upsertScheduleItem, deleteScheduleItem,
  updateScheduleSortOrder, patchScheduleField,
} from '@/lib/actions/schedule'
import type { ScheduleItem } from '@/lib/actions/schedule'
import type { ScheduleCategory, ScheduleStatus } from '@/lib/supabase/types'
import { useClientSync } from '@/lib/hooks/useClientSync'

// ── メタデータ ──────────────────────────────────────────────────
const CATEGORY_META: Record<ScheduleCategory, { label: string; color: string }> = {
  sns:       { label: 'SNS',        color: 'bg-blue-100 text-blue-700' },
  tour:      { label: 'ツアー',     color: 'bg-emerald-100 text-emerald-700' },
  research:  { label: '調査',       color: 'bg-purple-100 text-purple-700' },
  pr:        { label: 'PR',         color: 'bg-red-100 text-red-700' },
  partner:   { label: '提携',       color: 'bg-orange-100 text-orange-700' },
  content:   { label: 'コンテンツ', color: 'bg-indigo-100 text-indigo-700' },
  milestone: { label: 'マイルストーン', color: 'bg-amber-100 text-amber-700' },
  other:     { label: 'その他',     color: 'bg-slate-100 text-slate-600' },
}

const STATUS_META: Record<ScheduleStatus, { label: string; cls: string }> = {
  pending:     { label: '未着手', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '進行中', cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: '完了',   cls: 'bg-emerald-100 text-emerald-700' },
  proposed:    { label: '提案中', cls: 'bg-purple-100 text-purple-700' },
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']

// ── ガント表示レンジ（今月から12ヶ月、モジュールレベルで固定）──
const GANTT_MONTHS = 12
const ganttStart = (() => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
})()
const ganttEnd = (() => {
  const d = new Date(ganttStart); d.setMonth(d.getMonth() + GANTT_MONTHS); return d
})()
const ganttTotalDays = (ganttEnd.getTime() - ganttStart.getTime()) / 86400000

const months12 = Array.from({ length: GANTT_MONTHS }, (_, i) => {
  const d = new Date(ganttStart); d.setMonth(d.getMonth() + i); return d
})

// ── ヘルパー ────────────────────────────────────────────────────
function makeFreshItem(): ScheduleItem {
  const today = new Date()
  const end = new Date(today); end.setMonth(end.getMonth() + 3)
  return {
    id: crypto.randomUUID(),
    name: '', startDate: today.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    manager: '', status: 'pending', category: 'other',
    memo: '', color: '#6366f1', sortOrder: 9999,
    budgetAllocation: 0, isAISuggested: false, sourceStrategyId: '',
  }
}

type ViewMode = 'gantt' | 'cards' | 'monthly'

// ── メインコンポーネント ─────────────────────────────────────────
export default function ScheduleTab({ client }: { client: Client }) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('gantt')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newItem, setNewItem] = useState<ScheduleItem>(makeFreshItem)
  const [tooltip, setTooltip] = useState<{ item: ScheduleItem; x: number; y: number } | null>(null)

  // ドラッグ用 refs
  const ganttBodyRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ itemId: string; handle: 'left' | 'right' } | null>(null)
  // items の最新値を同期的に読むための ref (mouseup コールバック用)
  const itemsRef = useRef<ScheduleItem[]>(items)
  itemsRef.current = items
  const dragCardId = useRef<string | null>(null)
  const dragOverId = useRef<string | null>(null)

  // ── データ読み込み ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchSchedules(client.id)
    setItems(data)
    setLoading(false)
  }, [client.id])

  useEffect(() => { load() }, [load])
  useClientSync({ clientId: client.id, onScheduleChange: load })

  // ── ガントドラッグ（document レベルで mousemove / mouseup を処理）──
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current || !ganttBodyRef.current) return
      const rect = ganttBodyRef.current.getBoundingClientRect()
      const days = (e.clientX - rect.left) / (rect.width / ganttTotalDays)
      const newDate = new Date(ganttStart.getTime() + days * 86400000)
      const dateStr = newDate.toISOString().slice(0, 10)

      setItems(prev => prev.map(it => {
        if (it.id !== dragState.current!.itemId) return it
        if (dragState.current!.handle === 'right') {
          return dateStr > it.startDate ? { ...it, endDate: dateStr } : it
        } else {
          return dateStr < it.endDate ? { ...it, startDate: dateStr } : it
        }
      }))
    }

    const handleMouseUp = async () => {
      if (!dragState.current) return
      const { itemId } = dragState.current
      dragState.current = null
      document.body.style.cursor = ''
      const it = itemsRef.current.find(i => i.id === itemId)
      if (!it) return
      await patchScheduleField(it.id, { start_date: it.startDate, end_date: it.endDate })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, []) // deps 空 — refs から読む

  // ── バースタイル計算 ────────────────────────────────────────
  const itemBarStyle = useCallback((item: ScheduleItem) => {
    const s = new Date(item.startDate)
    const e = new Date(item.endDate)
    const clampedS = s < ganttStart ? ganttStart : s
    const clampedE = e > ganttEnd ? ganttEnd : e
    if (clampedS >= clampedE) return null
    const leftPct  = ((clampedS.getTime() - ganttStart.getTime()) / 86400000 / ganttTotalDays) * 100
    const widthPct = ((clampedE.getTime() - clampedS.getTime()) / 86400000 / ganttTotalDays) * 100
    return { left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }
  }, [])

  // ── ハンドラ ────────────────────────────────────────────────
  const handleSave = async (item: ScheduleItem) => {
    const saved = await upsertScheduleItem(client.id, item)
    if (saved) {
      setItems(prev => {
        const exists = prev.some(i => i.id === saved.id)
        return exists ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved]
      })
    }
    setAddingNew(false)
    setExpandedId(null)
    setNewItem(makeFreshItem())
  }

  const handleDelete = async (id: string) => {
    await deleteScheduleItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    setExpandedId(null)
  }

  const handlePatch = useCallback(async (
    id: string,
    patch: Partial<{
      name: string; status: string; category: string; manager: string
      memo: string; budget_allocation: number; start_date: string; end_date: string
    }>
  ) => {
    await patchScheduleField(id, patch)
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      return {
        ...it,
        ...(patch.name       !== undefined && { name: patch.name }),
        ...(patch.status     !== undefined && { status: patch.status as ScheduleStatus }),
        ...(patch.category   !== undefined && { category: patch.category as ScheduleCategory }),
        ...(patch.manager    !== undefined && { manager: patch.manager }),
        ...(patch.memo       !== undefined && { memo: patch.memo }),
        ...(patch.start_date !== undefined && { startDate: patch.start_date }),
        ...(patch.end_date   !== undefined && { endDate: patch.end_date }),
        ...(patch.budget_allocation !== undefined && { budgetAllocation: patch.budget_allocation }),
      }
    }))
  }, [])

  const handleReorderDrop = async (targetId: string) => {
    const fromId = dragCardId.current
    if (!fromId || fromId === targetId) return
    const fromIdx = items.findIndex(i => i.id === fromId)
    const toIdx   = items.findIndex(i => i.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...items]
    const [removed] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, removed)
    const withOrder = reordered.map((i, idx) => ({ ...i, sortOrder: idx }))
    setItems(withOrder)
    await updateScheduleSortOrder(client.id, withOrder.map(i => i.id))
    dragCardId.current = null
    dragOverId.current = null
  }

  // ── 月次ビュー用データ ──────────────────────────────────────
  const monthlyGroups = useMemo(() => months12.map(monthDate => {
    const mEnd = new Date(monthDate); mEnd.setMonth(mEnd.getMonth() + 1)
    const monthItems = items.filter(i =>
      new Date(i.startDate) < mEnd && new Date(i.endDate) >= monthDate
    )
    return { monthDate, monthItems }
  }), [items])

  // ── ローディング ────────────────────────────────────────────
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

  return (
    <div className="space-y-4">

      {/* ── ツールバー ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['gantt', 'cards', 'monthly'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {{ gantt: 'ガント', cards: 'カード', monthly: '月次' }[mode]}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setAddingNew(true); setExpandedId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          施策を追加
        </button>
      </div>

      {/* ════════════════ ガントビュー ════════════════ */}
      {viewMode === 'gantt' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden select-none">
          {/* 月ヘッダー */}
          <div className="flex border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
            <div className="w-40 shrink-0 px-4 py-2.5 text-xs font-semibold text-slate-500 border-r border-slate-100">
              施策名
            </div>
            <div ref={ganttBodyRef} className="flex-1 flex">
              {months12.map((m, i) => (
                <div key={i} className="flex-1 text-center py-2.5 text-xs text-slate-400 border-r border-slate-100 last:border-r-0">
                  {m.toLocaleDateString('ja-JP', { month: 'short' })}
                </div>
              ))}
            </div>
          </div>

          {/* バー行 */}
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">「AI戦略室」で施策を確定するとスケジュールが自動生成されます。</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map(item => {
                const barStyle = itemBarStyle(item)
                return (
                  <div key={item.id} className="flex items-center hover:bg-slate-50/50 h-11 group">
                    {/* ラベル列 */}
                    <div className="w-40 shrink-0 px-4 flex items-center gap-2 border-r border-slate-100 h-full">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-700 font-medium truncate">{item.name || '(無題)'}</span>
                      {item.isAISuggested && (
                        <span className="text-xs text-indigo-500 font-bold shrink-0">AI</span>
                      )}
                    </div>

                    {/* バーエリア */}
                    <div
                      className="flex-1 relative h-full cursor-crosshair"
                      onMouseMove={e => {
                        if (!dragState.current) setTooltip({ item, x: e.clientX, y: e.clientY })
                      }}
                      onMouseLeave={() => {
                        if (!dragState.current) setTooltip(null)
                      }}
                    >
                      {/* グリッド線 */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {months12.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-slate-100 last:border-r-0" />
                        ))}
                      </div>

                      {/* バー本体 */}
                      {barStyle && (
                        <div
                          className="absolute top-2 h-7 rounded-md flex items-center text-white text-xs font-medium overflow-hidden shadow-sm"
                          style={{ ...barStyle, backgroundColor: item.color }}
                        >
                          {/* 左リサイズハンドル */}
                          <div
                            className="absolute left-0 top-0 w-2.5 h-full cursor-ew-resize z-10 hover:bg-black/20"
                            onMouseDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              dragState.current = { itemId: item.id, handle: 'left' }
                              document.body.style.cursor = 'ew-resize'
                              setTooltip(null)
                            }}
                          />
                          <span className="px-2 truncate pointer-events-none">{item.name.slice(0, 12)}</span>
                          {/* 右リサイズハンドル */}
                          <div
                            className="absolute right-0 top-0 w-2.5 h-full cursor-ew-resize z-10 hover:bg-black/20"
                            onMouseDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              dragState.current = { itemId: item.id, handle: 'right' }
                              document.body.style.cursor = 'ew-resize'
                              setTooltip(null)
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ カードビュー ════════════════ */}
      {viewMode === 'cards' && (
        <div className="space-y-2.5">
          {items.length === 0 && !addingNew && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-400">施策がありません。「施策を追加」から作成してください。</p>
            </div>
          )}
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => { dragCardId.current = item.id }}
              onDragOver={e => { e.preventDefault(); dragOverId.current = item.id }}
              onDragLeave={() => { if (dragOverId.current === item.id) dragOverId.current = null }}
              onDrop={() => handleReorderDrop(item.id)}
              onDragEnd={() => { dragCardId.current = null; dragOverId.current = null }}
              className="bg-white rounded-xl border border-slate-200 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm"
            >
              {/* カードヘッダー */}
              <div
                className="flex items-center gap-3 p-3.5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">
                  {item.name || '(無題)'}
                </span>
                {item.isAISuggested && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium shrink-0">
                    AI提案
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_META[item.category]?.color ?? ''}`}>
                  {CATEGORY_META[item.category]?.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_META[item.status]?.cls ?? ''}`}>
                  {STATUS_META[item.status]?.label}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {item.startDate} 〜 {item.endDate}
                </span>
                <svg
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* 展開編集エリア */}
              {expandedId === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3" onClick={e => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">施策名</label>
                      <input type="text" value={item.name}
                        onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                        onBlur={e => handlePatch(item.id, { name: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">開始日</label>
                      <input type="date" value={item.startDate}
                        onChange={e => handlePatch(item.id, { start_date: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">終了日</label>
                      <input type="date" value={item.endDate}
                        onChange={e => handlePatch(item.id, { end_date: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">カテゴリ</label>
                      <select value={item.category}
                        onChange={e => handlePatch(item.id, { category: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {Object.entries(CATEGORY_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">ステータス</label>
                      <select value={item.status}
                        onChange={e => handlePatch(item.id, { status: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">担当者</label>
                      <input type="text" value={item.manager}
                        onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, manager: e.target.value } : i))}
                        onBlur={e => handlePatch(item.id, { manager: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">予算配分（万円）</label>
                      <input type="number" value={item.budgetAllocation > 0 ? item.budgetAllocation / 10000 : ''}
                        placeholder="0"
                        onChange={e => {
                          const v = Math.round((parseFloat(e.target.value) || 0) * 10000)
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, budgetAllocation: v } : i))
                        }}
                        onBlur={e => {
                          const v = Math.round((parseFloat(e.target.value) || 0) * 10000)
                          handlePatch(item.id, { budget_allocation: v })
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">メモ</label>
                    <textarea value={item.memo} rows={2}
                      onChange={e => setItems(prev => prev.map(i => i.id === item.id ? { ...i, memo: e.target.value } : i))}
                      onBlur={e => handlePatch(item.id, { memo: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (confirm(`「${item.name || '(無題)'}」を削除しますか？`)) {
                          handleDelete(item.id)
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ 月次ビュー ════════════════ */}
      {viewMode === 'monthly' && (
        <div className="space-y-3">
          {monthlyGroups.every(g => g.monthItems.length === 0) ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-400">スケジュールがありません。</p>
            </div>
          ) : monthlyGroups.map(({ monthDate, monthItems }, idx) => {
            if (monthItems.length === 0) return null
            return (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-5 py-3 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-700">
                    {monthDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
                  </span>
                  <span className="text-xs text-slate-400">{monthItems.length}件</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {monthItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 flex-wrap">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">
                        {item.name || '(無題)'}
                      </span>
                      {item.isAISuggested && (
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">AI</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_META[item.category]?.color ?? ''}`}>
                        {CATEGORY_META[item.category]?.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[item.status]?.cls ?? ''}`}>
                        {STATUS_META[item.status]?.label}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {item.startDate} 〜 {item.endDate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════════ 新規追加フォーム ════════════════ */}
      {addingNew && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">新しい施策を追加</h3>
            <button
              onClick={() => { setAddingNew(false); setNewItem(makeFreshItem()) }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">施策名 *</label>
              <input type="text" value={newItem.name}
                onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例: Instagramインフルエンサー施策"
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">開始日</label>
              <input type="date" value={newItem.startDate}
                onChange={e => setNewItem(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">終了日</label>
              <input type="date" value={newItem.endDate}
                onChange={e => setNewItem(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">カテゴリ</label>
              <select value={newItem.category}
                onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value as ScheduleCategory }))}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">担当者</label>
              <input type="text" value={newItem.manager}
                onChange={e => setNewItem(prev => ({ ...prev, manager: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">バーの色</label>
              <div className="flex gap-1.5 mt-1">
                {PALETTE.map(c => (
                  <button key={c}
                    onClick={() => setNewItem(prev => ({ ...prev, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      newItem.color === c ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setAddingNew(false); setNewItem(makeFreshItem()) }}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                if (!newItem.name.trim()) return
                handleSave({ ...newItem, sortOrder: items.length })
              }}
              disabled={!newItem.name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* ── ツールチップ ── */}
      {tooltip && !dragState.current && (
        <div
          className="fixed z-50 pointer-events-none bg-white rounded-xl shadow-lg border border-slate-200 p-3 text-xs max-w-56"
          style={{ left: tooltip.x + 14, top: Math.max(tooltip.y - 60, 8) }}
        >
          <p className="font-semibold text-slate-800 mb-1">{tooltip.item.name || '(無題)'}</p>
          <p className="text-slate-500 mb-1.5">{tooltip.item.startDate} 〜 {tooltip.item.endDate}</p>
          <div className="flex flex-wrap gap-1">
            <span className={`px-1.5 py-0.5 rounded font-medium ${CATEGORY_META[tooltip.item.category]?.color ?? ''}`}>
              {CATEGORY_META[tooltip.item.category]?.label}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_META[tooltip.item.status]?.cls ?? ''}`}>
              {STATUS_META[tooltip.item.status]?.label}
            </span>
          </div>
          {tooltip.item.memo && (
            <p className="text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{tooltip.item.memo}</p>
          )}
          {tooltip.item.budgetAllocation > 0 && (
            <p className="text-slate-500 mt-1">予算: {(tooltip.item.budgetAllocation / 10000).toFixed(0)}万円</p>
          )}
        </div>
      )}
    </div>
  )
}
