import { Stack, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Text, View } from "react-native"
import { api } from "../../../src/api"
import { Curve } from "../../../src/charts"
import { Rise, Stat } from "../../../src/fx"
import { quote } from "../../../src/format"
import { useLoad } from "../../../src/hooks"
import { colors } from "../../../src/theme"
import { Card, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../../src/ui"

const CUR: Record<string, string> = { nse: "INR", us: "USD", crypto: "USD", forex: "" }
const RANGES: [string, number][] = [["1M", 21], ["6M", 126], ["1Y", 252], ["5Y", 1260], ["All", 0]]
const pct = (n: number | null | undefined) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)
const num = (n: number | null | undefined, d = 2) => (n == null ? "-" : n.toLocaleString(undefined, { maximumFractionDigits: d }))

export default function Asset() {
  const { market, symbol } = useLocalSearchParams<{ market: string; symbol: string }>()
  const [range, setRange] = useState("1Y")
  const a = useLoad(() => api.asset(market, symbol), { deps: [market, symbol] })
  const d = a.data
  const cur = CUR[market] ?? ""
  const days = RANGES.find((r) => r[0] === range)![1]
  const all = (d?.history ?? []).map((h) => h[1])
  const pts = days && all.length > days ? all.slice(-days) : all
  const step = Math.ceil(pts.length / 140)
  const line = step > 1 ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1) : pts
  const change = pts.length > 1 ? ((pts[pts.length - 1] - pts[0]) / pts[0]) * 100 : null
  const m = d?.metrics ?? {}
  const price = m.price ?? (all.length ? all[all.length - 1] : null)
  const show = (v: number | null | undefined) => (v == null ? "-" : cur ? quote(v, cur) : v.toFixed(4))

  return (
    <Screen refreshing={a.refreshing} onRefresh={a.refresh} padTop={false}>
      <Stack.Screen options={{ title: symbol.replace("=X", "") }} />
      {a.error ? <ErrorNote>{a.error}</ErrorNote> : null}
      {!a.loaded ? <Loading /> : d ? (
        <>
          <Title sub={[d.sector, d.industry].filter(Boolean).join(" · ") || d.market.toUpperCase()}>{d.name}</Title>
          <Card>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "800", letterSpacing: -1 }}>{show(price)}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: tone(m.chg_1d), fontSize: 14, fontWeight: "800" }}>{pct(m.chg_1d)}</Text>
                <Muted>today</Muted>
              </View>
            </Row>
            <View style={{ marginTop: 12 }}>{line.length > 1 ? <Curve points={line} height={130} format={show} /> : <Muted>No price history.</Muted>}</View>
            <Row style={{ justifyContent: "space-between", marginTop: 8 }}>
              <Row>{RANGES.map(([k]) => <Pill key={k} active={range === k} onPress={() => setRange(k)} color={colors.blue}>{k}</Pill>)}</Row>
              <Text style={{ color: tone(change), fontSize: 13, fontWeight: "800" }}>{pct(change)}</Text>
            </Row>
          </Card>

          <Rise delay={100}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <Stat label="52W high">{show(m.high_52w)}</Stat>
              <Stat label="52W low">{show(m.low_52w)}</Stat>
              <Stat label="1Y return" tint={tone(m.ret_1y)}>{pct(m.ret_1y)}</Stat>
              <Stat label="Volatility">{m.vol_1y != null ? `${num(m.vol_1y, 1)}%` : "-"}</Stat>
              {m.pe != null ? <Stat label="P/E">{num(m.pe, 1)}</Stat> : null}
              {m.roe != null ? <Stat label="ROE">{num(m.roe, 1)}%</Stat> : null}
              {m.div_yield != null ? <Stat label="Dividend yield">{num(m.div_yield, 2)}%</Stat> : null}
              {m.debt_equity != null ? <Stat label="Debt / equity">{num(m.debt_equity, 2)}</Stat> : null}
            </View>
          </Rise>

          {d.about ? <Card><Label>About</Label><Muted style={{ lineHeight: 19 }}>{d.about.length > 520 ? `${d.about.slice(0, 520)}...` : d.about}</Muted></Card> : null}

          {d.peers.length > 0 ? (
            <Card>
              <Label>Peers in {d.sector || "the sector"}</Label>
              {d.peers.slice(0, 6).map((p) => (
                <Row key={p.symbol} style={{ justifyContent: "space-between", paddingVertical: 6 }}>
                  <View style={{ flex: 1, paddingRight: 8 }}><Text style={{ color: colors.text, fontSize: 13.5, fontWeight: "700" }}>{p.symbol}</Text><Muted numberOfLines={1}>{p.name}</Muted></View>
                  <Text style={{ color: tone(p.ret_1y), fontSize: 13, fontWeight: "700" }}>{pct(p.ret_1y)}</Text>
                </Row>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}
