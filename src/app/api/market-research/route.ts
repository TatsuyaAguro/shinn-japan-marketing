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

  const { country, client } = await req.json()

  const prompt = `以下のクライアント情報と対象国に基づいて、訪日インバウンド観光に関する市場データを提供してください。

【クライアント情報】
- 地域: ${client.region}
- カテゴリ: ${client.category}
- 観光資源: ${client.touristResources}
- ターゲット市場: ${client.targetMarket}

【調査対象国】: ${country}

この国から${client.region}に訪れるインバウンド観光客について、具体的な数値データと特徴を教えてください。

以下のJSON形式のみで返してください（マークダウンのコードブロック不要）:
{
  "country": "${country}",
  "visitors": "年間訪問者数の目安（例: 約42,000人/年）",
  "avgStayDays": "平均滞在日数（例: 7.2日）",
  "avgSpend": "一人当たり平均消費額（例: ¥220,000）",
  "interests": ["興味・関心カテゴリ1", "興味・関心カテゴリ2", "興味・関心カテゴリ3", "興味・関心カテゴリ4"],
  "individualRate": "個人旅行比率（例: 68%）",
  "repeaterRate": "リピーター比率（例: 42%）",
  "searchKeywords": ["検索キーワード1", "検索キーワード2", "検索キーワード3", "検索キーワード4"]
}`

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
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[/api/market-research] Anthropic API error:', res.status, errText)
    return NextResponse.json({ error: `API エラー (${res.status}): ${errText}` }, { status: 500 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  try {
    const jsonText = raw.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const profile = JSON.parse(jsonText)
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json(
      { error: `レスポンスのパースに失敗しました: ${raw.text.slice(0, 300)}` },
      { status: 500 }
    )
  }
}
