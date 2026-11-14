import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Appearance } from "react-native"
import { applyScheme, resolveScheme, type Scheme, type ThemeMode } from "./theme"

type Storage = typeof import("@react-native-async-storage/async-storage").default
let AsyncStorage: Storage | null = null
try { AsyncStorage = (require("@react-native-async-storage/async-storage") as { default: Storage }).default } catch { AsyncStorage = null }

const KEY = "tz.theme"

// the phone's own setting is known at once, so the first frame is already right for anyone who never changed it here
applyScheme(resolveScheme("system"))

type Ctx = { mode: ThemeMode; scheme: Scheme; setMode: (m: ThemeMode) => void }
const ThemeCtx = createContext<Ctx>({ mode: "system", scheme: "dark", setMode: () => {} })
export const useTheme = () => useContext(ThemeCtx)

/** Holds the Appearance choice (System, Dark or Light). `scheme` changes the colours; children should be keyed on it so every screen is drawn again with them. */
export function ThemeProvider({ children }: { children: (scheme: Scheme) => ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system")
  const [system, setSystem] = useState<Scheme>(() => resolveScheme("system"))

  useEffect(() => {
    AsyncStorage?.getItem(KEY).then((v) => { if (v === "dark" || v === "light" || v === "system") setModeState(v) }).catch(() => {})
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme === "light" ? "light" : "dark"))
    return () => sub.remove()
  }, [])

  const scheme: Scheme = mode === "system" ? system : mode
  applyScheme(scheme)  // before the children are drawn, so they read the new colours

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    AsyncStorage?.setItem(KEY, m).catch(() => {})
  }, [])

  useEffect(() => { try { Appearance.setColorScheme(mode === "system" ? "unspecified" : mode) } catch { /* an older native build: the app's own colours still change */ } }, [mode])

  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme, setMode])
  return <ThemeCtx.Provider value={value}>{children(scheme)}</ThemeCtx.Provider>
}
