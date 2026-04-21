'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Client } from '@/lib/data'
import type {
  StrategyData, StrategyVersion, StrategyMessage, StrategyItem, UploadedFile,
} from '@/lib/types/strategy'
import {
  fetchStrategyState, fetchChatHistory,
  saveStrategyData, saveChatHistory,
  confirmStrategies, generateShareToken, saveUploadedFiles,
} from '@/lib/actions/strategy'
import ChatPanel from './ChatPanel'
import AnalysisPanel from './AnalysisPanel'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

const INIT_MSG = (client: Client): Message => ({
  id: 'init',
  role: 'assistant',
  content: `こんにちは！${client.name}のインバウンドマーケティング戦略を一緒に構築しましょう。\n\n観光資源に関するパンフレット・統計・OTAデータ・プレスリリースなどの資料があれば、まずアップロードしていただくと分析精度が大幅に上がります。\n\nまず教えてください。${client.region}で「これだけは他の地域に絶対負けない」と思っている観光資源や強みはありますか？`,
})

export default function AIStrategyTab({ client }: { client: Client }) {
  const [messages, setMessages]       = useState<Message[]>([])
  const [files, setFiles]             = useState<UploadedFile[]>([])
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null)
  const [versions, setVersions]       = useState<StrategyVersion[]>([])
  const [shareToken, setShareToken]   = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [userMsgCount, setUserMsgCount] = useState(0)
  const [isMobile, setIsMobile]       = useState(false)
  const [mobileView, setMobileView]   = useState<'chat' | 'analysis'>('chat')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── モバイル判定 ──────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── 初期データ読み込み ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchStrategyState(client.id),
      fetchChatHistory(client.id),
    ]).then(([state, chatMsgs]) => {
      if (state.currentData) setStrategyData(state.currentData)
      if (state.versions.length > 0) setVersions(state.versions)
      if (state.shareToken) setShareToken(state.shareToken)
      if (state.uploadedFiles.length > 0) setFiles(state.uploadedFiles)

      if (chatMsgs.length > 0) {
        setMessages(chatMsgs.map((m, i) => ({ id: `loaded-${i}`, role: m.role, content: m.content })))
        setUserMsgCount(chatMsgs.filter(m => m.role === 'user').length)
      } else {
        setMessages([INIT_MSG(client)])
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  // ── チャット履歴の自動保存（デバウンス2秒）────────────────
  useEffect(() => {
    if (messages.length <= 1) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const stratMsgs: StrategyMessage[] = messages.map(m => ({ role: m.role, content: m.content }))
      saveChatHistory(client.id, stratMsgs).catch(() => {})
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [messages, client.id])

  // ── メッセージ送信 ────────────────────────────────────────
  const handleSend = async (text: string) => {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setUserMsgCount(c => c + 1)
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai-strategy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          client,
          files: files.map(f => ({ name: f.name, content: f.extractedText })),
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }])
    } finally {
      setIsLoading(false)
    }
  }

  // ── 分析更新 ──────────────────────────────────────────────
  const handleAnalyze = async (feedback = '') => {
    setIsAnalyzing(true)
    const nextVer = (strategyData?.version ?? 0) + 1

    try {
      const res = await fetch('/api/ai-strategy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          client,
          files: files.map(f => ({ name: f.name, content: f.extractedText })),
          feedback,
          versionNum: nextVer,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newData: StrategyData = data.strategyData

      const newVersion: StrategyVersion = {
        version: nextVer,
        createdAt: new Date().toISOString(),
        label: `v${nextVer} ${feedback ? 'フィードバック反映' : '初回分析'}`,
        feedback,
        data: newData,
      }
      const newVersions = [...versions, newVersion]

      setStrategyData(newData)
      setVersions(newVersions)

      await saveStrategyData(client.id, newData, newVersions)

      setMessages(prev => [...prev, {
        id: `upd-${Date.now()}`, role: 'assistant',
        content: `右の分析レポートを更新しました（v${nextVer}）。内容を確認して、気になる点があればフィードバックを送ってください。`,
      }])
      if (isMobile) setMobileView('analysis')
    } catch {
      setMessages(prev => [...prev, { id: `erranl-${Date.now()}`, role: 'assistant', content: '分析中にエラーが発生しました。もう一度お試しください。' }])
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── ファイルアップロード ───────────────────────────────────
  const handleFileUpload = useCallback(async (fileList: FileList) => {
    const arr = Array.from(fileList)
    for (const file of arr) {
      if (files.find(f => f.name === file.name)) continue
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clientId', client.id)
        const res = await fetch('/api/ai-strategy/upload', { method: 'POST', body: formData })
        const data = await res.json()

        const newFile: UploadedFile = {
          id: `f-${Date.now()}`,
          name: data.name,
          size: data.size,
          type: data.type,
          storagePath: data.storagePath ?? '',
          extractedText: data.extractedText ?? '',
          uploadedAt: new Date().toISOString(),
        }

        setFiles(prev => {
          const updated = [...prev, newFile]
          saveUploadedFiles(client.id, updated).catch(() => {})
          return updated
        })

        // AI に資料の読み込みを通知して要約させる
        setIsLoading(true)
        const notifyMsg: Message = { id: `fn-${Date.now()}`, role: 'assistant', content: `「${file.name}」を読み込みました。内容を確認しています...` }
        const withNotify = [...messages, notifyMsg]
        setMessages(withNotify)

        const chatRes = await fetch('/api/ai-strategy/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: withNotify.map(m => ({ role: m.role, content: m.content })),
            client,
            files: [...files, newFile].map(f => ({ name: f.name, content: f.extractedText })),
          }),
        })
        if (chatRes.ok) {
          const chatData = await chatRes.json()
          setMessages(prev => [...prev, { id: `fs-${Date.now()}`, role: 'assistant', content: chatData.content }])
        }
        setIsLoading(false)
      } catch (err) {
        console.error('File upload error:', err)
        setIsLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, messages, client])

  const handleRemoveFile = (id: string) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id)
      saveUploadedFiles(client.id, updated).catch(() => {})
      return updated
    })
  }

  // ── 施策確定 ──────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!strategyData) return
    const selected = strategyData.strategies.filter(s => s.selected)
    if (selected.length === 0) return
    setIsConfirming(true)
    try {
      await confirmStrategies(
        client.id,
        selected,
        strategyData.brandingStory?.catchphrase ?? '',
        strategyData.directionSummary
      )
      setMessages(prev => [...prev, {
        id: `conf-${Date.now()}`, role: 'assistant',
        content: `${selected.length}件の施策を確定しました！ROI試算・スケジュールタブに自動反映されています。`,
      }])
    } catch { console.error('confirm error') }
    finally { setIsConfirming(false) }
  }

  const handleToggleStrategy = (id: string) => {
    setStrategyData(prev => prev ? {
      ...prev,
      strategies: prev.strategies.map(s => s.id === id ? { ...s, selected: !s.selected } : s),
    } : null)
  }
  const handleSelectAll = () => setStrategyData(prev => prev ? { ...prev, strategies: prev.strategies.map(s => ({ ...s, selected: true })) } : null)
  const handleClearAll = () => setStrategyData(prev => prev ? { ...prev, strategies: prev.strategies.map(s => ({ ...s, selected: false })) } : null)

  // ── 共有 ──────────────────────────────────────────────────
  const handleGenerateShare = async () => {
    const token = await generateShareToken(client.id)
    setShareToken(token)
  }
  const handleCopyShare = () => {
    if (!shareToken) return
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2000)
  }

  // ── バージョン切り替え ─────────────────────────────────────
  const handleSelectVersion = (v: StrategyVersion) => setStrategyData(v.data)

  // ── フィードバック ────────────────────────────────────────
  const handleFeedback = (text: string) => handleAnalyze(text)

  // ── RENDER ────────────────────────────────────────────────
  const chatProps = {
    messages, files, isLoading, isAnalyzing,
    canAnalyze: userMsgCount >= 3,
    onSend: handleSend,
    onFileUpload: handleFileUpload,
    onRemoveFile: handleRemoveFile,
    onAnalyze: () => handleAnalyze(),
  }
  const analysisProps = {
    data: strategyData, versions, shareToken, isConfirming,
    onToggleStrategy: handleToggleStrategy,
    onSelectAll: handleSelectAll,
    onClearAll: handleClearAll,
    onConfirm: handleConfirm,
    onFeedback: handleFeedback,
    onGenerateShare: handleGenerateShare,
    onCopyShare: handleCopyShare,
    onSelectVersion: handleSelectVersion,
    copiedShare,
  }

  // モバイル: タブ切り替え
  if (isMobile) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}>
        <div className="flex mb-3 bg-slate-100 rounded-xl p-1">
          {(['chat', 'analysis'] as const).map(view => (
            <button key={view} onClick={() => setMobileView(view)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${mobileView === view ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}
            >
              {view === 'chat' ? '💬 チャット' : '📊 分析レポート'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {mobileView === 'chat' ? <ChatPanel {...chatProps} /> : (
            <div className="bg-white rounded-2xl border border-slate-200 h-full overflow-hidden">
              <AnalysisPanel {...analysisProps} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // デスクトップ: 2カラム
  return (
    <div className="flex gap-5" style={{ height: 'calc(100vh - 280px)', minHeight: 640 }}>
      <div style={{ width: '40%' }}>
        <ChatPanel {...chatProps} />
      </div>
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <AnalysisPanel {...analysisProps} />
      </div>
    </div>
  )
}
