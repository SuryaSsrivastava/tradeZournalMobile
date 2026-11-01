import { Flash } from "./delight"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { api, type Account, type LivePosition } from "./api"
import { useAuth } from "./auth"
import { CountUp, Pulse } from "./fx"
import { money, price } from "./format"
import { useLoad } from "./hooks"
import { CloseX, LiveLine, RangeBar, useProfitHistory } from "./livechart"
import { clearLiveNotificationHidden, startLiveNotification } from "./liveservice"
import { colors } from "./theme"
import { Card, Muted, Row, tone } from "./ui"

/** The accounts whose open trades can be watched live. */
export const watchable = (accounts: Account[]) => accounts.filter((a) => (a.kind === "metaapi" || a.kind === "webhook") && a.status !== "paused")

/** Open trades of every connected account, one card each. Nothing shows for an account with nothing open (or one that cannot be watched). */
export function LiveTrades({ accounts }: { accounts: Account[] }) {
  return <>{watchable(accounts).map((a) => <AccountLive key={a.id} account={a} />)}</>
}

function AccountLive({ account }: { account: Account }) {
  const router = useRouter()
  const { user } = useAuth()
  const live = useLoad(() => api.accountLive(account.id), { every: 8000, deps: [account.id] })
  const [closing, setClosing] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])  // closed a moment ago: hidden until the next look agrees
  const [note, setNote] = useState<string | null>(null)
  const v = live.data
  const open = (v?.positions ?? []).filter((p) => !gone.includes(p.id))
  const canClose = !!user?.is_admin && account.kind === "metaapi" && !account.is_prop  // the server's own rule for trading live
  const history = useProfitHistory(open, v?.at)
  const running = v?.state === "live" && open.length > 0
  useEffect(() => { if (running) void startLiveNotification(account.id, canClose) }, [running, account.id, canClose])  // a trade is open: keep it in the notification bar too (if the member turned that on)
  const none = v?.state === "live" && open.length === 0
  useEffect(() => { if (none) void clearLiveNotificationHidden() }, [none])  // nothing open: if they had hidden the notification, the next trade shows it again
  if (!running) return null
  const floating = open.reduce((sum, p) => sum + p.profit, 0)

  const close = (p: LivePosition) => Alert.alert(`Close this ${p.symbol} ${p.side.toLowerCase()} now?`, `${p.volume ?? ""} lots are closed at the current market price.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Close position", style: "destructive", onPress: async () => {
      setNote(null); setClosing(p.id)
      try { await api.closePosition(account.id, p.id); setGone((g) => [...g, p.id]); void live.refresh() } catch (e) { setNote(`${p.symbol}: ${e instanceof Error ? e.message : "could not close it"}`) }
      setClosing(null)
    } },
  ])

  return (
    <Card>
      <Pressable onPress={() => router.push("/positions")}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row><Pulse size={6} /><Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", marginLeft: 4 }}>Live trades</Text><Muted style={{ marginLeft: 8 }}>{account.name}</Muted></Row>
          <Flash value={floating}><Text style={{ color: tone(floating), fontSize: 15, fontWeight: "800" }}>{money(floating, v.currency, true)}</Text></Flash>
        </Row>
      </Pressable>
      {open.map((p, i) => {
        const long = p.side === "Long"
        return (
          <View key={p.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: i === 0 ? "transparent" : `${colors.border}99`, marginTop: i === 0 ? 4 : 0 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{p.symbol}</Text>
                <View style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: `${long ? colors.green : colors.red}22` }}>
                  <Text style={{ color: long ? colors.green : colors.red, fontSize: 10.5, fontWeight: "800" }}>{p.side.toUpperCase()}{p.volume ? ` ${p.volume}` : ""}</Text>
                </View>
              </Row>
              <Row style={{ gap: 10 }}>
                <Flash value={p.profit}><CountUp value={p.profit} format={(n) => money(n, v.currency, true)} ms={600} style={{ color: tone(p.profit), fontSize: 16, fontWeight: "800" }} /></Flash>
                {canClose ? <CloseX onPress={() => close(p)} busy={closing === p.id} disabled={closing !== null} /> : null}
              </Row>
            </Row>
            <View style={{ marginTop: 6 }}><LiveLine points={history[p.id] ?? [p.profit]} /></View>
            <RangeBar stop={p.stop} target={p.target} open={p.open_price} now={p.price} />
            <Muted style={{ marginTop: 6 }}>{price(p.open_price)} → {price(p.price)}</Muted>
          </View>
        )
      })}
      {note ? <Text style={{ color: colors.red, fontSize: 12, marginTop: 6 }}>{note}</Text> : null}
    </Card>
  )
}
