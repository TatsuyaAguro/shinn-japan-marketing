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

  const { client, totalBudget, channels, market, season, currentResults } = await req.json()

  const channelSummary = (channels as Array<{
    id: string; label: string; allocation: number; cpm: number; cvr: number;
    revenue: number; roi: number; visitors: number
  }>)
    .map(c =>
      `- ${c.label}: 現配分${c.allocation}%, CPM¥${c.cpm.toLocaleString()}, CV率${(c.cvr * 100).toFixed(1)}%, 来訪者${c.visitors.toLocaleString()}人, 経済効果¥${c.revenue.toLocaleString()}, ROI${c.roi.toFixed(0)}%`
    )
    .join('\n')

  const prompt = `以下のクライアント情報と現在のROIシミュレーション結果をもとに、最適な予算配分を提案してください。

【クライアント情報】
- 名前: ${client.name}
- 地域: ${client.region}
- カテゴリ: ${client.category}
- ターゲット市場: ${client.targetMarket}
- 予算規模: ${client.budget}
- 観光資源: ${client.touristResources}

【シミュレーション設定】
- 総広告予算: ¥${Number(totalBudget).toLocaleString()}
- ターゲット市場: ${market}
- 訴求シーズン: ${season}

【現在の施策と成果】
${channelSummary}

【現在の合計成果（標準シナリオ）】
- 合計来訪者: ${currentResults.visitors?.toLocaleString()}人
- 合計経済効果: ¥${currentResults.revenue?.toLocaleString()}
- 全体ROI: ${currentResults.roi?.toFixed(1)}%

上記を踏まえ、ROIを最大化する最適な予算配分を提案してください。各施策の配分比率の合計は必ず100%にしてください。

以下のJSON形式のみで返してください（マークダウンのコードブロック不要）:
{
  "optimalAllocation": [
    {
      "channelId": "施策ID（sns/search/influencer/media/event のいずれか）",
      "allocation": 配分パーセント（整数）,
      "rationale": "この施策にこの配分を推奨する理由（1〜2文）"
    }
  ],
  "overallReasoning": "全体的な予算配分戦略の説明（3〜5文）",
  "expectedImprovement": "最適化による期待効果（例: +20%のROI改善が見込まれます）",
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
    console.error('[/api/roi-optimize] Anthropic API error:', res.status, errText)
    return NextResponse.json({ error: `API エラー (${res.status}): ${errText}` }, { status: 500 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  try {
    const jsonText = raw.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(jsonText)
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json(
      { error: `レスポンスのパースに失敗しました: ${raw.text.slice(0, 300)}` },
      { status: 500 }
    )
  }
}
