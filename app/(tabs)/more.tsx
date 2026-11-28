import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { Alert, Pressable, Text, View } from "react-native"
import { useAuth } from "../../src/auth"
import { CAN_SELL } from "../../src/config"
import { Heading, IconChip } from "../../src/fx"
import { colors } from "../../src/theme"
import { Button, Card, Muted, Row, Screen } from "../../src/ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]
type Item = { icon: IconName; color: string; label: string; route: string; hint: string }
type Group = { title: string; icon: IconName; color: string; items: Item[] }

// grouped as the web's side menu is, each tool with its own colour
const GROUPS = (admin: boolean): Group[] => [
  { title: "Test your ideas", icon: "flask", color: "#a78bfa", items: [
    { icon: "rocket", color: "#f4566e", label: "Forward tests", route: "/forward-tests", hint: "Judge a strategy on the market that comes next" },
    { icon: "library", color: "#a78bfa", label: "Strategies", route: "/strategies", hint: "Saved strategies and backtest results" },
  ] },
  { title: "Know yourself", icon: "bulb", color: "#fbbf24", items: [
    { icon: "bulb", color: "#fbbf24", label: "Trading insights", route: "/insights", hint: "What your journal says about your habits" },
  ] },
  { title: "Account", icon: "person-circle", color: "#60a5fa", items: [
    ...(admin ? [{ icon: "copy" as IconName, color: "#2dd4bf", label: "Copy trading", route: "/copy", hint: "Admin: mirror one MT5 account onto others" }] : []),
    { icon: "wallet", color: "#60a5fa", label: "Accounts", route: "/accounts", hint: "Add, edit, pause or remove your trading accounts" },
    ...(CAN_SELL ? [{ icon: "sparkles" as IconName, color: "#22d38a", label: "Plans and pricing", route: "/plans", hint: "Upgrade for screenshots, live trades and more" }] : []),
    { icon: "settings", color: "#94a3b8", label: "Settings", route: "/settings", hint: "Notifications, app lock, recaps and sign out" },
  ] },
]

export default function More() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const initials = (user?.name || user?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <LinearGradient colors={["#a78bfa", "#60a5fa"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="grid" size={21} color="#0b1020" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 }}>More</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Profile, tools and settings</Text>
        </View>
      </View>

      <Pressable onPress={() => router.push("/profile")}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Row style={{ flex: 1, gap: 14 }}>
              <LinearGradient colors={["#34d399", "#22d3ee", "#60a5fa"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#06241a", fontSize: 19, fontWeight: "800" }}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 }}>{user?.name || "Your profile"}</Text>
                <Muted numberOfLines={1}>{user?.email}</Muted>
                <Row style={{ marginTop: 6 }}><View style={{ backgroundColor: `${colors.green}22`, borderWidth: 1, borderColor: `${colors.green}55`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ color: colors.green, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>{user?.plan ?? "starter"} plan</Text></View></Row>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Row>
        </Card>
      </Pressable>

      {GROUPS(!!user?.is_admin).map((g) => (
        <Card key={g.title}>
          <Heading icon={g.icon} color={g.color}>{g.title}</Heading>
          {g.items.map((it, i) => (
            <Pressable key={it.route} onPress={() => router.push(it.route as never)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${colors.border}cc` }}>
              <IconChip icon={it.icon} color={it.color} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: "600" }}>{it.label}</Text>
                <Muted style={{ fontSize: 12, lineHeight: 17 }}>{it.hint}</Muted>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      ))}

      <View style={{ marginTop: 6 }}>
        <Button tone="danger" onPress={() => Alert.alert("Sign out?", "You will stop receiving alerts on this phone.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: () => void signOut() },
        ])}>Sign out</Button>
      </View>
    </Screen>
  )
}
