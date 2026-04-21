'use client'

import type { StrategyItem } from '@/lib/types/strategy'

interface Props {
  strategies: StrategyItem[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onConfirm: () => void
  isConfirming: boolean
}

export default function StrategiesSection({
  strategies, onToggle, onSelectAll, onClearAll, onConfirm, isConfirming,
}: Props) {
  const selectedCount = strategies.filter(s => s.selected).length

  if (strategies.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">施策提案はAI分析後に表示されます。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* アクションバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            全選択
          </button>
          <button
            onClick={onClearAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            クリア
          </button>
        </div>
        {selectedCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            {selectedCount}件選択中
          </span>
        )}
      </div>

      {/* 施策カード */}
      <div className="space-y-3">
        {strategies.map(s => (
          <div
            key={s.id}
            onClick={() => onToggle(s.id)}
            className={`border rounded-xl p-4 cursor-pointer transition-all select-none ${
              s.selected
                ? 'border-amber-300 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                s.selected ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
              }`}>
                {s.selected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-slate-800 mb-1">{s.name}</h5>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-slate-400 block mb-0.5">対象市場</span>
                    <span className="text-slate-700 font-medium">{s.targetCountries.join('・')}</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-emerald-500 block mb-0.5">期待効果</span>
                    <span className="text-emerald-800 font-medium">{s.estimatedEffect}</span>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-blue-400 block mb-0.5">推奨予算</span>
                    <span className="text-blue-800 font-medium">{s.recommendedBudget}</span>
                  </div>
                  <div className="bg-purple-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-purple-400 block mb-0.5">実施期間</span>
                    <span className="text-purple-800 font-medium">{s.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 確定ボタン */}
      <button
        onClick={onConfirm}
        disabled={selectedCount === 0 || isConfirming}
        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
      >
        {isConfirming ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            保存中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            選択した {selectedCount}件の施策を確定 → ROI試算・スケジュールに反映
          </>
        )}
      </button>
    </div>
  )
}
