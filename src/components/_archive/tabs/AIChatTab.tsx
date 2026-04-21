'use client'

import { useState, useRef, useEffect } from 'react'
import { saveChatMessage, fetchChatMessages } from '@/lib/actions/chat'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { Client } from '@/lib/data'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content: 'こんにちは！観光インバウンドマーケティングの専門家AIアシスタントです。クライアントの観光資源・ターゲット市場・予算をもとに、戦略立案・市場分析などをサポートします。どのようなことについて壁打ちしましょうか？',
  timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
}

const SUGGESTED_PROMPTS = [
  'このクライアントに最適なターゲット市場はどこでしょうか？',
  '欧米市場向けのSNSマーケティング戦略を提案してください',
  '競合他社と差別化できるポイントを教えてください',
  'KPI設定のアドバイスをお願いします',
  'インフルエンサー施策の効果的な進め方を教えてください',
]

function rowToMessage(row: { id: string; role: 'user' | 'assistant'; content: string; created_at: string }): Message {
  return {
    id:        row.id,
    role:      row.role,
    content:   row.content,
    timestamp: new Date(row.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function AIChatTab({ client }: { client: Client }) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabaseReady = isSupabaseReady()

  // チャット履歴の初期ロード
  useEffect(() => {
    if (!supabaseReady || historyLoaded) return
    setHistoryLoaded(true)

    fetchChatMessages(client.id).then(rows => {
      if (rows.length > 0) {
        setMessages([INITIAL_MESSAGE, ...rows.map(rowToMessage)])
      }
    })
  }, [client.id, supabaseReady, historyLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || isLoading) return
    setError(null)

    const userMsg: Message = {
      id:        Date.now().toString(),
      role:      'user',
      content:   input.trim(),
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    const userText = input.trim()
    setInput('')
    setIsLoading(true)

    // DBに保存（サイレント）
    await saveChatMessage({ clientId: client.id, role: 'user', content: userText })

    // 過去の会話履歴を構築（initメッセージ除く）
    const history = messages
      .filter(m => m.id !== 'init')
      .map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: userText })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, client }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'エラーが発生しました')
        setIsLoading(false)
        return
      }

      const aiMsg: Message = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   data.content,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, aiMsg])

      // AIメッセージもDB保存
      await saveChatMessage({ clientId: client.id, role: 'assistant', content: data.content })
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">AIアシスタント</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            観光マーケティング専門家として対話します
            {supabaseReady && <span className="ml-2 text-emerald-600">· 会話履歴を保存中</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">Claude API</span>
        </div>
      </div>

      {/* クライアントコンテキスト表示 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 shrink-0">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            <strong>{client.name}</strong> の情報（地域: {client.region}・市場: {client.targetMarket}・予算: {client.budget}）をコンテキストとして渡しています。
          </p>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 shrink-0">
          {error}
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              msg.role === 'assistant' ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {msg.role === 'assistant' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              ) : 'あ'}
            </div>
            <div className={`max-w-[75%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'assistant'
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                {msg.content}
              </div>
              <span className="text-xs text-slate-400 px-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* サジェストプロンプト */}
      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap mb-3 shrink-0">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => setInput(p)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* 入力エリア */}
      <div className="flex gap-3 items-end shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Shift+Enterで改行)"
          rows={2}
          className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
