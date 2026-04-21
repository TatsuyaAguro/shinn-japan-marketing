import Link from 'next/link'
import { fetchClients } from '@/lib/actions/clients'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import { STATUS_LABELS, CATEGORY_ICONS } from '@/lib/data'
import AddClientButton from '@/components/client/AddClientButton'

export default async function HomePage() {
  const clients = await fetchClients()
  const activeCount = clients.filter(c => c.status === 'active').length
  const totalCampaigns = clients.reduce((sum, c) => sum + c.campaigns, 0)
  const supabaseReady = isSupabaseReady()

  return (
    <div>
      {/* Supabase未設定バナー */}
      {!supabaseReady && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            <strong>デモモード：</strong> Supabase未設定のため静的データを表示中です。
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs">.env.local</code>
            にプロジェクトURLとAnonキーを設定するとDBに接続できます。
          </span>
        </div>
      )}

      {/* ページヘッダー */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">クライアント一覧</h1>
          <p className="text-slate-500 text-sm mt-1">
            管理中のクライアント {clients.length} 件
          </p>
        </div>
        <AddClientButton />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">総クライアント数</p>
          <p className="text-3xl font-bold text-slate-800">{clients.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">稼働中</p>
          <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-sm text-slate-500 mb-1">進行中キャンペーン</p>
          <p className="text-3xl font-bold text-blue-600">{totalCampaigns}</p>
        </div>
      </div>

      {/* フィルター・検索バー */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="クライアント名・地域で検索..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <select className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="">すべてのステータス</option>
          <option value="active">稼働中</option>
          <option value="inactive">停止中</option>
          <option value="draft">準備中</option>
        </select>
      </div>

      {/* クライアントカード一覧 */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium">クライアントがまだありません</p>
          <p className="text-xs mt-1">「クライアントを追加」から登録してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((client) => {
            const status = STATUS_LABELS[client.status]
            const icon = CATEGORY_ICONS[client.category] ?? '🏢'

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors truncate">
                          {client.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{client.region}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-lg ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-24 shrink-0">カテゴリ</span>
                    <span className="text-xs font-medium text-slate-600">{client.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-24 shrink-0">ターゲット市場</span>
                    <span className="text-xs font-medium text-slate-600 truncate">{client.targetMarket}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-24 shrink-0">キャンペーン</span>
                    <span className="text-xs font-medium text-blue-600">{client.campaigns} 件</span>
                  </div>
                </div>

                <div className="px-5 pb-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    最終更新: {client.lastActivity}
                  </span>
                  <Link
                    href={`/home/${client.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    詳細を見る →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
