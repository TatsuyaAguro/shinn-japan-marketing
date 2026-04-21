'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { CommentRow } from '@/lib/supabase/types'

// ── コメント一覧取得 ─────────────────────────────────────────
export async function fetchComments(clientId: string): Promise<CommentRow[]> {
  if (!isSupabaseReady()) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CommentRow[]
}

// ── コメント追加 ─────────────────────────────────────────────
export async function addComment(clientId: string, content: string) {
  if (!isSupabaseReady()) {
    return { error: 'Supabaseが未設定です。' }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userName = user?.email?.split('@')[0] ?? 'ユーザー'

  const { error } = await supabase.from('comments').insert({
    client_id: clientId,
    user_name: userName,
    content,
  })

  if (error) return { error: error.message }

  revalidatePath(`/home/${clientId}`)
  return { error: null }
}
