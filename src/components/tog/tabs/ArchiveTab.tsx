'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { TogCase } from '@/lib/types/tog'
import { CSV_COLUMN_MAP } from '@/lib/types/tog'
import { bulkInsertTogCases } from '@/lib/actions/tog'

// ─── Props ────────────────────────────────────────────────────
interface Props {
  archiveCases: TogCase[]   // status='archive' → 過去データベース
  historyCases: TogCase[]   // accepted/rejected/passed_* → 案件（応募履歴）
  onRefresh: () => void
}

type SubTab = 'history' | 'db'
type DbSortKey = 'name' | 'organization' | 'prefecture' | 'budget' | 'deadline' | 'winner'
type HistorySortKey = 'recorded_desc' | 'recorded_asc' | 'pref_asc' | 'pref_desc' | 'result' | 'year_desc' | 'year_asc'

const MEMBERS = ['MARI', 'KS', 'TMD', 'AG', 'JETH', 'SND']

// ─── Utilities ────────────────────────────────────────────────

function formatBudget(n: number | null): string {
  if (!n || n === 0) return '─'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

function getCalendarYear(c: TogCase, useResult = false): string {
  if (useResult && c.resultRecordedAt) return c.resultRecordedAt.slice(0, 4)
  if (c.deadline) return c.deadline.slice(0, 4)
  return c.createdAt?.slice(0, 4) ?? ''
}

function isPassedStatus(status: string): boolean {
  return ['passed_unrelated', 'passed_prep', 'passed', 'dismissed'].includes(status)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        cells.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

// ─── MultiSelectDropdown ──────────────────────────────────────
function MultiSelectDropdown({
  label, options, selected, onChange,
}: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
          selected.length > 0
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {selected.length > 0 ? `${label}(${selected.length})` : label}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[160px] max-h-60 overflow-y-auto">
            {selected.length > 0 && (
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 mb-1 border-b border-slate-100"
              >クリア</button>
            )}
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded-lg">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={e => onChange(e.target.checked ? [...selected, opt] : selected.filter(s => s !== opt))}
                  className="accent-indigo-600"
                />
                <span className="text-xs text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── ResultBadge ──────────────────────────────────────────────
function ResultBadge({ status }: { status: string }) {
  if (status === 'accepted') {
    return <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full whitespace-nowrap">採択</span>
  }
  if (status === 'rejected') {
    return <span className="inline-flex items-center px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full whitespace-nowrap">不採択</span>
  }
  return <span className="inline-flex items-center px-2.5 py-1 bg-slate-400 text-white text-xs font-bold rounded-full whitespace-nowrap">見送り</span>
}

// ─── Sub-A: 案件（応募履歴） ──────────────────────────────────
function HistorySubTab({ cases }: { cases: TogCase[] }) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [prefFilter, setPrefFilter] = useState<string[]>([])
  const [resultFilter, setResultFilter] = useState<string[]>([])
  const [yearFilter, setYearFilter] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [sortKey, setSortKey] = useState<HistorySortKey>('recorded_desc')

  // ─── 統計（フィルタ前・全件）────────────────────────────────
  const acceptedAll = cases.filter(c => c.status === 'accepted')
  const rejectedAll = cases.filter(c => c.status === 'rejected')
  const passedAll   = cases.filter(c => isPassedStatus(c.status))
  const appliedTotal = acceptedAll.length + rejectedAll.length
  const acceptanceRate = appliedTotal > 0 ? Math.round(acceptedAll.length / appliedTotal * 100) : 0
  const totalBudget = acceptedAll.reduce((s, c) => s + (c.budget ?? 0), 0)

  const prefCountMap: Record<string, number> = {}
  acceptedAll.forEach(c => { if (c.prefecture) prefCountMap[c.prefecture] = (prefCountMap[c.prefecture] ?? 0) + 1 })
  const top3 = Object.entries(prefCountMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // ─── フィルタ選択肢 ───────────────────────────────────────────
  const prefOptions = [...new Set(cases.map(c => c.prefecture).filter(Boolean))].sort()
  const yearOptions = [...new Set(cases.map(c => getCalendarYear(c, true)).filter(Boolean))].sort().reverse()

  const RESULT_OPTIONS = [
    { value: 'accepted', label: '採択' },
    { value: 'rejected', label: '不採択' },
    { value: 'passed',   label: '見送り' },
  ]

  const toggleResult = (v: string) =>
    setResultFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const resultBucket = (c: TogCase) =>
    c.status === 'accepted' ? 'accepted' : c.status === 'rejected' ? 'rejected' : 'passed'

  const resultOrder: Record<string, number> = { accepted: 0, rejected: 1, passed: 2 }

  // ─── フィルタ + ソート ─────────────────────────────────────────
  const filtered = [...cases]
    .filter(c => {
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !c.organization.toLowerCase().includes(q)) return false
      }
      if (prefFilter.length > 0 && !prefFilter.includes(c.prefecture)) return false
      if (resultFilter.length > 0 && !resultFilter.includes(resultBucket(c))) return false
      if (yearFilter && getCalendarYear(c, true) !== yearFilter) return false
      if (memberFilter && c.assignedTo !== memberFilter) return false
      return true
    })
    .sort((a, b) => {
      const aDate = a.resultRecordedAt ?? a.createdAt ?? ''
      const bDate = b.resultRecordedAt ?? b.createdAt ?? ''
      switch (sortKey) {
        case 'recorded_asc': return aDate.localeCompare(bDate)
        case 'pref_asc':     return (a.prefecture ?? '').localeCompare(b.prefecture ?? '')
        case 'pref_desc':    return (b.prefecture ?? '').localeCompare(a.prefecture ?? '')
        case 'result':       return (resultOrder[resultBucket(a)] ?? 3) - (resultOrder[resultBucket(b)] ?? 3)
        case 'year_desc':    return getCalendarYear(b, true).localeCompare(getCalendarYear(a, true))
        case 'year_asc':     return getCalendarYear(a, true).localeCompare(getCalendarYear(b, true))
        default:             return bDate.localeCompare(aDate) // recorded_desc
      }
    })

  return (
    <div className="space-y-5">
      {/* ── サマリーカード ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">採択率</p>
          <p className="text-3xl font-bold text-emerald-600">
            {acceptanceRate}<span className="text-base font-semibold text-slate-500">%</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{acceptedAll.length}採択 / {appliedTotal}応募</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">総獲得金額</p>
          <p className="text-2xl font-bold text-indigo-600">{totalBudget > 0 ? formatBudget(totalBudget) : '─'}</p>
          <p className="text-xs text-slate-400 mt-1">採択案件の上限額合計</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-2">採択数TOP都道府県</p>
          {top3.length > 0 ? (
            <ol className="space-y-1">
              {top3.map(([pref, cnt], idx) => (
                <li key={pref} className="flex items-center gap-2 text-xs">
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-white font-bold text-[10px] shrink-0 ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>{idx + 1}</span>
                  <span className="text-slate-700 font-medium truncate">{pref}</span>
                  <span className="text-slate-400 shrink-0">{cnt}件</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-400">─</p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-2">結果内訳</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">採択</span>
              <span className="text-sm font-bold text-slate-800">{acceptedAll.length}件</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">不採択</span>
              <span className="text-sm font-bold text-slate-800">{rejectedAll.length}件</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-2 py-0.5 bg-slate-400 text-white text-xs font-bold rounded-full">見送り</span>
              <span className="text-sm font-bold text-slate-800">{passedAll.length}件</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── フィルタ + ソートバー ───────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="案件名・公示元で検索"
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <MultiSelectDropdown label="都道府県" options={prefOptions} selected={prefFilter} onChange={setPrefFilter} />
        <div className="flex items-center gap-1">
          {RESULT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleResult(opt.value)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                resultFilter.includes(opt.value)
                  ? opt.value === 'accepted' ? 'bg-emerald-500 text-white border-emerald-500'
                    : opt.value === 'rejected' ? 'bg-red-500 text-white border-red-500'
                    : 'bg-slate-500 text-white border-slate-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >{opt.label}</button>
          ))}
        </div>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">全年度</option>
          {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          value={memberFilter}
          onChange={e => setMemberFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">全担当者</option>
          {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as HistorySortKey)}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="recorded_desc">記録日（新→古）</option>
          <option value="recorded_asc">記録日（古→新）</option>
          <option value="pref_asc">都道府県（昇順）</option>
          <option value="pref_desc">都道府県（降順）</option>
          <option value="result">結果順</option>
          <option value="year_desc">年度（新→古）</option>
          <option value="year_asc">年度（古→新）</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length}件</span>
      </div>

      {/* ── カードグリッド ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">
            {cases.length === 0
              ? '応募履歴がありません。案件を採択・不採択・見送りにすると自動で記録されます。'
              : '絞り込み条件に一致する案件がありません。'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(c => {
            const hasPeriod = c.recruitmentDate && c.deadline
            const period = hasPeriod
              ? `${c.recruitmentDate} 〜 ${c.deadline}`
              : (c.deadline ?? '─')
            const periodLabel = hasPeriod ? '公募期間' : '締切日'

            return (
              <div
                key={c.id}
                onClick={() => router.push(`/tog/${c.id}`)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group cursor-pointer"
              >
                {/* カードヘッダー */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                          {c.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{c.prefecture || '─'}</p>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5">
                      <ResultBadge status={c.status} />
                    </div>
                  </div>
                </div>

                {/* カードボディ */}
                <div className="p-5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-400 w-14 shrink-0 pt-px">地域</span>
                    <span className="text-xs font-medium text-slate-700">{c.prefecture || '─'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-400 w-14 shrink-0 pt-px">{periodLabel}</span>
                    <span className="text-xs font-medium text-slate-700">{period}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-B: 過去データベース ──────────────────────────────────
function DatabaseSubTab({
  cases,
  onRefresh,
}: {
  cases: TogCase[]
  onRefresh: () => void
}) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [prefFilter, setPrefFilter] = useState<string[]>([])
  const [orgSearch, setOrgSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [sortKey, setSortKey] = useState<DbSortKey>('deadline')
  const [sortDesc, setSortDesc] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisText, setAnalysisText] = useState<Record<string, string>>({})
  const [scoring, setScoring] = useState(false)
  const [scoreProgress, setScoreProgress] = useState<string | null>(null)

  const [dragging, setDragging] = useState(false)
  const [csvStep, setCsvStep] = useState<'idle' | 'mapping' | 'importing' | 'done'>('idle')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [colMap, setColMap] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prefOptions = [...new Set(cases.map(c => c.prefecture).filter(Boolean))].sort()
  const yearOptions = [...new Set(cases.map(c => getCalendarYear(c)).filter(Boolean))].sort().reverse()

  const filtered = [...cases]
    .filter(c => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.organization.toLowerCase().includes(q) &&
          !c.description.toLowerCase().includes(q) &&
          !c.winner.toLowerCase().includes(q)
        ) return false
      }
      if (prefFilter.length > 0 && !prefFilter.includes(c.prefecture)) return false
      if (orgSearch && !c.organization.toLowerCase().includes(orgSearch.toLowerCase())) return false
      if (yearFilter && getCalendarYear(c) !== yearFilter) return false
      return true
    })
    .sort((a, b) => {
      let v = 0
      if (sortKey === 'budget') v = (a.budget ?? 0) - (b.budget ?? 0)
      else v = (a[sortKey] ?? '').toString().localeCompare((b[sortKey] ?? '').toString())
      return sortDesc ? -v : v
    })

  const handleSort = (key: DbSortKey) => {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  const ThBtn = ({ k, label }: { k: DbSortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
    >
      {label}
      {sortKey === k && <span>{sortDesc ? '↓' : '↑'}</span>}
    </button>
  )

  const processFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) return
      const headers = rows[0]
      setCsvHeaders(headers)
      setCsvRows(rows.slice(1))
      const autoMap: Record<string, string> = {}
      headers.forEach(h => {
        const mapped = CSV_COLUMN_MAP[h]
        if (mapped) autoMap[h] = String(mapped)
      })
      setColMap(autoMap)
      setCsvStep('mapping')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    setCsvStep('importing')
    const importCases = csvRows.map(row => {
      const obj: Record<string, unknown> = {}
      csvHeaders.forEach((h, i) => {
        const field = colMap[h]
        if (!field) return
        const val = row[i] ?? ''
        if (field === 'budget') obj[field] = parseInt(val.replace(/[^\d]/g, ''), 10) || 0
        else obj[field] = val
      })
      return obj
    })
    const result = await bulkInsertTogCases(importCases as Parameters<typeof bulkInsertTogCases>[0])
    setImportResult(result)
    setCsvStep('done')
    onRefresh()
  }

  const handleBatchScore = async () => {
    const unscored = cases.filter(c => c.aiScore === 0)
    if (unscored.length === 0) {
      setScoreProgress('スコアリング対象の案件がありません（ai_score=0 の案件のみ対象）')
      return
    }
    setScoring(true)
    setScoreProgress(`${unscored.length}件をAIスコアリング中...`)
    const CHUNK = 10
    let totalUpdated = 0
    for (let i = 0; i < unscored.length; i += CHUNK) {
      const chunk = unscored.slice(i, i + CHUNK)
      setScoreProgress(`スコアリング中... ${Math.min(i + CHUNK, unscored.length)}/${unscored.length}件`)
      try {
        const res = await fetch('/api/tog/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cases: chunk.map(c => ({ name: c.name, organization: c.organization, description: c.description, category: c.category })),
            updateIds: chunk.map(c => c.id),
          }),
        })
        const data = await res.json()
        if (data.error) { setScoreProgress(`エラー: ${data.error}`); break }
        totalUpdated += data.updatedCount ?? 0
      } catch (e) {
        setScoreProgress(`エラー: ${String(e)}`); break
      }
    }
    setScoring(false)
    setScoreProgress(`完了: ${totalUpdated}件のスコアを更新しました`)
    onRefresh()
  }

  const handleAnalyzeWinner = async (c: TogCase) => {
    setAnalyzing(c.id)
    try {
      const res = await fetch('/api/tog/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          togCase: c,
          messages: [{ role: 'user', content: `この案件の落札者「${c.winner}」の勝因と、次回の類似案件での提案戦略を分析してください。` }],
        }),
      })
      const data = await res.json()
      setAnalysisText(prev => ({ ...prev, [c.id]: data.analysis ?? '分析結果なし' }))
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="案件名・業務内容・落札者で検索"
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <MultiSelectDropdown label="都道府県" options={prefOptions} selected={prefFilter} onChange={setPrefFilter} />
        <input
          type="text"
          value={orgSearch}
          onChange={e => setOrgSearch(e.target.value)}
          placeholder="公示元"
          className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">全年度</option>
          {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          CSVインポート
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
        <button
          onClick={handleBatchScore}
          disabled={scoring}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {scoring
            ? <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          }
          AIスコアリング
        </button>
        {scoreProgress && <span className="text-xs text-slate-500">{scoreProgress}</span>}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length}件</span>
      </div>

      {/* CSV ドロップゾーン */}
      {csvStep === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm text-slate-500">CSVファイルをここにドロップ、またはクリックして選択</p>
          <p className="text-xs text-slate-400 mt-1">対応カラム: 都道府県, 公示元名, 案件名, 案件種類, 提案上限額, 落札者, 募集日 など</p>
        </div>
      )}

      {csvStep === 'mapping' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">カラムマッピング（{csvRows.length}行）</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {csvHeaders.map(h => (
              <div key={h} className="space-y-1">
                <label className="text-xs font-medium text-slate-600">{h}</label>
                <select
                  value={colMap[h] ?? ''}
                  onChange={e => setColMap(prev => ({ ...prev, [h]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">（無視）</option>
                  <option value="name">案件名</option>
                  <option value="organization">公示元名</option>
                  <option value="prefecture">都道府県</option>
                  <option value="category">案件種類</option>
                  <option value="description">業務概要</option>
                  <option value="budget">提案上限額</option>
                  <option value="deadline">締切日</option>
                  <option value="recruitmentDate">募集日</option>
                  <option value="winner">落札者</option>
                  <option value="priority">優先度</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={handleImport} className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">インポート実行</button>
            <button onClick={() => { setCsvStep('idle'); setCsvHeaders([]); setCsvRows([]) }} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">キャンセル</button>
          </div>
        </div>
      )}

      {csvStep === 'importing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-600">インポート中...</p>
        </div>
      )}

      {csvStep === 'done' && importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-emerald-700 font-semibold">インポート完了: 成功 {importResult.success}件 / エラー {importResult.errors}件</p>
          <button onClick={() => { setCsvStep('idle'); setImportResult(null) }} className="text-xs text-emerald-600 hover:underline">閉じる</button>
        </div>
      )}

      {/* テーブル */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">
            {cases.length === 0 ? '過去案件がありません。CSVからインポートしてください。' : '絞り込み条件に一致する案件がありません。'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3"><ThBtn k="name" label="案件名" /></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><ThBtn k="organization" label="公示元" /></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><ThBtn k="prefecture" label="都道府県" /></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><ThBtn k="budget" label="上限額" /></th>
                <th className="text-left px-4 py-3"><ThBtn k="winner" label="落札者" /></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><ThBtn k="deadline" label="締切日" /></th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-28">分析</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c, i) => (
                <>
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                    onClick={() => router.push(`/tog/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 line-clamp-1 hover:text-indigo-600">{c.name}</p>
                      {c.category && <p className="text-xs text-slate-400 mt-0.5">{c.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">{c.organization || '─'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{c.prefecture || '─'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-medium hidden lg:table-cell">{formatBudget(c.budget)}</td>
                    <td className="px-4 py-3">
                      {c.winner
                        ? <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">{c.winner}</span>
                        : <span className="text-xs text-slate-400">─</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{c.deadline ?? '─'}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {c.winner && (
                        <button
                          onClick={() => handleAnalyzeWinner(c)}
                          disabled={analyzing === c.id}
                          className="text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors disabled:opacity-60"
                        >
                          {analyzing === c.id ? '分析中...' : '勝者分析'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {analysisText[c.id] && (
                    <tr key={`${c.id}-analysis`} className="bg-indigo-50/30">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-indigo-700">勝者分析結果 ({c.winner})</p>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{analysisText[c.id]}</p>
                          <button onClick={() => setAnalysisText(prev => { const n = { ...prev }; delete n[c.id]; return n })} className="text-xs text-slate-400 hover:text-slate-600">閉じる</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main: ArchiveTab with SubTabs ───────────────────────────
export default function ArchiveTab({ archiveCases, historyCases, onRefresh }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('history')

  return (
    <div className="space-y-4">
      {/* サブタブナビゲーション */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            subTab === 'history'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          案件
          <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full font-semibold">
            {historyCases.length}
          </span>
        </button>
        <button
          onClick={() => setSubTab('db')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            subTab === 'db'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          過去データベース
          <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full font-semibold">
            {archiveCases.length}
          </span>
        </button>
      </div>

      {/* サブタブコンテンツ */}
      {subTab === 'history' && (
        <HistorySubTab cases={historyCases} />
      )}
      {subTab === 'db' && (
        <DatabaseSubTab cases={archiveCases} onRefresh={onRefresh} />
      )}
    </div>
  )
}
