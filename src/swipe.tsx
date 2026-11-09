import { Ionicons } from "@expo/vector-icons"
import { useRef, type ComponentProps, type ReactNode } from "react"
import { Animated, PanResponder, Text, View } from "react-native"
import { tick } from "./fx"
import { colors, radius } from "./theme"

type IconName = ComponentProps<typeof Ionicons>["name"]
export type SwipeAction = { label: string; icon: IconName; color: string; run: () => void }

const REACH = 84  // how far a swipe has to go to count

/**
 * A row that slides sideways to show an action behind it: right reveals `right`, left reveals `left`. Past REACH the phone ticks, and letting go runs the action; the row then springs back
 * (an action that removes the row does that on its own when the list refreshes). Vertical drags are left to the list, so scrolling still works.
 */
export function SwipeRow({ children, left, right }: { children: ReactNode; left?: SwipeAction; right?: SwipeAction }) {
  const x = useRef(new Animated.Value(0)).current
  const armed = useRef(false)
  const props = useRef({ left, right })
  props.current = { left, right }

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const { left: l, right: r } = props.current
      const dx = g.dx > 0 ? (r ? Math.min(g.dx, REACH * 1.6) : 0) : (l ? Math.max(g.dx, -REACH * 1.6) : 0)
      x.setValue(dx)
      const now = Math.abs(dx) >= REACH
      if (now !== armed.current) { armed.current = now; if (now) tick() }
    },
    onPanResponderRelease: (_, g) => {
      const { left: l, right: r } = props.current
      const hit = armed.current ? (g.dx > 0 ? r : l) : undefined
      armed.current = false
      Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start()
      hit?.run()
    },
    onPanResponderTerminate: () => { armed.current = false; Animated.spring(x, { toValue: 0, useNativeDriver: true }).start() },
  })).current

  const panel = (a: SwipeAction, side: "left" | "right") => (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, [side === "right" ? "left" : "right"]: 0, width: REACH + 40, borderRadius: radius.md, backgroundColor: `${a.color}22`, borderWidth: 1, borderColor: `${a.color}55`, alignItems: side === "right" ? "flex-start" : "flex-end", justifyContent: "center", paddingHorizontal: 18,
      opacity: x.interpolate({ inputRange: side === "right" ? [0, 24] : [-24, 0], outputRange: side === "right" ? [0, 1] : [1, 0], extrapolate: "clamp" }) }}>
      <View style={{ alignItems: "center" }}>
        <Ionicons name={a.icon} size={20} color={a.color} />
        <Text style={{ color: a.color, fontSize: 11, fontWeight: "800", marginTop: 2 }}>{a.label}</Text>
      </View>
    </Animated.View>
  )

  return (
    <View>
      {right ? panel(right, "right") : null}
      {left ? panel(left, "left") : null}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  )
}
