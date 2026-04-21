'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import crypto from 'crypto'
import type {
  StrategyData,
  StrategyMessage,
  StrategyItem,
  StrategyVersion,
  UploadedFile,
} from '@/lib/types/strategy'

// ── チャット履歴 ──────────────────────────────────────────────

export async function fetchChatHistory(clientId: string): Promise<StrategyMessage[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  return (data ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

export async function saveChatHistory(clientId: string, messages: StrategyMessage[]): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase.from('chat_messages').delete().eq('client_id', clientId)
  if (messages.length === 0) return
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

// ── 分析データ ────────────────────────────────────────────────

export async function fetchStrategyState(clientId: string): Promise<{
  currentData: StrategyData | null
  versions: StrategyVersion[]
  confirmedStrategies: StrategyItem[]
  shareToken: string | null
  strategyStatus: string
  uploadedFiles: UploadedFile[]
}> {
  if (!isSupabaseReady()) {
    return {
      currentData: null, versions: [], confirmedStrategies: [],
      shareToken: null, strategyStatus: 'initial', uploadedFiles: [],
    }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('strategy_data, strategy_versions, confirmed_strategies, share_token, strategy_status, uploaded_files')
    .eq('id', clientId)
    .single()

  return {
    currentData: (data?.strategy_data ?? null) as StrategyData | null,
    versions: (data?.strategy_versions ?? []) as StrategyVersion[],
    confirmedStrategies: (data?.confirmed_strategies ?? []) as StrategyItem[],
    shareToken: data?.share_token ?? null,
    strategyStatus: data?.strategy_status ?? 'initial',
    uploadedFiles: (data?.uploaded_files ?? []) as UploadedFile[],
  }
}

export async function saveStrategyData(
  clientId: string,
  data: StrategyData,
  versions: StrategyVersion[]
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase
    .from('clients')
    .update({
      strategy_data: data as unknown as Record<string, unknown>,
      strategy_versions: versions as unknown as Record<string, unknown>[],
      strategy_status: 'analyzing',
    })
    .eq('id', clientId)
}

export async function confirmStrategies(
  clientId: string,
  strategies: StrategyItem[],
  brandingStory: string,
  directionSummary: string
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()

  // clients テーブルに確定施策を保存
  await supabase
    .from('clients')
    .update({
      confirmed_strategies: strategies as unknown as Record<string, unknown>[],
      branding_story: brandingStory,
      direction_summary: directionSummary,
      strategy_status: 'confirmed',
    })
    .eq('id', clientId)

  // schedules テーブルに自動登録（既存を削除して再登録）
  await supabase.from('schedules').delete().eq('client_id', clientId)
  if (strategies.length > 0) {
    const today = new Date()
    const rows = strategies.map((s, i) => {
      const start = new Date(today)
      start.setDate(start.getDate() + i * 14)
      const end = new Date(start)
      // duration から月数を推定（デフォルト3ヶ月）
      const months = parseInt(s.duration) || 3
      end.setMonth(end.getMonth() + months)
      return {
        client_id: clientId,
        name: s.name,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: 'pending' as const,
        category: 'other',
        memo: s.description,
        color: ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'][i % 5],
        sort_order: i,
        is_ai_suggested: true,
        source_strategy_id: s.id,
        budget_allocation: 0,
      }
    })
    await supabase.from('schedules').insert(rows)
  }
}

export async function saveUploadedFiles(clientId: string, files: UploadedFile[]): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase
    .from('clients')
    .update({ uploaded_files: files as unknown as Record<string, unknown>[] })
    .eq('id', clientId)
}

export async function generateShareToken(clientId: string): Promise<string> {
  const token = crypto.randomBytes(20).toString('hex')
  if (!isSupabaseReady()) return token
  const supabase = await createClient()
  await supabase.from('clients').update({ share_token: token }).eq('id', clientId)
  return token
}

export interface SharedScheduleItem {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  category: string
  color: string
  isAISuggested: boolean
}

export async function fetchSharedStrategy(token: string): Promise<{
  clientName: string
  clientRegion: string
  data: StrategyData
  schedules: SharedScheduleItem[]
} | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name, region, strategy_data')
    .eq('share_token', token)
    .single()
  if (!data?.strategy_data) return null

  // スケジュールも取得
  const { data: schedData } = await supabase
    .from('schedules')
    .select('id, name, start_date, end_date, status, category, color, is_ai_suggested')
    .eq('client_id', data.id)
    .order('sort_order', { ascending: true })

  return {
    clientName: data.name,
    clientRegion: data.region,
    data: data.strategy_data as unknown as StrategyData,
    schedules: (schedData ?? []).map(s => ({
      id: s.id,
      name: s.name,
      startDate: s.start_date,
      endDate: s.end_date,
      status: s.status,
      category: s.category ?? 'other',
      color: s.color ?? '#6366f1',
      isAISuggested: s.is_ai_suggested ?? false,
    })),
  }
}

export async function fetchConfirmedStrategies(clientId: string): Promise<{
  strategies: StrategyItem[]
  brandingStory: string
  directionSummary: string
  status: string
}> {
  if (!isSupabaseReady()) {
    return { strategies: [], brandingStory: '', directionSummary: '', status: 'initial' }
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('confirmed_strategies, branding_story, direction_summary, strategy_status')
    .eq('id', clientId)
    .single()
  return {
    strategies: (data?.confirmed_strategies ?? []) as StrategyItem[],
    brandingStory: data?.branding_story ?? '',
    directionSummary: data?.direction_summary ?? '',
    status: data?.strategy_status ?? 'initial',
  }
}
