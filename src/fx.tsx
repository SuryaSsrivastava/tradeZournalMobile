import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg"
import { Backdrop } from "./background"
import { colors, currentScheme, radius } from "./theme"

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
  if (currentScheme() === "light") {  // as on the web: a white card that lifts off the page by tone and a soft shadow, with no outline
    return <View style={[{ borderRadius: radius.lg, backgroundColor: colors.card, padding: 14, marginBottom: 12, shadowColor: "#0f172a", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, style]}>{children}</View>
  }
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

type Look = { icon: keyof typeof Ionicons.glyphMap; color: string }
// a colour and an icon for each kind of number, as the web's KPI cards have
const LOOKS: [RegExp, Look][] = [
  [/win rate|win %/i, { icon: "radio-button-on", color: "#60a5fa" }],
  [/profit factor/i, { icon: "pie-chart", color: "#a78bfa" }],
  [/expectancy|avg r/i, { icon: "pulse", color: "#fbbf24" }],
  [/avg win/i, { icon: "bar-chart", color: "#38bdf8" }],
  [/avg loss|loss/i, { icon: "trending-down", color: "#f4566e" }],
  [/drawdown/i, { icon: "trending-down", color: "#f4566e" }],
  [/streak|consecutive/i, { icon: "flame", color: "#fb923c" }],
  [/hold|duration/i, { icon: "time", color: "#818cf8" }],
  [/days/i, { icon: "calendar", color: "#2dd4bf" }],
  [/payoff/i, { icon: "speedometer", color: "#2dd4bf" }],
  [/p&l|pnl|profit|net|total|equity|balance/i, { icon: "trending-up", color: "#22d38a" }],
]
const lookFor = (label: string): Look => LOOKS.find(([r]) => r.test(label))?.[1] ?? { icon: "stats-chart", color: "#22d3ee" }

/** The small coloured square with an icon in it, which starts every card title and number on the web. */
export function IconChip({ icon, color, size = 24 }: { icon: keyof typeof Ionicons.glyphMap; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${color}26`, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={size * 0.58} color={color} />
    </View>
  )
}

/** A card title as on the web: an icon chip and the name. */
export function Heading({ icon, color = colors.green, children, right }: { icon: keyof typeof Ionicons.glyphMap; color?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 9 }}>
      <IconChip icon={icon} color={color} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: "700", letterSpacing: -0.2 }}>{children}</Text>
      {right}
    </View>
  )
}

/** A KPI card as on the web: an icon chip with the label, the number, and a soft glow of the card's colour in the corner. */
export function Stat({ label, children, tint, min = "46%", sub, icon, corner, below }: { label: string; children: ReactNode; tint?: string; min?: `${number}%`; sub?: string; icon?: keyof typeof Ionicons.glyphMap; corner?: ReactNode; below?: ReactNode }) {
  const look = lookFor(label)
  const c = look.color
  return (
    <View style={{ flex: 1, minWidth: min, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 11 }}>
      <LinearGradient colors={[`${c}${currentScheme() === "light" ? "1f" : "2e"}`, `${c}00`]} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.8 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <IconChip icon={icon ?? look.icon} color={c} size={22} />
        <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</Text>
      </View>
      <View style={{ marginTop: 8 }}>{plain(children) ? <Text style={{ color: tint ?? colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 }}>{children}</Text> : children}</View>
      {sub ? <Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 2 }}>{sub}</Text> : null}
      {below}
      {corner ? <View style={{ position: "absolute", right: 10, bottom: 9 }}>{corner}</View> : null}
    </View>
  )
}

/** The small pictures in the corner of a KPI card, as on the web. Static (no motion), so a screen of them stays light. */
export const Mini = {
  /** A half-dial: how much of it is filled. */
  Gauge({ pct, color, size = 46 }: { pct: number; color: string; size?: number }) {
    const r = 18, c = Math.PI * r, f = Math.max(0, Math.min(1, pct / 100))
    return (
      <Svg width={size} height={size * 0.62} viewBox="0 0 48 30">
        <Path d="M6 26 A18 18 0 0 1 42 26" fill="none" stroke={`${color}33`} strokeWidth={5} strokeLinecap="round" />
        <Path d="M6 26 A18 18 0 0 1 42 26" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} />
      </Svg>
    )
  },
  /** A ring with a share of it filled. */
  Donut({ pct, color, size = 38 }: { pct: number; color: string; size?: number }) {
    const r = 14, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, pct / 100))
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Circle cx={18} cy={18} r={r} fill="none" stroke={`${color}33`} strokeWidth={5} />
        <Circle cx={18} cy={18} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 18 18)" />
      </Svg>
    )
  },
  /** One bar split in two: how big the first part is against the second (average win against average loss). */
  Split({ a, b, ca, cb }: { a: number; b: number; ca: string; cb: string }) {
    const t = a + b, f = t > 0 ? a / t : 0.5
    return (
      <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
        <View style={{ flex: Math.max(0.05, f), backgroundColor: ca }} />
        <View style={{ flex: Math.max(0.05, 1 - f), backgroundColor: cb }} />
      </View>
    )
  },
  /** A row of dots, one a trade, green for a win and red for a loss, newest last. */
  Dots({ results, size = 7 }: { results: number[]; size?: number }) {
    return (
      <View style={{ flexDirection: "row", gap: 3, marginTop: 8 }}>
        {results.map((r, i) => <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: r > 0 ? colors.green : r < 0 ? colors.red : colors.muted }} />)}
      </View>
    )
  },
  /** A small line of how a number moved. */
  Line({ points, color, width = 70, height = 26 }: { points: number[]; color: string; width?: number; height?: number }) {
    if (points.length < 2) return null
    const lo = Math.min(...points), hi = Math.max(...points), span = hi - lo || 1
    const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * width).toFixed(1)} ${(height - 2 - ((p - lo) / span) * (height - 4)).toFixed(1)}`).join(" ")
    return <Svg width={width} height={height}><Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
  },
}
