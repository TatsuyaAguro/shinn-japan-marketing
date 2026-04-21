import { NextRequest, NextResponse } from 'next/server'
import type { HearingAnswer } from '@/lib/actions/project_design'

export const runtime = 'nodejs'

interface ClientInfo {
  name: string
  region: string
  category: string
  targetMarket: string
  touristResources: string
  budget: string
  description: string
}

// ── JSONスキーマ（system promptで共有） ──────────────────────────
const JSON_SCHEMA = `{
  "summary": "プロジェクト方向性サマリー（200〜300字）",
  "marketAnalysis": "ターゲット市場の分析（300〜400字）",
  "proposals": [
    {
      "id": "1",
      "title": "施策名（15文字以内）",
      "description": "施策の詳細説明（200字）",
      "platform": "主要プラットフォーム名",
      "timeline": "推奨実施期間（例: 3ヶ月）",
      "budgetEstimate": "月次概算予算（例: 月30万円）",
      "estimatedEffect": "期待効果（数値目標）",
      "steps": ["ステップ1", "ステップ2", "ステップ3"]
    }
  ]
}`

const REPORT_SYSTEM_PROMPT = `あなたはインバウンド観光マーケティングの専門コンサルタントです。
クライアント情報とヒアリング回答をもとに、実践的なマーケティング戦略レポートを作成してください。

回答はJSON形式のみで出力してください。説明文・前置き・マークダウンは不要です。
proposals は3〜5件、現実的な数値目標を含めてください。

JSONの構造:
${JSON_SCHEMA}`

const FINAL_SYSTEM_PROMPT = `あなたはインバウンド観光マーケティングの専門コンサルタントです。
これまでの分析・フィードバックをもとに、最終的なプロジェクト方向性総括を作成してください。

回答はJSON形式のみで出力してください。説明文・前置き・マークダウンは不要です。
フィードバックを正確に反映し、proposals は3〜5件。

JSONの構造:
${JSON_SCHEMA}`

function formatAnswers(answers: HearingAnswer[]): string {
  const labels: Record<string, string> = {
    q1: 'プロジェクトのゴール',
    q2: 'ターゲット市場',
    q3: '旅行者の興味・関心',
    q4: '現在の集客経路',
    q5: '現在の課題',
    q6: '競合状況',
    q7: 'SNS・デジタルの現状',
    q8: '予算規模',
    q9: 'プロジェクト期間',
  }
  const lines = (answers ?? [])
    .filter(a => !a.skipped && (a.selected.length > 0 || a.freeText))
    .map(a => {
      const parts = [...a.selected]
      if (a.freeText) parts.push(`その他: ${a.freeText}`)
      return `${labels[a.questionId] ?? a.questionId}: ${parts.join('、')}`
    })
  return lines.length > 0 ? lines.join('\n') : '（回答なし）'
}

// ── JSON抽出（3段階フォールバック） ──────────────────────────────
function extractJSON(text: string): object | null {
  // Step 1: コードフェンスを除去して直接パース
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try { return JSON.parse(cleaned) } catch { /* continue */ }

  // Step 2: 最初の { から最後の } を抽出してパース
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* continue */ }
  }

  // Step 3: 行単位で { 始まりの行を探す
  for (const line of cleaned.split('\n')) {
    if (line.trimStart().startsWith('{')) {
      const sub = cleaned.slice(cleaned.indexOf(line))
      const subEnd = sub.lastIndexOf('}')
      if (subEnd !== -1) {
        try { return JSON.parse(sub.slice(0, subEnd + 1)) } catch { /* continue */ }
      }
    }
  }

  return null
}

// ── JSONが取れない場合のフォールバックレポート ────────────────────
function buildFallbackReport(rawText: string): object {
  // 生テキストをサマリーに入れて最低限表示できる構造を返す
  return {
    summary: rawText.slice(0, 800),
    marketAnalysis: '（自動解析できませんでした。上記サマリーを参照してください）',
    proposals: [],
    _parseError: true,
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
  }

  const body = await req.json() as {
    action: 'generate_report' | 'refine_report' | 'generate_final'
    client: ClientInfo
    hearingAnswers: HearingAnswer[]
    feedback?: string
    previousReport?: object
    version?: number
  }

  const { action, client, hearingAnswers, feedback, previousReport, version = 1 } = body

  let userContent = ''
  let systemPrompt = REPORT_SYSTEM_PROMPT

  if (action === 'generate_report') {
    userContent = `【クライアント情報】
名前: ${client.name}
地域: ${client.region}
カテゴリ: ${client.category}
ターゲット市場: ${client.targetMarket || '（未設定）'}
観光資源: ${client.touristResources || '（未設定）'}
予算規模: ${client.budget || '未定'}
プロジェクト概要: ${client.description || '（未設定）'}

【ヒアリング回答】
${formatAnswers(hearingAnswers)}

上記の情報をもとに分析レポートと施策案を生成してください。`

  } else if (action === 'refine_report') {
    systemPrompt = FINAL_SYSTEM_PROMPT
    // previousReport は proposals のみ渡してトークン節約
    const prevProposals = (previousReport as { proposals?: unknown[] })?.proposals ?? []
    userContent = `【クライアント情報】
名前: ${client.name}
地域: ${client.region}
ターゲット市場: ${client.targetMarket || '（未設定）'}
観光資源: ${client.touristResources || '（未設定）'}

【ヒアリング回答】
${formatAnswers(hearingAnswers)}

【前回の施策案】
${JSON.stringify(prevProposals, null, 2)}

【ユーザーフィードバック（v${version}）】
${feedback ?? '（フィードバックなし）'}

フィードバックを反映して改善版レポートを生成してください。`

  } else if (action === 'generate_final') {
    systemPrompt = FINAL_SYSTEM_PROMPT
    const prevProposals = (previousReport as { proposals?: unknown[] })?.proposals ?? []
    userContent = `【クライアント情報】
名前: ${client.name}
地域: ${client.region}
ターゲット市場: ${client.targetMarket || '（未設定）'}
観光資源: ${client.touristResources || '（未設定）'}
予算規模: ${client.budget || '未定'}

【ヒアリング回答】
${formatAnswers(hearingAnswers)}

【確定する施策案】
${JSON.stringify(prevProposals, null, 2)}

以上の内容を最終レポートとして整理してください。`
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[project-design] Anthropic error:', res.status, errText)
    return NextResponse.json({ error: `Anthropic API エラー (${res.status}): ${errText.slice(0, 200)}` }, { status: 500 })
  }

  const data = await res.json() as {
    content: { type: string; text: string }[]
    stop_reason?: string
  }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  console.log('[project-design] stop_reason:', data.stop_reason, '| text length:', raw.text.length)

  const report = extractJSON(raw.text) ?? buildFallbackReport(raw.text)
  return NextResponse.json({ report })
}
