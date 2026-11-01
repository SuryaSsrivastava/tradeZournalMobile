import { Ionicons } from "@expo/vector-icons"
import { useMemo } from "react"
import { Text, View } from "react-native"
import { api } from "../src/api"
import { insights } from "../src/insights"
import { Pop } from "../src/delight"
import { Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { inScope, ScopeBar, useScope } from "../src/scope"
import { colors } from "../src/theme"
import { Card, Empty, ErrorNote, Label, Loading, Muted, Row, Screen } from "../src/ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]
const TONE = { good: colors.green, bad: colors.red, info: colors.amber } as const

/** Findings from the journal in plain words, each with the money it is worth. Follows the account chosen at the top. */
export default function Insights() {
  const trades = useLoad(() => api.journalTrades(1000), { cache: "trades1000" })
  const accounts = useLoad(() => api.accounts())
  const { mode, filter } = useScope()
  const every = trades.data ?? []
  const scoped = useMemo(() => every.filter((t) => inScope(t, mode, filter)), [every, mode, filter])
  const list = useMemo(() => insights(scoped), [scoped])
  const bad = list.filter((i) => i.tone === "bad"), good = list.filter((i) => i.tone !== "bad")

  return (
    <Screen padTop={false} refreshing={trades.refreshing} onRefresh={trades.refresh}>
      {trades.error ? <ErrorNote>{trades.error}</ErrorNote> : null}
      {!trades.loaded ? <Loading /> : (
        <>
          <ScopeBar trades={every} accounts={accounts.data?.accounts ?? []} />
          {scoped.length < 5 ? <Empty title="Not enough trades yet" text="Log at least 5 trades, with the setup, your feelings and whether you followed your plan, and your habits show up here." /> : list.length === 0 ? <Empty title="Nothing stands out yet" text="Keep journaling. Findings appear once there are enough trades behind them." /> : (
            <>
              <Rise>
                <Card>
                  <Row>
                    <Ionicons name="bulb" size={26} color={colors.amber} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{list.length} finding{list.length === 1 ? "" : "s"} from {scoped.length} trades</Text>
                      <Muted>{bad.length ? `${bad.length} to work on, ${good.length} going well.` : "Everything here is going well."}</Muted>
                    </View>
                  </Row>
                </Card>
              </Rise>
              {bad.length ? <Label>Work on</Label> : null}
              {bad.map((i, n) => <InsightCard key={i.id} i={i} delay={80 + n * 70} />)}
              {good.length ? <Label>Going well</Label> : null}
              {good.map((i, n) => <InsightCard key={i.id} i={i} delay={160 + (bad.length + n) * 70} />)}
              <Muted style={{ textAlign: "center", marginTop: 4 }}>Based on your own journal, not advice. The more trades you log with notes, feelings and plan answers, the sharper this gets.</Muted>
            </>
          )}
        </>
      )}
    </Screen>
  )
}

function InsightCard({ i, delay }: { i: ReturnType<typeof insights>[number]; delay: number }) {
  const c = TONE[i.tone]
  return (
    <Card delay={delay} style={{ borderColor: `${c}55` }}>
      <Row style={{ alignItems: "flex-start" }}>
        <Pop delay={delay + 100}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${c}22`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={i.icon as IconName} size={19} color={c} />
          </View>
        </Pop>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{i.title}</Text>
          <Muted style={{ marginTop: 4, fontSize: 13, lineHeight: 18 }}>{i.text}</Muted>
        </View>
      </Row>
    </Card>
  )
}
