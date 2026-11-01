import * as LocalAuthentication from "expo-local-authentication"
import * as SecureStore from "expo-secure-store"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Animated, AppState, Easing, Text, View } from "react-native"
import { useAuth } from "./auth"
import { Ambient } from "./fx"
import { colors } from "./theme"
import { Brand, Button, Muted } from "./ui"

/**
 * App lock: with it on, the app asks for the fingerprint, face or phone PIN when it opens and again when it comes back after more than a short while in the background.
 * It is on by default wherever the phone has a screen lock set up (like banking apps); turning it off in Settings is remembered. The choice is kept on the phone (secure storage), per phone.
 */
const KEY = "tz.lock"
const GRACE_MS = 30_000  // leaving the app for less than this (answering a message) does not lock it

type LockState = { enabled: boolean; supported: boolean; setEnabled: (on: boolean) => Promise<{ ok: boolean; message: string }> }
const Ctx = createContext<LockState>({ enabled: false, supported: false, setEnabled: async () => ({ ok: false, message: "" }) })
export const useLock = () => useContext(Ctx)

const ask = (why: string) => LocalAuthentication.authenticateAsync({ promptMessage: why, cancelLabel: "Cancel", fallbackLabel: "Use PIN" })

export function LockProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const [enabled, setOn] = useState(false)
  const [supported, setSupported] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const started = useRef(false)  // the lock is decided once, when the app opens with someone already signed in: signing in on purpose does not lock you straight out
  const left = useRef<number | null>(null)
  const asking = useRef(false)  // the system prompt itself can push the app to the background: that must not lock it again

  useEffect(() => {
    void (async () => {
      try {
        const can = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
        setSupported(can)
        const saved = await SecureStore.getItemAsync(KEY)  // "1" on, "0" off, nothing yet: on when the phone can do it
        setOn(saved === null ? can : saved === "1" && can)
      } catch { /* no lock */ }
      setLoaded(true)
    })()
  }, [])

  useEffect(() => {
    if (!ready || !loaded || started.current) return
    started.current = true
    setLocked(enabled && !!user)
  }, [ready, loaded, enabled, user])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (asking.current) return
      if (s === "background") left.current = Date.now()
      else if (s === "active" && left.current !== null) {
        if (enabled && Date.now() - left.current > GRACE_MS) setLocked(true)
        left.current = null
      }
    })
    return () => sub.remove()
  }, [enabled])

  const unlock = useCallback(async () => {
    if (asking.current) return
    asking.current = true
    try {
      const r = await ask("Unlock TradeZournal")
      if (r.success) setLocked(false)
    } catch { /* stays locked */ } finally {
      setTimeout(() => { asking.current = false }, 600)
    }
  }, [])

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      if (!supported) return { ok: false, message: "Set up a fingerprint, face or screen lock in your phone's settings first." }
      asking.current = true
      try {
        const r = await ask("Turn on app lock")
        if (!r.success) return { ok: false, message: "Not turned on: the check was not completed." }
      } finally { setTimeout(() => { asking.current = false }, 600) }
    }
    try { await SecureStore.setItemAsync(KEY, on ? "1" : "0") } catch { return { ok: false, message: "Could not save that on this phone." } }
    setOn(on)
    return { ok: true, message: on ? "App lock is on." : "App lock is off." }
  }, [supported])

  const value = useMemo(() => ({ enabled, supported, setEnabled }), [enabled, supported, setEnabled])
  const show = loaded && enabled && locked && !!user
  return (
    <Ctx.Provider value={value}>
      {children}
      {show ? <LockScreen onUnlock={unlock} /> : null}
    </Ctx.Provider>
  )
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { signOut } = useAuth()
  useEffect(() => { onUnlock() }, [onUnlock])  // ask straight away; the button is for trying again
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 32, zIndex: 100 }}>
      <Ambient />
      <Glow><Brand size={72} mark /></Glow>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 22 }}>TradeZournal is locked</Text>
      <Muted style={{ marginTop: 6, marginBottom: 26, textAlign: "center" }}>Use your fingerprint, face or phone PIN to continue.</Muted>
      <View style={{ width: "100%", maxWidth: 320 }}><Button onPress={onUnlock}>Unlock</Button></View>
      <Text onPress={() => void signOut()} style={{ color: colors.muted, fontSize: 13, marginTop: 22, textDecorationLine: "underline" }}>Sign out instead</Text>
    </View>
  )
}

/** Two rings that swell and fade round the logo, over and over, so the lock screen is alive while it waits. */
function Glow({ children }: { children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [t])
  const ring = (offset: number) => {
    const p = t.interpolate({ inputRange: [0, offset, 1], outputRange: [0, 0, 1], extrapolate: "clamp" })
    return <Animated.View style={{ position: "absolute", width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.green, opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }] }} />
  }
  return <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>{ring(0)}{ring(0.35)}{children}</View>
}
