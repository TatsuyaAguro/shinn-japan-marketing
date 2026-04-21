'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addDocument, deleteDocument } from '@/lib/actions/documents'
import { fetchComments, addComment } from '@/lib/actions/comments'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { DocumentRow, CommentRow } from '@/lib/supabase/types'

// ── ファイルタイプ判定 ────────────────────────────────────────
function detectFileType(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'excel'
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'word'
  return 'other'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf:   { icon: '📄', color: 'bg-red-50 text-red-600' },
  image: { icon: '🖼️', color: 'bg-violet-50 text-violet-600' },
  excel: { icon: '📊', color: 'bg-emerald-50 text-emerald-600' },
  word:  { icon: '📝', color: 'bg-blue-50 text-blue-600' },
  other: { icon: '📎', color: 'bg-slate-50 text-slate-600' },
}

// ── デモ用のダミーデータ ─────────────────────────────────────
const DEMO_FILES: DocumentRow[] = [
  { id: 'd1', client_id: '', name: '2026年キックオフ議事録.pdf', storage_path: '', size_bytes: 1258291, file_type: 'pdf', uploaded_by: '田中 美咲', created_at: '2026-04-05T10:00:00Z' },
  { id: 'd2', client_id: '', name: '現地視察写真_集.zip', storage_path: '', size_bytes: 40370176, file_type: 'image', uploaded_by: '鈴木 花子', created_at: '2026-04-03T14:00:00Z' },
  { id: 'd3', client_id: '', name: '予算計画書_v2.xlsx', storage_path: '', size_bytes: 327680, file_type: 'excel', uploaded_by: '山田 健太', created_at: '2026-03-28T09:00:00Z' },
]

const DEMO_COMMENTS: CommentRow[] = [
  { id: 'c1', client_id: '', user_name: '田中 美咲', content: '現地視察写真を追加しました。特に嵐山エリアの写真は提案書に使えそうです。', created_at: '2026-04-05T14:32:00Z' },
  { id: 'c2', client_id: '', user_name: '山田 健太', content: '予算計画書のv2を更新しました。欧米向けのSNS広告費を15%増額した内容です。ご確認お願いします。', created_at: '2026-04-04T09:15:00Z' },
]

// ── メインコンポーネント ─────────────────────────────────────
export default function DocumentsTab({ clientId }: { clientId: string }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [files, setFiles] = useState<DocumentRow[]>(DEMO_FILES)
  const [comments, setComments] = useState<CommentRow[]>(DEMO_COMMENTS)
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabaseReady = isSupabaseReady()

  // DB からデータ初期取得
  useEffect(() => {
    if (!supabaseReady) return
    Promise.all([
      fetch(`/api/documents?clientId=${clientId}`).catch(() => null),
      fetchComments(clientId),
    ]).then(([, cmts]) => {
      if (cmts.length > 0) setComments(cmts)
    })
    // documents は直接 fetchDocuments Server Action を使う
    ;(async () => {
      const { fetchDocuments } = await import('@/lib/actions/documents')
      const docs = await fetchDocuments(clientId)
      if (docs.length > 0) setFiles(docs)
    })()
  }, [clientId, supabaseReady])

  // ── ファイルアップロード ──────────────────────────────────
  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    if (!supabaseReady) {
      setUploadError('Supabase未設定のため、実際のアップロードはできません（デモモード）')
      setTimeout(() => setUploadError(null), 3000)
      return
    }

    setUploading(true)
    setUploadError(null)
    const supabase = createClient()

    for (const file of Array.from(fileList)) {
      const storagePath = `${clientId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const fileType = detectFileType(file.type)

      // Supabase Storage にアップロード
      const { error: uploadErr } = await supabase.storage
        .from('client-documents')
        .upload(storagePath, file)

      if (uploadErr) {
        setUploadError(`アップロード失敗: ${file.name} — ${uploadErr.message}`)
        continue
      }

      // DB にレコード追加
      const { error: dbErr } = await addDocument({
        clientId,
        name:        file.name,
        storagePath,
        sizeBytes:   file.size,
        fileType,
      })

      if (dbErr) {
        setUploadError(`DB登録失敗: ${dbErr}`)
        continue
      }

      // ローカル状態に楽観的に追加
      const newDoc: DocumentRow = {
        id:           crypto.randomUUID(),
        client_id:    clientId,
        name:         file.name,
        storage_path: storagePath,
        size_bytes:   file.size,
        file_type:    fileType,
        uploaded_by:  'あなた',
        created_at:   new Date().toISOString(),
      }
      setFiles(prev => [newDoc, ...prev])
    }

    setUploading(false)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    uploadFiles(e.dataTransfer.files)
  }, [clientId, supabaseReady])

  // ── ファイル削除 ────────────────────────────────────────
  async function handleDelete(doc: DocumentRow) {
    if (!supabaseReady) {
      setFiles(prev => prev.filter(f => f.id !== doc.id))
      return
    }
    const { error } = await deleteDocument(doc.id, doc.storage_path, clientId)
    if (!error) setFiles(prev => prev.filter(f => f.id !== doc.id))
  }

  // ── コメント送信 ────────────────────────────────────────
  async function handleCommentSubmit() {
    if (!comment.trim()) return
    setSubmittingComment(true)

    if (supabaseReady) {
      const { error } = await addComment(clientId, comment.trim())
      if (!error) {
        const newComment: CommentRow = {
          id:         crypto.randomUUID(),
          client_id:  clientId,
          user_name:  'あなた',
          content:    comment.trim(),
          created_at: new Date().toISOString(),
        }
        setComments(prev => [newComment, ...prev])
      }
    } else {
      // デモモード：ローカルのみ
      setComments(prev => [{
        id:         crypto.randomUUID(),
        client_id:  clientId,
        user_name:  'あなた',
        content:    comment.trim(),
        created_at: new Date().toISOString(),
      }, ...prev])
    }

    setComment('')
    setSubmittingComment(false)
  }

  return (
    <div className="space-y-6">
      {/* ファイルアップロードエリア */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ファイル管理</h2>

        {/* エラー表示 */}
        {uploadError && (
          <div className="mb-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {uploadError}
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            isDragging ? 'border-blue-400 bg-blue-50' :
            uploading  ? 'border-slate-200 bg-slate-50 cursor-wait' :
            'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => uploadFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${uploading ? 'bg-slate-100' : 'bg-blue-50'}`}>
              {uploading ? (
                <svg className="w-7 h-7 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {uploading ? 'アップロード中...' : 'ファイルをドラッグ&ドロップ'}
              </p>
              <p className="text-xs text-slate-400 mt-1">またはクリックして選択（PDF、画像、Excel、Word等）</p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">最大100MBまで</span>
          </div>
        </div>
      </div>

      {/* ファイル一覧 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            アップロード済みファイル ({files.length})
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            ファイルがまだアップロードされていません
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {files.map((file, i) => {
              const fileType = FILE_ICONS[file.file_type] ?? FILE_ICONS.other
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i !== files.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${fileType.color}`}>
                    {fileType.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatBytes(file.size_bytes)} · {file.uploaded_by} · {formatDatetime(file.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* チームコメント */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">チームメモ・コメント</h3>

        <div className="space-y-3 mb-4">
          {comments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">コメントはまだありません</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                {c.user_name.charAt(0)}
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">{c.user_name}</span>
                  <span className="text-xs text-slate-400">{formatDatetime(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* コメント入力 */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
            あ
          </div>
          <div className="flex-1">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="コメントを追記する..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleCommentSubmit}
                disabled={!comment.trim() || submittingComment}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-colors cursor-pointer"
              >
                {submittingComment ? '送信中...' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
