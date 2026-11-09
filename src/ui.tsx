import { ActivityIndicator, Animated, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRef, type ReactNode } from "react"
import { Ambient, Glass, Rise, Skeleton } from "./fx"
import { colors, radius } from "./theme"

export function Screen({ children, refreshing, onRefresh, scroll = true, padTop = true }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; padTop?: boolean }) {
  const insets = useSafeAreaInsets()
  const y = useRef(new Animated.Value(0)).current
  const pad = { paddingTop: padTop ? insets.top + 8 : 0, paddingHorizontal: 16, paddingBottom: 32 }
  if (!scroll) return <View style={s.screen}><Ambient /><View style={[{ flex: 1 }, pad]}>{children}</View></View>
  return (
    <View style={s.screen}>
      <Ambient scrollY={y} />
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.card} /> : undefined}>
        {children}
      </Animated.ScrollView>
    </View>
  )
}

/** The TradeZournal symbol and wordmark. `size` is the height of the symbol; `mark` shows the symbol alone. */
export function Brand({ size = 34, mark = false }: { size?: number; mark?: boolean }) {
  const h = Math.round(size * 0.42)
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Image source={require("../assets/logo-mark.png")} style={{ width: size, height: size, borderRadius: size * 0.24 }} />
      {mark ? null : <Image source={require("../assets/logo-wordmark.png")} resizeMode="contain" style={{ width: h * 8.56, height: h, marginLeft: size * 0.3 }} />}
    </View>
  )
}

export const Title = ({ children, sub, right, brand }: { children: ReactNode; sub?: string; right?: ReactNode; brand?: boolean }) => (
  <View style={{ marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    {brand ? <View style={{ marginRight: 12 }}><Brand size={38} mark /></View> : null}
    <View style={{ flex: 1, paddingRight: 10 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
    {right}
  </View>
)

export const Card = ({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) => <Rise delay={delay}><Glass style={style}>{children}</Glass></Rise>

export const Label = ({ children }: { children: ReactNode }) => <Text style={s.label}>{children}</Text>

export const Muted = ({ children, style, numberOfLines }: { children: ReactNode; style?: object; numberOfLines?: number }) => <Text numberOfLines={numberOfLines} style={[s.muted, style]}>{children}</Text>

export function Pill({ children, active, onPress, color }: { children: ReactNode; active?: boolean; onPress?: () => void; color?: string }) {
  const c = color ?? colors.green
  return (
    <Pressable onPress={onPress} style={[s.pill, active && { borderColor: c, backgroundColor: `${c}22` }]} hitSlop={6}>
      <Text style={[s.pillText, active && { color: colors.text }]}>{children}</Text>
    </Pressable>
  )
}

export function Button({ children, onPress, busy, tone = "primary", disabled }: { children: ReactNode; onPress?: () => void; busy?: boolean; tone?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const bg = tone === "primary" ? colors.green : "transparent"
  const fg = tone === "primary" ? "#04110b" : tone === "danger" ? colors.red : colors.text
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: tone === "primary" ? colors.green : tone === "danger" ? `${colors.red}88` : colors.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{children}</Text>}
    </Pressable>
  )
}

export const Empty = ({ title, text }: { title: string; text?: string }) => (
  <View style={s.empty}>
    <Text style={s.emptyTitle}>{title}</Text>
    {text ? <Text style={[s.muted, { textAlign: "center", marginTop: 4 }]}>{text}</Text> : null}
  </View>
)

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <View style={s.error}><Text style={{ color: colors.red, fontSize: 13 }}>{children}</Text></View>
)

export const Loading = () => (
  <View style={{ paddingVertical: 12, gap: 10 }}>
    <Skeleton height={26} width="55%" round={10} />
    <Skeleton height={14} width="85%" />
    <Skeleton height={14} width="70%" />
  </View>
)

export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>

export const tone = (n: number | null | undefined) => (n == null || n === 0 ? colors.text : n > 0 ? colors.green : colors.red)

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: `${colors.card}d9`, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 12 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  pillText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  btn: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", minHeight: 46 },
  btnText: { fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  error: { backgroundColor: `${colors.red}18`, borderColor: `${colors.red}55`, borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 12 },
})

export function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 }, props.multiline && { minHeight: 90, textAlignVertical: "top" }, props.style]} />
    </View>
  )
}
