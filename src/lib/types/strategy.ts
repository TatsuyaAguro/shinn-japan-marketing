// ============================================================
// AI戦略室 共有型定義
// ============================================================

export type ResourceCategory =
  | '景観・文化遺産'
  | '食'
  | '体験・アクティビティ'
  | '宿泊'
  | '工芸'
  | '自然'
  | 'イベント'

export const CATEGORY_META: Record<ResourceCategory, { icon: string; color: string }> = {
  '景観・文化遺産': { icon: '🏛️', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  '食':             { icon: '🍱', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  '体験・アクティビティ': { icon: '🎯', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  '宿泊':           { icon: '🏨', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  '工芸':           { icon: '🎨', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  '自然':           { icon: '🌿', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'イベント':       { icon: '🎉', color: 'bg-pink-50 text-pink-700 border-pink-200' },
}

export interface TouristResource {
  id: string
  name: string
  category: ResourceCategory
  description: string
  uniquenessScore: number // 1–5
}

export interface MarketMatrix {
  resources: string[]   // ordered list of resource names
  countries: string[]   // ordered list of country names
  scores: number[][]    // scores[resourceIndex][countryIndex] = 0–100
  searchTrends: {
    resourceName: string
    data: { month: string; value: number }[]
  }[]
  socialMentions: { resourceName: string; count: number }[]
  successCases: {
    region: string
    description: string
    result: string
  }[]
  competitorAnalysis: {
    name: string
    strengths: string
    weaknesses: string
    differentiation: string
  }[]
  dataSources: string[]  // e.g. ["Google Trends", "JTB調査", "Instagram"]
}

export interface BrandingStory {
  catchphrase: string  // ≤25 chars
  story: string        // 3–4 sentences
  rationale: string    // why this works — references data
  winningPoints: {
    point: string
    evidence: string
  }[]
}

export interface StrategyItem {
  id: string
  name: string
  description: string
  targetCountries: string[]
  estimatedEffect: string
  recommendedBudget: string
  duration: string
  selected: boolean
}

export interface StrategyData {
  version: number
  touristResources: TouristResource[]
  marketMatrix: MarketMatrix
  brandingStory: BrandingStory
  strategies: StrategyItem[]
  directionSummary: string
  lastUpdated: string
}

export interface StrategyVersion {
  version: number
  createdAt: string
  label: string  // e.g. "v1 初回分析"
  feedback?: string
  data: StrategyData
}

export interface StrategyMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  storagePath: string   // Supabase Storage path (may be empty in demo mode)
  extractedText: string // parsed content (trimmed to 8000 chars)
  uploadedAt: string
}
