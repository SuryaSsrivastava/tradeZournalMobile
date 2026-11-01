import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import * as Sharing from "expo-sharing"
import { useRef, useState } from "react"
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native"
import { captureRef } from "react-native-view-shot"
import { Sparkline } from "./fx"
import { colors } from "./theme"
import { Brand, Button, ErrorNote, Muted, Row } from "./ui"

/**
 * A result as a picture to post: the logo, the result in big figures, a small curve and a few numbers. Shown in a sheet with a preview, and shared as an image (WhatsApp, Instagram...).
 * "Hide amounts" swaps the money for R multiples and percentages, so a member can show a good day without showing the size of the account.
 */
export type CardData = {
  kicker: string  // "Trade", "This week"
  title: string  // "Long XAUUSD"
  sub: string  // a date or a range
  money: string  // "+$124.50"
  alt: string  // the same result without money: "+2.1R", "63% win rate"
  sign: number  // colours it
  points?: number[]
  stats: { label: string; value: string; altValue?: string }[]  // altValue is shown when amounts are hidden; a stat without one is hidden then
}

function Card({ d, hide }: { d: CardData; hide: boolean }) {
  const c = d.sign >= 0 ? colors.green : colors.red
  const stats = d.stats.filter((s) => !hide || s.altValue !== undefined)
  return (
    <LinearGradient colors={["#0f1422", "#0b0e14", "#101a1a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 320, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: `${c}55` }}>
      <View style={{ position: "absolute", top: -60, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: `${c}22` }} />
      <Brand size={34} />
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase", marginTop: 22 }}>{d.kicker}</Text>
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 3 }}>{d.title}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{d.sub}</Text>
      <Text style={{ color: c, fontSize: 44, fontWeight: "900", letterSpacing: -1.5, marginTop: 14 }}>{hide ? d.alt : d.money}</Text>
      {hide ? null : <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{d.alt}</Text>}
      {d.points && d.points.length > 1 ? <View style={{ marginTop: 10, marginLeft: -4 }}><Sparkline points={d.points} width={276} height={64} color={c} /></View> : null}
      <Row style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flexGrow: 1, minWidth: 80, backgroundColor: `${colors.text}0d`, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 9.5, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 2 }}>{hide ? s.altValue : s.value}</Text>
          </View>
        ))}
      </Row>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 18, textAlign: "center", letterSpacing: 0.4 }}>Journal your trades on tradezournal.com</Text>
    </LinearGradient>
  )
}

export function ShareSheet({ data, onClose }: { data: CardData | null; onClose: () => void }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null)
  const [hide, setHide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const share = async () => {
    setBusy(true); setError(null)
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this phone.")
      const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" })
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your result" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the picture.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={!!data} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "92%", borderTopWidth: 1, borderColor: colors.border }}>
          <Row style={{ justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Share your result</Text>
            <Pressable onPress={onClose} hitSlop={16} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 10, alignItems: "center" }}>
            {data ? <View ref={ref} collapsable={false} style={{ padding: 14, backgroundColor: colors.bg, borderRadius: 26 }}><Card d={data} hide={hide} /></View> : null}
            <Row style={{ justifyContent: "space-between", alignSelf: "stretch", marginTop: 16 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Hide amounts</Text>
                <Muted>Show it in R and percent, not money.</Muted>
              </View>
              <Switch value={hide} onValueChange={setHide} trackColor={{ true: colors.green, false: colors.border }} thumbColor="#fff" />
            </Row>
            {error ? <View style={{ alignSelf: "stretch", marginTop: 12 }}><ErrorNote>{error}</ErrorNote></View> : null}
            <View style={{ alignSelf: "stretch", marginTop: 16 }}><Button onPress={share} busy={busy}>Share picture</Button></View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
