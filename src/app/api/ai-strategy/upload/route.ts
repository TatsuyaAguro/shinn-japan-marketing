import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const clientId = formData.get('clientId') as string | null

  if (!file) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  // ── テキスト抽出 ──────────────────────────────────────────
  let extractedText = ''
  try {
    if (name.endsWith('.pdf')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const result = await pdfParse(buffer)
      extractedText = result.text
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (name.endsWith('.txt') || file.type.startsWith('text/')) {
      extractedText = buffer.toString('utf-8')
    }
  } catch (err) {
    console.error('[upload] parse error:', err)
  }

  // ── Supabase Storage ──────────────────────────────────────
  let storagePath = ''
  if (isSupabaseReady() && clientId) {
    try {
      const supabase = await createClient()
      const fileId = `${Date.now()}`
      storagePath = `${clientId}/${fileId}-${file.name}`
      const { error } = await supabase.storage
        .from('strategy-docs')
        .upload(storagePath, buffer, { contentType: file.type, upsert: false })
      if (error) {
        console.warn('[upload] storage error:', error.message)
        storagePath = '' // fallback to text-only
      }
    } catch (err) {
      console.warn('[upload] storage exception:', err)
      storagePath = ''
    }
  }

  return NextResponse.json({
    storagePath,
    extractedText: extractedText.slice(0, 8000),
    name: file.name,
    size: file.size,
    type: file.type,
  })
}
