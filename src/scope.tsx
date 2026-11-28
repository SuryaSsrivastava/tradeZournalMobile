import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as SecureStore from "expo-secure-store"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { Account, JournalTrade } from "./api"
import { IconChip } from "./fx"
import { money } from "./format"
import { pnlOf } from "./journal"
import { colors, radius } from "./theme"
import { Button, Muted, Pill, Row, tone } from "./ui"

/** What the Home and Journal screens show, as on the website: real trading, a manual journal, or backtested (replay) trades, and for the first two one or several accounts. */
export type Mode = "real" | "manual" | "backtest"
const KEY = "tz.scope"
const isReplay = (t: JournalTrade) => t.source === "replay"

export const inMode = (t: JournalTrade, m: Mode) => (m === "backtest" ? isReplay(t) : !isReplay(t) && (m === "manual" ? !!t.manual : !t.manual))
/** `filter` holds account ids as text, plus "none" for trades logged by hand with no account. Empty means every account. */
export const inScope = (t: JournalTrade, m: Mode, filter: string[], demo = false) => inMode(t, m) && (m === "backtest" || (demoShown(t, filter, demo) && (filter.length === 0 || filter.includes(t.account_id == null ? "none" : String(t.account_id)))))
/** A trade on a demo account is shown only when demo accounts are included, or when its account was picked by name (as on the website). */
const demoShown = (t: JournalTrade, filter: string[], demo: boolean) => !t.demo || demo || (t.account_id != null && filter.includes(String(t.account_id)))

type Scope = { mode: Mode; filter: string[]; demo: boolean; setDemo: (on: boolean) => void; setMode: (m: Mode) => void; setFilter: (f: string[]) => void; select: (a: Account) => void; clear: () => void }
const Ctx = createContext<Scope | null>(null)
export const useScope = () => { const c = useContext(Ctx); if (!c) throw new Error("useScope outside ScopeProvider"); return c }

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ mode: Mode; filter: string[]; demo: boolean }>({ mode: "real", filter: [], demo: false })
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => {
      const s = v ? JSON.parse(v) : null
      if (s && (s.mode === "real" || s.mode === "manual" || s.mode === "backtest") && Array.isArray(s.filter)) setState({ mode: s.mode, filter: s.filter.map(String), demo: s.demo === true })
    }).catch(() => {})
  }, [])
  const put = useCallback((next: { mode: Mode; filter: string[]; demo: boolean }) => { setState(next); SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {}) }, [])
  const value = useMemo<Scope>(() => ({
    ...state,
    setMode: (mode) => put({ ...state, mode, filter: [] }),  // an account of one mode means nothing in another
    setFilter: (filter) => put({ ...state, filter }),
    setDemo: (demo) => put({ ...state, demo }),
    select: (a) => put({ ...state, mode: a.kind === "manual" ? "manual" : "real", filter: [String(a.id)] }),
    clear: () => put({ ...state, filter: [] }),
  }), [state, put])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Whether an account's own data (its open trades) is shown: the accounts picked, or with none picked every one but the demo ones, unless demo accounts are included. */
export const accountShown = (a: Account, filter: string[], demo: boolean) => (filter.length ? filter.includes(String(a.id)) : !a.is_demo || demo)

/** The accounts the current choice covers, for screens that list them (and for the live view). */
export function chosenAccounts(accounts: Account[], mode: Mode, filter: string[], demo = false): Account[] {
  const mine = accounts.filter((a) => (a.kind === "manual") === (mode === "manual"))
  return filter.length === 0 ? mine.filter((a) => !a.is_demo || demo) : mine.filter((a) => filter.includes(String(a.id)))  // demo accounts are left out unless included or picked by name
}

/** The dropdown: a button naming what is shown, and a sheet to change it. */
export function ScopeBar({ trades, accounts }: { trades: JournalTrade[]; accounts: Account[] }) {
  const { mode, filter, demo, setDemo, setMode, setFilter, clear } = useScope()
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inM = trades.filter((t) => inMode(t, mode))
  const visible = inM.filter((t) => demoShown(t, [], demo))  // what "All accounts" covers: demo accounts only when included
  const of = (id: string) => inM.filter((t) => (id === "none" ? t.account_id == null : String(t.account_id) === id))
  const sum = (ts: JournalTrade[]) => ts.reduce((a, t) => a + pnlOf(t), 0)
  const options = mode === "backtest" ? [] : [
    ...accounts.filter((a) => (a.kind === "manual") === (mode === "manual")).map((a) => ({ id: String(a.id), label: a.name, prop: a.is_prop, demo: !!a.is_demo, ts: of(String(a.id)) })),
    ...(of("none").length > 0 ? [{ id: "none", label: mode === "manual" ? "No account" : "Imported, no account", prop: false, demo: false, ts: of("none") }] : []),
  ]
  const hasManual = accounts.some((a) => a.kind === "manual") || trades.some((t) => inMode(t, "manual"))
  const hasReplay = trades.some(isReplay)
  const hasDemo = accounts.some((a) => a.is_demo)
  const label = mode === "backtest" ? "Backtested" : filter.length === 0 ? (mode === "manual" ? "All manual accounts" : "All accounts") : filter.length === 1 ? options.find((o) => o.id === filter[0])?.label ?? "1 account" : `${filter.length} accounts`
  const modeColor = mode === "real" ? colors.green : mode === "manual" ? colors.blue : "#a78bfa"
  const toggle = (id: string) => setFilter(filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id])

  const shownNet = filter.length === 0 ? sum(visible) : options.filter((o) => filter.includes(o.id)).reduce((t, o) => t + sum(o.ts), 0)
  const count = (m: Mode) => trades.filter((t) => inMode(t, m)).length
  const modes: [Mode, string, string, boolean][] = [["real", "Real", colors.green, true], ["manual", "Manual", colors.blue, hasManual], ["backtest", "Backtested", "#a78bfa", hasReplay]]

  return (
    <>
      {/* the button, as the web's: a round icon, the name, what the choice adds up to, and a chevron */}
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingLeft: 7, paddingRight: 13, paddingVertical: 6, marginBottom: 12 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${modeColor}26`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={mode === "backtest" ? "flask" : filter.length === 1 ? "wallet" : "layers"} size={14} color={modeColor} />
        </View>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700", maxWidth: 170 }}>{label}</Text>
        {mode !== "backtest" ? <Text style={{ color: tone(shownNet), fontSize: 11.5, fontWeight: "700" }}>{money(shownNet, "USD", true)}</Text> : null}
        <Ionicons name="chevron-down" size={15} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 16, maxHeight: "82%" }}>
          <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 }} />
          <Row style={{ gap: 10, marginBottom: 14 }}>
            <IconChip icon="layers" color={colors.green} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 }}>Show data from</Text>
              <Muted>Home and the journal follow this choice.</Muted>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </Row>

          {hasManual || hasReplay ? (
            <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3, marginBottom: 6 }}>
              {modes.filter((m) => m[3]).map(([m, name, c]) => (
                <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.md - 3, backgroundColor: mode === m ? `${c}26` : "transparent", borderWidth: 1, borderColor: mode === m ? `${c}66` : "transparent" }}>
                  <Text style={{ color: mode === m ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "700" }}>{name}</Text>
                  <Text style={{ color: mode === m ? c : colors.muted, fontSize: 10.5, fontWeight: "700", marginTop: 1 }}>{count(m)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <ScrollView style={{ marginTop: 6 }} showsVerticalScrollIndicator={false}>
            {mode === "backtest" ? <Muted style={{ paddingVertical: 14 }}>Trades taken in Backtest replay sessions: practice on past markets, not real money.</Muted> : (
              <>
                <Option all label={mode === "manual" ? "All manual accounts" : "All accounts"} n={visible.length} net={sum(visible)} on={filter.length === 0} onPress={() => { clear(); setOpen(false) }} />
                {options.map((o) => <Option key={o.id} label={o.label} prop={o.prop} demo={o.demo} n={o.ts.length} net={sum(o.ts)} on={filter.includes(o.id)} onPress={() => toggle(o.id)} />)}
                {options.length > 1 ? <Muted style={{ marginTop: 10, textAlign: "center" }}>Pick one or several accounts.</Muted> : null}
                {hasDemo ? (
                  <Row style={{ gap: 12, marginTop: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                    <IconChip icon="flask" color="#fbbf24" size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Include demo accounts</Text>
                      <Muted style={{ fontSize: 12, lineHeight: 17 }}>Demo trades are left out unless you include them or pick that account.</Muted>
                    </View>
                    <Switch value={demo} onValueChange={setDemo} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
                  </Row>
                ) : null}
              </>
            )}
          </ScrollView>
          <Pressable onPress={() => { setOpen(false); router.push("/add-account" as never) }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${colors.green}88`, backgroundColor: `${colors.green}12` }}>
            <Ionicons name="add-circle" size={20} color={colors.green} />
            <Text style={{ color: colors.green, fontSize: 14, fontWeight: "700" }}>Add an account</Text>
          </Pressable>
          <View style={{ marginTop: 12 }}><Button onPress={() => setOpen(false)}>Done</Button></View>
        </View>
      </Modal>
    </>
  )
}

function Option({ label, n, net, on, prop, demo, all, onPress }: { label: string; n: number; net: number; on: boolean; prop?: boolean; demo?: boolean; all?: boolean; onPress: () => void }) {
  const c = all ? colors.green : prop ? "#a78bfa" : demo ? "#fbbf24" : "#60a5fa"
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, marginTop: 8, borderRadius: radius.md, borderWidth: 1, borderColor: on ? `${colors.green}88` : colors.border, backgroundColor: on ? `${colors.green}14` : colors.card }}>
      <IconChip icon={all ? "layers" : prop ? "briefcase" : demo ? "flask" : "wallet"} color={c} size={34} />
      <View style={{ flex: 1 }}>
        <Row style={{ gap: 7 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: "600", flexShrink: 1 }}>{label}</Text>
          {prop ? <Text style={{ color: "#c4b5fd", fontSize: 9, fontWeight: "700", letterSpacing: 0.6, backgroundColor: "#a78bfa22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: "hidden" }}>PROP</Text> : null}
          {demo ? <Text style={{ color: "#fbbf24", fontSize: 9, fontWeight: "700", letterSpacing: 0.6, backgroundColor: "#fbbf2422", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: "hidden" }}>DEMO</Text> : null}
        </Row>
        <Muted>{n} trade{n === 1 ? "" : "s"}</Muted>
      </View>
      <Text style={{ color: tone(net), fontSize: 14, fontWeight: "700" }}>{money(net, "USD", true)}</Text>
      <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.green : colors.muted} />
    </Pressable>
  )
}
