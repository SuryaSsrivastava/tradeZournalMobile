import { Appearance } from "react-native"

export type ThemeMode = "system" | "dark" | "light"
export type Scheme = "dark" | "light"

const palettes = {
  dark: {
    bg: "#0b0e14",
    card: "#131722",
    cardHi: "#181d2b",
    offer: "#16121c",
    border: "#222838",
    text: "#e8eaf0",
    muted: "#8b93a7",
    green: "#22d38a",
    red: "#f4566e",
    amber: "#fbbf24",
    blue: "#38bdf8",
  },
  light: {
    bg: "#f4f6fa",
    card: "#ffffff",
    cardHi: "#eef1f7",
    offer: "#ffffff",
    border: "#dde2ec",
    text: "#141a26",
    muted: "#5d667a",
    green: "#0e9f64",  // darker than the dark theme's green so it reads on white
    red: "#d93a54",
    amber: "#b7791f",
    blue: "#0a85b8",
  },
} as const

/**
 * The colours in use right now. One object that is changed in place when the theme changes, so every `colors.x` read picks up the new value. Screens are remounted on a change (see
 * src/themeprovider.tsx); anything built once at load time goes through `themed` so it is rebuilt too.
 */
export const colors: { [K in keyof (typeof palettes)["dark"]]: string } = { ...palettes.dark }

let scheme: Scheme = "dark"
let version = 0

export const currentScheme = () => scheme
export const resolveScheme = (mode: ThemeMode): Scheme => (mode === "system" ? (Appearance.getColorScheme() === "light" ? "light" : "dark") : mode)

export function applyScheme(next: Scheme) {
  if (next === scheme && version > 0) return
  scheme = next
  version += 1
  Object.assign(colors, palettes[next])
  Object.assign(impactColor, { high: colors.red, medium: colors.amber })
}

/** A value built from `colors` (a StyleSheet, a lookup of tones), rebuilt after each theme change. Use it exactly like the plain object. */
export function themed<T extends object>(build: () => T): T {
  let seen = -1
  let value: T
  const get = () => { if (seen !== version) { value = build(); seen = version } return value }
  return new Proxy({} as T, {
    get: (_, k) => Reflect.get(get(), k),
    has: (_, k) => Reflect.has(get(), k),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, k) => { const d = Reflect.getOwnPropertyDescriptor(get(), k); return d ? { ...d, configurable: true } : d },
  })
}

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 }
export const impactColor = { high: colors.red, medium: colors.amber, low: "#5b6275" } as { high: string; medium: string; low: string }
