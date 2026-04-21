import { NextRequest, NextResponse } from 'next/server'
import { generateShareToken } from '@/lib/actions/strategy'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) {
    return NextResponse.json({ error: 'clientId が必要です' }, { status: 400 })
  }

  const token = await generateShareToken(clientId)
  return NextResponse.json({ token })
}
