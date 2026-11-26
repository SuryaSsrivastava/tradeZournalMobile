import { useFocusEffect } from "expo-router"
import { useCallback, useRef } from "react"
import { AppState } from "react-native"
import { api, isMt5, type Account } from "./api"

let last = 0

/**
 * Bring in the new trades of the member's MetaTrader accounts, quietly: the same sync as the "Sync now" button, without the notice. It is not repeated within `gapMs`, and a refusal
 * (the server only starts a MetaTrader terminal once per cooldown) or a failure is not an error here. `connecting` means a terminal was just started: its trades arrive in a minute or two.
 */
export async function autoSyncAccounts(accounts: Account[], gapMs = 5 * 60_000, force = false): Promise<{ added: number; connecting: boolean }> {
  const targets = accounts.filter((a) => isMt5(a) && a.status !== "paused")
  if (targets.length === 0 || (!force && Date.now() - last < gapMs)) return { added: 0, connecting: false }
  last = Date.now()
  const done = await Promise.all(targets.map((a) => api.syncAccount(a.id, true).catch(() => null)))
  return { added: done.reduce((n, r) => n + (r?.added ?? 0), 0), connecting: done.some((r) => r?.connecting) }
}

/** Syncs while a screen is in front: when it comes into focus and when the app returns to the foreground. `onNew` reloads what the screen shows. Returns a manual run for pull-to-refresh. */
export function useAutoSync(accounts: Account[], onNew: () => void) {
  const list = useRef(accounts); list.current = accounts
  const again = useRef(onNew); again.current = onNew
  const run = useCallback(async (force = false) => {
    const r = await autoSyncAccounts(list.current, 5 * 60_000, force)
    if (r.added > 0) again.current()
    return r
  }, [])
  const count = accounts.length
  useFocusEffect(useCallback(() => {
    if (count === 0) return
    const timers: ReturnType<typeof setTimeout>[] = []
    let alive = true
    const go = (force = false) => void run(force).then((r) => {
      if (alive && r.connecting) for (const ms of [45_000, 90_000]) timers.push(setTimeout(() => { if (alive) again.current() }, ms))  // the terminal is starting
    })
    go()
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") go() })
    return () => { alive = false; sub.remove(); timers.forEach(clearTimeout) }
  }, [count, run]))
  return run
}
