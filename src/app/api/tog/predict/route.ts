import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { PREDICTION_SYSTEM_PROMPT } from '@/lib/tog-prompts'

export const runtime = 'nodejs'
export const maxDuration = 180

interface PastCaseInput {
  name: string
  organization?: string
  prefecture?: string
  budget?: number
  description?: string
  url?: string
  createdAt?: string
}

interface Step1Case {
  name: string
  issuer: string
  year: string
  amount: number
  timing: string
  fit: string
  fit_reason: string
  url?: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

  const { prefecture, organization, archiveCases, messages } = await req.json()
  if (!prefecture) return NextResponse.json({ error: '都道府県を指定してください' }, { status: 400 })

  const target = organization ? `${prefecture} ${organization}` : prefecture

  // DB内の過去案件データをコンテキストとして付与
  const dbContext = (archiveCases as PastCaseInput[] ?? []).length > 0
    ? `\n\n■ DB内の過去案件データ（${target}関連）：\n${JSON.stringify(
        (archiveCases as PastCaseInput[]).slice(0, 30).map(c => ({
          name: c.name,
          organization: c.organization,
          budget: c.budget,
          description: c.description?.slice(0, 100),
          url: c.url,
        })),
        null, 2
      )}`
    : ''

  let apiMessages: { role: string; content: string }[]

  if (messages && messages.length > 0) {
    apiMessages = messages
  } else {
    apiMessages = [{
      role: 'user',
      content: `${target}について、STEP 1〜4の手順で分析してください。${dbContext}`,
    }]
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 10000,
      system: PREDICTION_SYSTEM_PROMPT,
      messages: apiMessages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const text: string = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('')

  // JSON を抽出してパース
  let predictionData: Record<string, unknown> = {}
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      predictionData = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.warn('[tog/predict] JSON parse failed:', e)
  }

  // ── STEP 1で発見した過去案件をアーカイブに自動保存 ─────────────
  const savedToArchive: string[] = []
  const step1Cases = predictionData.step1_past_cases
  if (
    isSupabaseReady() &&
    Array.isArray(step1Cases) &&
    step1Cases.length > 0
  ) {
    try {
      const supabase = await createClient()
      for (const c of step1Cases as Step1Case[]) {
        const name = (c.name ?? '').trim()
        const issuer = (c.issuer ?? '').trim()
        if (!name) continue

        const { data: existing } = await supabase
          .from('tog_cases')
          .select('id')
          .eq('name', name)
          .eq('organization', issuer)
          .maybeSingle()

        if (existing) continue

        const { error } = await supabase.from('tog_cases').insert({
          name,
          organization: issuer,
          prefecture,
          category:    '',
          description: c.fit_reason ?? '',
          budget:      c.amount ?? 0,
          deadline:    null,
          url:         c.url ?? '',
          status:      'archive',
          ai_score:    c.fit === '◎' ? 5 : c.fit === '○' ? 4 : 3,
          ai_reason:   `先読みリサーチで発見（${c.year ?? ''}）: ${c.fit_reason ?? ''}`,
          ai_matching_services:    [],
          ai_action_recommendation: '',
        })
        if (!error) savedToArchive.push(name)
      }
    } catch (e) {
      console.error('[tog/predict] archive save error:', e)
    }
  }

  return NextResponse.json({ predictionData, raw: text, savedToArchive })
}
