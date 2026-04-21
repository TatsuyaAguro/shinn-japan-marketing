'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Client } from '@/lib/data'
import { STATUS_LABELS, CATEGORY_ICONS } from '@/lib/data'
import OverviewTab from './tabs/OverviewTab'
import AIStrategyTab from './tabs/AIStrategyTab'
import ROICalculatorTab from './tabs/ROICalculatorTab'
import ScheduleTab from './tabs/ScheduleTab'

const TABS = [
  {
    id: 'overview',
    label: '概要',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'ai_strategy',
    label: 'AI戦略室',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    id: 'roi',
    label: 'ROI試算',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    id: 'schedule',
    label: 'スケジュール',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
] as const

type TabId = typeof TABS[number]['id']
const VALID_TAB_IDS = TABS.map(t => t.id) as string[]

export default function ClientDetail({ client, initialTab }: { client: Client; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    (VALID_TAB_IDS.includes(initialTab ?? '') ? initialTab : 'overview') as TabId
  )

  const status = STATUS_LABELS[client.status]
  const icon = CATEGORY_ICONS[client.category] ?? '🏢'

  return (
    <div>
      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <Link href="/home" className="hover:text-blue-600 transition-colors">
          クライアント一覧
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-700 font-medium">{client.name}</span>
      </div>

      {/* クライアントヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-800">{client.name}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${status.className}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {client.region} · {client.category} · 担当: {client.manager}
            </p>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed line-clamp-2">
              {client.description}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400 mb-1">進行中キャンペーン</p>
              <p className="text-2xl font-bold text-blue-600">
                {client.campaigns}
                <span className="text-sm font-normal text-slate-500 ml-1">件</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="bg-white rounded-2xl border border-slate-200 mb-6 overflow-hidden">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all border-b-2 cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? tab.id === 'ai_strategy'
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                    : 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
              {tab.id === 'ai_strategy' && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  NEW
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'overview'    && <OverviewTab client={client} />}
        {activeTab === 'ai_strategy' && <AIStrategyTab client={client} />}
        {activeTab === 'roi'         && <ROICalculatorTab client={client} />}
        {activeTab === 'schedule'    && <ScheduleTab client={client} />}
      </div>
    </div>
  )
}
