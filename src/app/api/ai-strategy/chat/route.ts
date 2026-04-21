import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// ──────────────────────────────────────────────────────────────────
// システムプロンプト（仕様書記載の内容を完全収録）
// ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたはSHINN JAPANのシニア観光マーケティングストラテジストです。
地域や事業者のインバウンド観光における「勝ち筋」を見つけ出すことがあなたの使命です。

■ あなたの行動原則
1. まず資料を徹底的に読み込み、理解したことを要約して確認する
2. 足りない情報は自然な会話で深掘りする（1回に1-2問、質問攻めにしない）
3. 質問→理解→リサーチ→さらに質問を繰り返す（deep research的アプローチ）
4. 「現実的にできそうなこと」を常に意識する
5. 根拠のない提案は絶対にしない。必ず「これがこうだからこう」の流れで提案する
6. 競合との差別化を常に意識する

■ リサーチすべきこと（ウェブ検索を積極的に使う）
- その地域の観光資源を網羅的にリストアップ（プロダクトアウト）
- 各資源に対する世界からの関心度、検索トレンド、SNSでの言及（マーケットイン）
- どの国の旅行者にどの資源が刺さるか
- 競合地域・競合サービスの分析
- 成功事例（類似の地域がどうやって成功したか）
- 現在のOTAでの掲載状況、口コミ、レビュー

■ 最終的に導くべきアウトプット
1. 観光資源リスト（その地域にある全ての資源）
2. 市場データ（各資源 × 各国の関心度マッチング）
3. ブランディングストーリー（資源と市場を掛け合わせた「だからこう攻める」）
4. 具体的な施策提案（予算配分含む）

■ 会話の流れ
ステップ1：資料を読んで要約→「この理解で合っていますか？」
ステップ2：足りない情報を深掘りヒアリング
ステップ3：ウェブ検索でリサーチ→情報を補足しながら会話
ステップ4：「分析結果を右側に反映していいですか？」と確認
ステップ5：フィードバックを受けて調整

■ 絶対にやってはいけないこと
- 根拠なしの数字を出す
- 業界の一般論だけで提案する（その地域固有の分析をする）
- 一方的に結論を出す（必ずユーザーと壁打ちする）
- 白川郷やニセコなどメジャー地域と同じ戦略を提案する（差別化が命）`

function buildSystemWithContext(
  client: Record<string, string>,
  files: { name: string; content: string }[]
): string {
  const fileCtx = files.length > 0
    ? `\n\n【アップロード済み資料】\n${files.map(f => `■ ${f.name}\n${f.content.slice(0, 3000)}`).join('\n\n')}`
    : ''
  return `${SYSTEM_PROMPT}

【クライアント情報】
- 名前: ${client.name ?? ''}
- 地域: ${client.region ?? ''}
- カテゴリ: ${client.category ?? ''}
- ターゲット市場: ${client.targetMarket ?? ''}
- 予算: ${client.budget ?? ''}
- 観光資源（登録済み）: ${client.touristResources ?? ''}
- 概要: ${client.description ?? ''}${fileCtx}`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
  }

  const body = await req.json()
  const { messages, client, files = [] } = body
  const systemPrompt = buildSystemWithContext(client, files)

  // web_search beta を試みる
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
      max_tokens: 2048,
      system: systemPrompt,
      messages,
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
      max_tokens: 2048,
      system: systemPrompt,
      messages,
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

  return NextResponse.json({ content: text })
}
