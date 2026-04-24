import { NextRequest, NextResponse } from 'next/server'
import { createResearchJob, getRunningJob } from '@/lib/research-jobs'
import { runResearchBackground, DEFAULT_RESEARCH_MESSAGE } from '@/lib/tog-research-runner'

export const runtime = 'nodejs'
export const maxDuration = 300

const LOG = '[CRON]'

export async function GET(req: NextRequest) {
  // ── 認証チェック ──────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error(`${LOG} CRON_SECRET が設定されていません`)
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn(`${LOG} 認証失敗 - 不正なリクエスト`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── API キー確認 ──────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(`${LOG} ANTHROPIC_API_KEY が設定されていません`)
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // ── 重複実行防止 ──────────────────────────────────────────
  const running = getRunningJob()
  if (running) {
    console.log(`${LOG} 既に実行中のジョブがあります (jobId: ${running.id})`)
    return NextResponse.json({ skipped: true, reason: 'already running', jobId: running.id })
  }

  // ── ジョブ起動 ────────────────────────────────────────────
  const jobId = crypto.randomUUID()
  const job = createResearchJob(jobId)

  console.log(`${LOG} AIリサーチ開始 (jobId: ${jobId}) - ${new Date().toISOString()}`)

  // fire-and-forget: Vercel Cron はレスポンスを待つため即返す
  void runResearchBackground(job, DEFAULT_RESEARCH_MESSAGE, apiKey, LOG)

  return NextResponse.json({ ok: true, jobId, startedAt: new Date().toISOString() })
}
