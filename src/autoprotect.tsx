import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { ActivityIndicator, Switch, Text, TextInput, View } from "react-native"
import { api, type Account, type AutoProtect } from "./api"
import { colors, currentScheme, radius } from "./theme"
import { Card, Muted, Pill, Row } from "./ui"

/**
 * The automatic break-even of a MetaTrader account (admins only, like every order the app sends): switch it on and, once a trade is up the profit you chose (in R, the profit as a multiple of the risk to
 * its stop, or in money), the server moves the stop to the entry, plus an optional offset to cover costs. While it is on the account's connection is kept open (one login, no polling), and it only ever tightens a stop.
 */
export function AutoBreakeven({ account, onChanged }: { account: Account; onChanged?: () => void }) {
  const saved = account.auto_protect
  const [unit, setUnit] = useState<AutoProtect["unit"]>(saved?.unit ?? "r")
  const [value, setValue] = useState(String(saved?.value ?? 1))
  const [offset, setOffset] = useState(String(saved?.offset ?? 0))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const on = !!saved?.on
  const v = Number(value), o = Number(offset)
  const valid = value.trim() !== "" && v > 0 && (unit !== "r" || v <= 100) && offset.trim() !== "" && o >= 0
  const light = currentScheme() === "light"
  const okText = light ? "#0a7d4d" : colors.green
  const badText = light ? "#c8304a" : colors.red
  const save = async (next: boolean) => {
    if (busy || (next && !valid)) return
    setBusy(true); setMsg(null)
    try {
      await api.setAutoProtect(account.id, { on: next, unit, value: v, offset: o })
      setMsg({ ok: true, text: next ? `On: ${unit === "r" ? `${v} R` : `${v} in profit`} moves the stop to the entry. The connection stays open.` : "Off." })
      onChanged?.()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save that." })
    }
    setBusy(false)
  }
  const input = { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 15, minWidth: 70, textAlign: "center" as const }
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Row style={{ gap: 8, flex: 1 }}>
          <Ionicons name="shield-checkmark-outline" size={18} color={okText} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Automatic break-even</Text>
        </Row>
        {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Switch value={on} disabled={!on && !valid} onValueChange={(n) => void save(n)} trackColor={{ true: okText, false: colors.border }} accessibilityLabel="Automatic break-even" />}
      </Row>
      <Muted style={{ marginTop: 8 }}>When a trade is up</Muted>
      <Row style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" accessibilityLabel="Profit that moves the stop" style={input} />
        <Pill active={unit === "r"} onPress={() => setUnit("r")}>R</Pill>
        <Pill active={unit === "money"} onPress={() => setUnit("money")}>Money</Pill>
      </Row>
      <Muted style={{ marginTop: 10 }}>move the stop to the entry, plus (in price)</Muted>
      <Row style={{ gap: 8, marginTop: 6 }}>
        <TextInput value={offset} onChangeText={setOffset} keyboardType="decimal-pad" accessibilityLabel="Offset past the entry, in price" style={input} />
        {on ? <Pill onPress={() => void save(true)}>Update</Pill> : null}
      </Row>
      <Muted style={{ marginTop: 10 }}>{unit === "r" ? "1 R is the distance from the entry to the stop, so a trade needs a stop to be measured. " : ""}It only ever moves a stop closer, never touches a copy a link opened, and keeps this account&apos;s connection open while it is on.</Muted>
      {msg ? <Text style={{ color: msg.ok ? okText : badText, fontSize: 12.5, marginTop: 6 }}>{msg.text}</Text> : null}
    </Card>
  )
}
