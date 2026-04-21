import { fetchTogStats } from '@/lib/actions/tog'
import { SCORE_META } from '@/lib/types/tog'
import Link from 'next/link'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function formatBudget(n: number): string {
  if (n === 0) return '─'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

export default async function DashboardPage() {
  const stats = await fetchTogStats()

  // 月別バーチャート用スケール
  const maxMonthly = Math.max(...stats.byMonth.map(m => m.applied), 1)

  // 都道府県横棒チャート
  const maxPref = Math.max(...stats.byPrefecture.map(p => p.count), 1)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="text-sm text-slate-500 mt-1">ToG営業活動の全体状況</p>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="新着案件" value={stats.totalNew} sub="AIスクリーニング済み" color="text-indigo-600" />
        <StatCard label="対応中" value={stats.totalActive} sub="検討中〜結果待ち" color="text-amber-600" />
        <StatCard label="応募総数" value={stats.totalApplied} sub={`うち採択 ${stats.totalAccepted}件`} />
        <StatCard
          label="採択率"
          value={`${stats.acceptanceRate}%`}
          sub={`採択予算 ${formatBudget(stats.totalBudgetAccepted)}`}
          color={stats.acceptanceRate >= 50 ? 'text-emerald-600' : 'text-slate-900'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 月別応募・採択 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">月別 応募 / 採択</h2>
          {stats.byMonth.length === 0 ? (
            <p className="text-sm text-slate-400">データなし</p>
          ) : (
            <div className="space-y-2">
              {stats.byMonth.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                  <div className="flex-1 space-y-1">
                    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-400 rounded-full"
                        style={{ width: `${(m.applied / maxMonthly) * 100}%` }}
                      />
                    </div>
                    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full"
                        style={{ width: `${(m.accepted / maxMonthly) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 w-16 text-right shrink-0">{m.applied} / {m.accepted}</span>
                </div>
              ))}
              <div className="flex gap-4 pt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-indigo-400 rounded-sm inline-block" />応募</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-400 rounded-sm inline-block" />採択</span>
              </div>
            </div>
          )}
        </div>

        {/* 都道府県別 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">都道府県別 件数 TOP10</h2>
          {stats.byPrefecture.length === 0 ? (
            <p className="text-sm text-slate-400">データなし</p>
          ) : (
            <div className="space-y-2">
              {stats.byPrefecture.map(p => (
                <div key={p.prefecture} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-20 shrink-0 truncate">{p.prefecture}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(p.count / maxPref) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-6 text-right shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 締切直前 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">締切直前 TOP5</h2>
            <Link href="/tog" className="text-xs text-indigo-600 hover:underline">すべて →</Link>
          </div>
          {stats.urgentCases.length === 0 ? (
            <p className="text-sm text-slate-400">締切間近の案件はありません</p>
          ) : (
            <div className="space-y-2.5">
              {stats.urgentCases.map(c => {
                const meta = SCORE_META[c.aiScore] ?? SCORE_META[0]
                const daysLeft = c.deadline
                  ? Math.ceil((new Date(c.deadline).getTime() - Date.now()) / 86400000)
                  : null
                return (
                  <Link key={c.id} href={`/tog/${c.id}`} className="flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="text-xs font-bold" style={{ color: meta.hex }}>{meta.stars}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.organization}</p>
                    </div>
                    {daysLeft !== null && (
                      <span className={`text-xs font-bold shrink-0 ${daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                        残{daysLeft}日
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 最近追加 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">最近追加された案件</h2>
            <Link href="/tog" className="text-xs text-indigo-600 hover:underline">すべて →</Link>
          </div>
          {stats.recentCases.length === 0 ? (
            <p className="text-sm text-slate-400">案件がありません</p>
          ) : (
            <div className="space-y-2.5">
              {stats.recentCases.map(c => {
                const meta = SCORE_META[c.aiScore] ?? SCORE_META[0]
                const statusMeta = { label: c.status, color: 'bg-slate-100 text-slate-500' }
                return (
                  <Link key={c.id} href={`/tog/${c.id}`} className="flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                    <span className="text-xs font-bold" style={{ color: meta.hex }}>{meta.stars}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.organization} · {c.prefecture}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{c.createdAt?.slice(0, 10)}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 案件種類別 */}
      {stats.byCategory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">案件種類別</h2>
          <div className="flex flex-wrap gap-2">
            {stats.byCategory.map(c => (
              <span key={c.category} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full font-medium">
                {c.category} <span className="text-slate-400">({c.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
