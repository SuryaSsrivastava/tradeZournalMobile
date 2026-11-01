import { Ionicons } from "@expo/vector-icons"
import { useMemo, useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { api, type MarketQuote } from "../src/api"
import { CheckMark, success } from "../src/delight"
import { ago, price } from "../src/format"
import { Press, Rise, tick } from "../src/fx"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Field, Label, Loading, Muted, Pill, Row, Screen } from "../src/ui"

const guess = (q: MarketQuote | undefined) => (q?.price != null ? String(q.price) : "")

export default function PriceAlerts() {
  const quotes = useLoad(() => api.quotes(), { every: 20_000 })
  const alerts = useLoad(() => api.priceAlerts(), { every: 30_000 })
  const [find, setFind] = useState("")
  const [symbol, setSymbol] = useState<string | null>(null)
  const [dir, setDir] = useState<"above" | "below">("above")
  const [level, setLevel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  const all = quotes.data?.symbols ?? []
  const chosen = all.find((q) => q.symbol === symbol)
  const matches = useMemo(() => {
    const f = find.trim().toLowerCase()
    return (f ? all.filter((q) => q.symbol.toLowerCase().includes(f) || q.name.toLowerCase().includes(f)) : all).slice(0, 12)
  }, [all, find])

  const items = alerts.data?.items ?? []
  const waiting = items.filter((a) => !a.triggered_at)
  const fired = items.filter((a) => a.triggered_at)
  const full = waiting.length >= (alerts.data?.max_open ?? 20)

  const pick = (q: MarketQuote) => { tick(); setSymbol(q.symbol); setLevel(guess(q)) }
  const add = async () => {
    const n = Number(level.replace(",", "."))
    if (!symbol) return setError("Choose a market first.")
    if (!Number.isFinite(n) || n <= 0) return setError("Enter the price to be told at.")
    setBusy(true); setError(null)
    try {
      await api.addPriceAlert({ symbol, direction: dir, price: n })
      setSymbol(null); setLevel(""); setFind("")
      await alerts.refresh()
      success(); setAdded(true); setTimeout(() => setAdded(false), 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the alert.")
    } finally {
      setBusy(false)
    }
  }
  const remove = (id: number, name: string) => Alert.alert("Remove this alert?", name, [
    { text: "Keep", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { try { await api.removePriceAlert(id); await alerts.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Could not remove it.") } } },
  ])

  return (
    <Screen padTop={false} refreshing={alerts.refreshing} onRefresh={() => { void alerts.refresh(); void quotes.refresh() }}>
      <Rise>
        <Card>
          <Label>New price alert</Label>
          <Muted style={{ marginBottom: 10 }}>We tell you the moment a market reaches your price, even when the app is closed.</Muted>
          <Field label="Find a market" value={find} onChangeText={setFind} placeholder="Gold, EURUSD, Bitcoin..." autoCapitalize="none" autoCorrect={false} />
          {!quotes.loaded ? <Loading /> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
              {matches.map((q) => <Pill key={q.symbol} active={q.symbol === symbol} onPress={() => pick(q)}>{q.symbol}</Pill>)}
              {matches.length === 0 ? <Muted>No market matches that.</Muted> : null}
            </View>
          )}
          {chosen ? (
            <View style={{ marginTop: 6 }}>
              <Row style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{chosen.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>now {price(chosen.price)}</Text>
              </Row>
              <Row style={{ gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1 }}><Button tone={dir === "above" ? "primary" : "ghost"} onPress={() => setDir("above")}>Goes above</Button></View>
                <View style={{ flex: 1 }}><Button tone={dir === "below" ? "primary" : "ghost"} onPress={() => setDir("below")}>Drops below</Button></View>
              </Row>
              <Field label="Price" value={level} onChangeText={setLevel} keyboardType="decimal-pad" />
            </View>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          {added ? <Row style={{ gap: 8, marginBottom: 10 }}><CheckMark size={20} /><Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>Alert added. We will tell you when it hits.</Text></Row> : null}
          <Button onPress={add} busy={busy} disabled={!symbol || full}>{full ? "20 alerts waiting: remove one" : "Add alert"}</Button>
        </Card>
      </Rise>

      <Card delay={80}>
        <Label>Waiting ({waiting.length})</Label>
        {!alerts.loaded ? <Loading /> : waiting.length === 0 ? <Empty title="No alerts yet" text="Add one above and we will tell you when it hits." /> : waiting.map((a, i) => (
          <Row key={a.id} style={{ justifyContent: "space-between", paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
            <Row style={{ flex: 1 }}>
              <Ionicons name={a.direction === "above" ? "trending-up" : "trending-down"} size={20} color={a.direction === "above" ? colors.green : colors.red} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{a.symbol} {a.direction === "above" ? "≥" : "≤"} {price(a.price)}</Text>
                <Muted>{a.name} · set {ago(a.created_at)}</Muted>
              </View>
            </Row>
            <Pressable onPress={() => remove(a.id, `${a.symbol} ${a.direction} ${price(a.price)}`)} hitSlop={10}><Ionicons name="close-circle-outline" size={22} color={colors.muted} /></Pressable>
          </Row>
        ))}
      </Card>

      {fired.length ? (
        <Card delay={140}>
          <Label>Reached</Label>
          {fired.slice(0, 10).map((a, i) => (
            <Row key={a.id} style={{ justifyContent: "space-between", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{a.symbol} {a.direction === "above" ? "went above" : "dropped below"} {price(a.price)}</Text>
                <Muted>{a.triggered_at ? ago(a.triggered_at) : ""}{a.triggered_price != null ? ` · at ${price(a.triggered_price)}` : ""}</Muted>
              </View>
              <Press onPress={() => remove(a.id, "Remove from the list")}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Press>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  )
}
