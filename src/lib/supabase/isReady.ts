/** Supabase の環境変数が実際に設定されているか確認 */
export function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  return Boolean(url && key && !url.startsWith('your-') && url.startsWith('http'))
}
