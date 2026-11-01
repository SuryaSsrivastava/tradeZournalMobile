import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect } from "react"
import { Text, View } from "react-native"
import { api, type Market } from "../../src/api"
import { useAuth } from "../../src/auth"
import { Curve } from "../../src/charts"
import { CountUp, Press, Pulse, Rise, Stat } from "../../src/fx"
import { clock, dayLabel, money, until } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { LiveTrades } from "../../src/live"
import { chosenAccounts, inScope, ScopeBar, useScope } from "../../src/scope"
import { CountdownRing, GuardRails, SessionClock, Ticker, type TickerItem } from "../../src/homefx"
import { equityPoints, journalStats } from "../../src/journal"
import { BadgeToast, useNewBadges } from "../../src/delight"
import { StreakCard, WeekCard } from "../../src/progress"
import { colors, impactColor, radius } from "../../src/theme"
import { Brand, Card, Label, Loading, Muted, Row, Screen, tone } from "../../src/ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]
const sgn = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()
  const accounts = useLoad(() => api.accounts(), { every: 60_000, cache: "accounts" })
  const trades = useLoad(() => api.journalTrades(500), { every: 120_000, cache: "trades500" })
  const rules = useLoad(() => api.discipline(), { every: 120_000, cache: "discipline" })
  const watch = useLoad(() => api.investWatchlist(), { every: 120_000 })
  // the tape: the watchlist first (starred), then the biggest names of each market, taken one from each in turn so every market shows up
  const movers = useLoad(async () => {
    const markets: Market[] = ["crypto", "us", "nse", "forex"]
    const per = await Promise.all(markets.map((m) => api.screen(m, { filters: [], sort: null }, 0, m === "forex" ? 4 : 6)
      .then((r) => r.rows.map((x): TickerItem => ({ key: `${m}:${x.symbol}`, symbol: x.symbol.replace("=X", "").replace(/USDT$/, ""), market: m, price: x.price ?? null, chg: x.chg_1d ?? null })))
      .catch(() => [] as TickerItem[])))
    const out: TickerItem[] = []
    for (let i = 0; i < 6; i++) for (const rows of per) if (rows[i]) out.push(rows[i])
    return out
  }, { every: 300_000 })
  const tape: TickerItem[] = (() => {
    const mine = (watch.data?.stocks ?? []).map((w): TickerItem => ({ key: `${w.market}:${w.symbol}`, symbol: w.symbol, market: w.market, price: w.price, chg: w.chg_1d, mine: true }))
    const seen = new Set(mine.map((m) => m.key))
    return [...mine, ...(movers.data ?? []).filter((m) => !seen.has(m.key))]
  })()
  const notices = useLoad(() => api.notices(1), { every: 60_000 })
  const next = useLoad(async () => (await api.calendar("high", ["US"])).events.find((e) => +new Date(e.time) > Date.now()) ?? null, { every: 60_000 })

  const list = accounts.data?.accounts ?? []
  const { mode, filter } = useScope()
  const every = trades.data ?? []
  const all = every.filter((t) => inScope(t, mode, filter))  // everything below follows the chosen accounts
  const st = journalStats(all)
  const picked = mode !== "real" || filter.length > 0
  const today = picked ? st.today : list.reduce((sum, a) => sum + (a.prop?.today ?? 0), 0) || st.today
  const first = (user?.name || user?.email || "").split(/[ @]/)[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const unread = notices.data?.unread ?? 0
  const scopes = (rules.data?.scopes ?? []).filter((sc) => sc.meters.length > 0)
  const meters = scopes.flatMap((sc) => sc.meters.map((m) => ({ ...m, scope: scopes.length > 1 ? sc.scope : undefined }))).slice(0, 5)
  useEffect(() => {  // keep the home-screen widget current (only in builds that contain it)
    if (process.env.EXPO_PUBLIC_WIDGET === "1" && trades.data) { try { void (require("../../src/widget") as typeof import("../../src/widget")).refreshWidget() } catch { /* no widget in this build */ } }
  }, [trades.data])
  const { fresh, done } = useNewBadges(every)
  const refresh = () => { void accounts.refresh(); void trades.refresh(); void notices.refresh(); void next.refresh(); void rules.refresh(); void watch.refresh(); void movers.refresh() }

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={accounts.refreshing || trades.refreshing} onRefresh={refresh}>
      <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Brand size={38} />
        <Press onPress={() => router.push("/alerts")}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={21} color={colors.text} />
            {unread > 0 ? <View style={{ position: "absolute", top: 7, right: 7, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}><Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "800" }}>{unread > 9 ? "9+" : unread}</Text></View> : null}
          </View>
        </Press>
      </Row>

      <View style={{ marginBottom: 14 }}>
        <Muted>{greeting}</Muted>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.6 }}>{first || "Trader"}</Text>
      </View>

      <Ticker items={tape} />

      <ScopeBar trades={every} accounts={list} />

      <Card>
        <Muted>{picked ? "Today · selected accounts" : "Today"}</Muted>
        {!accounts.loaded && !trades.loaded ? <Loading /> : <CountUp value={today} format={(n) => money(n, "USD", true)} style={{ color: tone(today), fontSize: 38, fontWeight: "800", letterSpacing: -1.2 }} />}
        <View style={{ marginTop: 10 }}>{all.length > 1 ? <Curve points={equityPoints(all)} height={100} /> : <Muted>Your equity curve appears after your first trades.</Muted>}</View>
        {all.length > 0 ? <Row style={{ justifyContent: "space-between", marginTop: 6 }}><Muted>All time</Muted><Text style={{ color: tone(st.net), fontSize: 13, fontWeight: "800" }}>{money(st.net, "USD", true)}</Text></Row> : null}
      </Card>

      <LiveTrades accounts={chosenAccounts(list, mode, filter)} />

      <Rise delay={120}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Stat min="28%" label="Win rate">{all.length ? `${st.winRate.toFixed(0)}%` : "-"}</Stat>
          <Stat min="28%" label="Avg R" tint={tone(st.avgR)}>{all.length ? `${sgn(st.avgR)}R` : "-"}</Stat>
          <Stat min="28%" label="Trades">{String(st.count)}</Stat>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <Quick icon="add-circle-outline" label="Log trade" onPress={() => router.push("/trade/new")} />
          <Quick icon="pulse-outline" label="Live trades" onPress={() => router.push("/positions")} />
          <Quick icon="search-outline" label="Markets" onPress={() => router.push("/markets")} />
          <Quick icon="calendar-outline" label="Calendar" onPress={() => router.push("/calendar")} />
        </View>
      </Rise>

      {all.length > 0 ? <><WeekCard trades={all} delay={160} /><StreakCard trades={all} delay={180} /></> : null}

      {every.length > 0 && all.length === 0 ? <Card><Muted style={{ textAlign: "center" }}>No trades for this selection. Pick another account above.</Muted></Card> : null}

      {meters.length > 0 ? (
        <Card delay={180}>
          <Row style={{ justifyContent: "space-between" }}>
            <Label>Today's guard rails</Label>
            <Press onPress={() => router.push("/goals")}><Row><Ionicons name="create-outline" size={15} color={colors.green} /><Text style={{ color: colors.green, fontSize: 12, fontWeight: "800", marginLeft: 4 }}>Edit</Text></Row></Press>
          </Row>
          <View style={{ marginTop: 8 }}><GuardRails meters={meters} /></View>
        </Card>
      ) : null}

      {rules.loaded && meters.length === 0 ? (
        <Card delay={180}>
          <Press onPress={() => router.push("/goals")}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.green}1a`, alignItems: "center", justifyContent: "center" }}><Ionicons name="flag-outline" size={20} color={colors.green} /></View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Set your goals and limits</Text>
                  <Muted>A daily loss limit, a profit goal, a trade cap. You will see them here and be alerted.</Muted>
                </View>
              </Row>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Row>
          </Press>
        </Card>
      ) : null}

      {next.data ? (
        <Card delay={220}>
          <Press onPress={() => router.push("/calendar")}>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>Next high-impact release</Label>
              <Pulse color={impactColor.high} size={5} />
            </Row>
            <Row style={{ gap: 16, marginTop: 4 }}>
              <CountdownRing time={next.data.time} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{next.data.name}</Text>
                <Muted style={{ marginTop: 3 }}>{next.data.currency} · {dayLabel(next.data.time)} {clock(next.data.time)}</Muted>
                {next.data.forecast || next.data.previous ? (
                  <Row style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {next.data.forecast ? <View style={chip}><Text style={{ color: colors.muted, fontSize: 11 }}>Forecast <Text style={{ color: colors.text, fontWeight: "700" }}>{next.data.forecast}</Text></Text></View> : null}
                    {next.data.previous ? <View style={chip}><Text style={{ color: colors.muted, fontSize: 11 }}>Previous <Text style={{ color: colors.text, fontWeight: "700" }}>{next.data.previous}</Text></Text></View> : null}
                  </Row>
                ) : null}
              </View>
            </Row>
          </Press>
        </Card>
      ) : null}

      <Card delay={260}>
        <Row style={{ justifyContent: "space-between" }}><Label>Market sessions</Label><Ionicons name="globe-outline" size={16} color={colors.muted} /></Row>
        <View style={{ marginTop: 6 }}><SessionClock /></View>
      </Card>

    </Screen>
    <BadgeToast fresh={fresh} onDone={done} />
    </View>
  )
}

const chip = { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 4 } as const

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Press onPress={onPress}>
        <View style={{ alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name={icon} size={22} color={colors.green} />
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", marginTop: 5 }}>{label}</Text>
        </View>
      </Press>
    </View>
  )
}
