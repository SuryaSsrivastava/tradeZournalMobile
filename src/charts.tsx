import { useEffect, useMemo, useRef, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg"
import { Sparkline, tick, useReducedMotion } from "./fx"
import { money } from "./format"
import { colors, radius } from "./theme"

/**
 * Touch a chart and a marker follows the finger: a line, a dot on the curve, and a small label with the value and what it stands for. It stays a moment after the finger lifts. Put it over a chart
 * of `w` by `height` whose points are spread evenly across the width; `yOf` gives the height of a value, the same one the chart draws with.
 */
function Scrub({ points, w, height, yOf, color, format, labels }: { points: number[]; w: number; height: number; yOf: (v: number) => number; color: string; format: (v: number) => string; labels?: string[] }) {
  const [i, setI] = useState<number | null>(null)
  const last = useRef(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const n = points.length
  const move = (x: number) => {
    const k = Math.max(0, Math.min(n - 1, Math.round((x / Math.max(1, w)) * (n - 1))))
    if (k !== last.current) { last.current = k; tick(); setI(k) }
  }
  const x = i == null ? 0 : (i / (n - 1)) * w
  const boxW = 124
  return (
    <View style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { if (timer.current) clearTimeout(timer.current); move(e.nativeEvent.locationX) }}
      onResponderMove={(e) => move(e.nativeEvent.locationX)}
      onResponderRelease={() => { timer.current = setTimeout(() => { last.current = -1; setI(null) }, 2200) }}>
      {i != null ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={w} height={height}>
            <Line x1={x} x2={x} y1={0} y2={height} stroke={colors.muted} strokeOpacity={0.6} strokeWidth={1} strokeDasharray={[3, 3]} />
            <Circle cx={x} cy={yOf(points[i])} r={5} fill={color} stroke={colors.card} strokeWidth={2} />
          </Svg>
          <View style={{ position: "absolute", top: -6, left: Math.max(0, Math.min(w - boxW, x - boxW / 2)), width: boxW, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, alignItems: "center" }}>
            <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{format(points[i])}</Text>
            {labels?.[i] ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>{labels[i]}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** A line that fills the width of whatever holds it. `format` and `labels` (what each point stands for) are shown when it is touched. */
export function Curve({ points, height = 90, color, format = (v) => v.toFixed(2), labels }: { points: number[]; height?: number; color?: string; format?: (v: number) => string; labels?: string[] }) {
  const [w, setW] = useState(0)
  const c = color ?? (points.length > 1 && points[points.length - 1] < points[0] ? colors.red : colors.green)
  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height }}>
      {w > 0 && points.length > 1 ? <Sparkline points={points} width={w} height={height} color={c} /> : null}
      {w > 0 && points.length > 1 ? (() => { const lo = Math.min(...points), span = Math.max(...points) - lo || 1; return <Scrub points={points} w={w} height={height} color={c} format={format} labels={labels} yOf={(v) => height - 4 - ((v - lo) / span) * (height - 8)} /> })() : null}
    </View>
  )
}

const DAY = ["M", "T", "W", "T", "F", "S", "S"]
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

type CalView = "week" | "month" | "year"
const startOfWeek = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }  // Monday
const tint = (c: string, a: number) => `${c}${Math.round(a * 255).toString(16).padStart(2, "0")}`
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/**
 * The trading calendar in three views: a week (one row a day, with a bar for its size), a month (each square is a day, green for a profit and red for a loss, deeper the bigger it is) and a year
 * (a tile for each month, tap one to open it). The week view can also be shown as blocks: a tile for each week of the month with its total, tap one to open that week. The arrows move by one
 * week, month or year (a month in blocks). Tap a day for its trades.
 */
export function PnlCalendar({ byDay, onPick }: { byDay: Map<string, number>; onPick?: (day: Date, pnl: number | null) => void }) {
  const [view, setView] = useState<CalView>("month")
  const [anchor, setAnchor] = useState(() => new Date())  // any day inside the week, month or year on show
  const [picked, setPicked] = useState<string | null>(null)
  const [weekLayout, setWeekLayout] = useState<"days" | "blocks">("days")
  const blocks = view === "week" && weekLayout === "blocks"
  const unit: CalView = blocks ? "month" : view  // what the arrows and the title go by
  const today = new Date()
  const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const monday = startOfWeek(anchor)
  const year = anchor.getFullYear()

  const move = (n: number) => {
    setPicked(null)
    setAnchor((a) => unit === "week" ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * n) : unit === "month" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : new Date(a.getFullYear() + n, 0, 1))
  }
  const canNext = unit === "week" ? new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7) <= today : unit === "month" ? new Date(month.getFullYear(), month.getMonth() + 1, 1) <= today : year < today.getFullYear()
  const swap = (v: CalView) => { setPicked(null); setView(v) }

  // the days of the period on show, and what they add up to
  const cells = useMemo(() => {
    if (view === "week" && !blocks) return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
    if (view === "year" || blocks) return []
    const first = (month.getDay() + 6) % 7  // Monday first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const out: (Date | null)[] = Array(first).fill(null)
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d))
    while (out.length % 7) out.push(null)
    return out
  }, [view, blocks, month, monday])
  const months = useMemo(() => {
    const m = Array.from({ length: 12 }, () => ({ pnl: 0, days: 0, wins: 0 }))
    for (const [k, v] of byDay) { const [y, mo] = k.split("-").map(Number); if (y === year) { m[mo].pnl += v; m[mo].days++; if (v > 0) m[mo].wins++ } }
    return m
  }, [byDay, year])
  // the weeks of the month on show (only the days that fall in the month count, so the blocks add up to the month)
  const weekBlocks = useMemo(() => {
    if (!blocks) return []
    const first = new Date(month.getFullYear(), month.getMonth(), 1), last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const out: { from: Date; to: Date; pnl: number; days: number; wins: number }[] = []
    for (let st = startOfWeek(first); st <= last; st = new Date(st.getFullYear(), st.getMonth(), st.getDate() + 7)) {
      const from = st < first ? first : st
      const sun = new Date(st.getFullYear(), st.getMonth(), st.getDate() + 6)
      const to = sun > last ? last : sun
      let pnl = 0, days = 0, wins = 0
      for (let d = new Date(from); d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) { const v = byDay.get(key(d)); if (v != null) { pnl += v; days++; if (v > 0) wins++ } }
      out.push({ from, to, pnl, days, wins })
    }
    return out
  }, [blocks, month, byDay])
  const maxWeek = Math.max(1, ...weekBlocks.map((w) => Math.abs(w.pnl)))
  const dayVals = cells.flatMap((d) => (d && byDay.has(key(d)) ? [Math.abs(byDay.get(key(d))!)] : []))
  const max = Math.max(1, ...dayVals)
  const maxMonth = Math.max(1, ...months.map((m) => Math.abs(m.pnl)))
  const total = view === "year" ? months.reduce((a, m) => a + m.pnl, 0) : blocks ? weekBlocks.reduce((a, w) => a + w.pnl, 0) : cells.reduce((a, d) => a + (d ? byDay.get(key(d)) ?? 0 : 0), 0)
  const title = unit === "year" ? String(year)
    : unit === "month" ? month.toLocaleDateString([], { month: "long", year: "numeric" })
    : `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`
  const pick = (d: Date, v: number | undefined) => { setPicked(key(d)); onPick?.(d, v ?? null) }
  // the trading days of the period on show: how many were green, and the best and the worst of them
  const period = useMemo(() => {
    const weekEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
    let days = 0, green = 0
    let best: { d: Date; v: number } | null = null, worst: { d: Date; v: number } | null = null
    for (const [k, v] of byDay) {
      const [y, mo, da] = k.split("-").map(Number)
      const d = new Date(y, mo, da)
      const inside = unit === "year" ? y === year : unit === "month" ? y === month.getFullYear() && mo === month.getMonth() : d >= monday && d < weekEnd
      if (!inside) continue
      days++
      if (v > 0) green++
      if (!best || v > best.v) best = { d, v }
      if (!worst || v < worst.v) worst = { d, v }
    }
    return { days, green, best: best && best.v > 0 ? best : null, worst: worst && worst.v < 0 ? worst : null }
  }, [byDay, unit, year, month, monday])

  return (
    <View>
      <View style={{ flexDirection: "row", alignSelf: "center", backgroundColor: `${colors.border}66`, borderRadius: radius.pill, padding: 3, marginBottom: 12 }}>
        {(["week", "month", "year"] as const).map((v) => (
          <Pressable key={v} onPress={() => { tick(); swap(v) }} style={{ paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: view === v ? colors.card : "transparent" }}>
            <Text style={{ color: view === v ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "800", textTransform: "capitalize" }}>{v}</Text>
          </Pressable>
        ))}
      </View>
      {view === "week" ? (
        <View style={{ flexDirection: "row", alignSelf: "flex-end", gap: 6, marginBottom: 8 }}>
          {(["days", "blocks"] as const).map((l) => (
            <Pressable key={l} onPress={() => { tick(); setPicked(null); setWeekLayout(l) }} hitSlop={6} style={{ width: 34, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: weekLayout === l ? `${colors.green}22` : "transparent", borderWidth: 1, borderColor: weekLayout === l ? `${colors.green}66` : `${colors.border}99` }}>
              <Ionicons name={l === "days" ? "list" : "grid"} size={16} color={weekLayout === l ? colors.green : colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={() => move(-1)} hitSlop={12}><Text style={{ color: colors.muted, fontSize: 20, paddingHorizontal: 6 }}>‹</Text></Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: total > 0 ? colors.green : total < 0 ? colors.red : colors.muted, fontSize: 12, fontWeight: "700" }}>{money(total, "USD", true)}</Text>
        </View>
        <Pressable onPress={() => canNext && move(1)} hitSlop={12} style={{ opacity: canNext ? 1 : 0.25 }}><Text style={{ color: colors.muted, fontSize: 20, paddingHorizontal: 6 }}>›</Text></Pressable>
      </View>

      {view === "year" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {months.map((m, i) => {
            const c = m.days === 0 ? colors.border : m.pnl >= 0 ? colors.green : colors.red
            const future = new Date(year, i, 1) > today
            return (
              <View key={i} style={{ width: "33.333%", padding: 3 }}>
                <Pressable onPress={() => { tick(); setPicked(null); setAnchor(new Date(year, i, 1)); setView("month") }}
                  style={{ borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 8, minHeight: 74, justifyContent: "space-between", opacity: future ? 0.4 : 1, backgroundColor: m.days === 0 ? `${colors.border}55` : tint(c, 0.16 + 0.5 * (Math.abs(m.pnl) / maxMonth)) }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{new Date(year, i, 1).toLocaleDateString([], { month: "short" })}</Text>
                  <View>
                    <Text style={{ color: m.days === 0 ? colors.muted : colors.text, fontSize: 12.5, fontWeight: "800" }}>{m.days === 0 ? "-" : money(m.pnl, "USD", true)}</Text>
                    {m.days > 0 ? <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>{m.days} {m.days === 1 ? "day" : "days"} · {Math.round((m.wins / m.days) * 100)}% green</Text> : null}
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : blocks ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {weekBlocks.map((w, i) => {
            const c = w.days === 0 ? colors.border : w.pnl >= 0 ? colors.green : colors.red
            const future = w.from > today
            const range = w.from.getDate() === w.to.getDate() ? `${w.from.getDate()}` : `${w.from.getDate()}–${w.to.getDate()}`
            return (
              <View key={i} style={{ width: "50%", padding: 3 }}>
                <Pressable onPress={() => { tick(); setPicked(null); setAnchor(w.from); setWeekLayout("days") }}
                  style={{ borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 10, minHeight: 88, justifyContent: "space-between", opacity: future ? 0.4 : 1, backgroundColor: w.days === 0 ? `${colors.border}55` : tint(c, 0.16 + 0.5 * (Math.abs(w.pnl) / maxWeek)) }}>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Week {i + 1}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>{range} {month.toLocaleDateString([], { month: "short" })}</Text>
                  </View>
                  <View>
                    <Text style={{ color: w.days === 0 ? colors.muted : colors.text, fontSize: 14, fontWeight: "800" }}>{w.days === 0 ? "-" : money(w.pnl, "USD", true)}</Text>
                    {w.days > 0 ? <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600" }}>{w.days} {w.days === 1 ? "day" : "days"} · {Math.round((w.wins / w.days) * 100)}% green</Text> : null}
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      ) : view === "week" ? (
        <View style={{ gap: 6 }}>
          {(cells as Date[]).map((d, i) => {
            const v = byDay.get(key(d))
            const sel = picked === key(d)
            const c = v == null ? colors.border : v >= 0 ? colors.green : colors.red
            const future = d > today
            return (
              <Pressable key={i} onPress={() => pick(d, v)} style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, opacity: future ? 0.4 : 1, borderWidth: sel ? 1.5 : 1, borderColor: sel ? colors.text : `${colors.border}99`, backgroundColor: `${colors.card}cc` }}>
                <View style={{ width: 46 }}>
                  <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>{WEEKDAY[i].toUpperCase()}</Text>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{d.getDate()}</Text>
                </View>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: `${colors.border}55`, overflow: "hidden", marginHorizontal: 10 }}>
                  {v != null ? <View style={{ width: `${Math.max(4, (Math.abs(v) / max) * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: c }} /> : null}
                </View>
                <Text style={{ width: 92, textAlign: "right", color: v == null ? colors.muted : c, fontSize: 13, fontWeight: "800" }}>{v == null ? "no trades" : money(v, "USD", true)}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", marginBottom: 4 }}>{DAY.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 10, fontWeight: "700" }}>{d}</Text>)}</View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {(cells as (Date | null)[]).map((d, i) => {
              const v = d ? byDay.get(key(d)) : undefined
              const a = v == null ? 0 : 0.18 + 0.62 * (Math.abs(v) / max)
              const c = v == null ? colors.border : v >= 0 ? colors.green : colors.red
              const sel = d && picked === key(d)
              return (
                <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
                  {d ? (
                    <Pressable onPress={() => pick(d, v)}
                      style={{ aspectRatio: 1, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: v == null ? `${colors.border}55` : tint(c, a), borderWidth: sel ? 1.5 : 0, borderColor: colors.text }}>
                      <Text style={{ color: v == null ? colors.muted : colors.text, fontSize: 11, fontWeight: v == null ? "500" : "800" }}>{d.getDate()}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            })}
          </View>
        </>
      )}

      {period.days > 0 ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: `${colors.border}44`, borderRadius: radius.md, padding: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>Green days</Text>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 2 }}><Text style={{ color: colors.green }}>{period.green}</Text> of {period.days}</Text>
            <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>{Math.round((period.green / period.days) * 100)}% of trading days</Text>
          </View>
          {([["Best day", period.best, colors.green], ["Worst day", period.worst, colors.red]] as const).map(([label, x, c]) => (
            <Pressable key={label} disabled={!x} onPress={() => x && pick(x.d, x.v)} style={{ flex: 1, backgroundColor: `${colors.border}44`, borderRadius: radius.md, padding: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</Text>
              <Text style={{ color: x ? c : colors.muted, fontSize: 15, fontWeight: "800", marginTop: 2 }}>{x ? money(x.v, "USD", true) : "-"}</Text>
              <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "600" }}>{x ? x.d.toLocaleDateString([], { day: "numeric", month: "short" }) : "none"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** Wins against losses as one split bar with the counts at each end. */
export function SplitBar({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel: string; rightLabel: string }) {
  const t = left + right || 1
  return (
    <View>
      <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: `${colors.muted}33` }}>
        <View style={{ flex: left / t, backgroundColor: colors.green }} />
        <View style={{ width: 2 }} />
        <View style={{ flex: right / t, backgroundColor: colors.red }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: "700" }}>{left} {leftLabel}</Text>
        <Text style={{ color: colors.red, fontSize: 12, fontWeight: "700" }}>{right} {rightLabel}</Text>
      </View>
    </View>
  )
}

/** Progress from 0 to 1 over `ms`, restarted whenever `key` changes (a chart grows in again when its data does). */
function useGrow(key: string, ms = 900) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const [p, setP] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { setP(1); return }
    v.setValue(0)
    const id = v.addListener(({ value }) => setP(value))
    Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => v.removeListener(id)
  }, [key, reduced, ms, v])
  return p
}

/** Columns above and below a zero line, growing in one after another. Tap one to read it. */
export function Columns({ data, height = 130, format, labelEvery = 1, color }: { data: { label: string; value: number }[]; height?: number; format: (n: number) => string; labelEvery?: number; color?: (d: { label: string; value: number }, i: number) => string }) {
  const [sel, setSel] = useState<number | null>(null)
  const p = useGrow(data.map((d) => d.value.toFixed(2)).join(","))
  const top = Math.max(0, ...data.map((d) => d.value)), bot = Math.max(0, ...data.map((d) => -d.value))
  const scale = height / (top + bot || 1), zero = top * scale
  const n = data.length
  const chosen = sel != null ? data[sel] : null
  return (
    <View>
      <Text style={{ color: chosen ? (color ? color(chosen, sel!) : chosen.value >= 0 ? colors.green : colors.red) : colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 8, height: 16 }}>
        {chosen ? `${chosen.label}: ${format(chosen.value)}` : "Tap a bar"}
      </Text>
      <View style={{ height, flexDirection: "row" }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: zero, height: 1, backgroundColor: `${colors.muted}44` }} />
        {data.map((d, i) => {
          const local = Math.max(0, Math.min(1, p * (n + 3) / 3 - i / 3))  // each bar starts a little after the one before
          const h = Math.max(d.value === 0 ? 0 : 2, Math.abs(d.value) * scale * local)
          const c = color ? color(d, i) : d.value >= 0 ? colors.green : colors.red
          return (
            <Pressable key={i} onPress={() => { tick(); setSel(sel === i ? null : i) }} style={{ flex: 1, paddingHorizontal: n > 20 ? 1 : 3 }}>
              <View style={{ position: "absolute", left: n > 20 ? 1 : 3, right: n > 20 ? 1 : 3, top: d.value >= 0 ? zero - h : zero, height: h, borderRadius: 3, backgroundColor: c, opacity: sel == null || sel === i ? 1 : 0.35 }} />
            </Pressable>
          )
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {data.map((d, i) => <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: "center", color: sel === i ? colors.text : colors.muted, fontSize: 9.5, fontWeight: "600", opacity: i % labelEvery === 0 ? 1 : 0 }}>{d.label}</Text>)}
      </View>
    </View>
  )
}

/** Ranked rows: a label, a bar that fills out to its share of the biggest, and the figure. */
export function RankBars({ rows, format }: { rows: { key: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const p = useGrow(rows.map((r) => `${r.key}${r.value.toFixed(1)}`).join(","), 800)
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)))
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r, i) => {
        const local = Math.max(0, Math.min(1, p * (rows.length + 1) - i * 0.6))
        const c = r.value >= 0 ? colors.green : colors.red
        return (
          <View key={r.key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700", flex: 1, paddingRight: 8 }}>{r.key}{r.sub ? <Text style={{ color: colors.muted, fontWeight: "500" }}>  {r.sub}</Text> : null}</Text>
              <Text style={{ color: c, fontSize: 13, fontWeight: "800" }}>{format(r.value)}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: `${colors.muted}26`, overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c, width: `${(Math.abs(r.value) / max) * 100 * local}%` }} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

/**
 * A line with a filled area that draws itself in. `baseline` is a dashed reference line (zero for a drawdown, 50 for a win rate); the fill runs from the line to `fillTo`.
 * `from`/`to` fix the scale when it should not follow the data (a win rate always spans 0 to 100).
 */
export function AreaChart({ points, height = 96, color = colors.green, baseline, fillTo = "bottom", from, to, format = (v) => v.toFixed(1), labels }: { points: number[]; height?: number; color?: string; baseline?: number; fillTo?: "top" | "bottom"; from?: number; to?: number; format?: (v: number) => string; labels?: string[] }) {
  const [w, setW] = useState(0)
  const p = useGrow(points.length + ":" + points.slice(-3).map((v) => v.toFixed(1)).join(","), 1100)
  const n = points.length
  if (n < 2) return <View style={{ height }} />
  const lo = from ?? Math.min(...points, baseline ?? Infinity), hi = to ?? Math.max(...points, baseline ?? -Infinity), span = hi - lo || 1
  const y = (v: number) => 4 + ((hi - v) / span) * (height - 8)
  const x = (i: number) => (i / (n - 1)) * w
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  let len = 0
  for (let i = 1; i < n; i++) len += Math.hypot(x(i) - x(i - 1), y(points[i]) - y(points[i - 1]))
  const edge = fillTo === "top" ? 0 : height
  const id = `ar${color.slice(1)}${fillTo}`
  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs><SvgGradient id={id} x1="0" y1={fillTo === "top" ? "1" : "0"} x2="0" y2={fillTo === "top" ? "0" : "1"}><Stop offset="0" stopColor={color} stopOpacity={0.4} /><Stop offset="1" stopColor={color} stopOpacity={0} /></SvgGradient></Defs>
          {baseline != null ? <Line x1={0} x2={w} y1={y(baseline)} y2={y(baseline)} stroke={colors.muted} strokeOpacity={0.5} strokeWidth={1} strokeDasharray={[3, 4]} /> : null}
          <Path d={`${line} L${w} ${edge} L0 ${edge} Z`} fill={`url(#${id})`} opacity={p} />
          <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={[len * p, len]} />
        </Svg>
      ) : null}
      {w > 0 ? <Scrub points={points} w={w} height={height} color={color} format={format} labels={labels} yOf={y} /> : null}
    </View>
  )
}
