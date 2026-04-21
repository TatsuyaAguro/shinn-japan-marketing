'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { ChatMessageRow } from '@/lib/supabase/types'

// ── チャット履歴取得 ─────────────────────────────────────────
export async function fetchChatMessages(clientId: string): Promise<ChatMessageRow[]> {
  if (!isSupabaseReady()) return []

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error || !data) return []
  return data as ChatMessageRow[]
}

// ── チャットメッセージ保存 ───────────────────────────────────
export async function saveChatMessage(params: {
  clientId: string
  role: 'user' | 'assistant'
  content: string
}) {
  if (!isSupabaseReady()) return { error: null } // サイレントスキップ

  const supabase = await createServerClient()
  const { error } = await supabase.from('chat_messages').insert({
    client_id: params.clientId,
    role:      params.role,
    content:   params.content,
  })

  return { error: error?.message ?? null }
}
