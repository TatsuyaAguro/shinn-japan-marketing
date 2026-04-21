'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TogCase, TogStatus } from '@/lib/types/tog'
import { KANBAN_COLUMNS, SCORE_META } from '@/lib/types/tog'
import { updateTogCaseStatus, createClientFromTogCase, upsertTogCase } from '@/lib/actions/tog'

interface Props {
  cases: TogCase[]
  onRefresh: () => void
}

// 手動追加モーダルで選択できるステータス（採択は手動追加不可）
const ADD_STATUSES: { value: TogStatus; label: string }[] = [
  { value: 'considering', label: '検討中' },
  { value: 'preparing',   label: '応募準備中' },
  { value: 'applied',     label: '応募済み' },
]

const CATEGORIES = ['商品造成', '情報発信', '販路開拓', 'その他'] as const

interface AddForm {
  name: string
  organization: string
  prefecture: string
  category: string
  budget: string
  deadline: string
  description: string
  url: string
  gdriveLink: string
  memo: string
  status: TogStatus
}

const EMPTY_FORM: AddForm = {
  name: '', organization: '', prefecture: '', category: '',
  budget: '', deadline: '', description: '', url: '',
  gdriveLink: '', memo: '', status: 'considering',
}

function formatBudget(n: number): string {
  if (n === 0) return '─'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万`
  return `${n.toLocaleString()}`
}

function ScoreDot({ score }: { score: number }) {
  const meta = SCORE_META[score] ?? SCORE_META[0]
  return (
    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: meta.hex }} title={meta.label} />
  )
}

// ── 採択確認ダイアログ ──────────────────────────────────────────
function ConfirmAcceptDialog({
  togCase,
  accepting,
  onConfirm,
  onCancel,
}: {
  togCase: TogCase
  accepting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* ヘッダー */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">採択としてクライアント登録しますか？</h3>
              <p className="text-xs text-slate-500 mt-0.5">この操作はクライアント管理に自動登録されます</p>
            </div>
          </div>

          {/* 案件サマリー */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <p className="font-semibold text-slate-800 leading-snug">{togCase.name}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mt-2">
              <div><span className="text-slate-400">クライアント名</span><br />{togCase.organization || '─'}</div>
              <div><span className="text-slate-400">地域</span><br />{togCase.prefecture || '─'}</div>
              <div><span className="text-slate-400">カテゴリ</span><br />自治体</div>
              <div><span className="text-slate-400">予算上限</span><br />{togCase.budget > 0 ? `${formatBudget(togCase.budget)}円` : '未定'}</div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={accepting}
            className="flex-1 px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 font-medium transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={accepting}
            className="flex-1 px-4 py-2.5 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 font-semibold transition-colors disabled:opacity-60"
          >
            {accepting ? '登録中...' : '採択として登録'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 手動追加モーダル ──────────────────────────────────────────────
function AddCaseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof AddForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('案件名は必須です'); return }
    if (!form.organization.trim()) { setError('公示元名は必須です'); return }
    setSaving(true)
    setError(null)
    try {
      const result = await upsertTogCase({
        id: crypto.randomUUID(),
        name:         form.name.trim(),
        organization: form.organization.trim(),
        prefecture:   form.prefecture.trim(),
        category:     form.category,
        budget:       form.budget ? parseInt(form.budget.replace(/[^\d]/g, ''), 10) || 0 : 0,
        deadline:     form.deadline || null,
        description:  form.description.trim(),
        url:          form.url.trim(),
        gdriveLink:   form.gdriveLink.trim(),
        memo:         form.memo.trim(),
        status:       form.status,
        aiScore:      0,
        aiReason:     '',
        aiMatchingServices:     [],
        aiActionRecommendation: '',
      })
      if (!result) {
        setError('保存に失敗しました。Supabase の tog-setup.sql が実行済みか確認してください。')
        return
      }
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'
  const labelCls = 'text-xs font-medium text-slate-600 mb-1 block'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">案件を手動追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>案件名 <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="例：北海道インバウンド観光プロモーション業務" className={inputCls} autoFocus />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>公示元名 <span className="text-red-500">*</span></label>
              <input value={form.organization} onChange={e => set('organization', e.target.value)}
                placeholder="例：北海道庁" className={inputCls} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>都道府県</label>
              <input value={form.prefecture} onChange={e => set('prefecture', e.target.value)}
                placeholder="例：北海道" className={inputCls} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>案件種類</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                <option value="">選択してください</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>初期ステータス</label>
              <select value={form.status} onChange={e => set('status', e.target.value as TogStatus)} className={inputCls}>
                {ADD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>提案上限額（円）</label>
              <input type="text" inputMode="numeric" value={form.budget}
                onChange={e => set('budget', e.target.value)} placeholder="例：5000000" className={inputCls} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>締切日</label>
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>業務種類詳細</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="業務の概要を入力..." rows={3} className={`${inputCls} resize-none`} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>公募ページURL</label>
              <input value={form.url} onChange={e => set('url', e.target.value)}
                placeholder="https://" className={inputCls} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>Google ドライブリンク</label>
              <input value={form.gdriveLink} onChange={e => set('gdriveLink', e.target.value)}
                placeholder="https://drive.google.com/..." className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>メモ</label>
              <textarea value={form.memo} onChange={e => set('memo', e.target.value)}
                placeholder="自由にメモを入力..." rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium transition-colors">
            キャンセル
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-60 transition-colors">
            {saving ? '保存中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── トースト通知 ──────────────────────────────────────────────────
function ActiveToast({
  message,
  type,
  onDismiss,
}: {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}) {
  // 5秒後に自動消去
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const cls = type === 'success'
    ? 'bg-emerald-700 text-white'
    : 'bg-red-700 text-white'

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl max-w-sm ${cls}`}>
      {type === 'success' ? (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <p className="text-sm font-medium leading-snug flex-1">{message}</p>
      <button onClick={onDismiss} className="text-white/70 hover:text-white shrink-0">✕</button>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────
export default function ActiveTab({ cases, onRefresh }: Props) {
  const router = useRouter()
  const dragCardId = useRef<string | null>(null)
  const dragFromStatus = useRef<TogStatus | null>(null)

  const [accepting, setAccepting] = useState<string | null>(null)
  const [draggingOver, setDraggingOver] = useState<TogStatus | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [confirmCase, setConfirmCase] = useState<TogCase | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // waiting ステータスの案件は applied カラムに表示（後方互換）
  const byStatus = (status: TogStatus) => {
    if (status === 'applied') return cases.filter(c => c.status === 'applied' || c.status === 'waiting')
    return cases.filter(c => c.status === status)
  }

  const handleDragStart = (e: React.DragEvent, caseId: string, colStatus: TogStatus) => {
    dragCardId.current = caseId
    dragFromStatus.current = colStatus
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: TogStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDraggingOver(status)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: TogStatus) => {
    e.preventDefault()
    setDraggingOver(null)
    const id = dragCardId.current
    const fromStatus = dragFromStatus.current
    dragCardId.current = null
    dragFromStatus.current = null
    if (!id || fromStatus === targetStatus) return

    if (targetStatus === 'accepted') {
      // 採択カラムへのドロップは確認ダイアログを挟む
      const found = cases.find(c => c.id === id)
      if (found) setConfirmCase(found)
      return
    }

    await updateTogCaseStatus(id, targetStatus)
    onRefresh()
  }

  const handleAccept = async (caseId: string) => {
    setAccepting(caseId)
    try {
      await updateTogCaseStatus(caseId, 'accepted')
      const clientId = await createClientFromTogCase(caseId)
      onRefresh()
      if (clientId) {
        setToast({ message: 'クライアントとして登録しました。カード上のリンクから詳細を開けます。', type: 'success' })
      } else {
        setToast({ message: 'ステータスを採択に変更しましたが、クライアント登録に失敗しました。コンソールを確認してください。', type: 'error' })
      }
    } finally {
      setAccepting(null)
    }
  }

  const handleReject = async (id: string) => {
    await updateTogCaseStatus(id, 'rejected')
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{cases.filter(c => c.status !== 'waiting').length}件対応中</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          案件を追加
        </button>
      </div>

      {/* カンバン */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map(col => {
          const colCases = byStatus(col.status)
          const isDragTarget = draggingOver === col.status
          const isAcceptedCol = col.status === 'accepted'
          return (
            <div
              key={col.status}
              className={`flex-shrink-0 w-72 rounded-2xl border-2 transition-colors ${col.color} ${isDragTarget ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${isDragTarget && isAcceptedCol ? '!ring-emerald-400' : ''}`}
              onDragOver={e => handleDragOver(e, col.status)}
              onDragLeave={() => setDraggingOver(null)}
              onDrop={e => handleDrop(e, col.status)}
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-inherit flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isAcceptedCol && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-slate-700">{col.label}</span>
                </div>
                <span className="text-xs text-slate-500 bg-white rounded-full px-2 py-0.5 font-semibold">
                  {colCases.length}
                </span>
              </div>

              {/* Hint for accepted column */}
              {isAcceptedCol && colCases.length === 0 && (
                <p className="text-xs text-emerald-600/70 text-center pt-2 px-3 leading-snug">
                  ここにドロップすると<br />クライアントに自動登録
                </p>
              )}

              {/* Cards */}
              <div className="p-3 space-y-2 min-h-32">
                {colCases.map(c => {
                  const isAccepted = c.status === 'accepted'
                  const hasClient = isAccepted && !!c.linkedClientId
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={e => handleDragStart(e, c.id, col.status)}
                      className={`bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none ${isAccepted ? 'border-emerald-200' : 'border-slate-200'}`}
                    >
                      {/* Top row */}
                      <div className="flex items-start gap-1.5 mb-2 min-w-0">
                        <ScoreDot score={c.aiScore} />
                        <p
                          className="text-xs font-semibold text-slate-800 line-clamp-2 cursor-pointer hover:text-indigo-600 flex-1"
                          onClick={() => router.push(`/tog/${c.id}`)}
                        >
                          {c.name}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="space-y-0.5 mb-2">
                        {c.organization && (
                          <p className="text-xs text-slate-500 truncate">{c.organization}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {c.budget > 0 && <span>{formatBudget(c.budget)}円</span>}
                          {c.deadline && (
                            <span className={new Date(c.deadline) < new Date(Date.now() + 7 * 86400000) ? 'text-red-500 font-semibold' : ''}>
                              {c.deadline}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Accepted: client link */}
                      {hasClient && (
                        <button
                          onClick={() => router.push(`/home/${c.linkedClientId}`)}
                          className="w-full text-left text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline mb-2"
                        >
                          クライアント詳細を開く →
                        </button>
                      )}
                      {isAccepted && !hasClient && accepting === c.id && (
                        <p className="text-xs text-emerald-600 mb-2">クライアント登録中...</p>
                      )}

                      {/* 不採択ボタン（採択カラム以外は常に表示、採択カラムは未リンク時のみ） */}
                      {(!isAccepted || !hasClient) && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleReject(c.id)}
                            className="w-full text-xs py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-semibold transition-colors"
                          >
                            不採択
                          </button>
                        </div>
                      )}

                      {/* Detail link */}
                      <button
                        onClick={() => router.push(`/tog/${c.id}`)}
                        className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                      >
                        詳細 →
                      </button>
                    </div>
                  )
                })}

                {colCases.length === 0 && !isAcceptedCol && (
                  <div className="flex items-center justify-center h-16 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    ここにドロップ
                  </div>
                )}
                {colCases.length === 0 && isAcceptedCol && (
                  <div className="flex items-center justify-center h-12 text-xs text-emerald-400/70 border-2 border-dashed border-emerald-200 rounded-xl mt-1">
                    ドロップで採択登録
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 採択確認ダイアログ */}
      {confirmCase && (
        <ConfirmAcceptDialog
          togCase={confirmCase}
          accepting={accepting === confirmCase.id}
          onConfirm={() => {
            const c = confirmCase
            setConfirmCase(null)
            handleAccept(c.id)
          }}
          onCancel={() => {
            setConfirmCase(null)
            onRefresh()
          }}
        />
      )}

      {/* 手動追加モーダル */}
      {showAddForm && (
        <AddCaseModal
          onClose={() => setShowAddForm(false)}
          onSaved={() => { setShowAddForm(false); onRefresh() }}
        />
      )}

      {/* トースト通知 */}
      {toast && (
        <ActiveToast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
