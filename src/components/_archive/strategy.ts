'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import crypto from 'crypto'
import type { StrategyData, StrategyMessage, StrategyItem } from '@/lib/types/strategy'

export async function fetchStrategyData(clientId: string): Promise<{
  strategyData: StrategyData | null
  messages: StrategyMessage[]
  shareToken: string | null
  strategyStatus: string
}> {
  if (!isSupabaseReady()) {
    return { strategyData: null, messages: [], shareToken: null, strategyStatus: 'hearing' }
  }

  const supabase = await createClient()
  const [clientRes, msgsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('strategy_data, share_token, strategy_status')
      .eq('id', clientId)
      .single(),
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true }),
  ])

  return {
    strategyData: (clientRes.data?.strategy_data ?? null) as StrategyData | null,
    messages: (msgsRes.data ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    shareToken: clientRes.data?.share_token ?? null,
    strategyStatus: clientRes.data?.strategy_status ?? 'hearing',
  }
}

export async function saveStrategyData(clientId: string, strategyData: StrategyData): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase
    .from('clients')
    .update({ strategy_data: strategyData as unknown as Record<string, unknown>, strategy_status: 'analyzing' })
    .eq('id', clientId)
}

export async function saveStrategyMessages(clientId: string, messages: StrategyMessage[]): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()

  // 既存メッセージを全削除
  await supabase.from('chat_messages').delete().eq('client_id', clientId)

  if (messages.length === 0) return

  // created_at に 1ms ずつオフセットを付けて順序を保証
  const base = Date.now()
  await supabase.from('chat_messages').insert(
    messages.map((m, i) => ({
      client_id: clientId,
      role: m.role,
      content: m.content,
      created_at: new Date(base + i).toISOString(),
    }))
  )
}

export async function confirmStrategies(clientId: string, strategies: StrategyItem[]): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase
    .from('clients')
    .update({
      confirmed_strategies: strategies as unknown as Record<string, unknown>[],
      strategy_status: 'confirmed',
    })
    .eq('id', clientId)
}

export async function generateShareToken(clientId: string): Promise<string> {
  const token = crypto.randomBytes(20).toString('hex')
  if (!isSupabaseReady()) return token
  const supabase = await createClient()
  await supabase.from('clients').update({ share_token: token }).eq('id', clientId)
  return token
}

export async function fetchSharedStrategy(token: string): Promise<{
  client: { name: string; region: string; category: string }
  strategyData: StrategyData
} | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('name, region, category, strategy_data')
    .eq('share_token', token)
    .single()
  if (!data || !data.strategy_data) return null
  return {
    client: { name: data.name, region: data.region, category: data.category },
    strategyData: data.strategy_data as unknown as StrategyData,
  }
}
