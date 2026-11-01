import { Ionicons } from "@expo/vector-icons"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import { Text, View } from "react-native"
import { api, type Partner } from "../src/api"
import { Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Label, Loading, Muted, Row, Screen } from "../src/ui"

const KINDS: [string, string][] = [["prop", "Prop firms"], ["broker", "Brokers"], ["tool", "Tools"]]

/** Prop firms, brokers and tools EdgeLabHub recommends. EdgeLabHub may earn a commission from them; the member pays nothing extra. A link is opened through the server so the visit is remembered against the member. */
export default function Partners() {
  const list = useLoad(() => api.partners(), { cache: "partners" })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const all = list.data?.partners ?? []

  const open = async (p: Partner) => {
    setBusy(p.id); setError(null)
    try { await WebBrowser.openBrowserAsync((await api.partnerLink(p.id)).url) } catch (e) { setError(e instanceof Error ? e.message : "Could not open that.") } finally { setBusy(null) }
  }
  const groups = [...KINDS.map(([k, label]) => ({ label, items: all.filter((p) => p.kind === k) })), { label: "More", items: all.filter((p) => !KINDS.some(([k]) => k === p.kind)) }].filter((g) => g.items.length)

  return (
    <Screen padTop={false} refreshing={list.refreshing} onRefresh={list.refresh}>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {list.error && !list.data ? <ErrorNote>{list.error}</ErrorNote> : null}
      {!list.loaded ? <Loading /> : all.length === 0 ? <Empty title="No partner offers right now" text="Check back soon." /> : groups.map((g, gi) => (
        <View key={g.label}>
          <Label>{g.label}</Label>
          {g.items.map((p, i) => (
            <Rise key={p.id} delay={Math.min(gi * 3 + i, 8) * 55}>
              <Card>
                <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{p.name}</Text>
                    {p.blurb ? <Muted style={{ marginTop: 3, fontSize: 13 }}>{p.blurb}</Muted> : null}
                  </View>
                  {p.perk ? <View style={{ backgroundColor: `${colors.green}22`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, maxWidth: 130 }}><Text numberOfLines={2} style={{ color: colors.green, fontSize: 11, fontWeight: "800", textAlign: "center" }}>{p.perk}</Text></View> : null}
                </Row>
                <View style={{ marginTop: 12 }}><Button tone="ghost" onPress={() => void open(p)} busy={busy === p.id} disabled={busy !== null}>Open offer</Button></View>
              </Card>
            </Rise>
          ))}
        </View>
      ))}
      <Row style={{ alignItems: "flex-start", marginTop: 4 }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
        <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 16, marginLeft: 8, flex: 1 }}>EdgeLabHub may earn a commission when you sign up through these links. It costs you nothing extra and does not change our view of them. They are not recommendations to trade. Trading is risky and you can lose money, including all you put in. Check each firm's own terms.</Text>
      </Row>
    </Screen>
  )
}
