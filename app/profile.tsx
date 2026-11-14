import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { Alert, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { api, logoutAll, type LoginDevice } from "../src/api"
import { useAuth } from "../src/auth"
import { CAN_SELL } from "../src/config"
import { CheckMark } from "../src/delight"
import { Bar, Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Row, Screen } from "../src/ui"

const NAMES: Record<string, string> = { strategies: "Saved strategies", explanations: "Trade explanations", coach_reviews: "AI coach reviews", forward_tests: "Forward tests", replay_sessions: "Replay sessions", ai_requests: "AI requests", connected_accounts: "Connected accounts" }
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "")
const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"
type Note = { ok: boolean; text: string } | null
const Say = ({ n }: { n: Note }) => (n ? <View style={{ marginBottom: 10 }}>{n.ok ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><CheckMark size={20} /><Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>{n.text}</Text></View> : <ErrorNote>{n.text}</ErrorNote>}</View> : null)

export default function Profile() {
  const { user, update, signOut } = useAuth()
  const router = useRouter()
  const usage = useLoad(() => api.planUsage())
  const [name, setName] = useState(user?.name ?? "")
  const [zone, setZone] = useState(user?.timezone ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Note>(null)
  const phoneZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return "" } })()

  const save = async () => {
    setSaving(true); setSaved(null)
    try {
      update(await api.updateProfile({ name: name.trim(), timezone: zone.trim() }))
      setSaved({ ok: true, text: "Saved." })
    } catch (e) {
      setSaved({ ok: false, text: e instanceof Error ? e.message : "Could not save." })
    } finally {
      setSaving(false)
    }
  }
  const changed = name.trim() !== (user?.name ?? "") || zone.trim() !== (user?.timezone ?? "")

  const out = () => Alert.alert("Sign out?", "You will stop receiving alerts on this phone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: () => void signOut() },
  ])

  const u = usage.data
  const rows = u ? Object.keys(NAMES).filter((k) => k in u.limits || k in u.used) : []

  return (
    <Screen padTop={false} refreshing={usage.refreshing} onRefresh={usage.refresh}>
      <Rise>
        <Card>
          <Row>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: `${colors.green}22`, borderWidth: 1.5, borderColor: colors.green, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.green, fontSize: 22, fontWeight: "800" }}>{initials(user?.name || user?.email || "")}</Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{user?.name || "Your profile"}</Text>
              <Muted numberOfLines={1}>{user?.email}</Muted>
              <Row style={{ marginTop: 6, gap: 8 }}>
                <View style={{ backgroundColor: `${colors.green}22`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.green, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>{user?.plan ?? "starter"}</Text></View>
                {user?.is_admin ? <View style={{ backgroundColor: `${colors.amber}22`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.amber, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }}>ADMIN</Text></View> : null}
              </Row>
            </View>
          </Row>
          {user?.created_at ? <Muted style={{ marginTop: 12 }}>Member since {date(user.created_at)}</Muted> : null}
        </Card>
      </Rise>

      <Card delay={80}>
        <Label>Your details</Label>
        <Say n={saved} />
        <Field label="Name" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
        <Field label="Time zone" value={zone} onChangeText={setZone} autoCapitalize="none" autoCorrect={false} placeholder="Asia/Kolkata" />
        {phoneZone && phoneZone !== zone ? <Text onPress={() => setZone(phoneZone)} style={{ color: colors.blue, fontSize: 13, fontWeight: "700", marginTop: -4, marginBottom: 12 }}>Use this phone's time zone ({phoneZone})</Text> : null}
        <Field label="Email" value={user?.email ?? ""} editable={false} style={{ opacity: 0.55 }} />
        <Muted style={{ marginTop: -6, marginBottom: 12 }}>Your email can be changed on the website.</Muted>
        <Button onPress={save} busy={saving} disabled={!changed}>Save changes</Button>
      </Card>

      <Card delay={140}>
        <Row style={{ justifyContent: "space-between" }}>
          <Label>Plan and usage</Label>
          {u ? <Muted>{u.ends_on ? `Ends ${date(u.ends_on)}` : u.resets_on ? `Resets ${date(u.resets_on)}` : ""}</Muted> : null}
        </Row>
        {usage.error ? <ErrorNote>{usage.error}</ErrorNote> : null}
        {!usage.loaded ? <Loading /> : u ? (
          <>
            {u.lapsed ? <ErrorNote>Your plan has ended. You are on the free allowance.</ErrorNote> : null}
            <View style={{ gap: 14, marginTop: 6 }}>
              {rows.map((k) => {
                const used = u.used[k] ?? 0, cap = u.limits[k]
                return (
                  <View key={k}>
                    <Row style={{ justifyContent: "space-between", marginBottom: 5 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{NAMES[k]}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{cap == null ? `${used} · unlimited` : `${used} / ${cap}`}</Text>
                    </Row>
                    {cap != null && cap > 0 ? <Bar pct={(used / cap) * 100} color={used / cap >= 0.9 ? colors.red : used / cap >= 0.7 ? colors.amber : colors.green} /> : null}
                  </View>
                )
              })}
            </View>
          </>
        ) : null}
        {CAN_SELL ? <View style={{ marginTop: 14 }}><Button tone="ghost" onPress={() => router.push("/plans" as never)}>{user?.plan === "starter" ? "See plans and upgrade" : "Manage my plan"}</Button></View> : null}
      </Card>

      <Devices />

      <Password hasPassword={user?.has_password !== false} />

      <Button tone="danger" onPress={out}>Sign out</Button>
      <DeleteAccount email={user?.email ?? ""} isAdmin={!!user?.is_admin} onDeleted={() => void signOut()} />
    </Screen>
  )
}

/** Deleting the account from inside the app (Google Play and the App Store require it). The member types their email, then confirms once more. */
function DeleteAccount({ email, isAdmin, onDeleted }: { email: string; isAdmin: boolean; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const matches = typed.trim().toLowerCase() === email.toLowerCase()
  const go = () => Alert.alert("Delete your account for good?", "Your journal, trades, screenshots, strategies and settings will be erased. This cannot be undone.", [
    { text: "Keep my account", style: "cancel" },
    {
      text: "Delete everything", style: "destructive", onPress: async () => {
        setBusy(true); setNote(null)
        try { await api.deleteAccount(typed); onDeleted() } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not delete the account." }); setBusy(false) }
      },
    },
  ])
  return (
    <View style={{ marginTop: 28 }}>
      {!open ? <Text onPress={() => setOpen(true)} style={{ color: colors.muted, fontSize: 13, textAlign: "center", textDecorationLine: "underline" }}>Delete my account</Text> : (
        <Card>
          <Label>Delete account</Label>
          {isAdmin ? <Muted>An admin account is removed by another admin. Ask one of them to delete it.</Muted> : (
            <>
              <Muted style={{ marginBottom: 10 }}>This erases your journal, trades, screenshots, strategies, alerts and settings, and signs you out everywhere. Active subscriptions are not refunded. Type your email ({email}) to continue.</Muted>
              <Say n={note} />
              <Field label="Your email" value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
              <Button tone="danger" onPress={go} busy={busy} disabled={!matches}>Delete my account</Button>
            </>
          )}
          <View style={{ marginTop: 8 }}><Button tone="ghost" onPress={() => { setOpen(false); setTyped(""); setNote(null) }}>Cancel</Button></View>
        </Card>
      )}
    </View>
  )
}

function Password({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const go = async () => {
    if (next.length < 8) return setNote({ ok: false, text: "Use at least 8 characters." })
    if (next !== again) return setNote({ ok: false, text: "The two new passwords are not the same." })
    setBusy(true); setNote(null)
    try {
      await api.changePassword(hasPassword ? cur : null, next)
      setCur(""); setNext(""); setAgain(""); setOpen(false)
      setNote({ ok: true, text: "Password changed." })
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not change it." })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card delay={200}>
      <Label>Password</Label>
      <Say n={note} />
      {!open ? <Button tone="ghost" onPress={() => { setOpen(true); setNote(null) }}>{hasPassword ? "Change password" : "Set a password"}</Button> : (
        <>
          {hasPassword ? <Field label="Current password" value={cur} onChangeText={setCur} secureTextEntry autoCapitalize="none" /> : <Muted style={{ marginBottom: 10 }}>You signed up with Google. A password lets you sign in to this app.</Muted>}
          <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
          <Field label="New password again" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" />
          <Button onPress={go} busy={busy}>Save password</Button>
          <View style={{ marginTop: 8 }}><Button tone="ghost" onPress={() => { setOpen(false); setNote(null) }}>Cancel</Button></View>
        </>
      )}
    </Card>
  )
}

const STATUS: Record<LoginDevice["status"], { text: string; color: () => string }> = {
  signed_in: { text: "Signed in", color: () => colors.green },
  signed_out: { text: "Signed out", color: () => colors.muted },
  expired: { text: "Session expired", color: () => colors.muted },
}
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "")

/** Where this account is signed in: each phone and browser, when it last signed in, and a way to sign one (or all the others) out. */
function Devices() {
  const list = useLoad(() => api.devices())
  const [busy, setBusy] = useState<number | "all" | null>(null)
  const [note, setNote] = useState<Note>(null)
  const rows = list.data ?? []
  const others = rows.filter((d) => !d.current && d.status === "signed_in").length

  const out = (d: LoginDevice) => Alert.alert("Sign out this device?", `${d.label} will be signed out of your account.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: async () => {
      setBusy(d.id); setNote(null)
      try { await api.signOutDevice(d.id); await list.refresh() } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not sign that device out." }) } finally { setBusy(null) }
    } },
  ])
  const remove = (d: LoginDevice) => Alert.alert("Remove this device?", `${d.label} is signed out and taken off this list. If it signs in again it shows up as a new device.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => {
      setBusy(d.id); setNote(null)
      try { await api.removeDevice(d.id); await list.refresh() } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not remove that device." }) } finally { setBusy(null) }
    } },
  ])
  const outAll = () => Alert.alert("Sign out everywhere else?", "Every other phone and browser will be signed out. This phone stays signed in.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out others", style: "destructive", onPress: async () => {
      setBusy("all"); setNote(null)
      try { await logoutAll(); await list.refresh(); setNote({ ok: true, text: "Signed out everywhere else." }) } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : "Could not sign the others out." }) } finally { setBusy(null) }
    } },
  ])

  return (
    <Card delay={200}>
      <Label>Where you are signed in</Label>
      <Say n={note} />
      {list.error ? <ErrorNote>{list.error}</ErrorNote> : null}
      {!list.loaded ? <Loading /> : rows.length === 0 ? <Muted>No devices yet.</Muted> : (
        <View style={{ gap: 14, marginTop: 4 }}>
          {rows.map((d) => {
            const st = STATUS[d.status]
            return (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${st.color()}22`, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name={d.app ? "phone-portrait-outline" : "desktop-outline"} size={19} color={st.color()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{d.label}{d.current ? " · this phone" : ""}</Text>
                  <Muted numberOfLines={1}><Text style={{ color: st.color(), fontWeight: "700" }}>{st.text}</Text> · last sign-in {when(d.last_signin_at)}</Muted>
                  <Muted numberOfLines={1}>{d.last_ip || d.ip ? `${d.last_ip || d.ip} · ` : ""}{d.last_used_at ? `last used ${when(d.last_used_at)}` : `first seen ${when(d.first_seen_at)}`}</Muted>
                </View>
                {!d.current ? (
                  <View style={{ alignItems: "flex-end", paddingLeft: 10, gap: 8, opacity: busy === d.id ? 0.5 : 1 }}>
                    {d.status === "signed_in" ? <Text onPress={busy ? undefined : () => out(d)} style={{ color: colors.amber, fontSize: 13, fontWeight: "700" }}>Sign out</Text> : null}
                    <Text onPress={busy ? undefined : () => remove(d)} style={{ color: colors.red, fontSize: 13, fontWeight: "700" }}>Remove</Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      )}
      {others > 0 ? <View style={{ marginTop: 16 }}><Button tone="ghost" onPress={outAll} busy={busy === "all"}>Sign out everywhere else</Button></View> : null}
    </Card>
  )
}
