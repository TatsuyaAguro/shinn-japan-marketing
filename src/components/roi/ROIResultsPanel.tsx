'use client'

import { useState } from 'react'
import type { Client } from '@/lib/data'
import type {
  ROICalculationResult, IntangibleValues, StrategyROIInput,
  ROIDefaults, SpendBreakdown,
} from '@/lib/roi-calculator'
import PremiseSection    from './sections/PremiseSection'
import FunnelSection     from './sections/FunnelSection'
import ScenariosSection  from './sections/ScenariosSection'
import SummarySection    from './sections/SummarySection'
import IntangibleSection from './sections/IntangibleSection'
import EfficiencySection from './sections/EfficiencySection'
import DiminishingSection from './sections/DiminishingSection'

type SectionId = 'premise' | 'funnel' | 'scenarios' | 'summary' | 'intangible' | 'efficiency' | 'diminishing'

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'premise',     label: '前提条件',   icon: '⚙️' },
  { id: 'funnel',      label: 'ファネル',   icon: '📊' },
  { id: 'scenarios',   label: 'シナリオ',   icon: '🎭' },
  { id: 'summary',     label: 'ROIサマリー', icon: '💰' },
  { id: 'intangible',  label: '見えない価値', icon: '✨' },
  { id: 'efficiency',  label: '施策比較',   icon: '⚡' },
  { id: 'diminishing', label: '収穫逓減',   icon: '📉' },
]

interface Props {
  client: Client
  results: ROICalculationResult[]
  intangible: IntangibleValues
  strategyInputs: StrategyROIInput[]
  defaults: ROIDefaults
  spendBreakdown: SpendBreakdown
  onUpdateInput: (id: string, field: keyof StrategyROIInput, value: unknown) => void
  onUpdateDefault: (field: string, value: number) => void
  onUpdateSpend: (field: keyof SpendBreakdown, value: number) => void
}

export default function ROIResultsPanel({
  client, results, intangible, strategyInputs, defaults, spendBreakdown,
  onUpdateInput, onUpdateDefault, onUpdateSpend,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('summary')

  return (
    <div className="flex flex-col h-full">

      {/* セクションナビ */}
      <div className="shrink-0 border-b border-slate-100 bg-white">
        <div className="flex overflow-x-auto">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 cursor-pointer shrink-0 ${
                activeSection === s.id
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* セクションコンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'premise' && (
          <PremiseSection
            client={client}
            strategyInputs={strategyInputs}
            defaults={defaults}
            spendBreakdown={spendBreakdown}
            onUpdateInput={onUpdateInput}
            onUpdateDefault={onUpdateDefault}
            onUpdateSpend={onUpdateSpend}
          />
        )}
        {activeSection === 'funnel' && <FunnelSection results={results} />}
        {activeSection === 'scenarios' && <ScenariosSection results={results} />}
        {activeSection === 'summary' && <SummarySection results={results} />}
        {activeSection === 'intangible' && (
          <IntangibleSection
            results={results}
            intangible={intangible}
            defaults={defaults}
            spendBreakdown={spendBreakdown}
          />
        )}
        {activeSection === 'efficiency' && <EfficiencySection results={results} />}
        {activeSection === 'diminishing' && (
          <DiminishingSection
            results={results}
            strategyInputs={strategyInputs}
            defaults={defaults}
            spendBreakdown={spendBreakdown}
          />
        )}
      </div>
    </div>
  )
}
