import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import Sidebar from '@/components/layout/Sidebar'
import type { User } from '@supabase/supabase-js'

const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

async function getUser(): Promise<User | null> {
  if (process.env.SKIP_AUTH === 'true') return DEMO_USER

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!supabaseUrl || !supabaseKey || supabaseUrl.startsWith('your-')) {
    return DEMO_USER
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー */}
      <Sidebar />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user!} />
        <main className="flex-1 overflow-y-auto bg-slate-50 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
