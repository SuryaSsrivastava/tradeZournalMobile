import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as SecureStore from "expo-secure-store"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Modal, Pressable, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { Account, JournalTrade } from "./api"
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
export const inScope = (t: JournalTrade, m: Mode, filter: string[]) => inMode(t, m) && (m === "backtest" || filter.length === 0 || filter.includes(t.account_id == null ? "none" : String(t.account_id)))

type Scope = { mode: Mode; filter: string[]; setMode: (m: Mode) => void; setFilter: (f: string[]) => void; select: (a: Account) => void; clear: () => void }
const Ctx = createContext<Scope | null>(null)
export const useScope = () => { const c = useContext(Ctx); if (!c) throw new Error("useScope outside ScopeProvider"); return c }

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ mode: Mode; filter: string[] }>({ mode: "real", filter: [] })
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => {
      const s = v ? JSON.parse(v) : null
      if (s && (s.mode === "real" || s.mode === "manual" || s.mode === "backtest") && Array.isArray(s.filter)) setState({ mode: s.mode, filter: s.filter.map(String) })
    }).catch(() => {})
  }, [])
  const put = useCallback((next: { mode: Mode; filter: string[] }) => { setState(next); SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {}) }, [])
  const value = useMemo<Scope>(() => ({
    ...state,
    setMode: (mode) => put({ mode, filter: [] }),  // an account of one mode means nothing in another
    setFilter: (filter) => put({ mode: state.mode, filter }),
    select: (a) => put({ mode: a.kind === "manual" ? "manual" : "real", filter: [String(a.id)] }),
    clear: () => put({ mode: state.mode, filter: [] }),
  }), [state, put])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** The accounts the current choice covers, for screens that list them (and for the live view). */
export function chosenAccounts(accounts: Account[], mode: Mode, filter: string[]): Account[] {
  const mine = accounts.filter((a) => (a.kind === "manual") === (mode === "manual"))
  return filter.length === 0 ? mine : mine.filter((a) => filter.includes(String(a.id)))
}

/** The dropdown: a button naming what is shown, and a sheet to change it. */
export function ScopeBar({ trades, accounts }: { trades: JournalTrade[]; accounts: Account[] }) {
  const { mode, filter, setMode, setFilter, clear } = useScope()
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const inM = trades.filter((t) => inMode(t, mode))
  const of = (id: string) => inM.filter((t) => (id === "none" ? t.account_id == null : String(t.account_id) === id))
  const sum = (ts: JournalTrade[]) => ts.reduce((a, t) => a + pnlOf(t), 0)
  const options = mode === "backtest" ? [] : [
    ...accounts.filter((a) => (a.kind === "manual") === (mode === "manual")).map((a) => ({ id: String(a.id), label: a.name, prop: a.is_prop, ts: of(String(a.id)) })),
    ...(of("none").length > 0 ? [{ id: "none", label: mode === "manual" ? "No account" : "Imported, no account", prop: false, ts: of("none") }] : []),
  ]
  const hasManual = accounts.some((a) => a.kind === "manual") || trades.some((t) => inMode(t, "manual"))
  const hasReplay = trades.some(isReplay)
  const label = mode === "backtest" ? "Backtested" : filter.length === 0 ? (mode === "manual" ? "All manual accounts" : "All accounts") : filter.length === 1 ? options.find((o) => o.id === filter[0])?.label ?? "1 account" : `${filter.length} accounts`
  const toggle = (id: string) => setFilter(filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id])

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mode === "real" ? colors.green : mode === "manual" ? colors.blue : "#a78bfa" }} />
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700", maxWidth: 220 }}>{label}</Text>
        <Ionicons name="chevron-down" size={15} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#000000aa" }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.lg + 6, borderTopRightRadius: radius.lg + 6, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 16, maxHeight: "78%" }}>
          <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Show data from</Text>
          {hasManual || hasReplay ? (
            <Row style={{ flexWrap: "wrap" }}>
              <Pill active={mode === "real"} onPress={() => setMode("real")}>Real trading</Pill>
              {hasManual ? <Pill active={mode === "manual"} onPress={() => setMode("manual")} color={colors.blue}>Manual journal</Pill> : null}
              {hasReplay ? <Pill active={mode === "backtest"} onPress={() => setMode("backtest")} color="#a78bfa">Backtested</Pill> : null}
            </Row>
          ) : null}
          <ScrollView style={{ marginTop: 6 }}>
            {mode === "backtest" ? <Muted style={{ paddingVertical: 14 }}>Trades taken in Backtest replay sessions: practice on past markets, not real money.</Muted> : (
              <>
                <Option label={mode === "manual" ? "All manual accounts" : "All accounts"} n={inM.length} net={sum(inM)} on={filter.length === 0} onPress={() => { clear(); setOpen(false) }} />
                {options.map((o) => <Option key={o.id} label={o.label} prop={o.prop} n={o.ts.length} net={sum(o.ts)} on={filter.includes(o.id)} onPress={() => toggle(o.id)} />)}
                {options.length > 1 ? <Muted style={{ marginTop: 8, textAlign: "center" }}>Pick one or several accounts.</Muted> : null}
              </>
            )}
          </ScrollView>
          <Pressable onPress={() => { setOpen(false); router.push("/add-account" as never) }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${colors.green}88`, backgroundColor: `${colors.green}12` }}>
            <Ionicons name="add-circle" size={20} color={colors.green} />
            <Text style={{ color: colors.green, fontSize: 14, fontWeight: "800" }}>Add an account</Text>
          </Pressable>
          <View style={{ marginTop: 12 }}><Button onPress={() => setOpen(false)}>Done</Button></View>
        </View>
      </Modal>
    </>
  )
}

function Option({ label, n, net, on, prop, onPress }: { label: string; n: number; net: number; on: boolean; prop?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 12, marginTop: 8, borderRadius: radius.md, borderWidth: 1, borderColor: on ? `${colors.green}88` : colors.border, backgroundColor: on ? `${colors.green}14` : "transparent" }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Row><Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 }}>{label}</Text>{prop ? <Text style={{ color: "#c4b5fd", fontSize: 9.5, fontWeight: "800", marginLeft: 8, letterSpacing: 0.6 }}>PROP</Text> : null}</Row>
        <Muted>{n} trade{n === 1 ? "" : "s"}</Muted>
      </View>
      <Text style={{ color: tone(net), fontSize: 14, fontWeight: "800", marginRight: 10 }}>{money(net, "USD", true)}</Text>
      <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.green : colors.muted} />
    </Pressable>
  )
}
