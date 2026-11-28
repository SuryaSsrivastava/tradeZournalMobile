import { LinearGradient } from "expo-linear-gradient"
import type { Tabs } from "expo-router"
import { useEffect, useRef, useState, type ComponentProps } from "react"
import { Animated, Platform, Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { tick } from "./fx"
import { colors } from "./theme"

// each tab has its own colour, like the coloured icons in the web's side menu
const ACCENT: Record<string, string> = { index: "#60a5fa", journal: "#22d38a", markets: "#fb923c", chart: "#a78bfa", more: "#f472b6" }
const accentOf = (name?: string) => ACCENT[name ?? ""] ?? colors.green

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

/** The bottom bar: a pill of light slides under the open tab, the icon springs up, and every tap ticks. */
export function TabBar({ state, descriptors, navigateToTab }: BarProps) {
  const insets = useSafeAreaInsets()
  const [w, setW] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  // routes with href: null are reachable (links, pushes, buttons) but have no place in the bar
  const shown = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null)
  const n = shown.length
  const slot = w / n
  const now = accentOf(state.routes[state.index]?.name)
  const at = shown.findIndex((r) => r.key === state.routes[state.index].key)  // -1 while a hidden screen is open

  useEffect(() => {
    if (!w || at < 0) return
    Animated.spring(x, { toValue: at * slot, useNativeDriver: true, speed: 14, bounciness: 9 }).start()
  }, [at, slot, w, x])

  return (
    <View style={{ backgroundColor: `${colors.bg}f2`, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0) }}>
      <LinearGradient colors={[`${colors.green}55`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1 }} />
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", paddingTop: 6 }}>
        {w > 0 && at >= 0 ? (
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 6, left: 0, width: slot, height: 50, alignItems: "center", transform: [{ translateX: x }] }}>
            <View style={{ width: slot - 18, height: 48, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: `${now}55` }}>
              <LinearGradient colors={[`${now}33`, `${now}0a`]} style={{ flex: 1 }} />
            </View>
          </Animated.View>
        ) : null}
        {shown.map((route) => {
          const { options } = descriptors[route.key]
          const focused = state.routes[state.index].key === route.key
          const color = focused ? accentOf(route.name) : colors.muted
          const badge = options.tabBarBadge
          return (
            <Tab key={route.key} focused={focused} onPress={() => {
              tick()
              navigateToTab(route.key)
            }}>
              <View>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {badge ? <View style={{ position: "absolute", top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}><Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "800" }}>{badge}</Text></View> : null}
              </View>
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? "800" : "600", marginTop: 3 }}>{String(options.title ?? route.name)}</Text>
            </Tab>
          )
        })}
      </View>
    </View>
  )
}

function Tab({ focused, onPress, children }: { focused: boolean; onPress: () => void; children: React.ReactNode }) {
  const lift = useRef(new Animated.Value(focused ? 1 : 0)).current
  useEffect(() => { Animated.spring(lift, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 14 }).start() }, [focused, lift])
  return (
    <Pressable onPress={onPress} style={{ flex: 1, height: 50, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ alignItems: "center", transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>
    </Pressable>
  )
}
