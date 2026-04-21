'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'

export interface ROIMessage {
  role: 'user' | 'assistant'
  content: string
}

// ROIチャット履歴を clients.roi_chat_messages JSONB に保存
export async function fetchROIChatHistory(clientId: string): Promise<ROIMessage[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('roi_chat_messages')
    .eq('id', clientId)
    .single()
  return ((data as { roi_chat_messages?: unknown })?.roi_chat_messages as ROIMessage[] | null) ?? []
}

export async function saveROIChatHistory(clientId: string, messages: ROIMessage[]): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase
    .from('clients')
    .update({ roi_chat_messages: messages as unknown as Record<string, unknown>[] })
    .eq('id', clientId)
}
