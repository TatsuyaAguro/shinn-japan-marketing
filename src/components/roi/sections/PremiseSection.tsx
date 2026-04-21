'use client'

import { useState } from 'react'
import type { Client } from '@/lib/data'
import type {
  StrategyROIInput, ROIDefaults, SpendBreakdown, ChannelType,
} from '@/lib/roi-calculator'
import { DEFAULT_ROI_VALUES, DEFAULT_SPEND_BREAKDOWN, formatJPY } from '@/lib/roi-calculator'

const CHANNEL_LABELS: Record<ChannelType, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  influencer: 'インフルエンサー',
  event: 'イベント・展示会',
  other: 'その他',
}

interface DefaultField {
  key: string
  label: string
  unit: string
  source: string
  isPercent?: boolean
  step?: number
}

const DEFAULT_FIELDS: DefaultField[] = [
  { key: 'instagramCPM',   label: 'Instagram CPM',     unit: '円', source: 'Meta Business Suite 2025' },
  { key: 'youtubeCPM',     label: 'YouTube CPM',        unit: '円', source: 'Google Ads 2025' },
  { key: 'influencerCPM',  label: 'インフルエンサー CPM', unit: '円', source: '業界平均' },
  { key: 'instagramCTR',   label: 'Instagram CTR',      unit: '', isPercent: true, step: 0.001, source: 'HubSpot 2025' },
  { key: 'youtubeCTR',     label: 'YouTube CTR',         unit: '', isPercent: true, step: 0.001, source: 'Google Ads 2025' },
  { key: 'engagementRate', label: 'エンゲージメント率',    unit: '', isPercent: true, step: 0.001, source: '観光業Instagram平均' },
  { key: 'directCVR',     label: '自社サイト CVR',      unit: '', isPercent: true, step: 0.001, source: '業界平均' },
  { key: 'otaCVR',         label: 'OTA CVR',             unit: '', isPercent: true, step: 0.001, source: '業界平均' },
  { key: 'frequency',      label: 'フリークエンシー',     unit: '回', source: '設定値' },
  { key: 'noShowRate',     label: 'ノーショー率',         unit: '', isPercent: true, step: 0.01, source: '観光予約業界平均' },
  { key: 'accommodationRate', label: '宿泊率',           unit: '', isPercent: true, step: 0.01, source: '推定値' },
]

interface Props {
  client: Client
  strategyInputs: StrategyROIInput[]
  defaults: ROIDefaults
  spendBreakdown: SpendBreakdown
  onUpdateInput: (id: string, field: keyof StrategyROIInput, value: unknown) => void
  onUpdateDefault: (field: string, value: number) => void
  onUpdateSpend: (field: keyof SpendBreakdown, value: number) => void
}

export default function PremiseSection({
  client, strategyInputs, defaults, spendBreakdown,
  onUpdateInput, onUpdateDefault, onUpdateSpend,
}: Props) {
  const [showDefaults, setShowDefaults] = useState(false)
  const [showSpend, setShowSpend] = useState(false)

  const totalBudget = strategyInputs.reduce((s, i) => s + i.budget, 0)

  return (
    <div className="space-y-4 p-5">

      {/* クライアント情報 */}
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">クライアント情報</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">クライアント名</p>
            <p className="font-semibold text-slate-800">{client.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">地域</p>
            <p className="font-semibold text-slate-800">{client.region}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">総予算（施策合計）</p>
            <p className="text-lg font-extrabold text-indigo-700">{formatJPY(totalBudget)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">ターゲット市場</p>
            <p className="font-semibold text-slate-800">{client.targetMarket || '—'}</p>
          </div>
        </div>
      </div>

      {/* 施策別パラメータ */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-3">施策別 予算・チャネル設定</p>
        <div className="space-y-3">
          {strategyInputs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              「AI戦略室」タブで施策を確定すると自動で読み込まれます。
            </p>
          )}
          {strategyInputs.map((inp, idx) => (
            <div key={inp.strategyId} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <p className="text-sm font-semibold text-slate-800">{inp.strategyName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">予算（万円）</label>
                  <input
                    type="number"
                    value={Math.round(inp.budget / 10000)}
                    onChange={e => onUpdateInput(inp.strategyId, 'budget', Number(e.target.value) * 10000)}
                    min={1}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">チャネル</label>
                  <select
                    value={inp.channelType}
                    onChange={e => onUpdateInput(inp.strategyId, 'channelType', e.target.value as ChannelType)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white cursor-pointer"
                  >
                    {(Object.keys(CHANNEL_LABELS) as ChannelType[]).map(k => (
                      <option key={k} value={k}>{CHANNEL_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">コンバージョン経路</label>
                  <select
                    value={inp.cvrType}
                    onChange={e => onUpdateInput(inp.strategyId, 'cvrType', e.target.value as 'direct' | 'ota')}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white cursor-pointer"
                  >
                    <option value="direct">自社サイト直接（CVR 2%）</option>
                    <option value="ota">OTA経由（CVR 4%）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ターゲット国</label>
                  <p className="text-sm text-slate-700 py-1.5">{inp.targetCountries?.join('・') || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 消費額内訳 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSpend(!showSpend)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="text-xs font-semibold text-slate-600">
            来訪者1人当たり消費額内訳
            <span className="ml-2 text-indigo-600">
              合計 {formatJPY(
                spendBreakdown.food + spendBreakdown.shopping + spendBreakdown.experience +
                (spendBreakdown.guideTour + spendBreakdown.accommodation) * defaults.accommodationRate
              )}
            </span>
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showSpend ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showSpend && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            {([
              ['food', '食事代'],
              ['shopping', 'お土産・買物'],
              ['experience', '体験プログラム'],
              ['guideTour', 'ガイドツアー（宿泊者のみ）'],
              ['accommodation', '宿泊代/泊（宿泊者のみ）'],
            ] as [keyof SpendBreakdown, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">¥</span>
                  <input
                    type="number"
                    value={spendBreakdown[key]}
                    onChange={e => onUpdateSpend(key, Number(e.target.value))}
                    min={0}
                    step={500}
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            ))}
            <div className="col-span-2 text-xs text-slate-400 bg-amber-50 rounded-lg px-3 py-2">
              宿泊率 {Math.round(defaults.accommodationRate * 100)}% で加重平均して計算
            </div>
          </div>
        )}
      </div>

      {/* グローバルデフォルト */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDefaults(!showDefaults)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-2">
            業界平均値パラメータ
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">業界平均</span>
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${showDefaults ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showDefaults && (
          <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">
              これらの値は業界平均値です。自社実績データがある場合は上書きしてください。
            </p>
            {DEFAULT_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-700">{f.label}</p>
                  <p className="text-xs text-slate-400">出典: {f.source}</p>
                </div>
                <div className="flex items-center gap-1 w-28">
                  <input
                    type="number"
                    value={f.isPercent
                      ? Math.round((defaults[f.key as keyof ROIDefaults] as number) * 1000) / 10
                      : defaults[f.key as keyof ROIDefaults] as number
                    }
                    onChange={e => onUpdateDefault(f.key, f.isPercent ? Number(e.target.value) / 100 : Number(e.target.value))}
                    step={f.step ?? (f.isPercent ? 0.1 : 100)}
                    min={0}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                  />
                  <span className="text-xs text-slate-400">{f.isPercent ? '%' : f.unit}</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                DEFAULT_FIELDS.forEach(f => onUpdateDefault(f.key, DEFAULT_ROI_VALUES[f.key as keyof typeof DEFAULT_ROI_VALUES] as number))
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 cursor-pointer"
            >
              デフォルト値にリセット
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
