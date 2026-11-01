import * as Haptics from "expo-haptics"
import * as SecureStore from "expo-secure-store"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"
import type { JournalTrade } from "./api"
import { badges, type Badge } from "./badges"
import { useReducedMotion } from "./fx"
import { colors } from "./theme"

/** A firm tap for good news (a badge, a saved alert). Silent where the phone has no haptics. */
export const success = () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) }

/** Springs in from small: for things that have just been earned. */
export function Pop({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: true, speed: 9, bounciness: 15 }).start()
  }, [reduced, delay, v])
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>{children}</Animated.View>
}

/** A ring that draws itself, then a tick: "saved". */
export function CheckMark({ size = 22, color = colors.green }: { size?: number; color?: string }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current
  const [p, setP] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { setP(1); return }
    const id = t.addListener(({ value }) => setP(value))
    Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    return () => t.removeListener(id)
  }, [reduced, t])
  const r = size / 2 - 2, circ = 2 * Math.PI * r
  const tickLen = size * 0.7
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={2} fill="none" strokeDasharray={[circ * Math.min(p * 1.6, 1), circ]} rotation={-90} origin={`${size / 2}, ${size / 2}`} strokeLinecap="round" />
      <Path d={`M${size * 0.3} ${size * 0.52} L${size * 0.45} ${size * 0.66} L${size * 0.72} ${size * 0.36}`} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[tickLen, tickLen]} strokeDashoffset={tickLen * (1 - Math.max(0, (p - 0.5) * 2))} />
    </Svg>
  )
}

const PALETTE = [colors.green, colors.amber, colors.blue, "#a78bfa", "#f472b6", colors.red]

/** A burst of confetti from the middle of its box, falling away. Fires once when it appears. */
export function Confetti({ count = 26, height = 260 }: { count?: number; height?: number }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(0)).current
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    angle: (Math.PI * 2 * i) / count + Math.random() * 0.5, speed: 70 + Math.random() * 110, spin: (Math.random() - 0.5) * 900,
    color: PALETTE[i % PALETTE.length], w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
  })), [count])
  useEffect(() => {
    if (reduced) return
    Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [reduced, t])
  if (reduced) return null
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: "absolute", width: p.w, height: p.h, borderRadius: 2, backgroundColor: p.color,
          opacity: t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.speed * 1.6] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, Math.sin(p.angle) * p.speed * 0.9 - 40, Math.sin(p.angle) * p.speed * 0.9 + 150] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
          ],
        }} />
      ))}
    </View>
  )
}

/** Wraps a live number: when `value` goes up it glows green for a moment, when it goes down, red (the way brokerage apps show a price ticking). */
export function Flash({ value, children, style }: { value: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const prev = useRef(value)
  const a = useRef(new Animated.Value(0)).current
  const [up, setUp] = useState(true)
  useEffect(() => {
    if (value === prev.current) return
    setUp(value > prev.current)
    prev.current = value
    if (reduced) return
    a.setValue(1)
    Animated.timing(a, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
  }, [value, reduced, a])
  return (
    <View style={style}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: -2, bottom: -2, left: -6, right: -6, borderRadius: 8, backgroundColor: up ? colors.green : colors.red, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) }} />
      {children}
    </View>
  )
}

// ---- badges just earned -------------------------------------------------------------------------------------------------------------------------------------------------

const SEEN = "edgelab.badges.seen"

/** The badges earned since the app last looked (the very first look only remembers what is already earned, so nobody gets confetti for old trades). */
export function useNewBadges(trades: JournalTrade[]): { fresh: Badge[]; done: () => void } {
  const [fresh, setFresh] = useState<Badge[]>([])
  const earned = useMemo(() => badges(trades).filter((b) => b.earned), [trades])
  const key = earned.map((b) => b.id).join(",")
  useEffect(() => {
    if (trades.length === 0) return
    let alive = true
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync(SEEN)
        if (saved === null) { await SecureStore.setItemAsync(SEEN, key); return }
        const had = new Set(saved.split(",").filter(Boolean))
        const added = earned.filter((b) => !had.has(b.id))
        if (alive && added.length) { setFresh(added); success() }
      } catch { /* no celebration */ }
    })()
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => { setFresh([]); void SecureStore.setItemAsync(SEEN, key).catch(() => {}) }
  return { fresh, done }
}

/** The card that drops in with confetti when a badge has been earned. Tap or wait to dismiss. */
export function BadgeToast({ fresh, onDone }: { fresh: Badge[]; onDone: () => void }) {
  const y = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!fresh.length) return
    y.setValue(0)
    Animated.spring(y, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }).start()
    const t = setTimeout(onDone, 4500)
    return () => clearTimeout(t)
  }, [fresh.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!fresh.length) return null
  const b = fresh[0]
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, alignItems: "center" }}>
      <Confetti height={300} />
      <Animated.View style={{ marginTop: 56, width: "90%", opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }, { scale: y.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
        <View onTouchEnd={onDone} style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1.5, borderColor: colors.amber, padding: 14, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 30 }}>🏆</Text>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: colors.amber, fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 }}>NEW BADGE{fresh.length > 1 ? `S · ${fresh.length}` : ""}</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{b.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{b.text}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}
