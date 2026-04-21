// ================================================================
// バックグラウンド AIリサーチ ジョブ管理
// Node.js プロセス内のシングルトン Map で状態を保持する。
// 同一プロセスが続く限り（ローカル開発・永続サーバー）状態は維持される。
// ================================================================

export type ResearchPhase  = 'ai-searching' | 'db-saving'
export type ResearchStatus = 'running' | 'done' | 'stopped' | 'error'

export interface ResearchJob {
  id:             string
  status:         ResearchStatus
  phase:          ResearchPhase
  foundCount:     number
  savedCount:     number
  saveErrors:     number
  error?:         string
  setupRequired?: boolean
  shouldStop:     boolean
  startedAt:      string
  finishedAt?:    string
  abortController: AbortController
}

/** AbortController と shouldStop はシリアライズ不可なので除外したクライアント向け型 */
export type SerializedJob = Omit<ResearchJob, 'abortController' | 'shouldStop'>

// モジュールレベルの Map ── Next.js の Node.js ランタイムでリクエスト間を通じて保持される
const store = new Map<string, ResearchJob>()

export function createResearchJob(id: string): ResearchJob {
  const job: ResearchJob = {
    id,
    status:          'running',
    phase:           'ai-searching',
    foundCount:      0,
    savedCount:      0,
    saveErrors:      0,
    shouldStop:      false,
    startedAt:       new Date().toISOString(),
    abortController: new AbortController(),
  }
  store.set(id, job)

  // 古いジョブを定期的に削除（最大 20 件保持）
  if (store.size > 20) {
    const oldest = [...store.entries()]
      .sort((a, b) => a[1].startedAt.localeCompare(b[1].startedAt))[0]
    if (oldest) store.delete(oldest[0])
  }

  return job
}

export function getResearchJob(id: string): ResearchJob | undefined {
  return store.get(id)
}

export function getRunningJob(): ResearchJob | undefined {
  for (const job of store.values()) {
    if (job.status === 'running') return job
  }
  return undefined
}

export function serializeJob(job: ResearchJob): SerializedJob {
  const { abortController, shouldStop, ...rest } = job
  return rest
}
