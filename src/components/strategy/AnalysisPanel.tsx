'use client'

import { useState } from 'react'
import type { StrategyData, StrategyVersion, StrategyItem } from '@/lib/types/strategy'
import ResourcesSection from './sections/ResourcesSection'
import MarketSection from './sections/MarketSection'
import BrandingSection from './sections/BrandingSection'
import StrategiesSection from './sections/StrategiesSection'

interface Props {
  data: StrategyData | null
  versions: StrategyVersion[]
  shareToken: string | null
  isConfirming: boolean
  onToggleStrategy: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onConfirm: () => void
  onFeedback: (text: string) => void
  onGenerateShare: () => void
  onCopyShare: () => void
  onSelectVersion: (v: StrategyVersion) => void
  copiedShare: boolean
}

const SECTIONS = [
  { id: 'resources', label: '①観光資源マップ', icon: '🏔️' },
  { id: 'market',    label: '②市場データ',     icon: '📊' },
  { id: 'branding',  label: '③ブランディング',  icon: '✨' },
  { id: 'strategies', label: '④施策提案',      icon: '🎯' },
] as const
type SectionId = typeof SECTIONS[number]['id']

export default function AnalysisPanel({
  data, versions, shareToken, isConfirming,
  onToggleStrategy, onSelectAll, onClearAll, onConfirm,
  onFeedback, onGenerateShare, onCopyShare, onSelectVersion, copiedShare,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('resources')
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  const handleFeedback = () => {
    if (!feedback.trim()) return
    onFeedback(feedback.trim())
    setFeedback('')
    setShowFeedback(false)
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── ヘッダー ── */}
      <div className="px-5 py-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">戦略分析レポート</h3>
              {data && (
                <p className="text-xs text-slate-400">
                  v{data.version} · {new Date(data.lastUpdated).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* バージョン切り替え */}
            {versions.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  履歴 ({versions.length})
                </button>
                {showVersions && (
                  <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-[200px]">
                    {[...versions].reverse().map(v => (
                      <button
                        key={v.version}
                        onClick={() => { onSelectVersion(v); setShowVersions(false) }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 cursor-pointer transition-colors ${data?.version === v.version ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600'}`}
                      >
                        <span className="font-semibold">{v.label}</span>
                        <span className="block text-slate-400 text-xs mt-0.5">
                          {new Date(v.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 共有 */}
            {data && (
              !shareToken ? (
                <button
                  onClick={onGenerateShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  共有URL
                </button>
              ) : (
                <button
                  onClick={onCopyShare}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-all ${
                    copiedShare
                      ? 'text-emerald-700 border border-emerald-200 bg-emerald-50'
                      : 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {copiedShare
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    }
                  </svg>
                  {copiedShare ? 'コピー済み!' : 'URLコピー'}
                </button>
              )
            )}
          </div>
        </div>

        {/* セクションナビ */}
        <div className="flex gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSection === s.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{s.icon}</span>
              <span className="hidden sm:inline">{s.label.slice(1)}</span>
              <span className="sm:hidden">{s.id === 'resources' ? '①' : s.id === 'market' ? '②' : s.id === 'branding' ? '③' : '④'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ── */}
      {!data && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-700 mb-2">分析レポートを生成しましょう</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              左のAIと会話を重ねてください。<br />
              3回以上の会話後、「分析を更新」ボタンが表示されます。
            </p>
          </div>
        </div>
      )}

      {/* ── コンテンツ ── */}
      {data && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-2">
          {activeSection === 'resources' && (
            <ResourcesSection resources={data.touristResources} />
          )}
          {activeSection === 'market' && (
            <MarketSection matrix={data.marketMatrix} />
          )}
          {activeSection === 'branding' && (
            <BrandingSection story={data.brandingStory} directionSummary={data.directionSummary} />
          )}
          {activeSection === 'strategies' && (
            <StrategiesSection
              strategies={data.strategies}
              onToggle={onToggleStrategy}
              onSelectAll={onSelectAll}
              onClearAll={onClearAll}
              onConfirm={onConfirm}
              isConfirming={isConfirming}
            />
          )}

          {/* フィードバック */}
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {showFeedback ? 'フィードバックを閉じる' : 'フィードバックを送って再分析する'}
            </button>

            {showFeedback && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="例：「既にInstagram施策は始めています」「欧米よりもアジア市場を重視したい」「コストを抑えた施策中心で」"
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleFeedback}
                  disabled={!feedback.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm rounded-lg cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  送信して再分析
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
