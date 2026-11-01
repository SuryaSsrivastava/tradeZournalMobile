import type { JournalTrade } from "./api"
import { journalStats, pnlOf, streaks } from "./journal"

/** Streaks and badges, worked out from the journal on the phone (nothing is stored: delete a trade and the badge follows). */
export type Streak = { current: number; best: number }
export type Badge = { id: string; title: string; text: string; icon: string; earned: boolean; have: number; need: number }

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Net result per local day, oldest first. */
function days(trades: JournalTrade[]): { at: number; pnl: number }[] {
  const m = new Map<number, number>()
  for (const t of trades) { const k = dayStart(new Date(t.opened_at)); m.set(k, (m.get(k) ?? 0) + pnlOf(t)) }
  return [...m.entries()].map(([at, pnl]) => ({ at, pnl })).sort((a, b) => a.at - b.at)
}

/** Days with a green result in a row. Weekends and days with no trades do not break it (a trading day is a day with a trade), but a red day does. */
export function greenStreak(trades: JournalTrade[]): Streak {
  const d = days(trades)
  let best = 0, run = 0
  for (const x of d) { run = x.pnl > 0 ? run + 1 : 0; best = Math.max(best, run) }
  const last = d[d.length - 1]
  const current = last && last.pnl > 0 ? run : 0
  return { current, best }
}

/** The most trades in a row that followed the plan (a trade marked "not sure" or not marked ends the run). */
export function planStreak(trades: JournalTrade[]): { current: number; best: number } {
  let best = 0, run = 0
  for (const t of [...trades].sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at))) { run = t.followed_plan === true ? run + 1 : 0; best = Math.max(best, run) }
  return { current: run, best }
}

export function badges(trades: JournalTrade[]): Badge[] {
  const n = trades.length
  const g = greenStreak(trades).best
  const p = planStreak(trades).best
  const w = streaks(trades).bestWin
  const noted = trades.filter((t) => t.note.trim().length > 0).length
  const st = journalStats(trades)
  const mk = (id: string, title: string, text: string, icon: string, have: number, need: number): Badge => ({ id, title, text, icon, earned: have >= need, have: Math.min(have, need), need })
  return [
    mk("first", "First trade", "Log your first trade", "flag", n, 1),
    mk("t10", "Getting going", "Log 10 trades", "footsteps", n, 10),
    mk("t50", "Regular", "Log 50 trades", "calendar", n, 50),
    mk("t100", "Centurion", "Log 100 trades", "ribbon", n, 100),
    mk("g3", "Hat-trick", "3 green days in a row", "flame", g, 3),
    mk("g5", "On fire", "5 green days in a row", "bonfire", g, 5),
    mk("g10", "Unstoppable", "10 green days in a row", "rocket", g, 10),
    mk("w5", "Hot hand", "5 winning trades in a row", "flash", w, 5),
    mk("plan5", "By the book", "5 trades in a row that followed your plan", "shield-checkmark", p, 5),
    mk("plan20", "Disciplined", "20 trades in a row that followed your plan", "medal", p, 20),
    mk("notes10", "Journaler", "Write a note on 10 trades", "create", noted, 10),
    mk("edge", "Edge found", "Profit factor of 2 or more over 20+ trades", "diamond", n >= 20 && Number.isFinite(st.profitFactor) && st.profitFactor >= 2 ? 1 : n >= 20 && st.profitFactor === Infinity ? 1 : 0, 1),
  ]
}

/** The badge closest to being earned (for the nudge on Home). */
export const nextBadge = (list: Badge[]): Badge | null => list.filter((b) => !b.earned).sort((a, b) => b.have / b.need - a.have / a.need)[0] ?? null
