import { useRouter } from "expo-router"
import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { Pressable, Text, View } from "react-native"
import { api, type NewTrade } from "../../src/api"
import { isOfflineError, enqueue } from "../../src/outbox"
import { showToast } from "../../src/toast"
import { splitLabels } from "../../src/journal"
import { Heading } from "../../src/fx"
import { colors, radius } from "../../src/theme"
import { Button, Card, ErrorNote, Field, Label, Row, Screen } from "../../src/ui"

export default function NewTrade() {
  const router = useRouter()
  const [f, setF] = useState({ symbol: "", entry: "", exit: "", qty: "", risk: "", setup: "", note: "", emotions: "", tags: "" })
  const [side, setSide] = useState<"Long" | "Short">("Long")
  const [rating, setRating] = useState(3)
  const [plan, setPlan] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const num = (v: string) => Number(v.replace(",", "."))

  const save = async () => {
    const entry = num(f.entry), exit = num(f.exit), qty = num(f.qty), risk = num(f.risk)
    if (!f.symbol.trim()) return setError("Enter the symbol.")
    if (![entry, exit, qty, risk].every((n) => n > 0)) return setError("Entry, exit, quantity and risk must each be a number above zero.")
    setBusy(true); setError(null)
    try {
      const trade: NewTrade = { symbol: f.symbol, side, entry, exit, qty, risk, setup: f.setup.trim(), rating, note: f.note.trim(), emotions: splitLabels(f.emotions), tags: splitLabels(f.tags), followed_plan: plan }
      try {
        await api.addJournalTrade(trade)
      } catch (e) {
        if (!isOfflineError(e)) throw e
        await enqueue({ type: "addTrade", body: trade })  // no connection: kept on the phone and uploaded later
        showToast("Saved on this phone. It uploads when you are back online.")
      }
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the trade.")
    } finally {
      setBusy(false)
    }
  }

  const feel = ["calm", "confident", "fomo", "anxious", "revenge"]
  const felt = splitLabels(f.emotions)
  const toggleFeel = (e: string) => set("emotions")((felt.includes(e) ? felt.filter((x) => x !== e) : [...felt, e]).join(", "))

  return (
    <Screen padTop={false}>
      {error ? <View style={{ marginBottom: 12 }}><ErrorNote>{error}</ErrorNote></View> : null}

      <Card>
        <Heading icon="swap-vertical" color="#60a5fa">The trade</Heading>
        <Field label="Symbol" value={f.symbol} onChangeText={set("symbol")} autoCapitalize="characters" autoCorrect={false} placeholder="AAPL, NQ1!, BTCUSDT" />
        <Label>Side</Label>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          {(["Long", "Short"] as const).map((x) => {
            const on = side === x, c = x === "Long" ? colors.green : colors.red
            return (
              <Pressable key={x} onPress={() => setSide(x)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? c : colors.border, backgroundColor: on ? `${c}1f` : colors.card }}>
                <Ionicons name={x === "Long" ? "trending-up" : "trending-down"} size={18} color={on ? c : colors.muted} />
                <Text style={{ color: on ? colors.text : colors.muted, fontSize: 14, fontWeight: "700" }}>{x}</Text>
              </Pressable>
            )
          })}
        </View>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Entry" value={f.entry} onChangeText={set("entry")} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Exit" value={f.exit} onChangeText={set("exit")} keyboardType="decimal-pad" /></View>
        </Row>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Quantity" value={f.qty} onChangeText={set("qty")} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Risked (1R, money)" value={f.risk} onChangeText={set("risk")} keyboardType="decimal-pad" /></View>
        </Row>
      </Card>

      <Card>
        <Heading icon="clipboard" color="#a78bfa">The review</Heading>
        <Field label="Setup" value={f.setup} onChangeText={set("setup")} maxLength={64} placeholder="Breakout, pullback..." />
        <Label>Rating</Label>
        <Row style={{ marginBottom: 14, gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}><Ionicons name={n <= rating ? "star" : "star-outline"} size={30} color={n <= rating ? "#fbbf24" : colors.muted} /></Pressable>
          ))}
        </Row>
        <Label>Followed your plan?</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([["Yes", true, "checkmark-circle", colors.green], ["No", false, "close-circle", colors.red], ["Not sure", null, "help-circle", colors.muted]] as const).map(([l, v, icon, c]) => {
            const on = plan === v
            return (
              <Pressable key={l} onPress={() => setPlan(v)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: on ? c : colors.border, backgroundColor: on ? `${c}1f` : colors.card }}>
                <Ionicons name={icon} size={16} color={on ? c : colors.muted} />
                <Text style={{ color: on ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "600" }}>{l}</Text>
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Card>
        <Heading icon="heart" color="#f4566e">How it felt</Heading>
        <Row style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {feel.map((e) => {
            const on = felt.includes(e)
            return (
              <Pressable key={e} onPress={() => toggleFeel(e)} style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colors.green : colors.border, backgroundColor: on ? `${colors.green}22` : "transparent" }}>
                <Text style={{ color: on ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "600" }}>{e}</Text>
              </Pressable>
            )
          })}
        </Row>
        <Field label="Emotions (comma separated)" value={f.emotions} onChangeText={set("emotions")} placeholder="calm, fomo" />
        <Field label="Tags (comma separated)" value={f.tags} onChangeText={set("tags")} placeholder="news, london" />
        <Field label="Note" value={f.note} onChangeText={set("note")} multiline maxLength={500} placeholder="What happened and what you learned" />
      </Card>

      <Button onPress={save} busy={busy}>Save trade</Button>
      <View style={{ height: 6 }} />
    </Screen>
  )
}
