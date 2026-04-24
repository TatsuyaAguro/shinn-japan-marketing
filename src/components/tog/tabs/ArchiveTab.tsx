'use client'

import { useState, useRef, useCallback } from 'react'
import type { TogCase } from '@/lib/types/tog'
import { CSV_COLUMN_MAP } from '@/lib/types/tog'
import { bulkInsertTogCases } from '@/lib/actions/tog'

interface Props {
  cases: TogCase[]
  onRefresh: () => void
}

type SortKey = 'name' | 'organization' | 'prefecture' | 'budget' | 'deadline' | 'winner'

function formatBudget(n: number): string {
  if (n === 0) return '─'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億円`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}万円`
  return `${n.toLocaleString()}円`
}

// CSV パース（シンプル実装・ダブルクォート対応）
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

export default function ArchiveTab({ cases, onRefresh }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('deadline')
  const [sortDesc, setSortDesc] = useState(true)
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState(false)
  const [csvStep, setCsvStep] = useState<'idle' | 'mapping' | 'importing' | 'done'>('idle')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [colMap, setColMap] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisText, setAnalysisText] = useState<Record<string, string>>({})
  const [scoring, setScoring] = useState(false)
  const [scoreProgress, setScoreProgress] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── ソート・フィルタ ─────────────────────────────────────────
  const sorted = [...cases]
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) ||
        c.organization.toLowerCase().includes(q) ||
        c.prefecture.toLowerCase().includes(q) ||
        c.winner.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let v = 0
      if (sortKey === 'budget') v = (a.budget ?? 0) - (b.budget ?? 0)
      else v = (a[sortKey] ?? '').toString().localeCompare((b[sortKey] ?? '').toString())
      return sortDesc ? -v : v
    })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  const ThBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
    >
      {label}
      {sortKey === k && <span>{sortDesc ? '↓' : '↑'}</span>}
    </button>
  )

  // ─── CSV ドロップ ─────────────────────────────────────────────
  const processFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) return
      const headers = rows[0]
      setCsvHeaders(headers)
      setCsvRows(rows.slice(1))
      // 自動マッピング
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ─── インポート実行 ───────────────────────────────────────────
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

  // ─── AIスコアリング（インポート済み案件を一括スコアリング）────
  const handleBatchScore = async () => {
    // スコア 0 の案件（未スコアリング）を対象にする
    const unscored = cases.filter(c => c.aiScore === 0)
    if (unscored.length === 0) {
      setScoreProgress('スコアリング対象の案件がありません（ai_score=0 の案件のみ対象）')
      return
    }

    setScoring(true)
    setScoreProgress(`${unscored.length}件をAIスコアリング中...`)

    // 10件ずつ分割して処理
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
            cases: chunk.map(c => ({
              name: c.name,
              organization: c.organization,
              description: c.description,
              category: c.category,
            })),
            updateIds: chunk.map(c => c.id),
          }),
        })
        const data = await res.json()
        if (data.error) {
          setScoreProgress(`エラー: ${data.error}`)
          break
        }
        totalUpdated += data.updatedCount ?? 0
      } catch (e) {
        setScoreProgress(`エラー: ${String(e)}`)
        break
      }
    }

    setScoring(false)
    setScoreProgress(`完了: ${totalUpdated}件のスコアを更新しました`)
    onRefresh()
  }

  // ─── 勝者分析 ─────────────────────────────────────────────────
  const handleAnalyzeWinner = async (c: TogCase) => {
    setAnalyzing(c.id)
    try {
      const res = await fetch('/api/tog/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          togCase: c,
          messages: [{
            role: 'user',
            content: `この案件の落札者「${c.winner}」の勝因と、次回の類似案件での提案戦略を分析してください。`,
          }],
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
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="案件名・発注元・都道府県・落札者で検索"
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          CSVインポート
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        <button
          onClick={handleBatchScore}
          disabled={scoring}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {scoring ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
          AIスコアリング
        </button>
        {scoreProgress && (
          <span className="text-xs text-slate-500">{scoreProgress}</span>
        )}
        <span className="text-xs text-slate-400 ml-auto">{sorted.length}件</span>
      </div>

      {/* CSV ドロップゾーン */}
      {csvStep === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm text-slate-500">CSVファイルをここにドロップ、またはクリックして選択</p>
          <p className="text-xs text-slate-400 mt-1">対応カラム: 都道府県, 公示元名, 案件名, 案件種類, 提案上限額, 落札者, 募集日 など</p>
        </div>
      )}

      {/* マッピング UI */}
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
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              インポート実行
            </button>
            <button
              onClick={() => { setCsvStep('idle'); setCsvHeaders([]); setCsvRows([]) }}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors"
            >
              キャンセル
            </button>
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
          <p className="text-sm text-emerald-700 font-semibold">
            インポート完了: 成功 {importResult.success}件 / エラー {importResult.errors}件
          </p>
          <button onClick={() => { setCsvStep('idle'); setImportResult(null) }} className="text-xs text-emerald-600 hover:underline">閉じる</button>
        </div>
      )}

      {/* テーブル */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-400">過去案件がありません。CSVからインポートしてください。</p>
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
              {sorted.map((c, i) => (
                <>
                  <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 line-clamp-1">{c.name}</p>
                      {c.category && <p className="text-xs text-slate-400 mt-0.5">{c.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell">{c.organization || '─'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{c.prefecture || '─'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-medium hidden lg:table-cell">{formatBudget(c.budget ?? 0)}</td>
                    <td className="px-4 py-3">
                      {c.winner ? (
                        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">{c.winner}</span>
                      ) : (
                        <span className="text-xs text-slate-400">─</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{c.deadline ?? '─'}</td>
                    <td className="px-4 py-3 text-right">
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
