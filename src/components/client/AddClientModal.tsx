'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createClientAction } from '@/lib/actions/clients'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { addDocument } from '@/lib/actions/documents'
import { isSupabaseReady } from '@/lib/supabase/isReady'

const CATEGORIES = ['自治体', '観光協会', 'ランドオペレーター', '地域事業者', '宿泊施設', 'その他']
const STATUSES = [
  { value: 'draft', label: '準備中' },
  { value: 'active', label: '稼働中' },
  { value: 'inactive', label: '停止中' },
]

function detectFileType(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'excel'
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'word'
  if (mime.startsWith('text/')) return 'other'
  return 'other'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}

const isTextFile = (file: File) =>
  file.type.startsWith('text/') ||
  /\.(txt|md|csv|json|xml)$/i.test(file.name)

export default function AddClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ── アップロードするファイル一覧（フォーム送信前はメモリ保持）────
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // ── AI自動入力 ─────────────────────────────────────────────
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // ── フォームフィールド（AI自動入力で書き換えるため controlled）──
  const [fields, setFields] = useState({
    name: '',
    region: '',
    category: '自治体',
    targetMarket: '',
    touristResources: '',
    budget: '',
    manager: '',
    status: 'draft',
    description: '',
  })

  const set = (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields(prev => ({ ...prev, [key]: e.target.value }))

  // ── ファイル追加 ────────────────────────────────────────────
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList)
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...newFiles.filter(f => !existing.has(f.name + f.size))]
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const removeFile = (index: number) =>
    setPendingFiles(prev => prev.filter((_, i) => i !== index))

  // ── AI自動入力 ─────────────────────────────────────────────
  async function handleExtract() {
    if (pendingFiles.length === 0) return
    setIsExtracting(true)
    setExtractError(null)

    try {
      const filePayloads = await Promise.all(
        pendingFiles.map(async file => {
          if (isTextFile(file)) {
            const textContent = await readFileAsText(file)
            return { name: file.name, mediaType: file.type, data: '', isText: true, textContent }
          }
          const data = await readFileAsBase64(file)
          return { name: file.name, mediaType: file.type, data, isText: false }
        })
      )

      const res = await fetch('/api/extract-client-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filePayloads }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        setExtractError(json.error ?? 'AI抽出に失敗しました')
        return
      }

      const e = json.extracted
      setFields(prev => ({
        ...prev,
        name:             e.name             || prev.name,
        region:           e.region           || prev.region,
        targetMarket:     e.targetMarket     || prev.targetMarket,
        touristResources: e.touristResources || prev.touristResources,
        description:      e.description      || prev.description,
      }))
    } catch {
      setExtractError('通信エラーが発生しました')
    } finally {
      setIsExtracting(false)
    }
  }

  // ── フォーム送信 ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createClientAction(formData)

    if (result.error || !result.id) {
      setError(result.error ?? '作成に失敗しました')
      setLoading(false)
      return
    }

    // ── ファイルをStorage にアップロードしてDBに記録 ───────────
    if (pendingFiles.length > 0 && isSupabaseReady()) {
      const supabase = createSupabaseClient()
      for (const file of pendingFiles) {
        const storagePath = `${result.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { error: upErr } = await supabase.storage
          .from('client-documents')
          .upload(storagePath, file)
        if (!upErr) {
          await addDocument({
            clientId:    result.id,
            name:        file.name,
            storagePath,
            sizeBytes:   file.size,
            fileType:    detectFileType(file.type),
          })
        }
      }
    }

    router.push(`/home/${result.id}?tab=project_design`)
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all'
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1.5'

  const hasApiKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) // APIキー有無のヒントはサーバー側で判定

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800">クライアントを追加</h2>
            <p className="text-xs text-slate-500 mt-0.5">資料をアップロードするとAIが自動入力します</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── 資料アップロードエリア ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>資料アップロード</label>
              <span className="text-xs text-slate-400">議事録・ヒアリングメモ・PDF など</span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
              <svg className="w-7 h-7 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-slate-600 font-medium">ドラッグ&ドロップ、またはクリックして選択</p>
              <p className="text-xs text-slate-400 mt-1">PDF・Word・テキスト・画像など複数可</p>
            </div>

            {/* ファイル一覧 */}
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-base shrink-0">
                      {file.type === 'application/pdf' ? '📄' : file.type.startsWith('image/') ? '🖼️' : '📎'}
                    </span>
                    <span className="text-xs text-slate-700 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AIで自動入力ボタン */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleExtract}
                disabled={pendingFiles.length === 0 || isExtracting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AIが資料を読み取り中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AIで自動入力
                    {pendingFiles.length === 0 && <span className="text-xs font-normal text-violet-500">（資料をアップロードしてください）</span>}
                  </>
                )}
              </button>

              {extractError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {extractError}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5" />

          {/* ── フォームフィールド ── */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelClass}>クライアント名 <span className="text-red-500">*</span></label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="例：〇〇観光協会"
                  value={fields.name}
                  onChange={set('name')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>地域 <span className="text-red-500">*</span></label>
                <input
                  name="region"
                  type="text"
                  required
                  placeholder="例：京都府"
                  value={fields.region}
                  onChange={set('region')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>カテゴリ</label>
                <select
                  name="category"
                  value={fields.category}
                  onChange={set('category')}
                  className={inputClass}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>ターゲット市場 <span className="text-red-500">*</span></label>
                <input
                  name="targetMarket"
                  type="text"
                  required
                  placeholder="例：欧米・オーストラリア"
                  value={fields.targetMarket}
                  onChange={set('targetMarket')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>予算規模</label>
                <input
                  name="budget"
                  type="text"
                  placeholder="例：5,000万円"
                  value={fields.budget}
                  onChange={set('budget')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>担当者</label>
                <input
                  name="manager"
                  type="text"
                  placeholder="例：田中 美咲"
                  value={fields.manager}
                  onChange={set('manager')}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>ステータス</label>
                <select
                  name="status"
                  value={fields.status}
                  onChange={set('status')}
                  className={inputClass}
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>対象観光資源</label>
                <input
                  name="touristResources"
                  type="text"
                  placeholder="例：金閣寺、嵐山、祇園"
                  value={fields.touristResources}
                  onChange={set('touristResources')}
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + ' mb-0'}>プロジェクト概要</label>
                  <span className="text-xs text-slate-400">手動入力・AI自動入力どちらでも</span>
                </div>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="プロジェクトの目的・背景・方向性など..."
                  value={fields.description}
                  onChange={set('description')}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {/* エラー */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* アクション */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors cursor-pointer font-medium"
              >
                {loading
                  ? (pendingFiles.length > 0 ? '作成・アップロード中...' : '作成中...')
                  : `作成する${pendingFiles.length > 0 ? ` (資料 ${pendingFiles.length} 件)` : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
