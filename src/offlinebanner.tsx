import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef } from "react"
import { Animated, Easing, Text } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useOffline } from "./net"
import { useOutboxCount } from "./outbox"
import { colors } from "./theme"

/** A slim bar under the status bar while there is no connection: what is shown is the last saved copy, and how many changes are waiting to upload. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets()
  const off = useOffline()
  const waiting = useOutboxCount()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => { Animated.timing(v, { toValue: off ? 1 : 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }, [off, v])
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 80, paddingTop: insets.top + 4, paddingBottom: 6, backgroundColor: `${colors.amber}ee`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] }}>
      <Ionicons name="cloud-offline" size={15} color="#1a1203" />
      <Text style={{ color: "#1a1203", fontSize: 12.5, fontWeight: "800" }}>Offline · showing saved data{waiting ? ` · ${waiting} change${waiting === 1 ? "" : "s"} waiting` : ""}</Text>
    </Animated.View>
  )
}
