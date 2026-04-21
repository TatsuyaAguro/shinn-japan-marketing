'use client'

import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import type { Client } from '@/lib/data'
import { fetchAnalysis, saveAnalysis } from '@/lib/actions/analyses'

// ── 型定義 ──────────────────────────────────────────────────────────────────

interface CountryProfile {
  country: string
  visitors: string
  avgStayDays: string
  avgSpend: string
  interests: string[]
  individualRate: string
  repeaterRate: string
  searchKeywords: string[]
}

interface StrategyOutput {
  strengths: string[]
  countryApproaches: { country: string; approach: string }[]
  proposals: { title: string; detail: string }[]
  risks: string[]
  generatedAt: string
}

// ── 定数 ────────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  'アメリカ': '🇺🇸', 'フランス': '🇫🇷', 'ドイツ': '🇩🇪', 'イギリス': '🇬🇧',
  'カナダ': '🇨🇦', 'オーストラリア': '🇦🇺', '韓国': '🇰🇷', '台湾': '🇹🇼',
  '香港': '🇭🇰', '中国': '🇨🇳', 'シンガポール': '🇸🇬', 'タイ': '🇹🇭',
  'マレーシア': '🇲🇾', 'インドネシア': '🇮🇩', 'ベトナム': '🇻🇳',
  'イタリア': '🇮🇹', 'スペイン': '🇪🇸', 'オランダ': '🇳🇱',
  'ニュージーランド': '🇳🇿', 'インド': '🇮🇳',
}

const REGION_MAP: Record<string, string[]> = {
  '欧米': ['アメリカ', 'フランス', 'ドイツ', 'イギリス', 'カナダ'],
  '欧州': ['フランス', 'ドイツ', 'イギリス', 'イタリア', 'スペイン'],
  '北米': ['アメリカ', 'カナダ'],
  'オーストラリア': ['オーストラリア'],
  '東アジア': ['韓国', '台湾', '香港', '中国'],
  '東南アジア': ['シンガポール', 'タイ', 'マレーシア', 'インドネシア', 'ベトナム'],
  'アジア': ['韓国', '台湾', '中国', 'シンガポール', 'タイ'],
  '全世界': ['アメリカ', 'フランス', 'ドイツ', 'オーストラリア', '韓国', '中国'],
}

const VISITOR_DATA = [
  { market: 'フランス', visitors: 42000, growth: 18 },
  { market: 'アメリカ', visitors: 38000, growth: 12 },
  { market: 'ドイツ', visitors: 29000, growth: 22 },
  { market: 'オーストラリア', visitors: 24000, growth: 15 },
  { market: 'イギリス', visitors: 21000, growth: 8 },
  { market: 'カナダ', visitors: 16000, growth: 19 },
]

const TREND_DATA = [
  { month: '10月', searches: 3200, sns: 1800 },
  { month: '11月', searches: 4100, sns: 2200 },
  { month: '12月', searches: 5800, sns: 3100 },
  { month: '1月', searches: 4200, sns: 2600 },
  { month: '2月', searches: 4800, sns: 3400 },
  { month: '3月', searches: 6200, sns: 4500 },
]

const MARKET_SHARE = [
  { name: '欧州', value: 42, color: '#3b82f6' },
  { name: '北米', value: 29, color: '#8b5cf6' },
  { name: 'オセアニア', value: 16, color: '#06b6d4' },
  { name: 'その他', value: 13, color: '#e2e8f0' },
]

const SNS_METRICS = [
  { platform: 'Instagram', mentions: '12,400', sentiment: 92, color: 'bg-pink-500', icon: '📸' },
  { platform: 'YouTube', mentions: '8,200', sentiment: 88, color: 'bg-red-500', icon: '▶️' },
  { platform: 'TikTok', mentions: '6,700', sentiment: 85, color: 'bg-slate-800', icon: '🎵' },
  { platform: 'X (Twitter)', mentions: '4,100', sentiment: 79, color: 'bg-sky-500', icon: '𝕏' },
]

const COMPETITORS = [
  { name: '大阪観光局', budget: 85, digital: 72, reach: 91 },
  { name: '東京観光財団', budget: 95, digital: 88, reach: 96 },
  { name: '北海道観光局', budget: 60, digital: 55, reach: 68 },
  { name: '当クライアント', budget: 70, digital: 80, reach: 75 },
]

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function expandTargetMarkets(targetMarket: string): string[] {
  const result: string[] = []
  for (const [region, countries] of Object.entries(REGION_MAP)) {
    if (targetMarket.includes(region)) {
      for (const c of countries) {
        if (!result.includes(c)) result.push(c)
      }
    }
  }
  if (result.length > 0) return result.slice(0, 6)
  return targetMarket.split(/[・,、\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 6)
}

function parseCSV(text: string): CountryProfile[] {
  const lines = text.split('\n').filter(l => l.trim())
  const dataLines = lines[0].startsWith('国名') ? lines.slice(1) : lines
  return dataLines
    .map(line => {
      const cols = line.split(',')
      return {
        country: cols[0]?.trim() ?? '',
        visitors: cols[1]?.trim() ?? '',
        avgStayDays: cols[2]?.trim() ?? '',
        avgSpend: cols[3]?.trim() ?? '',
        interests: (cols[4] ?? '').split('/').map(s => s.trim()).filter(Boolean),
        individualRate: cols[5]?.trim() ?? '',
        repeaterRate: cols[6]?.trim() ?? '',
        searchKeywords: (cols[7] ?? '').split('/').map(s => s.trim()).filter(Boolean),
      }
    })
    .filter(p => p.country)
}

function emptyProfile(country: string): CountryProfile {
  return { country, visitors: '', avgStayDays: '', avgSpend: '', interests: [], individualRate: '', repeaterRate: '', searchKeywords: [] }
}

// ── コンポーネント ────────────────────────────────────────────────────────────

export default function MarketAnalysisTab({ client }: { client: Client }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [countryProfiles, setCountryProfiles] = useState<CountryProfile[]>([])
  const [loadingCountry, setLoadingCountry] = useState<string | null>(null)
  const [editingCountry, setEditingCountry] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<CountryProfile | null>(null)
  const [addingCountry, setAddingCountry] = useState(false)
  const [newCountryName, setNewCountryName] = useState('')

  const [fieldInsights, setFieldInsights] = useState('')
  const [savingInsights, setSavingInsights] = useState(false)
  const [insightsSaved, setInsightsSaved] = useState(false)

  const [strategy, setStrategy] = useState<StrategyOutput | null>(null)
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)

  const [profileError, setProfileError] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const insightsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 初期ロード ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [profilesContent, insightsContent, strategyContent] = await Promise.all([
        fetchAnalysis(client.id, 'country_profiles'),
        fetchAnalysis(client.id, 'field_insights'),
        fetchAnalysis(client.id, 'ai_strategy'),
      ])

      if (profilesContent) {
        try { setCountryProfiles(JSON.parse(profilesContent)) } catch { /* ignore */ }
      } else {
        // ターゲット市場からデフォルト国リストを生成
        const countries = expandTargetMarkets(client.targetMarket)
        setCountryProfiles(countries.map(emptyProfile))
      }

      if (insightsContent) setFieldInsights(insightsContent)

      if (strategyContent) {
        try { setStrategy(JSON.parse(strategyContent)) } catch { /* ignore */ }
      }
    }
    load()
  }, [client.id, client.targetMarket])

  // ── 国別 AI調査 ───────────────────────────────────────────────────────────
  async function researchCountry(country: string) {
    setLoadingCountry(country)
    setProfileError(null)
    try {
      const res = await fetch('/api/market-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, client }),
      })
      const data = await res.json()
      if (!res.ok) { setProfileError(data.error); return }

      const updated = countryProfiles.map(p => p.country === country ? { ...p, ...data.profile } : p)
      setCountryProfiles(updated)
      await saveAnalysis(client.id, 'country_profiles', JSON.stringify(updated))
    } catch (e) {
      setProfileError('通信エラーが発生しました')
    } finally {
      setLoadingCountry(null)
    }
  }

  // ── 国追加 ────────────────────────────────────────────────────────────────
  function addCountry() {
    const name = newCountryName.trim()
    if (!name || countryProfiles.some(p => p.country === name)) { setAddingCountry(false); return }
    const updated = [...countryProfiles, emptyProfile(name)]
    setCountryProfiles(updated)
    saveAnalysis(client.id, 'country_profiles', JSON.stringify(updated))
    setNewCountryName('')
    setAddingCountry(false)
  }

  function removeCountry(country: string) {
    const updated = countryProfiles.filter(p => p.country !== country)
    setCountryProfiles(updated)
    saveAnalysis(client.id, 'country_profiles', JSON.stringify(updated))
  }

  // ── 手動編集 ──────────────────────────────────────────────────────────────
  function startEdit(profile: CountryProfile) {
    setEditingCountry(profile.country)
    setEditValues({ ...profile })
  }

  function saveEdit() {
    if (!editValues) return
    const updated = countryProfiles.map(p => p.country === editingCountry ? editValues : p)
    setCountryProfiles(updated)
    saveAnalysis(client.id, 'country_profiles', JSON.stringify(updated))
    setEditingCountry(null)
    setEditValues(null)
  }

  // ── CSV アップロード ───────────────────────────────────────────────────────
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length > 0) {
        setCountryProfiles(parsed)
        saveAnalysis(client.id, 'country_profiles', JSON.stringify(parsed))
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  // ── 現場インサイト保存 ────────────────────────────────────────────────────
  function onInsightsChange(value: string) {
    setFieldInsights(value)
    setInsightsSaved(false)
    if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current)
    insightsTimerRef.current = setTimeout(async () => {
      setSavingInsights(true)
      await saveAnalysis(client.id, 'field_insights', value)
      setSavingInsights(false)
      setInsightsSaved(true)
    }, 1500)
  }

  async function saveInsightsNow() {
    if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current)
    setSavingInsights(true)
    await saveAnalysis(client.id, 'field_insights', fieldInsights)
    setSavingInsights(false)
    setInsightsSaved(true)
  }

  // ── AI戦略生成 ────────────────────────────────────────────────────────────
  async function generateStrategy() {
    setGeneratingStrategy(true)
    setStrategyError(null)
    try {
      const res = await fetch('/api/market-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client, countryProfiles, fieldInsights }),
      })
      const data = await res.json()
      if (!res.ok) { setStrategyError(data.error); return }
      setStrategy(data.strategy)
      await saveAnalysis(client.id, 'ai_strategy', JSON.stringify(data.strategy))
    } catch {
      setStrategyError('通信エラーが発生しました')
    } finally {
      setGeneratingStrategy(false)
    }
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">市場分析</h2>
          <p className="text-xs text-slate-500 mt-0.5">JNTO統計 / Google Trends / SNS分析 · AI戦略提案</p>
        </div>
      </div>

      {/* KPIサマリー */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '総訪問者数 (年間)', value: '170,000人', change: '+14%', up: true },
          { label: '平均滞在日数', value: '5.8日', change: '+0.4日', up: true },
          { label: '一人当たり消費', value: '¥182,000', change: '+8%', up: true },
          { label: 'ブランド認知度', value: '34%', change: '-2pt', up: false },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${kpi.up ? 'text-emerald-600' : 'text-red-500'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={kpi.up ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
              </svg>
              前年比 {kpi.change}
            </div>
          </div>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* Section 1: ターゲット市場プロファイル                           */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-700">ターゲット市場プロファイル</h3>
            <p className="text-xs text-slate-400 mt-0.5">各国のインバウンド観光客データ · AIで自動調査 または 手動入力</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              CSVで一括入力
            </button>
            <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
            <button
              onClick={() => setAddingCountry(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              国を追加
            </button>
          </div>
        </div>

        {addingCountry && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <input
              autoFocus
              value={newCountryName}
              onChange={e => setNewCountryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCountry(); if (e.key === 'Escape') setAddingCountry(false) }}
              placeholder="国名を入力（例: イタリア）"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={addCountry} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">追加</button>
            <button onClick={() => setAddingCountry(false)} className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">キャンセル</button>
          </div>
        )}

        {profileError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
            {profileError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {countryProfiles.map(profile => {
            const isLoading = loadingCountry === profile.country
            const isEditing = editingCountry === profile.country
            const flag = COUNTRY_FLAGS[profile.country] ?? '🌍'
            const hasData = !!profile.visitors

            return (
              <div
                key={profile.country}
                className={`relative border rounded-xl p-4 transition-all ${isEditing ? 'border-blue-300 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}`}
              >
                {/* Loading overlay */}
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">AI調査中...</span>
                    </div>
                  </div>
                )}

                {/* Card header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{flag}</span>
                    <span className="text-sm font-semibold text-slate-800">{profile.country}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(profile)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="編集"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeCountry(profile.country)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="削除"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && editValues ? (
                  /* 編集フォーム */
                  <div className="space-y-2.5">
                    {[
                      { label: '訪問者数', key: 'visitors', placeholder: '例: 約42,000人/年' },
                      { label: '平均滞在日数', key: 'avgStayDays', placeholder: '例: 7.2日' },
                      { label: '平均消費額', key: 'avgSpend', placeholder: '例: ¥220,000' },
                      { label: '個人旅行率', key: 'individualRate', placeholder: '例: 68%' },
                      { label: 'リピーター率', key: 'repeaterRate', placeholder: '例: 42%' },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 mb-0.5 block">{label}</label>
                        <input
                          value={(editValues as unknown as Record<string, string>)[key] ?? ''}
                          onChange={e => setEditValues({ ...editValues, [key]: e.target.value })}
                          placeholder={placeholder}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">興味・関心（/区切り）</label>
                      <input
                        value={editValues.interests.join('/')}
                        onChange={e => setEditValues({ ...editValues, interests: e.target.value.split('/').map(s => s.trim()).filter(Boolean) })}
                        placeholder="例: 歴史文化/食体験/伝統工芸/自然"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">検索キーワード（/区切り）</label>
                      <input
                        value={editValues.searchKeywords.join('/')}
                        onChange={e => setEditValues({ ...editValues, searchKeywords: e.target.value.split('/').map(s => s.trim()).filter(Boolean) })}
                        placeholder="例: 京都 着物/温泉/ゲストハウス"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveEdit} className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">保存</button>
                      <button onClick={() => { setEditingCountry(null); setEditValues(null) }} className="flex-1 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">キャンセル</button>
                    </div>
                  </div>
                ) : hasData ? (
                  /* データ表示 */
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: '訪問者数', value: profile.visitors },
                        { label: '平均滞在', value: profile.avgStayDays },
                        { label: '平均消費', value: profile.avgSpend },
                        { label: 'リピーター', value: profile.repeaterRate },
                      ].map(stat => (
                        <div key={stat.label} className="bg-slate-50 rounded-lg p-2">
                          <p className="text-xs text-slate-400">{stat.label}</p>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{stat.value || '—'}</p>
                        </div>
                      ))}
                    </div>
                    {profile.interests.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-400 mb-1">興味・関心</p>
                        <div className="flex flex-wrap gap-1">
                          {profile.interests.map(tag => (
                            <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.searchKeywords.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-400 mb-1">検索キーワード</p>
                        <div className="flex flex-wrap gap-1">
                          {profile.searchKeywords.map(kw => (
                            <span key={kw} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => researchCountry(profile.country)}
                      disabled={isLoading}
                      className="w-full py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      再調査
                    </button>
                  </>
                ) : (
                  /* データなし */
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <p className="text-xs text-slate-400">データがありません</p>
                    <button
                      onClick={() => researchCountry(profile.country)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI調査
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {countryProfiles.length === 0 && (
            <div className="col-span-full text-center py-8 text-sm text-slate-400">
              「国を追加」ボタンで市場を追加してください
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* Section 2: 現場インサイト                                       */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">現場インサイト</h3>
            <p className="text-xs text-slate-400 mt-0.5">チームの現地調査・ヒアリング・気づきを記録</p>
          </div>
          <div className="flex items-center gap-2">
            {insightsSaved && !savingInsights && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存済み
              </span>
            )}
            {savingInsights && <span className="text-xs text-slate-400">保存中...</span>}
            <button
              onClick={saveInsightsNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              保存
            </button>
          </div>
        </div>
        <textarea
          value={fieldInsights}
          onChange={e => onInsightsChange(e.target.value)}
          rows={6}
          placeholder="例：
・フランス人旅行者は事前にYouTubeで動画検索する傾向が強い
・個人旅行者はInstagramのハッシュタグで宿泊先を探すケースが多い
・春・秋の繁忙期に個人旅行客が急増しているが、受け入れ体制が追いついていない
・英語対応スタッフが不足しており、コミュニケーションに課題あり"
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50 placeholder-slate-300"
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* Section 3: AI戦略提案                                          */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">AI戦略提案</h3>
            <p className="text-xs text-slate-400 mt-0.5">市場データ・現場インサイトをもとにAIが戦略を分析</p>
          </div>
          <button
            onClick={generateStrategy}
            disabled={generatingStrategy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {generatingStrategy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {strategy ? '再生成' : 'AI戦略を生成'}
              </>
            )}
          </button>
        </div>

        {strategyError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            {strategyError}
          </div>
        )}

        {strategy ? (
          <div className="space-y-5">
            {/* 強み */}
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">強み・差別化ポイント</h4>
              <div className="space-y-2">
                {strategy.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-slate-700">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 国別アプローチ */}
            {strategy.countryApproaches.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">国別アプローチ</h4>
                <div className="space-y-3">
                  {strategy.countryApproaches.map((ca, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="text-lg shrink-0">{COUNTRY_FLAGS[ca.country] ?? '🌍'}</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-0.5">{ca.country}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{ca.approach}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 施策提案 */}
            {strategy.proposals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">施策提案</h4>
                <div className="space-y-3">
                  {strategy.proposals.map((p, i) => (
                    <div key={i} className="border border-violet-100 bg-violet-50/50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-violet-800 mb-1">{p.title}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{p.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* リスク */}
            {strategy.risks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">リスク・課題</h4>
                <div className="space-y-2">
                  {strategy.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-slate-600">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400">
              生成日時: {new Date(strategy.generatedAt).toLocaleString('ja-JP')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <svg className="w-10 h-10 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">「AI戦略を生成」ボタンをクリックすると</p>
            <p className="text-sm">市場データをもとに戦略が提案されます</p>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* 既存セクション: 訪問者数グラフ                                   */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">ターゲット市場別 訪問者数（上位6市場）</h3>
        <p className="text-xs text-slate-400 mb-5">JNTO 2025年統計データより</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={VISITOR_DATA} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="market" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}人`, '訪問者数']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Bar dataKey="visitors" radius={[6, 6, 0, 0]}>
              {VISITOR_DATA.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* トレンド + マーケットシェア */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">検索トレンド × SNSメンション数（月次推移）</h3>
          <p className="text-xs text-slate-400 mb-5">Google Trends / SNSクローリングデータ</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="searches" name="検索数" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="sns" name="SNSメンション" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">市場別シェア</h3>
          <p className="text-xs text-slate-400 mb-2">地域別訪問者構成比</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={MARKET_SHARE} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
                {MARKET_SHARE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, 'シェア']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2">
            {MARKET_SHARE.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-600">{item.name}</span>
                <span className="text-xs font-semibold text-slate-800 ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SNSトレンド */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">SNSトレンド分析</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SNS_METRICS.map(sns => (
            <div key={sns.platform} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{sns.icon}</span>
                <span className="text-sm font-medium text-slate-700">{sns.platform}</span>
              </div>
              <p className="text-xl font-bold text-slate-800 mb-1">{sns.mentions}</p>
              <p className="text-xs text-slate-500 mb-3">メンション数</p>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">好感度</span>
                  <span className="font-semibold text-slate-700">{sns.sentiment}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${sns.color} rounded-full`} style={{ width: `${sns.sentiment}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 競合分析 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">競合分析（スコアカード）</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left font-medium pb-3 pr-4">組織名</th>
                <th className="text-left font-medium pb-3 px-4">予算効率</th>
                <th className="text-left font-medium pb-3 px-4">デジタル活用</th>
                <th className="text-left font-medium pb-3 px-4">リーチ力</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMPETITORS.map(comp => (
                <tr key={comp.name} className={comp.name === '当クライアント' ? 'bg-blue-50' : ''}>
                  <td className={`py-3 pr-4 font-medium ${comp.name === '当クライアント' ? 'text-blue-700' : 'text-slate-700'}`}>
                    {comp.name}
                    {comp.name === '当クライアント' && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">自社</span>}
                  </td>
                  {[comp.budget, comp.digital, comp.reach].map((score, i) => (
                    <td key={i} className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${comp.name === '当クライアント' ? 'bg-blue-500' : 'bg-slate-400'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-8 text-right">{score}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
