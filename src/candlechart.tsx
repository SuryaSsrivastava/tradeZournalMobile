import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, Text, View, type GestureResponderEvent } from "react-native"
import Svg, { Line, Path, Text as SvgText } from "react-native-svg"
import type { Candle } from "./api"
import { price } from "./format"
import { colors } from "./theme"

/** A horizontal line on the chart: an alert, an open trade's entry, or the alert being placed. `cross` draws a ✕ on its label (the caller asks to confirm before doing anything). */
export type ChartLine = { id: string; price: number; label: string; color: string; dashed?: boolean; cross?: () => void; busy?: boolean; confirm?: () => void; fg?: string; onDrag?: (price: number) => void; onDrop?: (price: number) => void }  // `fg`: the colour of what is written on the label (dark on the bright ones, the page colour on the one that is the text colour)

const AXIS = 62  // the price scale at the right, as on TradingView
const TIME = 24  // the time scale along the bottom
/** What is shown: how many candles, how far the chart is dragged back from the newest, and the price scale (`yz` stretches it, 1 = fitted to what is on screen; `yo` moves it, as a share of the range). */
export type View2 = { count: number; off: number; yz?: number; yo?: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** Where the newest candle rests: a few bars from the right edge, so there is room to its right, as on TradingView. */
export const HOME = -6
const maxCount = (total: number) => Math.max(60, total * 2)
/** The chart is free: it can be dragged until only a couple of candles are left on screen, to the past or to the empty space beyond the newest. */
const offRange = (total: number, count: number): [number, number] => [-(count - 3), Math.max(0, total - 3)]

/**
 * Candlesticks with lines laid over them, scaled like TradingView: one finger drags the chart through time, two fingers pinch it, dragging along the price scale (right) stretches the
 * prices and dragging along the time scale (bottom) stretches the time. Holding the chart shows a price line with a +, and letting go places an alert there. The labels carry their own
 * ✕ (and a + for a line waiting to be added), which take the tap instead of the chart.
 */
export function CandleChart({ candles, lines, onPick, last, view, setView }: { candles: Candle[]; lines: ChartLine[]; onPick?: (p: number) => void; last: number | null; view: View2; setView: (v: View2) => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const { w } = size, H = size.h
  const up = colors.green, down = colors.red
  const total = candles.length
  const yz = view.yz ?? 1, yo = view.yo ?? 0
  const count = clamp(Math.round(view.count), 10, maxCount(total))
  const [offLo, offHi] = offRange(total, count)
  const off = clamp(Math.round(view.off), offLo, offHi)
  const endIdx = total - off  // the window, in candle numbers: the candles shown are startIdx..endIdx-1 (some may be past the ends: blank space)
  const startIdx = endIdx - count
  const first = Math.max(0, startIdx), lastIdx = Math.min(total, endIdx)
  const n = Math.max(0, lastIdx - first)
  const h = Math.max(1, H - TIME)
  const plotW = Math.max(1, w - AXIS)

  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (let i = first; i < lastIdx; i++) { const c = candles[i]; if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high }
    if (lastIdx <= first && total > 0) { const c = candles[clamp(first, 0, total - 1)]; lo = c.low; hi = c.high }  // dragged into empty space: keep the scale of the nearest candle
    for (const l of lines) { if (l.price < lo) lo = l.price; if (l.price > hi) hi = l.price }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 }
    const pad = (hi - lo) * 0.06 || 1
    return { lo: lo - pad, hi: hi + pad }
  }, [candles, first, lastIdx, lines])
  const span0 = range.hi - range.lo
  const mid = (range.lo + range.hi) / 2 + yo * span0
  const lo = mid - (span0 * yz) / 2, hi = mid + (span0 * yz) / 2, span = hi - lo
  const y = (v: number) => ((hi - v) / span) * h
  const priceAt = (py: number) => hi - (clamp(py, 0, h) / h) * span
  const gap = (plotW - 8) / count
  const x = (i: number) => 4 + (i - startIdx) * gap + gap / 2  // i: a candle number
  const manual = yz !== 1 || yo !== 0

  // every candle of one colour is one path, not a dozen shapes: a drag redraws the chart often, and hundreds of separate shapes made it lag
  const paths = useMemo(() => {
    const m = { upWick: "", upBody: "", dnWick: "", dnBody: "" }
    const bw = Math.max(1, gap * 0.34)
    for (let i = first; i < lastIdx; i++) {
      const c = candles[i], cx = x(i).toFixed(1), top = y(Math.max(c.open, c.close)), bot = Math.max(top + 1.5, y(Math.min(c.open, c.close)))
      const wick = `M${cx} ${y(c.high).toFixed(1)}V${y(c.low).toFixed(1)}`
      const body = `M${(+cx - bw).toFixed(1)} ${top.toFixed(1)}H${(+cx + bw).toFixed(1)}V${bot.toFixed(1)}H${(+cx - bw).toFixed(1)}Z`
      if (c.close >= c.open) { m.upWick += wick; m.upBody += body } else { m.dnWick += wick; m.dnBody += body }
    }
    return m
  }, [candles, first, lastIdx, startIdx, gap, lo, hi, h])  // eslint-disable-line react-hooks/exhaustive-deps

  const grid = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => hi - span * f)
  const stamp = (t: number) => { const d = new Date(t * 1000); return step >= 86400 ? `${d.getDate()}/${d.getMonth() + 1}` : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
  const step = useMemo(() => { let m = Infinity; for (let i = Math.max(1, total - 30); i < total; i++) { const d = candles[i].time - candles[i - 1].time; if (d > 0 && d < m) m = d } return Number.isFinite(m) ? m : 60 }, [candles, total])
  const timeAt = (i: number) => (i < 0 ? candles[0].time + i * step : i >= total ? candles[total - 1].time + (i - total + 1) * step : candles[i].time)  // past the ends the time carries on at the bar length
  const ticks = total > 0 ? [0.08, 0.3, 0.52, 0.74, 0.94].map((f) => startIdx + Math.round(f * (count - 1))) : []
  // tags that would sit on top of each other are moved apart (the lines themselves stay at their prices), so every ✕ can be reached
  const spread = (ys: number[], step: number) => {
    const out: number[] = []
    let floor = -Infinity
    ys.map((v, i) => ({ i, v })).sort((a, b) => a.v - b.v).forEach((o) => { const at = Math.max(o.v, floor + step); out[o.i] = Math.min(at, Math.max(11, h - 11)); floor = at })
    return out
  }
  const tops = spread(lines.map((l) => y(l.price)), 24)
  const tags = spread([...lines.map((l) => y(l.price)), ...(last !== null ? [y(last)] : [])], 20)

  const [hover, setHover] = useState<number | null>(null)  // the price under the finger while it is held down on the chart: a line with a + on its label, like the cursor on the website
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frame = useRef(0)
  const pending = useRef<View2 | null>(null)
  const push = (v: View2) => { pending.current = v; if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; if (pending.current) setView(pending.current) }) }  // at most one redraw per frame
  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); if (hold.current) clearTimeout(hold.current) }, [])
  const now = useRef({ view, total, gap, priceAt, w, h, lines, y })
  now.current = { view: { ...view, count, off, yz, yo }, total, gap, priceAt, w, h, lines, y }
  const g = useRef({ t: 0, x: 0, y: 0, pageY: 0, zone: "body", moved: false, pinch: false, cross: false, vy: false, line: -1, p0: 0, d0: 0, count0: 0, off0: 0, yz0: 1, yo0: 0 })
  const stop = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null } }
  const dist = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY)
  const touch = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,  // the page must not take the gesture over: a chart is dragged, not scrolled past
    onResponderGrant: (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches[0], c = now.current
      const zone = e.nativeEvent.locationX > c.w - AXIS ? "price" : e.nativeEvent.locationY > c.h ? "time" : "body"
      g.current = { t: Date.now(), x: t.pageX, y: e.nativeEvent.locationY, pageY: t.pageY, zone, moved: false, pinch: false, cross: false, vy: false, line: -1, p0: 0, d0: 0, count0: c.view.count, off0: c.view.off, yz0: c.view.yz ?? 1, yo0: c.view.yo ?? 0 }
      stop()
      if (zone === "body") {  // a finger put down on an alert line (or the one being placed) takes hold of it: it is dragged to another price instead of moving the chart
        let best = -1, bd = 14
        c.lines.forEach((l, i) => { const d = Math.abs(c.y(l.price) - e.nativeEvent.locationY); if (l.onDrag && d <= bd) { best = i; bd = d } })
        if (best >= 0) { g.current.line = best; g.current.p0 = c.lines[best].price; void Haptics.selectionAsync().catch(() => {}); return }
      }
      // held still (on the chart or on the price scale): the price line follows the finger, and letting go places an alert there
      if (zone !== "time") hold.current = setTimeout(() => { const s = g.current; if (!s.moved && !s.pinch) { s.cross = true; void Haptics.selectionAsync().catch(() => {}); setHover(now.current.priceAt(s.y)) } }, 350)
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const ts = e.nativeEvent.touches, s = g.current, c = now.current
      const dx = ts[0].pageX - s.x, dy = ts[0].pageY - s.pageY
      if (s.line >= 0) { const l = c.lines[s.line]; if (l) { s.moved = true; l.onDrag?.(c.priceAt(c.y(s.p0) + dy)) } return }
      if (ts.length >= 2 && s.zone === "body") {
        stop(); s.cross = false; setHover(null)
        const d = dist(ts)
        if (!s.pinch) { s.pinch = true; s.d0 = d; s.count0 = c.view.count }
        if (s.d0 > 0 && d > 0) push({ ...c.view, count: clamp(s.count0 * (s.d0 / d), 10, maxCount(c.total)) })
        return
      }
      if (s.cross) { setHover(c.priceAt(s.y + dy)); return }
      if (s.pinch) return  // one finger left after a pinch: wait for the next touch
      if (s.zone === "price") {  // along the price scale: up zooms in, down zooms out
        if (!s.moved && Math.abs(dy) < 6) return
        s.moved = true; stop(); push({ ...c.view, yz: clamp(s.yz0 * Math.exp(dy / 160), 0.1, 10), yo: s.yo0 }); return
      }
      if (s.zone === "time") {  // along the time scale: left zooms in, right zooms out
        if (!s.moved && Math.abs(dx) < 6) return
        s.moved = true; stop(); push({ ...c.view, count: clamp(s.count0 * Math.exp(dx / 160), 10, maxCount(c.total)) }); return
      }
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { s.moved = true; stop() }
      if (!s.moved || c.gap <= 0) return
      if (Math.abs(dy) > 14) s.vy = true  // a clearly vertical drag moves the prices as well; a small wobble while dragging sideways does not
      const [lo, hi] = offRange(c.total, Math.round(c.view.count))
      push({ ...c.view, off: clamp(s.off0 + dx / c.gap, lo, hi), yo: s.vy || s.yz0 !== 1 || s.yo0 !== 0 ? s.yo0 + (dy / c.h) * s.yz0 : s.yo0 })
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const s = g.current
      stop()
      if (s.line >= 0) { const l = now.current.lines[s.line], t = e.nativeEvent.changedTouches[0]; if (l && s.moved) l.onDrop?.(now.current.priceAt(now.current.y(s.p0) + (t ? t.pageY - s.pageY : 0))); return }
      if (s.cross) { const t = e.nativeEvent.changedTouches[0]; onPick?.(now.current.priceAt(s.y + (t ? t.pageY - s.pageY : 0))); setHover(null); return }  // let go on the line: it becomes the alert being placed
      if (s.zone === "body" && !s.moved && !s.pinch && Date.now() - s.t < 450) onPick?.(now.current.priceAt(s.y))
    },
    onResponderTerminate: () => { stop(); g.current.cross = false; setHover(null) },
  }

  // the label of a line can be taken hold of too (its ✕ and + buttons take their own taps): dragging it moves the line
  const pill = (l: ChartLine, i: number) => {
    if (!l.onDrag) return {}
    return {
      onStartShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e: GestureResponderEvent) => { g.current = { ...g.current, line: i, p0: l.price, pageY: e.nativeEvent.touches[0].pageY, moved: false, cross: false, pinch: false } },
      onResponderMove: (e: GestureResponderEvent) => { const c = now.current; g.current.moved = true; l.onDrag?.(c.priceAt(c.y(g.current.p0) + e.nativeEvent.touches[0].pageY - g.current.pageY)) },
      onResponderRelease: (e: GestureResponderEvent) => { const c = now.current, t = e.nativeEvent.changedTouches[0]; if (g.current.moved) l.onDrop?.(c.priceAt(c.y(g.current.p0) + (t ? t.pageY - g.current.pageY : 0))); g.current.line = -1 },
    }
  }

  const tag = (top: number, bg: string, fg: string, text: string, key?: string) => (
    <View key={key} pointerEvents="none" style={{ position: "absolute", left: plotW, width: AXIS, top: top - 9, height: 18, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text numberOfLines={1} style={{ color: fg, fontSize: 10.5, fontWeight: "800" }}>{text}</Text>
    </View>
  )

  return (
    <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...touch} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 160, borderRadius: 16, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      {w > 0 && H > 0 && total > 0 ? (
        <View pointerEvents="none" style={{ flex: 1 }}>
          <Svg width={w} height={H}>
            {grid.map((v) => <Line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={0.6} />)}
            <Line x1={plotW} x2={plotW} y1={0} y2={H} stroke={colors.border} strokeWidth={1} />
            <Line x1={0} x2={w} y1={h} y2={h} stroke={colors.border} strokeWidth={1} />
            <Path d={paths.upWick} stroke={up} strokeWidth={1} fill="none" />
            <Path d={paths.dnWick} stroke={down} strokeWidth={1} fill="none" />
            <Path d={paths.upBody} fill={up} />
            <Path d={paths.dnBody} fill={down} />
            {lines.map((l) => <Line key={l.id} x1={0} x2={plotW} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeWidth={1.2} strokeDasharray={l.dashed ? "4 4" : undefined} />)}
            {hover !== null ? <Line x1={0} x2={plotW} y1={y(hover)} y2={y(hover)} stroke={colors.text} strokeWidth={1} strokeDasharray="2 3" /> : null}
            {last !== null ? <Line x1={0} x2={plotW} y1={y(last)} y2={y(last)} stroke={up} strokeWidth={0.8} /> : null}
            {grid.map((v) => <SvgText key={`p${v}`} x={w - 6} y={y(v) + 3.5} fontSize={10.5} fill={colors.muted} textAnchor="end">{price(v)}</SvgText>)}
            {ticks.map((i) => <SvgText key={`t${i}`} x={clamp(x(i), 22, plotW - 22)} y={H - 8} fontSize={10} fill={colors.muted} textAnchor="middle">{stamp(timeAt(i))}</SvgText>)}
          </Svg>
        </View>
      ) : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.muted} /></View>}
      {w > 0 && H > 0 ? lines.map((l, i) => tag(tags[i], l.color, l.fg ?? "#0b0e14", price(l.price), `g${l.id}`)) : null}
      {w > 0 && H > 0 && last !== null ? tag(tags[lines.length], up, "#04130c", price(last)) : null}
      {hover !== null ? (
        <View pointerEvents="none" style={{ position: "absolute", left: plotW - 28, width: AXIS + 28, top: y(hover) - 11, height: 22, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", backgroundColor: colors.text, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}>
          <Ionicons name="add" size={17} color={colors.bg} />
          <Text style={{ color: colors.bg, fontSize: 10.5, fontWeight: "800", width: AXIS - 2, textAlign: "center" }}>{price(hover)}</Text>
        </View>
      ) : null}
      {w > 0 && H > 0 ? lines.map((l, i) => (
        <View key={l.id} {...pill(l, i)} style={{ position: "absolute", right: AXIS, top: tops[i] - 11, flexDirection: "row", alignItems: "center", backgroundColor: l.color, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, height: 22, paddingLeft: 7, maxWidth: plotW - 8 }}>
          <Text numberOfLines={1} style={{ color: l.fg ?? "#0b0e14", fontSize: 10.5, fontWeight: "800", flexShrink: 1 }}>{l.label}</Text>
          {l.confirm ? <Pressable onPress={l.confirm} accessibilityLabel="Add this alert" style={{ width: 24, height: 22, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={18} color={l.fg ?? "#0b0e14"} /></Pressable> : null}
          {l.cross ? <Pressable onPress={l.cross} disabled={l.busy} accessibilityLabel={`Remove ${l.label}`} style={{ width: 24, height: 22, alignItems: "center", justifyContent: "center" }}>{l.busy ? <ActivityIndicator size="small" color={l.fg ?? "#0b0e14"} /> : <Ionicons name="close" size={16} color={l.fg ?? "#0b0e14"} />}</Pressable> : <View style={{ width: 6 }} />}
        </View>
      )) : null}
      {Math.abs(off - HOME) > 2 ? (
        <Pressable onPress={() => setView({ ...now.current.view, off: HOME, yo: 0 })} hitSlop={6} accessibilityLabel="Back to the latest candle" style={{ position: "absolute", right: AXIS + 8, bottom: TIME + 8, height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>Latest</Text>
          <Ionicons name={off < HOME ? "chevron-back" : "chevron-forward"} size={14} color={colors.text} />
        </Pressable>
      ) : null}
      {manual ? (
        <Pressable onPress={() => setView({ ...now.current.view, yz: 1, yo: 0 })} hitSlop={6} accessibilityLabel="Fit the price scale" style={{ position: "absolute", right: 6, bottom: 3, height: 18, paddingHorizontal: 7, borderRadius: 9, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>Auto</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
