import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { api, isMt5, type Account, type LivePosition } from "../src/api"
import { useAuth } from "../src/auth"
import { LiveLine, RangeBar, useProfitHistory } from "../src/livechart"
import { startLiveNotification } from "../src/liveservice"
import { CountUp, Pulse } from "../src/fx"
import { ProtectStop } from "../src/protect"
import { AutoBreakeven } from "../src/autoprotect"
import { ago, money, price } from "../src/format"
import { useLoad } from "../src/hooks"
import { useLiveStream } from "../src/livestream"
import { colors, radius } from "../src/theme"
import { PlanNote } from "../src/upgrade"
import { Empty, ErrorNote, Label, Loading, Muted, Row, Screen, Title, tone } from "../src/ui"
import { usePrivacy } from "../src/privacy"

/** The live open trades of every connected MetaTrader account, one drop-down section per account: a tap opens it. The first one starts open. */
export default function Positions() {
  usePrivacy()  // draws this screen again when amounts are hidden or shown, so no screen has to be rebuilt
  const accounts = useLoad(() => api.accounts())
  const usable: Account[] = (accounts.data?.accounts ?? []).filter((a) => isMt5(a) || a.kind === "webhook")
  const [pulls, setPulls] = useState(0)  // bumped by a pull to refresh: every section looks again
  const [refreshing, setRefreshing] = useState(false)
  const pull = async () => { setRefreshing(true); setPulls((n) => n + 1); await accounts.refresh(); setRefreshing(false) }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void pull()} padTop={false}>
      <Title sub={usable.length > 1 ? `${usable.length} accounts · tap one to open it` : "Prices move as the broker sends them"}>Live trades</Title>
      {accounts.error ? <ErrorNote>{accounts.error}</ErrorNote> : null}
      {!accounts.loaded ? <Loading /> : usable.length === 0 ? <Empty title="No MetaTrader account" text="Connect one on the website to watch your open positions here." /> : (
        usable.map((a, i) => <AccountSection key={a.id} account={a} first={i === 0} pulls={pulls} onChanged={() => void accounts.reload()} />)
      )}
      <Muted style={{ marginTop: 6, textAlign: "center" }}>Watching a live view keeps your broker connection open. It closes by itself soon after you leave.</Muted>
    </Screen>
  )
}

function AccountSection({ account, first, pulls, onChanged }: { account: Account; first: boolean; pulls: number; onChanged: () => void }) {
  const id = account.id
  const [expanded, setExpanded] = useState(first)
  const stream = useLiveStream(expanded ? id : null)  // the broker's updates pushed through the server: prices move as they happen (only for an open section: a closed one does not keep the account hot)
  const live = useLoad(() => api.accountLive(id), { every: stream.streaming ? undefined : expanded ? 5000 : 30_000, deps: [id] })  // while the stream flows nothing is asked; a closed section only looks now and then, for its summary
  useEffect(() => { if (pulls > 0) void live.refresh() }, [pulls])  // eslint-disable-line react-hooks/exhaustive-deps
  const v = stream.view ?? live.data
  const { user } = useAuth()
  const canProtect = !!user?.is_admin && isMt5(account)  // moving a stop is an order too: admins only
  const open = v?.positions ?? []
  const history = useProfitHistory(open, v?.at)
  useEffect(() => { if (v?.state === "live" && open.length > 0 && !account.is_demo) void startLiveNotification(id) }, [id, v?.state, open.length > 0, account.is_demo])  // eslint-disable-line react-hooks/exhaustive-deps

  const isLive = v?.state === "live"
  const floating = open.reduce((sum, p) => sum + p.profit, 0)
  const accent = !isLive || open.length === 0 ? colors.border : floating >= 0 ? colors.green : colors.red
  const status = !v ? "Loading…" : v.state === "starting" ? "Connecting…" : v.state !== "live" ? "Not available" : open.length === 0 ? "No open trades" : `${open.length} open trade${open.length === 1 ? "" : "s"}`

  return (
    <View style={{ marginBottom: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: expanded ? `${accent}66` : colors.border, backgroundColor: colors.card, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
      <Pressable onPress={() => setExpanded((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${account.name}, ${status}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingLeft: 16, paddingRight: 14, gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${accent}1f`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="pulse" size={20} color={isLive && open.length > 0 ? accent : colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Row style={{ gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 }}>{account.name}</Text>
            {account.is_prop ? <Tag text="PROP" color="#a78bfa" /> : null}
            {account.is_demo ? <Tag text="DEMO" color={colors.muted} /> : null}
          </Row>
          <Row style={{ gap: 6, marginTop: 3 }}>
            {stream.streaming && isLive ? <Pulse size={7} /> : null}
            <Muted>{status}</Muted>
          </Row>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {isLive && open.length > 0 ? <Text style={{ color: tone(floating), fontSize: 17, fontWeight: "800" }}>{money(floating, v?.currency, true)}</Text> : null}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
          {live.error && !v ? <PlanNote message={live.error} /> : null}
          {!live.loaded && !v ? <Loading /> : v ? (
            <>
              {v.state === "starting" ? <Muted>Connecting to your broker. The first look can take up to a minute.</Muted> : null}
              {v.state === "error" || v.state === "unsupported" || v.state === "ended" ? <ErrorNote>{v.message || "The live view is not available for this account right now."}</ErrorNote> : null}
              {isLive ? (
                <>
                  <View style={{ flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 10 }}>
                    <Stat label="Equity" value={money(v.equity, v.currency)} />
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <Stat label="Balance" value={money(v.balance, v.currency)} />
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <Stat label="Floating" value={money(v.floating, v.currency, true)} color={tone(v.floating)} />
                  </View>
                  {v.at ? <Muted style={{ textAlign: "center", marginTop: -4 }}>Updated {ago(v.at)}</Muted> : null}
                  {open.length === 0 ? <Muted style={{ textAlign: "center", paddingVertical: 10 }}>Nothing is open on this account right now.</Muted> : (
                    <>
                      {open.map((p) => <PositionCard key={p.id} p={p} history={history[p.id] ?? [p.profit]} currency={v.currency} protect={canProtect ? { accountId: id, onMoved: () => void live.refresh() } : undefined} />)}
                    </>
                  )}
                </>
              ) : null}
            </>
          ) : null}
          {canProtect ? <AutoBreakeven key={id + String(account.auto_protect?.on)} account={account} onChanged={onChanged} /> : null}
        </View>
      ) : null}
    </View>
  )
}

const Tag = ({ text, color }: { text: string; color: string }) => (
  <View style={{ backgroundColor: `${color}22`, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 }}>{text}</Text></View>
)

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View style={{ flex: 1, alignItems: "center" }}><Label>{label}</Label><Text numberOfLines={1} style={{ color: color ?? colors.text, fontSize: 15, fontWeight: "800", marginTop: 2 }}>{value}</Text></View>
)

function PositionCard({ p, history, currency, protect }: { p: LivePosition; history: number[]; currency?: string; protect?: { accountId: number; onMoved: () => void } }) {
  const long = p.side === "Long"
  const side = long ? colors.green : colors.red
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, padding: 12, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: tone(p.profit) }} />
      <Row style={{ justifyContent: "space-between" }}>
        <View>
          <Row style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{p.symbol}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: `${side}22` }}>
              <Text style={{ color: side, fontSize: 11, fontWeight: "800" }}>{p.side.toUpperCase()}{p.volume ? ` ${p.volume}` : ""}</Text>
            </View>
          </Row>
          {p.opened_at ? <Muted style={{ marginTop: 2 }}>Opened {ago(p.opened_at)}</Muted> : null}
        </View>
        <CountUp value={p.profit} format={(n) => money(n, currency, true)} ms={600} style={{ color: tone(p.profit), fontSize: 20, fontWeight: "800" }} />
      </Row>
      <View style={{ marginTop: 8 }}><LiveLine points={history} height={60} /></View>
      <RangeBar stop={p.stop} target={p.target} open={p.open_price} now={p.price} />
      <View style={{ flexDirection: "row", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: `${colors.border}cc` }}>
        <Cell label="Open" value={price(p.open_price)} />
        <Cell label="Now" value={price(p.price)} />
        <Cell label="Stop" value={p.stop ? price(p.stop) : "-"} />
        <Cell label="Target" value={p.target ? price(p.target) : "-"} />
      </View>
      {protect ? <ProtectStop accountId={protect.accountId} p={p} onMoved={protect.onMoved} /> : null}
    </View>
  )
}

const Cell = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1 }}><Label>{label}</Label><Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{value}</Text></View>
)
