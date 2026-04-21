'use client'

import { useState } from 'react'
import type { Client } from '@/lib/data'

const SECTIONS = [
  { id: 'exec_summary', label: 'エグゼクティブサマリー', checked: true, desc: 'プロジェクト概要・目標・期待効果' },
  { id: 'market_analysis', label: '市場分析レポート', checked: true, desc: 'JNTO統計・Google Trends・SNS分析' },
  { id: 'target', label: 'ターゲット市場・ペルソナ', checked: true, desc: '市場別ペルソナ定義・訴求ポイント' },
  { id: 'strategy', label: 'マーケティング戦略', checked: true, desc: 'チャネル戦略・コンテンツ計画・施策ロードマップ' },
  { id: 'roi', label: 'ROI試算・KPI設定', checked: true, desc: '投資対効果の根拠・測定指標' },
  { id: 'competitor', label: '競合分析', checked: false, desc: '競合他社の施策・差別化ポイント' },
  { id: 'case_study', label: '成功事例', checked: false, desc: '類似案件の実績・参考データ' },
  { id: 'timeline', label: '実施スケジュール', checked: true, desc: '月次ガントチャート形式' },
  { id: 'budget', label: '費用明細', checked: true, desc: 'チャネル別予算配分・見積もり' },
]

const HISTORIES = [
  { id: '1', name: '提案書_v1_2026-03-28.pdf', size: '2.4MB', date: '2026-03-28', type: 'pdf', status: 'delivered' },
  { id: '2', name: '提案書_v2_2026-04-01.pptx', size: '5.8MB', date: '2026-04-01', type: 'pptx', status: 'draft' },
]

export default function ProposalTab({ client }: { client: Client }) {
  const [sections, setSections] = useState(SECTIONS)
  const [format, setFormat] = useState<'pdf' | 'pptx'>('pdf')
  const [template, setTemplate] = useState('standard')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s))
  }

  function handleGenerate() {
    setGenerating(true)
    setGenerated(false)
    // 生成処理（次のステップで実装）
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 2500)
  }

  const checkedCount = sections.filter(s => s.checked).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">提案書作成</h2>
          <p className="text-xs text-slate-500 mt-0.5">市場分析・ROI試算・AIチャットの結果を統合して提案書を自動生成します</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左：設定 */}
        <div className="lg:col-span-2 space-y-5">
          {/* 出力形式 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">出力形式</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['pdf', 'pptx'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${format === f ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="text-3xl">{f === 'pdf' ? '📄' : '📊'}</span>
                  <span className={`text-sm font-semibold ${format === f ? 'text-blue-700' : 'text-slate-700'}`}>
                    {f === 'pdf' ? 'PDF' : 'PowerPoint'}
                  </span>
                  <span className="text-xs text-slate-400">{f === 'pdf' ? '印刷・共有向け' : 'プレゼン向け'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* テンプレート */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">テンプレート</h3>
            <div className="space-y-2">
              {[
                { id: 'standard', label: 'スタンダード', desc: 'シンプル・汎用的な構成' },
                { id: 'premium', label: 'プレミアム', desc: 'ビジュアル重視の高品質版' },
                { id: 'simple', label: 'シンプル', desc: 'テキスト中心のエグゼクティブ向け' },
              ].map(t => (
                <label key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${template === t.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="accent-blue-600" />
                  <div>
                    <p className={`text-sm font-medium ${template === t.id ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</p>
                    <p className="text-xs text-slate-400">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* クライアント情報確認 */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">反映される情報</h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between"><span className="text-slate-400">クライアント名</span><span className="font-medium">{client.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">地域</span><span className="font-medium">{client.region}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ターゲット市場</span><span className="font-medium">{client.targetMarket}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">担当者</span><span className="font-medium">{client.manager}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">選択セクション</span><span className="font-semibold text-blue-600">{checkedCount} / {sections.length} 項目</span></div>
            </div>
          </div>
        </div>

        {/* 右：セクション選択 + 生成 */}
        <div className="lg:col-span-3 space-y-5">
          {/* セクション選択 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">含めるセクション</h3>
              <span className="text-xs text-slate-500">{checkedCount} 項目選択中</span>
            </div>
            <div className="space-y-2">
              {sections.map(section => (
                <label
                  key={section.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${section.checked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={section.checked}
                    onChange={() => toggleSection(section.id)}
                    className="mt-0.5 accent-blue-600 w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${section.checked ? 'text-blue-700' : 'text-slate-600'}`}>{section.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{section.desc}</p>
                  </div>
                  {section.checked && (
                    <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* 生成ボタン */}
          <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold">AI自動生成</h4>
                <p className="text-xs text-blue-100">{format.toUpperCase()} · {sections.find(s=>s.id==='standard') ? 'スタンダード' : ''} · {checkedCount}セクション</p>
              </div>
            </div>
            <p className="text-sm text-blue-100 mb-4 leading-relaxed">
              入力済みの市場分析・ROI試算・AIチャットの内容を統合し、
              プロフェッショナルな提案書を自動生成します。
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating || checkedCount === 0}
              className="w-full py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 disabled:opacity-60 transition-colors cursor-pointer text-sm"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  生成中...
                </span>
              ) : generated ? '再生成する' : '提案書を生成する'}
            </button>
          </div>

          {/* 生成完了 */}
          {generated && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-emerald-700">提案書が完成しました！</p>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer">
                  ダウンロード（{format.toUpperCase()}）
                </button>
                <button className="flex-1 py-2.5 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer">
                  プレビューする
                </button>
              </div>
            </div>
          )}

          {/* 過去の提案書 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">過去の生成履歴</h3>
            <div className="space-y-2">
              {HISTORIES.map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <span className="text-2xl">{h.type === 'pdf' ? '📄' : '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{h.name}</p>
                    <p className="text-xs text-slate-400">{h.size} · {h.date}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${h.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {h.status === 'delivered' ? '納品済み' : 'ドラフト'}
                  </span>
                  <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
