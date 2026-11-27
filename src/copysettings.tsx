import { Ionicons } from "@expo/vector-icons"
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native"
import { api, type CopyLink, type CopyPatch } from "./api"
import { colors, currentScheme, radius } from "./theme"
import { Button, Field, Muted, Row } from "./ui"

type IconName = ComponentProps<typeof Ionicons>["name"]

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0) }
const validTime = (t: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t.trim())
const num = (n: number) => String(+n.toFixed(4))

/** The ways a copy can be sized: what each is called, what its number means, and a line that says how it works (as on the website). */
export const MODES: { id: CopyLink["mode"]; label: string; value: string; hint: string }[] = [
  { id: "multiplier", label: "Master lot ×", value: "Factor", hint: "The follower trades the master's lot times this factor." },
  { id: "fixed", label: "Fixed lot", value: "Lot", hint: "Every copy is this lot, whatever the master trades." },
  { id: "balance", label: "Balance ratio", value: "Factor", hint: "The master's lot times this factor, scaled by follower balance ÷ master balance, so a smaller account takes a smaller trade." },
  { id: "risk_pct", label: "Risk %", value: "% of equity at risk", hint: "Sized so a stop-out costs this % of the follower's equity, from the master's stop. A trade with no stop is skipped." },
]
export const modeOf = (id: string) => MODES.find((m) => m.id === id) ?? MODES[0]

/** What goes on the line between the two accounts. */
export const flowLabel = (l: Pick<CopyLink, "mode" | "value" | "reverse">) => `${l.reverse ? "⇄ " : ""}${l.mode === "fixed" ? `${l.value} lot` : l.mode === "risk_pct" ? `${l.value}% risk` : l.mode === "balance" ? `× ${l.value} by balance` : `× ${l.value}`}`

export type Tone = "loss" | "warn" | "ok" | "info" | "size"
/** The colour of a tag of each tone, the same ones the website uses. */
export const toneColor = (t: Tone) => (t === "loss" ? colors.red : t === "warn" ? colors.amber : t === "ok" ? colors.green : t === "info" ? colors.blue : colors.muted)

/** Everything the link is set to, as short coloured tags for its card, so nobody has to open Settings to see what they chose. */
export function tags(l: CopyLink): { text: string; tone: Tone }[] {
  const out: { text: string; tone: Tone }[] = []
  const size = l.mode === "fixed" ? `Fixed ${num(l.value)} lot` : l.mode === "risk_pct" ? `Risk ${num(l.value)}% of equity` : l.mode === "balance" ? `Balance ratio × ${num(l.value)}` : `Master lot × ${num(l.value)}`
  out.push({ text: size, tone: "ok" }, { text: `max ${num(l.max_lot)} lot`, tone: "size" }, { text: `up to ${l.max_open} copies`, tone: "size" })
  out.push(l.copy_sltp ? { text: "SL/TP copied", tone: "ok" } : { text: "SL/TP not copied", tone: "warn" })
  if (l.copy_pending) out.push({ text: "Pending orders copied", tone: "ok" })
  if (l.reverse) out.push({ text: "Reverse", tone: "warn" })
  if (l.direction === "buy" || l.direction === "sell") out.push({ text: l.direction === "buy" ? "Buys only" : "Sells only", tone: "warn" })
  const limits = l.max_daily_loss_pct > 0 || l.max_total_loss_pct > 0 || l.max_dd_pct > 0
  if (l.max_daily_loss_pct > 0) out.push({ text: `Daily loss limit ${num(l.max_daily_loss_pct)}%`, tone: "loss" })
  if (l.max_total_loss_pct > 0) out.push({ text: `Total loss limit ${num(l.max_total_loss_pct)}%`, tone: "loss" })
  if (l.max_dd_pct > 0) out.push({ text: `Pause at ${num(l.max_dd_pct)}% drawdown`, tone: "warn" })
  if (limits) out.push({ text: l.on_limit === "close" ? "At a limit: stop and close copies" : "At a limit: stop new copies", tone: l.on_limit === "close" ? "loss" : "warn" })
  if (l.max_daily_loss_pct > 0 && l.reset_hour > 0) out.push({ text: `Day starts ${String(l.reset_hour).padStart(2, "0")}:00 UTC`, tone: "info" })
  if (l.symbols_allow.length) out.push({ text: `only ${l.symbols_allow.join(", ")}`, tone: "ok" })
  if (l.symbols_block.length) out.push({ text: `not ${l.symbols_block.join(", ")}`, tone: "loss" })
  for (const [a, b] of Object.entries(l.symbol_map ?? {})) out.push({ text: `${a} → ${b}`, tone: "info" })
  if (l.days.length) out.push({ text: l.days.map((d) => DAYS[d]).join(" "), tone: "info" })
  if (l.from_minute !== l.to_minute) out.push({ text: `${hhmm(l.from_minute)}–${hhmm(l.to_minute)} UTC`, tone: "info" })
  if (l.max_spread_points > 0) out.push({ text: `spread ≤ ${num(l.max_spread_points)} pts`, tone: "info" })
  if (l.max_age_seconds > 0) out.push({ text: `skips trades older than ${l.max_age_seconds}s`, tone: "info" })
  if (l.max_slip_points > 0) out.push({ text: `skips if price is ${num(l.max_slip_points)} pts away`, tone: "info" })
  return out
}

/** The tags as a wrapping row of small coloured pills. */
export function Tags({ l }: { l: CopyLink }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
      {tags(l).map((t, i) => {
        const c = toneColor(t.tone)
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: t.tone === "size" ? colors.border : `${c}55`, backgroundColor: t.tone === "size" ? colors.card : `${c}18`, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ color: t.tone === "size" ? colors.text : c, fontSize: 11, fontWeight: "700" }}>{t.text}</Text>
          </View>
        )
      })}
    </View>
  )
}

/** The size choices (four ways to size a copy) as a row of pills that wraps, with the line that says how the lit one works. */
export function ModePick({ value, onChange }: { value: CopyLink["mode"]; onChange: (m: CopyLink["mode"]) => void }) {
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MODES.map((m) => {
          const on = m.id === value
          return (
            <Pressable key={m.id} onPress={() => onChange(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: on ? colors.green : colors.border, backgroundColor: on ? `${colors.green}22` : "transparent" }}>
              <Text style={{ color: on ? colors.text : colors.muted, fontSize: 13, fontWeight: "700" }}>{m.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Muted style={{ marginTop: 8 }}>{modeOf(value).hint}</Muted>
    </View>
  )
}

/** A short row of choices with one lit, side by side. */
function Choice<T extends string>({ value, options, set, tone = colors.green }: { value: T; options: [T, string][]; set: (v: T) => void; tone?: string }) {
  return (
    <Row style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" }}>
      {options.map(([id, label], i) => {
        const on = id === value
        return (
          <Pressable key={id} onPress={() => set(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 40, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? `${tone}30` : "transparent", borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.border }}>
            <Text numberOfLines={2} style={{ color: on ? colors.text : colors.muted, fontSize: 12.5, fontWeight: on ? "800" : "600", textAlign: "center" }}>{label}</Text>
          </Pressable>
        )
      })}
    </Row>
  )
}

function Block({ icon, color, title, hint, children }: { icon: IconName; color: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: `${colors.bg}88`, padding: 14, marginTop: 12 }}>
      <Row style={{ gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={16} color={color} /></View>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }}>{title}</Text>
      </Row>
      {hint ? <Muted style={{ marginTop: 6, marginBottom: 4 }}>{hint}</Muted> : <View style={{ height: 8 }} />}
      {children}
    </View>
  )
}

function Toggle({ on, set, title, sub }: { on: boolean; set: (v: boolean) => void; title: string; sub: string }) {
  return (
    <Pressable onPress={() => set(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={title} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: `${colors.border}99` }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{title}</Text>
        <Muted>{sub}</Muted>
      </View>
      <Switch value={on} onValueChange={set} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
    </Pressable>
  )
}

/** A list of short words as chips with an add box: the keyboard's done key or a comma adds one, the cross removes one. */
function Chips({ items, set, tone, placeholder }: { items: string[]; set: (x: string[]) => void; tone: "ok" | "no" | "map"; placeholder: string }) {
  const [text, setText] = useState("")
  const add = (raw = text) => {
    const parts = raw.split(",").map((x) => x.trim()).filter((x) => x && !items.includes(x) && (tone !== "map" || /^[^=\s]+=[^=\s]+$/.test(x)))
    if (parts.length) set([...items, ...parts])
    setText("")
  }
  const c = tone === "ok" ? colors.green : tone === "no" ? colors.red : colors.blue
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 44, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 6 }}>
      {items.map((x) => (
        <Pressable key={x} onPress={() => set(items.filter((y) => y !== x))} accessibilityLabel={`Remove ${x}`} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: `${c}55`, backgroundColor: `${c}18`, borderRadius: radius.pill, paddingLeft: 10, paddingRight: 7, paddingVertical: 4 }}>
          <Text style={{ color: c, fontSize: 12.5, fontWeight: "700" }}>{x.replace("=", " → ")}</Text>
          <Ionicons name="close" size={13} color={c} />
        </Pressable>
      ))}
      <TextInput value={text} onChangeText={(t) => (t.endsWith(",") ? add(t) : setText(t))} onSubmitEditing={() => add()} onBlur={() => add()} placeholder={items.length ? "" : placeholder} placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="done" blurOnSubmit={false}
        style={{ flexGrow: 1, minWidth: 90, color: colors.text, fontSize: 14, paddingVertical: 6, paddingHorizontal: 6 }} />
    </View>
  )
}

const fromLink = (l: CopyLink) => ({
  mode: l.mode, value: String(l.value), max_lot: String(l.max_lot), max_open: String(l.max_open), copy_sltp: l.copy_sltp, reverse: l.reverse, copy_pending: l.copy_pending,
  max_dd_pct: String(l.max_dd_pct), max_daily_loss_pct: String(l.max_daily_loss_pct), max_total_loss_pct: String(l.max_total_loss_pct), on_limit: (l.on_limit || "pause") as "pause" | "close", reset_hour: String(l.reset_hour),
  direction: (l.direction || "both") as "both" | "buy" | "sell", max_spread_points: String(l.max_spread_points), max_age_seconds: String(l.max_age_seconds), max_slip_points: String(l.max_slip_points),
  days: l.days, hours: l.from_minute !== l.to_minute, from: hhmm(l.from_minute), to: hhmm(l.to_minute),
  allow: l.symbols_allow, block: l.symbols_block, map: Object.entries(l.symbol_map ?? {}).map(([a, b]) => `${a}=${b}`),
})
type Form = ReturnType<typeof fromLink>

/** One sentence that says what the link does with the settings as they stand in the form right now. */
function Summary({ v }: { v: Form }) {
  const g = (t: string) => <Text style={{ color: colors.green, fontWeight: "800" }}>{t}</Text>
  const a = (t: string) => <Text style={{ color: colors.amber, fontWeight: "800" }}>{t}</Text>
  const r = (t: string) => <Text style={{ color: colors.red, fontWeight: "800" }}>{t}</Text>
  const n = (s: string) => +s || 0
  const size = v.mode === "fixed" ? <>at a fixed {g(`${n(v.value)} lot`)}</> : v.mode === "risk_pct" ? <>risking {g(`${n(v.value)}% of equity`)} on each</> : v.mode === "balance" ? <>at {g(`${n(v.value)}×`)} its lot, scaled by balance</> : <>at {g(`${n(v.value)}×`)} its lot</>
  const stops: ReactNode[] = []
  if (n(v.max_dd_pct) > 0) stops.push(a(`pauses at ${n(v.max_dd_pct)}% drawdown`))
  if (n(v.max_daily_loss_pct) > 0) stops.push(r(`${n(v.max_daily_loss_pct)}% daily loss`))
  if (n(v.max_total_loss_pct) > 0) stops.push(r(`${n(v.max_total_loss_pct)}% total loss`))
  const bits: ReactNode[] = []
  if (v.allow.length) bits.push(<>only <Text style={{ fontWeight: "800" }}>{v.allow.join(", ")}</Text></>)
  if (v.block.length) bits.push(<>never {r(v.block.join(", "))}</>)
  if (v.direction !== "both") bits.push(<>{v.direction === "buy" ? "buys" : "sells"} only</>)
  if (v.reverse) bits.push(a("against the master"))
  if (n(v.max_age_seconds) > 0) bits.push(<>skips trades older than {n(v.max_age_seconds)} s</>)
  return (
    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, opacity: 0.9 }}>
      Copies <Text style={{ fontWeight: "800" }}>every master trade</Text> {size}{n(v.max_lot) > 0 ? <>, never more than {g(`${n(v.max_lot)} lot`)} per order</> : null}{n(v.max_open) > 0 ? <> and {g(`${n(v.max_open)} open`)} at once</> : null}
      {bits.map((b, i) => <Text key={i}> · {b}</Text>)}
      {stops.length > 0 ? <> · {stops.map((s, i) => <Text key={i}>{i > 0 ? (i === stops.length - 1 ? " or " : ", ") : ""}{s}</Text>)}</> : null}
    </Text>
  )
}

/**
 * The size, loss-limit and filter settings of one link, as on the website. The form keeps what was typed and only follows the link when the server's values change by something other than this form's own save
 * (the screen looks again every few seconds, and a typed number must not be wiped by that).
 */
export function LinkSettings({ l, busy, save }: { l: CopyLink; busy: boolean; save: (b: CopyPatch) => Promise<boolean> }) {
  const base = useMemo(() => fromLink(l), [l])
  const sig = JSON.stringify(base)
  const [v, setV] = useState<Form>(base)
  const sent = useRef<string | null>(null)  // what the last save sent, so its own echo does not reset the form
  const lastSig = useRef(sig)
  useEffect(() => {
    if (lastSig.current === sig) return
    lastSig.current = sig
    if (sent.current === sig) { sent.current = null; return }
    setV(base)
  }, [sig, base])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = JSON.stringify(v) !== sig
  const mode = modeOf(v.mode)
  const up = <K extends keyof Form>(k: K) => (x: Form[K]) => { setV((p) => ({ ...p, [k]: x })); setNote(null) }
  const light = currentScheme() === "light"
  const bad = light ? "#c8304a" : colors.red

  const field = (label: string, k: "value" | "max_lot" | "max_open" | "max_dd_pct" | "max_daily_loss_pct" | "max_total_loss_pct" | "reset_hour" | "max_spread_points" | "max_age_seconds" | "max_slip_points", kb: "decimal-pad" | "number-pad" = "decimal-pad") => (
    <Field label={label} value={v[k]} onChangeText={(t) => up(k)(t.replace(",", "."))} keyboardType={kb} />
  )

  const submit = async () => {
    const n = (s: string, d = 0) => (s.trim() !== "" && Number.isFinite(+s) ? +s : d)
    if (v.hours && (!validTime(v.from) || !validTime(v.to))) return setNote({ ok: false, text: "Times are written like 08:30." })
    const symbol_map: Record<string, string> = {}
    for (const part of v.map) { const [a, b] = part.split("=").map((x) => x.trim()); if (a && b) symbol_map[a] = b }
    const body: CopyPatch = {
      mode: v.mode, value: n(v.value, l.value) || l.value, max_lot: n(v.max_lot, l.max_lot) || l.max_lot, max_open: Math.round(n(v.max_open, l.max_open)) || l.max_open, copy_sltp: v.copy_sltp, symbol_map,
      max_age_seconds: Math.round(n(v.max_age_seconds, l.max_age_seconds)) || l.max_age_seconds, max_slip_points: n(v.max_slip_points, l.max_slip_points) || l.max_slip_points,
      max_dd_pct: n(v.max_dd_pct), max_daily_loss_pct: n(v.max_daily_loss_pct), max_total_loss_pct: n(v.max_total_loss_pct), on_limit: v.on_limit, reset_hour: Math.round(n(v.reset_hour)),
      direction: v.direction === "both" ? "" : v.direction, reverse: v.reverse, copy_pending: v.copy_pending, max_spread_points: n(v.max_spread_points),
      days: v.days, from_minute: v.hours ? minutes(v.from) : 0, to_minute: v.hours ? minutes(v.to) : 0, symbols_allow: v.allow, symbols_block: v.block,
    }
    sent.current = JSON.stringify(v)
    setSaving(true); setSaved(false); setNote(null)
    const ok = await save(body)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2200) } else sent.current = null
  }
  const reset = () => Alert.alert("Start the loss limits again?", "The total baseline becomes the follower's balance now, and a stop from a breached limit is lifted.", [
    { text: "Cancel", style: "cancel" },
    { text: "Reset limits", style: "destructive", onPress: async () => {
      try { const r = await api.copyResetLimits(l.id); setNote(r.ok && r.reset ? { ok: true, text: "Limits reset." } : { ok: false, text: r.error || "The link is not running, so there was nothing to reset." }) } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not reset" }) }
    } },
  ])

  const master = 0.1
  const copy = v.mode === "fixed" ? +v.value || 0 : v.mode === "risk_pct" ? 0 : master * (+v.value || 0)
  const capped = +v.max_lot > 0 ? Math.min(copy, +v.max_lot) : copy

  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flexDirection: "row", gap: 12, borderWidth: 1, borderColor: `${colors.green}55`, backgroundColor: `${colors.green}12`, borderRadius: radius.lg, padding: 14 }}>
        <Ionicons name="arrow-forward-circle" size={22} color={colors.green} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}><Summary v={v} /></View>
      </View>

      <Block icon="layers-outline" color={colors.green} title="Size" hint="How a copy is sized, and how big or many it may get.">
        <ModePick value={v.mode} onChange={up("mode")} />
        <View style={{ height: 12 }} />
        <Row style={{ gap: 10, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>{field(mode.value, "value")}</View>
          <View style={{ flex: 1 }}>{field("Max lot / order", "max_lot")}</View>
        </Row>
        {v.mode === "risk_pct" ? <Muted style={{ marginTop: -4, marginBottom: 8 }}>The lot comes from the master's stop, so a trade with no stop is skipped.</Muted> : <Muted style={{ marginTop: -4, marginBottom: 8 }}>Master 0.10 lot → copy <Text style={{ color: colors.text, fontWeight: "800" }}>{capped.toFixed(2)} lot</Text></Muted>}
        {field("Max open copies at once", "max_open", "number-pad")}
        <Toggle on={v.copy_sltp} set={up("copy_sltp")} title="Copy stop loss and take profit" sub="The copy gets the master's stop and target" />
        <Toggle on={v.reverse} set={up("reverse")} title="Reverse" sub="Trade against the master, with the stop and target swapped" />
        <Toggle on={v.copy_pending} set={up("copy_pending")} title="Copy pending orders" sub="Mirror limit and stop orders too; the copy gets its stops once it fills" />
      </Block>

      <Block icon="shield-half-outline" color={colors.red} title="Loss limits" hint="Measured on the follower's equity. A breach stops new copies and warns you at 80% of the limit. 0 = off.">
        {field("Pause at drawdown % (equity under balance)", "max_dd_pct")}
        {field("Daily loss limit % (until the next trading day)", "max_daily_loss_pct")}
        {field("Total loss limit % (until you reset it)", "max_total_loss_pct")}
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>When a limit is hit</Text>
        <Choice value={v.on_limit} set={up("on_limit")} tone={colors.amber} options={[["pause", "Stop new copies"], ["close", "Stop and close copies"]]} />
        <View style={{ height: 12 }} />
        {field("Trading day starts at (UTC hour, 0 to 23)", "reset_hour", "number-pad")}
        <Pressable onPress={reset} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.red}66`, backgroundColor: `${colors.red}10` }}>
          <Ionicons name="refresh" size={16} color={bad} />
          <Text style={{ color: bad, fontSize: 13.5, fontWeight: "700" }}>Reset limits</Text>
        </Pressable>
      </Block>

      <Block icon="funnel-outline" color={colors.blue} title="Filters" hint="A trade that fails a filter is skipped for good, and the reason is in the log. Times are UTC.">
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Direction</Text>
        <Choice value={v.direction} set={up("direction")} options={[["both", "Buys and sells"], ["buy", "Buys only"], ["sell", "Sells only"]]} />
        <View style={{ height: 12 }} />
        {field("Skip if spread is wider than (points, 0 = no limit)", "max_spread_points")}
        {field("Skip trades older than (seconds)", "max_age_seconds", "number-pad")}
        {field("Skip if price is further than (points)", "max_slip_points")}

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Days <Text style={{ opacity: 0.7 }}>(none ticked = every day)</Text></Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {DAYS.map((d, i) => {
            const on = v.days.includes(i)
            return (
              <Pressable key={d} onPress={() => up("days")(on ? v.days.filter((x) => x !== i) : [...v.days, i].sort())} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ width: 46, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? colors.blue : colors.border, backgroundColor: on ? `${colors.blue}22` : "transparent" }}>
                <Text style={{ color: on ? colors.text : colors.muted, fontSize: 12.5, fontWeight: "700" }}>{d}</Text>
              </Pressable>
            )
          })}
        </View>
        <Toggle on={v.hours} set={up("hours")} title="Only copy between these hours" sub="Outside them a master trade is skipped" />
        {v.hours ? (
          <Row style={{ gap: 10, marginTop: 6, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><Field label="From (HH:MM)" value={v.from} onChangeText={up("from")} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            <View style={{ flex: 1 }}><Field label="To (HH:MM)" value={v.to} onChangeText={up("to")} placeholder="17:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          </Row>
        ) : null}

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 10, marginBottom: 6 }}>Only these symbols <Text style={{ opacity: 0.7 }}>(empty = all)</Text></Text>
        <Chips items={v.allow} set={up("allow")} tone="ok" placeholder="XAUUSD, EURUSD" />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Never these symbols</Text>
        <Chips items={v.block} set={up("block")} tone="no" placeholder="US30" />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Names that differ <Text style={{ opacity: 0.7 }}>(master=follower)</Text></Text>
        <Chips items={v.map} set={up("map")} tone="map" placeholder="GOLD=XAUUSDm" />
      </Block>

      {note ? <Text style={{ color: note.ok ? colors.green : bad, fontSize: 13, marginTop: 12 }}>{note.text}</Text> : null}
      <View style={{ marginTop: 14 }}>
        <Button onPress={() => void submit()} busy={busy || saving} disabled={!dirty}>{saved ? "Saved ✓" : "Save settings"}</Button>
      </View>
      <Row style={{ justifyContent: "space-between", marginTop: 8 }}>
        <Muted>{dirty ? "You have unsaved changes" : saved ? "Applies to new copies right away" : "Nothing changed"}</Muted>
        {dirty && !saving ? <Pressable onPress={() => { setV(base); setSaved(false); setNote(null) }} hitSlop={8}><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", textDecorationLine: "underline" }}>Discard</Text></Pressable> : null}
      </Row>
    </View>
  )
}
