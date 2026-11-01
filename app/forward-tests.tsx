import { useRouter } from "expo-router"
import { Pressable, Text, View } from "react-native"
import { api } from "../src/api"
import { ago } from "../src/format"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Card, Empty, ErrorNote, Loading, Muted, Row, Screen, tone } from "../src/ui"

export default function ForwardTests() {
  const router = useRouter()
  const tests = useLoad(() => api.forwardTests(), { every: 120_000 })
  const list = tests.data ?? []
  return (
    <Screen padTop={false} refreshing={tests.refreshing} onRefresh={tests.refresh}>
      {tests.error ? <ErrorNote>{tests.error}</ErrorNote> : null}
      {!tests.loaded ? <Loading /> : list.length === 0 ? <Empty title="No forward tests" text="Freeze a strategy on the website and judge it on the market that comes next." /> : list.map((f) => (
        <Pressable key={f.id} onPress={() => router.push(`/forward/${f.id}`)}>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{f.name.split(" · ")[0]}</Text>
                <Muted style={{ marginTop: 3 }}>{f.symbol} · {f.timeframe} · {f.status === "active" ? "running" : "stopped"}{f.evaluated_at ? ` · checked ${ago(f.evaluated_at)}` : ""}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: tone(f.stats?.totalR), fontSize: 16, fontWeight: "800" }}>{f.stats ? `${f.stats.totalR >= 0 ? "+" : ""}${f.stats.totalR.toFixed(2)}R` : "-"}</Text>
                <Muted>{f.stats?.n ?? 0}{f.max_trades ? `/${f.max_trades}` : ""} trades</Muted>
              </View>
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  )
}
