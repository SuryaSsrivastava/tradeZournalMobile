import { useMemo, useState } from "react"
import { Text, View } from "react-native"
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg"
import type { JournalTrade } from "./api"
import { money } from "./format"
import { pnlOf } from "./journal"
import { colors } from "./theme"
import { Heading } from "./fx"
import { Card, Muted, Pill, Row, tone } from "./ui"

const AMBER = "#f5b53d"
const withPath = (t: JournalTrade) => t.mae_usd != null && t.mfe_usd != null
const usd0 = (n: number) => money(Math.round(n), "USD")
const sgn0 = (n: number) => money(Math.round(n), "USD", true)

function Tile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: "46%", backgroundColor: `${colors.bg}88`, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color, fontSize: 19, fontWeight: "800", marginTop: 3, letterSpacing: -0.3 }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{sub}</Text>
    </View>
  )
}

const Key = ({ c, t }: { c: string; t: string }) => (
  <Row style={{ gap: 5, marginRight: 12, marginTop: 4 }}><View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c }} /><Text style={{ color: colors.muted, fontSize: 11 }}>{t}</Text></Row>
)

/** Measures its own width, then draws. */
function Sized({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = useState(0)
  return <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>{w > 0 ? children(w) : null}</View>
}

/** Bars from a zero line: each group has one or several bars (a value and a colour), a label under it and, when asked, the value over it. */
function GroupBars({ groups, height = 150, values = false }: { groups: { k: string; bars: { v: number; c: string }[] }[]; height?: number; values?: boolean }) {
  const all = groups.flatMap((g) => g.bars.map((b) => b.v))
  const hi = Math.max(0, ...all), lo = Math.min(0, ...all)
  const span = hi - lo || 1
  const top = values ? 16 : 6, foot = 20
  return (
    <Sized height={height}>
      {(w) => {
        const h = height - top - foot
        const y = (v: number) => top + ((hi - v) / span) * h
        const slot = w / Math.max(1, groups.length)
        return (
          <Svg width={w} height={height}>
            <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
            {groups.map((g, gi) => {
              const bw = Math.min(26, (slot * 0.72) / g.bars.length)
              const x0 = gi * slot + slot / 2 - (bw * g.bars.length) / 2
              return (
                <G key={g.k}>
                  {g.bars.map((b, bi) => {
                    const yy = y(Math.max(b.v, 0)), hh = Math.max(1.5, Math.abs(y(b.v) - y(0)))
                    return (
                      <G key={bi}>
                        <Rect x={x0 + bi * bw} y={b.v >= 0 ? yy : y(0)} width={bw - 2} height={hh} rx={3} fill={b.c} />
                        {values ? <SvgText x={x0 + bi * bw + (bw - 2) / 2} y={b.v >= 0 ? yy - 4 : y(b.v) + hh + 11} fontSize={9.5} fontWeight="700" fill={colors.text} textAnchor="middle">{usd0(b.v)}</SvgText> : null}
                      </G>
                    )
                  })}
                  <SvgText x={gi * slot + slot / 2} y={height - 5} fontSize={10} fill={colors.muted} textAnchor="middle">{g.k.length > 9 ? `${g.k.slice(0, 8)}…` : g.k}</SvgText>
                </G>
              )
            })}
          </Svg>
        )
      }}
    </Sized>
  )
}

/** One column per trade: what was kept (or lost), what was handed back after being in profit, and what was still there after the close. */
function Stacks({ rows }: { rows: { kept: number; lost: number; gave: number; left: number }[] }) {
  const hi = Math.max(1, ...rows.map((r) => r.kept + r.gave + r.left)), lo = Math.min(0, ...rows.map((r) => r.lost))
  const span = hi - lo || 1
  return (
    <Sized height={150}>
      {(w) => {
        const h = 150 - 8
        const y = (v: number) => 4 + ((hi - v) / span) * h
        const slot = w / Math.max(1, rows.length), bw = Math.max(2, slot * 0.7)
        return (
          <Svg width={w} height={150}>
            <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
            {rows.map((r, i) => {
              const x = i * slot + (slot - bw) / 2
              let up = 0
              const seg = (v: number, c: string) => { if (v <= 0) return null; const el = <Rect key={c} x={x} y={y(up + v)} width={bw} height={Math.max(1, y(up) - y(up + v))} fill={c} />; up += v; return el }
              return (
                <G key={i}>
                  {seg(r.kept, colors.green)}{seg(r.gave, AMBER)}{seg(r.left, `${colors.blue}99`)}
                  {r.lost < 0 ? <Rect x={x} y={y(0)} width={bw} height={Math.max(1, y(r.lost) - y(0))} fill={colors.red} /> : null}
                </G>
              )
            })}
          </Svg>
        )
      }}
    </Sized>
  )
}

/** Every trade as a dot: the worst it showed while open (left) against the best (up); green for a winner, red for a loser. */
function Dots({ dots }: { dots: { x: number; y: number; pnl: number }[] }) {
  const minX = Math.min(-1, ...dots.map((d) => d.x)), maxY = Math.max(1, ...dots.map((d) => d.y))
  return (
    <Sized height={190}>
      {(w) => {
        const px = 8, py = 8, W = w - px * 2, H = 190 - py - 22
        const x = (v: number) => px + ((v - minX) / (0 - minX || 1)) * W
        const y = (v: number) => py + ((maxY - v) / maxY) * H
        return (
          <Svg width={w} height={190}>
            <Line x1={x(0)} x2={x(0)} y1={py} y2={py + H} stroke={colors.border} strokeWidth={1} />
            <Line x1={px} x2={px + W} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
            {dots.map((d, i) => <Circle key={i} cx={x(d.x)} cy={y(d.y)} r={4.5} fill={d.pnl >= 0 ? colors.green : colors.red} fillOpacity={0.8} />)}
            <SvgText x={w / 2} y={190 - 5} fontSize={10} fill={colors.muted} textAnchor="middle">worst while open</SvgText>
            <SvgText x={px + 2} y={py + 10} fontSize={10} fill={colors.muted}>best while open</SvgText>
          </Svg>
        )
      }}
    </Sized>
  )
}

/** "How your trades travelled": from the trades that have a price path, what was kept, handed back after being in profit, and left after the close. */
export function PathInsights({ trades, delay = 0 }: { trades: JournalTrade[]; delay?: number }) {
  const m = useMemo(() => {
    const ts = trades.filter(withPath).sort((a, b) => +new Date(a.opened_at) - +new Date(b.opened_at))
    const rows = ts.slice(-40).map((t) => { const p = pnlOf(t), best = t.mfe_usd as number; return { kept: Math.max(p, 0), lost: Math.min(p, 0), gave: Math.max(0, best - Math.max(p, 0)), left: t.after_best_usd ?? 0 } })
    const gave = ts.reduce((a, t) => a + Math.max(0, (t.mfe_usd as number) - Math.max(pnlOf(t), 0)), 0)
    const left = ts.reduce((a, t) => a + (t.after_best_usd ?? 0), 0)
    const afterN = ts.filter((t) => t.after_best_usd != null).length
    const early = ts.filter((t) => t.after_best_usd != null && pnlOf(t) > 0 && (t.after_best_usd as number) > pnlOf(t) * 0.5).length
    const winners = ts.filter((t) => pnlOf(t) > 0)
    const dip = winners.length ? winners.reduce((a, t) => a + (t.mae_usd as number), 0) / winners.length : 0
    const dots = ts.map((t) => ({ x: -(t.mae_usd as number), y: t.mfe_usd as number, pnl: pnlOf(t) }))
    return { n: ts.length, rows, gave, left, afterN, early, dip, dots, winners: winners.length }
  }, [trades])
  return (
    <Card delay={delay}>
      <Heading icon="git-branch" color="#22d3ee">How your trades travelled</Heading>
      <Muted style={{ marginBottom: 10 }}>From price bars: how far each trade ran against you and for you.</Muted>
      {m.n === 0 ? <Muted style={{ textAlign: "center", paddingVertical: 14 }}>No trade has its price path yet. New automatic trades get theirs a couple of minutes after they close, and the day after the close fills in once that day is over.</Muted> : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <Tile label="Handed back after being in profit" value={usd0(m.gave)} sub={`${m.n} trades with a path`} color={AMBER} />
            <Tile label="Still there after you closed" value={m.afterN ? usd0(m.left) : "not in yet"} sub={m.afterN ? `24 h, at the best · ${m.early} closed early` : "fills in a day after each close"} color={colors.blue} />
            <Tile label="Winners dipped on average" value={m.winners ? `-${usd0(m.dip)}` : "-"} sub={m.winners ? `before ${m.winners} winners worked` : "no winners yet"} color={colors.red} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 4 }}>Per trade: kept, handed back, left on the table</Text>
          <Stacks rows={m.rows} />
          <Row style={{ flexWrap: "wrap" }}><Key c={colors.green} t="kept" /><Key c={colors.red} t="lost" /><Key c={AMBER} t="handed back" /><Key c={`${colors.blue}99`} t="there after you closed" /></Row>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 16, marginBottom: 4 }}>Each trade: the worst against you, the best for you</Text>
          <Dots dots={m.dots} />
          <Muted style={{ marginTop: 4 }}>A red dot high up was well in profit and still lost. A green dot far left dipped a lot before it worked.</Muted>
        </>
      )}
    </Card>
  )
}

type Hours = "1h" | "4h" | "24h"
const HOURS: { id: Hours; label: string }[] = [{ id: "1h", label: "1 hour" }, { id: "4h", label: "4 hours" }, { id: "24h", label: "24 hours" }]
const heldOf = (t: JournalTrade, h: Hours) => (h === "1h" ? t.hold_1h_usd : h === "4h" ? t.hold_4h_usd : t.hold_24h_usd)
const sessionOf = (iso: string) => { const h = new Date(iso).getUTCHours(); return h < 7 ? "Asian" : h < 12 ? "London" : h < 21 ? "New York" : "Off-hours" }
const SESSIONS = ["Asian", "London", "New York", "Off-hours"]

/** "Early exits": the trades closed by hand or by a robot, and what each would have made had it been left 1, 4 or 24 hours more. */
export function EarlyExits({ trades, delay = 0 }: { trades: JournalTrade[]; delay?: number }) {
  const [wait, setWait] = useState<Hours>("4h")
  const m = useMemo(() => {
    const ts = trades.filter((t) => t.exit_reason === "manual" && t.hold_24h_usd != null)
    const realised = ts.reduce((a, t) => a + pnlOf(t), 0)
    const total = (h: Hours) => ts.reduce((a, t) => a + (heldOf(t, h) ?? 0), 0)
    const split = (key: (t: JournalTrade) => string, order?: string[]) => {
      const g = new Map<string, { k: string; n: number; yours: number; held: number }>()
      for (const t of ts) { const k = key(t), c = g.get(k) ?? { k, n: 0, yours: 0, held: 0 }; c.n++; c.yours += pnlOf(t); c.held += pnlOf(t) + (heldOf(t, wait) ?? 0); g.set(k, c) }
      return order ? order.map((k) => g.get(k) ?? { k, n: 0, yours: 0, held: 0 }) : [...g.values()].sort((a, b) => Math.abs(b.held - b.yours) - Math.abs(a.held - a.yours)).slice(0, 6)
    }
    return { n: ts.length, realised, totals: HOURS.map((h) => ({ id: h.id, label: h.label, v: realised + total(h.id) })), bySymbol: split((t) => t.symbol), bySession: split((t) => sessionOf(t.opened_at), SESSIONS), better: ts.filter((t) => (heldOf(t, wait) ?? 0) > 0).length, diff: total(wait) }
  }, [trades, wait])
  const col = (v: number) => (v >= 0 ? colors.green : colors.red)
  const waitLabel = HOURS.find((h) => h.id === wait)?.label ?? ""
  return (
    <Card delay={delay}>
      <Heading icon="exit" color="#fbbf24">Early exits: what holding on would have made</Heading>
      <Muted style={{ marginBottom: 10 }}>Trades you closed yourself, against leaving them for 1, 4 or 24 hours more.</Muted>
      {m.n === 0 ? <Muted style={{ textAlign: "center", paddingVertical: 14 }}>No early exits to compare yet. A trade closed by hand (or by a robot, not by its stop or target) shows up here a day after it closes, once the price for the next 24 hours is in.</Muted> : (
        <>
          <Row style={{ flexWrap: "wrap", marginBottom: 10 }}>{HOURS.map((h) => <Pill key={h.id} active={wait === h.id} onPress={() => setWait(h.id)}>{h.label}</Pill>)}</Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <Tile label="Early exits" value={String(m.n)} sub="closed by hand or by a robot" color={colors.text} />
            <Tile label="Your result on them" value={sgn0(m.realised)} sub="what you made" color={col(m.realised)} />
            <Tile label={`Had you held ${waitLabel}`} value={sgn0(m.realised + m.diff)} sub={`${m.better} of ${m.n} would have done better`} color={col(m.realised + m.diff)} />
            <Tile label="The difference" value={sgn0(m.diff)} sub={m.diff >= 0 ? "left on the table" : "holding on would have cost"} color={col(m.diff)} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginBottom: 4 }}>Total result: yours against holding on</Text>
          <GroupBars values height={170} groups={[{ k: "Yours", bars: [{ v: m.realised, c: `${colors.muted}b3` }] }, ...m.totals.map((r) => ({ k: r.label.replace(" hours", "h").replace(" hour", "h"), bars: [{ v: r.v, c: col(r.v) }] }))]} />
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 14, marginBottom: 4 }}>By market: yours against holding {waitLabel}</Text>
          <GroupBars groups={m.bySymbol.map((r) => ({ k: r.k, bars: [{ v: r.yours, c: `${colors.muted}b3` }, { v: r.held, c: colors.blue }] }))} />
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 14, marginBottom: 4 }}>By time of day (UTC): yours against holding {waitLabel}</Text>
          <GroupBars groups={m.bySession.map((r) => ({ k: r.k, bars: [{ v: r.yours, c: `${colors.muted}b3` }, { v: r.held, c: colors.blue }] }))} />
          <Row style={{ flexWrap: "wrap" }}><Key c={`${colors.muted}b3`} t="your result" /><Key c={colors.blue} t="had you held on" /></Row>
          <Muted style={{ marginTop: 6 }}>Asian 00-07 · London 07-12 · New York 12-21 · Off-hours 21-24. "Held" is where the price stood that long after your close; it ignores any stop you would have had, so it can flatter holding on.</Muted>
        </>
      )}
    </Card>
  )
}

const REASON: Record<string, [string, string]> = { sl: ["Stopped out by its stop", "loss"], tp: ["Closed at its target", "win"], stopout: ["Broker stop-out", "loss"], manual: ["Closed by hand or by a robot", "info"] }

/** One trade's path: how it ended, the worst and best while open, what the day after the close held, and what holding on would have changed. */
export function TradePath({ t }: { t: JournalTrade }) {
  if (t.mae_usd == null && !t.exit_reason) return null
  const reason = t.exit_reason ? REASON[t.exit_reason] : null
  const rc = reason ? (reason[1] === "win" ? colors.green : reason[1] === "loss" ? colors.red : colors.blue) : colors.muted
  const line = (label: string, value: string, color?: string, sub?: string) => (
    <Row style={{ justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: `${colors.border}99` }}>
      <View style={{ flex: 1, paddingRight: 10 }}><Text style={{ color: colors.text, fontSize: 13.5 }}>{label}</Text>{sub ? <Muted>{sub}</Muted> : null}</View>
      <Text style={{ color: color ?? colors.text, fontSize: 14, fontWeight: "800" }}>{value}</Text>
    </Row>
  )
  const r = (n: number | null | undefined) => (n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(2)} R` : "")
  const held = [["1 hour", t.hold_1h_usd], ["4 hours", t.hold_4h_usd], ["24 hours", t.hold_24h_usd]] as const
  return (
    <Card>
      <Heading icon="git-branch" color="#22d3ee">How this trade travelled</Heading>
      {reason ? <View style={{ alignSelf: "flex-start", backgroundColor: `${rc}22`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6 }}><Text style={{ color: rc, fontSize: 12, fontWeight: "800" }}>{reason[0]}</Text></View> : null}
      {t.mae_usd != null && t.mfe_usd != null ? (
        <>
          {line("Worst while open", money(-Math.abs(t.mae_usd), "USD", true), colors.red, [t.mae != null ? `${t.mae} in price` : "", r(t.mae_r != null ? -Math.abs(t.mae_r) : null)].filter(Boolean).join(" · "))}
          {line("Best while open", money(Math.abs(t.mfe_usd), "USD", true), colors.green, [t.mfe != null ? `${t.mfe} in price` : "", r(t.mfe_r)].filter(Boolean).join(" · "))}
        </>
      ) : null}
      {t.after_best_usd != null ? line("Best in the 24 h after you closed", money(t.after_best_usd, "USD", true), colors.blue, "what the price could still have given") : null}
      {t.after_worst_usd != null ? line("Worst in the 24 h after you closed", money(-Math.abs(t.after_worst_usd), "USD", true), colors.red, "what it could have taken back") : null}
      {held.some(([, v]) => v != null) ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", marginTop: 8, marginBottom: 2 }}>If you had held on</Text> : null}
      {held.map(([l, v]) => (v != null ? line(`${l} more`, money(v, "USD", true), tone(v)) : null))}
      {t.path_source && t.path_source !== "none" ? <Muted style={{ marginTop: 6 }}>Estimated from {t.path_source} price bars.</Muted> : null}
    </Card>
  )
}
