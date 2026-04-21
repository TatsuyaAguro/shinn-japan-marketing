'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { ScheduleRow, ScheduleStatus } from '@/lib/supabase/types'

export async function fetchSchedules(clientId: string): Promise<ScheduleRow[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as ScheduleRow[]
}

export async function createSchedule(params: {
  client_id: string
  name: string
  start_date: string
  end_date: string
  manager: string
  status: ScheduleStatus
  memo: string
  color: string
  sort_order: number
}): Promise<{ error: string | null; id: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です', id: null }
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('schedules')
    .insert(params)
    .select('id')
    .single()
  if (error) return { error: error.message, id: null }
  return { error: null, id: (data as { id: string }).id }
}

export async function updateSchedule(
  id: string,
  fields: Partial<Omit<ScheduleRow, 'id' | 'client_id' | 'created_at' | 'updated_at'>>
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase.from('schedules').update(fields).eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteSchedule(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function reorderSchedules(
  updates: { id: string; sort_order: number }[]
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: null }
  const supabase = await createServerClient()
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('schedules').update({ sort_order }).eq('id', id)
    )
  )
  return { error: null }
}
