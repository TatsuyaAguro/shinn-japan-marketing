'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { ScheduleCategory, ScheduleStatus } from '@/lib/supabase/types'

export interface ScheduleItem {
  id: string
  name: string
  startDate: string
  endDate: string
  manager: string
  status: ScheduleStatus
  category: ScheduleCategory
  memo: string
  color: string
  sortOrder: number
  budgetAllocation: number
  isAISuggested: boolean
  sourceStrategyId: string
}

export async function fetchSchedules(clientId: string): Promise<ScheduleItem[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedules')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
  if (!data) return []
  return data.map(d => ({
    id: d.id,
    name: d.name,
    startDate: d.start_date,
    endDate: d.end_date,
    manager: d.manager ?? '',
    status: d.status as ScheduleStatus,
    category: (d.category ?? 'other') as ScheduleCategory,
    memo: d.memo ?? '',
    color: d.color ?? '#6366f1',
    sortOrder: d.sort_order ?? 0,
    budgetAllocation: d.budget_allocation ?? 0,
    isAISuggested: d.is_ai_suggested ?? false,
    sourceStrategyId: d.source_strategy_id ?? '',
  }))
}

export async function upsertScheduleItem(
  clientId: string,
  item: ScheduleItem,
): Promise<ScheduleItem | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()
  const row = {
    id: item.id,
    client_id: clientId,
    name: item.name,
    start_date: item.startDate,
    end_date: item.endDate,
    manager: item.manager,
    status: item.status,
    category: item.category,
    memo: item.memo,
    color: item.color,
    sort_order: item.sortOrder,
    budget_allocation: item.budgetAllocation,
    is_ai_suggested: item.isAISuggested,
    source_strategy_id: item.sourceStrategyId,
  }
  const { data } = await supabase
    .from('schedules')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (!data) return null
  return { ...item, id: data.id }
}

export async function deleteScheduleItem(id: string): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase.from('schedules').delete().eq('id', id)
}

export async function updateScheduleSortOrder(
  clientId: string,
  orderedIds: string[],
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('schedules').update({ sort_order: i }).eq('id', id).eq('client_id', clientId)
    )
  )
}

export async function patchScheduleField(
  id: string,
  patch: Partial<{
    name: string; start_date: string; end_date: string; manager: string
    status: string; category: string; memo: string; color: string
    budget_allocation: number; is_ai_suggested: boolean; source_strategy_id: string
  }>,
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase.from('schedules').update(patch).eq('id', id)
}
