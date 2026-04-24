'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { TogCase } from '@/lib/types/tog'
import { SCORE_META } from '@/lib/types/tog'
import { updateTogCaseStatus, patchTogCase } from '@/lib/actions/tog'

type ResearchStatus = 'running' | 'done' | 'stopped' | 'error'
type ResearchPhase  = 'ai-searching' | 'db-saving'

interface JobState {
  id:            string
  status:        ResearchStatus
  phase:         ResearchPhase
  foundCount:    number
  savedCount:    number
  saveErrors:    number
  error?:        string
  setupRequired?: boolean
}

interface ToastState {
  message: string
  type: 'success' | 'error' | 'warning'
}

const LS_KEY = 'tog-research-jobId'
const MEMBERS = ['MARI', 'KS', 'TMD', 'AG', 'JETH', 'SND'] as const

interface Props {
  cases: TogCase[]
  lastResearched: string | null
  onRefresh: () => void
}

// ── ヘルパー ───────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const meta = SCORE_META[score] ?? SCORE_META[0]
  return (
    <span className="text-sm font-bold" style={{ color: meta.hex }}>
      {score > 0 ? meta.stars : '─'}
    </span>
  )
}

function isUrgent(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  const now = new Date()
  return d > now && (d.getTime() - now.getTime()) < 7 * 86400000
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  municipality_official: { label: '公式',   cls: 'bg-emerald-100 text-emerald-700' },
  dmo_official:          { label: 'DMO',    cls: 'bg-teal-100 text-teal-700' },
  travelvoice:           { label: 'TV',     cls: 'bg-indigo-100 text-indigo-700' },
  kankocho:              { label: '観光庁', cls: 'bg-amber-100 text-amber-700' },
  njss:                  { label: 'NJSS',   cls: 'bg-slate-100 text-slate-600' },
}

function formatBudget(n: number | null, note?: string | null): string {
  if (n === null) return '記載なし'
  if (n === 0) {
    if (note?.includes('記載なし')) return '記載なし'
    return '─'
  }
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

// ── トースト ──────────────────────────────────────────────────
function ResearchToast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const cls = {
    success: 'bg-emerald-700 text-white',
    error:   'bg-red-700 text-white',
    warning: 'bg-amber-600 text-white',
  }[toast.type]

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl ${cls} max-w-sm`}>
      <p className="text-sm font-medium leading-snug">{toast.message}</p>
      <button onClick={onDismiss} className="text-white/70 hover:text-white shrink-0 ml-1">✕</button>
    </div>
  )
}

// ── 担当者選択モーダル ─────────────────────────────────────────
function AssignModal({
  togCase,
  submitting,
  onConfirm,
  onCancel,
}: {
  togCase: TogCase
  submitting: boolean
  onConfirm: (assignee: string) => void
  onCancel: () => void
}) {
  const [assignee, setAssignee] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">担当者を選んでください</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {/* 案件名 */}
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">案件</p>
            <p className="text-sm font-semibold text-slate-800 line-clamp-2">{togCase.name}</p>
            {togCase.organization && (
              <p className="text-xs text-slate-500 mt-0.5">{togCase.organization}</p>
            )}
          </div>

          {/* 担当者選択 */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              メイン担当者 <span className="text-red-500">*</span>
            </label>
            <select
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              autoFocus
            >
              <option value="">選択してください</option>
              {MEMBERS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => assignee && onConfirm(assignee)}
            disabled={!assignee || submitting}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                処理中...
              </span>
            ) : '対応中に追加'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 見送り理由モーダル ─────────────────────────────────────────
function DismissModal({
  togCase,
  submitting,
  onConfirm,
  onCancel,
}: {
  togCase: TogCase
  submitting: boolean
  onConfirm: (status: 'passed_unrelated' | 'passed_prep') => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<'passed_unrelated' | 'passed_prep' | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">見送り理由</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {/* 案件名 */}
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">案件</p>
            <p className="text-sm font-semibold text-slate-800 line-clamp-2">{togCase.name}</p>
            {togCase.organization && (
              <p className="text-xs text-slate-500 mt-0.5">{togCase.organization}</p>
            )}
          </div>

          {/* 理由選択 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">理由を選択 <span className="text-red-500">*</span></label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                reason === 'passed_unrelated'
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setReason('passed_unrelated')}
            >
              <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                reason === 'passed_unrelated' ? 'border-slate-500' : 'border-slate-300'
              }`}>
                {reason === 'passed_unrelated' && <div className="w-2 h-2 rounded-full bg-slate-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">弊社に関係ない案件だった</p>
                <p className="text-xs text-slate-500 mt-0.5">自社応募履歴に記録する</p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                reason === 'passed_prep'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setReason('passed_prep')}
            >
              <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                reason === 'passed_prep' ? 'border-blue-500' : 'border-slate-300'
              }`}>
                {reason === 'passed_prep' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">準備不足・関係者不足で見送り</p>
                <p className="text-xs text-slate-500 mt-0.5">自社応募履歴に記録する（来年の参考に）</p>
              </div>
            </label>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason || submitting}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-slate-700 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                処理中...
              </span>
            ) : '確定'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインコンポーネント ────────────────────────────────────────
export default function NewCasesTab({ cases, lastResearched, onRefresh }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'aiScore' | 'deadline' | 'budget'>('aiScore')
  const [filterScore, setFilterScore] = useState<number>(3)
  const [setupRequired, setSetupRequired] = useState(false)

  // バックグラウンドジョブ状態
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<ResearchStatus | null>(null)
  const [jobPhase, setJobPhase] = useState<ResearchPhase | null>(null)
  const [foundCount, setFoundCount] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [stopping, setStopping] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  // ボタン処理中状態（楽観的UI用）
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // モーダル状態
  const [assignModalCase, setAssignModalCase] = useState<TogCase | null>(null)
  const [dismissModalCase, setDismissModalCase] = useState<TogCase | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const isRunning = jobStatus === 'running'

  const addProcessing = (id: string) =>
    setProcessingIds(prev => new Set(prev).add(id))
  const removeProcessing = (id: string) =>
    setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n })

  // 完了ハンドラ
  const handleJobDone = useCallback((job: JobState) => {
    setJobId(null)
    setJobStatus(null)
    setStopping(false)
    localStorage.removeItem(LS_KEY)

    if (job.status === 'done') {
      const msg = job.setupRequired
        ? `DBテーブルのセットアップが必要です（${job.foundCount}件検出済み）`
        : `${job.foundCount}件を検出 → ${job.savedCount}件を新規保存しました`
      setToast({ message: msg, type: job.setupRequired ? 'warning' : 'success' })
      if (job.setupRequired) setSetupRequired(true)
      onRefresh()
    } else if (job.status === 'stopped') {
      setToast({ message: `停止しました（${job.foundCount}件検出 / ${job.savedCount}件保存）`, type: 'warning' })
      if (job.savedCount > 0) onRefresh()
    } else if (job.status === 'error') {
      setToast({ message: job.error ?? 'エラーが発生しました', type: 'error' })
    }
  }, [onRefresh])

  // マウント時: localStorage からジョブIDを復元
  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    if (savedId) {
      setJobId(savedId)
      setJobStatus('running')
      setJobPhase('ai-searching')
    }
  }, [])

  // ポーリング
  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/tog/research/status?jobId=${jobId}`)
        if (cancelled) return
        if (res.status === 404) {
          setJobId(null); setJobStatus(null); setStopping(false)
          localStorage.removeItem(LS_KEY); return
        }
        const data: JobState = await res.json()
        if (cancelled) return
        setJobStatus(data.status); setJobPhase(data.phase)
        setFoundCount(data.foundCount); setSavedCount(data.savedCount)
        if (data.status !== 'running') { handleJobDone(data); return }
      } catch { /* ネットワークエラーは無視して再試行 */ }
      if (!cancelled) setTimeout(poll, 2000)
    }

    poll()
    return () => { cancelled = true }
  }, [jobId, handleJobDone])

  const handleResearch = async () => {
    if (isRunning) return
    setSetupRequired(false); setToast(null)
    try {
      const res = await fetch('/api/tog/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error ?? `HTTP ${res.status}`, type: 'error' }); return }
      setJobId(data.jobId); setJobStatus('running'); setJobPhase('ai-searching')
      setFoundCount(0); setSavedCount(0)
      localStorage.setItem(LS_KEY, data.jobId)
    } catch (e) {
      setToast({ message: String(e), type: 'error' })
    }
  }

  const handleStop = async () => {
    if (!jobId || stopping) return
    setStopping(true)
    try {
      await fetch('/api/tog/research/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
    } catch { setStopping(false) }
  }

  // ── 「検討する」確定処理 ──────────────────────────────────────
  const handleConsider = async (id: string, assignee: string) => {
    setModalSubmitting(true)
    addProcessing(id)
    try {
      await updateTogCaseStatus(id, 'considering')
      await patchTogCase(id, { assigned_to: assignee })
      setAssignModalCase(null)
      onRefresh()
    } catch {
      setToast({ message: '処理に失敗しました', type: 'error' })
    } finally {
      setModalSubmitting(false)
      removeProcessing(id)
    }
  }

  // ── 「見送り」確定処理 ────────────────────────────────────────
  const handleDismiss = async (id: string, status: 'passed_unrelated' | 'passed_prep') => {
    setModalSubmitting(true)
    addProcessing(id)
    try {
      await updateTogCaseStatus(id, status)
      setDismissModalCase(null)
      onRefresh()
    } catch {
      setToast({ message: '処理に失敗しました', type: 'error' })
    } finally {
      setModalSubmitting(false)
      removeProcessing(id)
    }
  }

  const sorted = [...cases]
    .filter(c => c.aiScore >= filterScore)
    .sort((a, b) => {
      if (sortKey === 'aiScore') return b.aiScore - a.aiScore
      if (sortKey === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
      return (b.budget ?? 0) - (a.budget ?? 0)
    })

  return (
    <div className="space-y-4">
      {/* アクションバー */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="追加キーワード（省略可）"
          disabled={isRunning}
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
        />

        {isRunning ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
              <svg className="w-4 h-4 animate-spin text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-semibold text-indigo-700">
                {jobPhase === 'ai-searching' ? 'AIがウェブを検索中...' : `${foundCount}件を検出 → 保存中...`}
              </span>
            </div>
            <button
              onClick={handleStop}
              disabled={stopping}
              className="px-3 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 transition-colors"
            >
              {stopping ? '停止中...' : '停止'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleResearch}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            AIリサーチ
          </button>
        )}

        {lastResearched && !isRunning && (
          <span className="text-xs text-slate-400">最終リサーチ: {new Date(lastResearched).toLocaleString('ja-JP')}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <select
            value={filterScore}
            onChange={e => setFilterScore(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {[5, 4, 3].map(s => <option key={s} value={s}>★{s}以上</option>)}
          </select>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as typeof sortKey)}
            className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="aiScore">関連度順</option>
            <option value="deadline">締切順</option>
            <option value="budget">金額順</option>
          </select>
        </div>
      </div>

      {/* DB未セットアップ警告 */}
      {setupRequired && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-amber-800 mb-1">DBテーブルのセットアップが必要です</p>
          <p className="text-xs text-amber-700 mb-2">
            Supabase の SQL Editor で <code className="bg-amber-100 px-1 rounded font-mono">tog-setup.sql</code> を実行してください。
          </p>
          <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
            <li>Supabase ダッシュボード → SQL Editor を開く</li>
            <li>プロジェクトの <code className="font-mono bg-amber-100 px-1 rounded">tog-setup.sql</code> の内容をコピー＆ペースト</li>
            <li>「Run」をクリック → テーブル作成完了</li>
            <li>再度「AIリサーチ」を押す</li>
          </ol>
        </div>
      )}

      {/* 件数 */}
      <p className="text-xs text-slate-500">{sorted.length}件</p>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">「AIリサーチ」ボタンを押して最新の公募案件を取得してください。</p>
          <p className="text-xs text-slate-300 mt-1">AIがウェブを検索して★3以上の関連案件を自動で取得・保存します</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-24">関連度</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">案件名</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-32 hidden md:table-cell">公示元</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-20 hidden lg:table-cell">都道府県</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-28 hidden lg:table-cell">金額上限</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-24">締切日</th>
                {/* アクション列を広げてボタンが1行に収まるようにする */}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-44">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((c, i) => {
                const urgent = isUrgent(c.deadline)
                const expanded = expandedId === c.id
                const isProcessing = processingIds.has(c.id)

                return (
                  <>
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''} ${urgent ? 'bg-red-50/40' : ''} ${isProcessing ? 'opacity-60' : ''}`}
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
                      <td className="px-4 py-3">
                        <ScoreBadge score={c.aiScore} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {urgent && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold shrink-0">緊急</span>
                          )}
                          <span
                            className="font-medium text-slate-800 line-clamp-1 hover:text-indigo-600 hover:underline cursor-pointer"
                            onClick={e => { e.stopPropagation(); router.push(`/tog/${c.id}`) }}
                          >{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        <span className="line-clamp-1">{c.organization || '─'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{c.prefecture || '─'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-sm font-medium ${formatBudget(c.budget, c.budgetNote) === '記載なし' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {formatBudget(c.budget, c.budgetNote)}
                        </span>
                        {c.budgetNote && formatBudget(c.budget, c.budgetNote) !== '記載なし' && (
                          <span className="block text-xs text-slate-400 mt-0.5">{c.budgetNote}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${urgent ? 'text-red-600' : c.deadline ? 'text-slate-500' : 'text-slate-400'}`}>
                        {c.deadline ?? '記載なし'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {isProcessing ? (
                          <span className="text-xs text-slate-400 font-medium">処理中...</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 検討するボタン */}
                            <button
                              onClick={() => setAssignModalCase(c)}
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 active:scale-95 font-semibold transition-all whitespace-nowrap min-w-[5rem]"
                            >
                              検討する
                            </button>
                            {/* 見送りボタン */}
                            <button
                              onClick={() => setDismissModalCase(c)}
                              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 active:bg-slate-300 active:scale-95 font-semibold transition-all whitespace-nowrap min-w-[4rem]"
                            >
                              見送り
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${c.id}-detail`} className="bg-indigo-50/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-indigo-700">AI判定理由:</span>
                              <p className="text-xs text-slate-700 flex-1">{c.aiReason || '─'}</p>
                            </div>
                            {c.aiMatchingServices.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-indigo-700">マッチサービス:</span>
                                {c.aiMatchingServices.map(s => (
                                  <span key={s} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{s}</span>
                                ))}
                              </div>
                            )}
                            {c.description && (
                              <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>
                            )}
                            {c.url && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <a href={c.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 hover:underline">
                                  公募ページを開く →
                                </a>
                                {c.urlSourceType && SOURCE_LABEL[c.urlSourceType] && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${SOURCE_LABEL[c.urlSourceType].cls}`}>
                                    {SOURCE_LABEL[c.urlSourceType].label}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 担当者選択モーダル */}
      {assignModalCase && (
        <AssignModal
          togCase={assignModalCase}
          submitting={modalSubmitting}
          onConfirm={(assignee) => handleConsider(assignModalCase.id, assignee)}
          onCancel={() => setAssignModalCase(null)}
        />
      )}

      {/* 見送り理由モーダル */}
      {dismissModalCase && (
        <DismissModal
          togCase={dismissModalCase}
          submitting={modalSubmitting}
          onConfirm={(status) => handleDismiss(dismissModalCase.id, status)}
          onCancel={() => setDismissModalCase(null)}
        />
      )}

      {/* トースト通知 */}
      {toast && (
        <ResearchToast toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
