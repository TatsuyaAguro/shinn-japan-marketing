'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseReady } from '@/lib/supabase/isReady'

interface UseClientSyncOptions {
  clientId: string
  onClientUpdate?: () => void
  onScheduleChange?: () => void
}

/**
 * Supabase Realtime で clients / schedules の変更をリッスンするフック。
 * コールバックは refs で保持するため、呼び出し側で useCallback 不要。
 */
export function useClientSync({ clientId, onClientUpdate, onScheduleChange }: UseClientSyncOptions): void {
  const onClientUpdateRef  = useRef(onClientUpdate)
  const onScheduleChangeRef = useRef(onScheduleChange)
  onClientUpdateRef.current  = onClientUpdate
  onScheduleChangeRef.current = onScheduleChange

  useEffect(() => {
    if (!isSupabaseReady() || !clientId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`client-sync-${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` },
        () => { onClientUpdateRef.current?.() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules', filter: `client_id=eq.${clientId}` },
        () => { onScheduleChangeRef.current?.() },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId]) // clientId が変わったときだけ再サブスクライブ
}
