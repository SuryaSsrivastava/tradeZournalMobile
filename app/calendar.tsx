import { Ionicons } from "@expo/vector-icons"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Pressable, Switch, Text, View } from "react-native"
import { api, type EconEvent, type NewsAlerts } from "../src/api"
import { clock, dayLabel, until } from "../src/format"
import { useLoad } from "../src/hooks"
import { read, write } from "../src/store"
import { colors, impactColor } from "../src/theme"
import { Card, Empty, ErrorNote, Label, Loading, Muted, Pill, Row, Screen, Title } from "../src/ui"

const IMPORTANCE = [["high", "High impact"], ["medium", "Medium+"], ["low", "All"]] as const
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNY"]
const LEADS = [5, 15, 30, 60]
const pretty = (series: string) => { const t = series.replace(/[-_]+/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1) : series }
const REGIONS = [["US", "US"], ["EU", "Euro"], ["GB", "UK"], ["JP", "Japan"], ["AU", "Aus"], ["CA", "Canada"], ["CH", "Swiss"], ["NZ", "NZ"], ["CN", "China"], ["IN", "India"]] as const

export default function Calendar() {
  const [importance, setImportance] = useState<string>("high")
  const [regions, setRegions] = useState<string[]>(["US"]) // US to start; tap others to add them
  const events = useLoad(() => api.calendar(importance, regions), { every: 60_000, deps: [importance, regions.join(",")] })
  const [alerts, setAlerts] = useState<NewsAlerts>({ enabled: false, currencies: [], lead_minutes: 15, events: [] })
  useEffect(() => { api.newsAlerts().then(setAlerts).catch(() => {}) }, [])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})  // what each followed event is called (the server keeps only its id), remembered as events are seen
  useEffect(() => { void read<Record<string, string>>("news-names").then((n) => n && setNames((x) => ({ ...n, ...x }))) }, [])
  useEffect(() => {
    const seen = events.data?.events ?? []
    if (seen.length === 0) return
    setNames((prev) => {
      let changed = false
      const next = { ...prev }
      for (const e of seen) if (e.series && next[e.series] !== e.name) { next[e.series] = e.name; changed = true }
      if (changed) void write("news-names", next)
      return changed ? next : prev
    })
  }, [events.data])

  const list = events.data?.events ?? []
  const save = useCallback(async (next: NewsAlerts) => {
    setAlerts(next); setSaveError(null)
    try { setAlerts(await api.saveNewsAlerts(next)) } catch (e) { setSaveError(e instanceof Error ? e.message : "Could not save the alert."); api.newsAlerts().then(setAlerts).catch(() => {}) }
  }, [])
  const toggleBell = useCallback((series: string) => save({ ...alerts, events: alerts.events.includes(series) ? alerts.events.filter((x) => x !== series) : [...alerts.events, series] }), [alerts, save])
  const toggleCurrency = (c: string) => {
    const has = alerts.currencies.includes(c)
    const currencies = has ? alerts.currencies.filter((x) => x !== c) : [...alerts.currencies, c]
    void save({ ...alerts, currencies, enabled: currencies.length > 0 })  // choosing a currency turns the alert on; removing the last turns it off
  }
  const clearEvents = () => Alert.alert("Stop all event alerts?", `You follow ${alerts.events.length} event${alerts.events.length === 1 ? "" : "s"}. They will no longer alert you.`, [
    { text: "Keep", style: "cancel" },
    { text: "Stop all", style: "destructive", onPress: () => void save({ ...alerts, events: [] }) },
  ])
  const toggleRegion = (c: string) => setRegions((r) => (r.includes(c) ? (r.length > 1 ? r.filter((x) => x !== c) : r) : [...r, c]))

  const groups = useMemo(() => {
    const out: { label: string; items: EconEvent[] }[] = []
    for (const e of list) { const l = dayLabel(e.time); const g = out[out.length - 1]; if (g && g.label === l) g.items.push(e); else out.push({ label: l, items: [e] }) }
    return out
  }, [list])

  return (
    <Screen refreshing={events.refreshing} onRefresh={events.refresh} padTop={false}>
      <Title sub="Tap the bell to be alerted before an event, every time it comes round">Calendar</Title>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>My news alerts</Text>
            <Muted style={{ marginTop: 2 }}>{alerts.enabled && alerts.currencies.length ? `High-impact ${alerts.currencies.join(", ")} news, ${alerts.lead_minutes} min before` : "Off for whole currencies. Pick some below."}</Muted>
          </View>
          <Switch value={alerts.enabled && alerts.currencies.length > 0} onValueChange={(on) => void save(on ? { ...alerts, enabled: true, currencies: alerts.currencies.length ? alerts.currencies : ["USD"] } : { ...alerts, enabled: false })} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
        </Row>
        <Label>Currencies</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{CURRENCIES.map((c) => <Pill key={c} active={alerts.enabled && alerts.currencies.includes(c)} color={colors.amber} onPress={() => toggleCurrency(c)}>{c}</Pill>)}</View>
        {alerts.enabled && alerts.currencies.length ? (
          <>
            <Label>Tell me this long before</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{LEADS.map((m) => <Pill key={m} active={alerts.lead_minutes === m} onPress={() => void save({ ...alerts, lead_minutes: m })}>{m < 60 ? `${m} min` : "1 hour"}</Pill>)}</View>
          </>
        ) : null}
        {alerts.events.length ? (
          <View style={{ marginTop: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>Events you follow ({alerts.events.length})</Label>
              {alerts.events.length > 1 ? <Text onPress={clearEvents} style={{ color: colors.red, fontSize: 12, fontWeight: "800" }}>Stop all</Text> : null}
            </Row>
            {alerts.events.map((s, i) => (
              <Row key={s} style={{ justifyContent: "space-between", paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
                <Row style={{ flex: 1 }}><Ionicons name="notifications" size={16} color={colors.amber} /><Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 }}>{names[s] ?? pretty(s)}</Text></Row>
                <Pressable onPress={() => void toggleBell(s)} hitSlop={10}><Ionicons name="close-circle-outline" size={22} color={colors.muted} /></Pressable>
              </Row>
            ))}
          </View>
        ) : null}
      </Card>
      <Row style={{ flexWrap: "wrap" }}>{IMPORTANCE.map(([id, label]) => <Pill key={id} active={importance === id} onPress={() => setImportance(id)}>{label}</Pill>)}</Row>
      <Row style={{ flexWrap: "wrap" }}>{REGIONS.map(([id, label]) => <Pill key={id} active={regions.includes(id)} color={colors.blue} onPress={() => toggleRegion(id)}>{label}</Pill>)}</Row>
      {events.error ? <ErrorNote>{events.error}</ErrorNote> : null}
      {saveError ? <ErrorNote>{saveError}</ErrorNote> : null}
      {!events.loaded ? <Loading /> : list.length === 0 ? <Empty title="No releases" text={events.data?.available === false ? "The calendar is not reachable right now. Pull down to try again." : "Nothing matches these filters."} /> : groups.map((g) => (
        <View key={g.label}>
          <Label>{g.label}</Label>
          {g.items.map((e) => {
            const past = +new Date(e.time) <= Date.now()
            const followed = alerts.events.includes(e.series)
            const byCurrency = alerts.enabled && e.importance === "high" && alerts.currencies.includes(e.currency)
            return (
              <Card key={e.id} style={{ opacity: past && !e.actual ? 0.55 : 1 }}>
                <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Row>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: impactColor[e.importance], marginRight: 8 }} />
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 }}>{e.name}</Text>
                    </Row>
                    <Muted style={{ marginTop: 4 }}>{clock(e.time)} · {e.country} · {e.currency}{!past && +new Date(e.time) - Date.now() < 3_600_000 * 6 ? ` · in ${until(e.time)}` : ""}</Muted>
                  </View>
                  {e.importance === "high" && !past && e.series ? (
                    byCurrency ? (
                      <Pressable onPress={() => Alert.alert(`${e.currency} news is covered`, `You get an alert for every high-impact ${e.currency} release. To stop it, remove ${e.currency} under "My news alerts" at the top.`)} hitSlop={10}><Ionicons name="notifications" size={20} color={`${colors.amber}99`} /></Pressable>
                    ) : (
                      <Pressable onPress={() => toggleBell(e.series)} hitSlop={10}><Ionicons name={followed ? "notifications" : "notifications-outline"} size={22} color={followed ? colors.amber : colors.muted} /></Pressable>
                    )
                  ) : null}
                </Row>
                <Row style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <Figure label="Actual" value={e.actual} up={e.above_forecast} bold />
                  <Figure label="Forecast" value={e.forecast} />
                  <Figure label="Previous" value={e.previous} />
                </Row>
              </Card>
            )
          })}
        </View>
      ))}
    </Screen>
  )
}

function Figure({ label, value, up, bold }: { label: string; value: string; up?: boolean | null; bold?: boolean }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Label>{label}</Label>
      <Row>
        {up === true ? <Ionicons name="arrow-up" size={12} color={colors.green} style={{ marginRight: 2 }} /> : up === false ? <Ionicons name="arrow-down" size={12} color={colors.red} style={{ marginRight: 2 }} /> : null}
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 14, fontWeight: bold ? "800" : "500" }}>{value || "-"}</Text>
      </Row>
    </View>
  )
}
