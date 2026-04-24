import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { createResearchJob, getRunningJob } from '@/lib/research-jobs'
import { runResearchBackground, DEFAULT_RESEARCH_MESSAGE } from '@/lib/tog-research-runner'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
  }

  // 既に実行中のジョブがあればそのIDを返す
  const running = getRunningJob()
  if (running) {
    return NextResponse.json({ jobId: running.id, alreadyRunning: true })
  }

  const body = await req.json().catch(() => ({}))
  const query: string | undefined = body.query
  const userMessage = query?.trim() || DEFAULT_RESEARCH_MESSAGE

  const jobId = crypto.randomUUID()
  const job = createResearchJob(jobId)

  // fire-and-forget: レスポンスを即返し、バックグラウンドで実行
  void runResearchBackground(job, userMessage, apiKey)

  return NextResponse.json({ jobId })
}
