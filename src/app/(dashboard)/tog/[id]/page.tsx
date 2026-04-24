'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { TogCase, TogStatus } from '@/lib/types/tog'
import { SCORE_META, STATUS_META } from '@/lib/types/tog'
import { fetchTogCase, patchTogCase, updateTogCaseStatus, createClientFromTogCase, deleteTogCase } from '@/lib/actions/tog'

function formatBudget(n: number): string {
  if (n === 0) return '未定'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

interface AnalysisMsg { role: 'user' | 'assistant'; content: string }

export default function TogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [togCase, setTogCase] = useState<TogCase | null>(null)
  const [loading, setLoading] = useState(true)

  // 編集フィールド
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<TogCase>>({})

  // AI分析
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisMsgs, setAnalysisMsgs] = useState<AnalysisMsg[]>([])
  const [analysisInput, setAnalysisInput] = useState('')

  // ステータス変更
  const [statusChanging, setStatusChanging] = useState(false)
  const [acceptingClient, setAcceptingClient] = useState(false)
  const [movingToActive, setMovingToActive] = useState(false)

  const load = useCallback(async () => {
    const c = await fetchTogCase(id)
    if (!c) { router.push('/tog'); return }
    setTogCase(c)
    setForm({
      name: c.name, organization: c.organization, prefecture: c.prefecture,
      category: c.category, description: c.description, budget: c.budget,
      deadline: c.deadline ?? undefined, url: c.url, gdriveLink: c.gdriveLink,
      memo: c.memo, assignedTo: c.assignedTo,
    })
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!togCase) return
    await patchTogCase(id, {
      name: form.name, organization: form.organization, prefecture: form.prefecture,
      category: form.category, description: form.description,
      budget: form.budget ?? undefined, deadline: form.deadline ?? null,
      url: form.url, gdrive_link: form.gdriveLink,
      memo: form.memo, assigned_to: form.assignedTo,
    })
    setEditMode(false)
    load()
  }

  const handleStatusChange = async (status: TogStatus) => {
    if (!togCase) return
    setStatusChanging(true)
    await updateTogCaseStatus(id, status)
    await load()
    setStatusChanging(false)
  }

  const handleMoveToActive = async () => {
    if (!togCase) return
    setMovingToActive(true)
    await updateTogCaseStatus(id, 'considering')
    await load()
    setMovingToActive(false)
  }

  const handleAcceptAndRegister = async () => {
    if (!togCase) return
    setAcceptingClient(true)
    try {
      await updateTogCaseStatus(id, 'accepted')
      await createClientFromTogCase(id)
      await load()
    } finally {
      setAcceptingClient(false)
    }
  }

  const handleAnalyze = async (userMsg?: string) => {
    if (!togCase) return
    setAnalyzing(true)
    const newMsg: AnalysisMsg = { role: 'user', content: userMsg ?? 'この案件について詳しく分析してください。' }
    const nextMsgs = [...analysisMsgs, newMsg]
    setAnalysisMsgs(nextMsgs)
    setAnalysisInput('')

    try {
      const res = await fetch('/api/tog/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ togCase, messages: nextMsgs }),
      })
      const data = await res.json()
      setAnalysisMsgs([...nextMsgs, { role: 'assistant', content: data.analysis ?? 'エラーが発生しました' }])
      // analysis_data を DB に保存
      if (data.analysis) {
        await patchTogCase(id, { analysis_data: { ...togCase.analysisData, lastAnalysis: data.analysis } })
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('この案件を削除しますか？')) return
    await deleteTogCase(id)
    router.push('/tog')
  }

  if (loading || !togCase) {
    return <div className="flex items-center justify-center h-64"><span className="text-sm text-slate-400">読み込み中...</span></div>
  }

  const scoreMeta = SCORE_META[togCase.aiScore] ?? SCORE_META[0]
  const statusMeta = STATUS_META[togCase.status]

  const ALL_NEXT: { status: TogStatus; label: string }[] = [
    { status: 'considering', label: '検討中へ' },
    { status: 'preparing',   label: '応募準備中へ' },
    { status: 'applied',     label: '応募済みへ' },
    { status: 'passed',      label: '見送り' },
  ]
  const NEXT_STATUSES = ALL_NEXT.filter(s => s.status !== togCase.status)

  const ACTIVE_STATUSES: TogStatus[] = ['considering', 'preparing', 'applied', 'accepted']
  const isActive = ACTIVE_STATUSES.includes(togCase.status)
  const isNew    = togCase.status === 'new'
  // 採択→クライアント登録ボタンは未採択の対応中案件にのみ表示
  const canAccept = ['considering', 'preparing', 'applied'].includes(togCase.status) && !togCase.linkedClientId

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusMeta.color}`}>{statusMeta.label}</span>
            <span className="text-sm font-bold" style={{ color: scoreMeta.hex }}>{scoreMeta.stars}</span>
          </div>
          {editMode ? (
            <input
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full text-2xl font-bold text-slate-900 border-b-2 border-indigo-400 focus:outline-none bg-transparent"
            />
          ) : (
            <h1 className="text-2xl font-bold text-slate-900">{togCase.name}</h1>
          )}
          <p className="text-sm text-slate-500 mt-1">{togCase.organization} · {togCase.prefecture}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* 対応中に追加 / 追加済み */}
          {isNew && (
            <button
              onClick={handleMoveToActive}
              disabled={movingToActive}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {movingToActive ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              この案件を対応中に追加
            </button>
          )}
          {isActive && (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg border border-emerald-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              対応中に追加済み
            </span>
          )}

          {editMode ? (
            <>
              <button onClick={handleSave} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors">保存</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">キャンセル</button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors">編集</button>
          )}
          <button onClick={handleDelete} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm">削除</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 基本情報 + ステータス管理 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本情報 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4">基本情報</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: '公示元', key: 'organization' as const },
                { label: '都道府県', key: 'prefecture' as const },
                { label: '案件種類', key: 'category' as const },
                { label: '担当者', key: 'assignedTo' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  {editMode ? (
                    <input
                      value={(form[key] as string) ?? ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{(togCase[key] as string) || '─'}</p>
                  )}
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-400 mb-1">提案上限額</p>
                {editMode ? (
                  <input
                    type="number"
                    value={form.budget ?? 0}
                    onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                ) : (
                  <p className="text-sm text-slate-700 font-semibold">{formatBudget(togCase.budget ?? 0)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">締切日</p>
                {editMode ? (
                  <input
                    type="date"
                    value={form.deadline ?? ''}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value || undefined }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                ) : (
                  <p className="text-sm text-slate-700">{togCase.deadline ?? '─'}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-1">業務概要</p>
              {editMode ? (
                <textarea
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">{togCase.description || '─'}</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">公募URL</p>
                {editMode ? (
                  <input value={form.url ?? ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                ) : togCase.url ? (
                  <a href={togCase.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">{togCase.url}</a>
                ) : <p className="text-sm text-slate-400">─</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Google Drive リンク</p>
                {editMode ? (
                  <input value={form.gdriveLink ?? ''} onChange={e => setForm(f => ({ ...f, gdriveLink: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                ) : togCase.gdriveLink ? (
                  <a href={togCase.gdriveLink} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">Drive を開く →</a>
                ) : <p className="text-sm text-slate-400">─</p>}
              </div>
            </div>
          </div>

          {/* AI分析 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">AI分析</h2>
              {analysisMsgs.length === 0 && (
                <button
                  onClick={() => handleAnalyze()}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {analyzing ? 'AI分析中...' : 'AI分析を開始'}
                </button>
              )}
            </div>

            {analysisMsgs.length > 0 ? (
              <div className="space-y-3">
                {analysisMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'}`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
                {analyzing && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-slate-500">AI分析中...</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <input
                    value={analysisInput}
                    onChange={e => setAnalysisInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleAnalyze(analysisInput) } }}
                    placeholder="追加で質問する… (Shift+Enterで送信)"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => handleAnalyze(analysisInput)}
                    disabled={analyzing || !analysisInput.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    送信
                  </button>
                </div>
              </div>
            ) : togCase.analysisData?.lastAnalysis ? (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{togCase.analysisData.lastAnalysis as string}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">まだ分析が実行されていません。</p>
            )}
          </div>

          {/* メモ */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-3">メモ</h2>
            <textarea
              value={form.memo ?? ''}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              onBlur={() => patchTogCase(id, { memo: form.memo })}
              placeholder="自由にメモを記入..."
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>

        {/* 右: ステータス管理 + AI評価 + 履歴 */}
        <div className="space-y-6">
          {/* ステータス管理 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-3">ステータス管理</h2>
            <div className="space-y-2">
              {NEXT_STATUSES.map(s => (
                <button
                  key={s.status}
                  onClick={() => handleStatusChange(s.status)}
                  disabled={statusChanging}
                  className="w-full text-sm py-2 px-3 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 font-medium text-left disabled:opacity-60 transition-colors"
                >
                  → {s.label}
                </button>
              ))}
              {canAccept && (
                <button
                  onClick={handleAcceptAndRegister}
                  disabled={acceptingClient}
                  className="w-full text-sm py-2.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-60 transition-colors"
                >
                  {acceptingClient ? '登録中...' : '採択 → クライアント登録'}
                </button>
              )}
              {togCase.status === 'accepted' && !togCase.linkedClientId && !acceptingClient && (
                <button
                  onClick={handleAcceptAndRegister}
                  disabled={acceptingClient}
                  className="w-full text-sm py-2.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-60 transition-colors"
                >
                  クライアント登録
                </button>
              )}
              {togCase.linkedClientId && (
                <button
                  onClick={() => router.push(`/home/${togCase.linkedClientId}`)}
                  className="w-full text-sm py-2 px-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
                >
                  AI戦略室を開く →
                </button>
              )}
            </div>
          </div>

          {/* AI評価 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-3">AI評価</h2>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-bold" style={{ color: scoreMeta.hex }}>{scoreMeta.stars}</span>
              <span className="text-sm text-slate-600">{scoreMeta.label}</span>
            </div>
            {togCase.aiReason && (
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{togCase.aiReason}</p>
            )}
            {togCase.aiMatchingServices.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">マッチサービス</p>
                <div className="flex flex-wrap gap-1.5">
                  {togCase.aiMatchingServices.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {togCase.aiActionRecommendation && (
              <div className="mt-3 bg-indigo-50 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-indigo-700 mb-0.5">推奨アクション</p>
                <p className="text-xs text-indigo-600 leading-relaxed">{togCase.aiActionRecommendation}</p>
              </div>
            )}
          </div>

          {/* ステータス履歴 */}
          {togCase.statusHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3">ステータス履歴</h2>
              <div className="space-y-2">
                {[...togCase.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_META[h.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_META[h.status]?.label ?? h.status}</span>
                      <span className="text-xs text-slate-400 ml-2">{h.date}</span>
                      {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
