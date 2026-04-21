'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { DocumentRow } from '@/lib/supabase/types'

// ── ドキュメント一覧取得 ─────────────────────────────────────
export async function fetchDocuments(clientId: string): Promise<DocumentRow[]> {
  if (!isSupabaseReady()) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as DocumentRow[]
}

// ── ドキュメント追加 (Storage upload 後に呼ぶ) ─────────────────
export async function addDocument(params: {
  clientId: string
  name: string
  storagePath: string
  sizeBytes: number
  fileType: string
}) {
  if (!isSupabaseReady()) {
    return { error: 'Supabaseが未設定です。' }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('documents').insert({
    client_id:    params.clientId,
    name:         params.name,
    storage_path: params.storagePath,
    size_bytes:   params.sizeBytes,
    file_type:    params.fileType,
    uploaded_by:  user?.email?.split('@')[0] ?? 'ユーザー',
  })

  if (error) return { error: error.message }

  revalidatePath(`/home/${params.clientId}`)
  return { error: null }
}

// ── ドキュメント削除 ─────────────────────────────────────────
export async function deleteDocument(documentId: string, storagePath: string, clientId: string) {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です。' }

  const supabase = await createServerClient()

  // Storage から削除
  await supabase.storage.from('client-documents').remove([storagePath])

  // DBレコード削除
  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) return { error: error.message }

  revalidatePath(`/home/${clientId}`)
  return { error: null }
}

// ── 署名付きURLを取得（ダウンロード用） ───────────────────────
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseReady()) return null

  const supabase = await createServerClient()
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(storagePath, 3600) // 1時間有効

  if (error || !data) return null
  return data.signedUrl
}
