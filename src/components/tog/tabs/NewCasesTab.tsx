'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TogCase } from '@/lib/types/tog'
import { SCORE_META } from '@/lib/types/tog'
import { updateTogCaseStatus } from '@/lib/actions/tog'

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

interface Props {
  cases: TogCase[]
  lastResearched: string | null
  onRefresh: () => void
}

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

function formatBudget(n: number): string {
  if (n === 0) return '─'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

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

export default function NewCasesTab({ cases, lastResearched, onRefresh }: Props) {
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

  const isRunning = jobStatus === 'running'

  // 完了ハンドラ（useCallback で安定させる）
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
          // サーバー再起動等でジョブが消えた
          setJobId(null)
          setJobStatus(null)
          setStopping(false)
          localStorage.removeItem(LS_KEY)
          return
        }

        const data: JobState = await res.json()
        if (cancelled) return

        setJobStatus(data.status)
        setJobPhase(data.phase)
        setFoundCount(data.foundCount)
        setSavedCount(data.savedCount)

        if (data.status !== 'running') {
          handleJobDone(data)
          return
        }
      } catch {
        // ネットワークエラーは無視して再試行
      }

      if (!cancelled) {
        setTimeout(poll, 2000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId, handleJobDone])

  const handleResearch = async () => {
    if (isRunning) return
    setSetupRequired(false)
    setToast(null)

    try {
      const res = await fetch('/api/tog/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setToast({ message: data.error ?? `HTTP ${res.status}`, type: 'error' })
        return
      }

      const id: string = data.jobId
      setJobId(id)
      setJobStatus('running')
      setJobPhase('ai-searching')
      setFoundCount(0)
      setSavedCount(0)
      localStorage.setItem(LS_KEY, id)
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
    } catch {
      setStopping(false)
    }
  }

  const handleConsider = async (id: string) => {
    await updateTogCaseStatus(id, 'considering')
    onRefresh()
  }

  const handlePass = async (id: string) => {
    await updateTogCaseStatus(id, 'passed')
    onRefresh()
  }

  const sorted = [...cases]
    .filter(c => c.aiScore >= filterScore)
    .sort((a, b) => {
      if (sortKey === 'aiScore') return b.aiScore - a.aiScore
      if (sortKey === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
      return b.budget - a.budget
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
                {jobPhase === 'ai-searching'
                  ? 'AIがウェブを検索中...'
                  : `${foundCount}件を検出 → 保存中...`}
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
            {[5, 4, 3].map(s => (
              <option key={s} value={s}>★{s}以上</option>
            ))}
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-36">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((c, i) => {
                const urgent = isUrgent(c.deadline)
                const expanded = expandedId === c.id
                return (
                  <>
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''} ${urgent ? 'bg-red-50/40' : ''}`}
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
                          <span className="font-medium text-slate-800 line-clamp-1">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        <span className="line-clamp-1">{c.organization || '─'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{c.prefecture || '─'}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium hidden lg:table-cell">{formatBudget(c.budget)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${urgent ? 'text-red-600' : 'text-slate-500'}`}>
                        {c.deadline ?? '─'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleConsider(c.id)}
                            className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                          >
                            検討する
                          </button>
                          <button
                            onClick={() => handlePass(c.id)}
                            className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                          >
                            見送り
                          </button>
                        </div>
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
                              <a href={c.url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline">
                                公募ページを開く →
                              </a>
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

      {/* トースト通知 */}
      {toast && (
        <ResearchToast toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
