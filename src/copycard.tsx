import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Text, View } from "react-native"
import { api } from "./api"
import { Press } from "./fx"
import { useLoad } from "./hooks"
import { colors } from "./theme"
import { Card, Muted, Row } from "./ui"

/** Admins only: where the copy engine stands, on the home screen. Tap for the full screen. */
export function CopyCard() {
  const router = useRouter()
  const ov = useLoad(() => api.copyOverview(), { every: 15_000 })
  const d = ov.data
  if (!d) return null
  const eng = d.engine
  const on = d.links.filter((l) => l.enabled)
  const copies = d.links.reduce((n, l) => n + (l.engine?.copies ?? 0), 0)
  const down = !eng.reachable || eng.halted
  const color = down ? colors.red : on.length ? colors.green : colors.muted
  const text = !eng.reachable ? "Engine not reachable" : eng.halted ? "Copying paused by TradeZournal" : on.length ? "Copy trading running" : "No links switched on"
  return (
    <Press onPress={() => router.push("/copy")}>
      <Card style={down ? { borderColor: `${colors.red}88` } : undefined}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row style={{ flex: 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}><Ionicons name="copy-outline" size={18} color={color} /></View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{text}</Text>
              <Muted>{d.links.length ? `${on.length} of ${d.links.length} links on · ${copies} cop${copies === 1 ? "y" : "ies"} open` : "Tap to add your first link"}</Muted>
            </View>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Row>
      </Card>
    </Press>
  )
}
