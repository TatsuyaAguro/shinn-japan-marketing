import { NextRequest, NextResponse } from 'next/server'
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/tog-prompts'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

  const { togCase, messages } = await req.json()
  if (!togCase) return NextResponse.json({ error: '案件情報が必要です' }, { status: 400 })

  const caseContext = `
案件名：${togCase.name}
公示元：${togCase.organization}
都道府県：${togCase.prefecture}
案件種類：${togCase.category}
業務概要：${togCase.description}
提案上限額：${togCase.budget ? `${togCase.budget.toLocaleString()}円` : '不明'}
締切日：${togCase.deadline ?? '不明'}
URL：${togCase.url ?? ''}
`

  const apiMessages = messages ?? [{
    role: 'user',
    content: `以下の案件について分析してください。\n${caseContext}`,
  }]

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
      max_tokens: 6000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: apiMessages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('')

  return NextResponse.json({ analysis: text })
}
