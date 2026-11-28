import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Text, View } from "react-native"
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg"
import type { LivePosition } from "./api"
import { Pulse, useReducedMotion } from "./fx"
import { price } from "./format"
import { colors } from "./theme"

/**
 * One reading of the profit per trade each time the server answers, kept while the screen is open (the server only says what the profit is now, not how it got there).
 * `stamp` changes with every fresh answer.
 */
export function useProfitHistory(open: LivePosition[], stamp: string | undefined): Record<string, number[]> {
  const store = useRef<Record<string, number[]>>({})
  const [, bump] = useState(0)
  useEffect(() => {
    const alive = new Set(open.map((p) => p.id))
    for (const p of open) {
      const a = store.current[p.id] ?? (store.current[p.id] = [])
      a.push(p.profit)
      if (a.length > 90) a.shift()
    }
    for (const id of Object.keys(store.current)) if (!alive.has(id)) delete store.current[id]
    bump((n) => n + 1)
  }, [stamp])  // eslint-disable-line react-hooks/exhaustive-deps
  return store.current
}

/** The profit of a trade as a line over the last readings: a dashed zero line, a soft fill, and a dot that pulses at the newest reading. */
export function LiveLine({ points, height = 54 }: { points: number[]; height?: number }) {
  const [w, setW] = useState(0)
  const pts = points.length === 0 ? [0, 0] : points.length === 1 ? [points[0], points[0]] : points
  const last = pts[pts.length - 1]
  const c = last >= 0 ? colors.green : colors.red
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1
  const y = (v: number) => 4 + ((hi - v) / span) * (height - 8)
  const x = (i: number) => (i / (pts.length - 1)) * w
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const id = `lv${c.slice(1)}`
  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height}>
            <Defs><SvgGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c} stopOpacity={0.35} /><Stop offset="1" stopColor={c} stopOpacity={0} /></SvgGradient></Defs>
            <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={colors.muted} strokeOpacity={0.45} strokeWidth={1} strokeDasharray={[3, 4]} />
            <Path d={`${line} L${w} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
            <Path d={line} stroke={c} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
          <View pointerEvents="none" style={{ position: "absolute", left: w - 7 * 1.2 - 2, top: y(last) - 7 * 1.2 }}><Pulse color={c} size={7} /></View>
        </>
      ) : null}
    </View>
  )
}

/** Where the price is between the stop (left, red) and the target (right, green): the entry is marked, and the dot glides as the price moves. */
export function RangeBar({ stop, target, open, now }: { stop: number | null; target: number | null; open: number | null; now: number | null }) {
  const reduced = useReducedMotion()
  const [w, setW] = useState(0)
  const at = useRef(new Animated.Value(0.5)).current
  const ok = stop != null && target != null && stop !== target && now != null
  const span = ok ? (target as number) - (stop as number) : 1
  const frac = (v: number | null) => (ok && v != null ? Math.max(0, Math.min(1, (v - (stop as number)) / span)) : 0.5)
  const p = frac(now), entry = frac(open)
  useEffect(() => {
    if (reduced) { at.setValue(p); return }
    Animated.timing(at, { toValue: p, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [p, reduced, at])
  if (!ok) return null
  const winning = p >= entry
  const c = winning ? colors.green : colors.red
  return (
    <View style={{ marginTop: 10 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 14, justifyContent: "center" }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: `${colors.muted}26`, overflow: "hidden", flexDirection: "row" }}>
          <View style={{ width: `${entry * 100}%`, backgroundColor: `${colors.red}55` }} />
          <View style={{ flex: 1, backgroundColor: `${colors.green}55` }} />
        </View>
        {w > 0 ? <View style={{ position: "absolute", left: entry * w - 1, width: 2, height: 12, backgroundColor: colors.muted, borderRadius: 1 }} /> : null}
        {w > 0 ? <Animated.View style={{ position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: c, borderWidth: 2, borderColor: colors.card, shadowColor: c, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4, transform: [{ translateX: at.interpolate({ inputRange: [0, 1], outputRange: [0, w - 14] }) }] }} /> : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
        <Text style={{ color: colors.red, fontSize: 10.5, fontWeight: "700" }}>SL {price(stop)}</Text>
        <Text style={{ color: colors.green, fontSize: 10.5, fontWeight: "700" }}>TP {price(target)}</Text>
      </View>
    </View>
  )
}
