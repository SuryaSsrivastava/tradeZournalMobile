import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import type { JournalTrade } from "./api"
import { badges, greenStreak, nextBadge } from "./badges"
import { money } from "./format"
import { Bar, Press, Rise, Sparkline, tick, useReducedMotion } from "./fx"
import { PERIODS, recap, type Period } from "./recap"
import { ShareSheet, type CardData } from "./sharecard"
import { colors } from "./theme"
import { Card, Label, Muted, Row, tone } from "./ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]
const sgn = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`
const dayName = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: "long" })

/** A flame that breathes while there is a streak. */
function Flame({ on }: { on: boolean }) {
  const reduced = useReducedMotion()
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!on || reduced) return
    const loop = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(t, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]))
    loop.start()
    return () => loop.stop()
  }, [on, reduced, t])
  return (
    <Animated.View style={{ transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }}>
      <Ionicons name="flame" size={30} color={on ? colors.amber : colors.border} />
    </Animated.View>
  )
}

/** Home: the green-day streak and the badge that is closest. Tapping opens all the badges. */
export function StreakCard({ trades, delay = 0 }: { trades: JournalTrade[]; delay?: number }) {
  const router = useRouter()
  const s = greenStreak(trades)
  const list = badges(trades)
  const next = nextBadge(list)
  const earned = list.filter((b) => b.earned).length
  if (trades.length === 0) return null
  return (
    <Card delay={delay}>
      <Press onPress={() => router.push("/badges" as never)}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row style={{ flex: 1 }}>
            <Flame on={s.current > 0} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{s.current > 0 ? `${s.current} green day${s.current === 1 ? "" : "s"} in a row` : "No green streak right now"}</Text>
              <Muted>Best: {s.best} · {earned} of {list.length} badges</Muted>
            </View>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Row>
        {next ? (
          <View style={{ marginTop: 12 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Next: {next.title} · {next.text}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{next.have}/{next.need}</Text>
            </Row>
            <Bar pct={(next.have / next.need) * 100} color={colors.amber} />
          </View>
        ) : null}
      </Press>
    </Card>
  )
}

/** Home: the chosen period (this week, this month, last 30 or 90 days) against the one before it, with a share button. The title is a small dropdown. */
export function WeekCard({ trades, delay = 0 }: { trades: JournalTrade[]; delay?: number }) {
  const [card, setCard] = useState<CardData | null>(null)
  const [period, setPeriod] = useState<Period>("week")
  const [menu, setMenu] = useState(false)
  const info = PERIODS.find((p) => p.key === period) ?? PERIODS[0]
  const { week: w, last } = recap(trades, period)
  if (trades.length === 0) return null
  const delta = w.net - last.net
  const noun = period === "week" ? "week" : period === "month" ? "month" : info.label.toLowerCase()
  const share = () => setCard({
    kicker: info.label, title: period === "week" || period === "month" ? `My trading ${noun}` : `My ${noun}`, sub: `${w.count} trade${w.count === 1 ? "" : "s"} · ${w.winRate.toFixed(0)}% win rate`,
    money: money(w.net, "USD", true), alt: `${sgn(w.netR, 2)}R`, sign: w.net, points: w.points,
    stats: [
      { label: "Trades", value: String(w.count), altValue: String(w.count) },
      { label: "Win rate", value: `${w.winRate.toFixed(0)}%`, altValue: `${w.winRate.toFixed(0)}%` },
      ...(w.bestDay ? [{ label: "Best day", value: `${dayName(w.bestDay.at)} ${money(w.bestDay.pnl, "USD", true)}`, altValue: dayName(w.bestDay.at) }] : []),
    ],
  })
  return (
    <Rise delay={delay}>
      <Card>
        <ShareSheet data={card} onClose={() => setCard(null)} />
        <Row style={{ justifyContent: "space-between" }}>
          <Pressable onPress={() => { tick(); setMenu((m) => !m) }} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" }}>{info.title}</Text>
            <Ionicons name={menu ? "chevron-up" : "chevron-down"} size={13} color={colors.muted} style={{ marginLeft: 5 }} />
          </Pressable>
          {w.count > 0 ? <Text onPress={share} style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}>Share</Text> : null}
        </Row>
        {menu ? (
          <View style={{ backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: "hidden" }}>
            {PERIODS.map((p, i) => (
              <Pressable key={p.key} onPress={() => { tick(); setPeriod(p.key); setMenu(false) }} style={{ paddingVertical: 11, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
                <Text style={{ color: p.key === period ? colors.green : colors.text, fontSize: 14, fontWeight: p.key === period ? "800" : "600" }}>{p.label}</Text>
                {p.key === period ? <Ionicons name="checkmark" size={16} color={colors.green} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: tone(w.net), fontSize: 30, fontWeight: "800", letterSpacing: -0.8 }}>{money(w.net, "USD", true)}</Text>
            <Text style={{ color: last.count === 0 ? colors.muted : tone(delta), fontSize: 12.5, fontWeight: "800", marginTop: 2 }}>
              {last.count === 0 ? `No trades ${info.prev} to compare` : `${delta >= 0 ? "▲" : "▼"} ${money(Math.abs(delta), "USD")} ${delta >= 0 ? "better" : "worse"} than ${info.prev}`}
            </Text>
          </View>
          {w.points.length > 1 ? <Sparkline points={w.points} width={110} height={44} color={w.net >= 0 ? colors.green : colors.red} /> : null}
        </Row>
        {w.count === 0 ? <Muted style={{ marginTop: 10 }}>No trades in this period.</Muted> : (
          <Row style={{ gap: 18, marginTop: 12 }}>
            <Mini label="Trades" now={String(w.count)} before={`${last.count} ${info.prev}`} />
            <Mini label="Win rate" now={`${w.winRate.toFixed(0)}%`} before={`${last.winRate.toFixed(0)}% ${info.prev}`} />
            {w.bestDay ? <Mini label="Best day" now={dayName(w.bestDay.at)} before={money(w.bestDay.pnl, "USD", true)} /> : null}
          </Row>
        )}
      </Card>
    </Rise>
  )
}

const Mini = ({ label, now, before }: { label: string; now: string; before: string }) => (
  <View>
    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 2 }}>{now}</Text>
    <Text style={{ color: colors.muted, fontSize: 11 }}>{before}</Text>
  </View>
)
