'use client'

import { useState, useCallback, useEffect } from 'react'
import type { TogCase, TogPrediction } from '@/lib/types/tog'
import { fetchTogCases, fetchTogPredictions } from '@/lib/actions/tog'
import NewCasesTab from '@/components/tog/tabs/NewCasesTab'
import ActiveTab from '@/components/tog/tabs/ActiveTab'
import ArchiveTab from '@/components/tog/tabs/ArchiveTab'
import PredictionTab from '@/components/tog/tabs/PredictionTab'

type Tab = 'new' | 'active' | 'archive' | 'prediction'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'new',        label: '新着案件',   icon: '🔍' },
  { id: 'active',     label: '対応中',     icon: '📋' },
  { id: 'archive',    label: '過去案件',   icon: '📁' },
  { id: 'prediction', label: '先読みリサーチ', icon: '🔮' },
]

export default function TogPage() {
  const [tab, setTab] = useState<Tab>('new')
  const [newCases, setNewCases] = useState<TogCase[]>([])
  const [activeCases, setActiveCases] = useState<TogCase[]>([])
  const [archiveCases, setArchiveCases] = useState<TogCase[]>([])   // status='archive' 業界DB
  const [historyCases, setHistoryCases] = useState<TogCase[]>([])  // 採択/不採択/見送り
  const [predictions, setPredictions] = useState<TogPrediction[]>([])
  const [lastResearched, setLastResearched] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [newC, activeC, archiveC, historyC, preds] = await Promise.all([
      fetchTogCases({ status: ['new', 'passed'], minScore: 3 }),
      fetchTogCases({ status: ['considering', 'preparing', 'applied', 'waiting', 'accepted'] }),
      fetchTogCases({ status: 'archive' }),
      fetchTogCases({ status: ['accepted', 'rejected', 'passed_unrelated', 'passed_prep', 'passed', 'dismissed'] }),
      fetchTogPredictions(),
    ])
    setNewCases(newC.filter(c => c.status === 'new'))
    setActiveCases(activeC)
    setArchiveCases(archiveC)
    setHistoryCases(historyC)
    setPredictions(preds)

    // 最終リサーチ時刻 = 新着案件の最新 createdAt
    const allNew = newC.filter(c => c.status === 'new')
    if (allNew.length > 0) {
      const latest = allNew.reduce((a, b) => a.createdAt > b.createdAt ? a : b)
      setLastResearched(latest.createdAt)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ToG 自治体公募管理</h1>
          <p className="text-sm text-slate-500 mt-1">公募案件のリサーチ・スクリーニング・対応管理</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold">新着 {newCases.length}件</span>
          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full font-semibold">対応中 {activeCases.length}件</span>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.id === 'new' && newCases.length > 0 && (
              <span className="ml-0.5 min-w-[1.25rem] h-5 flex items-center justify-center bg-red-500 text-white text-xs rounded-full px-1">
                {newCases.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div>
        {tab === 'new' && (
          <NewCasesTab
            cases={newCases}
            lastResearched={lastResearched}
            onRefresh={load}
          />
        )}
        {tab === 'active' && (
          <ActiveTab
            cases={activeCases}
            onRefresh={load}
          />
        )}
        {tab === 'archive' && (
          <ArchiveTab
            archiveCases={archiveCases}
            historyCases={historyCases}
            onRefresh={load}
          />
        )}
        {tab === 'prediction' && (
          <PredictionTab
            predictions={predictions}
            archiveCases={archiveCases}
            onRefresh={load}
          />
        )}
      </div>
    </div>
  )
}
