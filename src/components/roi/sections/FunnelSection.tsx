'use client'

import { useState } from 'react'
import type { ROICalculationResult } from '@/lib/roi-calculator'
import { formatJPY } from '@/lib/roi-calculator'

interface Props {
  results: ROICalculationResult[]
}

interface FunnelCard {
  step: number
  title: string
  value: string
  sub: string
  rate?: string
  source: string
  color: string
}

function buildFunnelCards(r: ROICalculationResult): FunnelCard[] {
  return [
    {
      step: 1,
      title: '広告配信',
      value: r.impressions.toLocaleString(),
      sub: 'インプレッション',
      rate: `CPM ¥${r.cpmUsed.toLocaleString()}`,
      source: 'Meta Business Suite 2025 / Google Ads 2025',
      color: '#6366f1',
    },
    {
      step: 2,
      title: '認知・リーチ',
      value: r.reach.toLocaleString(),
      sub: 'ユニークリーチ',
      rate: `÷ フリークエンシー 3回`,
      source: '設定値',
      color: '#8b5cf6',
    },
    {
      step: 3,
      title: 'エンゲージメント',
      value: r.engagement.toLocaleString(),
      sub: 'いいね・保存・コメント',
      rate: `エンゲージ率 ${(r.engagementRateUsed * 100).toFixed(1)}%`,
      source: 'HubSpot 2025: 観光業 1.5〜3.0%',
      color: '#a78bfa',
    },
    {
      step: 4,
      title: 'サイト流入',
      value: r.siteVisits.toLocaleString(),
      sub: 'クリック・サイト訪問',
      rate: `CTR ${(r.ctrUsed * 100).toFixed(1)}%`,
      source: '観光業SNS広告CTR平均: 0.8〜1.5%',
      color: '#0ea5e9',
    },
    {
      step: 5,
      title: 'コンバージョン',
      value: r.conversions.toLocaleString(),
      sub: '予約・問い合わせ',
      rate: `CVR ${(r.cvrUsed * 100).toFixed(1)}%`,
      source: `自社サイト1.5〜3% / OTA 3〜5%`,
      color: '#10b981',
    },
    {
      step: 6,
      title: '来訪・売上',
      value: formatJPY(r.revenue),
      sub: `${r.visitors.toLocaleString()}人 × ¥${r.averageSpend.toLocaleString()}`,
      rate: `ノーショー率 5%除外`,
      source: '一人当たり消費額（前提条件で設定）',
      color: '#f59e0b',
    },
  ]
}

export default function FunnelSection({ results }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        施策を確定するとファネル分析が表示されます。
      </div>
    )
  }

  const current = results[activeIdx]
  const cards = buildFunnelCards(current)

  return (
    <div className="p-5 space-y-5">

      {/* 施策タブ（複数の場合） */}
      {results.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {results.map((r, i) => (
            <button
              key={r.strategyId}
              onClick={() => setActiveIdx(i)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeIdx === i
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {i + 1}. {r.strategyName.slice(0, 14)}
            </button>
          ))}
        </div>
      )}

      {/* 施策名・予算 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">施策名</p>
          <p className="text-sm font-bold text-slate-800">{current.strategyName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">投入予算</p>
          <p className="text-sm font-bold text-indigo-700">{formatJPY(current.budget)}</p>
        </div>
      </div>

      {/* ファネルカード 3+3 */}
      <div className="space-y-3">
        {/* 行1: ステップ1〜3 */}
        <div className="grid grid-cols-3 gap-2">
          {cards.slice(0, 3).map((card, i) => (
            <div key={card.step} className="flex items-stretch gap-0">
              <FunnelCard card={card} />
              {i < 2 && (
                <div className="flex items-center px-1">
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* 矢印（行間） */}
        <div className="flex justify-center">
          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {/* 行2: ステップ4〜6 */}
        <div className="grid grid-cols-3 gap-2">
          {cards.slice(3, 6).map((card, i) => (
            <div key={card.step} className="flex items-stretch gap-0">
              <FunnelCard card={card} />
              {i < 2 && (
                <div className="flex items-center px-1">
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 転換率サマリー */}
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3">各ステップの転換率</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { from: 'インプレッション', to: 'リーチ', rate: (1 / 3 * 100).toFixed(0), unit: '%' },
            { from: 'インプレッション', to: 'サイト流入', rate: (current.ctrUsed * 100).toFixed(1), unit: '%' },
            { from: 'サイト流入', to: '予約', rate: (current.cvrUsed * 100).toFixed(1), unit: '%' },
          ].map(item => (
            <div key={item.to} className="bg-white rounded-lg p-2.5 text-center border border-slate-100">
              <p className="text-slate-400 text-[10px] leading-tight">{item.from} →</p>
              <p className="font-bold text-slate-700">{item.rate}{item.unit}</p>
              <p className="text-slate-500 text-[10px]">{item.to}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FunnelCard({ card }: { card: FunnelCard }) {
  const [showSource, setShowSource] = useState(false)

  return (
    <div className="flex-1 border border-slate-200 rounded-xl p-3 hover:shadow-sm transition-shadow relative">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
          style={{ backgroundColor: card.color }}>
          {card.step}
        </div>
        <p className="text-[10px] font-semibold text-slate-600 truncate">{card.title}</p>
      </div>
      <p className="text-base font-extrabold text-slate-800 leading-tight mb-0.5">{card.value}</p>
      <p className="text-[10px] text-slate-500 mb-1.5">{card.sub}</p>
      {card.rate && (
        <div className="inline-flex items-center gap-1 bg-slate-50 rounded px-1.5 py-0.5 border border-slate-100">
          <p className="text-[9px] text-slate-500 font-medium">{card.rate}</p>
        </div>
      )}
      <button
        onClick={() => setShowSource(!showSource)}
        className="absolute top-2 right-2 w-4 h-4 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-[9px] cursor-pointer"
        title="出典"
      >
        ?
      </button>
      {showSource && (
        <div className="absolute top-7 right-0 z-10 bg-white border border-slate-200 rounded-lg p-2 shadow-lg text-[10px] text-slate-600 w-40">
          {card.source}
        </div>
      )}
    </div>
  )
}
