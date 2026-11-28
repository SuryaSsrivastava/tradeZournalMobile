import { ActivityIndicator } from "./brand"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api } from "./api"
import { colors, radius } from "./theme"
import { ZoomImage } from "./zoom"
import { Muted } from "./ui"

type Shot = { key: string; thumb: string; caption: string; full: () => Promise<string> }

/** The screenshots of one trade (the ones attached by hand and the ones taken in Replay) as a row of thumbnails; tap one to see it full size. */
export function TradeShots({ tradeId }: { tradeId: number }) {
  const [shots, setShots] = useState<Shot[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [broken, setBroken] = useState<string[]>([])  // thumbnails the phone could not draw
  const [open, setOpen] = useState<Shot | null>(null)
  useEffect(() => {
    let alive = true
    setShots(null); setProblem(null)
    Promise.allSettled([api.tradeShots(tradeId), api.journalTradeShots(tradeId)]).then(([manual, replay]) => {
      if (!alive) return
      if (manual.status === "rejected" && replay.status === "rejected") setProblem(manual.reason instanceof Error ? manual.reason.message : "Could not load the screenshots.")
      setShots([
        ...(manual.status === "fulfilled" ? manual.value : []).map((m) => ({ key: `m${m.id}`, thumb: m.thumb, caption: m.caption, full: () => api.tradeShotImage(m.id).then((r) => r.image) })),
        ...(replay.status === "fulfilled" ? replay.value : []).map((r) => ({ key: `r${r.id}`, thumb: r.thumb, caption: r.caption, full: () => api.replayShotImage(r.id).then((x) => x.image) })),
      ])
    })
    return () => { alive = false }
  }, [tradeId])

  if (shots === null) return <View style={{ height: 40, justifyContent: "center", alignItems: "flex-start" }}><ActivityIndicator color={colors.muted} /></View>
  if (problem) return <Muted style={{ marginTop: 8, color: colors.red }}>Screenshots: {problem}</Muted>
  if (shots.length === 0) return <Muted style={{ marginTop: 8 }}>No screenshots for this trade.</Muted>
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        {shots.map((s) => (
          <Pressable key={s.key} onPress={() => setOpen(s)}>
            {broken.includes(s.key) ? (
              <View style={{ width: 120, height: 76, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={22} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 10.5, marginTop: 2 }}>Tap to open</Text>
              </View>
            ) : (
              <Image source={{ uri: s.thumb }} onError={() => setBroken((b) => [...b, s.key])} style={{ width: 120, height: 76, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }} resizeMode="cover" />
            )}
          </Pressable>
        ))}
      </ScrollView>
      <Viewer shot={open} onClose={() => setOpen(null)} />
    </>
  )
}

/** One screenshot full screen: pinch to zoom, drag, double-tap, and tap the cross to close. */
function Viewer({ shot, onClose }: { shot: Shot | null; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const [uri, setUri] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setUri(null); setFailed(false)
    if (!shot) return
    let alive = true
    shot.full().then((u) => alive && setUri(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [shot])
  return (
    <Modal visible={!!shot} animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {uri ? (
          <ZoomImage uri={uri} />
        ) : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{failed ? <Muted>Could not load this screenshot.</Muted> : <ActivityIndicator color={colors.green} />}</View>}
        {shot?.caption ? <Text style={{ color: colors.text, textAlign: "center", paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>{shot.caption}</Text> : null}
        <Pressable onPress={onClose} hitSlop={12} style={{ position: "absolute", top: insets.top + 10, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
    </Modal>
  )
}

/** A small camera with the number of screenshots, for rows of trades that have some. Nothing when there are none. */
export function ShotBadge({ n }: { n?: number }) {
  if (!n) return null
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8, gap: 3, backgroundColor: `${colors.blue}1f`, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Ionicons name="camera" size={11} color={colors.blue} />
      {n > 1 ? <Text style={{ color: colors.blue, fontSize: 10.5, fontWeight: "800" }}>{n}</Text> : null}
    </View>
  )
}
