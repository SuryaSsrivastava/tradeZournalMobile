import { useEffect, useRef } from "react"
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg"
import { colors, currentScheme } from "./theme"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedRect = Animated.createAnimatedComponent(Rect)

/** The TradeZournal mark: two interlocking rings with a candle where they meet, on a dark rounded tile. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="bm-a" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#a7f3d0" /><Stop offset="1" stopColor="#22d3ee" /></LinearGradient>
        <LinearGradient id="bm-b" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#34d399" /><Stop offset="1" stopColor="#60a5fa" /></LinearGradient>
        <LinearGradient id="bm-f" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#6ee7b7" /><Stop offset="1" stopColor="#10b981" /></LinearGradient>
      </Defs>
      <Rect width={64} height={64} rx={18} fill="#0d1a1a" />
      <Rect x={0.75} y={0.75} width={62.5} height={62.5} rx={17.5} fill="none" stroke="url(#bm-a)" strokeOpacity={0.5} strokeWidth={1.5} />
      <Circle cx={25} cy={32} r={14} fill="none" stroke="url(#bm-a)" strokeWidth={3.6} />
      <Circle cx={39} cy={32} r={14} fill="none" stroke="url(#bm-b)" strokeWidth={3.6} />
      <Line x1={32} y1={22} x2={32} y2={42} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      <Rect x={29.5} y={26} width={5} height={12} rx={1.8} fill="url(#bm-f)" />
    </Svg>
  )
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
/** The colour a fraction of the way along a gradient of stops. */
function along(stops: string[], f: number) {
  const x = Math.min(0.999, Math.max(0, f)) * (stops.length - 1)
  const i = Math.floor(x)
  const [a, b] = [hex(stops[i]), hex(stops[i + 1])]
  return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * (x - i)).toString(16).padStart(2, "0")).join("")
}

/**
 * The lettering, as on the web: "Trade" light and "Zournal" extra bold, in Sora, with "Zournal" running emerald, cyan, blue
 * (the deeper 700s on a light background). The gradient is one colour per letter. `color` is the colour of "Trade".
 */
export function BrandWord({ size = 20, color = colors.text }: { size?: number; color?: string }) {
  const stops = currentScheme() === "light" ? ["#047857", "#0e7490", "#1d4ed8"] : ["#34d399", "#22d3ee", "#60a5fa"]
  const z = "Zournal".split("")
  return (
    <Text style={{ fontSize: size, letterSpacing: -size * 0.025, color, includeFontPadding: false }} accessibilityLabel="TradeZournal">
      <Text style={{ fontFamily: "Sora-Light" }}>Trade</Text>
      {z.map((ch, i) => <Text key={i} style={{ fontFamily: "Sora-ExtraBold", color: along(stops, i / (z.length - 1)) }}>{ch}</Text>)}
    </Text>
  )
}

/**
 * The loader: the brand's two rings slide apart and together with the candle between them growing and shrinking.
 * It takes the same props as React Native's ActivityIndicator (`size`, `color`, `style`), so it replaces it where it is used: `color` is the candle's colour.
 */
export function Spinner({ size = "small", color = "#fff", style }: { size?: "small" | "large" | number; color?: string; style?: StyleProp<ViewStyle> }) {
  const px = typeof size === "number" ? size : size === "large" ? 44 : 24
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(t, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [t])
  const ax = t.interpolate({ inputRange: [0, 1], outputRange: [32, 22] }) // the left ring's centre: from 7px right of its resting place to 3px left of it (the right ring mirrors it)
  const bx = t.interpolate({ inputRange: [0, 1], outputRange: [32, 42] })
  const ch = t.interpolate({ inputRange: [0, 1], outputRange: [11, 20] })
  const cy = t.interpolate({ inputRange: [0, 1], outputRange: [26.5, 22] })
  return (
    <View style={[{ width: px, height: px, alignItems: "center", justifyContent: "center" }, style]} accessibilityRole="progressbar">
      <Svg width={px} height={px} viewBox="0 0 64 64">
        <AnimatedCircle cx={ax} cy={32} r={14} fill="none" stroke="#34d399" strokeWidth={6} />
        <AnimatedCircle cx={bx} cy={32} r={14} fill="none" stroke="#60a5fa" strokeWidth={6} />
        <AnimatedRect x={29} y={cy} width={6} height={ch} rx={2.4} fill={color} />
      </Svg>
    </View>
  )
}
export { Spinner as ActivityIndicator }

/** The start screen: the big animated rings and the wordmark on the same dark as the splash, shown while the app signs you in (the web's LogoLoader). */
export function LogoLoader({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0b0e14", alignItems: "center", justifyContent: "center", gap: 22 }} accessibilityRole="progressbar">
      <Spinner size={88} />
      <BrandWord size={26} color="#e6edf3" />
      {label ? <Text style={{ color: "#8b98a9", fontSize: 12, letterSpacing: 0.6 }}>{label}</Text> : null}
    </View>
  )
}
