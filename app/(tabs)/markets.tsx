import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { api, ApiError, type Market, type ScreenResult, type ScreenRow } from "../../src/api"
import { Press } from "../../src/fx"
import { money } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { AllowanceBanner } from "../../src/upgrade"
import { colors, radius } from "../../src/theme"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../src/ui"

const MARKETS: [Market, string, string][] = [["nse", "India", "INR"], ["us", "US stocks", "USD"], ["crypto", "Crypto", "USD"], ["forex", "Forex", ""]]
const SORTS: [string, string, { field: string; dir: "asc" | "desc" }][] = [
  ["top", "Top", { field: "market_cap", dir: "desc" }],
  ["gain", "Gainers", { field: "chg_1d", dir: "desc" }],
  ["lose", "Losers", { field: "chg_1d", dir: "asc" }],
  ["year", "1Y best", { field: "ret_1y", dir: "desc" }],
]
const IDEAS = ["Top gainers today", "Large companies with PE under 20", "High dividend yield", "Strong ROE and low PE"]
type Turn = { role: "user" | "assistant"; text: string }
const pct = (n: number | null | undefined) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)

export default function Markets() {
  const router = useRouter()
  const [market, setMarket] = useState<Market>("nse")
  const [sort, setSort] = useState("top")
  const [text, setText] = useState("")
  const [search, setSearch] = useState("")
  const [size, setSize] = useState(40)
  useEffect(() => { const t = setTimeout(() => setSearch(text.trim()), 350); return () => clearTimeout(t) }, [text])
  useEffect(() => setSize(40), [market, sort, search])

  // crypto and forex have no market cap: their default order is the server's own
  const by = SORTS.find((s) => s[0] === sort)![2]
  const sortSpec = sort === "top" && (market === "crypto" || market === "forex") ? null : by
  // the chat: a plain-English request becomes a screen, and its answer replaces the list below until cleared
  const [turns, setTurns] = useState<Turn[]>([])
  const [ask, setAsk] = useState("")
  const [thinking, setThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [spent, setSpent] = useState<string | null>(null)  // the server said the AI allowance is used up: the message it gave
  const [answer, setAnswer] = useState<ScreenResult | null>(null)
  const scroller = useRef<ScrollView>(null)
  useEffect(() => { setAnswer(null); setTurns([]); setChatError(null) }, [market])
  const send = async (text: string) => {
    const message = text.trim()
    if (!message || thinking) return
    setAsk(""); setChatError(null); setSpent(null); setThinking(true)
    const history = turns.slice(-6)
    setTurns((t) => [...t, { role: "user", text: message }])
    try {
      const r = await api.screenChat(market, message, history)
      setTurns((t) => [...t, { role: "assistant", text: r.reply }])
      setAnswer(r.result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setSpent(e.message)
      else setChatError(e instanceof Error ? e.message : "I could not do that. Try again.")
    } finally { setThinking(false) }
  }
  const clearChat = () => { setTurns([]); setAnswer(null); setChatError(null); setSpent(null) }

  const res = useLoad(() => api.screen(market, { filters: [], sort: sortSpec, search }, 0, size), { deps: [market, sort, search, size] })
  const cur = MARKETS.find((m) => m[0] === market)![2]
  const rows = answer ? answer.rows : res.data?.rows ?? []

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      <Title brand sub="Screen stocks, crypto and forex" right={<Press onPress={() => router.push("/calendar")}><View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}><Ionicons name="calendar-outline" size={16} color={colors.text} /><Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Calendar</Text></View></Press>}>Screener</Title>
      <Row style={{ flexWrap: "wrap" }}>{MARKETS.map(([k, l]) => <Pill key={k} active={market === k} onPress={() => setMarket(k)} color={colors.blue}>{l}</Pill>)}</Row>
      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginVertical: 10 }}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput value={text} onChangeText={setText} placeholder="Search a name or symbol" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12, marginLeft: 8 }} />
        {text ? <Pressable onPress={() => setText("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </Row>
      {turns.length ? (
        <Card style={{ borderColor: `${colors.green}55` }}>
          <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <Label>Your screen</Label>
            <Pressable onPress={clearChat} hitSlop={10}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Clear</Text></Pressable>
          </Row>
          {turns.slice(-4).map((t, i) => (
            <Text key={i} style={{ color: t.role === "user" ? colors.muted : colors.text, fontSize: 13.5, lineHeight: 19, marginTop: i ? 6 : 0, fontWeight: t.role === "user" ? "600" : "400" }}>{t.role === "user" ? `You: ${t.text}` : t.text}</Text>
          ))}
          {thinking ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}><ActivityIndicator size="small" color={colors.green} /><Muted>Working on it…</Muted></View> : null}
        </Card>
      ) : null}
      {spent ? <AllowanceBanner message={spent} onClose={() => setSpent(null)} /> : null}
      {chatError ? <ErrorNote>{chatError}</ErrorNote> : null}
      {market !== "forex" && !answer ? <Row style={{ flexWrap: "wrap", marginBottom: 6 }}>{SORTS.map(([k, l]) => <Pill key={k} active={sort === k} onPress={() => setSort(k)}>{l}</Pill>)}</Row> : null}

      {res.error ? <ErrorNote>{res.error}</ErrorNote> : null}
      {!answer && !res.loaded ? <Loading /> : rows.length === 0 ? <Empty title="No matches" text="Try a different search." /> : (
        <>
          {rows.map((r) => <AssetRow key={`${r.market}:${r.symbol}`} r={r} cur={cur} onPress={() => router.push(`/asset/${r.market}/${encodeURIComponent(r.symbol)}`)} />)}
          {answer ? <Muted style={{ textAlign: "center", marginTop: 8 }}>{answer.matched ?? answer.total} match{(answer.matched ?? answer.total) === 1 ? "" : "es"}{answer.total > rows.length ? ` · showing ${rows.length}` : ""}</Muted> : (res.data?.total ?? 0) > rows.length ? <View style={{ marginTop: 6 }}><Button tone="ghost" onPress={() => setSize((n) => n + 40)}>Show more</Button></View> : <Muted style={{ textAlign: "center", marginTop: 8 }}>{res.data?.total} result{res.data?.total === 1 ? "" : "s"}</Muted>}
        </>
      )}
    </Screen>
    <View style={{ backgroundColor: `${colors.bg}f2`, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}>
      {!turns.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 8 }}>
          {IDEAS.map((q) => <Pill key={q} onPress={() => void send(q)}>{q}</Pill>)}
        </ScrollView>
      ) : null}
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14 }}>
          <Ionicons name="sparkles" size={16} color={colors.green} />
          <TextInput value={ask} onChangeText={setAsk} placeholder="Ask for stocks, e.g. PE under 15 and high ROE" placeholderTextColor={colors.muted} returnKeyType="send" onSubmitEditing={() => void send(ask)} editable={!thinking} maxLength={1000}
            style={{ flex: 1, color: colors.text, fontSize: 14.5, paddingVertical: 11, marginLeft: 8 }} />
        </View>
        <Pressable onPress={() => void send(ask)} disabled={thinking || !ask.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", opacity: thinking || !ask.trim() ? 0.5 : 1 }}>
          {thinking ? <ActivityIndicator size="small" color="#04110b" /> : <Ionicons name="arrow-up" size={20} color="#04110b" />}
        </Pressable>
      </Row>
    </View>
    </KeyboardAvoidingView>
  )
}

function AssetRow({ r, cur, onPress }: { r: ScreenRow; cur: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ paddingVertical: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{r.symbol.replace("=X", "")}</Text>
            <Muted numberOfLines={1}>{r.name}{r.sector ? ` · ${r.sector}` : ""}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{r.price != null ? (cur ? money(r.price, cur) : r.price.toFixed(4)) : "-"}</Text>
            <Text style={{ color: tone(r.chg_1d), fontSize: 12, fontWeight: "700" }}>{pct(r.chg_1d)}</Text>
          </View>
        </Row>
      </Card>
    </Pressable>
  )
}
