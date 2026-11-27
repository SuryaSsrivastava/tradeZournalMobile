import { Ionicons } from "@expo/vector-icons"
import { useState, type ComponentProps, type ReactNode } from "react"
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native"
import { api, type CopyEvent, type CopyLink, type CopyPatch } from "../src/api"
import { useAuth } from "../src/auth"
import { Pulse } from "../src/fx"
import { ago } from "../src/format"
import { useLoad } from "../src/hooks"
import { LinkSettings, ModePick, Tags, flowLabel, modeOf } from "../src/copysettings"
import { colors, radius } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Field, Label, Loading, Muted, Row, Screen } from "../src/ui"

type Engine = { reachable: boolean; error: string; trade_enabled: boolean; halted: boolean }
type IconName = ComponentProps<typeof Ionicons>["name"]

const VIOLET = "#a78bfa"
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
const FILTERS = ["all", "sent", "planned", "skipped", "failed"] as const

const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const dayLabel = (iso: string) => {
  const diff = Math.round((dayKey(new Date()) - dayKey(new Date(iso))) / 86_400_000)
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

function stateOf(l: CopyLink, eng: Engine): { text: string; color: string; running: boolean } {
  if (!l.enabled) return { text: "Off", color: colors.muted, running: false }
  if (!eng.reachable) return { text: "Engine unreachable", color: colors.red, running: false }
  if (eng.halted) return { text: "Halted", color: colors.red, running: false }
  const s = l.engine?.state
  if (s === "login_refused") return { text: "Login refused", color: colors.red, running: false }
  if (s === "paused") return { text: /loss limit/i.test(l.engine?.detail ?? "") ? "Paused: loss limit" : "Paused: drawdown", color: colors.amber, running: false }
  if (s === "running") return l.engine?.dry ? { text: "Recording only", color: colors.amber, running: true } : { text: "Running, live", color: colors.green, running: true }
  return { text: "Connecting…", color: colors.muted, running: false }
}

const Chip = ({ children, color }: { children: ReactNode; color: string }) => (
  <View style={{ backgroundColor: `${color}22`, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
    <Text style={{ color, fontSize: 11, fontWeight: "800" }}>{children}</Text>
  </View>
)

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: `${colors.card}d9`, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: color ?? colors.text, fontSize: 22, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 }}>{value}</Text>
    </View>
  )
}

function Node({ role, name, id, icon, color }: { role: string; name: string; id: number; icon: IconName; color: string }) {
  return (
    <Row style={{ backgroundColor: `${colors.bg}99`, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={18} color={color} /></View>
      <View style={{ marginLeft: 11, flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase" }}>{role}</Text>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: "800" }}>{name}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>#{id}</Text>
    </Row>
  )
}

function Action({ icon, label, onPress, color, active, disabled }: { icon: IconName; label?: string; onPress: () => void; color?: string; active?: boolean; disabled?: boolean }) {
  const c = color ?? colors.text
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: active ? colors.green : color ? `${color}66` : colors.border, backgroundColor: active ? `${colors.green}22` : "transparent", borderRadius: radius.pill, paddingHorizontal: label ? 12 : 10, height: 34, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={15} color={c} />
      {label ? <Text numberOfLines={1} style={{ color: c, fontSize: 12.5, fontWeight: "700" }}>{label}</Text> : null}
    </Pressable>
  )
}

const Selectable = ({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) => (
  <Pressable onPress={onPress} hitSlop={4} style={{ borderWidth: 1, borderColor: on ? colors.green : colors.border, backgroundColor: on ? `${colors.green}22` : "transparent", borderRadius: radius.pill, paddingHorizontal: 13, height: 34, justifyContent: "center", marginRight: 8 }}>
    <Row>
      {on ? <Ionicons name="checkmark" size={14} color={colors.green} style={{ marginRight: 5 }} /> : null}
      <Text style={{ color: on ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "600" }}>{children}</Text>
    </Row>
  </Pressable>
)

/** One row that scrolls sideways, so ten accounts do not grow the card. */
const Strip = ({ children }: { children: ReactNode }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14 }}>{children}</ScrollView>
)

function LinkCard({ l, eng, events, busy, patch, closeCopies, remove }: { l: CopyLink; eng: Engine; events: CopyEvent[]; busy: boolean; patch: (l: CopyLink, b: CopyPatch) => Promise<boolean>; closeCopies: (l: CopyLink) => void; remove: (l: CopyLink) => void }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(false)
  const s = stateOf(l, eng)
  const e = l.engine
  const last = events[0]
  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const today = events.filter((x) => new Date(x.at).getTime() >= startOfDay)
  const done = today.filter((x) => x.status === "sent").length
  const failed = today.filter((x) => x.status === "failed").length
  const inStep = e ? e.master_open === e.copies : null
  return (
    <Card style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Row style={{ flex: 1, gap: 8, flexWrap: "wrap" }}>
          {s.running ? <Pulse color={s.color} size={8} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />}
          <Text style={{ color: s.color, fontSize: 13, fontWeight: "800" }}>{s.text}</Text>
        </Row>
        <Switch value={l.enabled} disabled={busy} onValueChange={(v) => void patch(l, { enabled: v })} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
      </Row>

      <Node role="Master" name={l.master} id={l.master_id} icon="radio-outline" color={colors.blue} />
      <Row style={{ marginVertical: 5, paddingLeft: 27 }}>
        <View style={{ width: 2, height: 22, backgroundColor: `${s.color}88`, borderRadius: 1 }} />
        <Ionicons name="chevron-down" size={14} color={s.color} style={{ marginLeft: -8, marginTop: 14 }} />
        <View style={{ marginLeft: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
          <Text style={{ color: l.reverse ? colors.amber : colors.muted, fontSize: 11, fontWeight: "700" }}>{flowLabel(l)} · max {l.max_lot}</Text>
        </View>
      </Row>
      <Node role="Follower" name={l.follower} id={l.follower_id} icon="copy-outline" color={VIOLET} />
      <Tags l={l} />

      {e ? (
        <Row style={{ gap: 8, marginTop: 12 }}>
          <Tile label="Master" value={String(e.master_open)} />
          <Tile label="Copies" value={String(e.copies)} />
          <Tile label="Status" value={inStep ? "In step" : "Catching up"} color={inStep ? colors.green : colors.amber} />
        </Row>
      ) : null}
      {e?.detail ? <Text style={{ color: colors.amber, fontSize: 12, marginTop: 8 }}>{e.detail}</Text> : null}
      {last || today.length ? <Muted style={{ marginTop: 10 }}>{last ? `Last: ${verb(last)} ${last.symbol} · ${ago(last.at)}  ·  ` : ""}Today {done} done{failed ? `, ${failed} failed` : ""}</Muted> : null}
      {l.enabled ? (
        <Row style={{ backgroundColor: `${colors.red}18`, borderRadius: radius.md, padding: 10, marginTop: 10, alignItems: "flex-start" }}>
          <Ionicons name="warning-outline" size={16} color={colors.red} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ flex: 1, color: colors.red, fontSize: 12 }}>This link places real orders on {l.follower}{eng.trade_enabled ? "." : ", but trading is off on the reader, so it only records."}</Text>
        </Row>
      ) : null}

      <Row style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Action icon="options-outline" label="Settings" active={open} onPress={() => setOpen(!open)} />
        <Action icon="time-outline" label="History" active={history} onPress={() => setHistory(!history)} />
        <Action icon="close-circle-outline" label="Close copies" disabled={busy} onPress={() => closeCopies(l)} />
        <Action icon="trash-outline" color={colors.red} disabled={busy} onPress={() => remove(l)} />
      </Row>
      {history ? <LinkActivity id={l.id} /> : null}
      {open ? <LinkSettings l={l} busy={busy} save={(b) => patch(l, b)} /> : null}
    </Card>
  )
}

function EventRow({ e, first, route }: { e: CopyEvent; first: boolean; route?: string }) {
  const buy = e.side === "buy"
  const bad = e.status === "failed"
  const quiet = e.status === "skipped"
  const icon: IconName = e.action === "open" ? (buy ? "arrow-up" : "arrow-down") : e.action === "close" ? "close" : e.action === "modify" ? "options" : e.action === "partial" ? "cut" : e.action === "pause" ? "pause" : bad ? "warning" : "hourglass"
  const c = bad ? colors.red : quiet ? colors.muted : e.action === "open" ? (buy ? colors.green : colors.red) : colors.blue
  const sc = e.status === "sent" ? colors.green : e.status === "planned" ? colors.blue : bad ? colors.red : colors.muted
  return (
    <Row style={{ alignItems: "flex-start", paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: `${colors.border}99` }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${c}22`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={16} color={c} /></View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Row style={{ flexWrap: "wrap", gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: "700" }}>{verb(e)}</Text>
          {e.symbol ? <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: "600" }}>{e.symbol}</Text> : null}
          {e.side ? <Chip color={buy ? colors.green : colors.red}>{e.side.toUpperCase()}</Chip> : null}
          {e.volume ? <Muted>{e.volume} lot</Muted> : null}
        </Row>
        {route ? <Muted style={{ marginTop: 3 }}>{route}</Muted> : null}
        <Row style={{ marginTop: 3 }}><Chip color={sc}>{e.status}</Chip></Row>
        {e.detail ? <Muted style={{ marginTop: 3 }}>{e.detail}</Muted> : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{clock(e.at)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{ago(e.at)}</Text>
      </View>
    </Row>
  )
}

/** Rows grouped under day headings, 15 at a time. */
function Timeline({ rows, routes }: { rows: CopyEvent[]; routes?: Map<number, string> }) {
  const [shown, setShown] = useState(15)
  let lastDay = ""
  return (
    <>
      {rows.slice(0, shown).map((e, i) => {
        const d = dayLabel(e.at)
        const head = d !== lastDay
        lastDay = d
        return (
          <View key={e.id}>
            {head ? <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase", marginTop: i ? 12 : 14 }}>{d}</Text> : null}
            <EventRow e={e} first={head} route={routes?.get(e.link_id)} />
          </View>
        )
      })}
      {rows.length > shown ? <View style={{ marginTop: 10 }}><Button tone="ghost" onPress={() => setShown(shown + 15)}>Show more</Button></View> : null}
    </>
  )
}

/** One link's own history, loaded when it is opened. */
function LinkActivity({ id }: { id: number }) {
  const ev = useLoad(() => api.copyEvents(id), { every: 5000 })
  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Label>This link's activity</Label>
      {!ev.loaded ? <Loading /> : ev.data && ev.data.length ? <Timeline rows={ev.data} /> : <Muted>Nothing yet. When the master opens, changes or closes a trade, this link records what it copied.</Muted>}
    </View>
  )
}

function Activity({ events, links }: { events: CopyEvent[]; links: CopyLink[] }) {
  const routes = new Map(links.map((l) => [l.id, `${l.master} → ${l.follower}`]))
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all")
  const counts: Record<string, number> = { all: events.length }
  for (const e of events) counts[e.status] = (counts[e.status] ?? 0) + 1
  const rows = filter === "all" ? events : events.filter((e) => e.status === filter)
  return (
    <Card>
      <Label>Activity</Label>
      <Strip>{FILTERS.map((f) => <Selectable key={f} on={filter === f} onPress={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)} {counts[f] ?? 0}</Selectable>)}</Strip>
      {rows.length === 0 ? <Muted style={{ marginTop: 12 }}>{events.length ? `No ${filter} rows.` : "When a master opens, changes or closes a trade, each link records here what it copied."}</Muted> : <Timeline key={filter} rows={rows} routes={routes} />}
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
  const [adding, setAdding] = useState(false)
  const [linksShown, setLinksShown] = useState(5)
  const [master, setMaster] = useState(0)
  const [followers, setFollowers] = useState<number[]>([])
  const [mode, setMode] = useState<CopyLink["mode"]>("multiplier")
  const [value, setValue] = useState("1")
  const [maxLot, setMaxLot] = useState("0.01")

  if (!user?.is_admin) return <Screen padTop={false}><Empty title="Admins only" text="Copy trading is only for admins." /></Screen>

  const data = ov.data
  const eng = data?.engine
  const accounts = data?.accounts ?? []
  const links = data?.links ?? []
  const events = ev.data ?? []
  const down = !!eng && (!eng.reachable || eng.halted)
  const choices = accounts.filter((a) => a.id !== master)
  const allChosen = choices.length > 0 && choices.every((a) => followers.includes(a.id))
  const groups = [...links.reduce((m, l) => m.set(l.master_id, [...(m.get(l.master_id) ?? []), l]), new Map<number, CopyLink[]>()).values()]
  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const sentToday = events.filter((x) => x.status === "sent" && x.action === "open" && new Date(x.at).getTime() >= startOfDay).length
  const sent = events.filter((x) => x.status === "sent").length
  const failedAll = events.filter((x) => x.status === "failed").length
  const success = sent + failedAll ? `${Math.round((sent / (sent + failedAll)) * 100)}%` : "—"

  const run = async (key: number | "new" | "halt", fn: () => Promise<{ sync?: { ok: boolean; problems: string[] }; ok?: boolean; error?: string; closed?: number } | void>): Promise<boolean> => {
    setBusy(key); setNote(null); setErr(null)
    let ok = true
    try {
      const r = await fn()
      if (r && r.sync && !r.sync.ok) setNote(`Saved, but the engine did not get it: ${r.sync.problems.join(" ") || "no answer"}`)
      else if (r && r.ok === false) { setErr(r.error ?? "The engine did not accept that."); ok = false }
      else if (r && typeof r.closed === "number") setNote(`Closed ${r.closed} cop${r.closed === 1 ? "y" : "ies"}.`)
      ov.refresh(); ev.refresh()
    } catch (e) { setErr(e instanceof Error ? e.message : "That did not work."); ok = false } finally { setBusy(null) }
    return ok
  }
  const sure = (title: string, text: string, label: string, go: () => void) => Alert.alert(title, text, [{ text: "Cancel", style: "cancel" }, { text: label, style: "destructive", onPress: go }])

  const create = () => run("new", async () => {
    const r = await api.copyCreateMany({ master_id: master, follower_ids: followers, mode, value: +value || 1, max_lot: +maxLot || 0.01 })
    setFollowers([]); setAdding(false)
    if (r.skipped.length) setNote(`${r.skipped.length} already linked to this master, left as they are.`)
    return r
  })

  return (
    <Screen padTop={false} refreshing={ov.refreshing} onRefresh={() => { ov.refresh(); ev.refresh() }}>
      {ov.error ? <ErrorNote>{ov.error}</ErrorNote> : null}
      {err ? <ErrorNote>{err}</ErrorNote> : null}
      {note ? (
        <Row style={{ backgroundColor: `${colors.amber}18`, borderRadius: radius.md, padding: 12, marginBottom: 12, alignItems: "flex-start" }}>
          <Ionicons name="information-circle-outline" size={17} color={colors.amber} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, color: colors.amber, fontSize: 13 }}>{note}</Text>
        </Row>
      ) : null}
      {!ov.loaded ? <Loading /> : null}

      {eng ? (
        <>
          <Row style={{ gap: 8, marginBottom: 8 }}>
            <Tile label="Links on" value={String(links.filter((l) => l.enabled).length)} />
            <Tile label="Copies open" value={String(links.reduce((n, l) => n + (l.engine?.copies ?? 0), 0))} />
          </Row>
          <Row style={{ gap: 8, marginBottom: 12 }}>
            <Tile label="Copied today" value={String(sentToday)} />
            <Tile label="Success rate" value={success} color={success === "—" ? undefined : colors.green} />
          </Row>

          <Card style={down ? { borderColor: `${colors.red}88` } : undefined}>
            <Row>
              {eng.reachable && !eng.halted ? <Pulse color={colors.green} size={10} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red }} />}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{!eng.reachable ? "Copy engine not reachable" : eng.halted ? "All copying halted" : "Copy engine running"}</Text>
                <Muted style={{ marginTop: 2 }}>{!eng.reachable ? eng.error || "Check the MT5 service." : eng.trade_enabled ? "Trading is on: a live link sends real orders." : "Trading is off on the reader: links only record."}</Muted>
              </View>
              <Chip color={eng.trade_enabled ? colors.red : colors.amber}>{eng.trade_enabled ? "Trading ON" : "Trading off"}</Chip>
            </Row>
            <View style={{ marginTop: 12 }}>
              <Button tone={eng.halted ? "primary" : "danger"} disabled={!eng.reachable} busy={busy === "halt"} onPress={() => eng.halted ? void run("halt", () => api.copyHalt(false)) : sure("Stop all copying?", "Every link stops copying until you resume.", "Stop all", () => void run("halt", () => api.copyHalt(true)))}>{eng.halted ? "Resume copying" : "Stop all copying"}</Button>
            </View>
          </Card>
        </>
      ) : null}

      <Card>
        <Pressable onPress={() => setAdding(!adding)}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.green}1a`, alignItems: "center", justifyContent: "center" }}><Ionicons name={adding ? "remove" : "add"} size={20} color={colors.green} /></View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>New link</Text>
                <Muted>Pick a master and the accounts that follow it</Muted>
              </View>
            </Row>
            <Ionicons name={adding ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </Row>
        </Pressable>
        {adding ? (
          accounts.length < 2 ? <Muted style={{ marginTop: 12 }}>Connect at least two MT5 accounts.</Muted> : (
            <View style={{ marginTop: 16 }}>
              <Row style={{ marginBottom: 8 }}><Ionicons name="radio-outline" size={14} color={colors.blue} /><Muted style={{ marginLeft: 6 }}>Master (copied from)</Muted></Row>
              <Strip>{accounts.map((a) => <Selectable key={a.id} on={master === a.id} onPress={() => { setMaster(a.id); setFollowers((f) => f.filter((i) => i !== a.id)) }}>{a.name} · #{a.id}</Selectable>)}</Strip>

              <Row style={{ justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
                <Row><Ionicons name="copy-outline" size={14} color={VIOLET} /><Muted style={{ marginLeft: 6 }}>Followers (copy) · {followers.length} chosen</Muted></Row>
                {choices.length > 1 ? <Pressable hitSlop={8} onPress={() => setFollowers(allChosen ? [] : choices.map((a) => a.id))}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>{allChosen ? "Clear" : `Select all ${choices.length}`}</Text></Pressable> : null}
              </Row>
              <Strip>{choices.map((a) => <Selectable key={a.id} on={followers.includes(a.id)} onPress={() => setFollowers((f) => f.includes(a.id) ? f.filter((i) => i !== a.id) : [...f, a.id])}>{a.name} · #{a.id}</Selectable>)}</Strip>

              <Muted style={{ marginTop: 16, marginBottom: 8 }}>Size</Muted>
              <ModePick value={mode} onChange={setMode} />
              <Row style={{ gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}><Field label={modeOf(mode).value} value={value} onChangeText={setValue} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Max lot / order" value={maxLot} onChangeText={setMaxLot} keyboardType="decimal-pad" /></View>
              </Row>
              <Button disabled={!master || !followers.length} busy={busy === "new"} onPress={create}>{followers.length > 1 ? `Add ${followers.length} links` : "Add link"}</Button>
              <Muted style={{ marginTop: 10 }}>A new link starts off. Symbols are matched by name without the broker's suffix, so XAUUSDm on one broker finds XAUUSD or XAUUSDpro on another.</Muted>
            </View>
          )
        ) : null}
      </Card>

      {ov.loaded && links.length === 0 ? <Empty title="No links yet" text="Tap New link, choose a master and followers. The first test is best on two demo accounts." /> : null}
      {eng ? (() => {
        let left = linksShown  // cards still allowed, counted across the groups
        return groups.map((g) => {
          const part = g.slice(0, Math.max(0, left))
          left -= part.length
          if (!part.length) return null
          return (
            <View key={g[0].master_id}>
              {g.length > 1 ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 8, paddingHorizontal: 2 }}>{g[0].master} → {g.length} followers</Text> : null}
              {part.map((l) => (
                <LinkCard
                  key={l.id} l={l} eng={eng} events={events.filter((x) => x.link_id === l.id)} busy={busy === l.id}
                  patch={(x, b) => run(x.id, () => api.copyUpdate(x.id, b))}
                  closeCopies={(x) => sure("Close copies?", `Close every copy ${x.master} → ${x.follower} opened on ${x.follower}? Trades you opened yourself there are not touched.`, "Close copies", () => void run(x.id, () => api.copyCloseCopies(x.id)))}
                  remove={(x) => sure("Remove this link?", "Copies it opened stay open on the follower; close them first if they should go.", "Remove", () => void run(x.id, () => api.copyDelete(x.id)))}
                />
              ))}
            </View>
          )
        })
      })() : null}
      {links.length > linksShown ? <View style={{ marginBottom: 12 }}><Button tone="ghost" onPress={() => setLinksShown(linksShown + 5)}>Show more links ({links.length - linksShown} left)</Button></View> : null}

      <Activity events={events} links={links} />
    </Screen>
  )
}
