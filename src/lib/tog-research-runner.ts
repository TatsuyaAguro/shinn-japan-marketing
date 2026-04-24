// ============================================================
// ToG AIリサーチ共通処理
// 手動API (/api/tog/research) と Cron (/api/tog/cron-research) で共有
// ============================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { RESEARCH_SYSTEM_PROMPT } from '@/lib/tog-prompts'
import { isSupabaseReady } from '@/lib/supabase/isReady'
import type { ResearchJob } from '@/lib/research-jobs'

export interface RawCase {
  name?: unknown
  organization?: unknown
  prefecture?: unknown
  category?: unknown
  description?: unknown
  budget?: unknown
  budget_note?: unknown
  deadline?: unknown
  deadline_note?: unknown
  url?: unknown
  url_source_type?: unknown
  ai_score?: unknown
  ai_reason?: unknown
  ai_matching_services?: unknown
  ai_action_recommendation?: unknown
}

export const DEFAULT_RESEARCH_MESSAGE = `以下の複数クエリで検索し、最新の公募案件をリストアップしてください。

検索クエリ（順番に実行）：
1. 「観光 プロポーザル 令和8年度」
2. 「インバウンド 業務委託 公募 2026」
3. 「高付加価値旅行 プロポーザル」
4. 「観光 コンテンツ造成 業務委託」
5. 「販路形成 インバウンド 公募」
6. 「ファムツアー 業務委託」
7. site:travelvoice.jp/tenders（トラベルボイス入札情報を直接確認）

重要：以下の公式情報源からのみ案件を収集すること
- 各自治体の公式入札・プロポーザル情報ページ
- 各DMO・観光連盟の公式公募ページ
- トラベルボイス入札情報（travelvoice.jp/tenders）
- 観光庁公募情報（mlit.go.jp/kankocho）

ニュース記事・ブログ・プレスリリース・SNS等からは案件を拾わないこと。
補助金の公募は除外すること（業務委託のみ対象）。
アジア圏のみがターゲットの案件は除外すること。`

export async function runResearchBackground(
  job: ResearchJob,
  userMessage: string,
  apiKey: string,
  logPrefix = '[tog/research bg]',
) {
  try {
    // ── フェーズ1: Anthropic API (web_search) ──────────────────────
    job.phase = 'ai-searching'

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 8000,
        system: RESEARCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
      signal: job.abortController.signal,
    })

    if (job.shouldStop) {
      job.status = 'stopped'
      job.finishedAt = new Date().toISOString()
      return
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      job.status = 'error'
      job.error = `AI API エラー: ${aiRes.status} ${errText.slice(0, 300)}`
      job.finishedAt = new Date().toISOString()
      console.error(`${logPrefix} AI API error: ${aiRes.status}`)
      return
    }

    const aiData = await aiRes.json()
    const text: string = (aiData.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('')

    if (!text) {
      job.status = 'error'
      job.error = 'AI から有効なテキストが返りませんでした'
      job.finishedAt = new Date().toISOString()
      console.error(`${logPrefix} AI returned empty text`)
      return
    }

    // JSON パース
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    let rawCases: RawCase[] = []

    if (start !== -1 && end > start) {
      try {
        rawCases = JSON.parse(text.slice(start, end + 1))
      } catch {
        // パースエラー → 0件として続行
      }
    }
    if (!Array.isArray(rawCases)) rawCases = []

    const filtered = rawCases.filter(c => Number(c.ai_score ?? 0) >= 3)
    job.foundCount = filtered.length
    console.log(`${logPrefix} found ${filtered.length} cases (score>=3)`)

    if (job.shouldStop) {
      job.status = 'stopped'
      job.finishedAt = new Date().toISOString()
      return
    }

    // ── フェーズ2: DB保存 ──────────────────────────────────────────
    job.phase = 'db-saving'

    if (isSupabaseReady() && filtered.length > 0) {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      )

      for (const c of filtered) {
        if (job.shouldStop) break

        const name = String(c.name ?? '').trim()
        const organization = String(c.organization ?? '').trim()
        if (!name) continue

        const { data: existing, error: selectErr } = await supabase
          .from('tog_cases')
          .select('id')
          .eq('name', name)
          .eq('organization', organization)
          .maybeSingle()

        if (selectErr?.code === 'PGRST205' || selectErr?.message?.includes('tog_cases')) {
          job.setupRequired = true
          job.status = 'done'
          job.finishedAt = new Date().toISOString()
          console.warn(`${logPrefix} tog_cases table not found`)
          return
        }

        if (existing) continue

        const deadline = (() => {
          const d = String(c.deadline ?? '')
          return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
        })()
        const score = Math.min(5, Math.max(3, Number(c.ai_score ?? 3)))

        const budget = c.budget !== null && c.budget !== undefined ? Number(c.budget) : null

        const { error } = await supabase.from('tog_cases').insert({
          name,
          organization,
          prefecture:               String(c.prefecture ?? ''),
          category:                 String(c.category ?? ''),
          description:              String(c.description ?? ''),
          budget,
          budget_note:              String(c.budget_note ?? ''),
          deadline,
          deadline_note:            String(c.deadline_note ?? ''),
          url:                      String(c.url ?? ''),
          url_source_type:          c.url_source_type ? String(c.url_source_type) : null,
          status:                   'new',
          ai_score:                 score,
          ai_reason:                String(c.ai_reason ?? ''),
          ai_matching_services:     Array.isArray(c.ai_matching_services) ? c.ai_matching_services : [],
          ai_action_recommendation: String(c.ai_action_recommendation ?? ''),
        })

        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('tog_cases')) {
            job.setupRequired = true
            job.status = 'done'
            job.finishedAt = new Date().toISOString()
            return
          }
          job.saveErrors++
          console.error(`${logPrefix} DB insert error: ${error.message} | case: ${name}`)
        } else {
          job.savedCount++
        }
      }
    }

    job.status = job.shouldStop ? 'stopped' : 'done'
    job.finishedAt = new Date().toISOString()
    console.log(`${logPrefix} done. saved=${job.savedCount} errors=${job.saveErrors}`)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      job.status = 'stopped'
    } else {
      job.status = 'error'
      job.error = String(e)
      console.error(`${logPrefix} unexpected error:`, e)
    }
    job.finishedAt = new Date().toISOString()
  }
}
