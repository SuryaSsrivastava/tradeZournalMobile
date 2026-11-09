import * as Haptics from "expo-haptics"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg"
import { Backdrop } from "./background"
import { colors, radius } from "./theme"

/** A light tick under the finger. Silent where the phone has no haptics. */
export const tick = () => { void Haptics.selectionAsync().catch(() => {}) }

/** True when the phone asks for less motion: every effect here then shows its end state at once. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced)
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced)
    return () => sub.remove()
  }, [])
  return reduced
}

/** What moves behind every screen: deep teal and indigo glows that drift, and (src/background.tsx) a grid, two scrolling chart lines and rising particles. */
export function Ambient({ scrollY }: { scrollY?: Animated.Value }) {
  const reduced = useReducedMotion()
  // parallax: the glows and the grid drift up a little slower than the page when it scrolls, so the background has depth
  const lift = scrollY && !reduced ? { transform: [{ translateY: scrollY.interpolate({ inputRange: [0, 1200], outputRange: [0, -220], extrapolate: "clamp" }) }] } : undefined
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lift]}>
      <Backdrop reduced={reduced} />
      <Orb color="#22d38a" size={420} left={-160} top={-120} dx={40} dy={50} ms={16000} reduced={reduced} opacity={0.2} />
      <Orb color="#6366f1" size={480} right={-200} top={160} dx={-50} dy={40} ms={22000} reduced={reduced} opacity={0.18} />
      <Orb color="#38bdf8" size={380} left={-60} bottom={-160} dx={60} dy={-40} ms={19000} reduced={reduced} opacity={0.12} />
    </Animated.View>
  )
}

function Orb({ color, size, left, right, top, bottom, dx, dy, ms, reduced, opacity }: { color: string; size: number; left?: number; right?: number; top?: number; bottom?: number; dx: number; dy: number; ms: number; reduced: boolean; opacity: number }) {
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [reduced, ms, t])
  const id = `g${color.slice(1)}${size}`
  return (
    <Animated.View style={{ position: "absolute", width: size, height: size, left, right, top, bottom, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }] }}>
      <Svg width={size} height={size}>
        <Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color} stopOpacity={opacity} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

/** Rises and fades in when it first appears. `delay` staggers a list of them. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [reduced, delay, v])
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{children}</Animated.View>
}

/** A button-like surface that shrinks a little under the finger. */
export function Press({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const s = useRef(new Animated.Value(1)).current
  const to = (n: number) => Animated.spring(s, { toValue: n, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
  return (
    <Pressable onPress={onPress} onPressIn={() => { to(0.97); tick() }} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  )
}

/** A number that counts up (or down) to its value. `format` turns the running number into text. */
export function CountUp({ value, format, style, ms = 900 }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; ms?: number }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  const [shown, setShown] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) { setShown(value); return }
    const id = v.addListener(({ value: n }) => setShown(n))
    Animated.timing(v, { toValue: value, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => v.removeListener(id)
  }, [value, reduced, ms, v])
  return <Text style={style}>{format(shown)}</Text>
}

/** A dot that pulses, for "live" and "coming up". */
export function Pulse({ color = colors.green, size = 8 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduced, t])
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  )
}

/** A thin bar that fills to `pct` (0 to 100). */
export function Bar({ pct, color = colors.green, height = 5 }: { pct: number; color?: string; height?: number }) {
  const reduced = useReducedMotion()
  const w = useRef(new Animated.Value(0)).current
  const p = Math.max(0, Math.min(100, pct))
  useEffect(() => {
    if (reduced) { w.setValue(p); return }
    Animated.timing(w, { toValue: p, duration: 800, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [p, reduced, w])
  return (
    <View style={{ height, borderRadius: height, backgroundColor: `${colors.muted}33`, overflow: "hidden" }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }} />
    </View>
  )
}

/** A line chart that draws itself in, with a soft fill that fades up behind it and a dot where it ends. */
export function Sparkline({ points, width = 120, height = 36, color = colors.green }: { points: number[]; width?: number; height?: number; color?: string }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const [p, setP] = useState(reduced ? 1 : 0)
  const n = points.length
  useEffect(() => {
    if (reduced) { setP(1); return }
    t.setValue(0)
    const id = t.addListener(({ value }) => setP(value))
    Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => t.removeListener(id)
  }, [n, reduced, t])
  if (n < 2) return <View style={{ width, height }} />
  const lo = Math.min(...points), hi = Math.max(...points), span = hi - lo || 1
  const x = (i: number) => (i / (n - 1)) * width
  const y = (v: number) => height - 4 - ((v - lo) / span) * (height - 8)
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  let len = 0
  for (let i = 1; i < n; i++) len += Math.hypot(x(i) - x(i - 1), y(points[i]) - y(points[i - 1]))
  const area = `${line} L${width} ${height} L0 ${height} Z`
  const id = `spark${color.slice(1)}${width}`
  return (
    <Svg width={width} height={height}>
      <Defs><SvgGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.4} /><Stop offset="1" stopColor={color} stopOpacity={0} /></SvgGradient></Defs>
      <Path d={area} fill={`url(#${id})`} opacity={p} />
      <Path d={line} stroke={color} strokeOpacity={0.25} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={[len * p, len]} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={[len * p, len]} />
      {p > 0.98 ? <Circle cx={x(n - 1)} cy={y(points[n - 1])} r={3.5} fill={color} /> : null}
    </Svg>
  )
}

/** A ring split into coloured slices that sweep round one after another. `children` sit in the middle. */
export function Ring({ slices, size = 132, stroke = 14, children }: { slices: { pct: number; color: string }[]; size?: number; stroke?: number; children?: ReactNode }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const [p, setP] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { setP(1); return }
    const id = t.addListener(({ value }) => setP(value))
    Animated.timing(t, { toValue: 1, duration: 1200, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => t.removeListener(id)
  }, [reduced, t])
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, gap = slices.length > 1 ? 3 : 0
  let at = 0
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${colors.muted}22`} strokeWidth={stroke} fill="none" />
        {slices.map((sl, i) => {
          const start = at
          at += sl.pct / 100
          const arc = Math.max(0, (sl.pct / 100) * c - gap) * p
          return <Circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={sl.color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={[arc, c]} rotation={-90 + start * 360} origin={`${size / 2}, ${size / 2}`} />
        })}
      </Svg>
      {children}
    </View>
  )
}

/** A placeholder block with a light that sweeps across it, shown while something loads. */
export function Skeleton({ width = "100%", height = 16, round = 8, style }: { width?: number | `${number}%`; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduced, t])
  return (
    <View style={[{ width, height, borderRadius: round, backgroundColor: `${colors.muted}1f`, overflow: "hidden" }, style]}>
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 160, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-160, 420] }) }] }}>
        <LinearGradient colors={["transparent", `${colors.text}18`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  )
}

/** The hero: a gradient wash, a bright edge along the top, and a slow sheen of light that sweeps across now and then. */
export function Hero({ tint = colors.green, children, style }: { tint?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2500),
      Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(5000),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [reduced, t])
  return (
    <LinearGradient colors={[`${tint}88`, `${colors.border}`, `${colors.border}55`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: radius.lg + 7, padding: 1 }, style]}>
      <View style={{ borderRadius: radius.lg + 6, overflow: "hidden", backgroundColor: colors.card }}>
        <LinearGradient colors={[`${tint}2e`, "#6366f11c", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: -40, bottom: -40, width: 90, transform: [{ rotate: "18deg" }, { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-160, 460] }) }] }}>
          <LinearGradient colors={["transparent", `${colors.text}14`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={{ padding: 18 }}>{children}</View>
      </View>
    </LinearGradient>
  )
}

/** A card with a hairline of light round its edge that fades from the top-left, like glass catching a lamp. */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={[`${colors.text}26`, `${colors.border}`, `${colors.border}66`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg + 1, padding: 1, marginBottom: 12 }}>
      <View style={[{ borderRadius: radius.lg, backgroundColor: `${colors.card}f2`, padding: 14 }, style]}>{children}</View>
    </LinearGradient>
  )
}

/** Words that rise in one after another. */
export function RisingWords({ text, style, delay = 0 }: { text: string; style?: StyleProp<TextStyle>; delay?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {text.split(" ").map((w, i) => <Rise key={`${w}${i}`} delay={delay + i * 90}><Text style={[style, { marginRight: 8 }]}>{w}</Text></Rise>)}
    </View>
  )
}

const isText = (c: unknown) => typeof c === "string" || typeof c === "number"
/** True for text and numbers, also when JSX split it into pieces (`{n}%` arrives as [n, "%"]): those need a <Text> around them. */
const plain = (c: ReactNode) => isText(c) || (Array.isArray(c) && c.every((x) => x == null || x === false || isText(x)))

/** A glass tile: a small label over a number. */
export function Stat({ label, children, tint, min = "46%" }: { label: string; children: ReactNode; tint?: string; min?: `${number}%` }) {
  return (
    <View style={{ flex: 1, minWidth: min, backgroundColor: `${colors.bg}88`, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase" }}>{label}</Text>
      <View style={{ marginTop: 3 }}>{plain(children) ? <Text style={{ color: tint ?? colors.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>{children}</Text> : children}</View>
    </View>
  )
}
