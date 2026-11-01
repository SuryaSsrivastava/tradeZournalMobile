import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { Alert, Pressable, Text, View } from "react-native"
import { useAuth } from "../../src/auth"
import { CAN_SELL } from "../../src/config"
import { colors } from "../../src/theme"
import { Button, Card, Muted, Row, Screen, Title } from "../../src/ui"

type IconName = React.ComponentProps<typeof Ionicons>["name"]
const MENU: [IconName, string, string, string][] = [
  ["rocket-outline", "Forward tests", "/forward-tests", "Judge a strategy on the market that comes next"],
  ["bulb-outline", "Trading insights", "/insights", "What your journal says about your habits"],
  ...(CAN_SELL ? [["sparkles-outline", "Plans and pricing", "/plans", "Upgrade for screenshots, live trades and more"] as [IconName, string, string, string]] : []),
  ["gift-outline", "Partner offers", "/partners", "Prop firms and brokers, with offers for you"],
  ["wallet-outline", "Accounts", "/accounts", "Add, edit, pause or remove your trading accounts"],
  ["alarm-outline", "Price alerts", "/price-alerts", "Be told when a market reaches your price"],
  ["library-outline", "Strategies", "/strategies", "Saved strategies and backtest results"],
  ["settings-outline", "Settings", "/settings", "Notifications, app lock, recaps and sign out"],
]

export default function More() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  return (
    <Screen>
      <Title brand sub="Profile, tools and settings">More</Title>
      <Pressable onPress={() => router.push("/profile")}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Row style={{ flex: 1 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${colors.green}22`, borderWidth: 1.5, borderColor: colors.green, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.green, fontSize: 18, fontWeight: "800" }}>{(user?.name || user?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}</Text>
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{user?.name || "Your profile"}</Text>
                <Muted numberOfLines={1}>{user?.email}</Muted>
                <Row style={{ marginTop: 5 }}><View style={{ backgroundColor: `${colors.green}22`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ color: colors.green, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>{user?.plan ?? "starter"} plan</Text></View></Row>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Row>
        </Card>
      </Pressable>

      <Card style={{ paddingVertical: 4 }}>
        {MENU.map(([icon, label, route, hint], i) => (
          <Pressable key={route} onPress={() => router.push(route as never)} style={{ paddingVertical: 13, borderBottomWidth: i === MENU.length - 1 ? 0 : 1, borderBottomColor: `${colors.border}99` }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.green}1a`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={18} color={colors.green} /></View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
                  <Muted>{hint}</Muted>
                </View>
              </Row>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Row>
          </Pressable>
        ))}
      </Card>

      <View style={{ marginTop: 18 }}>
        <Button tone="danger" onPress={() => Alert.alert("Sign out?", "You will stop receiving alerts on this phone.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: () => void signOut() },
        ])}>Sign out</Button>
      </View>
    </Screen>
  )
}
