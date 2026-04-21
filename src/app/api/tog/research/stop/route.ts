import { NextRequest, NextResponse } from 'next/server'
import { getResearchJob } from '@/lib/research-jobs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const jobId: string | undefined = body.jobId
  if (!jobId) {
    return NextResponse.json({ error: 'jobId が必要です' }, { status: 400 })
  }

  const job = getResearchJob(jobId)
  if (!job) {
    return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })
  }

  if (job.status !== 'running') {
    return NextResponse.json({ ok: true, already: true })
  }

  job.shouldStop = true
  job.abortController.abort()

  return NextResponse.json({ ok: true })
}
