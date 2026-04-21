import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
}

const SYSTEM_PROMPT = `あなたはSHINN JAPANの観光インバウンドマーケティング専門家です。
提供された資料（議事録、ヒアリングメモ、PDF等）から以下の情報を抽出し、JSONのみを返してください。

返却するJSONのキー（すべて文字列）:
- name: クライアント名（組織名・自治体名・施設名など）
- region: 地域（都道府県、または「〇〇県〇〇市」など）
- targetMarket: ターゲット市場（例: 欧米・オーストラリア、東アジア・東南アジア）
- touristResources: 観光資源（カンマ区切りで列挙）
- description: プロジェクト概要（目的・背景・方向性を3〜5文で）

マークダウンのコードブロックは不要です。JSONオブジェクトのみ返してください。
情報が不明・記載なしの場合は空文字列("")を設定してください。`

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

interface FilePayload {
  name: string
  mediaType: string
  data: string
  isText: boolean
  textContent?: string
}

function isWordFile(file: FilePayload): boolean {
  return (
    file.mediaType.includes('wordprocessingml') ||
    file.mediaType.includes('msword') ||
    /\.docx?$/i.test(file.name)
  )
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。' },
      { status: 500 }
    )
  }

  const { files }: { files: FilePayload[] } = await req.json()
  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = []
  const fileLabels: string[] = []

  for (const file of files) {
    const isPdf   = file.mediaType === 'application/pdf'
    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.mediaType)
    const isWord  = isWordFile(file)

    if (file.isText && file.textContent) {
      // テキストファイル（txt, md, csv 等）
      contentBlocks.push({
        type: 'text',
        text: `【ファイル: ${file.name}】\n${file.textContent}`,
      })
      fileLabels.push(`${file.name}（テキスト）`)

    } else if (isPdf && file.data) {
      // PDF → document ブロック
      contentBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.data },
        title: file.name,
      })
      fileLabels.push(`${file.name}（PDF）`)

    } else if (isWord && file.data) {
      // Word / docx → mammoth でテキスト抽出
      try {
        const buffer = Buffer.from(file.data, 'base64')
        const result = await mammoth.extractRawText({ buffer })
        const text = result.value.trim()
        if (text) {
          contentBlocks.push({
            type: 'text',
            text: `【ファイル: ${file.name}】\n${text}`,
          })
          fileLabels.push(`${file.name}（Word → テキスト変換済み、${text.length}文字）`)
        } else {
          contentBlocks.push({
            type: 'text',
            text: `【ファイル: ${file.name} — テキストを抽出できませんでした（空のWordファイルの可能性）】`,
          })
          fileLabels.push(`${file.name}（Word・空）`)
        }
      } catch (err) {
        console.error('[extract-client-info] mammoth error:', err)
        contentBlocks.push({
          type: 'text',
          text: `【ファイル: ${file.name} — Wordファイルの解析に失敗しました】`,
        })
        fileLabels.push(`${file.name}（Word・解析失敗）`)
      }

    } else if (isImage && file.data) {
      // 画像 → image ブロック（Claude Vision）
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mediaType, data: file.data },
      })
      contentBlocks.push({
        type: 'text',
        text: `↑ 上記は「${file.name}」の画像です。画像内のテキストや情報からクライアント情報を読み取ってください。`,
      })
      fileLabels.push(`${file.name}（画像）`)

    } else {
      // 未対応フォーマット
      contentBlocks.push({
        type: 'text',
        text: `【ファイル: ${file.name}（${file.mediaType}）— このファイル形式は対応していません】`,
      })
      fileLabels.push(`${file.name}（未対応）`)
      console.warn('[extract-client-info] unsupported file type:', file.mediaType, file.name)
    }
  }

  contentBlocks.push({
    type: 'text',
    text: '上記の資料からクライアント情報を抽出し、指定のJSON形式で返してください。',
  })

  console.log('[extract-client-info] files:', fileLabels)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[extract-client-info] Anthropic API error:', res.status, errText)
    return NextResponse.json(
      { error: `Anthropic API エラー (${res.status}): ${errText}` },
      { status: 500 }
    )
  }

  const data = await res.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.[0]
  if (!raw || raw.type !== 'text') {
    return NextResponse.json({ error: '予期しないレスポンス形式です' }, { status: 500 })
  }

  try {
    const jsonText = raw.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const extracted = JSON.parse(jsonText)
    console.log('[extract-client-info] extracted:', extracted)
    return NextResponse.json({ extracted })
  } catch {
    return NextResponse.json(
      { error: `AIの応答をパースできませんでした: ${raw.text.slice(0, 200)}` },
      { status: 500 }
    )
  }
}
