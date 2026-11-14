import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { api, ApiError, type LlmModel, type Market, type ScreenResult, type ScreenRow } from "../../src/api"
import { Press } from "../../src/fx"
import { money } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { AllowanceBanner } from "../../src/upgrade"
import { listen, voiceAvailable } from "../../src/voice"
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
  const [model, setModel] = useState<string | null>(null)  // null: the server's own choice
  const [picking, setPicking] = useState(false)
  const models = useLoad(() => api.llmModels())
  const choices = models.data?.available ? models.data.models : []
  const current = choices.find((m) => m.id === (model ?? models.data?.default))
  const [canVoice] = useState(() => voiceAvailable())
  const [hearing, setHearing] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const stopListening = useRef<(() => void) | null>(null)
  useEffect(() => () => { stopListening.current?.() }, [])
  const mic = async () => {
    if (hearing) { stopListening.current?.(); return }
    setVoiceNote(null)
    const base = ask.trim()
    setHearing(true)
    const stop = await listen({
      onText: (t) => setAsk(base ? `${base} ${t}` : t),
      onEnd: () => { setHearing(false); stopListening.current = null },
      onError: (m) => { setVoiceNote(m); setHearing(false) },
    })
    if (stop) stopListening.current = stop
    else setHearing(false)
  }
  useEffect(() => { setAnswer(null); setTurns([]); setChatError(null) }, [market])
  const send = async (text: string) => {
    const message = text.trim()
    if (!message || thinking) return
    setAsk(""); setChatError(null); setSpent(null); setThinking(true)
    const history = turns.slice(-6)
    setTurns((t) => [...t, { role: "user", text: message }])
    try {
      const r = await api.screenChat(market, message, history, model)
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
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
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
      {voiceNote ? <Text style={{ color: colors.red, fontSize: 12, marginBottom: 6 }}>{voiceNote}</Text> : null}
      {choices.length ? (
        <Pressable onPress={() => setPicking(true)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginBottom: 8 }}>
          <Ionicons name="hardware-chip-outline" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{current?.label ?? "Choose a model"}</Text>
          <Ionicons name="chevron-up" size={12} color={colors.muted} />
        </Pressable>
      ) : null}
      {!turns.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 8 }}>
          {IDEAS.map((q) => <Pill key={q} onPress={() => void send(q)}>{q}</Pill>)}
        </ScrollView>
      ) : null}
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14 }}>
          <Ionicons name="sparkles" size={16} color={colors.green} />
          <TextInput value={ask} onChangeText={setAsk} placeholder={hearing ? "Listening…" : "Ask for stocks, e.g. PE under 15 and high ROE"} placeholderTextColor={colors.muted} returnKeyType="send" onSubmitEditing={() => void send(ask)} editable={!thinking} maxLength={1000}
            style={{ flex: 1, color: colors.text, fontSize: 14.5, paddingVertical: 11, marginLeft: 8 }} />
        </View>
        {canVoice ? (
          <Pressable onPress={() => void mic()} disabled={thinking} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hearing ? colors.red : colors.card, borderWidth: 1, borderColor: hearing ? colors.red : colors.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={hearing ? "stop" : "mic-outline"} size={20} color={hearing ? "#fff" : colors.text} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => void send(ask)} disabled={thinking || !ask.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", opacity: thinking || !ask.trim() ? 0.5 : 1 }}>
          {thinking ? <ActivityIndicator size="small" color="#04110b" /> : <Ionicons name="arrow-up" size={20} color="#04110b" />}
        </Pressable>
      </Row>
    </View>
    <ModelSheet open={picking} models={choices} selected={current?.id} onPick={(id) => { setModel(id); setPicking(false) }} onClose={() => setPicking(false)} />
    </KeyboardAvoidingView>
  )
}

/** The models the member may ask with: the same list as the website, with what each costs in AI requests; premium ones are greyed out on a plan without them. */
function ModelSheet({ open, models, selected, onPick, onClose }: { open: boolean; models: LlmModel[]; selected?: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 28, maxHeight: "70%" }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 4 }}>Choose a model</Text>
        <Muted style={{ marginBottom: 10 }}>Bigger models cost more AI requests per question.</Muted>
        <ScrollView>
          {models.map((m) => (
            <Pressable key={m.id} onPress={() => (m.locked ? undefined : onPick(m.id))} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, opacity: m.locked ? 0.5 : 1 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{m.label}</Text>
                <Muted>{m.locked ? "Needs a plan with premium models" : m.note || (m.tier ?? "")}</Muted>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginRight: 10 }}>{m.cost} {m.cost === 1 ? "request" : "requests"}</Text>
              {m.locked ? <Ionicons name="lock-closed" size={16} color={colors.muted} /> : <Ionicons name={m.id === selected ? "radio-button-on" : "radio-button-off"} size={20} color={m.id === selected ? colors.green : colors.muted} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
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
