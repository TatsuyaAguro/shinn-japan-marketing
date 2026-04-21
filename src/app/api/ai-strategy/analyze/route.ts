import { NextRequest, NextResponse } from 'next/server'
import type { StrategyData } from '@/lib/types/strategy'

export const runtime = 'nodejs'

const SYSTEM = `あなたはSHINN JAPANのシニア観光マーケティングストラテジストです。
会話履歴とアップロード資料を統合分析し、根拠のある観光マーケティング戦略をJSON形式で生成します。
数値は実際の市場知識・検索トレンドに基づいて設定すること。根拠のない数字は出さない。`

function buildPrompt(
  client: Record<string, string>,
  files: { name: string; content: string }[],
  feedback: string,
  versionNum: number
): string {
  const fileCtx = files.length > 0
    ? `\n【資料】\n${files.map(f => `■ ${f.name}\n${f.content.slice(0, 2000)}`).join('\n\n')}`
    : ''
  const feedbackCtx = feedback ? `\n【フィードバック（必ず反映すること）】\n${feedback}` : ''

  return `${feedbackCtx}${fileCtx}

上記の会話履歴・資料・フィードバックを統合して、以下のJSON形式で戦略分析レポートを生成してください。
JSON以外のテキストは絶対に含めないこと（コードブロックも不要）。

{
  "version": ${versionNum},
  "directionSummary": "戦略的方向性のサマリー（3〜4文。「なぜこの方向か」を明確に）",
  "touristResources": [
    {
      "id": "r1",
      "name": "資源名",
      "category": "景観・文化遺産 or 食 or 体験・アクティビティ or 宿泊 or 工芸 or 自然 or イベント",
      "description": "この資源の特徴・魅力・インバウンド視点での可能性（2〜3文）",
      "uniquenessScore": 4
    }
  ],
  "marketMatrix": {
    "resources": ["資源名1", "資源名2"],
    "countries": ["アメリカ", "フランス", "イギリス", "オーストラリア", "中国", "台湾", "タイ"],
    "scores": [
      [85, 70, 65, 55, 35, 78, 42],
      [60, 82, 75, 50, 25, 55, 38]
    ],
    "searchTrends": [
      {
        "resourceName": "資源名1",
        "data": [
          {"month": "2024-10", "value": 45},
          {"month": "2024-11", "value": 52},
          {"month": "2024-12", "value": 68},
          {"month": "2025-01", "value": 58},
          {"month": "2025-02", "value": 74},
          {"month": "2025-03", "value": 81}
        ]
      }
    ],
    "socialMentions": [
      {"resourceName": "資源名1", "count": 3250}
    ],
    "successCases": [
      {
        "region": "類似地域名",
        "description": "何をしたか（1〜2文）",
        "result": "どんな成果を得たか（具体的数値があれば）"
      }
    ],
    "competitorAnalysis": [
      {
        "name": "競合地域名",
        "strengths": "その地域の強み",
        "weaknesses": "その地域の弱み・限界",
        "differentiation": "クライアントがどう差別化できるか"
      }
    ],
    "dataSources": ["Google Trends推定", "Instagram投稿数推計", "JTB調査参考"]
  },
  "brandingStory": {
    "catchphrase": "15〜25文字のキャッチフレーズ（感情に訴えるもの）",
    "story": "なぜこの地域に来るべきか・何が体験できるかを語る（3〜4文）",
    "rationale": "このストーリーが戦略的に正しい理由（市場データと資源分析から根拠を示す、2〜3文）",
    "winningPoints": [
      {"point": "勝ち筋1（具体的な差別化ポイント）", "evidence": "その根拠となるデータや事実"},
      {"point": "勝ち筋2", "evidence": "根拠"},
      {"point": "勝ち筋3", "evidence": "根拠"}
    ]
  },
  "strategies": [
    {
      "id": "s1",
      "name": "施策名",
      "description": "施策の具体的内容（2〜3文。what/how/why を含む）",
      "targetCountries": ["アメリカ", "フランス"],
      "estimatedEffect": "定量的な期待効果（例：認知度 +30%、訪問者数 1.5倍）",
      "recommendedBudget": "推奨予算配分（例：総予算の30%、約XXX万円）",
      "duration": "実施期間（例：3ヶ月、6ヶ月、通年）",
      "selected": false
    }
  ],
  "lastUpdated": "${new Date().toISOString()}"
}

制約:
- touristResources: 最低3個、最大8個
- strategies: 3〜5個
- winningPoints: 3〜4個
- countries: 必ず7カ国分のスコアを resources の数に合わせた2次元配列で出力
- scores の行数 = resources の要素数、列数 = countries の要素数（ずれると壊れる）
- 観光資源・施策はこの地域に特有の内容にすること（一般論禁止）
- クライアント情報: ${JSON.stringify({ name: client.name, region: client.region, category: client.category, touristResources: client.touristResources })}`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })

  const { messages, client, files = [], feedback = '', versionNum = 1 } = await req.json()

  const analyzePrompt = buildPrompt(client, files, feedback, versionNum)
  const apiMessages = [...messages, { role: 'user', content: analyzePrompt }]

  // web_search を使って最新データを取得しながら分析
  const withSearch = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8096,
      system: SYSTEM,
      messages: apiMessages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  })

  const res = withSearch.ok ? withSearch : await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8096,
      system: SYSTEM,
      messages: apiMessages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const raw = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('')

  const cleaned = raw
    .replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```\s*$/m, '').trim()

  let strategyData: StrategyData
  try {
    strategyData = JSON.parse(cleaned) as StrategyData
  } catch {
    console.error('[analyze] JSON parse error. raw:', raw.slice(0, 300))
    return NextResponse.json(
      { error: 'AIの応答をJSONとして解析できませんでした。再試行してください。' },
      { status: 422 }
    )
  }

  return NextResponse.json({ strategyData })
}
