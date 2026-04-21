'use client'

import type { BrandingStory } from '@/lib/types/strategy'

export default function BrandingSection({
  story,
  directionSummary,
}: {
  story: BrandingStory | null
  directionSummary?: string
}) {
  if (!story) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">ブランディングストーリーはAI分析後に生成されます。</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 戦略的方向性サマリー */}
      {directionSummary && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">戦略的方向性</p>
          <p className="text-sm text-slate-700 leading-relaxed">{directionSummary}</p>
        </div>
      )}

      {/* ヒーローセクション */}
      <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-8 text-white">
        {/* 装飾 */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/10 -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-purple-500/10 translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="relative">
          <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-3">
            Branding Story
          </p>
          <h2 className="text-3xl font-extrabold text-white mb-5 leading-tight tracking-tight">
            {story.catchphrase}
          </h2>
          <p className="text-indigo-100/90 text-sm leading-relaxed mb-6">
            {story.story}
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wide mb-2">
              なぜこのストーリーか
            </p>
            <p className="text-sm text-white/90 leading-relaxed">{story.rationale}</p>
          </div>
        </div>
      </div>

      {/* 勝ち筋 */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">勝ち筋</h5>
        <div className="space-y-3">
          {story.winningPoints.map((wp, i) => (
            <div key={i} className="flex gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">{wp.point}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{wp.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
