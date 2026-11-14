type Mod = typeof import("expo-speech")
let M: Mod | null = null
try { M = require("expo-speech") as Mod } catch { M = null }  // a build made before this module was added: no speaker button

export const speechAvailable = (): boolean => !!M

/**
 * Read a text aloud with the voice the phone already has (its own text-to-speech: free, nothing is sent anywhere). `language` is a code such as hi-IN. Answers "ok", or "no-voice" when the phone has
 * no voice for that language, so the caller can say so instead of reading Hindi in an English accent.
 */
export async function say(text: string, language: string, h: { onDone: () => void }): Promise<"ok" | "no-voice" | "unavailable"> {
  if (!M) return "unavailable"
  const mod = M
  try {
    await mod.stop()
    const base = language.split("-")[0].toLowerCase()
    const voices = await mod.getAvailableVoicesAsync().catch(() => [])
    if (voices.length && !voices.some((v) => v.language?.toLowerCase().startsWith(base))) return "no-voice"
    mod.speak(text, { language, rate: 0.95, onDone: h.onDone, onStopped: h.onDone, onError: h.onDone })
    return "ok"
  } catch { return "unavailable" }
}

export const hush = () => { void M?.stop().catch(() => {}) }
