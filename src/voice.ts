type Mod = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule
let M: Mod | null = null
try { M = (require("expo-speech-recognition") as typeof import("expo-speech-recognition")).ExpoSpeechRecognitionModule } catch { M = null }  // a build made before this module was added: no microphone button

/** Whether this phone can turn speech into text here (the module is in this build and the phone has a recogniser). */
export const voiceAvailable = (): boolean => { try { return !!M && M.isRecognitionAvailable() } catch { return false } }

/**
 * Listen and turn the speech into text on the phone. `onText` gets everything said so far (it grows while the person talks); `onEnd` runs when listening stops, by itself after a pause or through
 * the returned stop function; `onError` gets the key of a sentence to show (see src/i18n.tsx). Returns a function that stops listening and keeps what was heard, or null when listening could not start.
 */
export async function listen(h: { lang?: string; onText: (text: string) => void; onEnd: () => void; onError: (message: string) => void }): Promise<(() => void) | null> {
  if (!M) return null
  const mod = M
  const ok = await mod.requestPermissionsAsync().catch(() => null)
  if (!ok?.granted) { h.onError("mic_denied"); return null }
  const subs = [
    mod.addListener("result", (e) => { const t = e.results?.[0]?.transcript; if (t) h.onText(t) }),
    mod.addListener("error", (e) => { if (e.error !== "aborted" && e.error !== "no-speech") h.onError(e.error === "not-allowed" ? "mic_denied" : "mic_failed"); }),
    mod.addListener("end", () => { subs.forEach((s) => s.remove()); h.onEnd() }),
  ]
  try { mod.start({ lang: h.lang, interimResults: true, continuous: false, addsPunctuation: true }) } catch { subs.forEach((s) => s.remove()); h.onError("mic_failed"); return null }
  return () => { try { mod.stop() } catch { /* already stopped */ } }
}
