'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { revalidatePath } from 'next/cache'

export type ProjectDesignStatus = 'new' | 'hearing' | 'analysis' | 'feedback' | 'final' | 'confirmed'

export interface HearingAnswer {
  questionId: string
  selected: string[]
  freeText: string
  skipped: boolean
}

export interface Proposal {
  id: string
  title: string
  description: string
  platform: string
  timeline: string
  budgetEstimate: string
  estimatedEffect: string
  steps: string[]
}

export interface AnalysisReport {
  summary: string
  marketAnalysis: string
  proposals: Proposal[]
  version: number
  generatedAt: string
  feedbackHistory?: { feedback: string; version: number }[]
}

export interface ProjectDesignData {
  project_design_status: ProjectDesignStatus
  hearing_data: HearingAnswer[]
  analysis_report: AnalysisReport | null
  direction_summary: string
  selected_strategies: Proposal[]
}

export async function fetchProjectDesign(clientId: string): Promise<ProjectDesignData | null> {
  if (!isSupabaseReady()) return null
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('project_design_status, hearing_data, analysis_report, direction_summary, selected_strategies')
    .eq('id', clientId)
    .single()
  if (error || !data) return null
  return {
    project_design_status: (data.project_design_status as ProjectDesignStatus) ?? 'new',
    hearing_data: (data.hearing_data as HearingAnswer[]) ?? [],
    analysis_report: (data.analysis_report && Object.keys(data.analysis_report).length > 0
      ? data.analysis_report as AnalysisReport
      : null),
    direction_summary: data.direction_summary ?? '',
    selected_strategies: (data.selected_strategies as Proposal[]) ?? [],
  }
}

export async function saveHearingProgress(
  clientId: string,
  hearingData: HearingAnswer[],
  status: ProjectDesignStatus = 'hearing'
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({ hearing_data: hearingData, project_design_status: status })
    .eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/home/${clientId}`)
  return { error: null }
}

export async function saveAnalysisReport(
  clientId: string,
  report: AnalysisReport,
  status: ProjectDesignStatus = 'feedback'
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({ analysis_report: report, project_design_status: status })
    .eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/home/${clientId}`)
  return { error: null }
}

export async function saveFinalReport(
  clientId: string,
  report: AnalysisReport
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({ analysis_report: report, project_design_status: 'final' })
    .eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/home/${clientId}`)
  return { error: null }
}

export async function confirmProjectDesign(
  clientId: string,
  directionSummary: string,
  selectedStrategies: Proposal[]
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clients')
    .update({
      direction_summary: directionSummary,
      selected_strategies: selectedStrategies,
      project_design_status: 'confirmed',
    })
    .eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/home/${clientId}`)
  return { error: null }
}

export async function addSchedulesFromStrategies(
  clientId: string,
  strategies: Proposal[]
): Promise<{ error: string | null }> {
  if (!isSupabaseReady()) return { error: 'Supabaseが未設定です' }
  const supabase = await createServerClient()
  const today = new Date()
  const rows = strategies.map((s, i) => {
    const start = new Date(today)
    start.setDate(today.getDate() + i * 14)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    return {
      client_id: clientId,
      name: s.title,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      manager: '',
      status: 'proposed',
      memo: s.description,
      color: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'][i % 5],
      sort_order: i,
    }
  })
  const { error } = await supabase.from('schedules').insert(rows)
  if (error) return { error: error.message }
  revalidatePath(`/home/${clientId}`)
  return { error: null }
}
