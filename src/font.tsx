import { createContext, forwardRef, useContext } from "react"
import type * as RNTypes from "react-native"
import { useFonts } from "expo-font"

/** Sora, the web's brand typeface, one file per weight (Android picks a font by family name, not by weight). */
export const SORA = {
  "Sora-Light": require("../assets/fonts/Sora-Light.ttf"),
  "Sora-Regular": require("../assets/fonts/Sora-Regular.ttf"),
  "Sora-Medium": require("../assets/fonts/Sora-Medium.ttf"),
  "Sora-SemiBold": require("../assets/fonts/Sora-SemiBold.ttf"),
  "Sora-Bold": require("../assets/fonts/Sora-Bold.ttf"),
  "Sora-ExtraBold": require("../assets/fonts/Sora-ExtraBold.ttf"),
}

/** True once every weight is ready; until then text is in the system font. */
export const useSora = () => useFonts(SORA)[0]

const family = (w: unknown) => {
  const n = w === "bold" ? 700 : w === "normal" || w == null ? 400 : Number(w)
  return n <= 300 ? "Sora-Light" : n < 500 ? "Sora-Regular" : n < 600 ? "Sora-Medium" : n < 700 ? "Sora-SemiBold" : n < 800 ? "Sora-Bold" : "Sora-ExtraBold"
}

/** The style with Sora in the weight it asks for (a style that names its own family is left alone). The weight is removed: the file already is that weight, and a weight on a custom font only makes Android fake it. */
function sora<T>(style: T, nested = false): T {
  const f = RN.StyleSheet.flatten(style as never) as { fontFamily?: string; fontWeight?: unknown } | undefined
  if (f?.fontFamily) return style
  if (nested && f?.fontWeight == null) return style  // a span with no weight of its own takes its parent's
  const { fontWeight, ...rest } = f ?? {}
  return { ...rest, fontFamily: family(fontWeight) } as T
}

// the module object itself (not an import copy of it), so the change reaches every file
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require("react-native") as typeof RNTypes
const Text = RN.Text
const TextInput = RN.TextInput
const Inside = createContext(false)
const SoraText = forwardRef<unknown, RNTypes.TextProps>((props, ref) => {
  const nested = useContext(Inside)
  return <Text {...props} ref={ref as never} style={sora(props.style, nested)}><Inside.Provider value>{props.children}</Inside.Provider></Text>
})
const SoraInput = forwardRef<unknown, RNTypes.TextInputProps>((props, ref) => <TextInput {...props} ref={ref as never} style={sora(props.style)} />)
SoraText.displayName = "Text"
SoraInput.displayName = "TextInput"

// every Text and TextInput in the app comes through here: import this file first (app/_layout.tsx) and the screens, which still say <Text>, are in Sora
try {
  Object.defineProperty(RN, "Text", { get: () => SoraText, configurable: true })
  Object.defineProperty(RN, "TextInput", { get: () => SoraInput, configurable: true })
} catch { /* if the module cannot be changed the app keeps the system font */ }
