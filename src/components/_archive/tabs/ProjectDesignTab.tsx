'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Client } from '@/lib/data'
import {
  fetchProjectDesign,
  saveHearingProgress,
  saveAnalysisReport,
  saveFinalReport,
  confirmProjectDesign,
  addSchedulesFromStrategies,
} from '@/lib/actions/project_design'
import type { HearingAnswer, Proposal, AnalysisReport, ProjectDesignStatus } from '@/lib/actions/project_design'

// ── 質問定義 ─────────────────────────────────────────────────────
interface Question {
  id: string
  text: string
  multi: boolean
  options: string[]
  skipIfClientField?: string
}

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'プロジェクトのゴールを教えてください（複数選択可）',
    multi: true,
    options: ['認知度アップ', '予約・売上を増やしたい', '海外エージェントとの繋がりを作りたい', 'SNSフォロワーを増やしたい', 'リピーターを増やしたい', 'ブランディングを確立したい', 'わからない'],
  },
  {
    id: 'q2',
    text: 'ターゲット市場を教えてください（複数選択可）',
    multi: true,
    options: ['欧米豪', 'アジア', '富裕層・高付加価値旅行者', '一般個人旅行者（FIT）', '団体・エージェント経由', 'バックパッカー・若年層', 'わからない'],
    skipIfClientField: 'targetMarket',
  },
  {
    id: 'q3',
    text: '旅行者に刺さると思う興味・関心はどれですか？（複数選択可）',
    multi: true,
    options: ['食体験・料理教室', '伝統文化体験', 'アウトドア・自然体験', '歴史・寺社巡り', '地元交流・ホームステイ', 'アート・工芸品', '温泉・ウェルネス', '酒蔵・ワイナリー巡り', 'わからない'],
  },
  {
    id: 'q4',
    text: '現在の主な集客経路はどれですか？（複数選択可）',
    multi: true,
    options: ['自社サイト予約', 'OTA（Viator・GetYourGuide等）', '海外エージェント', 'SNSからの問い合わせ', '口コミ・紹介', 'まだ集客できていない', 'わからない'],
  },
  {
    id: 'q5',
    text: '現在の一番の課題は何ですか？（複数選択可）',
    multi: true,
    options: ['そもそも認知されていない', '知ってもらっても予約に繋がらない', '英語対応ができていない', 'SNS発信ができていない', 'エージェントとの繋がりがない', 'リピーターが少ない', '季節による波が大きい', 'わからない'],
  },
  {
    id: 'q6',
    text: '競合状況を教えてください（複数選択可）',
    multi: true,
    options: ['近隣の同業他社', '他地域の人気観光地', 'OTA上の類似商品', '競合はあまりいない', 'わからない（AIに調べてほしい）'],
  },
  {
    id: 'q7',
    text: 'SNS・デジタルの現状を教えてください（複数選択可）',
    multi: true,
    options: ['Instagram運用中', 'YouTube運用中', 'TikTok運用中', 'Facebook運用中', '自社サイトあり（英語対応）', '自社サイトあり（日本語のみ）', 'OTAに掲載済み', 'Googleマップの口コミあり', '何もやっていない', 'わからない'],
  },
  {
    id: 'q8',
    text: '予算規模はどのくらいですか？',
    multi: false,
    options: ['100万円以下', '100万〜500万円', '500万〜1,000万円', '1,000万円以上', 'まだ決まっていない', 'AIに最適な予算を提案してほしい'],
    skipIfClientField: 'budget',
  },
  {
    id: 'q9',
    text: 'プロジェクト期間はどのくらいを想定していますか？',
    multi: false,
    options: ['3ヶ月以内', '6ヶ月', '1年間', '1年以上', 'まだ決まっていない', 'AIに最適な期間を提案してほしい'],
  },
]

const STEP_LABELS = ['ヒアリング', '分析レポート', 'フィードバック', '最終確定']

function statusToStep(status: ProjectDesignStatus): number {
  if (status === 'new' || status === 'hearing') return 0
  if (status === 'analysis') return 1
  if (status === 'feedback') return 2
  return 3
}

// ── Stepper ────────────────────────────────────────────────────
function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < currentStep ? 'bg-blue-600 text-white' :
              i === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < currentStep ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${
              i <= currentStep ? 'text-blue-700' : 'text-slate-400'
            }`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${i < currentStep ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── ProposalCard ───────────────────────────────────────────────
function ProposalCard({
  proposal,
  selected,
  onToggle,
  showSelect,
}: {
  proposal: Proposal
  selected?: boolean
  onToggle?: () => void
  showSelect: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`border rounded-xl p-4 transition-all ${
      showSelect && selected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        {showSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-slate-800">{proposal.title}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{proposal.platform}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">{proposal.timeline}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{proposal.budgetEstimate}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{proposal.description}</p>
          {proposal.estimatedEffect && (
            <p className="text-sm text-blue-700 mt-1.5 font-medium">期待効果: {proposal.estimatedEffect}</p>
          )}
          {proposal.steps?.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              実施ステップ{expanded ? 'を閉じる' : 'を見る'}
            </button>
          )}
          {expanded && (
            <ol className="mt-2 space-y-1 pl-1">
              {proposal.steps.map((step, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function ProjectDesignTab({ client }: { client: Client }) {
  const [status, setStatus] = useState<ProjectDesignStatus>('new')
  const [answers, setAnswers] = useState<HearingAnswer[]>([])
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set())
  const [directionSummary, setDirectionSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // hearing state
  const [questionIndex, setQuestionIndex] = useState(0)
  const [currentAnswer, setCurrentAnswer] = useState<{ selected: string[]; freeText: string }>({ selected: [], freeText: '' })
  const autoAdvancedRef = useRef(false)

  // Load saved data
  useEffect(() => {
    fetchProjectDesign(client.id).then(data => {
      if (data) {
        setStatus(data.project_design_status)
        setAnswers(data.hearing_data ?? [])
        setReport(data.analysis_report)
        setDirectionSummary(data.direction_summary ?? '')
        if (data.selected_strategies?.length > 0) {
          setSelectedProposals(new Set(data.selected_strategies.map(s => s.id)))
        }
        if (data.project_design_status === 'confirmed') setConfirmed(true)
        // Resume hearing: jump to next unanswered question
        if (data.project_design_status === 'hearing' && data.hearing_data?.length > 0) {
          const answeredIds = new Set(data.hearing_data.map(a => a.questionId))
          const nextIdx = QUESTIONS.findIndex(q => !answeredIds.has(q.id))
          setQuestionIndex(nextIdx >= 0 ? nextIdx : QUESTIONS.length)
        }
      }
      setLoading(false)
    })
  }, [client.id])

  // Get effective questions (skip if pre-filled from client data)
  const effectiveQuestions = QUESTIONS.filter(q => {
    if (!q.skipIfClientField) return true
    const val = (client as unknown as Record<string, string>)[q.skipIfClientField]
    return !val || val === '未定' || val === ''
  })

  const currentQ = effectiveQuestions[questionIndex]
  const hearingDone = status === 'hearing' && (!currentQ || effectiveQuestions.length === 0)
  const progressPct = effectiveQuestions.length > 0
    ? Math.round((questionIndex / effectiveQuestions.length) * 100)
    : 100

  // Auto-advance to analysis when all hearing questions are answered
  useEffect(() => {
    if (hearingDone && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true
      saveHearingProgress(client.id, answers, 'analysis').then(() => {
        setStatus('analysis')
        autoAdvancedRef.current = false
      })
    }
  }, [hearingDone, client.id, answers])

  function toggleOption(opt: string) {
    setCurrentAnswer(prev => {
      if (currentQ.multi) {
        const next = prev.selected.includes(opt)
          ? prev.selected.filter(o => o !== opt)
          : [...prev.selected, opt]
        return { ...prev, selected: next }
      }
      return { ...prev, selected: [opt] }
    })
  }

  const advanceQuestion = useCallback(async (skip = false) => {
    const answer: HearingAnswer = {
      questionId: currentQ.id,
      selected: skip ? [] : currentAnswer.selected,
      freeText: skip ? '' : currentAnswer.freeText,
      skipped: skip,
    }
    const newAnswers = [...answers.filter(a => a.questionId !== currentQ.id), answer]
    setAnswers(newAnswers)
    setCurrentAnswer({ selected: [], freeText: '' })

    if (questionIndex + 1 < effectiveQuestions.length) {
      setQuestionIndex(questionIndex + 1)
      await saveHearingProgress(client.id, newAnswers, 'hearing')
    } else {
      // Hearing complete
      await saveHearingProgress(client.id, newAnswers, 'analysis')
      setStatus('analysis')
    }
  }, [currentQ, currentAnswer, answers, questionIndex, effectiveQuestions.length, client.id])

  async function generateReport(isRefine = false, isFinal = false) {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/project-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isFinal ? 'generate_final' : isRefine ? 'refine_report' : 'generate_report',
          client: {
            name: client.name,
            region: client.region,
            category: client.category,
            targetMarket: client.targetMarket,
            touristResources: client.touristResources,
            budget: client.budget,
            description: client.description,
          },
          hearingAnswers: answers,
          feedback: isRefine ? feedback : undefined,
          previousReport: isRefine || isFinal ? report : undefined,
          version: (report?.version ?? 0) + 1,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setError(json.error ?? 'レポート生成に失敗しました'); return }

      const newReport: AnalysisReport = {
        ...json.report,
        proposals: Array.isArray(json.report?.proposals) ? json.report.proposals : [],
        version: (report?.version ?? 0) + 1,
        generatedAt: new Date().toISOString(),
        feedbackHistory: isRefine && feedback
          ? [...(report?.feedbackHistory ?? []), { feedback, version: report?.version ?? 1 }]
          : report?.feedbackHistory ?? [],
      }

      if (isFinal) {
        await saveFinalReport(client.id, newReport)
        setReport(newReport)
        setStatus('final')
        setSelectedProposals(new Set(newReport.proposals.map(p => p.id)))
      } else {
        await saveAnalysisReport(client.id, newReport, 'feedback')
        setReport(newReport)
        setStatus('feedback')
        setFeedback('')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }

  async function handleConfirm() {
    if (!report) return
    setGenerating(true)
    const chosen = (report.proposals ?? []).filter(p => selectedProposals.has(p.id))
    const summary = `${report.summary}\n\n【選択した施策】\n${chosen.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n')}`
    const [r1, r2] = await Promise.all([
      confirmProjectDesign(client.id, summary, chosen),
      addSchedulesFromStrategies(client.id, chosen),
    ])
    if (r1.error || r2.error) {
      setError(r1.error ?? r2.error)
    } else {
      setDirectionSummary(summary)
      setStatus('confirmed')
      setConfirmed(true)
    }
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentStep = statusToStep(status)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <Stepper currentStep={currentStep} />

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── 新規 / ウェルカム ── */}
        {status === 'new' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mx-auto mb-4">🧭</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">プロジェクト設計を始めましょう</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              AIがヒアリングを通じてクライアントの状況を深く理解し、最適なインバウンドマーケティング戦略を提案します。
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center text-xs text-slate-500 mb-8">
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">1</span>ヒアリング（約5分）</span>
              <span className="text-slate-300">→</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">2</span>AI分析レポート生成</span>
              <span className="text-slate-300">→</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">3</span>施策を選んで確定</span>
            </div>
            <button
              onClick={() => setStatus('hearing')}
              className="px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
            >
              ヒアリングを始める
            </button>
          </div>
        )}

        {/* ── ヒアリング（全質問回答済み → auto-advanceが走るまでの間） ── */}
        {hearingDone && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">ヒアリング完了を確認中...</p>
          </div>
        )}

        {/* ── ヒアリング ── */}
        {status === 'hearing' && currentQ && !hearingDone && (
          <div>
            {/* Progress bar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 font-medium">Q{questionIndex + 1} / {effectiveQuestions.length}</span>
              <span className="text-xs text-slate-500">{progressPct}%完了</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">{currentQ.text}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {currentQ.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all cursor-pointer ${
                      currentAnswer.selected.includes(opt)
                        ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    {currentAnswer.selected.includes(opt) && (
                      <span className="mr-1.5">✓</span>
                    )}
                    {opt}
                  </button>
                ))}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="その他・補足（自由記述）"
                  value={currentAnswer.freeText}
                  onChange={e => setCurrentAnswer(prev => ({ ...prev, freeText: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => advanceQuestion(true)}
                className="px-4 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                スキップ
              </button>
              <button
                onClick={() => advanceQuestion(false)}
                disabled={currentAnswer.selected.length === 0 && !currentAnswer.freeText}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer"
              >
                {questionIndex + 1 < effectiveQuestions.length ? '次へ →' : 'ヒアリング完了'}
              </button>
            </div>
          </div>
        )}

        {/* ── ヒアリング後 / 分析前 ── */}
        {status === 'analysis' && !report && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ヒアリングが完了しました</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              回答した情報をもとにAIが市場分析と施策案を生成します。<br />
              生成には30〜60秒かかります。
            </p>
            <button
              onClick={() => generateReport()}
              disabled={generating}
              className="px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:bg-blue-400 transition-colors cursor-pointer flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AIが分析中...
                </>
              ) : '分析レポートを生成する'}
            </button>
            <button
              onClick={() => {
                setQuestionIndex(0)
                setCurrentAnswer({ selected: [], freeText: '' })
                setAnswers([])
                setStatus('hearing')
                autoAdvancedRef.current = false
                saveHearingProgress(client.id, [], 'hearing')
              }}
              className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer block mx-auto"
            >
              ヒアリングをやり直す
            </button>
          </div>
        )}

        {/* ── レポート表示 (feedback / final) ── */}
        {(status === 'feedback' || status === 'final') && report && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">分析レポート {report.version > 1 ? `（v${report.version}）` : ''}</h3>
                <p className="text-xs text-slate-400 mt-0.5">生成: {new Date(report.generatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {status === 'feedback' && (
                <button
                  onClick={() => generateReport(false, true)}
                  disabled={generating}
                  className="px-4 py-2 text-xs font-medium text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  最終レポートを生成
                </button>
              )}
            </div>

            {/* サマリー */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">プロジェクト方向性</h4>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{report.summary}</p>
            </div>

            {/* 市場分析 */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">市場分析</h4>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{report.marketAnalysis}</p>
            </div>

            {/* 施策案 */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                施策案（{(report.proposals ?? []).length}件）
                {status === 'final' && <span className="ml-2 text-blue-600 normal-case">チェックを入れた施策を実施します</span>}
              </h4>
              <div className="space-y-3">
                {(report.proposals ?? []).map(p => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    selected={selectedProposals.has(p.id)}
                    onToggle={() => setSelectedProposals(prev => {
                      const next = new Set(prev)
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                      return next
                    })}
                    showSelect={status === 'final'}
                  />
                ))}
              </div>
            </div>

            {/* フィードバック入力 (feedback ステータス時) */}
            {status === 'feedback' && (
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">フィードバック・修正依頼</h4>
                  <button
                    onClick={() => {
                      setQuestionIndex(0)
                      setCurrentAnswer({ selected: [], freeText: '' })
                      setAnswers([])
                      setReport(null)
                      setStatus('hearing')
                      autoAdvancedRef.current = false
                      saveHearingProgress(client.id, [], 'hearing')
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    ヒアリングからやり直す
                  </button>
                </div>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="例：予算はもう少し低め（月20万以下）に。エージェント開拓より先にSNSを強化したい。など..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => generateReport(true)}
                    disabled={generating || !feedback.trim()}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        再生成中...
                      </>
                    ) : 'フィードバックを反映して再生成'}
                  </button>
                  <button
                    onClick={() => generateReport(false, true)}
                    disabled={generating}
                    className="flex-1 py-2.5 text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                  >
                    このレポートで進める
                  </button>
                </div>
              </div>
            )}

            {/* 最終確定ボタン (final ステータス時) */}
            {status === 'final' && (
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-blue-700">{selectedProposals.size}件</span>の施策を選択中
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedProposals(new Set((report.proposals ?? []).map(p => p.id)))} className="text-blue-600 hover:underline cursor-pointer">全選択</button>
                    <button onClick={() => setSelectedProposals(new Set())} className="text-slate-500 hover:underline cursor-pointer">クリア</button>
                  </div>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={generating || selectedProposals.size === 0}
                  className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      確定処理中...
                    </>
                  ) : `選択した${selectedProposals.size}件の施策を確定する`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 確定済み ── */}
        {confirmed && status === 'confirmed' && (
          <div>
            <div className="text-center py-6 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mx-auto mb-3">🎉</div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">プロジェクト設計が完了しました</h3>
              <p className="text-sm text-slate-500">施策がスケジュールタブに追加されました</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">方向性総括</h4>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{directionSummary}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: '概要タブ', icon: '📋', desc: '方向性総括を保存済み' },
                { label: 'スケジュール', icon: '📅', desc: '施策をタスクに追加済み' },
                { label: '市場分析', icon: '📊', desc: 'レポートを確認できます' },
                { label: 'ROI試算', icon: '💰', desc: 'ビジネス設定を入力してください' },
              ].map(item => (
                <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            {report && (
              <>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">確定した施策</h4>
                <div className="space-y-2">
                  {(report.proposals ?? []).filter(p => selectedProposals.has(p.id)).map(p => (
                    <ProposalCard key={p.id} proposal={p} showSelect={false} />
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => {
                setStatus('final')
                setConfirmed(false)
              }}
              className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              施策の選択を変更する
            </button>
          </div>
        )}
      </div>

      {/* ヒアリング回答サマリー（analysis以降で表示） */}
      {currentStep > 0 && answers.filter(a => !a.skipped).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <button
            onClick={() => setStatus('hearing')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">ヒアリング回答サマリー</h3>
              <span className="text-xs text-blue-600 hover:underline cursor-pointer">修正する</span>
            </div>
          </button>
          <div className="mt-3 space-y-2">
            {answers.filter(a => !a.skipped && (a.selected.length > 0 || a.freeText)).map(a => {
              const q = QUESTIONS.find(q => q.id === a.questionId)
              const parts = [...a.selected, ...(a.freeText ? [a.freeText] : [])]
              return (
                <div key={a.questionId} className="flex gap-3 text-xs">
                  <span className="text-slate-400 shrink-0 w-28 truncate">{q?.text.replace('（複数選択可）', '').slice(0, 16)}…</span>
                  <span className="text-slate-700">{parts.join('、')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
