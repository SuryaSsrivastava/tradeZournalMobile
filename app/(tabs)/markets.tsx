import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, LayoutAnimation, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { useAuth } from "../../src/auth"
import { api, ApiError, type LlmModel, type Market, type ScreenResult, type ScreenRow, type ScreenSpec } from "../../src/api"
import { Press } from "../../src/fx"
import { quote } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { AiReply, AskBubble, parseReply, specChips } from "../../src/answer"
import { AllowanceBanner } from "../../src/upgrade"
import { LANGUAGES, ROOM_FOR_REPLY_NOTE, replyIn, type Language } from "../../src/languages"
import { useLang, useT } from "../../src/i18n"
import { hush } from "../../src/speak"
import { listen, voiceAvailable } from "../../src/voice"
import { colors, radius } from "../../src/theme"
import { SwipeRow } from "../../src/swipe"
import { useHint } from "../../src/swipehint"
import { showToast } from "../../src/toast"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title, tone } from "../../src/ui"

const MARKETS: [Market, string, string][] = [["nse", "m_nse", "INR"], ["us", "m_us", "USD"], ["crypto", "m_crypto", "USD"], ["forex", "m_forex", ""]]  // the middle one is the key of its translated name
const SORTS: [string, string, { field: string; dir: "asc" | "desc" }][] = [
  ["top", "s_top", { field: "market_cap", dir: "desc" }],
  ["gain", "s_gain", { field: "chg_1d", dir: "desc" }],
  ["lose", "s_lose", { field: "chg_1d", dir: "asc" }],
  ["year", "s_year", { field: "ret_1y", dir: "desc" }],
]
const IDEAS = ["idea1", "idea2", "idea3", "idea4"]  // what to try first
const FOLLOW = ["f1", "f2", "f3", "f4"]  // what to try next, once there is an answer
type Rule = { field: string; label: string; op: "gt" | "lt"; value: number }
type Turn = { role: "user" | "assistant"; text: string; spec?: ScreenSpec }
// what the screener holds for this run of the app: the screen is drawn again when the theme changes, and the conversation must survive that
const kept: Record<string, unknown> = {}
let keptFor: number | undefined
function useKept<T>(key: string, init: T) {
  const [v, set] = useState<T>(() => (key in kept ? (kept[key] as T) : init))
  const setKept = useCallback((x: T | ((p: T) => T)) => set((p) => { const n = typeof x === "function" ? (x as (p: T) => T)(p) : x; kept[key] = n; return n }), [key])
  return [v, setKept] as const
}
const pct = (n: number | null | undefined) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)

export default function Markets() {
  const router = useRouter()
  const t = useT()
  const { user } = useAuth()
  if (keptFor !== user?.id) { for (const k of Object.keys(kept)) delete kept[k]; keptFor = user?.id }  // another member never sees the last one's conversation
  const [market, setMarket] = useKept<Market>("market", "nse")
  const [sort, setSort] = useState("top")
  const [text, setText] = useState("")
  const [search, setSearch] = useState("")
  const [size, setSize] = useState(40)
  // the manual filters: rules on a number (P/E under 20) and sectors, which need no AI
  const [rules, setRules] = useKept<Rule[]>("rules", [])
  const [sectorSel, setSectorSel] = useKept<string[]>("sectors", [])
  const [filtering, setFiltering] = useState(false)
  const manual = useMemo(() => [...rules.map((x) => ({ field: x.field, op: x.op, value: x.value })), ...(sectorSel.length ? [{ field: "sector", op: "in", value: sectorSel.map((x) => x.toLowerCase()) }] : [])], [rules, sectorSel])
  const manualKey = JSON.stringify(manual)
  useEffect(() => { const t = setTimeout(() => setSearch(text.trim()), 350); return () => clearTimeout(t) }, [text])
  useEffect(() => setSize(40), [market, sort, search, manualKey])

  // crypto and forex have no market cap: their default order is the server's own
  const by = SORTS.find((s) => s[0] === sort)![2]
  const sortSpec = sort === "top" && (market === "crypto" || market === "forex") ? null : by
  // the chat: a plain-English request becomes a screen, and its answer replaces the list below until cleared
  const [turns, setTurns] = useKept<Turn[]>("turns", [])
  const [ask, setAsk] = useKept("ask", "")
  const [thinking, setThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [spent, setSpent] = useKept<string | null>("spent", null)  // the server said the AI allowance is used up: the message it gave
  const [answer, setAnswer] = useKept<ScreenResult | null>("answer", null)
  const [small, setSmall] = useKept("small", false)  // the conversation is folded to one line
  const chatScroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null)
  const fold = (to: boolean) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSmall(to) }
  const [model, setModel] = useKept<string | null>("model", null)  // null: the server's own choice
  const [picking, setPicking] = useState(false)
  const { lang, setLang } = useLang()  // the language of the app, spoken to the mic and asked for in the answers
  const [pickingLang, setPickingLang] = useState(false)
  const chooseLang = (l: Language) => { setLang(l); setPickingLang(false) }
  const fieldNames = useLoad(() => api.screenFields(market), { deps: [market] })  // what each filter is called, for the chips
  const labels = Object.fromEntries((fieldNames.data?.fields ?? []).map((f) => [f.key, f.label]))
  // the watchlist: the member's screened stocks, the same list as on the website (Portfolio, Watchlist)
  const watch = useLoad(() => api.investWatchlist())
  const saved = useMemo(() => new Map((watch.data?.stocks ?? []).map((w) => [`${w.market}:${w.symbol}`, w.id])), [watch.data])
  const canWatch = market === "nse" || market === "us"  // the server keeps stocks of these two markets only
  const [adding, setAdding] = useState(false)
  const swipeHint = useHint("swipe.watch")  // shown to a new member until they have swiped, or dismissed it
  const toggleSaved = async (r: ScreenRow) => {
    const k = `${r.market}:${r.symbol}`
    const id = saved.get(k)
    swipeHint.done()
    const go = async () => {
      try {
        if (id != null) { await api.removeFromWatchlist(id); showToast(t("wl_removed")) } else { await api.addToWatchlist([{ market: r.market, symbol: r.symbol }]); showToast(t("wl_saved")) }
        await watch.refresh()
      } catch (e) { showToast(e instanceof Error ? e.message : "Could not do that.", false) }
    }
    if (id == null) { await go(); return }  // adding needs no question; taking away does
    Alert.alert(t("wl_remove_q", { n: r.symbol.replace("=X", "") }), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("wl_off"), style: "destructive", onPress: () => void go() },
    ])
  }
  // every stock the current screen matches (up to 200), not only the ones loaded on the page
  const addAll = async () => {
    setAdding(true)
    try {
      const spec: ScreenSpec = answer?.spec ?? { filters: manual, sort: sortSpec, search }
      const all = await api.screen(market, spec, 0, 200)
      const r = await api.addToWatchlist(all.rows.map((x) => ({ market: x.market, symbol: x.symbol })))
      showToast(r.added ? t("wl_added", { n: r.added }) : t("wl_have"))
      await watch.refresh()
    } catch (e) { showToast(e instanceof Error ? e.message : "Could not do that.", false) } finally { setAdding(false) }
  }
  // suggestions: written by the server's small model to fit what is on screen (the same as on the website, and not counted against the AI allowance); the fixed ones show until they arrive or if they cannot
  const [sugItems, setSugItems] = useState<string[] | null>(null)
  const [sugBusy, setSugBusy] = useState(false)
  const seenSug = useRef<string[]>([])
  const sugRun = useRef(0)
  const screenText = answer?.spec ? specChips(answer.spec, labels).join(", ") : rules.map((x) => `${x.label} ${x.op === "gt" ? ">" : "<"} ${x.value}`).concat(sectorSel).join(", ")
  const refreshSug = useCallback(async () => {
    const mine = ++sugRun.current
    setSugBusy(true)
    try {
      const context = `market: ${market}; ${screenText ? `current screen: ${screenText}` : "no filter applied yet"}${lang.code === "en" ? "" : `. Write the suggestions in ${lang.name}, in ${lang.name} script.`}`
      const r = await api.suggest("screener", context, turns.slice(-4).map((x) => ({ role: x.role, text: x.text.slice(0, 300) })), seenSug.current)
      if (mine !== sugRun.current) return
      seenSug.current = [...seenSug.current, ...r.items].slice(-12)
      setSugItems(r.items)
    } catch { /* keep what is shown */ } finally { if (mine === sugRun.current) setSugBusy(false) }
  }, [market, screenText, turns, lang])  // eslint-disable-line react-hooks/exhaustive-deps
  const sugKey = `${market}|${turns.length}|${lang.code}`
  useEffect(() => { setSugItems(null) }, [market, lang.code])
  useEffect(() => { if (!thinking) void refreshSug() }, [sugKey, thinking])  // eslint-disable-line react-hooks/exhaustive-deps
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
    hush()  // never talk over the person speaking
    setVoiceNote(null)
    const base = ask.trim()
    setHearing(true)
    const stop = await listen({
      lang: lang.speech,
      onText: (x) => setAsk(base ? `${base} ${x}` : x),
      onEnd: () => { setHearing(false); stopListening.current = null },
      onError: (m) => { setVoiceNote(t(m)); setHearing(false) },
    })
    if (stop) stopListening.current = stop
    else setHearing(false)
  }
  const lastMarket = useRef(market)
  useEffect(() => {
    if (lastMarket.current === market) return  // drawn again with the same market (a theme change): nothing to start over
    lastMarket.current = market
    setAnswer(null); setTurns([]); setChatError(null); setRules([]); setSectorSel([])
  }, [market])
  const send = async (text: string) => {
    const message = text.trim()
    if (!message || thinking) return
    setAsk(""); setChatError(null); setSpent(null); setThinking(true); setSmall(false)
    const history = turns.slice(-6)
    setTurns((p) => [...p, { role: "user", text: message }])
    try {
      const r = await api.screenChat(market, message + replyIn(lang), history, model)
      setTurns((p) => [...p, { role: "assistant", text: r.reply, spec: r.result.spec }])
      setAnswer(r.result)
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setSpent(e.message)
      else setChatError(e instanceof Error ? e.message : "I could not do that. Try again.")
    } finally { setThinking(false) }
  }
  const clearChat = () => { setTurns([]); setAnswer(null); setChatError(null); setSpent(null) }

  const res = useLoad(() => api.screen(market, { filters: manual, sort: sortSpec, search }, 0, size), { deps: [market, sort, search, size, manualKey] })
  const cur = MARKETS.find((m) => m[0] === market)![2]
  const rows = answer ? answer.rows : res.data?.rows ?? []
  const waiting = !answer && !res.loaded
  const showSorts = market !== "forex" && !answer

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
    <Screen avoid={false} refreshing={res.refreshing} onRefresh={res.refresh}>
      <Title brand sub={t("sub")} right={<Press onPress={() => router.push({ pathname: "/invest", params: { tab: "watchlist", at: String(Date.now()) } } as never)}><View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}><Ionicons name="bookmark-outline" size={16} color={colors.text} /><Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{t("watchlist")}</Text></View></Press>}>{t("tab_screener")}</Title>
      <Row style={{ flexWrap: "wrap" }}>{MARKETS.map(([k, l]) => <Pill key={k} active={market === k} onPress={() => setMarket(k)} color={colors.blue}>{t(l)}</Pill>)}</Row>
      <Row style={{ gap: 8, marginVertical: 10 }}>
        <Row style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput value={text} onChangeText={setText} placeholder={t("search")} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12, marginLeft: 8 }} />
          {text ? <Pressable onPress={() => setText("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </Row>
        <Pressable onPress={() => setFiltering(true)} style={{ width: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: manual.length ? `${colors.green}22` : colors.card, borderWidth: 1, borderColor: manual.length ? `${colors.green}66` : colors.border }}>
          <Ionicons name="options" size={20} color={manual.length ? colors.green : colors.text} />
          {manual.length ? <View style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}><Text style={{ color: "#04110b", fontSize: 10.5, fontWeight: "800" }}>{rules.length + (sectorSel.length ? 1 : 0)}</Text></View> : null}
        </Pressable>
      </Row>
      {manual.length && !answer ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {rules.map((x, i) => (
            <Pressable key={i} onPress={() => setRules((p) => p.filter((_, j) => j !== i))} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.green}14`, borderWidth: 1, borderColor: `${colors.green}44`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{x.label} {x.op === "gt" ? ">" : "<"} {x.value}</Text>
              <Ionicons name="close" size={13} color={colors.muted} />
            </Pressable>
          ))}
          {sectorSel.map((x) => (
            <Pressable key={x} onPress={() => setSectorSel((p) => p.filter((y) => y !== x))} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.blue}14`, borderWidth: 1, borderColor: `${colors.blue}44`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{x}</Text>
              <Ionicons name="close" size={13} color={colors.muted} />
            </Pressable>
          ))}
          <Pressable onPress={() => { setRules([]); setSectorSel([]) }} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{t("clear_all")}</Text></Pressable>
          {res.data ? <Text style={{ color: colors.green, fontSize: 12, fontWeight: "800", marginLeft: "auto" }}>{res.data.matched === 1 ? t("count1") : t("count", { n: res.data.matched.toLocaleString() })}</Text> : null}
        </View>
      ) : null}
      {turns.length ? (
        <View style={{ marginVertical: 6 }}>
          <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <Pressable onPress={() => fold(!small)} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Label>{t("yourscreen")}</Label>
              {answer ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${colors.green}1f`, borderWidth: 1, borderColor: `${colors.green}55`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, marginBottom: 6 }}>
                  <Ionicons name="funnel" size={10} color={colors.green} />
                  <Text style={{ color: colors.green, fontSize: 11.5, fontWeight: "800" }}>{(answer.matched ?? answer.total) === 1 ? t("count1") : t("count", { n: (answer.matched ?? answer.total).toLocaleString() })}</Text>
                </View>
              ) : null}
            </Pressable>
            <Row style={{ gap: 18 }}>
              <Pressable onPress={() => fold(!small)} hitSlop={12}><Ionicons name={small ? "expand-outline" : "contract-outline"} size={19} color={colors.green} /></Pressable>
              <Pressable onPress={clearChat} hitSlop={12}><Ionicons name="trash-outline" size={19} color={colors.muted} /></Pressable>
            </Row>
          </Row>
          {small ? (
            <Pressable onPress={() => fold(false)} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: `${colors.green}33`, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 }}>
              <Ionicons name="sparkles" size={14} color={colors.green} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" }}>{parseReply([...turns].reverse().find((x) => x.role === "assistant")?.text ?? "").lead || t("open_chat")}</Text>
              <Ionicons name="expand-outline" size={16} color={colors.muted} />
            </Pressable>
          ) : (
            <ScrollView ref={(r) => { chatScroll.current = r }} nestedScrollEnabled persistentScrollbar showsVerticalScrollIndicator style={{ maxHeight: Dimensions.get("window").height * 0.42 }} contentContainerStyle={{ paddingRight: 4 }}
              onContentSizeChange={() => chatScroll.current?.scrollToEnd({ animated: true })}>
              {turns.map((x, i) => x.role === "user" ? <AskBubble key={i} text={x.text} /> : <View key={i} style={{ marginBottom: 12 }}><AiReply text={x.text} spec={x.spec} labels={labels} /></View>)}
              {thinking ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}><ActivityIndicator size="small" color={colors.green} /><Muted>{t("working")}</Muted></View> : null}
            </ScrollView>
          )}
        </View>
      ) : null}
      {spent ? <AllowanceBanner message={spent} onClose={() => setSpent(null)} /> : null}
      {chatError ? <ErrorNote>{chatError}</ErrorNote> : null}
      {showSorts || canWatch ? (
        <Row style={{ flexWrap: "wrap", marginBottom: 6 }}>
          {showSorts ? SORTS.map(([k, l]) => <Pill key={k} active={sort === k} onPress={() => setSort(k)}>{t(l)}</Pill>) : null}
        </Row>
      ) : null}

      {res.error ? <ErrorNote>{res.error}</ErrorNote> : null}
      {waiting ? <Loading /> : rows.length === 0 ? <Empty title={t("no_match")} text={t("try_other")} /> : (
        <>
          {canWatch && (answer || manual.length > 0) ? <View style={{ marginBottom: 10 }}><Button tone="ghost" busy={adding} onPress={() => void addAll()}>{t("wl_add_all")} · {(answer ? answer.matched ?? answer.total : res.data?.matched ?? rows.length) > 200 ? "200" : String(answer ? answer.matched ?? answer.total : res.data?.matched ?? rows.length)}</Button></View> : null}
          {rows.map((r, i) => <AssetRow key={`${r.market}:${r.symbol}`} r={r} cur={cur} peek={canWatch && swipeHint.show && i === 0} onPeeked={swipeHint.done} saved={canWatch ? saved.has(`${r.market}:${r.symbol}`) : undefined} onSave={canWatch ? () => void toggleSaved(r) : undefined} onPress={() => router.push(`/asset/${r.market}/${encodeURIComponent(r.symbol)}`)} />)}
          {answer ? <Muted style={{ textAlign: "center", marginTop: 8 }}>{answer.matched ?? answer.total} match{(answer.matched ?? answer.total) === 1 ? "" : "es"}{answer.total > rows.length ? ` · showing ${rows.length}` : ""}</Muted> : (res.data?.matched ?? res.data?.total ?? 0) > rows.length ? <View style={{ marginTop: 6 }}><Button tone="ghost" onPress={() => setSize((n) => n + 40)}>{t("show_more")}</Button></View> : <Muted style={{ textAlign: "center", marginTop: 8 }}>{(res.data?.matched ?? res.data?.total ?? 0) === 1 ? t("count1") : t("count", { n: res.data?.matched ?? res.data?.total ?? 0 })}</Muted>}
        </>
      )}
    </Screen>
    <View style={{ backgroundColor: `${colors.bg}f2`, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}>
      {voiceNote ? <Text style={{ color: colors.red, fontSize: 12, marginBottom: 6 }}>{voiceNote}</Text> : null}
      <Row style={{ gap: 18, marginBottom: 8 }}>
        {choices.length ? (
          <Pressable onPress={() => setPicking(true)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="hardware-chip-outline" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{current?.label ?? t("model_title")}</Text>
            <Ionicons name="chevron-up" size={12} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => setPickingLang(true)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="language-outline" size={15} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{lang.native}</Text>
          <Ionicons name="chevron-up" size={12} color={colors.muted} />
        </Pressable>
      </Row>
      {!thinking ? (
        <Row style={{ marginBottom: 8, gap: 4 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {(sugItems ?? (turns.length ? FOLLOW : IDEAS).map((k) => t(k))).map((q) => <Pill key={q} onPress={() => void send(q)}>{q}</Pill>)}
          </ScrollView>
          <Pressable onPress={() => void refreshSug()} disabled={sugBusy} hitSlop={8} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", opacity: sugBusy ? 0.5 : 1 }}>
            {sugBusy ? <ActivityIndicator size="small" color={colors.green} /> : <Ionicons name="shuffle" size={19} color={colors.muted} />}
          </Pressable>
        </Row>
      ) : null}
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14 }}>
          <Ionicons name="sparkles" size={16} color={colors.green} />
          <TextInput value={ask} onChangeText={setAsk} placeholder={hearing ? t("listening") : t("ask")} placeholderTextColor={colors.muted} returnKeyType="send" onSubmitEditing={() => void send(ask)} editable={!thinking} maxLength={1000 - ROOM_FOR_REPLY_NOTE}
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
    <FilterSheet open={filtering} fields={(fieldNames.data?.fields ?? []).filter((f) => f.kind !== "text")} sectors={fieldNames.data?.sectors ?? []} rules={rules} sectorSel={sectorSel} onApply={(rs, ss) => { setRules(rs); setSectorSel(ss); setFiltering(false) }} onClose={() => setFiltering(false)} />
    <LanguageSheet open={pickingLang} selected={lang.code} onPick={chooseLang} onClose={() => setPickingLang(false)} />
    <ModelSheet open={picking} models={choices} selected={current?.id} onPick={(id) => { setModel(id); setPicking(false) }} onClose={() => setPicking(false)} />
    </KeyboardAvoidingView>
  )
}

/**
 * Screen by hand, no AI: pick a measure (P/E, ROE, 1Y return...), say above or below, give a number, and add it as a rule; pick sectors to keep. The rules are sent to the same screener the chat
 * uses, so the list follows them at once and nothing counts against the AI allowance.
 */
function FilterSheet({ open, fields, sectors, rules, sectorSel, onApply, onClose }: { open: boolean; fields: { key: string; label: string }[]; sectors: string[]; rules: Rule[]; sectorSel: string[]; onApply: (r: Rule[], s: string[]) => void; onClose: () => void }) {
  const t = useT()
  const [draft, setDraft] = useState<Rule[]>(rules)
  const [sel, setSel] = useState<string[]>(sectorSel)
  const [field, setField] = useState<string | null>(null)
  const [op, setOp] = useState<"gt" | "lt">("gt")
  const [val, setVal] = useState("")
  useEffect(() => { if (open) { setDraft(rules); setSel(sectorSel); setField(null); setVal("") } }, [open])  // eslint-disable-line react-hooks/exhaustive-deps
  const num = Number(val.replace(",", "."))
  const ok = !!field && val.trim() !== "" && Number.isFinite(num)
  const add = () => {
    if (!ok || !field) return
    const label = fields.find((f) => f.key === field)?.label ?? field
    setDraft((d) => [...d.filter((x) => !(x.field === field && x.op === op)), { field, label, op, value: num }])
    setVal(""); setField(null)
  }
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 24, maxHeight: "85%" }}>
        <Row style={{ justifyContent: "space-between", marginBottom: 2 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{t("filters")}</Text>
          <Pressable onPress={() => { setDraft([]); setSel([]) }} hitSlop={10}><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{t("clear_all")}</Text></Pressable>
        </Row>
        <Muted style={{ marginBottom: 10 }}>{t("free_note")}</Muted>
        <ScrollView keyboardShouldPersistTaps="handled">
          {draft.length ? (
            <View style={{ marginBottom: 12 }}>
              <Label>{t("your_rules")}</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {draft.map((x, i) => (
                  <Pressable key={i} onPress={() => setDraft((d) => d.filter((_, j) => j !== i))} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.green}14`, borderWidth: 1, borderColor: `${colors.green}44`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{x.label} {x.op === "gt" ? ">" : "<"} {x.value}</Text>
                    <Ionicons name="close" size={13} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <Label>{t("add_rule")}</Label>
          <Muted style={{ marginBottom: 8 }}>{t("pick_field")}</Muted>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {fields.map((f) => <Pill key={f.key} active={field === f.key} onPress={() => setField(f.key)} color={colors.green}>{f.label}</Pill>)}
          </View>
          {sectors.length ? (
            <View style={{ marginTop: 6 }}>
              <Label>{t("sector")}</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {sectors.map((x) => <Pill key={x} active={sel.includes(x)} onPress={() => setSel((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]))} color={colors.blue}>{x}</Pill>)}
              </View>
            </View>
          ) : null}
        </ScrollView>
        {field ? (
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: colors.green, fontSize: 13.5, fontWeight: "800" }}>{fields.find((f) => f.key === field)?.label ?? field}</Text>
              <Pressable onPress={() => { setField(null); setVal("") }} hitSlop={10}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
            </Row>
            <Row style={{ gap: 8 }}>
              <Row style={{ backgroundColor: `${colors.border}66`, borderRadius: radius.pill, padding: 3 }}>
                {(["gt", "lt"] as const).map((o) => (
                  <Pressable key={o} onPress={() => setOp(o)} style={{ width: 44, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: op === o ? colors.card : "transparent" }}>
                    <Text style={{ color: op === o ? colors.text : colors.muted, fontSize: 17, fontWeight: "800" }}>{o === "gt" ? ">" : "<"}</Text>
                  </Pressable>
                ))}
              </Row>
              <TextInput autoFocus value={val} onChangeText={setVal} placeholder={t("value")} placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" onSubmitEditing={add} style={{ flex: 1, color: colors.text, fontSize: 15, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 }} />
              <Pressable onPress={add} disabled={!ok} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", opacity: ok ? 1 : 0.4 }}>
                <Ionicons name="add" size={22} color="#04110b" />
              </Pressable>
            </Row>
          </View>
        ) : null}
        <View style={{ marginTop: 12 }}><Button onPress={() => onApply(draft, sel)}>{t("apply")}</Button></View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** The language to speak and to be answered in. The AI is asked to reply in it; stock names and numbers stay as they are. */
function LanguageSheet({ open, selected, onPick, onClose }: { open: boolean; selected: string; onPick: (l: Language) => void; onClose: () => void }) {
  const t = useT()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 28, maxHeight: "70%" }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 4 }}>{t("lang_title")}</Text>
        <Muted style={{ marginBottom: 10 }}>{t("lang_sub")}</Muted>
        <ScrollView>
          {LANGUAGES.map((l) => (
            <Pressable key={l.code} onPress={() => onPick(l)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" }}>{l.native}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, marginRight: 10 }}>{l.name}</Text>
              <Ionicons name={l.code === selected ? "radio-button-on" : "radio-button-off"} size={20} color={l.code === selected ? colors.green : colors.muted} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

/** The models the member may ask with: the same list as the website, with what each costs in AI requests; premium ones are greyed out on a plan without them. */
function ModelSheet({ open, models, selected, onPick, onClose }: { open: boolean; models: LlmModel[]; selected?: string; onPick: (id: string) => void; onClose: () => void }) {
  const t = useT()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: colors.border, padding: 16, paddingBottom: 28, maxHeight: "70%" }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 4 }}>{t("model_title")}</Text>
        <Muted style={{ marginBottom: 10 }}>{t("model_sub")}</Muted>
        <ScrollView>
          {models.map((m) => (
            <Pressable key={m.id} onPress={() => (m.locked ? undefined : onPick(m.id))} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, opacity: m.locked ? 0.5 : 1 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 }}>{m.label}</Text>
                  {m.premium ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${colors.amber}22`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Ionicons name="diamond" size={11} color={colors.amber} /><Text style={{ color: colors.amber, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 }}>{t("premium")}</Text></View> : null}
                </View>
                <Muted>{m.locked ? t("not_in_plan") : m.note || (m.tier ?? "")}</Muted>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginRight: 10 }}>{m.cost === 1 ? t("req1") : t("req", { n: m.cost })}</Text>
              {m.locked ? <Ionicons name="lock-closed" size={16} color={colors.muted} /> : <Ionicons name={m.id === selected ? "radio-button-on" : "radio-button-off"} size={20} color={m.id === selected ? colors.green : colors.muted} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

function AssetRow({ r, cur, saved, peek, onPeeked, onSave, onPress }: { r: ScreenRow; cur: string; saved?: boolean; peek?: boolean; onPeeked?: () => void; onSave?: () => void; onPress: () => void }) {
  const t = useT()
  const body = (
    <Pressable onPress={onPress}>
      <Card style={{ paddingVertical: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Row style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{r.symbol.replace("=X", "")}</Text>
              {saved ? <Ionicons name="bookmark" size={13} color={colors.amber} /> : null}
            </Row>
            <Muted numberOfLines={1}>{r.name}{r.sector ? ` · ${r.sector}` : ""}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{r.price != null ? (cur ? quote(r.price, cur) : r.price.toFixed(4)) : "-"}</Text>
            <Text style={{ color: tone(r.chg_1d), fontSize: 12, fontWeight: "700" }}>{pct(r.chg_1d)}</Text>
          </View>
        </Row>
      </Card>
    </Pressable>
  )
  // swipe right: add to the watchlist (or take it off, when it is already there)
  return onSave ? (
    <SwipeRow peek={peek} onPeeked={onPeeked} right={{ label: saved ? t("wl_off") : t("wl_short"), icon: saved ? "bookmark" : "bookmark-outline", color: saved ? colors.red : colors.amber, run: onSave }}>{body}</SwipeRow>
  ) : body
}
