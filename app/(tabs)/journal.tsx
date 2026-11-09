import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { api, type JournalTrade } from "../../src/api"
import { AreaChart, Columns, Curve, PnlCalendar, RankBars } from "../../src/charts"
import { DayTrades } from "../../src/day"
import { CountUp, Press, Rise, Ring, Stat } from "../../src/fx"
import { dayLabel, money } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { breakdown, byHour, byMonth, dailySeries, drawdownSeries, equityPoints, equityPointsR, groupByDay, holdMinutes, inRange, journalStats, maxDrawdown, minutesText, pnlByDay, pnlOf, rBuckets, rOf, rollingWinRate, sessionOf, streaks, weekdays } from "../../src/journal"
import { ShotBadge } from "../../src/shots"
import { SwipeRow } from "../../src/swipe"
import { showToast } from "../../src/toast"
import { success } from "../../src/delight"
import { inMode, inScope, ScopeBar, useScope } from "../../src/scope"
import { colors, radius } from "../../src/theme"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../src/ui"

const sgn = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`
const usd = (n: number) => money(n, "USD", true)
type Tab = "overview" | "trades" | "calendar"
const TABS: [Tab, string, React.ComponentProps<typeof Ionicons>["name"]][] = [["overview", "Overview", "stats-chart"], ["trades", "Trades", "list"], ["calendar", "Calendar", "calendar"]]
const RANGES: [string, number][] = [["7D", 7], ["30D", 30], ["90D", 90], ["All", 0]]
type Filter = "all" | "wins" | "losses" | "long" | "short"
const FILTERS: [Filter, string][] = [["all", "All"], ["wins", "Wins"], ["losses", "Losses"], ["long", "Long"], ["short", "Short"]]
const keep = (f: Filter, t: JournalTrade) => f === "all" || (f === "wins" ? pnlOf(t) > 0 : f === "losses" ? pnlOf(t) < 0 : t.side.toLowerCase() === f)
const big = { fontSize: 19, fontWeight: "800" } as const

export default function Journal() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [range, setRange] = useState(0)
  const [filter, setFilter] = useState<Filter>("all")
  const [day, setDay] = useState<Date | null>(null)
  const trades = useLoad(() => api.journalTrades(500), { cache: "trades500" })
  const accounts = useLoad(() => api.accounts(), { cache: "accounts" })
  const counts = useLoad(() => api.journalShotCounts(), { cache: "shotcounts" })
  const { mode, filter: accts, setMode } = useScope()
  const every = trades.data ?? []
  const all = every.filter((t) => inScope(t, mode, accts))  // follows the account chosen on Home or here
  const other = (["backtest", "manual"] as const).map((m) => ({ m, n: every.filter((t) => inMode(t, m)).length })).filter((x) => x.m !== mode && x.n > 0)

  const star = async (t: JournalTrade) => {  // the "starred" tag: shows on the website too
    const on = t.tags.includes("starred")
    try { await api.editJournalTrade(t.id, { tags: on ? t.tags.filter((x) => x !== "starred") : [...t.tags, "starred"] }); if (!on) success(); showToast(on ? "Removed the star" : "Starred"); await trades.refresh() } catch (e) { showToast(e instanceof Error ? e.message : "Could not do that.", false) }
  }
  const remove = (t: JournalTrade) => Alert.alert(`Delete ${t.symbol}?`, "It is removed from your journal on the website too.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { try { await api.deleteJournalTrade(t.id); showToast("Trade deleted"); await trades.refresh() } catch (e) { showToast(e instanceof Error ? e.message : "Could not delete.", false) } } },
  ])
  return (
    <Screen refreshing={trades.refreshing} onRefresh={() => { void Promise.all([trades.refresh(), counts.refresh()]).then(() => showToast("Journal is up to date")) }}>
      <Title brand sub={`${all.length} trade${all.length === 1 ? "" : "s"}`} right={<Press onPress={() => router.push("/trade/new")}><View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.green, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 }}><Ionicons name="add" size={18} color="#04110b" /><Text style={{ color: "#04110b", fontWeight: "800", fontSize: 13 }}>Log trade</Text></View></Press>}>Journal</Title>
      <ScopeBar trades={every} accounts={accounts.data?.accounts ?? []} />
      {trades.error ? <ErrorNote>{trades.error}</ErrorNote> : null}

      {!trades.loaded ? <Loading /> : all.length === 0 ? (
        <Rise>
          {every.length === 0 ? <Empty title="Your journal is empty" text="Log your first trade, or connect an account on the website. Both journals are the same." /> : (
            <Card>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Nothing in this view</Text>
              <Muted style={{ marginTop: 4, marginBottom: 12 }}>{other.length > 0 ? "You have trades in another view of your journal:" : "Pick another account above."}</Muted>
              {other.map(({ m, n }) => <View key={m} style={{ marginBottom: 8 }}><Button tone="ghost" onPress={() => setMode(m)}>{m === "backtest" ? `Show backtested trades (${n})` : `Show manual journal (${n})`}</Button></View>)}
            </Card>
          )}
        </Rise>
      ) : (
        <>
          <Segmented tab={tab} onChange={(t) => { setTab(t); setDay(null) }} />
          <Rise key={tab}>
            {tab === "overview" ? <Overview trades={all} range={range} setRange={setRange} />
              : tab === "trades" ? <TradeList trades={all} counts={counts.data ?? {}} filter={filter} setFilter={setFilter} onOpen={(id) => router.push(`/trade/${id}`)} onStar={star} onDelete={remove} />
              : (
                <>
                  <Card><PnlCalendar byDay={pnlByDay(all)} onPick={(d) => setDay(d)} />{!day ? <Muted style={{ textAlign: "center", marginTop: 10 }}>Tap a day to see its trades and screenshots.</Muted> : null}</Card>
                  {day ? <DayTrades day={day} trades={all} counts={counts.data ?? {}} onOpen={(id) => router.push(`/trade/${id}`)} /> : null}
                </>
              )}
          </Rise>
        </>
      )}
    </Screen>
  )
}

/** Overview, Trades and Calendar as one rounded control. */
function Segmented({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: 14 }}>
      {TABS.map(([k, l, icon]) => {
        const on = tab === k
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: on ? `${colors.green}26` : "transparent", borderWidth: 1, borderColor: on ? `${colors.green}66` : "transparent" }}>
            <Ionicons name={icon} size={15} color={on ? colors.green : colors.muted} />
            <Text style={{ color: on ? colors.text : colors.muted, fontSize: 13, fontWeight: on ? "800" : "600" }}>{l}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Overview({ trades, range, setRange }: { trades: JournalTrade[]; range: number; setRange: (n: number) => void }) {
  const [unit, setUnit] = useState<"usd" | "r">("usd")
  const t = inRange(trades, range)
  const st = journalStats(t)
  const run = streaks(t)
  const dd = maxDrawdown(t)
  const daily = dailySeries(t, 30)
  const best = daily.reduce((m, d) => (d.pnl > m ? d.pnl : m), 0)
  const totalR = t.reduce((a, x) => a + rOf(x), 0)
  const underwater = drawdownSeries(t)
  const buckets = rBuckets(t)
  const sessions = breakdown(t, (x) => [sessionOf(x.opened_at)])
  const sides = breakdown(t, (x) => [x.side])
  const symbols = breakdown(t, (x) => [x.symbol])
  const symbolRows = symbols.length > 6 ? [...symbols.slice(0, 4), ...symbols.slice(-2)] : symbols  // the best few and the worst two
  const rolling = rollingWinRate(t, 20)
  const months = byMonth(t)
  const hold = holdMinutes(t)
  const ratings = breakdown(t, (x) => [`${x.rating}★`]).sort((a, b) => b.key.localeCompare(a.key))
  const setups = breakdown(t, (x) => (x.setup ? [x.setup] : [])).slice(0, 6)
  const feelings = breakdown(t, (x) => x.emotions).slice(0, 6)
  const discipline = breakdown(t, (x) => (x.followed_plan === true ? ["Followed the plan"] : x.followed_plan === false ? ["Broke the plan"] : []))
  const rows = (xs: { key: string; n: number; net: number; winRate: number }[]) => xs.map((x) => ({ key: x.key, value: x.net, sub: `${x.n} trade${x.n === 1 ? "" : "s"} · ${x.winRate.toFixed(0)}% wins` }))
  const holdNote = hold.win != null && hold.loss != null
    ? hold.loss > hold.win * 1.5 ? `You hold losing trades about ${(hold.loss / hold.win).toFixed(1)}× longer than winners. Cutting losers sooner usually helps.`
      : hold.win > hold.loss * 1.5 ? "You let winners run longer than losers. That is the pattern to keep." : "Winners and losers are held for about the same time."
    : null

  return (
    <>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Muted>Net result</Muted>
          <Row>{RANGES.map(([l, d]) => <Pill key={l} active={range === d} onPress={() => setRange(d)}>{l}</Pill>)}</Row>
        </Row>
        {t.length === 0 ? <Muted style={{ marginVertical: 24, textAlign: "center" }}>No trades in this period.</Muted> : (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              {unit === "usd"
                ? <CountUp key={`${range}u`} value={st.net} format={usd} style={{ color: tone(st.net), fontSize: 36, fontWeight: "800", letterSpacing: -1.2 }} />
                : <CountUp key={`${range}r`} value={totalR} format={(n) => `${sgn(n)}R`} style={{ color: tone(totalR), fontSize: 36, fontWeight: "800", letterSpacing: -1.2 }} />}
              <Row><Pill active={unit === "usd"} onPress={() => setUnit("usd")}>$</Pill><Pill active={unit === "r"} onPress={() => setUnit("r")}>R</Pill></Row>
            </Row>
            <View style={{ marginTop: 8 }}><Curve key={`${range}${unit}`} points={unit === "usd" ? equityPoints(t) : equityPointsR(t)} height={130} /></View>
            <Row style={{ justifyContent: "space-between", marginTop: 8 }}>
              <Muted>Max drawdown <Text style={{ color: colors.red, fontWeight: "800" }}>{money(-dd)}</Text></Muted>
              <Muted>Best day <Text style={{ color: colors.green, fontWeight: "800" }}>{usd(best)}</Text></Muted>
            </Row>
          </>
        )}
      </Card>

      {t.length > 0 ? (
        <>
          <Rise delay={80}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <Stat label="Win rate"><CountUp key={range} value={st.winRate} format={(n) => `${n.toFixed(0)}%`} style={[big, { color: colors.text }]} /></Stat>
              <Stat label="Avg R"><CountUp key={range} value={st.avgR} format={(n) => `${sgn(n)}R`} style={[big, { color: tone(st.avgR) }]} /></Stat>
              <Stat label="Profit factor">{st.profitFactor === Infinity ? "∞" : st.profitFactor.toFixed(2)}</Stat>
              <Stat label="Streak" tint={run.current >= 0 ? colors.green : colors.red}>{run.current === 0 ? "-" : run.current > 0 ? `${run.current} wins` : `${-run.current} losses`}</Stat>
              <Stat label="Avg win" tint={colors.green}>{usd(st.avgWin)}</Stat>
              <Stat label="Avg loss" tint={colors.red}>{usd(st.avgLoss)}</Stat>
              {hold.win != null ? <Stat label="Hold · winners">{minutesText(hold.win)}</Stat> : null}
              {hold.loss != null ? <Stat label="Hold · losers">{minutesText(hold.loss)}</Stat> : null}
            </View>
            {holdNote ? <Muted style={{ marginBottom: 12, lineHeight: 18 }}>{holdNote}</Muted> : null}
          </Rise>

          <Card delay={140}>
            <Label>Daily P&L</Label>
            <Columns data={daily.map((d) => ({ label: String(new Date(d.iso).getDate()), value: d.pnl }))} format={usd} labelEvery={daily.length > 14 ? 3 : 1} />
          </Card>

          <Card delay={200}>
            <Label>Wins and losses</Label>
            <Row style={{ gap: 18 }}>
              <Ring size={120} stroke={13} slices={[{ pct: st.winRate, color: colors.green }, { pct: 100 - st.winRate, color: colors.red }]}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{st.winRate.toFixed(0)}%</Text><Muted>win rate</Muted>
              </Ring>
              <View style={{ flex: 1, gap: 8 }}>
                <Row style={{ justifyContent: "space-between" }}><Row><Dot c={colors.green} /><Text style={lbl}>Wins</Text></Row><Text style={[val, { color: colors.green }]}>{st.wins}</Text></Row>
                <Row style={{ justifyContent: "space-between" }}><Row><Dot c={colors.red} /><Text style={lbl}>Losses</Text></Row><Text style={[val, { color: colors.red }]}>{st.losses}</Text></Row>
                <Row style={{ justifyContent: "space-between" }}><Text style={lbl}>Best trade</Text><Text style={[val, { color: colors.green }]}>{usd(st.best)}</Text></Row>
                <Row style={{ justifyContent: "space-between" }}><Text style={lbl}>Worst trade</Text><Text style={[val, { color: colors.red }]}>{usd(st.worst)}</Text></Row>
                <Row style={{ justifyContent: "space-between" }}><Text style={lbl}>Longest win run</Text><Text style={val}>{run.bestWin}</Text></Row>
              </View>
            </Row>
          </Card>

          {underwater.length > 2 ? (
            <Card delay={240}>
              <Row style={{ justifyContent: "space-between" }}><Label>Drawdown</Label><Muted>now <Text style={{ color: underwater[underwater.length - 1] < 0 ? colors.red : colors.green, fontWeight: "800" }}>{money(underwater[underwater.length - 1])}</Text> · worst <Text style={{ color: colors.red, fontWeight: "800" }}>{money(-dd)}</Text></Muted></Row>
              <AreaChart key={range} points={underwater} color={colors.red} fillTo="top" baseline={0} height={90} />
              <Muted style={{ marginTop: 6 }}>How far below your best point the account has been. The flat line at the top is a new high.</Muted>
            </Card>
          ) : null}

          <Card delay={280}>
            <Label>R-multiple distribution</Label>
            <Columns data={buckets.map((b) => ({ label: b.label, value: b.value }))} format={(n) => `${n} trade${n === 1 ? "" : "s"}`} height={110} color={(_d, i) => (buckets[i].sign < 0 ? colors.red : colors.green)} />
            <Muted style={{ marginTop: 6 }}>Trades counted by result in R. A healthy journal has a short red side and a longer green tail.</Muted>
          </Card>

          {rolling.length >= 3 ? (
            <Card delay={320}>
              <Row style={{ justifyContent: "space-between" }}><Label>Win rate, last 20 trades</Label><Muted>now <Text style={{ color: colors.text, fontWeight: "800" }}>{rolling[rolling.length - 1].toFixed(0)}%</Text></Muted></Row>
              <AreaChart key={range} points={rolling} color={colors.blue} baseline={50} from={0} to={100} height={90} />
            </Card>
          ) : null}

          <Card delay={360}>
            <Label>By weekday</Label>
            <Columns data={weekdays(t).map((d) => ({ label: d.label, value: d.pnl }))} format={usd} height={110} />
          </Card>

          <Card delay={400}>
            <Label>By hour you opened the trade</Label>
            <Columns data={byHour(t).map((d) => ({ label: d.label, value: d.pnl }))} format={usd} height={110} labelEvery={3} />
          </Card>

          {sessions.length > 0 ? <Card delay={440}><Label>Sessions</Label><RankBars rows={rows(sessions)} format={usd} /></Card> : null}
          {sides.length > 1 ? <Card delay={480}><Label>Long and short</Label><RankBars rows={rows(sides)} format={usd} /></Card> : null}
          {months.length >= 2 ? <Card delay={520}><Label>By month</Label><Columns data={months.map((m) => ({ label: m.label, value: m.pnl }))} format={usd} height={110} labelEvery={months.length > 6 ? 2 : 1} /></Card> : null}
          {symbolRows.length > 1 ? <Card delay={560}><Label>By symbol</Label><RankBars rows={rows(symbolRows)} format={usd} /></Card> : null}
          {setups.length > 0 ? <Card delay={600}><Label>Setups</Label><RankBars rows={rows(setups)} format={usd} /></Card> : null}
          {ratings.length > 1 ? <Card delay={640}><Label>Your own rating, against the result</Label><RankBars rows={rows(ratings)} format={usd} /></Card> : null}
          {discipline.length > 0 ? <Card delay={680}><Label>Discipline</Label><RankBars rows={discipline.map((x) => ({ key: x.key, value: x.net, sub: `${x.n} trade${x.n === 1 ? "" : "s"}` }))} format={usd} /></Card> : null}
          {feelings.length > 0 ? <Card delay={720}><Label>Emotions</Label><RankBars rows={feelings.map((x) => ({ key: x.key, value: x.net, sub: `${x.n}×` }))} format={usd} /></Card> : null}
        </>
      ) : null}
    </>
  )
}

const lbl = { color: colors.muted, fontSize: 12.5, fontWeight: "600" } as const
const val = { color: colors.text, fontSize: 13.5, fontWeight: "800" } as const
const Dot = ({ c }: { c: string }) => <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c, marginRight: 8 }} />

function TradeList({ trades, counts, filter, setFilter, onOpen, onStar, onDelete }: { trades: JournalTrade[]; counts: Record<string, number>; filter: Filter; setFilter: (f: Filter) => void; onOpen: (id: number) => void; onStar: (t: JournalTrade) => void; onDelete: (t: JournalTrade) => void }) {
  const groups = groupByDay(trades.filter((t) => keep(filter, t)))
  let i = 0
  return (
    <>
      <Row style={{ flexWrap: "wrap", marginBottom: 6 }}>{FILTERS.map(([k, l]) => <Pill key={k} active={filter === k} onPress={() => setFilter(k)}>{l}</Pill>)}</Row>
      {groups.length === 0 ? <Empty title="Nothing matches" text="Try another filter." /> : groups.map((g) => (
        <View key={g.iso} style={{ marginTop: 8 }}>
          <Row style={{ justifyContent: "space-between", marginBottom: 6, paddingHorizontal: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>{dayLabel(g.iso).toUpperCase()}</Text>
            <Text style={{ color: tone(g.total), fontSize: 12, fontWeight: "800" }}>{money(g.total, "USD", true)}</Text>
          </Row>
          {g.trades.map((t) => (
            <SwipeRow key={t.id}
              right={{ label: t.tags.includes("starred") ? "Unstar" : "Star", icon: t.tags.includes("starred") ? "star" : "star-outline", color: colors.amber, run: () => onStar(t) }}
              left={{ label: "Delete", icon: "trash-outline", color: colors.red, run: () => onDelete(t) }}>
              <TradeRow t={t} shots={counts[t.id]} delay={Math.min(i++, 10) * 45} starred={t.tags.includes("starred")} onPress={() => onOpen(t.id)} />
            </SwipeRow>
          ))}
        </View>
      ))}
    </>
  )
}

function TradeRow({ t, shots, delay, starred, onPress }: { t: JournalTrade; shots?: number; delay: number; starred?: boolean; onPress: () => void }) {
  const p = pnlOf(t)
  return (
    <Press onPress={onPress}>
      <Card delay={delay} style={{ paddingVertical: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: tone(p), marginRight: 12, opacity: 0.9 }} />
            <View style={{ flex: 1 }}>
              <Row><Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{t.symbol} <Text style={{ color: t.side === "Short" ? colors.red : colors.green, fontSize: 11, fontWeight: "700" }}>{t.side.toUpperCase()}</Text></Text><ShotBadge n={shots} />{starred ? <Ionicons name="star" size={12} color={colors.amber} style={{ marginLeft: 6 }} /> : null}</Row>
              <Muted numberOfLines={1}>{[t.setup, t.emotions[0], t.note].filter(Boolean).join(" · ") || `${t.qty} @ ${t.entry}`}</Muted>
            </View>
          </Row>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: tone(p), fontSize: 15, fontWeight: "800" }}>{money(p, "USD", true)}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{sgn(rOf(t))}R</Text>
          </View>
        </Row>
      </Card>
    </Press>
  )
}
