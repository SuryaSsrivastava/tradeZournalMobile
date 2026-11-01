import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "./theme"

/** A short message at the bottom of the screen that slides up and goes away by itself. `showToast` can be called from anywhere. */
type Toast = { id: number; text: string; ok: boolean }
let push: (t: Toast) => void = () => {}
let n = 0
export const showToast = (text: string, ok = true) => push({ id: ++n, text, ok })

export function Toaster() {
  const insets = useSafeAreaInsets()
  const [t, setT] = useState<Toast | null>(null)
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => { push = setT; return () => { push = () => {} } }, [])
  useEffect(() => {
    if (!t) return
    v.setValue(0)
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    const h = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setT(null)), 3200)
    return () => clearTimeout(h)
  }, [t, v])
  if (!t) return null
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 78, alignItems: "center", zIndex: 90 }}>
      <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }], backgroundColor: colors.cardHi, borderRadius: 999, borderWidth: 1, borderColor: t.ok ? `${colors.green}88` : `${colors.red}88`, paddingVertical: 11, paddingHorizontal: 18, maxWidth: "88%" }}>
        <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: "700", textAlign: "center" }}>{t.text}</Text>
      </Animated.View>
    </View>
  )
}
