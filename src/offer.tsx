import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, Text, View } from "react-native"
import { CountUp, Rise, useReducedMotion } from "./fx"
import { useNow } from "./homefx"
import { colors, radius } from "./theme"

/** When an offer ends. A date alone ("2026-11-30") means the end of that day, as on the website. */
const endOf = (iso: string | null | undefined) => {
  if (!iso) return null
  const t = new Date(iso.length <= 10 ? `${iso}T23:59:59` : iso).getTime()
  return Number.isNaN(t) ? null : t
}

const pad = (n: number) => String(n).padStart(2, "0")
const HOT = "#ff6a4d"

/**
 * The launch-offer tile: a warm gradient edge, a sheen that sweeps across, a flame that wiggles, sparks drifting up, the best discount counting up, and a live countdown whose seconds tick.
 * When less than a day is left the numbers turn red and pulse, faster in the last hour.
 */
export function OfferTile({ label, endsAt, best }: { label: string; endsAt: string | null; best: number }) {
  const reduced = useReducedMotion()
  const now = useNow(1000)
  const end = endOf(endsAt)
  const left = end ? Math.max(0, Math.floor((end - now) / 1000)) : null
  const over = end !== null && left === 0
  const hot = left !== null && left < 86_400 && !over
  const urgent = left !== null && left < 3600 && !over

  const sheen = useRef(new Animated.Value(0)).current
  const flame = useRef(new Animated.Value(0)).current
  const beat = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const a = Animated.loop(Animated.sequence([Animated.delay(1200), Animated.timing(sheen, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }), Animated.delay(2600), Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: true })]))
    const b = Animated.loop(Animated.sequence([Animated.timing(flame, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(flame, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.delay(900)]))
    a.start(); b.start()
    return () => { a.stop(); b.stop() }
  }, [reduced, sheen, flame])
  useEffect(() => {
    if (reduced || !hot) { beat.setValue(0); return }
    const ms = urgent ? 450 : 900
    const c = Animated.loop(Animated.sequence([Animated.timing(beat, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(beat, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]))
    c.start()
    return () => c.stop()
  }, [reduced, hot, urgent, beat])

  const accent = hot ? HOT : colors.amber
  const [w, setW] = useState(0)
  return (
    <Rise>
      <LinearGradient colors={[accent, "#f472b6", "#a78bfa", accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg + 2, padding: 1.5, marginBottom: 12 }}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.offer, padding: 16 }}>
          <LinearGradient colors={[`${accent}33`, "#a78bfa14", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {reduced ? null : (
            <>
              <Animated.View pointerEvents="none" style={{ position: "absolute", top: -30, bottom: -30, width: 80, transform: [{ rotate: "18deg" }, { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-120, Math.max(w, 300) + 80] }) }] }}>
                <LinearGradient colors={["transparent", "#ffffff2e", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <Sparks width={w} color={accent} />
            </>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 }}>
              <Animated.View style={{ transform: [{ rotate: flame.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "10deg"] }) }, { scale: flame.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
                <Ionicons name="flame" size={30} color={accent} />
              </Animated.View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: accent, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.6 }}>{over ? "OFFER ENDED" : hot ? "ENDING SOON" : "LIMITED TIME OFFER"}</Text>
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>{label}</Text>
              </View>
            </View>
            {best > 0 ? (
              <View style={{ alignItems: "center", backgroundColor: `${accent}22`, borderRadius: 14, borderWidth: 1, borderColor: `${accent}77`, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 1 }}>UP TO</Text>
                <CountUp value={best} format={(n) => `${Math.round(n)}%`} ms={1100} style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }} />
                <Text style={{ color: accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 1 }}>OFF</Text>
              </View>
            ) : null}
          </View>

          {left !== null && !over ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4, marginBottom: 7 }}>{urgent ? "Last hour. Prices go back up when it ends." : hot ? "Less than a day left." : "Time left to get these prices"}</Text>
              <Animated.View style={{ flexDirection: "row", gap: 8, transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }}>
                {[[Math.floor(left / 86400), "DAYS"], [Math.floor((left % 86400) / 3600), "HRS"], [Math.floor((left % 3600) / 60), "MIN"], [left % 60, "SEC"]].map(([v, l], i) => (
                  <Block key={l as string} value={pad(v as number)} label={l as string} accent={accent} tick={i === 3} hot={hot} />
                ))}
              </Animated.View>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Rise>
  )
}

/** One unit of the countdown. The seconds drop in each time they change. */
function Block({ value, label, accent, tick, hot }: { value: string; label: string; accent: string; tick: boolean; hot: boolean }) {
  const reduced = useReducedMotion()
  const drop = useRef(new Animated.Value(1)).current
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (reduced || !tick) return
    drop.setValue(0)
    Animated.timing(drop, { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start()
  }, [value, tick, reduced, drop])
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: "#00000055", borderRadius: 12, borderWidth: 1, borderColor: hot ? `${accent}66` : "#ffffff14", paddingVertical: 9 }}>
      <Animated.Text style={{ color: hot ? accent : colors.text, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"], opacity: tick ? drop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) : 1, transform: tick ? [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] : [] }}>{value}</Animated.Text>
      <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginTop: 1 }}>{label}</Text>
    </View>
  )
}

/** A few small lights drifting up through the tile and fading, each on its own timing. */
function Sparks({ width, color }: { width: number; color: string }) {
  const sparks = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: ((i + 0.5) / 9) * 100, delay: Math.random() * 2600, ms: 2200 + Math.random() * 1800, size: 2 + Math.random() * 3, rise: 36 + Math.random() * 40 })), [])
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {width > 0 ? sparks.map((s, i) => <Spark key={i} left={(s.x / 100) * width} {...s} color={color} />) : null}
    </View>
  )
}

function Spark({ left, delay, ms, size, rise, color }: { left: number; delay: number; ms: number; size: number; rise: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true })]))
    loop.start()
    return () => loop.stop()
  }, [delay, ms, t])
  return <Animated.View style={{ position: "absolute", left, bottom: 8, width: size, height: size, borderRadius: size, backgroundColor: color, opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] }), transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] }) }] }} />
}
