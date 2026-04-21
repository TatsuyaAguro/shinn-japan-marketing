'use client'

import { useState, useRef, useEffect } from 'react'
import type { Client } from '@/lib/data'
import {
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  reorderSchedules,
} from '@/lib/actions/schedules'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { ScheduleRow, ScheduleStatus } from '@/lib/supabase/types'

// ── 定数 ──────────────────────────────────────────────────────
const FISCAL_MONTHS = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月']

const COLORS = [
  { value: '#3b82f6', label: 'SNS・デジタル' },
  { value: '#10b981', label: 'ツアー・体験' },
  { value: '#f59e0b', label: '視察・調査' },
  { value: '#8b5cf6', label: '広報・PR' },
  { value: '#ec4899', label: 'パートナー' },
  { value: '#14b8a6', label: 'コンテンツ' },
  { value: '#ef4444', label: 'キャンペーン' },
  { value: '#6b7280', label: 'その他' },
]

const STATUS_CONFIG: Record<ScheduleStatus, { label: string; className: string }> = {
  pending:     { label: '未着手',  className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  in_progress: { label: '進行中',  className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed:   { label: '完了',    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  proposed:    { label: '提案中',  className: 'bg-violet-50 text-violet-700 border border-violet-200' },
}

// ── 会計年度ユーティリティ ──────────────────────────────────
function getFiscalYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

/** 日付文字列 → 会計月インデックス（0=4月, 11=3月）。範囲外は -1 or 12 */
function toFiscalMonthIdx(dateStr: string, fy: number): number {
  const d = new Date(dateStr + 'T00:00:00')
  const m = d.getMonth() // 0-11 (Jan=0)
  const y = d.getFullYear()
  if (y === fy     && m >= 3) return m - 3   // Apr(3)=0 .. Dec(11)=8
  if (y === fy + 1 && m <= 2) return m + 9   // Jan(0)=9, Feb(1)=10, Mar(2)=11
  if (y < fy || (y === fy && m < 3)) return -1
  return 12
}

/** タイムラインバーの CSS left/width を返す */
function getBarStyle(start: string, end: string, fy: number): { left: string; width: string } | null {
  const si = toFiscalMonthIdx(start, fy)
  const ei = toFiscalMonthIdx(end, fy)
  if (si >= 12 || ei < 0) return null
  const cs = Math.max(0, si)
  const ce = Math.min(11, ei)
  if (ce < cs) return null
  return {
    left:  `${(cs / 12) * 100}%`,
    width: `${((ce - cs + 1) / 12) * 100}%`,
  }
}

// ── 型 ────────────────────────────────────────────────────────
interface FormState {
  name: string; start_date: string; end_date: string
  manager: string; status: ScheduleStatus; memo: string; color: string
}

type ProposedItem = FormState & { tempId: string }

const DEFAULT_FORM: FormState = {
  name: '', start_date: '', end_date: '', manager: '',
  status: 'pending', memo: '', color: '#3b82f6',
}

// ── コンポーネント ────────────────────────────────────────────
export default function ScheduleTab({ client }: { client: Client }) {
  const [schedules, setSchedules]     = useState<ScheduleRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving]           = useState(false)
  const [proposed, setProposed]       = useState<ProposedItem[]>([])
  const [isProposing, setIsProposing] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)
  const [highlightMonth, setHighlightMonth] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragFromIdx = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const fy = getFiscalYear()
  const supabaseReady = isSupabaseReady()

  // ── 初期ロード ────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    fetchSchedules(client.id).then(data => { setSchedules(data); setLoading(false) })
  }, [client.id, supabaseReady])

  // ── モーダル ──────────────────────────────────────────────
  function openAdd() {
    const today = new Date().toISOString().slice(0, 10)
    setForm({ ...DEFAULT_FORM, start_date: today, end_date: today, manager: client.manager })
    setEditingId(null)
    setShowModal(true)
  }
  function openEdit(s: ScheduleRow) {
    setForm({ name: s.name, start_date: s.start_date, end_date: s.end_date,
              manager: s.manager, status: s.status, memo: s.memo, color: s.color })
    setEditingId(s.id)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.start_date || !form.end_date) return
    setSaving(true)
    if (editingId) {
      const { error } = await updateSchedule(editingId, form)
      if (!error) setSchedules(prev => prev.map(s => s.id === editingId ? { ...s, ...form } : s))
    } else {
      const { error, id } = await createSchedule({ client_id: client.id, ...form, sort_order: schedules.length })
      if (!error && id) {
        setSchedules(prev => [...prev, {
          id, client_id: client.id, ...form,
          sort_order: prev.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
      }
    }
    setSaving(false)
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('この施策を削除しますか？')) return
    const { error } = await deleteSchedule(id)
    if (!error) setSchedules(prev => prev.filter(s => s.id !== id))
  }

  // ── ドラッグ＆ドロップ ────────────────────────────────────
  function onDragStart(idx: number) { dragFromIdx.current = idx }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }
  async function onDrop(idx: number) {
    const from = dragFromIdx.current
    if (from === null || from === idx) { setDragOverIdx(null); return }
    const next = [...schedules]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    const reordered = next.map((s, i) => ({ ...s, sort_order: i }))
    setSchedules(reordered)
    setDragOverIdx(null)
    dragFromIdx.current = null
    if (supabaseReady) await reorderSchedules(reordered.map(s => ({ id: s.id, sort_order: s.sort_order })))
  }

  // ── 月クリック → スクロール ───────────────────────────────
  function handleMonthClick(monthIdx: number) {
    setHighlightMonth(monthIdx)
    const idx = schedules.findIndex(s => {
      const si = toFiscalMonthIdx(s.start_date, fy)
      const ei = toFiscalMonthIdx(s.end_date, fy)
      return si <= monthIdx && ei >= monthIdx
    })
    if (idx >= 0 && cardRefs.current[idx]) {
      cardRefs.current[idx]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(() => setHighlightMonth(null), 2000)
  }

  // ── AI提案 ────────────────────────────────────────────────
  async function handlePropose() {
    setIsProposing(true)
    setProposeError(null)
    try {
      const res = await fetch('/api/schedule-propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client, fiscalYear: fy }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setProposeError(data.error ?? 'AI提案に失敗しました'); return }
      setProposed((data.schedules as FormState[]).map((s, i) => ({
        ...s, status: 'proposed' as ScheduleStatus,
        tempId: `p-${Date.now()}-${i}`,
      })))
    } catch { setProposeError('通信エラーが発生しました') }
    finally { setIsProposing(false) }
  }

  async function handleApprove(p: ProposedItem) {
    const { tempId, ...data } = p
    if (supabaseReady) {
      const { error, id } = await createSchedule({
        client_id: client.id, ...data, status: 'pending', sort_order: schedules.length,
      })
      if (!error && id) {
        setSchedules(prev => [...prev, {
          id, client_id: client.id, ...data, status: 'pending',
          sort_order: prev.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }])
      }
    }
    setProposed(prev => prev.filter(x => x.tempId !== tempId))
  }
  function handleReject(tempId: string) { setProposed(prev => prev.filter(p => p.tempId !== tempId)) }

  // ── タイムライン表示用（保存済み + 提案中）────────────────
  const timelineItems: { id: string; name: string; start_date: string; end_date: string; color: string; isProposed: boolean }[] = [
    ...schedules.map(s => ({ ...s, isProposed: false })),
    ...proposed.map(p => ({ id: p.tempId, name: p.name, start_date: p.start_date, end_date: p.end_date, color: p.color, isProposed: true })),
  ]

  // ── スタイル定数 ──────────────────────────────────────────
  const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all'
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="space-y-6">

      {/* ── ヘッダー ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">施策スケジュール</h2>
          <p className="text-xs text-slate-500 mt-0.5">{fy}年4月〜{fy + 1}年3月</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePropose}
            disabled={isProposing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isProposing
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            }
            {isProposing ? '提案中...' : 'AIでスケジュール提案'}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            施策を追加
          </button>
        </div>
      </div>

      {proposeError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{proposeError}</div>
      )}

      {/* ── タイムライン ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">タイムライン</h3>
          <div className="flex gap-3 flex-wrap">
            {COLORS.slice(0, 6).map(c => (
              <span key={c.value} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.value }} />
                {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[768px] px-4 pb-4 pt-2">
            {/* 月ヘッダー */}
            <div className="grid grid-cols-12 mb-1">
              {FISCAL_MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => handleMonthClick(i)}
                  className="text-center text-xs font-medium text-slate-500 py-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  {m}
                </button>
              ))}
            </div>

            {/* グリッド + バー */}
            <div className="relative rounded-xl overflow-hidden border border-slate-100">
              {/* 月縦線 */}
              <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                {FISCAL_MONTHS.map((_, i) => (
                  <div key={i} className={i < 11 ? 'border-r border-slate-100' : ''} />
                ))}
              </div>

              {timelineItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  施策を追加するとここに表示されます
                </div>
              ) : (
                <div className="py-2 space-y-1.5">
                  {timelineItems.map(item => {
                    const style = getBarStyle(item.start_date, item.end_date, fy)
                    return (
                      <div key={item.id} className="relative h-7 mx-1">
                        {style ? (
                          <div
                            className="absolute top-0.5 bottom-0.5 rounded-full flex items-center px-2.5 overflow-hidden"
                            style={{
                              left: style.left,
                              width: style.width,
                              backgroundColor: item.isProposed ? item.color + '66' : item.color + 'dd',
                              border: item.isProposed ? `2px dashed ${item.color}` : 'none',
                              minWidth: '12px',
                            }}
                            title={`${item.name}${item.isProposed ? '（提案中）' : ''} / ${item.start_date} 〜 ${item.end_date}`}
                          >
                            <span className={`text-xs font-medium truncate leading-none ${item.isProposed ? 'text-slate-700' : 'text-white'}`}>
                              {item.name}
                            </span>
                          </div>
                        ) : (
                          <div
                            className="absolute left-0.5 top-1.5 bottom-1.5 w-2 rounded-full"
                            style={{ backgroundColor: item.color + '66' }}
                            title={`${item.name}（期間外）`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI提案一覧 ── */}
      {proposed.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-violet-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <span className="text-sm font-semibold text-violet-800">AI提案スケジュール（{proposed.length}件）</span>
            <span className="text-xs text-violet-500 ml-1">承認すると施策一覧に追加されます</span>
          </div>
          <div className="space-y-2">
            {proposed.map(p => (
              <div key={p.tempId} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-violet-100">
                <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: p.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.start_date} 〜 {p.end_date}</p>
                  {p.memo && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.memo}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleApprove(p)}
                    className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                  >承認</button>
                  <button
                    onClick={() => handleReject(p.tempId)}
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                  >却下</button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => Promise.all(proposed.map(handleApprove))}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
              >すべて承認</button>
              <button
                onClick={() => setProposed([])}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >すべて却下</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 施策一覧 ── */}
      <div ref={listRef}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            施策一覧
            <span className="ml-2 text-slate-400 font-normal">({schedules.length}件)</span>
          </h3>
          {highlightMonth !== null && (
            <span className="text-xs text-blue-600 font-medium">
              {FISCAL_MONTHS[highlightMonth]}の施策をハイライト中
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">読み込み中...</div>
        ) : schedules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-14 text-center">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p className="text-sm text-slate-400 mb-3">施策がまだありません</p>
            <button onClick={openAdd} className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
              ＋ 施策を追加する
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s, idx) => {
              const si = toFiscalMonthIdx(s.start_date, fy)
              const ei = toFiscalMonthIdx(s.end_date, fy)
              const isHighlighted = highlightMonth !== null && si <= highlightMonth && ei >= highlightMonth
              return (
                <div
                  key={s.id}
                  ref={el => { cardRefs.current[idx] = el }}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  onDragEnd={() => setDragOverIdx(null)}
                  className={`bg-white rounded-2xl border transition-all duration-200 ${
                    dragOverIdx === idx
                      ? 'border-blue-400 shadow-md scale-[1.01]'
                      : isHighlighted
                      ? 'border-blue-300 shadow-sm ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* ドラッグハンドル */}
                    <div className="text-slate-300 mt-0.5 cursor-grab active:cursor-grabbing shrink-0" title="ドラッグして並び替え">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 4a1 1 0 100 2 1 1 0 000-2zM15 4a1 1 0 100 2 1 1 0 000-2zM9 11a1 1 0 100 2 1 1 0 000-2zM15 11a1 1 0 100 2 1 1 0 000-2zM9 18a1 1 0 100 2 1 1 0 000-2zM15 18a1 1 0 100 2 1 1 0 000-2z"/>
                      </svg>
                    </div>

                    {/* カラーインジケーター */}
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: s.color }} />

                    {/* コンテンツ */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[s.status].className}`}>
                          {STATUS_CONFIG[s.status].label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        <span>📅 {s.start_date} 〜 {s.end_date}</span>
                        {s.manager && <span>👤 {s.manager}</span>}
                      </div>
                      {s.memo && (
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{s.memo}</p>
                      )}
                    </div>

                    {/* アクション */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="編集"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="削除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 追加・編集モーダル ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-base font-bold text-slate-800">{editingId ? '施策を編集' : '施策を追加'}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>施策名 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="例：モニターツアー実施" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>開始日 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>終了日 <span className="text-red-500">*</span></label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>担当者</label>
                  <input type="text" placeholder="例：田中 美咲" value={form.manager}
                    onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ステータス</label>
                  <select value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ScheduleStatus }))}
                    className={inputClass}>
                    <option value="pending">未着手</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">完了</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>色ラベル</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {COLORS.map(c => (
                    <button key={c.value} type="button" title={c.label}
                      onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110 ${form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>メモ</label>
                <textarea rows={3} placeholder="施策の目的・備考など..."
                  value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  className={`${inputClass} resize-none`} />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                  キャンセル
                </button>
                <button type="button" onClick={handleSave}
                  disabled={saving || !form.name || !form.start_date || !form.end_date}
                  className="flex-1 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl transition-colors cursor-pointer font-medium">
                  {saving ? '保存中...' : '保存する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
