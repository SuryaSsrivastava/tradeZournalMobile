import { useEffect, useState } from "react"
import { Alert, Text, View } from "react-native"
import { api, type Account, type LivePosition } from "../src/api"
import { useAuth } from "../src/auth"
import { CloseX, LiveLine, RangeBar, useProfitHistory } from "../src/livechart"
import { startLiveNotification } from "../src/liveservice"
import { CountUp } from "../src/fx"
import { ago, money, price } from "../src/format"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { PlanNote } from "../src/upgrade"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../src/ui"

/** Live open positions of a connected MetaTrader account, refreshed every few seconds while this screen is open. Admins can close a trade here, as on the website (the server refuses anyone else). */
export default function Positions() {
  const accounts = useLoad(() => api.accounts())
  const usable: Account[] = (accounts.data?.accounts ?? []).filter((a) => a.kind === "metaapi" || a.kind === "webhook")
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => { if (picked === null && usable.length > 0) setPicked(usable[0].id) }, [usable, picked])
  const id = picked
  const live = useLoad(() => (id === null ? Promise.resolve(null) : api.accountLive(id)), { every: 5000, deps: [id] })
  const v = live.data
  const { user } = useAuth()
  const acct = usable.find((a) => a.id === id)
  const canClose = !!user?.is_admin && acct?.kind === "metaapi" && !acct.is_prop  // the server's own rule for trading live
  const [closing, setClosing] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])  // closed a moment ago: hidden until the next look agrees
  const [note, setNote] = useState<string | null>(null)
  const open = (v?.positions ?? []).filter((p) => !gone.includes(p.id))
  const history = useProfitHistory(open, v?.at)
  useEffect(() => { if (id !== null && v?.state === "live" && open.length > 0) void startLiveNotification(id, canClose) }, [id, v?.state, open.length > 0, canClose])  // eslint-disable-line react-hooks/exhaustive-deps

  const close = (items: LivePosition[], title: string, text: string) => Alert.alert(title, text, [
    { text: "Cancel", style: "cancel" },
    { text: items.length > 1 ? "Close them" : "Close position", style: "destructive", onPress: async () => {
      if (id === null) return
      setNote(null)
      const failed: string[] = []
      for (const p of items) {
        setClosing(p.id)
        try { await api.closePosition(id, p.id); setGone((g) => [...g, p.id]) } catch (e) { failed.push(`${p.symbol}: ${e instanceof Error ? e.message : "could not close it"}`) }
      }
      setClosing(null)
      if (failed.length) setNote(failed.join(" · "))
      void live.refresh()
    } },
  ])

  return (
    <Screen refreshing={live.refreshing} onRefresh={live.refresh} padTop={false}>
      <Title sub="Updates every few seconds while you are on this screen">Live trades</Title>
      {accounts.error ? <ErrorNote>{accounts.error}</ErrorNote> : null}
      {usable.length > 1 ? (
        <Row style={{ flexWrap: "wrap" }}>{usable.map((a) => <Pill key={a.id} active={a.id === picked} onPress={() => setPicked(a.id)}>{a.name}</Pill>)}</Row>
      ) : null}

      {!accounts.loaded ? <Loading /> : usable.length === 0 ? <Empty title="No MetaTrader account" text="Connect one on the website to watch your open positions here." /> : (
        <>
          {live.error ? <PlanNote message={live.error} /> : null}
          {!live.loaded ? <Loading /> : v ? (
            <>
              {v.state === "starting" ? <Card><Muted>Connecting to your broker. The first look can take up to a minute.</Muted></Card> : null}
              {v.state === "error" || v.state === "unsupported" || v.state === "ended" ? <ErrorNote>{v.message || "The live view is not available for this account right now."}</ErrorNote> : null}
              {v.state === "live" ? (
                <>
                  <Card>
                    <Row style={{ justifyContent: "space-between" }}>
                      <View><Label>Equity</Label><Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{money(v.equity, v.currency)}</Text></View>
                      <View style={{ alignItems: "flex-end" }}><Label>Floating</Label><Text style={{ color: tone(v.floating), fontSize: 22, fontWeight: "800" }}>{money(v.floating, v.currency, true)}</Text></View>
                    </Row>
                    <Muted style={{ marginTop: 6 }}>Balance {money(v.balance, v.currency)}{v.at ? ` · updated ${ago(v.at)}` : ""}</Muted>
                  </Card>
                  {note ? <ErrorNote>{note}</ErrorNote> : null}
                  {open.length === 0 ? <Empty title="No open positions" text="Nothing is open on this account right now." /> : (
                    <>
                      {open.map((p) => <PositionCard key={p.id} p={p} history={history[p.id] ?? [p.profit]} currency={v.currency} busy={closing === p.id} onClose={canClose ? () => close([p], `Close this ${p.symbol} ${p.side.toLowerCase()} now?`, `${p.volume ?? ""} lots are closed at the current market price.`) : undefined} />)}
                      {canClose && open.length > 1 ? <Button tone="danger" disabled={closing !== null} onPress={() => close(open, "Close all open trades?", `${open.length} trades will be closed at the current market price.`)}>Close all ({open.length})</Button> : null}
                    </>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <Muted style={{ marginTop: 6, textAlign: "center" }}>Watching a live view keeps your broker connection open. It closes by itself soon after you leave.</Muted>
    </Screen>
  )
}

function PositionCard({ p, history, currency, onClose, busy }: { p: LivePosition; history: number[]; currency?: string; onClose?: () => void; busy?: boolean }) {
  const long = p.side === "Long"
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Row>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{p.symbol}</Text>
          <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: `${long ? colors.green : colors.red}22` }}>
            <Text style={{ color: long ? colors.green : colors.red, fontSize: 11, fontWeight: "800" }}>{p.side.toUpperCase()}{p.volume ? ` ${p.volume}` : ""}</Text>
          </View>
        </Row>
        <Row style={{ gap: 10 }}>
          <CountUp value={p.profit} format={(n) => money(n, currency, true)} ms={600} style={{ color: tone(p.profit), fontSize: 18, fontWeight: "800" }} />
          {onClose ? <CloseX onPress={onClose} busy={busy} /> : null}
        </Row>
      </Row>
      <View style={{ marginTop: 8 }}><LiveLine points={history} height={64} /></View>
      <RangeBar stop={p.stop} target={p.target} open={p.open_price} now={p.price} />
      <Row style={{ justifyContent: "space-between", marginTop: 10 }}>
        <Cell label="Open" value={price(p.open_price)} />
        <Cell label="Now" value={price(p.price)} />
        <Cell label="Stop" value={p.stop ? price(p.stop) : "-"} />
        <Cell label="Target" value={p.target ? price(p.target) : "-"} />
      </Row>
      {p.opened_at ? <Muted style={{ marginTop: 8 }}>Opened {ago(p.opened_at)}</Muted> : null}
    </Card>
  )
}

const Cell = ({ label, value }: { label: string; value: string }) => (
  <View><Label>{label}</Label><Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{value}</Text></View>
)
