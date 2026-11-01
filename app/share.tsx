import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Image, Pressable, Text, View } from "react-native"
import { api, type JournalTrade } from "../src/api"
import { CheckMark, Pop, success } from "../src/delight"
import { money, ago } from "../src/format"
import { Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { pnlOf } from "../src/journal"
import { clearShared, getShared } from "../src/sharebox"
import { PlanNote } from "../src/upgrade"
import { colors } from "../src/theme"
import { Button, Card, Empty, ErrorNote, Field, Label, Loading, Muted, Row, Screen, tone } from "../src/ui"

const MAX_CHARS = 2_800_000  // the server keeps a picture up to 3 million characters as text

/** A picture shared to EdgeLabHub (from the gallery, TradingView, a chat): choose the trade it belongs to and it is added as a screenshot, shrunk to a sensible size first. */
export default function ShareToTrade() {
  const router = useRouter()
  const files = getShared()
  const trades = useLoad(() => api.journalTrades(40), { cache: "trades40" })
  const list = [...(trades.data ?? [])].sort((a, b) => +new Date(b.opened_at) - +new Date(a.opened_at)).slice(0, 15)
  const [picked, setPicked] = useState<number | null>(null)
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chosen = picked ?? list[0]?.id ?? null

  const shrink = async (f: (typeof files)[number]) => {
    for (const [width, quality] of [[1600, 0.8], [1200, 0.65], [900, 0.5]] as const) {
      const w = f.width && f.width < width ? f.width : width
      const r = await manipulateAsync(f.path, [{ resize: { width: w } }], { compress: quality, format: SaveFormat.JPEG, base64: true })
      const image = `data:image/jpeg;base64,${r.base64}`
      if (image.length < MAX_CHARS) return image
    }
    throw new Error("That picture is too large to upload.")
  }

  const attach = async () => {
    if (!chosen || files.length === 0) return
    setBusy(true); setError(null)
    try {
      for (const f of files.slice(0, 5)) {
        const image = await shrink(f)
        const t = await manipulateAsync(f.path, [{ resize: { width: 320 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true })
        await api.addTradeShot(chosen, { image, thumb: `data:image/jpeg;base64,${t.base64}`, caption: caption.trim() })
      }
      success(); setDone(chosen); clearShared()
      setTimeout(() => router.replace(`/trade/${chosen}` as never), 1300)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the screenshot.")
      setBusy(false)
    }
  }

  const close = () => { clearShared(); if (router.canGoBack()) router.back(); else router.replace("/") }

  if (done !== null) return (
    <Screen padTop={false}><View style={{ alignItems: "center", paddingVertical: 70 }}><Pop><CheckMark size={76} /></Pop><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 18 }}>Screenshot added</Text><Muted style={{ marginTop: 6 }}>Opening the trade...</Muted></View></Screen>
  )
  if (files.length === 0) return <Screen padTop={false}><Empty title="Nothing was shared" text="Share a picture to EdgeLabHub from your gallery or another app, and it opens here." /><Button onPress={close}>Close</Button></Screen>

  return (
    <Screen padTop={false}>
      <Rise>
        <Card>
          <Label>{files.length === 1 ? "Your picture" : `${Math.min(files.length, 5)} pictures`}</Label>
          <Row style={{ gap: 8 }}>
            {files.slice(0, 5).map((f) => <Image key={f.path} source={{ uri: f.path }} resizeMode="cover" style={{ flex: 1, height: files.length === 1 ? 180 : 90, borderRadius: 12, backgroundColor: colors.border }} />)}
          </Row>
        </Card>
      </Rise>
      <Label>Which trade is it for?</Label>
      {!trades.loaded ? <Loading /> : list.length === 0 ? <Empty title="No trades yet" text="Log a trade first, then share the picture again." /> : list.map((t, i) => <Pick key={t.id} t={t} on={chosen === t.id} onPress={() => setPicked(t.id)} delay={Math.min(i, 6) * 40} />)}
      {list.length ? <View style={{ marginTop: 6 }}><Field label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={300} placeholder="Entry, the setup, what you saw" /></View> : null}
      {error ? <PlanNote message={error} /> : null}
      <Button onPress={attach} busy={busy} disabled={!chosen || list.length === 0}>Add screenshot to this trade</Button>
      <View style={{ marginTop: 10 }}><Button tone="ghost" onPress={close} disabled={busy}>Cancel</Button></View>
    </Screen>
  )
}

function Pick({ t, on, onPress, delay }: { t: JournalTrade; on: boolean; onPress: () => void; delay: number }) {
  const p = pnlOf(t)
  return (
    <Rise delay={delay}>
      <Pressable onPress={onPress}>
        <Card style={{ borderColor: on ? colors.green : colors.border }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row style={{ flex: 1 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.green : colors.border, alignItems: "center", justifyContent: "center" }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }} /> : null}</View>
              <View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{t.side} {t.symbol}</Text><Muted>{ago(t.opened_at)}{t.setup ? ` · ${t.setup}` : ""}</Muted></View>
            </Row>
            <Text style={{ color: tone(p), fontSize: 15, fontWeight: "800" }}>{money(p, "USD", true)}</Text>
          </Row>
        </Card>
      </Pressable>
    </Rise>
  )
}
