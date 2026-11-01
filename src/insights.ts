import type { JournalTrade } from "./api"
import { breakdown, holdMinutes, minutesText, pnlOf, weekdays, byHour } from "./journal"
import { money } from "./format"

/**
 * "What your journal says about you": plain-English findings worked out from the trades on the phone. Each needs enough trades behind it to mean something, and says how much money it is worth.
 * `weight` (the money involved) orders them: the costliest habit and the best edge come first.
 */
export type Insight = { id: string; tone: "good" | "bad" | "info"; icon: string; title: string; text: string; weight: number }

const MIN = 3  // fewest trades behind any single finding
const usd = (n: number) => money(n, "USD", true)
const pct = (n: number) => `${Math.round(n)}%`
const hourName = (h: number) => `${String(h).padStart(2, "0")}:00`

export function insights(trades: JournalTrade[]): Insight[] {
  const out: Insight[] = []
  if (trades.length < 5) return out
  const sorted = [...trades].sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at))

  // 1. the plan
  const kept = trades.filter((t) => t.followed_plan === true), broke = trades.filter((t) => t.followed_plan === false)
  if (kept.length >= MIN && broke.length >= MIN) {
    const net = (ts: JournalTrade[]) => ts.reduce((s, t) => s + pnlOf(t), 0)
    const avg = (ts: JournalTrade[]) => net(ts) / ts.length
    const win = (ts: JournalTrade[]) => (ts.filter((t) => pnlOf(t) > 0).length / ts.length) * 100
    const bad = net(broke) < 0
    out.push({
      id: "plan", tone: avg(kept) >= avg(broke) ? "good" : "info", icon: "shield-checkmark",
      title: bad ? `Breaking your plan cost you ${usd(Math.abs(net(broke)))}` : "Your plan is not what makes you money",
      text: bad
        ? `On ${broke.length} trades you did not follow your plan: ${usd(net(broke))} in total and ${pct(win(broke))} winners. On ${kept.length} trades you did: ${usd(net(kept))} and ${pct(win(kept))} winners.`
        : `Trades where you broke your plan averaged ${usd(avg(broke))}, against ${usd(avg(kept))} when you kept to it. Look at whether the plan needs a change.`,
      weight: Math.abs(net(broke)) + 1000,
    })
  }

  // 2. feelings
  const feel = breakdown(trades, (t) => t.emotions.map((e) => e.toLowerCase())).filter((e) => e.n >= MIN)
  const worstFeel = [...feel].sort((a, b) => a.net - b.net)[0]
  const bestFeel = feel[0]
  if (worstFeel && worstFeel.net < 0) out.push({ id: "feel-bad", tone: "bad", icon: "sad", title: `Trades tagged "${worstFeel.key}" cost you ${usd(Math.abs(worstFeel.net))}`, text: `${worstFeel.n} trades, ${pct(worstFeel.winRate)} winners. When you feel this way, it may be better to sit out.`, weight: Math.abs(worstFeel.net) })
  if (bestFeel && bestFeel.net > 0 && bestFeel.key !== worstFeel?.key) out.push({ id: "feel-good", tone: "good", icon: "happy", title: `You trade best when you feel "${bestFeel.key}"`, text: `${bestFeel.n} trades, ${usd(bestFeel.net)} and ${pct(bestFeel.winRate)} winners.`, weight: bestFeel.net })

  // 3. trading straight after a loss
  let revN = 0, revNet = 0, restN = 0, restNet = 0
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i], prev = sorted[i - 1]
    const gap = prev ? (+new Date(t.opened_at) - +new Date(prev.exit_at ?? prev.opened_at)) / 60_000 : Infinity
    if (prev && pnlOf(prev) < 0 && gap >= 0 && gap < 30) { revN++; revNet += pnlOf(t) } else { restN++; restNet += pnlOf(t) }
  }
  if (revN >= MIN && restN >= MIN) {
    const a = revNet / revN, b = restNet / restN
    if (a < b) out.push({ id: "revenge", tone: "bad", icon: "flame", title: "You trade worse right after a loss", text: `${revN} trades opened within 30 minutes of a losing one averaged ${usd(a)}; the rest averaged ${usd(b)}. A short break after a loss could pay for itself.`, weight: Math.abs(a - b) * revN })
  }

  // 4. too many trades in a day
  const perDay = new Map<string, { n: number; pnl: number }>()
  for (const t of trades) { const k = new Date(t.opened_at).toDateString(); const d = perDay.get(k) ?? { n: 0, pnl: 0 }; d.n++; d.pnl += pnlOf(t); perDay.set(k, d) }
  const days = [...perDay.values()]
  const counts = days.map((d) => d.n).sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  const busy = days.filter((d) => d.n > Math.max(median * 1.5, median + 1)), calm = days.filter((d) => d.n <= Math.max(median * 1.5, median + 1))
  if (busy.length >= 2 && calm.length >= 2) {
    const a = busy.reduce((s, d) => s + d.pnl, 0) / busy.length, b = calm.reduce((s, d) => s + d.pnl, 0) / calm.length
    if (a < b) out.push({ id: "busy", tone: "bad", icon: "speedometer", title: "More trades do not mean more money", text: `On your ${busy.length} busiest days (over ${Math.max(Math.floor(median * 1.5), median + 1)} trades) you averaged ${usd(a)} a day. On quieter days: ${usd(b)}.`, weight: Math.abs(b - a) * busy.length })
  }

  // 5. when you trade well
  const wd = weekdays(trades).filter((d) => d.n >= MIN)
  if (wd.length >= 3) {
    const best = [...wd].sort((a, b) => b.pnl - a.pnl)[0], worst = [...wd].sort((a, b) => a.pnl - b.pnl)[0]
    if (best.pnl > 0) out.push({ id: "day-best", tone: "good", icon: "calendar", title: `${best.label} is your best day`, text: `${usd(best.pnl)} over ${best.n} trades.`, weight: best.pnl })
    if (worst.pnl < 0 && worst.label !== best.label) out.push({ id: "day-worst", tone: "bad", icon: "calendar-outline", title: `${worst.label} is your toughest day`, text: `${usd(worst.pnl)} over ${worst.n} trades.`, weight: Math.abs(worst.pnl) })
  }
  const hrs = byHour(trades).map((h, i) => ({ ...h, hour: i })).filter((h) => h.n >= MIN)
  if (hrs.length >= 3) {
    const best = [...hrs].sort((a, b) => b.pnl - a.pnl)[0], worst = [...hrs].sort((a, b) => a.pnl - b.pnl)[0]
    if (best.pnl > 0) out.push({ id: "hour-best", tone: "good", icon: "time", title: `Your best hour starts at ${hourName(best.hour)}`, text: `${usd(best.pnl)} over ${best.n} trades opened in that hour.`, weight: best.pnl })
    if (worst.pnl < 0 && worst.hour !== best.hour) out.push({ id: "hour-worst", tone: "bad", icon: "time-outline", title: `Trades opened around ${hourName(worst.hour)} lose`, text: `${usd(worst.pnl)} over ${worst.n} trades.`, weight: Math.abs(worst.pnl) })
  }

  // 6. setups
  const setups = breakdown(trades, (t) => (t.setup.trim() ? [t.setup.trim()] : [])).filter((s) => s.n >= MIN)
  if (setups.length >= 2) {
    const best = setups[0], worst = setups[setups.length - 1]
    if (best.net > 0) out.push({ id: "setup-best", tone: "good", icon: "trophy", title: `"${best.key}" is your best setup`, text: `${best.n} trades, ${usd(best.net)}, ${pct(best.winRate)} winners.`, weight: best.net })
    if (worst.net < 0) out.push({ id: "setup-worst", tone: "bad", icon: "trending-down", title: `"${worst.key}" is losing you money`, text: `${worst.n} trades, ${usd(worst.net)}, ${pct(worst.winRate)} winners.`, weight: Math.abs(worst.net) })
  }

  // 7. how long winners and losers are held
  const hold = holdMinutes(trades)
  if (hold.win && hold.loss && hold.loss > hold.win * 1.4) out.push({ id: "hold", tone: "bad", icon: "hourglass", title: "You hold losers longer than winners", text: `Winners are closed after ${minutesText(hold.win)} on average, losers after ${minutesText(hold.loss)}. Cutting losses sooner usually helps most.`, weight: 500 })
  else if (hold.win && hold.loss && hold.win > hold.loss * 1.4) out.push({ id: "hold-good", tone: "good", icon: "hourglass", title: "You let winners run", text: `Winners are held ${minutesText(hold.win)} on average, losers only ${minutesText(hold.loss)}. That is the right way round.`, weight: 400 })

  return out.sort((a, b) => b.weight - a.weight)
}
