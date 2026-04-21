import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはSHINN JAPANの観光インバウンドマーケティング専門家です。
クライアントの観光資源、ターゲット市場、予算を踏まえて、戦略的なアドバイスを行います。
一方的に答えを出すのではなく、チームの意見を聞きながら方向性を一緒に固めていく対話型で進めてください。
不足している情報があれば積極的に深掘りヒアリングしてください。`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。' },
      { status: 500 }
    )
  }

  let messages: { role: string; content: string }[], client: Record<string, string>
  try {
    const body = await req.json()
    messages = body.messages
    client = body.client
  } catch {
    return NextResponse.json({ error: 'リクエストのパースに失敗しました' }, { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages が空です' }, { status: 400 })
  }

  const systemWithContext = `${SYSTEM_PROMPT}

【現在のクライアント情報】
- 名前: ${client.name ?? ''}
- 地域: ${client.region ?? ''}
- カテゴリ: ${client.category ?? ''}
- ターゲット市場: ${client.targetMarket ?? ''}
- 予算: ${client.budget ?? ''}
- 観光資源: ${client.touristResources ?? ''}
- 説明: ${client.description ?? ''}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemWithContext,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[/api/chat] Anthropic API error:', res.status, errText)
    return NextResponse.json(
      { error: `Anthropic API エラー (${res.status}): ${errText}` },
      { status: 500 }
    )
  }

  const data = await res.json() as {
    content: { type: string; text: string }[]
  }
  const content = data.content?.[0]
  if (!content || content.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  return NextResponse.json({ content: content.text })
}
