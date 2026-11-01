import { useRouter } from "expo-router"
import { View } from "react-native"
import { CAN_SELL } from "./config"
import { Button, ErrorNote } from "./ui"

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
