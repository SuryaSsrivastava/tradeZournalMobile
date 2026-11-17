import type { JournalTrade } from "./api"

// Same working-out as the website's journal: a result taken from a statement is used as it is; otherwise from entry and exit (futures "1!" symbols carry a x20 point value).
export const pnlOf = (t: JournalTrade) =>
  t.pnl != null ? t.pnl : (t.exit - t.entry) * t.qty * (t.side === "Long" ? 1 : -1) * (t.symbol.endsWith("1!") ? 20 : 1) - (t.fees ?? 0)

export const rOf = (t: JournalTrade) => (t.risk > 0 ? pnlOf(t) / t.risk : 0)

export function journalStats(trades: JournalTrade[]) {
  const pnls = trades.map(pnlOf)
  const grossWin = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0)
  const grossLoss = -pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0)
  const today = new Date().toDateString()
  return {
    count: trades.length,
    net: pnls.reduce((a, b) => a + b, 0),
    today: trades.filter((t) => new Date(t.opened_at).toDateString() === today).reduce((a, t) => a + pnlOf(t), 0),
    winRate: trades.length ? (pnls.filter((p) => p > 0).length / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    wins: pnls.filter((p) => p > 0).length,
    avgWin: pnls.filter((p) => p > 0).length ? grossWin / pnls.filter((p) => p > 0).length : 0,
    avgLoss: pnls.filter((p) => p < 0).length ? -grossLoss / pnls.filter((p) => p < 0).length : 0,
    losses: pnls.filter((p) => p < 0).length,
    best: Math.max(0, ...pnls),
    worst: Math.min(0, ...pnls),
    avgR: trades.length ? trades.reduce((a, t) => a + rOf(t), 0) / trades.length : 0,
  }
}

/** "calm, fomo" -> ["calm", "fomo"]: what the member types into a labels field. */
export const splitLabels = (v: string) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))]

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

/** Running total of results, oldest first: the equity curve of the journal. */
export function equityPoints(trades: JournalTrade[]): number[] {
  let run = 0
  return [0, ...[...trades].sort((a, b) => +new Date(a.exit_at ?? a.opened_at) - +new Date(b.exit_at ?? b.opened_at)).map((t) => (run += pnlOf(t)))]
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" })

/** What each point of the equity and drawdown curves stands for (the same order as equityPoints): the start, then each trade with the day it ended. */
export function equityLabels(trades: JournalTrade[]): string[] {
  const sorted = [...trades].sort((a, b) => +new Date(a.exit_at ?? a.opened_at) - +new Date(b.exit_at ?? b.opened_at))
  return ["Start", ...sorted.map((t, i) => `Trade ${i + 1} · ${shortDate(t.exit_at ?? t.opened_at)}`)]
}

/** The same for the rolling win rate: each point covers a window of trades, up to the day the last of them opened. */
export function rollingLabels(trades: JournalTrade[], window = 20): string[] {
  const asc = [...trades].sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at))
  const out: string[] = []
  for (let i = window - 1; i < asc.length; i++) out.push(`Trades ${i - window + 2}–${i + 1} · to ${shortDate(asc[i].opened_at)}`)
  return out
}

/** Result per calendar day, keyed like the calendar's cells. */
export function pnlByDay(trades: JournalTrade[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of trades) m.set(dayKey(t.opened_at), (m.get(dayKey(t.opened_at)) ?? 0) + pnlOf(t))
  return m
}

/** Trades newest first, grouped by day, each group with its day total. */
export function groupByDay(trades: JournalTrade[]): { iso: string; total: number; trades: JournalTrade[] }[] {
  const out = new Map<string, { iso: string; total: number; trades: JournalTrade[] }>()
  for (const t of [...trades].sort((a, b) => +new Date(b.opened_at) - +new Date(a.opened_at))) {
    const k = dayKey(t.opened_at)
    const g = out.get(k) ?? { iso: t.opened_at, total: 0, trades: [] }
    g.total += pnlOf(t); g.trades.push(t); out.set(k, g)
  }
  return [...out.values()]
}

/** Only the trades of the last `days` days (0 means all of them). */
export const inRange = (trades: JournalTrade[], days: number) => (days === 0 ? trades : trades.filter((t) => +new Date(t.opened_at) >= Date.now() - days * 86_400_000))

/** Result per trading day, oldest first, the last `max` days that had trades. */
export function dailySeries(trades: JournalTrade[], max = 30): { iso: string; pnl: number; n: number }[] {
  const days = new Map<string, { iso: string; pnl: number; n: number }>()
  for (const t of trades) {
    const k = dayKey(t.opened_at)
    const d = days.get(k) ?? { iso: t.opened_at, pnl: 0, n: 0 }
    d.pnl += pnlOf(t); d.n++; days.set(k, d)
  }
  return [...days.values()].sort((a, b) => +new Date(a.iso) - +new Date(b.iso)).slice(-max)
}

/** Monday to Sunday: the result and count of the trades opened on each. */
export function weekdays(trades: JournalTrade[]): { label: string; pnl: number; n: number }[] {
  const out = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({ label, pnl: 0, n: 0 }))
  for (const t of trades) { const i = (new Date(t.opened_at).getDay() + 6) % 7; out[i].pnl += pnlOf(t); out[i].n++ }
  return out
}

/**
 * Trades grouped by a label (setup, emotion, tag): count, net result and win rate of each, best first. Labels are typed by hand, so "FOMO", "fomo" and " Fomo " are one group; `upper` shows
 * the group in capitals (what the charts for emotions and setups use), otherwise it keeps the way it was first written.
 */
export function breakdown(trades: JournalTrade[], labels: (t: JournalTrade) => string[], upper = false): { key: string; n: number; net: number; winRate: number }[] {
  const m = new Map<string, { shown: string; n: number; net: number; wins: number }>()
  for (const t of trades) for (const raw of labels(t)) {
    const label = raw.trim()
    if (!label) continue
    const id = label.toLowerCase()
    const g = m.get(id) ?? { shown: upper ? label.toUpperCase() : label, n: 0, net: 0, wins: 0 }
    const p = pnlOf(t); g.n++; g.net += p; if (p > 0) g.wins++; m.set(id, g)
  }
  return [...m.values()].map((g) => ({ key: g.shown, n: g.n, net: g.net, winRate: (g.wins / g.n) * 100 })).sort((a, b) => b.net - a.net)
}

/** The biggest fall from a peak of the equity curve, as a positive amount. */
export function maxDrawdown(trades: JournalTrade[]): number {
  let peak = 0, worst = 0
  for (const v of equityPoints(trades)) { peak = Math.max(peak, v); worst = Math.max(worst, peak - v) }
  return worst
}

/** The run of wins (or losses) the latest trades are on, and the longest runs ever. */
export function streaks(trades: JournalTrade[]): { current: number; bestWin: number; worstLoss: number } {
  let current = 0, bestWin = 0, worstLoss = 0, w = 0, l = 0
  const asc = [...trades].sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at))
  for (const t of asc) {
    const p = pnlOf(t)
    if (p > 0) { w++; l = 0 } else if (p < 0) { l++; w = 0 } else { w = 0; l = 0 }
    bestWin = Math.max(bestWin, w); worstLoss = Math.max(worstLoss, l)
    current = w > 0 ? w : l > 0 ? -l : 0
  }
  return { current, bestWin, worstLoss }
}

/** Running total in R (results measured in the money risked on each trade), oldest first. */
export function equityPointsR(trades: JournalTrade[]): number[] {
  let run = 0
  return [0, ...[...trades].sort((a, b) => +new Date(a.exit_at ?? a.opened_at) - +new Date(b.exit_at ?? b.opened_at)).map((t) => (run += rOf(t)))]
}

/** How far below its own highest point the equity curve is after each trade (zero at a new high, never above zero): the "underwater" curve. */
export function drawdownSeries(trades: JournalTrade[]): number[] {
  let peak = 0
  return equityPoints(trades).map((v) => { peak = Math.max(peak, v); return v - peak })
}

/** How many trades ended in each band of R: a worst loss, a normal loss, a small win, a big win. */
export function rBuckets(trades: JournalTrade[]): { label: string; value: number; sign: number }[] {
  const edges: [string, (r: number) => boolean, number][] = [
    ["≤-2R", (r) => r <= -2, -1], ["-2..-1", (r) => r > -2 && r <= -1, -1], ["-1..0", (r) => r > -1 && r < 0, -1],
    ["0..1", (r) => r >= 0 && r < 1, 1], ["1..2", (r) => r >= 1 && r < 2, 1], ["2..3", (r) => r >= 2 && r < 3, 1], ["≥3R", (r) => r >= 3, 1],
  ]
  const rs = trades.map(rOf)
  return edges.map(([label, inBand, sign]) => ({ label, sign, value: rs.filter(inBand).length }))
}

/** Result by the hour the trade was opened (the phone's own time): 24 columns. */
export function byHour(trades: JournalTrade[]): { label: string; pnl: number; n: number }[] {
  const out = Array.from({ length: 24 }, (_, h) => ({ label: String(h), pnl: 0, n: 0 }))
  for (const t of trades) { const h = new Date(t.opened_at).getHours(); out[h].pnl += pnlOf(t); out[h].n++ }
  return out
}

/** Which market session a trade was opened in, by UTC hour (as on the website): Asian 00-07, London 07-12, New York 12-21, otherwise off-hours. */
export const sessionOf = (iso: string) => { const h = new Date(iso).getUTCHours(); return h < 7 ? "Asian" : h < 12 ? "London" : h < 21 ? "New York" : "Off-hours" }

/** Win rate over the last `window` trades, after each trade from the `window`th on: does it hold up or fade? */
export function rollingWinRate(trades: JournalTrade[], window = 20): number[] {
  const asc = [...trades].sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at)).map((t) => (pnlOf(t) > 0 ? 1 : 0))
  const out: number[] = []
  for (let i = window - 1; i < asc.length; i++) out.push((asc.slice(i - window + 1, i + 1).reduce((a: number, b) => a + b, 0) / window) * 100)
  return out
}

/** Result per calendar month, oldest first. */
export function byMonth(trades: JournalTrade[]): { label: string; pnl: number }[] {
  const m = new Map<string, { at: number; label: string; pnl: number }>()
  for (const t of trades) {
    const d = new Date(t.opened_at), k = `${d.getFullYear()}-${d.getMonth()}`
    const g = m.get(k) ?? { at: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), label: `${d.toLocaleDateString([], { month: "short" })} ${String(d.getFullYear()).slice(2)}`, pnl: 0 }
    g.pnl += pnlOf(t); m.set(k, g)
  }
  return [...m.values()].sort((a, b) => a.at - b.at)
}

/** Average minutes a trade was held, for winners and for losers (only trades that have an exit time). */
export function holdMinutes(trades: JournalTrade[]): { win: number | null; loss: number | null } {
  const mins = (ts: JournalTrade[]) => { const m = ts.filter((t) => t.exit_at).map((t) => (+new Date(t.exit_at!) - +new Date(t.opened_at)) / 60_000).filter((x) => x >= 0); return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null }
  return { win: mins(trades.filter((t) => pnlOf(t) > 0)), loss: mins(trades.filter((t) => pnlOf(t) < 0)) }
}

export const minutesText = (m: number) => (m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${(m / 1440).toFixed(1)}d`)
