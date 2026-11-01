import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import { api, forgetSession, googleSignIn, login as apiLogin, restoreSession, setUnauthorizedHandler, type User } from "./api"
import { stopLiveNotification } from "./liveservice"
import { setBackOnlineHandler } from "./net"
import { flushOutbox, resetOutbox, takeFailed } from "./outbox"
import { unregisterPush } from "./push"
import { setOwner, wipeAll } from "./store"
import { showToast } from "./toast"

type AuthState = { user: User | null; ready: boolean; signIn: (email: string, password: string) => Promise<void>; signInWithGoogle: () => Promise<boolean>; signOut: () => Promise<void>; update: (u: User) => void }
const Ctx = createContext<AuthState | null>(null)

/** Send what was saved while offline and say so. */
async function sendWaiting() {
  const sent = await flushOutbox()
  if (sent) showToast(`Back online · ${sent} change${sent === 1 ? "" : "s"} uploaded`)
  const failed = takeFailed()
  if (failed) showToast(`${failed} saved change${failed === 1 ? "" : "s"} could not be uploaded`, false)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const put = useCallback((u: User | null) => { setOwner(u?.id ?? null); setUser(u) }, [])  // the saved copies belong to this member
  const clear = useCallback(() => { void forgetSession(); void wipeAll(); void resetOutbox(); put(null) }, [put])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    setBackOnlineHandler(() => { void sendWaiting() })
    ;(async () => {
      if (await restoreSession()) {
        try { put(await api.me()) } catch { /* a 401 already cleared it; a network error leaves the phone on the sign-in screen */ }
      }
      setReady(true)
    })()
  }, [clear, put])

  // changes made offline go up when the app opens signed in and whenever it comes back to the front
  useEffect(() => {
    if (!user) return
    void sendWaiting()
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void sendWaiting() })
    return () => sub.remove()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => { put(await apiLogin(email, password)) }, [put])
  const signInWithGoogle = useCallback(async () => { const u = await googleSignIn(); if (u) put(u); return !!u }, [put])
  const signOut = useCallback(async () => {
    await flushOutbox().catch(() => 0) // anything saved offline goes up first
    await stopLiveNotification() // and the live trades in the notification bar
    await unregisterPush() // stop notifications to this phone before the session goes
    clear()
  }, [clear])

  const value = useMemo(() => ({ user, ready, signIn, signInWithGoogle, signOut, update: put }), [user, ready, signIn, signInWithGoogle, signOut, put])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>")
  return c
}
