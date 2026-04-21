import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。' },
      { status: 500 }
    )
  }

  const { client, fiscalYear } = await req.json()
  const fy = fiscalYear as number

  const prompt = `以下のクライアント情報をもとに、${fy}年4月から${fy + 1}年3月までの1年間の観光インバウンドマーケティング施策スケジュールを提案してください。

【クライアント情報】
- 名前: ${client.name}
- 地域: ${client.region}
- カテゴリ: ${client.category}
- ターゲット市場: ${client.targetMarket}
- 予算: ${client.budget}
- 観光資源: ${client.touristResources}
- 概要: ${client.description}

施策は6〜8個提案してください。季節性・ターゲット市場の特性・観光資源を踏まえ、実行可能なマーケティングカレンダーとして機能するようにしてください。

以下のJSON配列形式のみで返してください（マークダウンのコードブロック不要）:
[
  {
    "name": "施策名（10文字以内で簡潔に）",
    "start_date": "${fy}-04-01",
    "end_date": "${fy}-04-30",
    "manager": "",
    "memo": "施策の目的・概要（1〜2文）",
    "color": "#3b82f6"
  }
]

色の選び方:
- #3b82f6（ブルー）: SNS・デジタルマーケティング
- #10b981（グリーン）: ツアー・体験プログラム
- #f59e0b（オレンジ）: 視察・調査・ヒアリング
- #8b5cf6（パープル）: 広報・プレスリリース・メディア
- #ec4899（ピンク）: パートナー連携・商談
- #14b8a6（ティール）: コンテンツ制作・素材撮影`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[/api/schedule-propose] Anthropic API error:', res.status, errText)
    return NextResponse.json({ error: `API エラー (${res.status}): ${errText}` }, { status: 500 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  try {
    const jsonText = raw.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const schedules = JSON.parse(jsonText)
    return NextResponse.json({ schedules })
  } catch {
    return NextResponse.json(
      { error: `レスポンスのパースに失敗しました: ${raw.text.slice(0, 300)}` },
      { status: 500 }
    )
  }
}
