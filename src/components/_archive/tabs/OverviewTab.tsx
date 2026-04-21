'use client'

import { useState } from 'react'
import type { Client } from '@/lib/data'
import { STATUS_LABELS } from '@/lib/data'
import { updateClient } from '@/lib/actions/clients'

export default function OverviewTab({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [form, setForm] = useState({
    name:             client.name,
    region:           client.region,
    category:         client.category,
    targetMarket:     client.targetMarket,
    touristResources: client.touristResources,
    budget:           client.budget,
    manager:          client.manager,
    status:           client.status,
    description:      client.description,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveResult(null)
    const result = await updateClient(client.id, form)
    if (result.error) {
      setSaveResult({ ok: false, msg: result.error })
    } else {
      setSaveResult({ ok: true, msg: '保存しました' })
      setEditing(false)
    }
    setSaving(false)
    setTimeout(() => setSaveResult(null), 3000)
  }

  function handleCancel() {
    setForm({
      name:             client.name,
      region:           client.region,
      category:         client.category,
      targetMarket:     client.targetMarket,
      touristResources: client.touristResources,
      budget:           client.budget,
      manager:          client.manager,
      status:           client.status,
      description:      client.description,
    })
    setEditing(false)
    setSaveResult(null)
  }

  const inputClass = editing
    ? 'w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-full px-3 py-2 rounded-lg border border-transparent bg-slate-50 text-slate-800 text-sm cursor-default'

  const statusInfo = STATUS_LABELS[form.status as keyof typeof STATUS_LABELS]

  return (
    <div className="space-y-6">
      {/* アクションバー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">基本情報</h2>
        <div className="flex items-center gap-3">
          {/* 保存結果トースト */}
          {saveResult && (
            <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${saveResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {saveResult.msg}
            </span>
          )}
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-blue-400 transition-colors cursor-pointer"
                >
                  {saving ? '保存中...' : '保存する'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                編集する
              </button>
            )}
          </div>
        </div>
      </div>

      {/* フォームグリッド */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">クライアント名</label>
            <input name="name" value={form.name} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">地域</label>
            <input name="region" value={form.region} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">カテゴリ</label>
            {editing ? (
              <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                {['観光協会','ホテル・宿泊','ツアー会社','観光連盟','推進機構','その他'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input value={form.category} readOnly className={inputClass} />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">ターゲット市場</label>
            <input name="targetMarket" value={form.targetMarket} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">対象観光資源</label>
            <input name="touristResources" value={form.touristResources} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">予算規模</label>
            <input name="budget" value={form.budget} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">担当者</label>
            <input name="manager" value={form.manager} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">ステータス</label>
            {editing ? (
              <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                <option value="active">稼働中</option>
                <option value="inactive">停止中</option>
                <option value="draft">準備中</option>
              </select>
            ) : (
              <div className="px-3 py-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">プロジェクト概要</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            readOnly={!editing}
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* アクティビティタイムライン */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">最近のアクティビティ</h3>
        <div className="space-y-3">
          {[
            { date: '2026-04-05', text: '市場分析レポートを更新しました', user: '田中 美咲', color: 'bg-blue-500' },
            { date: '2026-04-03', text: 'ROI試算の予算を修正しました', user: '山田 健太', color: 'bg-emerald-500' },
            { date: '2026-03-28', text: '提案書ドラフトを作成しました', user: '田中 美咲', color: 'bg-violet-500' },
            { date: '2026-03-20', text: 'クライアントミーティングの議事録をアップロード', user: '鈴木 花子', color: 'bg-amber-500' },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${item.color}`} />
                {i < 3 && <div className="w-px flex-1 bg-slate-200 mt-1" style={{ minHeight: '24px' }} />}
              </div>
              <div className="flex-1 pb-2">
                <p className="text-sm text-slate-700">{item.text}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.user} · {item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
