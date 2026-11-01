import type { JournalTrade } from "./api"
import { pnlOf, rOf } from "./journal"

/** This week (Monday to now, the phone's own time) against last week. */
export type Week = { net: number; count: number; winRate: number; netR: number; bestDay: { at: number; pnl: number } | null; worstDay: { at: number; pnl: number } | null; points: number[] }
export type Recap = { week: Week; last: Week; start: number }

const week = (trades: JournalTrade[]): Week => {
  const byDay = new Map<number, number>()
  let net = 0, wins = 0, netR = 0
  const sorted = [...trades].sort((a, b) => +new Date(a.exit_at ?? a.opened_at) - +new Date(b.exit_at ?? b.opened_at))
  let run = 0
  const points = [0]
  for (const t of sorted) {
    const p = pnlOf(t), d = new Date(t.opened_at), k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    net += p; netR += rOf(t); if (p > 0) wins++
    byDay.set(k, (byDay.get(k) ?? 0) + p)
    points.push((run += p))
  }
  const ds = [...byDay.entries()].map(([at, pnl]) => ({ at, pnl }))
  return {
    net, count: trades.length, winRate: trades.length ? (wins / trades.length) * 100 : 0, netR,
    bestDay: ds.length ? ds.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null,
    worstDay: ds.length ? ds.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null,
    points,
  }
}

export type Period = "week" | "month" | "30d" | "90d"
export const PERIODS: { key: Period; label: string; title: string; prev: string }[] = [
  { key: "week", label: "This week", title: "Your week", prev: "last week" },
  { key: "month", label: "This month", title: "Your month", prev: "last month" },
  { key: "30d", label: "Last 30 days", title: "Last 30 days", prev: "the 30 days before" },
  { key: "90d", label: "Last 90 days", title: "Last 90 days", prev: "the 90 days before" },
]

const DAY = 86_400_000

/** The period asked for and the one right before it, to compare with. `week` runs from Monday, `month` from the 1st, the others are the last N days up to now. */
function bounds(period: Period, now: Date): { start: number; end: number; pStart: number } {
  if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime()
    return { start, end: start + 7 * DAY, pStart: start - 7 * DAY }
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(), pStart: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() }
  }
  const n = period === "30d" ? 30 : 90
  const end = now.getTime() + 1
  return { start: end - n * DAY, end, pStart: end - 2 * n * DAY }
}

export function recap(trades: JournalTrade[], period: Period = "week", now = new Date()): Recap {
  const { start, end, pStart } = bounds(period, now)
  const within = (t: JournalTrade, from: number, to: number) => { const x = +new Date(t.opened_at); return x >= from && x < to }
  return { week: week(trades.filter((t) => within(t, start, end))), last: week(trades.filter((t) => within(t, pStart, start))), start }
}
