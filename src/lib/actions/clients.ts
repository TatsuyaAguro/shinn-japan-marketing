'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { rowToClient } from '@/lib/supabase/types'
import type { ClientRow } from '@/lib/supabase/types'
import type { Client } from '@/lib/data'
import { CLIENTS } from '@/lib/data'

// ── 一覧取得 ──────────────────────────────────────────────────
export async function fetchClients(): Promise<Client[]> {
  if (!isSupabaseReady()) return CLIENTS

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return CLIENTS
  return (data as ClientRow[]).map(rowToClient)
}

// ── 1件取得 ──────────────────────────────────────────────────
export async function fetchClientById(id: string): Promise<Client | null> {
  if (!isSupabaseReady()) {
    return CLIENTS.find(c => c.id === id) ?? null
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return rowToClient(data as ClientRow)
}

// ── 新規作成 ──────────────────────────────────────────────────
export async function createClient(formData: FormData) {
  if (!isSupabaseReady()) {
    return { error: 'Supabaseが未設定です。.env.localを設定してください。' }
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase.from('clients').insert({
    name:              formData.get('name') as string,
    region:            formData.get('region') as string,
    category:          formData.get('category') as string,
    target_market:     formData.get('targetMarket') as string,
    tourist_resources: formData.get('touristResources') as string,
    budget:            formData.get('budget') as string,
    manager:           (formData.get('manager') as string) || user?.email?.split('@')[0] || '',
    status:            formData.get('status') as string || 'draft',
    description:       formData.get('description') as string,
    campaigns_count:   0,
    last_activity:     new Date().toISOString().slice(0, 10),
  }).select('id').single()

  if (error) return { error: error.message, id: null }

  revalidatePath('/home')
  return { error: null, id: data.id as string }
}

// ── 更新 ──────────────────────────────────────────────────────
export async function updateClient(id: string, fields: {
  name: string
  region: string
  category: string
  targetMarket: string
  touristResources: string
  budget: string
  manager: string
  status: string
  description: string
}) {
  if (!isSupabaseReady()) {
    return { error: 'Supabaseが未設定です。' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({
      name:              fields.name,
      region:            fields.region,
      category:          fields.category,
      target_market:     fields.targetMarket,
      tourist_resources: fields.touristResources,
      budget:            fields.budget,
      manager:           fields.manager,
      status:            fields.status,
      description:       fields.description,
      last_activity:     new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/home/${id}`)
  revalidatePath('/home')
  return { error: null }
}
