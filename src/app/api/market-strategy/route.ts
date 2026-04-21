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

  const { client, countryProfiles, fieldInsights } = await req.json()

  const profileSummary = (countryProfiles as Array<{
    country: string; visitors: string; avgStayDays: string; avgSpend: string;
    interests: string[]; individualRate: string; repeaterRate: string; searchKeywords: string[]
  }>)
    .map(p =>
      `- ${p.country}: 訪問者${p.visitors}, 滞在${p.avgStayDays}, 消費${p.avgSpend}, 個人旅行${p.individualRate}, リピーター${p.repeaterRate}\n  興味: ${p.interests?.join(' / ')}\n  検索KW: ${p.searchKeywords?.join(', ')}`
    )
    .join('\n')

  const prompt = `以下の情報をもとに、インバウンドマーケティング戦略を詳細に提案してください。

【クライアント情報】
- 名前: ${client.name}
- 地域: ${client.region}
- カテゴリ: ${client.category}
- ターゲット市場: ${client.targetMarket}
- 予算規模: ${client.budget}
- 観光資源: ${client.touristResources}
- 概要: ${client.description}

【市場データ（国別プロファイル）】
${profileSummary || '（データなし）'}

【現場インサイト・チームの気づき】
${fieldInsights || '（未入力）'}

上記の情報を総合的に分析し、実践的な戦略を提案してください。

以下のJSON形式のみで返してください（マークダウンのコードブロック不要）:
{
  "strengths": [
    "このクライアントの強み・差別化ポイント1",
    "強み2",
    "強み3"
  ],
  "countryApproaches": [
    {
      "country": "国名",
      "approach": "この国のターゲット向けの具体的アプローチ（2〜3文）"
    }
  ],
  "proposals": [
    {
      "title": "施策タイトル（15文字以内）",
      "detail": "施策の具体的内容と期待効果（2〜3文）"
    }
  ],
  "risks": [
    "リスク・課題・注意点1",
    "リスク・課題2",
    "リスク・課題3"
  ],
  "generatedAt": "${new Date().toISOString()}"
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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[/api/market-strategy] Anthropic API error:', res.status, errText)
    return NextResponse.json({ error: `API エラー (${res.status}): ${errText}` }, { status: 500 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  try {
    const jsonText = raw.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const strategy = JSON.parse(jsonText)
    return NextResponse.json({ strategy })
  } catch {
    return NextResponse.json(
      { error: `レスポンスのパースに失敗しました: ${raw.text.slice(0, 300)}` },
      { status: 500 }
    )
  }
}
