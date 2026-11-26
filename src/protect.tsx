import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { api, type LivePosition } from "./api"
import { colors } from "./theme"
import { Muted, Row } from "./ui"

const inProfit = (p: LivePosition) => p.open_price != null && p.price != null && (p.side === "Long" ? p.price > p.open_price : p.price < p.open_price)

/**
 * Protect an open trade: move its stop to break-even, or keep a share of the profit made so far. It only ever tightens the stop. On the master account of a copy link the followers copy the new stop within
 * moments. For admins, like every order the app sends (the server refuses anyone else).
 */
export function ProtectStop({ accountId, p, onMoved }: { accountId: number; p: LivePosition; onMoved?: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const profit = inProfit(p)
  const go = async (body: Parameters<typeof api.moveStop>[2], label: string) => {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await api.moveStop(accountId, p.id, body)
      setMsg({ ok: true, text: `${label}: stop now ${r.stop}${r.previous ? ` (was ${r.previous})` : ""}.${r.followers > 0 ? ` ${r.followers} copy link${r.followers === 1 ? "" : "s"} will follow.` : ""}` })
      onMoved?.()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not move the stop" })
    }
    setBusy(false)
  }
  const chip = (label: string, onPress: () => void, color = colors.text) => (
    <Pressable key={label} onPress={onPress} disabled={busy || !profit} hitSlop={6} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, opacity: busy || !profit ? 0.4 : 1 }}>
      <Text style={{ color, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={() => setOpen(!open)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Protect this trade" style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Protect this trade</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          {!profit ? <Muted>Not in profit yet: there is nothing to lock in.</Muted> : null}
          <Row style={{ flexWrap: "wrap", gap: 8 }}>
            {chip("Break-even", () => void go({ mode: "breakeven" }, "Break-even"), colors.green)}
            {[25, 50, 75].map((n) => chip(`Lock ${n}%`, () => void go({ mode: "lock_pct", pct: n }, `Locked ${n}% of the profit`)))}
            {busy ? <ActivityIndicator size="small" color={colors.muted} /> : null}
          </Row>
          <Muted>Locking 50% on a trade up 10 points moves the stop to 5 points in profit. The stop only ever moves closer.</Muted>
          {msg ? <Text style={{ color: msg.ok ? colors.green : colors.red, fontSize: 12.5 }}>{msg.text}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}
