import { NextRequest, NextResponse } from 'next/server'
import { getResearchJob, serializeJob } from '@/lib/research-jobs'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId が必要です' }, { status: 400 })
  }

  const job = getResearchJob(jobId)
  if (!job) {
    return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })
  }

  return NextResponse.json(serializeJob(job))
}
