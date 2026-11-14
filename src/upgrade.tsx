import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { api, type PlanUsage } from "./api"
import { CAN_SELL } from "./config"
import { colors } from "./theme"
import { Button, ErrorNote, Muted } from "./ui"

/** The server says "Your Starter plan includes 1 saved strategy. Upgrade to Pro for more." when a plan limit is hit. */
export const isPlanLimit = (m: string) => /\bplan\b.*\b(includes|does not include)\b/i.test(m)

/** An error message; when it is a plan limit, a button to the plans (in builds that may sell). Store builds drop the sales sentence from the message and show no button. */
export function PlanNote({ message }: { message: string }) {
  const router = useRouter()
  const plan = isPlanLimit(message)
  const shown = CAN_SELL ? message : message.replace(/\s*(Upgrade to|Buy an add-on).*$/i, "").trim()
  return (
    <>
      <ErrorNote>{shown}</ErrorNote>
      {plan && CAN_SELL ? <Button tone="ghost" onPress={() => router.push("/plans" as never)}>See plans</Button> : null}
      {plan && CAN_SELL && /add-on pack/i.test(message) ? <View style={{ marginTop: 8 }}><Button tone="ghost" onPress={() => router.push("/addons" as never)}>Buy an add-on pack</Button></View> : null}
    </>
  )
}

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }) : "")

/**
 * Shown when the server refuses an AI request because the allowance is spent (402). It looks up the plan to say what can be done: a plan whose time is still running can be topped up with an
 * add-on pack, a plan that has ended is renewed, a free one is upgraded. Store builds show the situation and the reset date but no way to pay.
 */
export function AllowanceBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  const router = useRouter()
  const [u, setU] = useState<PlanUsage | null>(null)
  useEffect(() => { api.planUsage().then(setU).catch(() => {}) }, [])
  const lapsed = !!u?.lapsed || /plan has ended/i.test(message)
  const free = u?.plan === "starter"
  const title = lapsed ? "Your plan has ended" : "You are out of AI requests"
  const when = !lapsed && u?.resets_on ? `Your allowance comes back on ${day(u.resets_on)}.` : ""
  const go = (path: string) => router.push(path as never)
  return (
    <View style={{ backgroundColor: `${colors.amber}14`, borderColor: `${colors.amber}66`, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name="flash-outline" size={20} color={colors.amber} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginLeft: 8, flex: 1 }}>{title}</Text>
        {onClose ? <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <Muted style={{ marginTop: 6 }}>{CAN_SELL ? message : message.replace(/\s*(Upgrade to|Renew or upgrade|You can also buy|they come back when you renew).*$/i, "").trim() || "You have used this month's AI requests."}{when ? ` ${when}` : ""}</Muted>
      {CAN_SELL ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          {lapsed ? <View style={{ flex: 1 }}><Button onPress={() => go("/plans")}>Renew plan</Button></View> : free ? <View style={{ flex: 1 }}><Button onPress={() => go("/plans")}>Upgrade</Button></View> : (
            <>
              <View style={{ flex: 1 }}><Button onPress={() => go("/addons")}>Top up</Button></View>
              <View style={{ flex: 1 }}><Button tone="ghost" onPress={() => go("/plans")}>See plans</Button></View>
            </>
          )}
        </View>
      ) : null}
    </View>
  )
}
