import { useRouter } from "expo-router"
import { Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import type { Account } from "./api"
import { Press } from "./fx"
import { colors } from "./theme"
import { Card, Label } from "./ui"

type Prop = NonNullable<Account["prop"]>
const STATE_COLOR = { ok: colors.green, warn: colors.amber, breached: colors.red } as const

const short = (n: number, currency?: string | null) => {
  const sym = !currency || currency === "USD" ? "$" : currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : ""
  const a = Math.abs(n)
  const body = a >= 100_000 ? `${Math.round(a / 1000)}k` : a >= 10_000 ? `${(a / 1000).toFixed(1)}k` : Math.round(a).toLocaleString()
  return `${n < 0 ? "-" : ""}${sym}${body}`
}

/** One ring: `frac` of it is filled, with a value in the middle and what it is under it. */
function Ring({ frac, color, value, label, size = 76 }: { frac: number; color: string; value: string; label: string; size?: number }) {
  const stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <View style={{ alignItems: "center", width: size + 14 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${colors.muted}22`} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={[c * Math.max(0.001, Math.min(1, frac)), c]} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", letterSpacing: -0.3 }}>{value}</Text>
      </View>
      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700", marginTop: 5, textAlign: "center" }}>{label}</Text>
    </View>
  )
}

/** A prop-firm account at a glance: how much of the daily loss and the drawdown is left, how far the profit target is, and the trading days so far. The server works these out. */
export function PropCard({ account, delay }: { account: Account; delay?: number }) {
  const router = useRouter()
  const p: Prop | null = account.prop
  if (!p) return null
  const rings: { key: string; frac: number; color: string; value: string; label: string }[] = []
  for (const m of p.meters ?? []) {
    const left = Math.max(0, m.left)
    rings.push({ key: m.key, frac: m.limit > 0 ? left / m.limit : 0, color: STATE_COLOR[m.state] ?? colors.green, value: short(left, account.currency), label: `${m.key === "daily" ? "Daily loss" : "Drawdown"} left` })
  }
  if (p.target) rings.push({ key: "target", frac: p.target.progress, color: p.target.hit ? colors.blue : colors.green, value: p.target.hit ? "Hit" : `${Math.round(p.target.progress * 100)}%`, label: p.target.hit ? "Target reached" : `To target (${short(p.target.amount, account.currency)})` })
  if ((p.min_days ?? 0) > 0) rings.push({ key: "days", frac: Math.min(1, (p.trading_days ?? 0) / (p.min_days ?? 1)), color: (p.trading_days ?? 0) >= (p.min_days ?? 1) ? colors.blue : colors.green, value: `${p.trading_days ?? 0}/${p.min_days}`, label: "Trading days" })
  if (rings.length === 0) return null
  const state = p.state ?? "ok"
  const word = state === "breached" ? "Limit reached" : state === "warn" ? "Close to a limit" : "On track"
  return (
    <Card delay={delay}>
      <Press onPress={() => router.push(`/account/${account.id}`)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Label>Prop firm</Label>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 2 }}>{account.name}</Text>
          </View>
          <Text style={{ color: STATE_COLOR[state], fontSize: 12, fontWeight: "800" }}>{word}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 12, marginTop: 14 }}>
          {rings.map((r) => <Ring key={r.key} frac={r.frac} color={r.color} value={r.value} label={r.label} />)}
        </View>
        {p.basis ? <Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 12, textAlign: "center" }}>{p.basis}</Text> : null}
      </Press>
    </Card>
  )
}
