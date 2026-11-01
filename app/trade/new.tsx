import { useRouter } from "expo-router"
import { useState } from "react"
import { View } from "react-native"
import { api, type NewTrade } from "../../src/api"
import { isOfflineError, enqueue } from "../../src/outbox"
import { showToast } from "../../src/toast"
import { splitLabels } from "../../src/journal"
import { Button, ErrorNote, Field, Label, Pill, Row, Screen } from "../../src/ui"

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

  return (
    <Screen padTop={false}>
      {error ? <View style={{ marginBottom: 12 }}><ErrorNote>{error}</ErrorNote></View> : null}
      <Field label="Symbol" value={f.symbol} onChangeText={set("symbol")} autoCapitalize="characters" autoCorrect={false} placeholder="AAPL, NQ1!, BTCUSDT" />
      <Label>Side</Label>
      <Row style={{ marginBottom: 12 }}>{(["Long", "Short"] as const).map((x) => <Pill key={x} active={side === x} onPress={() => setSide(x)} color={x === "Long" ? undefined : "#f4566e"}>{x}</Pill>)}</Row>
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Entry" value={f.entry} onChangeText={set("entry")} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Exit" value={f.exit} onChangeText={set("exit")} keyboardType="decimal-pad" /></View>
      </Row>
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Quantity" value={f.qty} onChangeText={set("qty")} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Risked (1R, money)" value={f.risk} onChangeText={set("risk")} keyboardType="decimal-pad" /></View>
      </Row>
      <Field label="Setup" value={f.setup} onChangeText={set("setup")} maxLength={64} placeholder="Breakout, pullback..." />
      <Label>Rating</Label>
      <Row style={{ marginBottom: 12 }}>{[1, 2, 3, 4, 5].map((n) => <Pill key={n} active={rating === n} onPress={() => setRating(n)}>{String(n)}</Pill>)}</Row>
      <Label>Followed your plan?</Label>
      <Row style={{ marginBottom: 12 }}>{([["Yes", true], ["No", false], ["Not sure", null]] as const).map(([l, v]) => <Pill key={l} active={plan === v} onPress={() => setPlan(v)}>{l}</Pill>)}</Row>
      <Field label="Emotions (comma separated)" value={f.emotions} onChangeText={set("emotions")} placeholder="calm, fomo" />
      <Field label="Tags (comma separated)" value={f.tags} onChangeText={set("tags")} placeholder="news, london" />
      <Field label="Note" value={f.note} onChangeText={set("note")} multiline maxLength={500} placeholder="What happened and what you learned" />
      <Button onPress={save} busy={busy}>Save trade</Button>
    </Screen>
  )
}
