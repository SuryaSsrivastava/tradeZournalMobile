import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef, useState } from "react"
import { Text, View } from "react-native"
import { api, type BrokerInfo, type Holding, type Portfolio } from "../../src/api"
import { BrokerLogin, ConnectBroker, loginUrl } from "../../src/broker"
import { Bar, CountUp, Hero, Press, Rise, Ring, Sparkline, Stat } from "../../src/fx"
import { ago, money } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { colors } from "../../src/theme"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../src/ui"

type Tab = "holdings" | "watchlist" | "orders"
const inr = (n: number | null | undefined, sign = false) => money(n, "INR", sign)
const pct = (n: number | null | undefined) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)
const big = { fontSize: 19, fontWeight: "800" } as const

export default function Invest() {
  const [tab, setTab] = useState<Tab>("holdings")
  const [link, setLink] = useState<number | undefined>(undefined)
  const fresh = useRef(false)
  const links = useLoad(() => api.investLinks())
  const portfolio = useLoad(() => api.investPortfolio(link, fresh.current), { every: 120_000, deps: [link] })

  const refresh = () => {
    fresh.current = true  // a pull to refresh asks the brokers again; the timer reuses what the server already has
    void links.refresh()
    void portfolio.refresh().finally(() => { fresh.current = false })
  }
  const [login, setLogin] = useState<string | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [brokers, setBrokers] = useState<BrokerInfo[] | null>(null)
  const [connecting, setConnecting] = useState(false)
  const connected = links.data?.links ?? []

  const signIn = async (id: number) => {
    setNote(null)
    const r = await loginUrl(id)
    if ("url" in r) setLogin(r.url); else setNote({ ok: false, text: r.error })
  }
  const finished = (ok: boolean | null) => {
    setLogin(null)
    if (ok === null) return
    setNote({ ok, text: ok ? "Connected. Loading your holdings." : "The broker login did not finish. Try again." })
    if (ok) { setConnecting(false); fresh.current = true; void links.refresh(); void portfolio.refresh().finally(() => { fresh.current = false }) }
  }
  const openConnect = async () => {
    setConnecting((v) => !v); setNote(null)
    if (!brokers) { try { setBrokers((await api.investBrokers()).brokers) } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not load the brokers." }) } }
  }
  const p = portfolio.data

  return (
    <Screen refreshing={portfolio.refreshing} onRefresh={refresh}>
      <Title brand sub={connected.length > 0 ? `${connected.length} broker${connected.length === 1 ? "" : "s"} connected` : "Your investments"} right={
        <Press onPress={() => void openConnect()}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: connecting ? colors.card : colors.green, borderWidth: 1, borderColor: colors.green, borderRadius: 22, paddingLeft: 11, paddingRight: 15, paddingVertical: 10, shadowColor: colors.green, shadowOpacity: connecting ? 0 : 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: connecting ? 0 : 8 }}>
            <Ionicons name={connecting ? "close" : "add-circle"} size={20} color={connecting ? colors.green : "#04110b"} />
            <Text style={{ color: connecting ? colors.green : "#04110b", fontWeight: "800", fontSize: 13 }}>{connecting ? "Close" : connected.length > 0 ? "Add broker" : "Connect broker"}</Text>
          </View>
        </Press>
      }>Portfolio</Title>
      {connecting ? <View style={{ marginBottom: 12 }}>{brokers ? <ConnectBroker brokers={brokers} onLogin={setLogin} onDone={() => { void links.refresh() }} /> : <Loading />}</View> : null}
      <Rise>
        <Hero tint={colors.blue}>
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "700", letterSpacing: 2.4, textTransform: "uppercase" }}>Investments</Text>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 12 }}>Portfolio value</Text>
          {!portfolio.loaded ? <Loading /> : (
            <CountUp value={p?.totals.value ?? 0} format={(n) => inr(n)} style={{ color: colors.text, fontSize: 38, fontWeight: "800", letterSpacing: -1.1, marginTop: 2 }} />
          )}
          {p && p.totals.count > 0 ? (
            <>
              <Muted>{p.totals.count} holding{p.totals.count === 1 ? "" : "s"}{p.cached_at ? ` · updated ${ago(new Date(p.cached_at * 1000).toISOString())}` : ""}</Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <Stat label="Invested"><CountUp value={p.totals.invested} format={(n) => inr(n)} style={[big, { color: colors.text }]} /></Stat>
                <Stat label="Total P&L">
                  <CountUp value={p.totals.pnl} format={(n) => inr(n, true)} style={[big, { color: tone(p.totals.pnl) }]} />
                  <Text style={{ color: tone(p.totals.pnl), fontSize: 11, fontWeight: "700" }}>{pct(p.totals.pnl_pct)}</Text>
                </Stat>
                <Stat label="Today">
                  <CountUp value={p.totals.day_pnl} format={(n) => inr(n, true)} style={[big, { color: tone(p.totals.day_pnl) }]} />
                  <Text style={{ color: tone(p.totals.day_pnl), fontSize: 11, fontWeight: "700" }}>{pct(p.totals.day_pct)}</Text>
                </Stat>
                <Stat label="Brokers">{String(connected.filter((l) => l.status === "active").length || new Set(p.holdings.map((h) => h.link_id)).size)}</Stat>
              </View>
            </>
          ) : null}
        </Hero>
      </Rise>

      {portfolio.error ? <View style={{ marginTop: 12 }}><ErrorNote>{portfolio.error}</ErrorNote></View> : null}
      {(p?.problems ?? []).map((x) => <View key={x.link_id} style={{ marginTop: 12 }}><ErrorNote>{x.name}: {x.error}</ErrorNote></View>)}
      {connected.filter((l) => l.needs_login).map((l) => (
        <View key={l.id} style={{ marginTop: 12 }}><Card><Muted>{l.name || l.label} needs you to sign in again (brokers end the session each day).</Muted>
          <View style={{ marginTop: 10 }}><Button onPress={() => void signIn(l.id)}>Sign in to {l.label}</Button></View></Card></View>
      ))}
      {note ? <View style={{ marginTop: 12 }}>{note.ok ? <Card><Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>{note.text}</Text></Card> : <ErrorNote>{note.text}</ErrorNote>}</View> : null}
      <BrokerLogin url={login} onClose={finished} />

      {p && p.holdings.length > 1 && p.totals.value > 0 ? <Allocation holdings={p.holdings} total={p.totals.value} /> : null}

      <Row style={{ marginTop: 16, marginBottom: 4, flexWrap: "wrap" }}>
        {(["holdings", "watchlist", "orders"] as Tab[]).map((t) => <Pill key={t} active={tab === t} onPress={() => setTab(t)} color={colors.blue}>{t === "holdings" ? "Holdings" : t === "watchlist" ? "Watchlist" : "Orders"}</Pill>)}
      </Row>

      {tab === "holdings" ? (
        <>
          {connected.length > 1 ? (
            <Row style={{ flexWrap: "wrap", marginBottom: 2 }}>
              <Pill active={link === undefined} onPress={() => setLink(undefined)} color={colors.blue}>All brokers</Pill>
              {connected.map((l) => <Pill key={l.id} active={link === l.id} onPress={() => setLink(l.id)} color={colors.blue}>{l.name || l.label}</Pill>)}
            </Row>
          ) : null}
          <Holdings p={p} loaded={portfolio.loaded} noBroker={links.loaded && connected.length === 0} onConnect={() => void openConnect()} />
        </>
      ) : tab === "watchlist" ? <Watchlist /> : <Orders />}
    </Screen>
  )
}

const PALETTE = [colors.green, colors.blue, "#6366f1", colors.amber, "#f472b6"]

/** Where the money sits: a ring of the biggest holdings, the rest grouped, with a legend. */
function Allocation({ holdings, total }: { holdings: Holding[]; total: number }) {
  const sorted = [...holdings].filter((h) => (h.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const top = sorted.slice(0, 5)
  const rest = sorted.slice(5).reduce((sum, h) => sum + (h.value ?? 0), 0)
  const rows = [...top.map((h, i) => ({ label: h.symbol, value: h.value ?? 0, color: PALETTE[i] })), ...(rest > 0 ? [{ label: `${sorted.length - 5} others`, value: rest, color: colors.muted }] : [])]
  return (
    <Card delay={120} style={{ marginTop: 12 }}>
      <Label>Allocation</Label>
      <Row style={{ gap: 16 }}>
        <Ring size={124} stroke={13} slices={rows.map((r) => ({ pct: (r.value / total) * 100, color: r.color }))}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{sorted.length}</Text>
          <Muted>holdings</Muted>
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          {rows.map((r) => (
            <Row key={r.label} style={{ justifyContent: "space-between" }}>
              <Row><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color, marginRight: 8 }} /><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12.5, fontWeight: "600", maxWidth: 90 }}>{r.label}</Text></Row>
              <Muted>{((r.value / total) * 100).toFixed(1)}%</Muted>
            </Row>
          ))}
        </View>
      </Row>
    </Card>
  )
}

function Holdings({ p, loaded, noBroker, onConnect }: { p: Portfolio | null; loaded: boolean; noBroker: boolean; onConnect: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!loaded) return <Loading />
  if (noBroker) return <><Empty title="No broker connected" text="Connect Dhan, Fyers or Angel One and your holdings show up here." /><Button onPress={onConnect}>Connect a broker</Button></>
  const list = [...(p?.holdings ?? [])].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  if (list.length === 0) return <Empty title="No holdings" text="Nothing is held in the connected accounts right now." />
  const total = p?.totals.value || 1
  return <>{list.map((h, i) => {
    const key = `${h.link_id}:${h.symbol}`
    return <HoldingCard key={key} h={h} weight={((h.value ?? 0) / total) * 100} delay={Math.min(i, 8) * 50} open={open === key} onPress={() => setOpen(open === key ? null : key)} />
  })}</>
}

function HoldingCard({ h, weight, delay, open, onPress }: { h: Holding; weight: number; delay: number; open: boolean; onPress: () => void }) {
  return (
    <Card delay={delay}>
      <Press onPress={onPress}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{h.symbol}</Text>
            <Muted>{h.qty} @ {inr(h.avg)} · {h.broker_label}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{inr(h.value)}</Text>
            <Text style={{ color: tone(h.pnl), fontSize: 12, fontWeight: "700" }}>{inr(h.pnl, true)} · {pct(h.pnl_pct)}</Text>
          </View>
        </Row>
        <Row style={{ marginTop: 9, gap: 8 }}>
          <View style={{ flex: 1 }}><Bar pct={weight} color={colors.blue} height={4} /></View>
          <Muted>{weight.toFixed(1)}% of portfolio</Muted>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
        </Row>
      </Press>
      {open ? <Detail h={h} /> : null}
    </Card>
  )
}

/** One holding opened up: its year of closing prices and the numbers behind the row. */
function Detail({ h }: { h: Holding }) {
  const [history, setHistory] = useState<number[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    api.investChart(h.symbol).then((r) => { if (alive) setHistory(r.history.map((x) => x[1])) }).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [h.symbol])
  const pts = history && history.length > 120 ? history.filter((_, i) => i % Math.ceil(history.length / 120) === 0 || i === history.length - 1) : history
  const yearChange = history && history.length > 1 ? ((history[history.length - 1] - history[0]) / history[0]) * 100 : null
  return (
    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: `${colors.border}99`, paddingTop: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Label>Last 12 months</Label>
        {yearChange != null ? <Text style={{ color: tone(yearChange), fontSize: 12, fontWeight: "700" }}>{pct(yearChange)}</Text> : null}
      </Row>
      {failed ? <Muted>No chart for this one.</Muted> : pts && pts.length > 1 ? <Sparkline points={pts} width={290} height={70} color={yearChange != null && yearChange < 0 ? colors.red : colors.green} /> : history ? <Muted>No price history.</Muted> : <Loading />}
      {history && history.length > 1 ? <Row style={{ justifyContent: "space-between", marginTop: 4 }}><Muted>Low {inr(Math.min(...history))}</Muted><Muted>High {inr(Math.max(...history))}</Muted></Row> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Stat label="Last price">{inr(h.ltp)}</Stat>
        <Stat label="Invested">{inr(h.invested)}</Stat>
        <Stat label="Today" tint={tone(h.day_pnl)}>{inr(h.day_pnl, true)}</Stat>
        <Stat label="Account">{h.account || h.broker_label}</Stat>
      </View>
    </View>
  )
}

function Watchlist() {
  const w = useLoad(() => api.investWatchlist(), { every: 120_000 })
  if (!w.loaded) return <Loading />
  const list = w.data?.stocks ?? []
  if (list.length === 0) return <Empty title="Watchlist is empty" text="Add stocks from the Screener on the website and they appear here with live prices." />
  return <>{list.map((s, i) => {
    const since = s.price != null && s.added_price ? ((s.price - s.added_price) / s.added_price) * 100 : null
    return (
      <Card key={s.id} delay={Math.min(i, 8) * 50}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{s.symbol}</Text>
            <Muted numberOfLines={1}>{s.name}{s.sector ? ` · ${s.sector}` : ""}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{s.price != null ? inr(s.price) : "-"}</Text>
            <Text style={{ color: tone(s.chg_1d), fontSize: 12, fontWeight: "700" }}>{pct(s.chg_1d)} today</Text>
          </View>
        </Row>
        <Row style={{ gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {s.pe != null ? <Muted>P/E {s.pe.toFixed(1)}</Muted> : null}
          {since != null ? <Text style={{ color: tone(since), fontSize: 12 }}>{pct(since)} since added</Text> : null}
          <Muted>added {ago(s.added_at)}</Muted>
        </Row>
      </Card>
    )
  })}</>
}

function Orders() {
  const o = useLoad(() => api.investOrders())
  if (!o.loaded) return <Loading />
  const list = o.data?.orders ?? []
  if (list.length === 0) return <Empty title="No orders" text="Orders placed through TradeZournal are listed here." />
  return <>{list.map((x, i) => (
    <Card key={x.id} delay={Math.min(i, 8) * 50}>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}><Text style={{ color: x.side === "sell" ? colors.red : colors.green }}>{x.side.toUpperCase()}</Text> {x.symbol}</Text>
          <Muted>{x.qty} · {x.order_type}{x.price ? ` @ ${inr(x.price)}` : ""} · {x.broker}</Muted>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: /fail|reject|error/i.test(x.status) ? colors.red : colors.text, fontWeight: "700", fontSize: 13 }}>{x.status}</Text>
          <Muted>{ago(x.created_at)}</Muted>
        </View>
      </Row>
      {x.message ? <Muted style={{ marginTop: 6 }}>{x.message}</Muted> : null}
    </Card>
  ))}</>
}
