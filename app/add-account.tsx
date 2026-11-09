import { useRouter } from "expo-router"
import { useState } from "react"
import { Switch, Text, View } from "react-native"
import { api, type NewAccount, type PropRules } from "../src/api"
import { CheckMark, Pop, success } from "../src/delight"
import { Rise } from "../src/fx"
import { useScope } from "../src/scope"
import { PlanNote } from "../src/upgrade"
import { colors } from "../src/theme"
import { Button, Card, ErrorNote, Field, Label, Muted, Pill, Row, Screen } from "../src/ui"

const num = (s: string) => { const n = Number(s.trim().replace(",", ".")); return s.trim() !== "" && Number.isFinite(n) ? n : undefined }

/** Add a trading account: a manual journal account (free, no connection) or a MetaTrader account that connects with a read-only investor password. */
export default function AddAccount() {
  const router = useRouter()
  const { setMode, setFilter } = useScope()
  const [kind, setKind] = useState<"manual" | "metaapi">("manual")
  const [name, setName] = useState("")
  const [balance, setBalance] = useState("10000")
  const [platform, setPlatform] = useState<"mt5" | "mt4">("mt5")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [server, setServer] = useState("")
  const [prop, setProp] = useState(false)
  const [daily, setDaily] = useState("")
  const [dd, setDd] = useState("")
  const [trailing, setTrailing] = useState(false)
  const [target, setTarget] = useState("")
  const [days, setDays] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ text: string } | null>(null)

  const submit = async () => {
    const bal = num(balance)
    if (!name.trim()) return setError("Give the account a name.")
    if (!bal || bal <= 0) return setError("Enter the starting balance.")
    if (kind === "metaapi" && !(login.trim() && password && server.trim())) return setError("MetaTrader needs the account number, the investor password and the server name.")
    const rules: PropRules = prop ? { daily_loss_pct: num(daily), max_dd_pct: num(dd), trailing, target_pct: num(target), min_days: num(days) } : {}
    const body: NewAccount = { name: name.trim(), kind, starting_balance: bal, is_prop: prop, rules, ...(kind === "metaapi" ? { broker: "mt5", login: login.trim(), mt_password: password, server: server.trim(), platform } : {}) }
    setBusy(true); setError(null)
    try {
      const a = await api.addAccount(body)
      success()
      if (kind === "manual") { setMode("manual"); setFilter([String(a.id)]) }  // show the new account straight away
      setDone({ text: kind === "manual" ? "Account added. Log your trades into it from Home." : "Connecting. Your trades start arriving in a few minutes." })
      setTimeout(() => router.back(), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the account.")
      setBusy(false)
    }
  }

  if (done) return (
    <Screen padTop={false}>
      <View style={{ alignItems: "center", paddingVertical: 60 }}>
        <Pop><CheckMark size={72} /></Pop>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 18 }}>{name.trim()}</Text>
        <Muted style={{ marginTop: 6, textAlign: "center" }}>{done.text}</Muted>
      </View>
    </Screen>
  )

  return (
    <Screen padTop={false}>
      <Rise>
        <Card>
          <Label>Type of account</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Pill active={kind === "manual"} onPress={() => setKind("manual")}>Manual journal</Pill>
            <Pill active={kind === "metaapi"} onPress={() => setKind("metaapi")} color={colors.blue}>MetaTrader (automatic)</Pill>
          </View>
          <Muted>{kind === "manual" ? "No connection. You log your trades by hand or import a file. Free, and you can still track a prop firm's limits." : "Connects to your MetaTrader 4 or 5 account with its read-only investor password. Your trades arrive on their own. Counts against your plan's connected accounts."}</Muted>
        </Card>
      </Rise>

      <Rise delay={70}>
        <Card>
          <Field label="Account name" value={name} onChangeText={setName} maxLength={60} placeholder={kind === "manual" ? "e.g. FTMO challenge" : "e.g. Exness live"} />
          <Field label="Starting balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
          {kind === "metaapi" ? (
            <>
              <Label>Platform</Label>
              <View style={{ flexDirection: "row", marginBottom: 6 }}>
                <Pill active={platform === "mt5"} onPress={() => setPlatform("mt5")}>MetaTrader 5</Pill>
                <Pill active={platform === "mt4"} onPress={() => setPlatform("mt4")}>MetaTrader 4</Pill>
              </View>
              <Field label="Account number" value={login} onChangeText={(v) => setLogin(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={12} />
              <Field label="Investor password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              <Muted style={{ marginTop: -6, marginBottom: 12 }}>The investor password is read-only: it cannot place or close trades. It is sent once to connect and is not stored.</Muted>
              <Field label="Server" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} placeholder="Exness-MT5Real8" />
            </>
          ) : null}
        </Card>
      </Rise>

      <Rise delay={140}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>This is a prop firm account</Text>
              <Muted style={{ marginTop: 3 }}>Track the firm's daily loss, drawdown and profit target.</Muted>
            </View>
            <Switch value={prop} onValueChange={setProp} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
          </Row>
          {prop ? (
            <View style={{ marginTop: 14 }}>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Daily loss limit %" value={daily} onChangeText={setDaily} keyboardType="decimal-pad" placeholder="5" /></View>
                <View style={{ flex: 1 }}><Field label="Max drawdown %" value={dd} onChangeText={setDd} keyboardType="decimal-pad" placeholder="10" /></View>
              </Row>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Profit target %" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="10" /></View>
                <View style={{ flex: 1 }}><Field label="Min trading days" value={days} onChangeText={setDays} keyboardType="number-pad" placeholder="4" /></View>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Trailing drawdown</Text>
                <Switch value={trailing} onValueChange={setTrailing} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
              </Row>
              <Muted style={{ marginTop: 6 }}>Limits are percentages of the starting balance. Leave a box empty if the firm has no such rule.</Muted>
            </View>
          ) : null}
        </Card>
      </Rise>

      {error ? <PlanNote message={error} /> : null}
      <Button onPress={submit} busy={busy}>{kind === "manual" ? "Add account" : "Connect account"}</Button>
    </Screen>
  )
}
