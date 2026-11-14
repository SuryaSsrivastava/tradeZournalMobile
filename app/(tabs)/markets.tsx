import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Dimensions, KeyboardAvoidingView, LayoutAnimation, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { api, ApiError, type LlmModel, type Market, type ScreenResult, type ScreenRow, type ScreenSpec } from "../../src/api"
import { Press } from "../../src/fx"
import { money } from "../../src/format"
import { useLoad } from "../../src/hooks"
import { AiReply, AskBubble, parseReply } from "../../src/answer"
import { AllowanceBanner } from "../../src/upgrade"
import { LANGUAGES, ROOM_FOR_REPLY_NOTE, replyIn, type Language } from "../../src/languages"
import { useLang, useT } from "../../src/i18n"
import { hush } from "../../src/speak"
import { listen, voiceAvailable } from "../../src/voice"
import { colors, radius } from "../../src/theme"
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
type Turn = { role: "user" | "assistant"; text: string; spec?: ScreenSpec }
const pct = (n: number | null | undefined) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)

export default function Markets() {
  const router = useRouter()
  const t = useT()
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
  const [small, setSmall] = useState(false)  // the conversation is folded to one line
  const chatScroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null)
  const fold = (to: boolean) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSmall(to) }
  const [model, setModel] = useState<string | null>(null)  // null: the server's own choice
  const [picking, setPicking] = useState(false)
  const { lang, setLang } = useLang()  // the language of the app, spoken to the mic and asked for in the answers
  const [pickingLang, setPickingLang] = useState(false)
  const chooseLang = (l: Language) => { setLang(l); setPickingLang(false) }
  const fieldNames = useLoad(() => api.screenFields(market), { deps: [market] })  // what each filter is called, for the chips
  const labels = Object.fromEntries((fieldNames.data?.fields ?? []).map((f) => [f.key, f.label]))
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
  useEffect(() => { setAnswer(null); setTurns([]); setChatError(null) }, [market])
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

  const res = useLoad(() => api.screen(market, { filters: [], sort: sortSpec, search }, 0, size), { deps: [market, sort, search, size] })
  const cur = MARKETS.find((m) => m[0] === market)![2]
  const rows = answer ? answer.rows : res.data?.rows ?? []

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      <Title brand sub={t("sub")} right={<Press onPress={() => router.push("/calendar")}><View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}><Ionicons name="calendar-outline" size={16} color={colors.text} /><Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{t("calendar")}</Text></View></Press>}>{t("tab_screener")}</Title>
      <Row style={{ flexWrap: "wrap" }}>{MARKETS.map(([k, l]) => <Pill key={k} active={market === k} onPress={() => setMarket(k)} color={colors.blue}>{t(l)}</Pill>)}</Row>
      <Row style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginVertical: 10 }}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput value={text} onChangeText={setText} placeholder={t("search")} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12, marginLeft: 8 }} />
        {text ? <Pressable onPress={() => setText("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </Row>
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
      {market !== "forex" && !answer ? <Row style={{ flexWrap: "wrap", marginBottom: 6 }}>{SORTS.map(([k, l]) => <Pill key={k} active={sort === k} onPress={() => setSort(k)}>{t(l)}</Pill>)}</Row> : null}

      {res.error ? <ErrorNote>{res.error}</ErrorNote> : null}
      {!answer && !res.loaded ? <Loading /> : rows.length === 0 ? <Empty title={t("no_match")} text={t("try_other")} /> : (
        <>
          {rows.map((r) => <AssetRow key={`${r.market}:${r.symbol}`} r={r} cur={cur} onPress={() => router.push(`/asset/${r.market}/${encodeURIComponent(r.symbol)}`)} />)}
          {answer ? <Muted style={{ textAlign: "center", marginTop: 8 }}>{answer.matched ?? answer.total} match{(answer.matched ?? answer.total) === 1 ? "" : "es"}{answer.total > rows.length ? ` · showing ${rows.length}` : ""}</Muted> : (res.data?.total ?? 0) > rows.length ? <View style={{ marginTop: 6 }}><Button tone="ghost" onPress={() => setSize((n) => n + 40)}>{t("show_more")}</Button></View> : <Muted style={{ textAlign: "center", marginTop: 8 }}>{res.data?.total} result{res.data?.total === 1 ? "" : "s"}</Muted>}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 8 }}>
          {(turns.length ? FOLLOW : IDEAS).map((k) => <Pill key={k} onPress={() => void send(t(k))}>{t(k)}</Pill>)}
        </ScrollView>
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
    <LanguageSheet open={pickingLang} selected={lang.code} onPick={chooseLang} onClose={() => setPickingLang(false)} />
    <ModelSheet open={picking} models={choices} selected={current?.id} onPick={(id) => { setModel(id); setPicking(false) }} onClose={() => setPicking(false)} />
    </KeyboardAvoidingView>
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
