import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url が必要です' }, { status: 400 })
  }

  // URL が PDF かどうか簡易判定
  const isPdf =
    url.toLowerCase().includes('.pdf') ||
    url.toLowerCase().includes('pdf')

  if (!isPdf) {
    return NextResponse.json({ error: 'PDFのURLを指定してください' }, { status: 400 })
  }

  try {
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'SHINN-JAPAN-Bot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `PDF取得に失敗しました (${fetchRes.status})` }, { status: 400 })
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
    const data = await pdfParse(buffer)

    return NextResponse.json({
      text: data.text.slice(0, 8000),
      pages: data.numpages,
      url,
    })
  } catch (err) {
    console.error('[extract-pdf] error:', err)
    return NextResponse.json({ error: 'PDF解析に失敗しました' }, { status: 500 })
  }
}
