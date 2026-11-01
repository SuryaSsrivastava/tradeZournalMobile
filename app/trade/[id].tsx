import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Alert, Text, View } from "react-native"
import { api } from "../../src/api"
import { enqueue, isOfflineError } from "../../src/outbox"
import { showToast } from "../../src/toast"
import { Stat } from "../../src/fx"
import { fullTime, money, price } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { pnlOf, rOf, splitLabels } from "../../src/journal"
import { ShareSheet, type CardData } from "../../src/sharecard"
import { TradeShots } from "../../src/shots"
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../src/ui"

export default function TradeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const all = useLoad(() => api.journalTrades(1000), { cache: "trades1000", deps: [id] })
  const t = all.data?.find((x) => x.id === Number(id)) ?? null
  const [note, setNote] = useState("")
  const [setup, setSetup] = useState("")
  const [emotions, setEmotions] = useState("")
  const [tags, setTags] = useState("")
  const [rating, setRating] = useState(3)
  const [plan, setPlan] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<"save" | "delete" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<CardData | null>(null)

  useEffect(() => {
    if (!t) return
    setNote(t.note); setSetup(t.setup); setEmotions(t.emotions.join(", ")); setTags(t.tags.join(", ")); setRating(t.rating); setPlan(t.followed_plan)
  }, [t?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy("save"); setError(null)
    try {
      const edit = { note: note.trim(), setup: setup.trim(), emotions: splitLabels(emotions), tags: splitLabels(tags), rating, followed_plan: plan }
      try {
        await api.editJournalTrade(Number(id), edit)
      } catch (e) {
        if (!isOfflineError(e)) throw e
        await enqueue({ type: "editTrade", id: Number(id), body: edit })
        showToast("Saved on this phone. It uploads when you are back online.")
      }
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(null)
    }
  }

  const remove = () => Alert.alert("Delete this trade?", "It is removed from your journal on the website too.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      setBusy("delete")
      try { await api.deleteJournalTrade(Number(id)); router.back() } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); setBusy(null) }
    } },
  ])

  if (!all.loaded) return <Screen padTop={false}><Loading /></Screen>
  if (!t) return <Screen padTop={false}>{all.error ? <ErrorNote>{all.error}</ErrorNote> : <Muted>This trade is no longer in your journal.</Muted>}</Screen>
  const p = pnlOf(t)
  const openCard = () => setCard({
    kicker: "Trade", title: `${t.side} ${t.symbol}`, sub: fullTime(t.opened_at), money: money(p, "USD", true), alt: `${rOf(t) >= 0 ? "+" : ""}${rOf(t).toFixed(2)}R`, sign: p,
    stats: [{ label: "Entry", value: price(t.entry), altValue: price(t.entry) }, { label: "Exit", value: price(t.exit), altValue: price(t.exit) }, ...(t.setup ? [{ label: "Setup", value: t.setup, altValue: t.setup }] : []), { label: "Risked", value: money(t.risk) }],
  })
  return (
    <Screen padTop={false}>
      <ShareSheet data={card} onClose={() => setCard(null)} />
      <Title sub={`${fullTime(t.opened_at)}${t.source !== "manual" ? ` · ${t.broker || t.source}` : ""}`}>{t.side} {t.symbol}</Title>
      <Card>
        <Text style={{ color: tone(p), fontSize: 30, fontWeight: "800" }}>{money(p, "USD", true)}</Text>
        <Muted>{rOf(t) >= 0 ? "+" : ""}{rOf(t).toFixed(2)}R</Muted>
        <View style={{ marginTop: 12 }}><Button tone="ghost" onPress={openCard}>Share this trade</Button></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <Stat label="Entry">{price(t.entry)}</Stat>
          <Stat label="Exit">{price(t.exit)}</Stat>
          <Stat label="Quantity">{String(t.qty)}</Stat>
          <Stat label="Risked">{money(t.risk)}</Stat>
          {t.stop != null ? <Stat label="Stop">{price(t.stop)}</Stat> : null}
          {t.target != null ? <Stat label="Target">{price(t.target)}</Stat> : null}
        </View>
      </Card>

      <TradeShots tradeId={t.id} />

      <View style={{ marginTop: 16 }}>
        {error ? <View style={{ marginBottom: 12 }}><ErrorNote>{error}</ErrorNote></View> : null}
        <Field label="Setup" value={setup} onChangeText={setSetup} maxLength={64} />
        <Label>Rating</Label>
        <Row style={{ marginBottom: 12 }}>{[1, 2, 3, 4, 5].map((n) => <Pill key={n} active={rating === n} onPress={() => setRating(n)}>{String(n)}</Pill>)}</Row>
        <Label>Followed your plan?</Label>
        <Row style={{ marginBottom: 12 }}>{([["Yes", true], ["No", false], ["Not sure", null]] as const).map(([l, v]) => <Pill key={l} active={plan === v} onPress={() => setPlan(v)}>{l}</Pill>)}</Row>
        <Field label="Emotions (comma separated)" value={emotions} onChangeText={setEmotions} />
        <Field label="Tags (comma separated)" value={tags} onChangeText={setTags} />
        <Field label="Note" value={note} onChangeText={setNote} multiline maxLength={500} />
        <Button onPress={save} busy={busy === "save"} disabled={busy === "delete"}>Save changes</Button>
        <View style={{ marginTop: 10 }}><Button tone="danger" onPress={remove} busy={busy === "delete"} disabled={busy === "save"}>Delete trade</Button></View>
      </View>
    </Screen>
  )
}
