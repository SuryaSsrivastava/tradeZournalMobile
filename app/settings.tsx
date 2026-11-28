import Constants from "expo-constants"
import { useEffect, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { Alert, Switch, Text, View } from "react-native"
import { api, apiServer } from "../src/api"
import { Heading, IconChip } from "../src/fx"
import { useAuth } from "../src/auth"
import { liveNotificationAvailable, liveNotificationEnabled, setLiveNotificationEnabled } from "../src/liveservice"
import { livePreviewAvailable, startLivePreview, stopLivePreview } from "../src/livepreview"
import { useLock } from "../src/lock"
import { registerForPush, unregisterPush } from "../src/push"
import { colors } from "../src/theme"
import { usePrivacy } from "../src/privacy"
import { Button, Card, ErrorNote, Muted, Row, Screen } from "../src/ui"

export default function Settings() {
  const { user, signOut } = useAuth()
  const [push, setPush] = useState(true)
  const [promos, setPromos] = useState(true)
  const [reports, setReports] = useState({ trade_review: true, briefing: true, streak_reminder: true, digest: true, daily_recap: false, monthly_report: true })
  const [live, setLive] = useState(false)
  const [liveNote, setLiveNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<"push" | "test" | null>(null)
  const lock = useLock()
  const privacy = usePrivacy()
  const [lockNote, setLockNote] = useState<{ ok: boolean; text: string } | null>(null)
  const toggleLock = async (on: boolean) => { const r = await lock.setEnabled(on); setLockNote({ ok: r.ok, text: r.message }) }

  useEffect(() => { api.prefs().then((p) => { setPush(p.push !== false); setPromos(p.promos !== false); setReports({ trade_review: p.trade_review !== false, briefing: p.briefing !== false, streak_reminder: p.streak_reminder !== false, digest: p.digest !== false, daily_recap: p.daily_recap === true, monthly_report: p.monthly_report !== false }) }).catch(() => {}) }, [])

  const togglePush = async (on: boolean) => {
    setPush(on)  // the switch moves at once; it goes back below if the change did not work
    setBusy("push"); setNote(null)
    try {
      if (on) {
        const r = await registerForPush()
        setNote({ ok: r.ok, text: r.message })
        if (!r.ok) { setPush(false); return }
      } else {
        await unregisterPush()
        setNote({ ok: true, text: "Push notifications are off for this phone." })
      }
      await api.savePrefs({ push: on })
    } catch (e) {
      setPush(!on)
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not change that." })
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => { void liveNotificationEnabled().then(setLive) }, [])
  const toggleLive = async (on: boolean) => {
    setLiveNote(null)
    setLive(on)
    const r = await setLiveNotificationEnabled(on)
    setLiveNote({ ok: r.ok, text: r.message })
    if (!r.ok) setLive(!on)
  }

  const preview = async () => {
    setLiveNote(null)
    const r = await startLivePreview()
    setLiveNote({ ok: r.ok, text: r.message })
  }

  const togglePromos = async (on: boolean) => {
    setPromos(on)
    try { await api.savePrefs({ promos: on }) } catch { setPromos(!on) }
  }

  const toggleReport = async (key: keyof typeof reports, on: boolean) => {
    setReports((r) => ({ ...r, [key]: on }))
    try { await api.savePrefs({ [key]: on }) } catch { setReports((r) => ({ ...r, [key]: !on })) }
  }

  const test = async () => {
    setBusy("test"); setNote(null)
    try {
      await api.testPush()
      setNote({ ok: true, text: "Sent. It should arrive in about half a minute. If it does not, check the notification settings of your phone." })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not send the test." })
    } finally {
      setBusy(null)
    }
  }

  const out = () => Alert.alert("Sign out?", "You will stop receiving alerts on this phone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => void signOut() },
  ])

  const sw = { trackColor: { true: colors.green, false: colors.border }, thumbColor: "#fff" } as const
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase()
  const Note = ({ n }: { n: { ok: boolean; text: string } | null }) => n ? <View style={{ marginTop: 10 }}>{n.ok ? <Muted style={{ color: colors.green }}>{n.text}</Muted> : <ErrorNote>{n.text}</ErrorNote>}</View> : null

  return (
    <Screen padTop={false}>
      <Card>
        <Row style={{ gap: 14 }}>
          <LinearGradient colors={["#34d399", "#22d3ee", "#60a5fa"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#06241a", fontSize: 22, fontWeight: "800" }}>{initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 }}>{user?.name || user?.email}</Text>
            <Muted numberOfLines={1}>{user?.email}</Muted>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: `${colors.green}22`, borderWidth: 1, borderColor: `${colors.green}55` }}>
            <Text style={{ color: colors.green, fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>{user?.plan} plan</Text>
          </View>
        </Row>
      </Card>

      <Card>
        <Heading icon="shield-checkmark" color="#a78bfa">Privacy and security</Heading>
        <SettingRow icon="eye-off" color="#818cf8" title="Hide amounts" hint="Balances, profit and loss show as •••• on every screen. Prices of stocks and markets stay visible.">
          <Switch value={privacy.hidden} onValueChange={privacy.setHidden} {...sw} />
        </SettingRow>
        <SettingRow first={false} icon="finger-print" color="#22d38a" title="App lock" hint="Ask for your fingerprint, face or phone PIN when the app opens and when you come back to it.">
          <Switch value={lock.enabled} onValueChange={toggleLock} {...sw} />
        </SettingRow>
        <Note n={lockNote} />
      </Card>

      <Card>
        <Heading icon="notifications" color="#fb923c">Notifications</Heading>
        <SettingRow icon="phone-portrait" color="#fb923c" title="Push notifications" hint="Trades opened, upcoming releases and rule warnings, on your lock screen.">
          <Switch value={push} onValueChange={togglePush} disabled={busy === "push"} {...sw} />
        </SettingRow>
        <Note n={note} />
        <SettingRow first={false} icon="megaphone" color="#f472b6" title="Tips and offers" hint="Occasional ideas and offers from TradeZournal. Turn this off and you will still get your trade and release alerts.">
          <Switch value={promos} onValueChange={togglePromos} {...sw} />
        </SettingRow>
        {__DEV__ ? <View style={{ marginTop: 12 }}><Button tone="ghost" onPress={test} busy={busy === "test"}>Send a test notification</Button></View> : null}
      </Card>

      <Card>
        <Heading icon="alarm" color="#fbbf24">Reminders and recaps</Heading>
        {([["trade_review", "Post-trade check-in", "Right after a trade closes: tap how it felt, or add a note, from the notification.", "chatbubble-ellipses", "#22d3ee"], ["briefing", "Morning briefing", "Your morning: yesterday's result, your streak and the day's big releases.", "sunny", "#fbbf24"], ["streak_reminder", "Streak reminder", "An evening nudge when you have a streak to keep and have not logged today.", "flame", "#fb923c"], ["digest", "Weekly recap", "Every Monday: how last week went, as a notification.", "calendar", "#60a5fa"], ["daily_recap", "Daily recap", "After the day ends: your result in one line.", "moon", "#a78bfa"], ["monthly_report", "Monthly report", "The 1st of the month: your last 30 days.", "document-text", "#2dd4bf"]] as const).map(([key, title, hint, icon, color], i) => (
          <SettingRow key={key} first={i === 0} icon={icon} color={color} title={title} hint={hint}>
            <Switch value={reports[key]} onValueChange={(on) => void toggleReport(key, on)} {...sw} />
          </SettingRow>
        ))}
      </Card>

      {liveNotificationAvailable() || livePreviewAvailable() ? (
        <Card>
          <Heading icon="pulse" color="#22d38a">Live trades in the notification bar</Heading>
          <Muted>While a trade is open, one notification stays in your bar with its running profit and a timer. It updates every few seconds, uses some battery, and goes away after the last trade closes.</Muted>
          {liveNotificationAvailable() ? (
            <SettingRow first={false} icon="radio" color="#22d38a" title="Show it when a trade is open" hint="">
              <Switch value={live} onValueChange={toggleLive} {...sw} />
            </SettingRow>
          ) : <Muted style={{ marginTop: 8 }}>The real one needs a newer build of the app. You can preview how it will look.</Muted>}
          {livePreviewAvailable() ? (
            <Row style={{ gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}><Button tone="ghost" onPress={preview}>Preview</Button></View>
              <View style={{ flex: 1 }}><Button tone="ghost" onPress={() => { void stopLivePreview(); setLiveNote(null) }}>Stop preview</Button></View>
            </Row>
          ) : null}
          <Note n={liveNote} />
        </Card>
      ) : null}

      <Card>
        <Row style={{ gap: 12 }}>
          <IconChip icon="information-circle" color="#60a5fa" size={30} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>About</Text>
            <Muted>TradeZournal mobile {Constants.expoConfig?.version}</Muted>
            {__DEV__ ? <Muted style={{ marginTop: 2 }}>Server: {apiServer()}</Muted> : null}
          </View>
        </Row>
      </Card>

      <Button tone="danger" onPress={out}>Sign out</Button>
    </Screen>
  )
}

/** One setting: an icon chip, a title with what it does underneath, and the control on the right. */
function SettingRow({ icon, color, title, hint, children, first = true }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; hint: string; children: React.ReactNode; first?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <IconChip icon={icon} color={color} size={32} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "600" }}>{title}</Text>
        {hint ? <Muted style={{ marginTop: 2, fontSize: 12, lineHeight: 17 }}>{hint}</Muted> : null}
      </View>
      {children}
    </View>
  )
}
