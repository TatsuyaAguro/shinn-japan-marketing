'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseReady } from '@/lib/supabase/isReady'

type ScheduleStatus = 'pending' | 'in_progress' | 'completed'

interface ScheduleItem {
  id: string
  name: string
  startDate: string
  endDate: string
  manager: string
  status: ScheduleStatus
  memo: string
  color: string
}

const STATUS_META: Record<ScheduleStatus, { label: string; cls: string }> = {
  pending:     { label: '未着手', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '進行中', cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: '完了',   cls: 'bg-emerald-100 text-emerald-700' },
}

export default function ScheduleTab({ client }: { client: Client }) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    loadSchedules()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  const loadSchedules = async () => {
    setLoading(true)
    if (!isSupabaseReady()) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('client_id', client.id)
      .order('sort_order', { ascending: true })
    if (data) {
      setItems(data.map(d => ({
        id: d.id,
        name: d.name,
        startDate: d.start_date,
        endDate: d.end_date,
        manager: d.manager,
        status: d.status as ScheduleStatus,
        memo: d.memo,
        color: d.color,
      })))
    }
    setLoading(false)
  }

  const handleStatusChange = async (id: string, status: ScheduleStatus) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (!isSupabaseReady()) return
    const supabase = createClient()
    await supabase.from('schedules').update({ status }).eq('id', id)
  }

  const handleDateChange = async (id: string, field: 'startDate' | 'endDate', value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    if (!isSupabaseReady()) return
    const supabase = createClient()
    const col = field === 'startDate' ? 'start_date' : 'end_date'
    await supabase.from('schedules').update({ [col]: value }).eq('id', id)
  }

  const handleManagerChange = async (id: string, manager: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, manager } : i))
    if (!isSupabaseReady()) return
    const supabase = createClient()
    await supabase.from('schedules').update({ manager }).eq('id', id)
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-600 mb-2">スケジュールがありません</p>
        <p className="text-sm text-slate-400">「AI戦略室」で施策を確定すると、スケジュールが自動生成されます。</p>
      </div>
    )
  }

  // ── タイムラインのスケール計算 ──
  const allDates = items.flatMap(i => [new Date(i.startDate), new Date(i.endDate)])
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
  const totalDays = Math.max((maxDate.getTime() - minDate.getTime()) / 86400000, 1)

  const getPosition = (dateStr: string) => {
    const d = new Date(dateStr)
    return ((d.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100
  }
  const getWidth = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    return Math.max(((e.getTime() - s.getTime()) / 86400000 / totalDays) * 100, 2)
  }

  return (
    <div className="space-y-5">

      {/* ── ガントチャート ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">タイムライン</h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <span>{minDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <div className="flex-1 h-px bg-slate-200" />
          <span>{maxDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <p className="text-xs text-slate-600 font-medium w-32 shrink-0 truncate">{item.name}</p>
              <div className="flex-1 relative h-7 bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                <div
                  className="absolute top-1 h-5 rounded-md flex items-center px-2 text-xs font-medium text-white shadow-sm transition-all"
                  style={{
                    left: `${getPosition(item.startDate)}%`,
                    width: `${getWidth(item.startDate, item.endDate)}%`,
                    backgroundColor: item.color,
                    minWidth: '12px',
                  }}
                >
                  <span className="truncate">{item.name.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 詳細リスト ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4">施策詳細</h3>
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <h4 className="text-sm font-semibold text-slate-800">{item.name}</h4>
                </div>
                <select
                  value={item.status}
                  onChange={e => handleStatusChange(item.id, e.target.value as ScheduleStatus)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border-0 cursor-pointer ${STATUS_META[item.status].cls}`}
                >
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {item.memo && <p className="text-xs text-slate-500 mb-3 leading-relaxed">{item.memo}</p>}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">開始日</label>
                  <input
                    type="date"
                    value={item.startDate}
                    onChange={e => handleDateChange(item.id, 'startDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">終了日</label>
                  <input
                    type="date"
                    value={item.endDate}
                    onChange={e => handleDateChange(item.id, 'endDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">担当者</label>
                  <input
                    type="text"
                    value={item.manager}
                    onChange={e => handleManagerChange(item.id, e.target.value)}
                    placeholder="担当者名"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
