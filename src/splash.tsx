import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Image, StyleSheet, useWindowDimensions } from "react-native"
import { useReducedMotion } from "./fx"
import { colors } from "./theme"

/**
 * What follows the phone's own splash screen: the same mark in the same place, which gives a small pop while a ring of green light spreads from it, then it all fades into the app.
 * It covers the app only for about a second, never takes a touch, and plays once per start.
 */
export function AnimatedSplash() {
  const reduced = useReducedMotion()
  const { width } = useWindowDimensions()
  const [gone, setGone] = useState(false)
  const pop = useRef(new Animated.Value(0)).current
  const ring = useRef(new Animated.Value(0)).current
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const out = Animated.timing(fade, { toValue: 0, duration: 380, delay: reduced ? 250 : 900, easing: Easing.out(Easing.quad), useNativeDriver: true })
    if (reduced) { out.start(() => setGone(true)); return }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 320, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
      ]),
      Animated.timing(ring, { toValue: 1, duration: 850, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      out,
    ]).start(() => setGone(true))
  }, [reduced, pop, ring, fade])
  if (gone) return null
  const size = width * 0.47  // the phone's splash shows its mark at this size
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0b0e14", alignItems: "center", justifyContent: "center", opacity: fade, zIndex: 200 }]}>
      <Animated.View style={{ position: "absolute", width: size, height: size, borderRadius: size * 0.2, borderWidth: 2, borderColor: colors.green, opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.6] }) }] }} />
      <Animated.Image source={require("../assets/logo-mark.png")} style={{ width: size, height: size, borderRadius: size * 0.2, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }} />
    </Animated.View>
  )
}
