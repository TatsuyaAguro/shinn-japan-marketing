import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  try {
    if (name.endsWith('.pdf')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(buffer)
      return NextResponse.json({ text: data.text })
    }

    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer })
      return NextResponse.json({ text: result.value })
    }

    if (name.endsWith('.txt') || file.type.startsWith('text/')) {
      return NextResponse.json({ text: buffer.toString('utf-8') })
    }

    return NextResponse.json({ text: '', warning: 'サポートされていないファイル形式です' })
  } catch (err) {
    console.error('[parse-file] error:', err)
    return NextResponse.json({ error: 'ファイルの解析に失敗しました', text: '' }, { status: 500 })
  }
}
