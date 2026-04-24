'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { TogCase, TogPrediction, TogStatus } from '@/lib/types/tog'

// ── DB行 → TogCase 変換 ──────────────────────────────────────
function rowToCase(r: Record<string, unknown>): TogCase {
  return {
    id:                      r.id as string,
    name:                    r.name as string,
    organization:            (r.organization as string) ?? '',
    prefecture:              (r.prefecture as string) ?? '',
    category:                (r.category as string) ?? '',
    description:             (r.description as string) ?? '',
    budget:                  r.budget !== null && r.budget !== undefined ? Number(r.budget) : null,
    budgetNote:              (r.budget_note as string) ?? null,
    deadline:                (r.deadline as string) ?? null,
    deadlineNote:            (r.deadline_note as string) ?? null,
    recruitmentDate:         (r.recruitment_date as string) ?? '',
    winner:                  (r.winner as string) ?? '',
    url:                     (r.url as string) ?? '',
    urlSourceType:           (r.url_source_type as string) ?? null,
    status:                  (r.status as TogStatus) ?? 'new',
    priority:                (r.priority as string) ?? '',
    aiScore:                 (Number(r.ai_score) ?? 0) as TogCase['aiScore'],
    aiReason:                (r.ai_reason as string) ?? '',
    aiMatchingServices:      (r.ai_matching_services as string[]) ?? [],
    aiActionRecommendation:  (r.ai_action_recommendation as string) ?? '',
    analysisData:            (r.analysis_data as Record<string, unknown>) ?? {},
    predictionData:          (r.prediction_data as Record<string, unknown>) ?? {},
    gdriveLink:              (r.gdrive_link as string) ?? '',
    memo:                    (r.memo as string) ?? '',
    assignedTo:              (r.assigned_to as string) ?? '',
    linkedClientId:          (r.linked_client_id as string) ?? null,
    statusHistory:           (r.status_history as TogCase['statusHistory']) ?? [],
    uploadedFiles:           (r.uploaded_files as TogCase['uploadedFiles']) ?? [],
    createdAt:               r.created_at as string,
    updatedAt:               r.updated_at as string,
  }
}

function rowToPrediction(r: Record<string, unknown>): TogPrediction {
  return {
    id:             r.id as string,
    prefecture:     r.prefecture as string,
    organization:   (r.organization as string) ?? '',
    predictionData: (r.prediction_data as Record<string, unknown>) ?? {},
    chatMessages:   (r.chat_messages as TogPrediction['chatMessages']) ?? [],
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  }
}

// ── 案件取得 ─────────────────────────────────────────────────

export async function fetchTogCases(filter?: {
  status?: TogStatus | TogStatus[]
  minScore?: number
}): Promise<TogCase[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createClient()
  let query = supabase.from('tog_cases').select('*').order('ai_score', { ascending: false }).order('created_at', { ascending: false })

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    query = query.in('status', statuses)
  }
  if (filter?.minScore !== undefined) {
    query = query.gte('ai_score', filter.minScore)
  }

  const { data } = await query
  return (data ?? []).map(r => rowToCase(r as Record<string, unknown>))
}

export async function fetchTogCase(id: string): Promise<TogCase | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()
  const { data } = await supabase.from('tog_cases').select('*').eq('id', id).single()
  if (!data) return null
  return rowToCase(data as Record<string, unknown>)
}

// ── 案件作成・更新 ───────────────────────────────────────────

export async function upsertTogCase(input: Partial<TogCase> & { id?: string }): Promise<TogCase | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()

  const row: Record<string, unknown> = {}
  if (input.id)                        row.id = input.id
  if (input.name !== undefined)        row.name = input.name
  if (input.organization !== undefined) row.organization = input.organization
  if (input.prefecture !== undefined)  row.prefecture = input.prefecture
  if (input.category !== undefined)    row.category = input.category
  if (input.description !== undefined) row.description = input.description
  if (input.budget !== undefined)      row.budget = input.budget
  if (input.budgetNote !== undefined)  row.budget_note = input.budgetNote
  if (input.deadline !== undefined)    row.deadline = input.deadline
  if (input.deadlineNote !== undefined) row.deadline_note = input.deadlineNote
  if (input.recruitmentDate !== undefined) row.recruitment_date = input.recruitmentDate
  if (input.winner !== undefined)      row.winner = input.winner
  if (input.url !== undefined)         row.url = input.url
  if (input.urlSourceType !== undefined) row.url_source_type = input.urlSourceType
  if (input.status !== undefined)      row.status = input.status
  if (input.priority !== undefined)    row.priority = input.priority
  if (input.aiScore !== undefined)     row.ai_score = input.aiScore
  if (input.aiReason !== undefined)    row.ai_reason = input.aiReason
  if (input.aiMatchingServices !== undefined) row.ai_matching_services = input.aiMatchingServices
  if (input.aiActionRecommendation !== undefined) row.ai_action_recommendation = input.aiActionRecommendation
  if (input.analysisData !== undefined) row.analysis_data = input.analysisData
  if (input.gdriveLink !== undefined)  row.gdrive_link = input.gdriveLink
  if (input.memo !== undefined)        row.memo = input.memo
  if (input.assignedTo !== undefined)  row.assigned_to = input.assignedTo
  if (input.linkedClientId !== undefined) row.linked_client_id = input.linkedClientId
  if (input.statusHistory !== undefined)  row.status_history = input.statusHistory
  if (input.uploadedFiles !== undefined)  row.uploaded_files = input.uploadedFiles

  const { data } = await supabase
    .from('tog_cases')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (!data) return null
  return rowToCase(data as Record<string, unknown>)
}

export async function updateTogCaseStatus(
  id: string,
  status: TogStatus,
  note?: string,
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()

  // 現在のステータス履歴を取得して追記
  const { data: current } = await supabase
    .from('tog_cases')
    .select('status_history')
    .eq('id', id)
    .single()

  const history = ((current?.status_history as TogCase['statusHistory']) ?? [])
  history.push({ status, date: new Date().toISOString().slice(0, 10), note })

  await supabase
    .from('tog_cases')
    .update({ status, status_history: history })
    .eq('id', id)
}

export async function patchTogCase(
  id: string,
  patch: Partial<{
    name: string; organization: string; prefecture: string; category: string
    description: string; budget: number; deadline: string | null
    recruitment_date: string; winner: string; url: string; gdrive_link: string
    memo: string; assigned_to: string; analysis_data: Record<string, unknown>
    uploaded_files: TogCase['uploadedFiles']
  }>,
): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase.from('tog_cases').update(patch).eq('id', id)
}

export async function deleteTogCase(id: string): Promise<void> {
  if (!isSupabaseReady()) return
  const supabase = await createClient()
  await supabase.from('tog_cases').delete().eq('id', id)
}

// ── バルク登録（CSVインポート用）───────────────────────────

export async function bulkInsertTogCases(
  cases: Omit<Partial<TogCase>, 'id'>[],
): Promise<{ success: number; errors: number }> {
  if (!isSupabaseReady()) return { success: 0, errors: cases.length }
  const supabase = await createClient()

  let success = 0
  let errors = 0

  const rows = cases.map(c => ({
    name:             c.name ?? '（案件名未入力）',
    organization:     c.organization ?? '',
    prefecture:       c.prefecture ?? '',
    category:         c.category ?? '',
    description:      c.description ?? '',
    budget:           c.budget ?? 0,
    deadline:         c.deadline ?? null,
    recruitment_date: c.recruitmentDate ?? '',
    winner:           c.winner ?? '',
    status:           (c.winner ? 'archive' : 'new') as TogStatus,
    ai_score:         0,
  }))

  // 50件ずつ分割してInsert
  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from('tog_cases').insert(chunk)
    if (error) errors += chunk.length
    else success += chunk.length
  }

  return { success, errors }
}

// ── 未来予測 ─────────────────────────────────────────────────

export async function fetchTogPredictions(): Promise<TogPrediction[]> {
  if (!isSupabaseReady()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('tog_predictions')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []).map(r => rowToPrediction(r as Record<string, unknown>))
}

export async function saveTogPrediction(input: Partial<TogPrediction>): Promise<TogPrediction | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()
  const row: Record<string, unknown> = {
    prefecture:      input.prefecture ?? '',
    organization:    input.organization ?? '',
    prediction_data: input.predictionData ?? {},
    chat_messages:   input.chatMessages ?? [],
  }
  if (input.id) row.id = input.id

  const { data } = await supabase
    .from('tog_predictions')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (!data) return null
  return rowToPrediction(data as Record<string, unknown>)
}

// ── クライアント自動登録（採択時）────────────────────────────

export async function createClientFromTogCase(togCaseId: string): Promise<string | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createClient()

  const togCase = await fetchTogCase(togCaseId)
  if (!togCase) {
    console.error('[createClientFromTogCase] togCase not found:', togCaseId)
    return null
  }

  // schema.sql に存在するカラムのみ INSERT（マイグレーション追加列は除外）
  const { data: client, error: insertError } = await supabase
    .from('clients')
    .insert({
      name:             togCase.organization || togCase.name,
      region:           togCase.prefecture,
      category:         '自治体',
      target_market:    '欧米豪',
      tourist_resources: '',
      budget:           (togCase.budget ?? 0) > 0 ? `${Math.round((togCase.budget ?? 0) / 10000)}万円` : '未定',
      manager:          togCase.assignedTo || '',
      status:           'active',
      description:      togCase.description,
      campaigns_count:  0,
      last_activity:    new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createClientFromTogCase] insert error:', insertError.message, '| code:', insertError.code, '| details:', insertError.details)
    return null
  }
  if (!client) {
    console.error('[createClientFromTogCase] insert returned no data for togCaseId:', togCaseId)
    return null
  }

  // tog_cases にリンク
  const { error: linkError } = await supabase
    .from('tog_cases')
    .update({ linked_client_id: client.id })
    .eq('id', togCaseId)

  if (linkError) {
    console.error('[createClientFromTogCase] link error:', linkError.message)
    // クライアントは作成済みなので id は返す
  }

  return client.id
}

// ── 統計（ダッシュボード用）──────────────────────────────────

export async function fetchTogStats(): Promise<{
  totalNew: number
  totalActive: number
  totalApplied: number
  totalAccepted: number
  totalBudgetApplied: number
  totalBudgetAccepted: number
  acceptanceRate: number
  byPrefecture: { prefecture: string; count: number }[]
  byCategory: { category: string; count: number }[]
  byMonth: { month: string; applied: number; accepted: number }[]
  urgentCases: TogCase[]
  recentCases: TogCase[]
}> {
  if (!isSupabaseReady()) {
    return {
      totalNew: 0, totalActive: 0, totalApplied: 0, totalAccepted: 0,
      totalBudgetApplied: 0, totalBudgetAccepted: 0, acceptanceRate: 0,
      byPrefecture: [], byCategory: [], byMonth: [], urgentCases: [], recentCases: [],
    }
  }
  const supabase = await createClient()
  const { data: all } = await supabase.from('tog_cases').select('*')
  const cases = (all ?? []).map(r => rowToCase(r as Record<string, unknown>))

  const totalNew      = cases.filter(c => c.status === 'new').length
  const totalActive   = cases.filter(c => ['considering','preparing','applied','waiting'].includes(c.status)).length
  const applied       = cases.filter(c => ['applied','waiting','accepted','rejected'].includes(c.status))
  const accepted      = cases.filter(c => c.status === 'accepted')
  const totalApplied  = applied.length
  const totalAccepted = accepted.length
  const totalBudgetApplied  = applied.reduce((s, c) => s + (c.budget ?? 0), 0)
  const totalBudgetAccepted = accepted.reduce((s, c) => s + (c.budget ?? 0), 0)
  const acceptanceRate = totalApplied > 0 ? Math.round((totalAccepted / totalApplied) * 100) : 0

  // 都道府県別
  const prefMap: Record<string, number> = {}
  cases.forEach(c => { if (c.prefecture) prefMap[c.prefecture] = (prefMap[c.prefecture] ?? 0) + 1 })
  const byPrefecture = Object.entries(prefMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([prefecture, count]) => ({ prefecture, count }))

  // 案件種類別
  const catMap: Record<string, number> = {}
  cases.forEach(c => { if (c.category) catMap[c.category] = (catMap[c.category] ?? 0) + 1 })
  const byCategory = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }))

  // 月別
  const monthMap: Record<string, { applied: number; accepted: number }> = {}
  cases.forEach(c => {
    const month = c.createdAt?.slice(0, 7) ?? ''
    if (!month) return
    if (!monthMap[month]) monthMap[month] = { applied: 0, accepted: 0 }
    if (['applied','waiting','accepted','rejected'].includes(c.status)) monthMap[month].applied++
    if (c.status === 'accepted') monthMap[month].accepted++
  })
  const byMonth = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, v]) => ({ month, ...v }))

  // 締切が近い案件（7日以内）
  const now = new Date()
  const urgentCases = cases
    .filter(c => {
      if (!c.deadline || !['new','considering','preparing'].includes(c.status)) return false
      const d = new Date(c.deadline)
      return d > now && (d.getTime() - now.getTime()) < 7 * 86400000
    })
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 5)

  // 最近追加された案件
  const recentCases = cases
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return {
    totalNew, totalActive, totalApplied, totalAccepted,
    totalBudgetApplied, totalBudgetAccepted, acceptanceRate,
    byPrefecture, byCategory, byMonth, urgentCases, recentCases,
  }
}
