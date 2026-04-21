import { NextRequest, NextResponse } from 'next/server'
import { SCREENING_SYSTEM_PROMPT, buildScoringPrompt } from '@/lib/tog-prompts'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

interface ScoreResult {
  score: number
  reason: string
  matching_services: string[]
  action_recommendation: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
  }

  const body = await req.json()
  const { cases, updateIds } = body as {
    cases: { name: string; organization: string; description: string; category: string }[]
    updateIds?: string[] // DB の ID 配列（スコア更新する場合）
  }

  if (!Array.isArray(cases) || cases.length === 0) {
    return NextResponse.json({ scores: [] })
  }

  const userMessage = buildScoringPrompt(cases)

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: SCREENING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    console.error('[tog/score] Anthropic API error:', errText)
    return NextResponse.json(
      { error: `AI API エラー: ${aiRes.status} ${errText.slice(0, 300)}`, scores: [] },
      { status: 500 },
    )
  }

  const aiData = await aiRes.json()
  const text: string = (aiData.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('')

  // JSON 配列をパース
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  let scores: ScoreResult[] = []

  if (start !== -1 && end > start) {
    try {
      scores = JSON.parse(text.slice(start, end + 1))
    } catch (e) {
      console.error('[tog/score] JSON parse error:', e)
      return NextResponse.json({ scores: [], raw: text })
    }
  }

  // ── updateIds が渡された場合は DB も更新 ─────────────────────
  let updatedCount = 0
  if (isSupabaseReady() && updateIds && updateIds.length > 0) {
    const supabase = await createClient()
    for (let i = 0; i < updateIds.length; i++) {
      const id = updateIds[i]
      const s = scores[i]
      if (!id || !s) continue

      const score = Math.min(5, Math.max(0, Number(s.score ?? 0)))
      if (score < 3) {
        // スコア 3 未満はステータスを passed に変更
        await supabase.from('tog_cases').update({ status: 'passed', ai_score: score }).eq('id', id)
      } else {
        await supabase.from('tog_cases').update({
          ai_score:                score,
          ai_reason:               String(s.reason ?? ''),
          ai_matching_services:    Array.isArray(s.matching_services) ? s.matching_services : [],
          ai_action_recommendation: String(s.action_recommendation ?? ''),
        }).eq('id', id)
      }
      updatedCount++
    }
  }

  return NextResponse.json({ scores, updatedCount, raw: text })
}
