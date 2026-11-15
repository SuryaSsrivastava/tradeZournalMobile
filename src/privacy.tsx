import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { setHideAmounts } from "./format"

type Storage = typeof import("@react-native-async-storage/async-storage").default
let AsyncStorage: Storage | null = null
try { AsyncStorage = (require("@react-native-async-storage/async-storage") as { default: Storage }).default } catch { AsyncStorage = null }

const KEY = "tz.hide"

type Ctx = { hidden: boolean; loaded: boolean; setHidden: (v: boolean) => void }
const PrivacyCtx = createContext<Ctx>({ hidden: false, loaded: true, setHidden: () => {} })
export const usePrivacy = () => useContext(PrivacyCtx)

/** The choice to hide amounts (balances, profit and loss): kept on the phone, and read before any screen is drawn so nothing shows for a moment first. */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!AsyncStorage) { setLoaded(true); return }
    AsyncStorage.getItem(KEY).then((v) => { setHideAmounts(v === "1"); setHiddenState(v === "1") }).catch(() => {}).finally(() => setLoaded(true))
  }, [])
  const setHidden = useCallback((v: boolean) => { setHideAmounts(v); setHiddenState(v); AsyncStorage?.setItem(KEY, v ? "1" : "0").catch(() => {}) }, [])
  const value = useMemo(() => ({ hidden, loaded, setHidden }), [hidden, loaded, setHidden])
  return <PrivacyCtx.Provider value={value}>{children}</PrivacyCtx.Provider>
}
