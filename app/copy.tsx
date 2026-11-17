import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { Alert, Switch, Text, View } from "react-native"
import { api, type CopyEvent, type CopyLink, type CopyPatch } from "../src/api"
import { useAuth } from "../src/auth"
import { ago } from "../src/format"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Field, Label, Loading, Muted, Pill, Row, Screen } from "../src/ui"

type Engine = { reachable: boolean; error: string; trade_enabled: boolean; halted: boolean }

const VERBS: Record<string, [string, string, string, string]> = {  // sent, planned, skipped, failed
  open: ["Opened", "Would open", "Skipped opening", "Failed to open"],
  close: ["Closed", "Would close", "Skipped closing", "Failed to close"],
  modify: ["Changed stops on", "Would change stops on", "Skipped stop change on", "Failed to change stops on"],
  partial: ["Partly closed", "Would partly close", "Skipped partial close of", "Failed to partly close"],
}
const verb = (e: CopyEvent) => {
  const v = VERBS[e.action]
  if (!v) return e.action === "pause" ? "Paused" : "Problem"
  return v[e.status === "sent" ? 0 : e.status === "planned" ? 1 : e.status === "skipped" ? 2 : 3]
}

function stateOf(l: CopyLink, eng: Engine): { text: string; color: string } {
  if (!l.enabled) return { text: "Off", color: colors.muted }
  if (!eng.reachable) return { text: "Engine unreachable", color: colors.red }
  if (eng.halted) return { text: "Halted", color: colors.red }
  const s = l.engine?.state
  if (s === "login_refused") return { text: "Login refused", color: colors.red }
  if (s === "paused") return { text: "Paused: drawdown", color: colors.amber }
  if (s === "running") return l.engine?.dry ? { text: "Running, dry run", color: colors.amber } : { text: "Running, live", color: colors.green }
  return { text: "Connecting…", color: colors.muted }
}

function Settings({ l, save, busy }: { l: CopyLink; save: (b: CopyPatch) => void; busy: boolean }) {
  const [mode, setMode] = useState(l.mode)
  const [value, setValue] = useState(String(l.value))
  const [maxLot, setMaxLot] = useState(String(l.max_lot))
  const [maxOpen, setMaxOpen] = useState(String(l.max_open))
  const [maxDd, setMaxDd] = useState(String(l.max_dd_pct))
  const [sltp, setSltp] = useState(l.copy_sltp)
  const [map, setMap] = useState(Object.entries(l.symbol_map).map(([a, b]) => `${a}=${b}`).join(", "))
  const submit = () => {
    const symbol_map: Record<string, string> = {}
    for (const part of map.split(",")) { const [a, b] = part.split("=").map((x) => x.trim()); if (a && b) symbol_map[a] = b }
    save({ mode, value: +value || l.value, max_lot: +maxLot || l.max_lot, max_open: +maxOpen || l.max_open, max_dd_pct: +maxDd || 0, copy_sltp: sltp, symbol_map })
  }
  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Label>Size</Label>
      <Row>{(["multiplier", "fixed"] as const).map((m) => <Pill key={m} active={mode === m} onPress={() => setMode(m)}>{m === "fixed" ? "Fixed lot" : "Master lot ×"}</Pill>)}</Row>
      <Field label={mode === "fixed" ? "Lot" : "Factor"} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
      <Field label="Max lot per order" value={maxLot} onChangeText={setMaxLot} keyboardType="decimal-pad" />
      <Field label="Max open copies" value={maxOpen} onChangeText={setMaxOpen} keyboardType="number-pad" />
      <Field label="Pause at drawdown % (0 = off)" value={maxDd} onChangeText={setMaxDd} keyboardType="decimal-pad" />
      <Field label="Symbol names that differ (master=follower, …)" value={map} onChangeText={setMap} placeholder="GOLD=XAUUSDm" autoCapitalize="none" autoCorrect={false} />
      <Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Copy stop loss and take profit</Text>
        <Switch value={sltp} onValueChange={setSltp} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
      </Row>
      <Button onPress={submit} busy={busy}>Save settings</Button>
    </View>
  )
}

function LinkCard({ l, eng, events, busy, patch, goLive, closeCopies, remove }: { l: CopyLink; eng: Engine; events: CopyEvent[]; busy: boolean; patch: (l: CopyLink, b: CopyPatch) => void; goLive: (l: CopyLink) => void; closeCopies: (l: CopyLink) => void; remove: (l: CopyLink) => void }) {
  const [open, setOpen] = useState(false)
  const s = stateOf(l, eng)
  const e = l.engine
  const last = events[0]
  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const today = events.filter((x) => new Date(x.at).getTime() >= startOfDay)
  const done = today.filter((x) => x.status === "sent").length
  const failed = today.filter((x) => x.status === "failed").length
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{l.master}</Text>
          <Row style={{ marginVertical: 2 }}><Ionicons name="arrow-down" size={13} color={colors.muted} /><Muted style={{ marginLeft: 4 }}>{l.mode === "fixed" ? `${l.value} lot` : `× ${l.value}`}</Muted></Row>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{l.follower}</Text>
        </View>
        <Switch value={l.enabled} disabled={busy} onValueChange={(v) => patch(l, { enabled: v })} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
      </Row>

      <Row style={{ flexWrap: "wrap", marginTop: 12, gap: 8 }}>
        <Text style={{ color: s.color, fontSize: 12.5, fontWeight: "700" }}>{s.text}</Text>
        <View style={{ backgroundColor: `${l.dry_run ? colors.amber : colors.red}22`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
          <Text style={{ color: l.dry_run ? colors.amber : colors.red, fontSize: 11, fontWeight: "800" }}>{l.dry_run ? "Dry run" : "Live orders"}</Text>
        </View>
        {e ? <Muted>Master {e.master_open} open · Copies {e.copies}{e.master_open === e.copies ? " · In step" : " · Catching up"}</Muted> : null}
      </Row>
      <Muted style={{ marginTop: 4 }}>max {l.max_lot} lot · up to {l.max_open} copies</Muted>
      {e?.detail ? <Text style={{ color: colors.amber, fontSize: 12, marginTop: 4 }}>{e.detail}</Text> : null}
      {last || today.length ? (
        <Muted style={{ marginTop: 6 }}>{last ? `Last: ${verb(last)} ${last.symbol} · ${ago(last.at)}. ` : ""}Today: {done} done{failed ? `, ${failed} failed` : ""}</Muted>
      ) : null}
      {!l.dry_run && l.enabled ? (
        <View style={{ backgroundColor: `${colors.red}18`, borderRadius: 12, padding: 10, marginTop: 10 }}>
          <Text style={{ color: colors.red, fontSize: 12 }}>This link places real orders on {l.follower}{eng.trade_enabled ? "." : ", but trading is off on the reader, so it only records."}</Text>
        </View>
      ) : null}

      <Row style={{ flexWrap: "wrap", marginTop: 12, gap: 8 }}>
        {l.dry_run ? <Pill color={colors.red} onPress={() => goLive(l)}>Go live…</Pill> : <Pill onPress={() => patch(l, { dry_run: true })}>Back to dry run</Pill>}
        <Pill active={open} onPress={() => setOpen(!open)}>Settings</Pill>
        <Pill onPress={() => closeCopies(l)}>Close copies</Pill>
        <Pill color={colors.red} onPress={() => remove(l)}>Remove</Pill>
      </Row>
      {open ? <Settings key={`${l.id}-${l.value}-${l.max_lot}-${l.max_open}`} l={l} busy={busy} save={(b) => patch(l, b)} /> : null}
    </Card>
  )
}

export default function Copy() {
  const { user } = useAuth()
  const ov = useLoad(() => api.copyOverview(), { every: 5000 })
  const ev = useLoad(() => api.copyEvents(), { every: 5000 })
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | "new" | "halt" | null>(null)
  const [master, setMaster] = useState(0)
  const [followers, setFollowers] = useState<number[]>([])
  const [mode, setMode] = useState<"multiplier" | "fixed">("multiplier")
  const [value, setValue] = useState("1")
  const [maxLot, setMaxLot] = useState("0.01")

  if (!user?.is_admin) return <Screen padTop={false}><Empty title="Admins only" text="Copy trading is only for admins." /></Screen>

  const data = ov.data
  const eng = data?.engine
  const accounts = data?.accounts ?? []
  const links = data?.links ?? []
  const events = ev.data ?? []
  const down = !!eng && (!eng.reachable || eng.halted)

  const run = async (key: number | "new" | "halt", fn: () => Promise<{ sync?: { ok: boolean; problems: string[] }; ok?: boolean; error?: string; closed?: number } | void>) => {
    setBusy(key); setNote(null); setErr(null)
    try {
      const r = await fn()
      if (r && r.sync && !r.sync.ok) setNote(`Saved, but the engine did not get it: ${r.sync.problems.join(" ") || "no answer"}`)
      else if (r && r.ok === false) setErr(r.error ?? "The engine did not accept that.")
      else if (r && typeof r.closed === "number") setNote(`Closed ${r.closed} cop${r.closed === 1 ? "y" : "ies"}.`)
      ov.refresh(); ev.refresh()
    } catch (e) { setErr(e instanceof Error ? e.message : "That did not work.") } finally { setBusy(null) }
  }
  const sure = (title: string, text: string, label: string, go: () => void) => Alert.alert(title, text, [{ text: "Cancel", style: "cancel" }, { text: label, style: "destructive", onPress: go }])

  const create = () => run("new", async () => {
    const r = await api.copyCreateMany({ master_id: master, follower_ids: followers, mode, value: +value || 1, max_lot: +maxLot || 0.01 })
    setFollowers([])
    if (r.skipped.length) setNote(`${r.skipped.length} already linked to this master, left as they are.`)
    return r
  })

  return (
    <Screen padTop={false} refreshing={ov.refreshing} onRefresh={() => { ov.refresh(); ev.refresh() }}>
      {ov.error ? <ErrorNote>{ov.error}</ErrorNote> : null}
      {err ? <ErrorNote>{err}</ErrorNote> : null}
      {note ? <Card><Text style={{ color: colors.amber, fontSize: 13 }}>{note}</Text></Card> : null}
      {!ov.loaded ? <Loading /> : null}

      {eng ? (
        <Card style={down ? { borderColor: `${colors.red}88` } : undefined}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{!eng.reachable ? "The copy engine is not reachable." : eng.halted ? "All copying is halted." : "The copy engine is running."}</Text>
          <Muted style={{ marginTop: 4 }}>{!eng.reachable ? eng.error || "Check the MT5 service." : eng.trade_enabled ? "Trading is switched on: a link that is live sends real orders." : "Trading is switched off on the reader: every link only records what it would do."}</Muted>
          <View style={{ marginTop: 12 }}>
            <Button tone={eng.halted ? "primary" : "danger"} disabled={!eng.reachable} busy={busy === "halt"} onPress={() => eng.halted ? void run("halt", () => api.copyHalt(false)) : sure("Stop all copying?", "Every link stops copying until you resume.", "Stop all", () => void run("halt", () => api.copyHalt(true)))}>{eng.halted ? "Resume copying" : "Stop all copying"}</Button>
          </View>
        </Card>
      ) : null}

      <Card>
        <Label>New links</Label>
        {accounts.length < 2 ? <Muted>Connect at least two MT5 accounts.</Muted> : (
          <>
            <Muted style={{ marginBottom: 8 }}>Master (copied from)</Muted>
            <Row style={{ flexWrap: "wrap" }}>{accounts.map((a) => <Pill key={a.id} active={master === a.id} onPress={() => { setMaster(a.id); setFollowers((f) => f.filter((i) => i !== a.id)) }}>{a.name} · #{a.id}</Pill>)}</Row>
            <Muted style={{ marginVertical: 8 }}>Followers (copy) · {followers.length} chosen</Muted>
            <Row style={{ flexWrap: "wrap" }}>{accounts.filter((a) => a.id !== master).map((a) => <Pill key={a.id} active={followers.includes(a.id)} onPress={() => setFollowers((f) => f.includes(a.id) ? f.filter((i) => i !== a.id) : [...f, a.id])}>{a.name} · #{a.id}</Pill>)}</Row>
            <Muted style={{ marginVertical: 8 }}>Size</Muted>
            <Row>{(["multiplier", "fixed"] as const).map((m) => <Pill key={m} active={mode === m} onPress={() => setMode(m)}>{m === "fixed" ? "Fixed lot" : "Master lot ×"}</Pill>)}</Row>
            <Row style={{ gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}><Field label={mode === "fixed" ? "Lot" : "Factor"} value={value} onChangeText={setValue} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Max lot per order" value={maxLot} onChangeText={setMaxLot} keyboardType="decimal-pad" /></View>
            </Row>
            <Button disabled={!master || !followers.length} busy={busy === "new"} onPress={create}>{followers.length > 1 ? `Add ${followers.length} links` : "Add link"}</Button>
          </>
        )}
        <Muted style={{ marginTop: 10 }}>A new link starts off and in dry run. Symbols are matched by name without the broker's suffix, so XAUUSDm on one broker finds XAUUSD or XAUUSDpro on another.</Muted>
      </Card>

      {ov.loaded && links.length === 0 ? <Empty title="No links yet" text="Choose a master and one or more followers above. The first test is best on two demo accounts, in dry run." /> : null}
      {eng ? links.map((l) => (
        <LinkCard
          key={l.id} l={l} eng={eng} events={events.filter((x) => x.link_id === l.id)} busy={busy === l.id}
          patch={(x, b) => void run(x.id, () => api.copyUpdate(x.id, b))}
          goLive={(x) => sure("Send real orders?", `Every trade ${x.master} opens will be placed on ${x.follower}.`, "Go live", () => void run(x.id, () => api.copyUpdate(x.id, { dry_run: false, confirm_live: true })))}
          closeCopies={(x) => sure("Close copies?", `Close every copy ${x.master} → ${x.follower} opened on ${x.follower}? Trades you opened yourself there are not touched.`, "Close copies", () => void run(x.id, () => api.copyCloseCopies(x.id)))}
          remove={(x) => sure("Remove this link?", "Copies it opened stay open on the follower; close them first if they should go.", "Remove", () => void run(x.id, () => api.copyDelete(x.id)))}
        />
      )) : null}

      {events.length ? (
        <Card>
          <Label>Recent activity</Label>
          {events.slice(0, 20).map((x, i) => {
            const c = x.status === "failed" ? colors.red : x.status === "sent" ? colors.green : colors.muted
            return (
              <View key={x.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
                <Text style={{ color: c, fontSize: 13, fontWeight: "700" }}>{verb(x)} {x.symbol}{x.volume ? ` · ${x.volume} lot` : ""}</Text>
                <Muted>{ago(x.at)}{x.detail ? ` · ${x.detail}` : ""}</Muted>
              </View>
            )
          })}
        </Card>
      ) : null}
    </Screen>
  )
}
