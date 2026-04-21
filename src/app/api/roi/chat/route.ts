import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `あなたはSHINN JAPANのマーケティングROIアナリストです。
観光マーケティングのROI計算、予算配分の最適化、費用対効果の分析を行います。

■ あなたの役割
1. AI戦略室で確定した施策に基づき、各施策のROIをフルファネルで計算する
2. ユーザーからの「予算をもっと減らしたい」「この施策を追加したい」等のリクエストに応じて再計算する
3. 予算配分の最適化を提案する
4. 各計算の根拠を必ず示す

■ 計算の原則
- 全ての数値に出典または根拠を明示する
  例：「Instagram海外向け観光広告の平均CPM: ¥2,000〜3,500（Meta Business Suite 2025年データ）」
- 「業界平均値を使用しています」と正直に伝える
- 将来的に自社実績データに置き換わることを前提とした設計
- 楽観・標準・悲観の3シナリオを必ず出す
- 現実的な数値を出す（ROI 27000%のようなありえない数値は絶対に出さない）

■ 現実的なROI目安（重要）
- デジタル広告単体の直接ROI: 50〜200%が現実的（インバウンド観光）
- 3〜5年の間接効果まで含めると300〜500%も可能
- 初年度は赤字または低ROIになることが多い（認知構築フェーズ）
- ROIが100%未満でも施策として意味がある場合がある（認知・ブランド構築）

■ 計算式の明示（必ずこの形式で）
予算÷CPM×1000 = インプレッション
インプレッション÷フリークエンシー = リーチ
インプレッション×CTR = サイト流入
サイト流入×CVR = コンバージョン
コンバージョン×(1-ノーショー率) = 実来訪者数
来訪者数×一人当たり消費額 = 売上
(売上-投資額)÷投資額×100 = ROI

■ 業界平均値（参考）
- Instagram観光広告CPM: ¥2,000〜3,500（Meta Business Suite 2025）
- YouTubeプレロール広告CPM: ¥2,500〜4,000（Google Ads 2025）
- 観光業Instagram CTR: 1.0〜1.5%（HubSpot Industry Report 2025）
- 自社サイトCVR: 1.5〜3.0%（業界標準）
- OTA経由CVR: 3.0〜5.0%（既に購買意欲が高いため）
- ノーショー率: 5〜10%（観光予約業界平均）
- 口コミ乗数: 2.3人/来訪者（TripAdvisor調査）`

export async function POST(req: Request) {
  try {
    const { messages, client, roiSummary } = await req.json()

    const systemWithContext = roiSummary
      ? SYSTEM_PROMPT +
        `\n\n■ 現在の計算結果（画面上の数値）\n${JSON.stringify(roiSummary, null, 2)}\n\nこの数値に基づいて回答してください。`
      : SYSTEM_PROMPT

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemWithContext,
      messages: (messages as { role: string; content: string }[]).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const content = res.content[0].type === 'text' ? res.content[0].text : ''
    return Response.json({ content })
  } catch (e) {
    console.error('ROI chat error:', e)
    return Response.json(
      { content: 'エラーが発生しました。もう一度お試しください。' },
      { status: 500 }
    )
  }
}
