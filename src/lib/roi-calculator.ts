// ============================================================
// ROI計算ライブラリ
// 全関数はピュアな計算のみ。デフォルト値は業界平均値ベース。
// ============================================================

export type ChannelType = 'instagram' | 'youtube' | 'influencer' | 'event' | 'other'

export interface ROIDefaults {
  // CPM（1,000インプレッション当たり広告費・円）
  instagramCPM: number   // 2500  Meta Business Suite 2025
  youtubeCPM: number     // 3000  Google Ads 2025
  influencerCPM: number  // 800   インフルエンサー施策（リーチ単価）
  eventCPM: number       // 1200  イベント・展示会
  otherCPM: number       // 2000
  // CTR（クリック率 0–1）
  instagramCTR: number   // 0.012  1.2%  HubSpot 2025
  youtubeCTR: number     // 0.008  0.8%
  influencerCTR: number  // 0.015  1.5%
  eventCTR: number       // 0.010  1.0%
  otherCTR: number       // 0.010
  // その他共通指標
  engagementRate: number    // 0.020  2.0%  観光業Instagram平均
  directCVR: number         // 0.020  2.0%  自社サイト直接
  otaCVR: number            // 0.040  4.0%  OTA経由
  frequency: number         // 3      平均接触回数
  noShowRate: number        // 0.050  5%    ノーショー率
  womMultiplier: number     // 2.3    口コミ乗数  TripAdvisor調査
  awarenessDecayRate: number // 0.050 月5%減衰
  repeatRate: number        // 0.070  7%    リピート率
  economicMultiplier: number // 1.400 地域経済波及乗数
  accommodationRate: number  // 0.600 60%宿泊率
}

export const DEFAULT_ROI_VALUES: ROIDefaults = {
  instagramCPM: 2500,
  youtubeCPM: 3000,
  influencerCPM: 800,
  eventCPM: 1200,
  otherCPM: 2000,
  instagramCTR: 0.012,
  youtubeCTR: 0.008,
  influencerCTR: 0.015,
  eventCTR: 0.010,
  otherCTR: 0.010,
  engagementRate: 0.020,
  directCVR: 0.020,
  otaCVR: 0.040,
  frequency: 3,
  noShowRate: 0.050,
  womMultiplier: 2.3,
  awarenessDecayRate: 0.050,
  repeatRate: 0.070,
  economicMultiplier: 1.4,
  accommodationRate: 0.6,
}

export interface SpendBreakdown {
  guideTour: number      // ガイドツアー代  ¥5,000
  experience: number    // 体験プログラム  ¥3,000
  food: number          // 食事代          ¥4,000
  shopping: number      // お土産・買物    ¥3,000
  accommodation: number // 宿泊代（1泊）   ¥20,000
}

export const DEFAULT_SPEND_BREAKDOWN: SpendBreakdown = {
  guideTour: 5000,
  experience: 3000,
  food: 4000,
  shopping: 3000,
  accommodation: 20000,
}

export interface StrategyROIInput {
  strategyId: string
  strategyName: string
  targetCountries: string[]
  budget: number          // 円
  channelType: ChannelType
  cvrType: 'direct' | 'ota'
  cpmOverride?: number
  ctrOverride?: number
  engagementRateOverride?: number
  cvrOverride?: number
}

export interface ROIScenario {
  label: '悲観' | '標準' | '楽観'
  colorKey: 'red' | 'blue' | 'green'
  multiplier: number
  visitors: number
  revenue: number
  roi: number
  roas: number
  cpa: number
}

export interface ROICalculationResult {
  strategyId: string
  strategyName: string
  targetCountries: string[]
  budget: number
  channelType: ChannelType
  // ファネル各ステップ
  impressions: number
  reach: number
  engagement: number
  siteVisits: number
  conversions: number
  visitors: number
  revenue: number
  // サマリー指標
  roi: number
  roas: number
  cpa: number
  breakevenVisitors: number
  scenarios: ROIScenario[]
  // 使用値（表示用）
  cpmUsed: number
  ctrUsed: number
  cvrUsed: number
  engagementRateUsed: number
  averageSpend: number
}

export interface IntangibleValues {
  womVisitors: number           // 口コミによる追加来訪者
  year2AwarenessRate: number    // 12ヶ月後の残存認知率(%)
  ltv3Year: number              // 初年度来訪者の3年間累計売上
  regionalEconomicEffect: number // 地域全体への経済波及効果
}

// ── 補助関数 ──────────────────────────────────────────────────

function getCPM(channelType: ChannelType, defaults: ROIDefaults, override?: number): number {
  if (override !== undefined) return override
  const key = `${channelType}CPM` as keyof ROIDefaults
  return defaults[key] as number
}

function getCTR(channelType: ChannelType, defaults: ROIDefaults, override?: number): number {
  if (override !== undefined) return override
  const key = `${channelType}CTR` as keyof ROIDefaults
  return defaults[key] as number
}

// ── ピュア計算関数 ────────────────────────────────────────────

export function calculateImpressions(budget: number, cpm: number): number {
  return cpm > 0 ? Math.floor((budget / cpm) * 1000) : 0
}

export function calculateReach(impressions: number, frequency: number): number {
  return frequency > 0 ? Math.floor(impressions / frequency) : 0
}

export function calculateEngagement(reach: number, engagementRate: number): number {
  return Math.floor(reach * engagementRate)
}

export function calculateSiteVisits(impressions: number, ctr: number): number {
  return Math.floor(impressions * ctr)
}

export function calculateConversions(siteVisits: number, cvr: number): number {
  return Math.floor(siteVisits * cvr)
}

export function calculateVisitors(conversions: number, noShowRate: number): number {
  return Math.floor(conversions * (1 - noShowRate))
}

export function calculateAverageSpend(breakdown: SpendBreakdown, accommodationRate: number): number {
  // 全来訪者：食事 + 買物 + 体験
  // 宿泊者（accommodationRate）：+ガイド + 宿泊
  return breakdown.food + breakdown.shopping + breakdown.experience +
    (breakdown.guideTour + breakdown.accommodation) * accommodationRate
}

export function calculateRevenue(visitors: number, avgSpend: number): number {
  return visitors * avgSpend
}

export function calculateROI(revenue: number, cost: number): number {
  if (cost === 0) return 0
  return ((revenue - cost) / cost) * 100
}

export function calculateCPA(cost: number, visitors: number): number {
  if (visitors === 0) return cost
  return Math.round(cost / visitors)
}

export function calculateROAS(revenue: number, cost: number): number {
  if (cost === 0) return 0
  return Math.round((revenue / cost) * 100) / 100
}

export function calculateBreakeven(cost: number, avgSpend: number): number {
  if (avgSpend === 0) return 0
  return Math.ceil(cost / avgSpend)
}

export function calculateLTV(
  firstYearVisitors: number,
  repeatRate: number,
  avgSpend: number,
  years = 3,
): number {
  let total = firstYearVisitors * avgSpend
  let current = firstYearVisitors
  for (let y = 1; y < years; y++) {
    current = Math.floor(current * repeatRate)
    total += current * avgSpend
  }
  return total
}

export function calculateWOMEffect(visitors: number, womMultiplier: number): number {
  return Math.floor(visitors * (womMultiplier - 1))
}

export function calculateAwarenessDecay(
  initialAwareness: number,
  decayRate: number,
  months: number,
): number {
  return Math.round(initialAwareness * Math.pow(1 - decayRate, months) * 10) / 10
}

export function calculateDiminishingReturns(
  standardBudget: number,
  defaults: ROIDefaults,
  input: StrategyROIInput,
  spendBreakdown: SpendBreakdown,
): { budget: number; roi: number }[] {
  const multipliers = [0.25, 0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0]
  const baseCPM = getCPM(input.channelType, defaults, input.cpmOverride)
  const baseCTR = getCTR(input.channelType, defaults, input.ctrOverride)
  const cvr = input.cvrOverride ?? (input.cvrType === 'ota' ? defaults.otaCVR : defaults.directCVR)
  const avgSpend = calculateAverageSpend(spendBreakdown, defaults.accommodationRate)

  return multipliers.map(mult => {
    const budget = standardBudget * mult
    const logRatio = budget > standardBudget ? Math.log2(budget / standardBudget) : 0
    // オークション競争でCPM上昇、高頻度でCTR低下
    const effectiveCPM = baseCPM * (1 + 0.28 * logRatio)
    const effectiveCTR = Math.max(baseCTR * (1 - 0.12 * logRatio), 0.001)

    const impressions = calculateImpressions(budget, effectiveCPM)
    const siteVisits = calculateSiteVisits(impressions, effectiveCTR)
    const conversions = calculateConversions(siteVisits, cvr)
    const visitors = calculateVisitors(conversions, defaults.noShowRate)
    const revenue = calculateRevenue(visitors, avgSpend)
    return { budget: Math.round(budget), roi: Math.round(calculateROI(revenue, budget) * 10) / 10 }
  })
}

// ── メイン計算関数 ────────────────────────────────────────────

export function calculateSingleStrategyROI(
  input: StrategyROIInput,
  defaults: ROIDefaults,
  spendBreakdown: SpendBreakdown,
): ROICalculationResult {
  const cpm = getCPM(input.channelType, defaults, input.cpmOverride)
  const ctr = getCTR(input.channelType, defaults, input.ctrOverride)
  const cvr = input.cvrOverride ?? (input.cvrType === 'ota' ? defaults.otaCVR : defaults.directCVR)
  const engagementRate = input.engagementRateOverride ?? defaults.engagementRate
  const avgSpend = calculateAverageSpend(spendBreakdown, defaults.accommodationRate)

  const impressions = calculateImpressions(input.budget, cpm)
  const reach       = calculateReach(impressions, defaults.frequency)
  const engagement  = calculateEngagement(reach, engagementRate)
  const siteVisits  = calculateSiteVisits(impressions, ctr)
  const conversions = calculateConversions(siteVisits, cvr)
  const visitors    = calculateVisitors(conversions, defaults.noShowRate)
  const revenue     = calculateRevenue(visitors, avgSpend)
  const roi         = calculateROI(revenue, input.budget)
  const roas        = calculateROAS(revenue, input.budget)
  const cpa         = calculateCPA(input.budget, visitors)
  const breakevenVisitors = calculateBreakeven(input.budget, avgSpend)

  const SCENARIO_DEFS: [ROIScenario['label'], ROIScenario['colorKey'], number][] = [
    ['悲観', 'red',   0.7],
    ['標準', 'blue',  1.0],
    ['楽観', 'green', 1.3],
  ]
  const scenarios: ROIScenario[] = SCENARIO_DEFS.map(([label, colorKey, mult]) => {
    const sv = Math.floor(visitors * mult)
    const sr = calculateRevenue(sv, avgSpend)
    return {
      label, colorKey, multiplier: mult,
      visitors: sv,
      revenue: sr,
      roi: Math.round(calculateROI(sr, input.budget) * 10) / 10,
      roas: calculateROAS(sr, input.budget),
      cpa: calculateCPA(input.budget, sv),
    }
  })

  return {
    strategyId: input.strategyId,
    strategyName: input.strategyName,
    targetCountries: input.targetCountries,
    budget: input.budget,
    channelType: input.channelType,
    impressions, reach, engagement, siteVisits, conversions, visitors, revenue,
    roi: Math.round(roi * 10) / 10,
    roas, cpa, breakevenVisitors, scenarios,
    cpmUsed: cpm, ctrUsed: ctr, cvrUsed: cvr,
    engagementRateUsed: engagementRate,
    averageSpend: avgSpend,
  }
}

export function calculateIntangibleValues(
  totalVisitors: number,
  defaults: ROIDefaults,
  spendBreakdown: SpendBreakdown,
): IntangibleValues {
  const avgSpend = calculateAverageSpend(spendBreakdown, defaults.accommodationRate)
  return {
    womVisitors: calculateWOMEffect(totalVisitors, defaults.womMultiplier),
    year2AwarenessRate: calculateAwarenessDecay(100, defaults.awarenessDecayRate, 12),
    ltv3Year: calculateLTV(totalVisitors, defaults.repeatRate, avgSpend, 3),
    regionalEconomicEffect: Math.round(
      calculateRevenue(totalVisitors, avgSpend) * defaults.economicMultiplier
    ),
  }
}

// ── ユーティリティ ────────────────────────────────────────────

export function inferChannelType(name: string, description: string): ChannelType {
  const text = `${name} ${description}`.toLowerCase()
  if (/youtube|ユーチューブ/.test(text)) return 'youtube'
  if (/インフルエンサー|influencer/.test(text)) return 'influencer'
  if (/イベント|event|展示会|説明会/.test(text)) return 'event'
  return 'instagram'
}

export function inferCVRType(name: string, description: string): 'direct' | 'ota' {
  const text = `${name} ${description}`.toLowerCase()
  if (/ota|旅行サイト|booking|じゃらん|expedia/.test(text)) return 'ota'
  return 'direct'
}

export function parseBudgetToYen(recommendedBudget: string): number {
  const m = recommendedBudget?.match(/[\d,]+/)
  if (!m) return 5000000
  return parseInt(m[0].replace(/,/g, '')) * 10000
}

export function formatJPY(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}
