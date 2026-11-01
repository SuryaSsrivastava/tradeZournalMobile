import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { Alert, Text, View } from "react-native"
import { api, type ForwardTrade } from "../../src/api"
import { ago, price } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { colors } from "../../src/theme"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Row, Screen, Title, tone } from "../../src/ui"

export default function ForwardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const f = useLoad(() => api.forwardTest(Number(id)), { every: 60_000, deps: [id] })
  const d = f.data
  const router = useRouter()
  const [busy, setBusy] = useState<"status" | "delete" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = d?.status === "active"

  const toggle = async () => {
    setBusy("status"); setError(null)
    try { await api.setForwardStatus(Number(id), running ? "stopped" : "active"); await f.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Could not change that.") } finally { setBusy(null) }
  }
  const remove = () => Alert.alert("Delete this forward test?", "Its trades and results are removed for good, on the website too. Pause it instead if you may want it back.", [
    { text: "Keep it", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      setBusy("delete"); setError(null)
      try { await api.deleteForward(Number(id)); router.back() } catch (e) { setError(e instanceof Error ? e.message : "Could not delete it."); setBusy(null) }
    } },
  ])
  const stats = d?.result?.stats ?? d?.stats ?? null
  const open = d?.result?.open ?? []
  const closed = [...(d?.result?.closed ?? [])].reverse().slice(0, 15)

  return (
    <Screen refreshing={f.refreshing} onRefresh={f.refresh} padTop={false}>
      {f.error ? <ErrorNote>{f.error}</ErrorNote> : null}
      {!f.loaded ? <Loading /> : d ? (
        <>
          <Title sub={`${d.symbol} · ${d.timeframe} · ${d.status === "active" ? "running" : "stopped"}`}>{d.name.split(" · ")[0]}</Title>
          {stats ? (
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Stat label="Trades" value={`${stats.n}${d.max_trades ? `/${d.max_trades}` : ""}`} />
                <Stat label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} />
                <Stat label="Total" value={`${stats.totalR >= 0 ? "+" : ""}${stats.totalR.toFixed(2)}R`} color={tone(stats.totalR)} />
                <Stat label="Per trade" value={`${stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(2)}R`} color={tone(stats.expectancy)} />
              </Row>
            </Card>
          ) : null}
          <Label>Open now</Label>
          {open.length === 0 ? <Muted style={{ marginBottom: 12 }}>No open trade.</Muted> : open.map((t) => <Trade key={t.entry_at + t.side} t={t} />)}
          <Label>Recent closed trades</Label>
          {closed.length === 0 ? <Empty title="No closed trades yet" /> : closed.map((t) => <Trade key={t.entry_at + t.side} t={t} />)}

          <View style={{ marginTop: 18, gap: 10 }}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button tone={running ? "ghost" : "primary"} onPress={toggle} busy={busy === "status"} disabled={busy !== null}>{running ? "Pause this test" : "Resume this test"}</Button>
            <Muted style={{ textAlign: "center" }}>{running ? "A paused test stops looking for new trades. Its results are kept." : "A resumed test starts looking for new trades again."}</Muted>
            <Button tone="danger" onPress={remove} busy={busy === "delete"} disabled={busy !== null}>Delete this test</Button>
          </View>
        </>
      ) : null}
    </Screen>
  )
}

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View><Label>{label}</Label><Text style={{ color: color ?? colors.text, fontSize: 17, fontWeight: "800" }}>{value}</Text></View>
)

function Trade({ t }: { t: ForwardTrade }) {
  const long = t.side === "long"
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Row>
          <Text style={{ color: long ? colors.green : colors.red, fontWeight: "800", fontSize: 13 }}>{t.side.toUpperCase()}</Text>
          <Text style={{ color: colors.text, marginLeft: 8, fontSize: 14, fontWeight: "600" }}>{price(t.entry)}</Text>
        </Row>
        {t.r_multiple != null ? <Text style={{ color: tone(t.r_multiple), fontWeight: "800" }}>{`${t.r_multiple >= 0 ? "+" : ""}${t.r_multiple.toFixed(2)}R`}</Text> : <Text style={{ color: colors.blue, fontWeight: "700" }}>open</Text>}
      </Row>
      <Muted style={{ marginTop: 6 }}>Stop {price(t.stop)} · Target {price(t.target)}{t.exit ? ` · Exit ${price(t.exit)}` : ""}{t.exit_reason ? ` (${t.exit_reason})` : ""}</Muted>
      <Muted style={{ marginTop: 2 }}>Opened {ago(t.entry_at)}</Muted>
    </Card>
  )
}
