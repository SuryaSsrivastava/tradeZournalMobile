import * as Notifications from "expo-notifications"
import { Stack, useRouter, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { AnimatedSplash } from "../src/splash"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { api } from "../src/api"
import { AuthProvider, useAuth } from "../src/auth"
import { LockProvider } from "../src/lock"
import { onLiveNotificationPress } from "../src/liveservice"
import { stopLivePreview } from "../src/livepreview"
import { enqueue, isOfflineError } from "../src/outbox"
import { routeFor } from "../src/push"
import { setShared, type SharedFile } from "../src/sharebox"
import { showToast } from "../src/toast"
import { OfflineBanner } from "../src/offlinebanner"
import { ScopeProvider } from "../src/scope"
import { Toaster } from "../src/toast"
import { colors } from "../src/theme"

// the share handler, when this build has the native module (older development builds do not)
type ShareState = { hasShareIntent: boolean; shareIntent: { files?: SharedFile[] | null }; resetShareIntent: () => void }
let useShare: () => ShareState = () => ({ hasShareIntent: false, shareIntent: {}, resetShareIntent: () => {} })
try { useShare = (require("expo-share-intent") as { useShareIntent: () => ShareState }).useShareIntent } catch { /* no sharing in this build */ }

SplashScreen.setOptions({ duration: 450, fade: true })  // the logo fades into the app instead of cutting
SplashScreen.preventAutoHideAsync().catch(() => {})

function Gate() {
  const { user, ready } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const { hasShareIntent, shareIntent, resetShareIntent } = useShare()

  // a picture was shared to the app: open "Add to a trade" (once signed in)
  useEffect(() => {
    if (!user || !hasShareIntent) return
    const pics = (shareIntent.files ?? []).filter((f) => (f.mimeType ?? "").startsWith("image/"))
    if (pics.length) { setShared(pics); router.push("/share" as never) }
    resetShareIntent()
  }, [user, hasShareIntent, shareIntent, router, resetShareIntent])

  useEffect(() => {
    if (!ready) return
    SplashScreen.hideAsync().catch(() => {})
    if (!user && segments[0] === "auth") {  // Google sign-in has come back to the app: the sign-in screen under it shows the result (or the error), and home follows once the session is made
      if (router.canGoBack()) router.back()
      else router.replace("/login")
      return
    }
    const onLogin = segments[0] === "login" || segments[0] === "auth"
    if (!user && !onLogin) router.replace("/login")
    else if (user && onLogin) router.replace("/")
  }, [ready, user, segments, router])

  // Tapping a push notification opens the screen it is about (also when the app was closed).
  useEffect(() => {
    if (!user) return
    const open = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data as { link?: string; id?: number } | undefined
      if (!r) return
      if (r.actionIdentifier === "hide") { void stopLivePreview(); return }  // the cross on the live-trades preview
      if (r.actionIdentifier === "review") { router.push("/positions" as never); return }  // "Close trade…": the Live trades screen, where closing asks to confirm
      const trade = String(data?.link ?? "").match(/^\/trade\/(\d+)/)
      if (trade && (r.actionIdentifier.startsWith("feel:") || r.actionIdentifier === "note")) {  // a button on the "how did it feel?" notification
        const id = Number(trade[1])
        const tag = r.actionIdentifier.slice(5)
        const text = (r.userText ?? "").trim()
        if (r.actionIdentifier === "note" && !text) { router.push(routeFor(data?.link) as never); return }
        const body = r.actionIdentifier === "note" ? { note: text.slice(0, 500) } : { emotions: [tag] }
        if (data?.id) api.readNotice(Number(data.id)).catch(() => {})
        api.editJournalTrade(id, body).then(() => showToast(r.actionIdentifier === "note" ? "Note saved on the trade" : `Saved: ${tag === "fomo" ? "rushed" : tag}`)).catch(async (e) => {
          if (isOfflineError(e)) { await enqueue({ type: "editTrade", id, body }); showToast("Saved on this phone. It uploads when you are back online.") } else showToast("Could not save that", false)
        })
        router.push(`/trade/${id}` as never)
        return
      }
      if (data?.id) api.readNotice(Number(data.id)).catch(() => {}) // opening a notification counts as reading it (and as an open for a broadcast)
      router.push(routeFor(data?.link) as never)
    }
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {})
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => sub.remove()
  }, [user, router])

  // tapping the live-trades notification in the bar opens the Live trades screen
  useEffect(() => {
    if (!user) return
    return onLiveNotificationPress(() => router.push("/positions"))
  }, [user, router])

  if (!ready) return null
  return (
    <Stack screenOptions={{ animation: "slide_from_right", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/mobile" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="forward/[id]" options={{ title: "Forward test" }} />
      <Stack.Screen name="goals" options={{ title: "Goals and limits" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts" }} />
      <Stack.Screen name="forward-tests" options={{ title: "Forward tests" }} />
      <Stack.Screen name="insights" options={{ title: "Trading insights" }} />
      <Stack.Screen name="price-alerts" options={{ title: "Price alerts" }} />
      <Stack.Screen name="share" options={{ title: "Add to a trade", presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="addons" options={{ title: "Add-on packs" }} />
      <Stack.Screen name="plans" options={{ title: "Plans" }} />
      <Stack.Screen name="badges" options={{ title: "Streaks and badges" }} />
      <Stack.Screen name="positions" options={{ title: "Live trades" }} />
      <Stack.Screen name="calendar" options={{ title: "Calendar" }} />
      <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
      <Stack.Screen name="account/[id]" options={{ title: "Account" }} />
      <Stack.Screen name="add-account" options={{ title: "Add an account", presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="trade/new" options={{ title: "Log a trade", presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="trade/[id]" options={{ title: "Trade" }} />
      <Stack.Screen name="asset/[market]/[symbol]" options={{ title: "" }} />
      <Stack.Screen name="strategies" options={{ title: "Strategies" }} />
      <Stack.Screen name="strategy/[id]" options={{ title: "Strategy" }} />
    </Stack>
  )
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <ScopeProvider><LockProvider><Gate /><OfflineBanner /><Toaster /></LockProvider></ScopeProvider>
        <AnimatedSplash />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
