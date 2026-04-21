// Supabase DB の行型定義 (snake_case)
export type ClientStatus = 'active' | 'inactive' | 'draft'

export interface ClientRow {
  id: string
  name: string
  region: string
  category: string
  target_market: string
  tourist_resources: string
  budget: string
  manager: string
  status: ClientStatus
  description: string
  campaigns_count: number
  last_activity: string
  strategy_data: Record<string, unknown> | null
  branding_story: string | null
  direction_summary: string | null
  confirmed_strategies: Record<string, unknown>[] | null
  share_token: string | null
  strategy_status: 'initial' | 'hearing' | 'analyzing' | 'confirmed'
  strategy_versions: Record<string, unknown>[] | null
  uploaded_files: Record<string, unknown>[] | null
  roi_chat_messages: Record<string, unknown>[] | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  client_id: string
  name: string
  storage_path: string
  size_bytes: number
  file_type: string
  uploaded_by: string
  created_at: string
}

export interface CommentRow {
  id: string
  client_id: string
  user_name: string
  content: string
  created_at: string
}

export interface ChatMessageRow {
  id: string
  client_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type ScheduleStatus = 'pending' | 'in_progress' | 'completed' | 'proposed'
export type ScheduleCategory = 'sns' | 'tour' | 'research' | 'pr' | 'partner' | 'content' | 'milestone' | 'other'

export interface ScheduleRow {
  id: string
  client_id: string
  name: string
  start_date: string
  end_date: string
  manager: string
  status: ScheduleStatus
  category: ScheduleCategory
  memo: string
  color: string
  sort_order: number
  budget_allocation: number
  is_ai_suggested: boolean
  source_strategy_id: string
  created_at: string
  updated_at: string
}

export interface ProposalRow {
  id: string
  client_id: string
  file_name: string
  storage_path: string
  format: 'pdf' | 'pptx'
  status: 'draft' | 'delivered'
  size_bytes: number
  created_at: string
}

// ClientRow → アプリ内の Client 型へ変換
import type { Client } from '@/lib/data'

export function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    category: row.category,
    targetMarket: row.target_market,
    status: row.status,
    campaigns: row.campaigns_count,
    lastActivity: row.last_activity ?? new Date().toISOString().slice(0, 10),
    touristResources: row.tourist_resources ?? '',
    budget: row.budget ?? '未定',
    manager: row.manager ?? '',
    description: row.description ?? '',
  }
}

export function clientToRow(client: Omit<Client, 'id'>): Omit<ClientRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: client.name,
    region: client.region,
    category: client.category,
    target_market: client.targetMarket,
    tourist_resources: client.touristResources,
    budget: client.budget,
    manager: client.manager,
    status: client.status,
    description: client.description,
    campaigns_count: client.campaigns,
    last_activity: client.lastActivity,
    strategy_data: null,
    branding_story: null,
    direction_summary: null,
    confirmed_strategies: null,
    share_token: null,
    strategy_status: 'initial',
    strategy_versions: null,
    uploaded_files: null,
    roi_chat_messages: null,
  }
}
