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

  const { messages, client, businessModel, products, channels, monthlyBudget, confirmedStrategies } = await req.json()

  const productsText = (products as Array<{
    name: string; price: number; capacityPerSession: number
    maxSessionsPerMonth: number; currentMonthlyBookings: number
  }>).map(p =>
    `- ${p.name || '（商品名未入力）'}: 単価¥${p.price.toLocaleString()}, 定員${p.capacityPerSession}名/回, 月最大${p.maxSessionsPerMonth}回, 現予約数${p.currentMonthlyBookings}人`
  ).join('\n')

  const channelsText = (channels as Array<{
    label: string; percentage: number; commissionRate: number; cvr: number
  }>).map(c =>
    `- ${c.label}: ${c.percentage}%, 手数料${c.commissionRate}%, CVR${c.cvr}%`
  ).join('\n')

  const confirmedText = (confirmedStrategies as Array<{ title: string; platform: string; contentType: string; budget: number }>).length > 0
    ? (confirmedStrategies as Array<{ title: string; platform: string; contentType: string; budget: number }>).map(s =>
        `- ${s.title}: ${s.platform} ${s.contentType}, 予算¥${s.budget.toLocaleString()}`
      ).join('\n')
    : '（まだなし）'

  const systemPrompt = `あなたはインバウンド観光に特化したマーケティングROIコンサルタントです。以下のクライアント情報を踏まえて、具体的・実践的なマーケティング戦略を提案し、ROIを一緒に試算してください。

【クライアント情報】
名前: ${client.name}
地域: ${client.region}
カテゴリ: ${client.category}
ターゲット市場: ${client.targetMarket}
観光資源: ${client.touristResources}
ビジネスモデル: ${businessModel}

【商品・サービス】
${productsText || '（未入力）'}

【予約経路と手数料・CVR】
${channelsText}

【月次マーケティング予算】
¥${Number(monthlyBudget).toLocaleString()}

【確定済みの施策】
${confirmedText}

---

あなたの役割:
1. ターゲット市場（${client.targetMarket}）に刺さる具体的なコンテンツ施策を提案
   例: 「フランス人向けに${client.region}の体験を15秒リールで紹介。月8本投稿、うち4本はリール広告として¥5,000/日で配信」
2. プラットフォームと訴求方法の選定理由を説明
3. 現実的な数値（リーチ・エンゲージメント率・CTR）を業界データに基づいて提示
4. ユーザーと壁打ちしながら施策を具体化する

具体的な施策を提案する際は、必ず以下のJSON形式を <STRATEGIES></STRATEGIES> タグで囲んで含めてください。

<STRATEGIES>
[{
  "title": "施策名（15文字以内）",
  "platform": "プラットフォーム名（例: Instagram）",
  "contentType": "コンテンツタイプ（例: リール投稿）",
  "description": "施策の詳細な内容と訴求方法",
  "frequency": "実施頻度（例: 月8本）",
  "budgetSuggestion": 月次予算（円の整数）,
  "estimatedImpressions": 月間推定インプレッション数（整数）,
  "estimatedReach": 月間推定リーチ数（整数）,
  "engagementRate": エンゲージメント率（0.01〜0.25の小数）,
  "ctr": サイトへのCTR（0.005〜0.05の小数）
}]
</STRATEGIES>

常に日本語で回答してください。具体的で実践的なアドバイスを心がけ、数値の根拠も明示してください。`

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
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[/api/roi-chat] Anthropic API error:', res.status, errText)
    return NextResponse.json({ error: `API エラー (${res.status}): ${errText}` }, { status: 500 })
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  const strategiesMatch = raw.text.match(/<STRATEGIES>([\s\S]*?)<\/STRATEGIES>/)
  const cleanContent = raw.text.replace(/<STRATEGIES>[\s\S]*?<\/STRATEGIES>/g, '').trim()

  let strategies: unknown[] = []
  if (strategiesMatch) {
    try {
      strategies = JSON.parse(strategiesMatch[1].trim())
    } catch { /* ignore */ }
  }

  return NextResponse.json({ content: cleanContent, strategies })
}
