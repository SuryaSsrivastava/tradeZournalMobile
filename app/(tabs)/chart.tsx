import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Alert, Pressable, ScrollView, Text, View } from "react-native"
import { api, type Account, type LivePosition } from "../../src/api"
import { useAuth } from "../../src/auth"
import { CandleChart, HOME, type ChartLine, type View2 } from "../../src/candlechart"
import { FAST, TIMEFRAMES, useCandles, type Frame } from "../../src/candles"
import { success } from "../../src/delight"
import { money, price } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { watchable } from "../../src/live"
import { colors } from "../../src/theme"
import { Button, Card, ErrorNote, Field, Muted, Pill, Row, Screen } from "../../src/ui"
import { usePrivacy } from "../../src/privacy"

const AMBER = "#f5b53d"
const canon = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")
const round = (p: number, ref: number) => Number(p.toFixed(ref >= 1000 ? 2 : ref >= 10 ? 3 : 5))

/** A market's chart: candles that move with the live price, your price alerts and your open trades drawn on it. A tap places an alert; the ✕ on a line removes the alert or closes the trade. */
export default function Chart() {
  usePrivacy()
  const { symbol: want } = useLocalSearchParams<{ symbol?: string }>()
  const { user } = useAuth()
  const [symbol, setSymbol] = useState((want ?? "XAUUSD").toUpperCase())
  useEffect(() => { if (want) { setSymbol(want.toUpperCase()); setDraft(null) } }, [want])  // opened from Price alerts for another market (the tab stays mounted)
  const [frame, setFrame] = useState<Frame>("15m")
  const [view, setView] = useState<View2>({ count: 80, off: HOME })
  const [panel, setPanel] = useState(false)
  const [pick, setPick] = useState(false)
  const [find, setFind] = useState("")
  const [draft, setDraft] = useState<number | null>(null)
  const [moving, setMoving] = useState<{ id: number; price: number } | null>(null)  // a saved alert being dragged to another price
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const feed = useCandles(symbol, frame)
  const quotes = useLoad(() => api.quotes())
  const alerts = useLoad(() => api.priceAlerts(), { every: 20_000 })
  const plan = useLoad(() => api.planUsage())
  const fastOk = !!user?.is_admin || !!plan.data?.limits?.fast_timeframes  // 1m and 5m are a switch of the plan (the server refuses them otherwise)
  const accounts = useLoad(() => api.accounts())
  const open: Account[] = watchable(accounts.data?.accounts ?? [])
  const live = useLoad(() => Promise.all(open.map((a) => api.accountLive(a.id).then((v) => ({ a, v })).catch(() => null))), { every: 5000, deps: [open.map((a) => a.id).join(",")] })

  const all = feed.candles
  const last = all.length ? all[all.length - 1].close : null
  const ref = useMemo(() => { if (!all.length) return null; const cut = all[all.length - 1].time - 86400; let i = all.length - 1; while (i > 0 && all[i].time > cut) i--; return all[i].close }, [all])  // the move over the last day
  const change = last !== null && ref ? ((last - ref) / ref) * 100 : null
  const name = (quotes.data?.symbols ?? []).find((q) => q.symbol === symbol)?.name ?? symbol
  useEffect(() => { if (all.length > 0 && view.off + view.count >= all.length - 15) feed.older() }, [view.off, view.count, all.length])  // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (f: Frame) => {
    if (FAST.includes(f) && !fastOk) { setNote({ ok: false, text: "The 1-minute and 5-minute charts are not part of your plan." }); return }
    setNote(null); setFrame(f); setDraft(null); setView({ count: view.count, off: HOME })
  }

  const waiting = (alerts.data?.items ?? []).filter((a) => !a.triggered_at && a.symbol === symbol)
  const trades = (live.data ?? []).flatMap((r) => (r && r.v.state === "live" ? (r.v.positions ?? []).filter((p) => canon(p.symbol).startsWith(symbol)).map((p) => ({ a: r.a, p, cur: r.v.currency ?? "USD", can: !!user?.is_admin && r.a.kind === "metaapi" })) : []))

  const removeAlert = (id: number, text: string) => Alert.alert("Remove this alert?", text, [
    { text: "Keep", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => {
      setBusy(`a${id}`); setNote(null)
      try { await api.removePriceAlert(id); await alerts.refresh() } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not remove it." }) }
      setBusy(null)
    } },
  ])
  const moveAlert = (a: { id: number; direction: "above" | "below"; price: number }, to: number) => {
    if (last === null || to === a.price) { setMoving(null); return }
    Alert.alert("Move this alert?", `${price(a.price)} to ${price(to)}`, [
      { text: "Cancel", style: "cancel", onPress: () => setMoving(null) },
      { text: "Move", onPress: async () => {
        setBusy(`a${a.id}`); setNote(null)
        try {
          await api.removePriceAlert(a.id)
          try { await api.addPriceAlert({ symbol, direction: to > last ? "above" : "below", price: to }) } catch (e) { await api.addPriceAlert({ symbol, direction: a.direction, price: a.price }).catch(() => {}); throw e }  // the new one was refused: the old one comes back
          setNote({ ok: true, text: "Alert moved." })
        } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not move the alert." }) }
        await alerts.refresh(); setMoving(null); setBusy(null)
      } },
    ])
  }
  const closeTrade = (a: Account, p: LivePosition) => Alert.alert(`Close this ${p.symbol} ${p.side.toLowerCase()} now?`, `${p.volume ?? ""} lots are closed at the current market price.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Close position", style: "destructive", onPress: async () => {
      setBusy(`p${p.id}`); setNote(null)
      try { await api.closePosition(a.id, p.id); setNote({ ok: true, text: `${p.symbol} closed.` }); await live.refresh() } catch (e) { setNote({ ok: false, text: `${p.symbol}: ${e instanceof Error ? e.message : "could not close it"}` }) }
      setBusy(null)
    } },
  ])
  const addAlert = async () => {
    if (draft === null || last === null) return
    setBusy("draft"); setNote(null)
    try {
      await api.addPriceAlert({ symbol, direction: draft > last ? "above" : "below", price: draft })
      setDraft(null); await alerts.refresh(); success(); setNote({ ok: true, text: "Alert added. We will tell you when it hits." })
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not add the alert." }) }
    setBusy(null)
  }

  const lines: ChartLine[] = [
    ...waiting.map((a) => { const at = moving?.id === a.id ? moving.price : a.price; return { id: `a${a.id}`, price: at, color: AMBER, dashed: true, label: `${at > (last ?? at) ? "▲" : "▼"} ${price(at)}`, cross: () => removeAlert(a.id, `${a.direction === "above" ? "Goes above" : "Drops below"} ${price(a.price)}`), busy: busy === `a${a.id}`, onDrag: (p: number) => { if (last !== null) setMoving({ id: a.id, price: round(p, last) }) }, onDrop: (p: number) => { if (last !== null) moveAlert(a, round(p, last)) } } }),
    ...trades.flatMap(({ a, p, cur, can }): ChartLine[] => {
      const out: ChartLine[] = []
      if (p.open_price) out.push({ id: `p${p.id}`, price: p.open_price, color: p.profit >= 0 ? colors.green : colors.red, dashed: true, label: `${p.side === "Long" ? "BUY" : "SELL"} ${p.volume ?? ""} @ ${price(p.open_price)} · ${money(p.profit, cur, true)}`, cross: can ? () => closeTrade(a, p) : undefined, busy: busy === `p${p.id}` })
      if (p.stop) out.push({ id: `s${p.id}`, price: p.stop, color: colors.red, dashed: true, label: `SL ${price(p.stop)}` })
      if (p.target) out.push({ id: `t${p.id}`, price: p.target, color: colors.green, dashed: true, label: `TP ${price(p.target)}` })
      return out
    }),
    ...(draft !== null && last !== null ? [{ id: "draft", price: draft, color: colors.text, fg: colors.bg, label: `${draft > last ? "above" : "below"} ${price(draft)}`, confirm: () => void addAlert(), cross: () => setDraft(null), busy: busy === "draft", onDrag: (p: number) => { if (last !== null) setDraft(round(p, last)) } }] : []),
  ]

  const matches = useMemo(() => {
    const f = find.trim().toLowerCase()
    const all = quotes.data?.symbols ?? []
    return (f ? all.filter((q) => q.symbol.toLowerCase().includes(f) || q.name.toLowerCase().includes(f)) : all).slice(0, 14)
  }, [quotes.data, find])

  const alertText = (d: string, p: number) => `${d === "above" ? "Goes above" : "Drops below"} ${price(p)}`
  const summary = [waiting.length ? `${waiting.length} alert${waiting.length === 1 ? "" : "s"}` : "", trades.length ? `${trades.length} open trade${trades.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "No alerts or open trades"

  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: "space-between", marginBottom: 2 }}>
        <Pressable onPress={() => setPick((v) => !v)} hitSlop={8}>
          <Row style={{ gap: 4 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{symbol}</Text><Ionicons name={pick ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} /></Row>
          <Muted numberOfLines={1}>{name}</Muted>
        </Pressable>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: change !== null && change < 0 ? colors.red : colors.green, fontSize: 22, fontWeight: "800" }}>{last !== null ? price(last) : "-"}</Text>
          <Muted style={{ color: change !== null && change < 0 ? colors.red : colors.green }}>{change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : ""}{feed.loadingMore ? "  loading older…" : feed.status === "live" ? "  ● live" : feed.status === "delayed" ? "  ○ delayed" : ""}</Muted>
        </View>
      </Row>

      {pick ? (
        <Card>
          <Field label="Find a market" value={find} onChangeText={setFind} placeholder="Gold, EURUSD, Bitcoin..." autoCapitalize="none" autoCorrect={false} />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {matches.map((q) => <Pill key={q.symbol} active={q.symbol === symbol} onPress={() => { setSymbol(q.symbol); setDraft(null); setPick(false); setFind(""); setView({ count: view.count, off: HOME }) }}>{q.symbol}</Pill>)}
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
        {TIMEFRAMES.map((f) => <Pill key={f} active={f === frame} onPress={() => choose(f)}>{`${f === "1d" ? "1D" : f}${FAST.includes(f) && !fastOk ? " 🔒" : ""}`}</Pill>)}
      </View>

      {feed.error ? <ErrorNote>{feed.error}</ErrorNote> : null}
      <CandleChart candles={all} lines={lines} last={last} view={view} setView={setView} onPick={(p) => { if (last !== null) setDraft(round(p, last)) }} />
      <Muted style={{ marginTop: 6, fontSize: 11.5 }}>{draft !== null ? "Tap + on the white line to add the alert, or drag the line to move it." : "Hold for a price line, let go to place an alert · drag the price or time scale to stretch"}</Muted>

      {note ? <View style={{ marginTop: 4 }}>{note.ok ? <Muted style={{ color: colors.green }}>{note.text}</Muted> : <ErrorNote>{note.text}</ErrorNote>}</View> : null}
      {draft !== null ? <View style={{ marginTop: 6 }}><Button onPress={addAlert} busy={busy === "draft"}>{`Add alert: ${last !== null && draft > last ? "goes above" : "drops below"} ${price(draft)}`}</Button></View> : null}

      <View style={{ marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "hidden" }}>
        <Pressable onPress={() => setPanel((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
          <Row style={{ gap: 8 }}><Ionicons name="notifications-outline" size={16} color={AMBER} /><Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{summary}</Text></Row>
          <Ionicons name={panel ? "chevron-down" : "chevron-up"} size={18} color={colors.muted} />
        </Pressable>
        {panel ? (
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
            {waiting.map((a) => (
              <Row key={a.id} style={{ justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: `${colors.border}99` }}>
                <Text style={{ color: colors.text, fontSize: 13.5 }}>{alertText(a.direction, a.price)}</Text>
                <Pressable onPress={() => removeAlert(a.id, alertText(a.direction, a.price))} hitSlop={8} accessibilityLabel="Remove alert"><Ionicons name="close-circle-outline" size={21} color={colors.red} /></Pressable>
              </Row>
            ))}
            {trades.map(({ a, p, cur, can }) => (
              <Row key={p.id} style={{ justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: `${colors.border}99` }}>
                <Text style={{ color: colors.text, fontSize: 13.5 }}>{p.side === "Long" ? "Buy" : "Sell"} {p.volume ?? ""} @ {price(p.open_price)}</Text>
                <Row style={{ gap: 10 }}>
                  <Text style={{ color: p.profit >= 0 ? colors.green : colors.red, fontWeight: "800", fontSize: 13.5 }}>{money(p.profit, cur, true)}</Text>
                  {can ? <Pressable onPress={() => closeTrade(a, p)} disabled={busy === `p${p.id}`} hitSlop={8} accessibilityLabel="Close this trade"><Ionicons name="close-circle-outline" size={21} color={colors.red} /></Pressable> : null}
                </Row>
              </Row>
            ))}
            {waiting.length + trades.length === 0 ? <Muted style={{ padding: 12 }}>Tap the chart to place your first alert.</Muted> : null}
          </ScrollView>
        ) : null}
      </View>
    </Screen>
  )
}
