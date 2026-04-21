'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'

export async function fetchAnalysis(clientId: string, title: string): Promise<string | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('analyses')
    .select('content')
    .eq('client_id', clientId)
    .eq('title', title)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data?.content ?? null
}

export async function checkAnthropicKey(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY
}

export async function saveAnalysis(
  clientId: string,
  title: string,
  content: string
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()

  const { data: existing } = await supabase
    .from('analyses')
    .select('id')
    .eq('client_id', clientId)
    .eq('title', title)
    .limit(1)
    .single()

  if (existing?.id) {
    const { error } = await supabase
      .from('analyses')
      .update({ content, ai_model: 'claude-opus-4-5' })
      .eq('id', existing.id)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase
    .from('analyses')
    .insert({ client_id: clientId, title, content, ai_model: 'claude-opus-4-5' })
  return { error: error?.message ?? null }
}
