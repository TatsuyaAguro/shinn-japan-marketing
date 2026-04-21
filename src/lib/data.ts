export type ClientStatus = 'active' | 'inactive' | 'draft'

export interface Client {
  id: string
  name: string
  region: string
  category: string
  targetMarket: string
  status: ClientStatus
  campaigns: number
  lastActivity: string
  // 詳細情報
  touristResources: string
  budget: string
  manager: string
  description: string
}

export const CLIENTS: Client[] = [
  {
    id: '1',
    name: '京都観光協会',
    region: '京都府',
    category: '観光協会',
    targetMarket: '欧米・オーストラリア',
    status: 'active',
    campaigns: 3,
    lastActivity: '2026-04-05',
    touristResources: '金閣寺、嵐山、祇園、伏見稲荷大社',
    budget: '5,000万円',
    manager: '田中 美咲',
    description: '京都の伝統文化・歴史的建造物を軸に、欧米・オーストラリア市場に向けたインバウンドプロモーションを展開。「本物の日本文化体験」をコンセプトに施策を推進中。',
  },
  {
    id: '2',
    name: '沖縄リゾートホテル群',
    region: '沖縄県',
    category: 'ホテル・宿泊',
    targetMarket: '東アジア・東南アジア',
    status: 'active',
    campaigns: 5,
    lastActivity: '2026-04-04',
    touristResources: '美ら海水族館、石垣島、マリンスポーツ、首里城',
    budget: '8,000万円',
    manager: '山田 健太',
    description: '沖縄の海・自然・リゾートを活かし、台湾・香港・シンガポール等の東アジア・東南アジア市場に向けたプレミアムリゾート体験を訴求する施策を展開中。',
  },
  {
    id: '3',
    name: '北海道グルメツアーズ',
    region: '北海道',
    category: 'ツアー会社',
    targetMarket: '台湾・香港',
    status: 'active',
    campaigns: 2,
    lastActivity: '2026-04-03',
    touristResources: '札幌雪まつり、富良野ラベンダー、海産物、スキー場',
    budget: '2,500万円',
    manager: '鈴木 花子',
    description: '北海道の食・自然・四季を活かしたグルメツアーを台湾・香港向けに展開。現地旅行会社との連携によるパッケージツアー開発を重点施策とする。',
  },
  {
    id: '4',
    name: '東京ナイトライフ協議会',
    region: '東京都',
    category: '観光協会',
    targetMarket: '全世界',
    status: 'inactive',
    campaigns: 1,
    lastActivity: '2026-03-20',
    touristResources: '渋谷、新宿、秋葉原、お台場',
    budget: '3,000万円',
    manager: '佐藤 拓海',
    description: '東京の夜間観光・エンターテインメントを世界に発信する施策。コロナ後の観光需要回復に伴い、一時停止中だった施策の再開を検討中。',
  },
  {
    id: '5',
    name: '富士山麓観光連盟',
    region: '静岡県・山梨県',
    category: '観光連盟',
    targetMarket: '欧米・中国',
    status: 'active',
    campaigns: 4,
    lastActivity: '2026-04-01',
    touristResources: '富士山、河口湖、忍野八海、温泉地',
    budget: '4,000万円',
    manager: '伊藤 さくら',
    description: '富士山を核とした周辺エリアの観光促進施策。オーバーツーリズム対策と分散化を念頭に、新たな周遊ルートの発信と体験型コンテンツの開発を推進。',
  },
  {
    id: '6',
    name: '大阪食文化推進機構',
    region: '大阪府',
    category: '推進機構',
    targetMarket: '東南アジア・欧米',
    status: 'draft',
    campaigns: 0,
    lastActivity: '2026-03-15',
    touristResources: '道頓堀、黒門市場、たこ焼き・お好み焼き文化',
    budget: '未定',
    manager: '中村 浩二',
    description: '「天下の台所」大阪の食文化を世界に発信する新規プロジェクト。コンセプト策定・ターゲット市場調査が完了し、施策立案フェーズに移行予定。',
  },
]

export const STATUS_LABELS = {
  active: { label: '稼働中', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  inactive: { label: '停止中', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  draft: { label: '準備中', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
} as const

export const CATEGORY_ICONS: Record<string, string> = {
  '観光協会': '🏛️',
  'ホテル・宿泊': '🏨',
  'ツアー会社': '🗺️',
  '観光連盟': '🤝',
  '推進機構': '📣',
}
