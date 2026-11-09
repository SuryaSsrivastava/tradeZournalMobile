import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef, useState, type ComponentRef } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import type { Meter } from "./api"
import { Bar, Pulse, Rise, tick, useReducedMotion } from "./fx"
import { colors } from "./theme"
import { Card, Label } from "./ui"

/** A clock that ticks every `ms`. */
export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const hm = (mins: number) => { const m = Math.max(0, Math.round(mins)); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m` }

// ---- market sessions ------------------------------------------------------------------------------------------------------------------------------------------------------

// The four forex sessions, each by its own city's clock (so they follow daylight saving there). Shown in the phone's own time zone.
const SESSIONS = [
  { name: "Sydney", zone: "Australia/Sydney", open: 7, close: 16, fallback: 10, color: "#a78bfa" },
  { name: "Tokyo", zone: "Asia/Tokyo", open: 9, close: 18, fallback: 9, color: "#f472b6" },
  { name: "London", zone: "Europe/London", open: 8, close: 17, fallback: 0, color: colors.blue },
  { name: "New York", zone: "America/New_York", open: 8, close: 17, fallback: -5, color: colors.green },
]
type Session = (typeof SESSIONS)[number]
const mod24 = (h: number) => ((h % 24) + 24) % 24
const p2 = (n: number) => String(n).padStart(2, "0")
/** 13.5 -> "13:30" */
const clockText = (h: number) => { const m = Math.round(mod24(h) * 60) % 1440; return `${p2(Math.floor(m / 60))}:${p2(m % 60)}` }

/** How many hours a city is ahead of UTC right now (half hours included). Falls back to the usual figure where the phone cannot tell. */
function zoneOffset(zone: string, fallback: number, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(at)
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"))
    const v = (asUtc - Math.floor(at.getTime() / 60000) * 60000) / 3600000
    return Number.isFinite(v) ? v : fallback
  } catch { return fallback }
}

/** Each session as a window on the member's own clock: where it starts (hours after local midnight) and how long it runs. */
function localWindows(at: Date) {
  const mine = -at.getTimezoneOffset() / 60  // the phone's offset from UTC
  return SESSIONS.map((s) => {
    const utcOpen = mod24(s.open - zoneOffset(s.zone, s.fallback, at))
    const start = mod24(utcOpen + mine)
    return { ...s, start, len: s.close - s.open }
  })
}
type Win = ReturnType<typeof localWindows>[number]
const isOpenAt = (w: Win, h: number) => mod24(h - w.start) < w.len  // h is a time on the member's clock
const untilOpen = (w: Win, h: number) => mod24(w.start - h)  // hours until it next opens
const untilClose = (w: Win, h: number) => w.len - mod24(h - w.start)
const spans = (w: Win): [number, number][] => (w.start + w.len <= 24 ? [[w.start, w.start + w.len]] : [[w.start, 24], [0, w.start + w.len - 24]])

/** The four forex sessions across the member's own day: a marker for now glides into place, the open sessions glow, each bar grows in, and a finger on the chart reads out any time of the day. */
export function SessionClock() {
  const reduced = useReducedMotion()
  const now = useNow(20_000)
  const d = new Date(now)
  const wins = localWindows(d)
  const h = d.getHours() + d.getMinutes() / 60  // now, on the phone's clock
  const [w, setW] = useState(0)
  const at = useRef(new Animated.Value(0)).current
  const grow = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const pulse = useRef(new Animated.Value(0)).current
  const scrubFade = useRef(new Animated.Value(0)).current
  const [scrub, setScrub] = useState<number | null>(null)  // a time of day (hours) under the finger
  const area = useRef<ComponentRef<typeof View>>(null)
  const left = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!w) return
    if (reduced) { at.setValue(h / 24); return }
    Animated.timing(at, { toValue: h / 24, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [h, w, reduced, at])
  useEffect(() => {
    if (reduced) return
    Animated.timing(grow, { toValue: 1, duration: 1100, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]))
    loop.start()
    return () => loop.stop()
  }, [reduced, grow, pulse])
  useEffect(() => { Animated.timing(scrubFade, { toValue: scrub === null ? 0 : 1, duration: 160, useNativeDriver: true }).start() }, [scrub, scrubFade])

  const open = wins.filter((s) => isOpenAt(s, h))
  // what happens next on the member's clock
  let nextChange: { hrs: number; text: string } | null = null
  for (const s of wins) {
    const on = isOpenAt(s, h)
    const hrs = on ? untilClose(s, h) : untilOpen(s, h)
    if (!nextChange || hrs < nextChange.hrs) nextChange = { hrs, text: `${s.name} ${on ? "closes" : "opens"} in ${hm(hrs * 60)} (${clockText(on ? s.start + s.len : s.start)})` }
  }

  const at_ = (pageX: number) => {
    if (!w) return
    setScrub(Math.max(0, Math.min(24, ((pageX - left.current) / w) * 24)))
  }
  const touch = {
    onTouchStart: (e: { nativeEvent: { pageX: number } }) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      area.current?.measureInWindow((x: number) => { left.current = x; at_(e.nativeEvent.pageX) })
      tick()
    },
    onTouchMove: (e: { nativeEvent: { pageX: number } }) => at_(e.nativeEvent.pageX),
    onTouchEnd: () => { hideTimer.current = setTimeout(() => setScrub(null), 2200) },
    onTouchCancel: () => { hideTimer.current = setTimeout(() => setScrub(null), 600) },
  }
  const at2 = scrub ?? h
  const openThen = wins.filter((s) => isOpenAt(s, at2))
  const nextThen = wins.filter((s) => !isOpenAt(s, at2)).sort((a, b) => untilOpen(a, at2) - untilOpen(b, at2))[0]
  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return "" } })()
  const off = -d.getTimezoneOffset() / 60
  const offText = `UTC${off >= 0 ? "+" : "-"}${Math.floor(Math.abs(off))}${Math.abs(off) % 1 ? `:${p2(Math.round((Math.abs(off) % 1) * 60))}` : ""}`

  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{open.length ? `${open.map((s) => s.name).join(" · ")} open` : "Markets are between sessions"}</Text>
      {nextChange ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{nextChange.text}</Text> : null}
      <View style={{ marginTop: 12 }}>
        {wins.map((s, i) => {
          const on = isOpenAt(s, h)
          return (
            <Rise key={s.name} delay={i * 80}>
              <View style={{ flexDirection: "row", alignItems: "center", height: 24 }}>
                <Text style={{ width: 64, color: on ? colors.text : colors.muted, fontSize: 11.5, fontWeight: on ? "800" : "600" }}>{s.name}</Text>
                <View style={{ flex: 1, height: 8 }} onLayout={i === 0 ? (e) => setW(e.nativeEvent.layout.width) : undefined}>
                  <View style={{ position: "absolute", left: 0, right: 0, top: 2, height: 4, borderRadius: 2, backgroundColor: `${colors.muted}1f` }} />
                  {spans(s).map(([a, b], k) => (
                    <Animated.View key={k} style={{ position: "absolute", left: `${(a / 24) * 100}%`, width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${((b - a) / 24) * 100}%`] }), top: 1, height: 6, borderRadius: 3, backgroundColor: s.color, opacity: on ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) : 0.28, shadowColor: s.color, shadowOpacity: on ? 0.9 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
                  ))}
                </View>
                <Text style={{ width: 86, textAlign: "right", color: on ? colors.text : colors.muted, fontSize: 10.5, fontWeight: on ? "800" : "600", fontVariant: ["tabular-nums"] }}>{clockText(s.start)}–{clockText(s.start + s.len)}</Text>
              </View>
            </Rise>
          )
        })}
        {w > 0 ? (
          <View ref={area} collapsable={false} {...touch} style={{ position: "absolute", left: 64, width: w, top: -4, bottom: 14 }}>
            <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.text, opacity: 0.85, transform: [{ translateX: at.interpolate({ inputRange: [0, 1], outputRange: [0, w] }) }] }}>
              <Animated.View style={{ position: "absolute", top: -3, left: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] }} />
            </Animated.View>
            {scrub !== null ? <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: (scrub / 24) * w - 1, width: 2, backgroundColor: colors.amber, opacity: scrubFade }}><View style={{ position: "absolute", top: -3, left: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber }} /></Animated.View> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", marginLeft: 64, marginRight: 86, marginTop: 2 }}>
          {["00", "06", "12", "18", "24"].map((t, i) => <Text key={t} style={{ flex: i === 4 ? 0 : 1, color: colors.muted, fontSize: 9.5, fontWeight: "600" }}>{t}</Text>)}
        </View>
      </View>
      <View style={{ minHeight: 40, marginTop: 8, borderRadius: 10, backgroundColor: scrub !== null ? `${colors.amber}14` : "transparent", paddingHorizontal: 10, paddingVertical: scrub !== null ? 6 : 0 }}>
        {scrub !== null ? (
          <>
            <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "800" }}>{clockText(scrub)}  ·  {openThen.length ? `${openThen.map((s) => s.name).join(" · ")} open` : "Between sessions"}</Text>
            {nextThen ? <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>{nextThen.name} starts at {clockText(nextThen.start)}{untilOpen(nextThen, scrub) > 0 ? `, ${hm(untilOpen(nextThen, scrub) * 60)} later` : ""}</Text> : null}
          </>
        ) : <Text style={{ color: colors.muted, fontSize: 11, paddingTop: 2 }}>Touch the chart to see any time of your day.</Text>}
      </View>
      <Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 4 }}>Times are in your time zone{zone ? ` (${zone}, ${offText})` : ` (${offText})`}. Each session follows its own city's clock, so they shift with daylight saving.</Text>
    </View>
  )
}

// ---- countdown --------------------------------------------------------------------------------------------------------------------------------------------------------------

/** A ring that empties as a release gets close, with the time to go ticking every second in the middle. A full ring means six hours or more. */
export function CountdownRing({ time, size = 96 }: { time: string; size?: number }) {
  const reduced = useReducedMotion()
  const now = useNow(1000)
  const left = Math.max(0, +new Date(time) - now)
  const WINDOW = 6 * 3600_000
  const frac = Math.min(1, left / WINDOW)
  const sweep = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const [g, setG] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    const id = sweep.addListener(({ value }) => setG(value))
    Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => sweep.removeListener(id)
  }, [reduced, sweep])
  const stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const color = left < 300_000 ? colors.red : left < 1_800_000 ? colors.amber : colors.green
  const s = Math.floor(left / 1000), days = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60
  const p2 = (n: number) => String(n).padStart(2, "0")
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${colors.muted}22`} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={[c * frac * g, c]} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <Text style={{ color: colors.text, fontSize: days > 0 ? 15 : 17, fontWeight: "800", letterSpacing: -0.3, fontVariant: ["tabular-nums"] }}>{days > 0 ? `${days}d ${p2(hh)}h` : hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${p2(mm)}:${p2(ss)}`}</Text>
      <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1, marginTop: 1 }}>{days > 0 ? "TO GO" : hh > 0 ? "H:M:S" : "M:S"}</Text>
    </View>
  )
}

// ---- guard rails ------------------------------------------------------------------------------------------------------------------------------------------------------------

const STATE = {
  ok: { color: colors.green, word: "On track" },
  warn: { color: colors.amber, word: "Close to the limit" },
  breached: { color: colors.red, word: "Limit reached" },
  achieved: { color: colors.blue, word: "Goal reached" },
} as const

/** The member's own limits and goals (set on the website) as meters that fill up, going amber near a limit and red past it. */
export function GuardRails({ meters }: { meters: (Meter & { scope?: string })[] }) {
  return (
    <View style={{ gap: 14 }}>
      {meters.map((m, i) => {
        const st = STATE[m.state]
        const pct = m.limit > 0 ? Math.min(100, (m.value / m.limit) * 100) : 0
        return (
          <Rise key={`${m.scope ?? ""}${m.key}`} delay={i * 90}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
                <Ionicons name={m.kind === "goal" ? "trophy-outline" : "shield-checkmark-outline"} size={16} color={st.color} />
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginLeft: 8, flexShrink: 1 }}>{m.scope ? `${m.scope}: ` : ""}{m.label}</Text>
                {m.state === "breached" ? <View style={{ marginLeft: 4 }}><Pulse color={colors.red} size={5} /></View> : null}
              </View>
              <Text style={{ color: st.color, fontSize: 11, fontWeight: "800" }}>{st.word}</Text>
            </View>
            <Bar pct={pct} color={st.color} height={7} />
            <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 4 }}>{m.text}</Text>
          </Rise>
        )
      })}
    </View>
  )
}

/** Today's guard rails on the home screen: one slim row that says how they stand (a dot per rail), and opens to the full meters when tapped. */
export function GuardRailsCard({ meters, onEdit, delay }: { meters: (Meter & { scope?: string })[]; onEdit: () => void; delay?: number }) {
  const [open, setOpen] = useState(false)
  const count = (s: Meter["state"]) => meters.filter((m) => m.state === s).length
  const worst = count("breached") > 0 ? "breached" : count("warn") > 0 ? "warn" : count("achieved") > 0 && count("achieved") === meters.length ? "achieved" : "ok"
  const summary = worst === "breached" ? `${count("breached")} limit${count("breached") === 1 ? "" : "s"} reached` : worst === "warn" ? `${count("warn")} close to the limit` : worst === "achieved" ? "All goals reached" : "All on track"
  return (
    <Card delay={delay}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Today's guard rails, ${summary}`}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Label>Today's guard rails</Label>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              {meters.slice(0, 8).map((m) => <View key={`${m.scope ?? ""}${m.key}`} style={{ width: 9, height: 9, borderRadius: 5, marginRight: 5, backgroundColor: STATE[m.state].color }} />)}
              <Text style={{ color: STATE[worst].color, fontSize: 12.5, fontWeight: "800", marginLeft: 6 }}>{summary}</Text>
            </View>
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 14 }}>
          <GuardRails meters={meters} />
          <Pressable onPress={onEdit} style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
            <Ionicons name="create-outline" size={15} color={colors.green} />
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: "800", marginLeft: 4 }}>Edit goals and limits</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  )
}

// ---- ticker -----------------------------------------------------------------------------------------------------------------------------------------------------------------

/** One entry on the tape: a market, a symbol, its last price and its change today. */
export type TickerItem = { key: string; symbol: string; market: string; price: number | null; chg: number | null; mine?: boolean }

const cur = (m: string) => (m === "nse" ? "₹" : m === "forex" ? "" : "$")
const fmt = (n: number, m: string) => `${cur(m)}${m === "forex" ? n.toFixed(4) : n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 0 : 2 })}`

function TickerItems({ items }: { items: TickerItem[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {items.map((s) => (
        <View key={s.key} style={{ flexDirection: "row", alignItems: "center", marginRight: 26 }}>
          {s.mine ? <Ionicons name="star" size={11} color={colors.amber} style={{ marginRight: 4 }} /> : null}
          <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "800" }}>{s.symbol}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", marginLeft: 6 }}>{s.price != null ? fmt(s.price, s.market) : "-"}</Text>
          {s.chg != null ? <Text style={{ color: s.chg >= 0 ? colors.green : colors.red, fontSize: 12, fontWeight: "800", marginLeft: 6 }}>{s.chg >= 0 ? "▲" : "▼"} {Math.abs(s.chg).toFixed(2)}%</Text> : null}
        </View>
      ))}
    </View>
  )
}

/** Prices as a tape that scrolls by, like a stock ticker. */
export function Ticker({ items }: { items: TickerItem[] }) {
  const reduced = useReducedMotion()
  const x = useRef(new Animated.Value(0)).current
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!w || reduced) return
    x.setValue(0)
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: (w / 38) * 1000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [w, reduced, x])
  if (items.length === 0) return null
  return (
    <View style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.card}cc`, overflow: "hidden", justifyContent: "center", marginBottom: 12 }}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ paddingLeft: 16 }}><TickerItems items={items} /></View>
        {!reduced ? <View style={{ paddingLeft: 16 }}><TickerItems items={items} /></View> : null}
      </Animated.View>
    </View>
  )
}
