'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Client } from '@/lib/data'
import type { StrategyData, StrategyMessage } from '@/lib/types/strategy'
import AIStrategyAnalysis from './AIStrategyAnalysis'
import {
  fetchStrategyData,
  saveStrategyData,
  saveStrategyMessages,
  confirmStrategies,
} from '@/lib/actions/strategy'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface UploadedFile {
  id: string
  name: string
  type: string
  content: string
  size: number
}

export default function AIStrategyTab({ client }: { client: Client }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [userMsgCount, setUserMsgCount] = useState(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初期データ読み込み
  useEffect(() => {
    fetchStrategyData(client.id).then(data => {
      if (data.strategyData) setStrategyData(data.strategyData)
      if (data.messages.length > 0) {
        setMessages(data.messages.map((m, i) => ({
          id: `loaded-${i}`,
          role: m.role,
          content: m.content,
        })))
        setUserMsgCount(data.messages.filter(m => m.role === 'user').length)
      } else {
        // 初回挨拶
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: `こんにちは！${client.name}のインバウンドマーケティング戦略を一緒に考えていきましょう。\n\n観光資源に関する資料（パンフレット・観光統計・プレスリリースなど）をお持ちでしたら、まずアップロードしていただくと分析が深まります。もちろん、資料なしでも会話ベースで進められます。\n\nまず、${client.region}でどんな観光資源が特にアピールできると思いますか？`,
        }])
      }
      if (data.shareToken) setShareToken(data.shareToken)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  // チャット末尾に自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // メッセージの自動保存（2秒デバウンス）
  useEffect(() => {
    if (messages.length <= 1) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const stratMsgs: StrategyMessage[] = messages.map(m => ({ role: m.role, content: m.content }))
      saveStrategyMessages(client.id, stratMsgs).catch(() => {})
    }, 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [messages, client.id])

  // =================== メッセージ送信 ===================
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputText('')
    setUserMsgCount(c => c + 1)
    setIsLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/ai-strategy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          client,
          uploadedFiles: uploadedFiles.map(f => ({ name: f.name, content: f.content })),
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // =================== 分析更新 ===================
  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/ai-strategy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          client,
          uploadedFiles: uploadedFiles.map(f => ({ name: f.name, content: f.content })),
        }),
      })
      if (!res.ok) throw new Error('Analyze failed')
      const data = await res.json()
      if (data.strategyData) {
        setStrategyData(data.strategyData)
        await saveStrategyData(client.id, data.strategyData)
        setMessages(prev => [...prev, {
          id: `upd-${Date.now()}`,
          role: 'assistant',
          content: '右カラムの分析結果を更新しました！内容を確認して、修正・追加情報があれば教えてください。',
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `erranl-${Date.now()}`,
        role: 'assistant',
        content: '分析中にエラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }

  // =================== ファイルアップロード ===================
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    for (const file of arr) {
      if (uploadedFiles.find(f => f.name === file.name)) continue
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/ai-strategy/parse-file', { method: 'POST', body: formData })
        const data = await res.json()

        const newFile: UploadedFile = {
          id: `f-${Date.now()}`,
          name: file.name,
          type: file.type,
          content: data.text || '',
          size: file.size,
        }
        setUploadedFiles(prev => {
          const updated = [...prev, newFile]

          // ファイルを読んで要約させる
          setIsLoading(true)
          const currentMsgs = [...messages, {
            id: `fn-${Date.now()}`, role: 'assistant' as const,
            content: `「${file.name}」を読み込みました。内容を確認しています...`,
          }]
          setMessages(currentMsgs)

          fetch('/api/ai-strategy/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: currentMsgs.map(m => ({ role: m.role, content: m.content })),
              client,
              uploadedFiles: updated.map(f => ({ name: f.name, content: f.content })),
              instruction: `「${file.name}」の内容を200字程度で要約し、「こういう理解で合っていますか？」と確認してください。`,
            }),
          })
            .then(r => r.json())
            .then(d => {
              setMessages(prev => [...prev, { id: `fs-${Date.now()}`, role: 'assistant', content: d.content }])
            })
            .catch(() => {})
            .finally(() => setIsLoading(false))

          return updated
        })
      } catch {
        console.error('File parse error')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, messages, client])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // =================== 施策確定 ===================
  const handleConfirm = async () => {
    const selected = strategyData?.strategies.filter(s => s.selected) ?? []
    if (selected.length === 0) return
    setIsConfirming(true)
    try {
      await confirmStrategies(client.id, selected)
      setMessages(prev => [...prev, {
        id: `conf-${Date.now()}`,
        role: 'assistant',
        content: `${selected.length}件の施策を確定しました。「ROI試算」「スケジュール」タブに自動反映されています。`,
      }])
    } catch {
      console.error('Confirm error')
    } finally {
      setIsConfirming(false)
    }
  }

  // =================== 共有URL ===================
  const handleGenerateShare = async () => {
    try {
      const res = await fetch('/api/ai-strategy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })
      const data = await res.json()
      setShareToken(data.token)
    } catch { console.error('Share error') }
  }

  const handleCopyShare = () => {
    if (!shareToken) return
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const toggleStrategy = (id: string) => {
    setStrategyData(prev => prev ? {
      ...prev,
      strategies: prev.strategies.map(s => s.id === id ? { ...s, selected: !s.selected } : s),
    } : null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // =================== RENDER ===================
  return (
    <div className="flex gap-5" style={{ height: 'calc(100vh - 280px)', minHeight: 620 }}>

      {/* ============ 左カラム: チャット ============ */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ width: '40%' }}>

        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">AI戦略アドバイザー</h3>
              <p className="text-xs text-slate-500">観光インバウンドマーケティング専門家</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">オンライン</span>
            </div>
          </div>
        </div>

        {/* ファイルアップロードエリア */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <div
            className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-5 h-5 mx-auto mb-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs text-slate-500">資料をドラッグ＆ドロップ、またはクリックしてアップロード</p>
            <p className="text-xs text-slate-400 mt-0.5">PDF・Word・テキストに対応</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />

          {uploadedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploadedFiles.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate flex-1 font-medium">{f.name}</span>
                  <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                  <button
                    onClick={e => { e.stopPropagation(); setUploadedFiles(prev => prev.filter(x => x.id !== f.id)) }}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mr-2 shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 分析更新ボタン */}
        {userMsgCount >= 3 && (
          <div className="px-4 py-2 border-t border-slate-100">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  AIが分析中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  分析を更新する
                </>
              )}
            </button>
          </div>
        )}

        {/* 入力エリア */}
        <div className="px-4 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleTextarea}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力... (Enterで送信・Shift+Enterで改行)"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent min-h-[40px] max-h-[120px] disabled:bg-slate-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ============ 右カラム: 分析結果 ============ */}
      <div className="flex-1 overflow-y-auto">
        {strategyData ? (
          <AIStrategyAnalysis
            strategyData={strategyData}
            onToggleStrategy={toggleStrategy}
            onConfirmStrategies={handleConfirm}
            onGenerateShareUrl={handleGenerateShare}
            onCopyShareUrl={handleCopyShare}
            shareToken={shareToken}
            copiedUrl={copiedUrl}
            isConfirming={isConfirming}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
                <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-base font-semibold text-slate-700 mb-2">分析レポートを生成しましょう</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                左のAIと会話を重ねることで、観光資源・市場データ・ブランディングストーリー・施策提案がここにリアルタイムで構築されます。
              </p>
              <p className="text-xs text-indigo-500 mt-3 font-medium">
                3回以上会話すると「分析を更新する」ボタンが現れます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
