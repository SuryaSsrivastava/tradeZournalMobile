import { useCallback, useEffect, useState } from "react"

type Storage = typeof import("@react-native-async-storage/async-storage").default
let AsyncStorage: Storage | null = null
try { AsyncStorage = (require("@react-native-async-storage/async-storage") as { default: Storage }).default } catch { AsyncStorage = null }

const PREFIX = "tz.hint."

/** A hint shown until the member has seen it once (and kept on the phone): `show` is false while it is still being looked up, so nothing flashes. `done` ends it for good. */
export function useHint(id: string) {
  const [seen, setSeen] = useState<boolean | null>(null)
  useEffect(() => { AsyncStorage?.getItem(PREFIX + id).then((v) => setSeen(v === "1")).catch(() => setSeen(true)) ?? setSeen(true) }, [id])
  const done = useCallback(() => { setSeen(true); AsyncStorage?.setItem(PREFIX + id, "1").catch(() => {}) }, [id])
  return { show: seen === false, done }
}
