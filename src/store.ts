type Storage = typeof import("@react-native-async-storage/async-storage").default
let AsyncStorage: Storage | null = null
try { AsyncStorage = (require("@react-native-async-storage/async-storage") as { default: Storage }).default } catch { AsyncStorage = null }  // a build made before this module was added: no saved copies, everything else works

/**
 * Saved copies of what the app has loaded, so it still shows something with no connection, and the list of changes waiting to be uploaded. Kept per signed-in member and wiped when they
 * sign out. This lives in the app's private storage on the phone (the app lock guards opening the app); the sign-in token itself stays in the secure store.
 */
const PREFIX = "tz.v1."
const MAX_CHARS = 1_500_000  // one saved copy this big or more is skipped rather than risk the storage limit
let owner = "anon"

export const setOwner = (id: number | null) => { owner = id == null ? "anon" : String(id) }
const key = (k: string) => `${PREFIX}${owner}.${k}`

export async function read<T>(k: string): Promise<T | null> {
  try { const v = await AsyncStorage?.getItem(key(k)); return v ? (JSON.parse(v) as T) : null } catch { return null }
}

export async function write(k: string, value: unknown): Promise<void> {
  try {
    const s = JSON.stringify(value)
    if (s.length < MAX_CHARS) await AsyncStorage?.setItem(key(k), s)
  } catch { /* not saved: the app works the same, just not offline */ }
}

export async function wipeAll(): Promise<void> {
  try { const keys = (await AsyncStorage?.getAllKeys() ?? []).filter((x) => x.startsWith(PREFIX) && !x.endsWith(".outbox")); if (keys.length) await AsyncStorage?.multiRemove(keys) } catch { /* nothing to wipe */ }
}
