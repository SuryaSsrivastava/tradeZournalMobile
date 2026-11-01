import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Alert, Pressable, Text, View } from "react-native"
import { api, type Notice } from "../src/api"
import { ago } from "../src/format"
import { useLoad } from "../src/hooks"
import { routeFor } from "../src/push"
import { colors } from "../src/theme"
import { Rise } from "../src/fx"
import { Card, Empty, ErrorNote, Loading, Muted, Row, Screen, Title } from "../src/ui"

const KIND: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  forward: { icon: "pulse", color: colors.green },
  news: { icon: "calendar", color: colors.amber },
  rule: { icon: "warning", color: colors.red },
  test: { icon: "notifications", color: colors.blue },
}

export default function Alerts() {
  const router = useRouter()
  const n = useLoad(() => api.notices(50), { every: 30_000, cache: "notices50" })
  const items = n.data?.items ?? []

  const open = async (x: Notice) => {
    if (!x.read) { try { await api.readNotice(x.id) } catch { /* shown as read next refresh anyway */ } void n.reload() }
    router.push(routeFor(x.link) as never)
  }
  const readAll = async () => { try { await api.readAll(); await n.reload() } catch { /* try again */ } }
  const clear = () => Alert.alert("Clear all alerts?", "This removes them from the app and the website.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: async () => { try { await api.clearNotices(); await n.reload() } catch { /* try again */ } } },
  ])

  return (
    <Screen refreshing={n.refreshing} onRefresh={n.refresh} padTop={false}>
      <Title sub={n.data ? (n.data.unread > 0 ? `${n.data.unread} unread` : "All caught up") : undefined}>Alerts</Title>
      {n.error ? <ErrorNote>{n.error}</ErrorNote> : null}
      {items.length > 0 ? (
        <Row style={{ marginBottom: 12 }}>
          <Pressable onPress={readAll} hitSlop={8}><Text style={{ color: colors.green, fontWeight: "600", fontSize: 13 }}>Mark all read</Text></Pressable>
          <Pressable onPress={clear} hitSlop={8} style={{ marginLeft: 18 }}><Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>Clear</Text></Pressable>
        </Row>
      ) : null}
      {!n.loaded ? <Loading /> : items.length === 0 ? <Empty title="No alerts yet" text="Trades your forward tests open, upcoming economic releases and rule warnings show up here, and on your lock screen." /> : items.map((x, idx) => {
        const k = KIND[x.kind] ?? { icon: "notifications" as const, color: colors.muted }
        return (
          <Rise key={x.id} delay={Math.min(idx, 8) * 55}><Pressable onPress={() => open(x)}>
            <Card style={{ opacity: x.read ? 0.7 : 1, borderColor: x.read ? colors.border : `${k.color}66` }}>
              <Row style={{ alignItems: "flex-start" }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${k.color}22`, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name={k.icon} size={17} color={k.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: x.read ? "500" : "700", flex: 1, paddingRight: 8 }}>{x.title}</Text>
                    {!x.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} /> : null}
                  </Row>
                  {x.body ? <Muted style={{ marginTop: 3, fontSize: 13 }}>{x.body}</Muted> : null}
                  <Muted style={{ marginTop: 6, fontSize: 11 }}>{ago(x.created_at)}</Muted>
                </View>
              </Row>
            </Card>
          </Pressable></Rise>
        )
      })}
    </Screen>
  )
}
