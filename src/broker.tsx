import { Ionicons } from "@expo/vector-icons"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView, type WebViewNavigation } from "react-native-webview"
import { api, apiOrigin, apiServer, authHeader, type BrokerInfo } from "./api"
import { colors, radius } from "./theme"
import { Button, Card, ErrorNote, Field, Muted } from "./ui"

const CALLBACK = /\/invest\/(dhan|fyers)\/callback/
const RESULT = /\/portfolio\?(dhan|fyers)=(connected|failed)/

/** Turns the address the server gives ("/api/v1/..." on our own site, or a full broker address) into one a web view can open. */
const absolute = (url: string) => (url.startsWith("/") ? `${apiOrigin()}${url}` : url)
/** The sign-in token goes only to TradeZournal's own server, never to a broker's page. */
const ours = (url: string) => { try { return new URL(url).origin === apiOrigin() } catch { return false } }
const open = (url: string) => ({ uri: url, headers: ours(url) ? authHeader() : undefined })

/**
 * The broker's own login page, inside the app. The broker sends the member back to an TradeZournal address that needs a signed-in session; a web view has none,
 * so that last step is repeated here with the member's token (to our server only) and the page that comes back says whether it worked.
 */
export function BrokerLogin({ url, onClose }: { url: string | null; onClose: (ok: boolean | null) => void }) {
  const insets = useSafeAreaInsets()
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null)
  const [busy, setBusy] = useState(true)
  const sent = useRef("")
  const done = useRef(false)
  useEffect(() => {
    if (url) { sent.current = ""; done.current = false; setBusy(true); setSource(open(absolute(url))) } else setSource(null)
  }, [url])

  const look = (u: string): boolean => {
    // returns false to stop the web view loading this address itself
    if (done.current) return false
    const r = u.match(RESULT)
    if (r) { done.current = true; onClose(r[2] === "connected"); return false }
    if (CALLBACK.test(u) && ours(u) && sent.current !== u) { sent.current = u; setSource({ uri: u, headers: authHeader() }); return false }  // the same step, now as the signed-in member
    return true
  }
  const nav = (e: WebViewNavigation) => { setBusy(e.loading); look(e.url) }

  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={() => onClose(null)}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="lock-closed" size={15} color={colors.green} /><Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Sign in to your broker</Text></View>
          <Pressable onPress={() => onClose(null)} hitSlop={12}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
        </View>
        {source ? (
          <WebView source={source} onShouldStartLoadWithRequest={(r) => look(r.url)} onNavigationStateChange={nav} onLoadEnd={() => setBusy(false)} sharedCookiesEnabled thirdPartyCookiesEnabled setSupportMultipleWindows={false} style={{ flex: 1, backgroundColor: colors.bg }} />
        ) : null}
        {busy ? <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 60, left: 0, right: 0, alignItems: "center" }}><ActivityIndicator color={colors.green} /></View> : null}
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", paddingHorizontal: 20, paddingVertical: 10, paddingBottom: insets.bottom + 10 }}>You sign in on your broker's own page. TradeZournal never sees your broker password.</Text>
      </View>
    </Modal>
  )
}

/** Start the daily login of a broker that is already connected. Returns the address to open, or the reason it cannot. */
export async function loginUrl(linkId: number): Promise<{ url: string } | { error: string }> {
  try { return { url: (await api.startBrokerLogin(linkId)).url } } catch (e) { return { error: e instanceof Error ? e.message : "Could not start the login." } }
}

/** Connect a broker from the phone: one tap where TradeZournal has its own app at the broker, else the broker's details (then its login, where it needs one). */
export function ConnectBroker({ brokers, onLogin, onDone }: { brokers: BrokerInfo[]; onLogin: (url: string) => void; onDone: () => void }) {
  const [pick, setPick] = useState<BrokerInfo | null>(null)
  const [name, setName] = useState("")
  const [vals, setVals] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!pick) {
    return (
      <>
        {brokers.map((b) => (
          <Pressable key={b.id} onPress={() => { setError(null); if (b.oauth) onLogin(`${apiServer()}/invest/oauth/${b.id}/login`); else { setPick(b); setName(b.label); setVals({}) } }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{b.label}</Text>
                  <Muted>{b.oauth ? "Sign in on the broker's page" : "Enter your API details"}</Muted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Card>
          </Pressable>
        ))}
      </>
    )
  }

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const link = await api.connectBroker(pick.id, name.trim() || pick.label, vals)
      if (pick.login && link.needs_login) {
        const r = await loginUrl(link.id)
        if ("url" in r) onLogin(r.url)
        else setError(`${pick.label} is connected. ${r.error}`)
      }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <Pressable onPress={() => setPick(null)} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}><Ionicons name="chevron-back" size={16} color={colors.muted} /><Muted>All brokers</Muted></Pressable>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 6 }}>Connect {pick.label}</Text>
      <Muted style={{ marginBottom: 14, lineHeight: 18 }}>{pick.help}</Muted>
      {error ? <View style={{ marginBottom: 10 }}><ErrorNote>{error}</ErrorNote></View> : null}
      <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
      {pick.fields.map((f) => <Field key={f.key} label={f.label} value={vals[f.key] ?? ""} onChangeText={(v) => setVals((x) => ({ ...x, [f.key]: v }))} secureTextEntry={f.secret} autoCapitalize="none" autoCorrect={false} />)}
      <Button onPress={save} busy={busy}>{pick.login ? "Connect and sign in" : "Connect"}</Button>
    </Card>
  )
}
