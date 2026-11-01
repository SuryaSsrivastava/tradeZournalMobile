import { Ionicons } from "@expo/vector-icons"
import { Text, View } from "react-native"
import { api } from "../src/api"
import { badges, greenStreak, planStreak } from "../src/badges"
import { Pop } from "../src/delight"
import { Bar, Rise, Stat } from "../src/fx"
import { useLoad } from "../src/hooks"
import { streaks } from "../src/journal"
import { colors } from "../src/theme"
import { Card, ErrorNote, Label, Loading, Muted, Row, Screen } from "../src/ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]

export default function Badges() {
  const trades = useLoad(() => api.journalTrades(1000), { cache: "trades1000" })
  const t = trades.data ?? []
  const g = greenStreak(t)
  const p = planStreak(t)
  const w = streaks(t)
  const list = badges(t)
  const earned = list.filter((b) => b.earned).length
  return (
    <Screen padTop={false} refreshing={trades.refreshing} onRefresh={trades.refresh}>
      {trades.error ? <ErrorNote>{trades.error}</ErrorNote> : null}
      {!trades.loaded ? <Loading /> : (
        <>
          <Rise>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Row>
                  <Ionicons name="flame" size={44} color={g.current > 0 ? colors.amber : colors.border} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 }}>{g.current}</Text>
                    <Muted>green day{g.current === 1 ? "" : "s"} in a row</Muted>
                  </View>
                </Row>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.amber, fontSize: 22, fontWeight: "800" }}>{earned}/{list.length}</Text>
                  <Muted>badges earned</Muted>
                </View>
              </Row>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <Stat min="28%" label="Best green run">{`${g.best}d`}</Stat>
                <Stat min="28%" label="Best win run">{String(w.bestWin)}</Stat>
                <Stat min="28%" label="By the book">{String(p.best)}</Stat>
              </View>
            </Card>
          </Rise>
          <Label>Badges</Label>
          {list.map((b, i) => (
            <Card key={b.id} delay={60 + i * 30} style={{ opacity: b.earned ? 1 : 0.8 }}>
              <Row>
                <Pop delay={b.earned ? 200 + i * 70 : 0}><View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: b.earned ? `${colors.amber}24` : `${colors.border}`, borderWidth: 1.5, borderColor: b.earned ? colors.amber : colors.border, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={(b.earned ? b.icon : "lock-closed") as IconName} size={22} color={b.earned ? colors.amber : colors.muted} />
                </View></Pop>
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{b.title}</Text>
                    {b.earned ? <Text style={{ color: colors.amber, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }}>EARNED</Text> : <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{b.have}/{b.need}</Text>}
                  </Row>
                  <Muted>{b.text}</Muted>
                  {!b.earned ? <View style={{ marginTop: 7 }}><Bar pct={(b.have / b.need) * 100} color={colors.amber} height={4} /></View> : null}
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  )
}
