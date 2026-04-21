import { notFound } from 'next/navigation'
import { fetchSharedStrategy } from '@/lib/actions/strategy'
import SharedStrategyView from './SharedStrategyView'
import PrintButton from './PrintButton'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const data = await fetchSharedStrategy(token)

  if (!data) notFound()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-800">SHINN JAPAN</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">インバウンドマーケティング戦略レポート</p>
              <p className="text-sm font-semibold text-slate-800">{data.clientName}</p>
            </div>
            <PrintButton />
          </div>
        </div>
      </header>

      {/* クライアント情報バー */}
      <div className="bg-indigo-600 text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold">{data.clientName}</h1>
            <p className="text-indigo-200 text-sm">{data.clientRegion}</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">
              戦略分析レポート（共有版）
            </span>
          </div>
        </div>
      </div>

      {/* レポート本体 */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <SharedStrategyView strategyData={data.data} schedules={data.schedules} />
      </main>

      {/* フッター */}
      <footer className="border-t border-slate-200 py-6 text-center print:hidden">
        <p className="text-xs text-slate-400">
          Powered by SHINN JAPAN AI Strategy System
          <span className="mx-2">·</span>
          最終更新: {new Date(data.data.lastUpdated).toLocaleString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </footer>
    </div>
  )
}
