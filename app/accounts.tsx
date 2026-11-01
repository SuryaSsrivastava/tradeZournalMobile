import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Text, View } from "react-native"
import { api, type Account } from "../src/api"
import { money } from "../src/format"
import { Press, Pulse, Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Loading, Muted, Row, Screen } from "../src/ui"

const STATUS: Record<Account["status"], { text: string; color: string }> = {
  active: { text: "Active", color: colors.green }, connecting: { text: "Connecting", color: colors.amber }, error: { text: "Needs attention", color: colors.red }, paused: { text: "Paused", color: colors.muted },
}

/** Every trading account, with a way to add one and to open any for editing, pausing or removing. */
export default function Accounts() {
  const router = useRouter()
  const accounts = useLoad(() => api.accounts(), { every: 60_000, cache: "accounts" })
  const trades = useLoad(() => api.journalTrades(1000))
  const list = accounts.data?.accounts ?? []
  const count = (id: number) => (trades.data ?? []).filter((t) => t.account_id === id).length

  return (
    <Screen padTop={false} refreshing={accounts.refreshing} onRefresh={() => { void accounts.refresh(); void trades.refresh() }}>
      <Rise><View style={{ marginBottom: 14 }}><Button onPress={() => router.push("/add-account")}>+  Add an account</Button></View></Rise>
      {accounts.error ? <ErrorNote>{accounts.error}</ErrorNote> : null}
      {!accounts.loaded ? <Loading /> : list.length === 0 ? <Empty title="No accounts yet" text="Add a manual journal account, or connect a MetaTrader account to bring your trades in automatically." /> : list.map((a, i) => {
        const st = STATUS[a.status] ?? STATUS.active
        return (
          <Rise key={a.id} delay={Math.min(i, 8) * 55}>
            <Press onPress={() => router.push(`/account/${a.id}`)}>
              <Card>
                <Row style={{ justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Row>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 }}>{a.name}</Text>
                      {a.is_prop ? <View style={{ marginLeft: 8, backgroundColor: "#a78bfa22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}><Text style={{ color: "#c4b5fd", fontSize: 9.5, fontWeight: "800" }}>PROP</Text></View> : null}
                    </Row>
                    <Muted style={{ marginTop: 3 }}>{a.kind === "manual" ? "Manual journal" : "MetaTrader"}{a.hint ? ` · ${a.hint}` : ""} · {count(a.id)} trade{count(a.id) === 1 ? "" : "s"}</Muted>
                    {a.starting_balance ? <Muted>Started with {money(a.starting_balance, a.currency || "USD")}</Muted> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Row style={{ gap: 5 }}>{a.status === "active" && a.kind !== "manual" ? <Pulse size={4} /> : null}<Text style={{ color: st.color, fontSize: 12, fontWeight: "800" }}>{a.kind === "manual" && a.status === "active" ? "Journal" : st.text}</Text></Row>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginTop: 6 }} />
                  </View>
                </Row>
                {a.status === "error" && a.last_error ? <Text style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>{a.last_error}</Text> : null}
              </Card>
            </Press>
          </Rise>
        )
      })}
    </Screen>
  )
}
