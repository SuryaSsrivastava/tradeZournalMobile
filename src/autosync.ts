import { api, type Account } from "./api"

let last = 0

/**
 * Bring in the new trades of the member's MetaTrader accounts, quietly: the same sync as the "Sync now" button, without the notice. It is not repeated within `gapMs`, and a refusal
 * (the server only starts a MetaTrader terminal once per cooldown) or a failure is not an error here. `connecting` means a terminal was just started: its trades arrive in a minute or two.
 */
export async function autoSyncAccounts(accounts: Account[], gapMs = 5 * 60_000): Promise<{ added: number; connecting: boolean }> {
  const targets = accounts.filter((a) => a.kind === "metaapi" && a.status !== "paused")
  if (targets.length === 0 || Date.now() - last < gapMs) return { added: 0, connecting: false }
  last = Date.now()
  const done = await Promise.all(targets.map((a) => api.syncAccount(a.id, true).catch(() => null)))
  return { added: done.reduce((n, r) => n + (r?.added ?? 0), 0), connecting: done.some((r) => r?.connecting) }
}
