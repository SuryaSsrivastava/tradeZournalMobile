import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Alert, Switch, Text, View } from "react-native"
import { api, type PropRules } from "../../src/api"
import { CheckMark, success } from "../../src/delight"
import { Rise } from "../../src/fx"
import { useLoad } from "../../src/hooks"
import { useScope } from "../../src/scope"
import { colors } from "../../src/theme"
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Row, Screen } from "../../src/ui"

const num = (s: string) => { const n = Number(s.trim().replace(",", ".")); return s.trim() !== "" && Number.isFinite(n) ? n : undefined }
const str = (n?: number | null) => (n == null ? "" : String(n))

/** Edit one account: name, starting balance, prop-firm limits; pause or resume it; remove it. */
export default function EditAccount() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { filter, setFilter } = useScope()
  const accounts = useLoad(() => api.accounts(), { deps: [id] })
  const trades = useLoad(() => api.journalTrades(1000), { deps: [id] })
  const a = accounts.data?.accounts.find((x) => x.id === Number(id)) ?? null
  const mine = (trades.data ?? []).filter((t) => t.account_id === Number(id)).length

  const [name, setName] = useState("")
  const [balance, setBalance] = useState("")
  const [prop, setProp] = useState(false)
  const [daily, setDaily] = useState("")
  const [dd, setDd] = useState("")
  const [trailing, setTrailing] = useState(false)
  const [target, setTarget] = useState("")
  const [days, setDays] = useState("")
  const [busy, setBusy] = useState<"save" | "pause" | "delete" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!a) return
    const r: PropRules = a.rules ?? {}
    setName(a.name); setBalance(str(a.starting_balance)); setProp(a.is_prop)
    setDaily(str(r.daily_loss_pct)); setDd(str(r.max_dd_pct)); setTrailing(!!r.trailing); setTarget(str(r.target_pct)); setDays(r.min_days ? String(r.min_days) : "")
  }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const bal = num(balance)
    if (!name.trim()) return setError("The account needs a name.")
    if (!bal || bal <= 0) return setError("Enter the starting balance.")
    setBusy("save"); setError(null); setSaved(false)
    try {
      await api.updateTradingAccount(Number(id), { name: name.trim(), starting_balance: bal, is_prop: prop, rules: prop ? { daily_loss_pct: num(daily), max_dd_pct: num(dd), trailing, target_pct: num(target), min_days: num(days) } : {} })
      success(); setSaved(true); setTimeout(() => setSaved(false), 2500)
      await accounts.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setBusy(null)
    }
  }

  const pause = async () => {
    if (!a) return
    setBusy("pause"); setError(null)
    try { await api.updateTradingAccount(Number(id), { paused: a.status !== "paused" }); await accounts.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Could not change that.") } finally { setBusy(null) }
  }

  const gone = async (deleteTrades: boolean) => {
    setBusy("delete"); setError(null)
    try { await api.removeTradingAccount(Number(id), deleteTrades); setFilter(filter.filter((x) => x !== String(id))); router.back() } catch (e) { setError(e instanceof Error ? e.message : "Could not remove it."); setBusy(null) }
  }
  const remove = () => {
    if (!a) return
    if (a.kind === "manual") {
      Alert.alert(`Remove "${a.name}"?`, mine ? `It has ${mine} trade${mine === 1 ? "" : "s"}. You can keep them in your journal without an account, or delete them with it.` : "It has no trades.", [
        { text: "Cancel", style: "cancel" },
        ...(mine ? [{ text: "Keep the trades", onPress: () => void gone(false) }] : []),
        { text: mine ? "Delete the trades too" : "Remove", style: "destructive" as const, onPress: () => void gone(true) },
      ])
    } else {
      Alert.alert(`Disconnect "${a.name}"?`, `This removes the connection and its ${mine} trade${mine === 1 ? "" : "s"} from your journal. Connecting it again brings them back from MetaTrader. The place on your plan is freed.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => void gone(true) },
      ])
    }
  }

  if (!accounts.loaded) return <Screen padTop={false}><Loading /></Screen>
  if (!a) return <Screen padTop={false}>{accounts.error ? <ErrorNote>{accounts.error}</ErrorNote> : <Muted>This account no longer exists.</Muted>}</Screen>
  const paused = a.status === "paused"
  return (
    <Screen padTop={false}>
      <Rise>
        <Card>
          <Label>{a.kind === "manual" ? "Manual journal account" : "MetaTrader account"}</Label>
          {a.kind !== "manual" ? <Muted style={{ marginBottom: 6 }}>{[a.hint ? `Account ${a.hint}` : "", a.server ?? "", a.status === "active" ? "connected" : a.status].filter(Boolean).join(" · ")}{a.last_sync_at ? ` · synced ${new Date(a.last_sync_at).toLocaleString()}` : ""}</Muted> : <Muted style={{ marginBottom: 6 }}>{mine} trade{mine === 1 ? "" : "s"} in this account.</Muted>}
          {a.status === "error" && a.last_error ? <ErrorNote>{a.last_error}</ErrorNote> : null}
          <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
          <Field label="Starting balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        </Card>
      </Rise>

      <Rise delay={70}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Prop firm account</Text>
              <Muted style={{ marginTop: 3 }}>Track the firm's daily loss, drawdown and profit target.</Muted>
            </View>
            <Switch value={prop} onValueChange={setProp} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
          </Row>
          {prop ? (
            <View style={{ marginTop: 14 }}>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Daily loss limit %" value={daily} onChangeText={setDaily} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Max drawdown %" value={dd} onChangeText={setDd} keyboardType="decimal-pad" /></View>
              </Row>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Profit target %" value={target} onChangeText={setTarget} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Min trading days" value={days} onChangeText={setDays} keyboardType="number-pad" /></View>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Trailing drawdown</Text>
                <Switch value={trailing} onValueChange={setTrailing} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
              </Row>
            </View>
          ) : null}
        </Card>
      </Rise>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {saved ? <Row style={{ gap: 8, marginBottom: 10 }}><CheckMark size={20} /><Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>Saved.</Text></Row> : null}
      <Button onPress={save} busy={busy === "save"} disabled={busy !== null}>Save changes</Button>

      <View style={{ marginTop: 22, gap: 10 }}>
        <Button tone="ghost" onPress={pause} busy={busy === "pause"} disabled={busy !== null}>{paused ? "Resume this account" : "Pause this account"}</Button>
        <Muted style={{ textAlign: "center" }}>{paused ? "Paused: no new trades are brought in." : a.kind === "manual" ? "Pausing stops nothing here, but hides it from syncing and live views." : "A paused account stops syncing and frees its MetaTrader connection. Your trades stay."}</Muted>
        <Button tone="danger" onPress={remove} busy={busy === "delete"} disabled={busy !== null}>{a.kind === "manual" ? "Remove this account" : "Disconnect this account"}</Button>
      </View>
    </Screen>
  )
}
