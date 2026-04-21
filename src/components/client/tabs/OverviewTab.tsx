'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@/lib/data'
import { STATUS_LABELS } from '@/lib/data'
import { fetchConfirmedStrategies } from '@/lib/actions/strategy'

const STATUS_STEP: Record<string, { step: number; label: string; color: string }> = {
  initial:   { step: 0, label: '未開始',   color: 'bg-slate-200' },
  hearing:   { step: 1, label: 'ヒアリング中', color: 'bg-blue-400' },
  analyzing: { step: 2, label: '分析中',   color: 'bg-indigo-500' },
  confirmed: { step: 3, label: '確定済み', color: 'bg-emerald-500' },
}

export default function OverviewTab({ client }: { client: Client }) {
  const [strategy, setStrategy] = useState<{
    strategies: { id: string; name: string; description: string; targetCountries: string[]; duration: string }[]
    brandingStory: string
    directionSummary: string
    status: string
  } | null>(null)

  useEffect(() => {
    fetchConfirmedStrategies(client.id).then(s => {
      setStrategy(s)
    })
  }, [client.id])

  const statusInfo = STATUS_LABELS[client.status]
  const stratStatus = STATUS_STEP[strategy?.status ?? 'initial'] ?? STATUS_STEP.initial

  return (
    <div className="space-y-5">

      {/* ── クライアント基本情報 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">クライアント情報</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: '地域', value: client.region },
            { label: 'カテゴリ', value: client.category },
            { label: 'ターゲット市場', value: client.targetMarket },
            { label: '予算規模', value: client.budget },
            { label: '担当者', value: client.manager },
            { label: '最終更新', value: client.lastActivity },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              <p className="text-sm text-slate-700 font-medium">{value || '—'}</p>
            </div>
          ))}
        </div>
        {client.description && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1.5">概要</p>
            <p className="text-sm text-slate-700 leading-relaxed">{client.description}</p>
          </div>
        )}
      </div>

      {/* ── プロジェクトステータス ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">プロジェクトステータス</h3>
        <div className="flex items-center gap-0">
          {Object.entries(STATUS_STEP).map(([key, s], idx, arr) => (
            <div key={key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.step <= stratStatus.step
                    ? s.color + ' text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {s.step <= stratStatus.step ? '✓' : s.step + 1}
                </div>
                <span className="text-xs text-slate-500 mt-1 whitespace-nowrap">{s.label}</span>
              </div>
              {idx < arr.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-[-14px] ${
                  s.step < stratStatus.step ? stratStatus.color : 'bg-slate-100'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ブランディングストーリー（確定後のみ） ── */}
      {strategy?.brandingStory && (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-7 text-white relative">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/4 pointer-events-none" />
          <div className="relative">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-2">Branding Story</p>
            <h2 className="text-2xl font-extrabold text-white leading-tight">{strategy.brandingStory}</h2>
          </div>
        </div>
      )}

      {/* ── 戦略的方向性 ── */}
      {strategy?.directionSummary && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
          <h3 className="text-sm font-bold text-indigo-800 mb-2">戦略的方向性</h3>
          <p className="text-sm text-indigo-700 leading-relaxed">{strategy.directionSummary}</p>
        </div>
      )}

      {/* ── 確定済み施策一覧 ── */}
      {strategy && strategy.strategies.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">確定施策一覧</h3>
          <div className="space-y-3">
            {strategy.strategies.map((s, i) => (
              <div key={s.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 mb-1">{s.name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mb-1.5">{s.description}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                      🎯 {s.targetCountries?.join('・')}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                      ⏱️ {s.duration}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600 mb-1">まだ施策が確定していません</p>
          <p className="text-xs text-slate-400">「AI戦略室」タブでAIとの戦略ヒアリングを進め、施策を確定してください。</p>
        </div>
      )}
    </div>
  )
}
