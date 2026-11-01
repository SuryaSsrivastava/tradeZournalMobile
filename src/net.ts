import { useEffect, useState } from "react"

/**
 * Whether the phone can reach EdgeLabHub right now, learned from the requests themselves (no extra native module): a request that cannot connect marks it offline, the next one
 * that gets any answer marks it online again and lets the outbox (src/outbox.ts) send what was saved meanwhile.
 */
let offline = false
let onBack: () => void = () => {}
const listeners = new Set<(v: boolean) => void>()

export const isOffline = () => offline
export const setBackOnlineHandler = (fn: () => void) => { onBack = fn }

export function markOffline(v: boolean) {
  if (v === offline) return
  offline = v
  listeners.forEach((l) => l(v))
  if (!v) onBack()
}

export function useOffline() {
  const [v, setV] = useState(offline)
  useEffect(() => { listeners.add(setV); setV(offline); return () => { listeners.delete(setV) } }, [])
  return v
}
