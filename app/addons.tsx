import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { useEffect, useState } from "react"
import { AppState, Text, View } from "react-native"
import { api, apiServer, type AddonPack } from "../src/api"
import { CAN_SELL } from "../src/config"
import { CheckMark, Confetti, Pop, success } from "../src/delight"
import { Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { colors } from "../src/theme"
import { Button, Card, ErrorNote, Label, Loading, Muted, Row, Screen } from "../src/ui"

const KEYS: [keyof AddonPack, string, string][] = [["ai_requests", "AI requests", "AI request"], ["explanations", "Trade explanations", "Trade explanation"], ["connected_accounts", "Connected accounts", "Connected account"], ["coach_reviews", "AI coach reviews", "AI coach review"]]
const HELD: [string, string][] = [...KEYS.map(([k, name]) => [k as string, name] as [string, string]), ["strategies", "Saved strategies"]]  // every kind of credit a member can hold
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "")

/** Extra AI requests, explanations, accounts and coach reviews on top of the plan, bought once. Pro and Elite members only; they last as long as the plan does and are used after the plan's own allowance. */
export default function Addons() {
  const router = useRouter()
  const list = useLoad(() => api.addons())
  const credits = useLoad(() => api.addonCredits())
  const usage = useLoad(() => api.planUsage())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<number | null>(null)  // a payment page is open for this order
  const [done, setDone] = useState<string | null>(null)

  const cur = list.data?.currency ?? "USD"
  const money = (v: number) => (cur === "INR" ? `₹${Math.round(v).toLocaleString("en-IN")}` : `$${v % 1 === 0 ? v : v.toFixed(2)}`)
  const paidPlan = !!usage.data && usage.data.plan !== "starter" && !usage.data.lapsed

  const finish = async (label: string) => { setOrder(null); setDone(label); success(); await Promise.all([credits.refresh(), usage.refresh()]) }

  const check = async (id = order) => {
    if (id == null) return
    setBusy("check"); setError(null)
    try {
      const o = await api.refreshOrder(id)
      if (o.status === "paid") await finish(o.label)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the payment.")
    } finally {
      setBusy(null)
    }
  }

  // back from the payment page in the browser: ask where the order stands
  useEffect(() => {
    if (order == null) return
    const listener = AppState.addEventListener("change", (st) => { if (st === "active") void check(order) })
    return () => listener.remove()
  }, [order]) // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (p: AddonPack) => {
    setBusy(p.id); setError(null); setDone(null)
    try {
      const r = await api.buyAddon(p.id)
      if (r.status === "paid") { await finish(r.order.label); return }  // a 100% coupon: nothing to pay
      if (!r.checkout) throw new Error("The payment page could not be opened. Please try again.")
      setOrder(r.order.id)
      await WebBrowser.openBrowserAsync(`${apiServer()}/plans/pay?t=payment&s=${encodeURIComponent(r.checkout.payment_session_id)}&m=${encodeURIComponent(r.checkout.mode)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.")
    } finally {
      setBusy(null)
    }
  }

  if (!CAN_SELL) return <Screen padTop={false}><Muted>Your plan and usage are in Profile.</Muted></Screen>
  // how many are left comes from the plan usage (the same numbers the website shows); when each runs out comes from the credits call, which an older server may not have yet
  const left = (k: string) => usage.data?.credits?.[k] ?? credits.data?.credits[k]?.left ?? 0
  const have = HELD.filter(([k]) => left(k) > 0)

  return (
    <Screen padTop={false} refreshing={list.refreshing} onRefresh={() => { void list.refresh(); void credits.refresh(); void usage.refresh() }}>
      {done ? (
        <Rise><Card style={{ borderColor: `${colors.green}88` }}>
          <Confetti height={200} />
          <Row><Pop><CheckMark size={44} /></Pop><View style={{ marginLeft: 14, flex: 1 }}><Text style={{ color: colors.green, fontSize: 17, fontWeight: "800" }}>{done} added</Text><Muted>The credits are in your account now.</Muted></View></Row>
        </Card></Rise>
      ) : null}

      {usage.loaded && !paidPlan ? (
        <Card style={{ borderColor: `${colors.amber}77` }}>
          <Row><Ionicons name="lock-closed" size={20} color={colors.amber} /><Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", marginLeft: 10, flex: 1 }}>Add-ons are for Pro and Elite</Text></Row>
          <Muted style={{ marginTop: 6, marginBottom: 12 }}>Upgrade your plan first. Then you can top up when you run out, without changing plan.</Muted>
          <Button onPress={() => router.push("/plans" as never)}>See plans</Button>
        </Card>
      ) : null}

      {paidPlan ? (
        <Rise>
          <Card>
            <Label>Your extra credits</Label>
            {!usage.loaded ? <Loading /> : have.length === 0 ? <Muted>None yet. A pack adds credits that are used after your plan's own allowance runs out.</Muted> : have.map(([k, name], i) => (
              <Row key={k} style={{ justifyContent: "space-between", paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: `${colors.border}99` }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{name}</Text>
                <View style={{ alignItems: "flex-end" }}><Text style={{ color: colors.green, fontSize: 15, fontWeight: "800" }}>{left(k)} left</Text>{credits.data?.credits[k]?.expires_at ? <Muted>until {date(credits.data.credits[k].expires_at)}</Muted> : null}</View>
              </Row>
            ))}
          </Card>
        </Rise>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {order != null ? (
        <Card style={{ borderColor: `${colors.blue}77` }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Finished paying?</Text>
          <Muted style={{ marginTop: 4, marginBottom: 12 }}>When you come back from the payment page we check it for you.</Muted>
          <Button onPress={() => void check()} busy={busy === "check"}>Check my payment</Button>
        </Card>
      ) : null}

      <Label>Packs</Label>
      {!list.loaded ? <Loading /> : (list.data?.packs.length ?? 0) === 0 ? <Muted>No packs are on sale right now.</Muted> : list.data!.packs.map((p, i) => {
        return (
          <Rise key={p.id} delay={Math.min(i, 6) * 60}>
            <Card>
              <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1, paddingRight: 10 }}>{p.label}</Text>
                <Text style={{ color: colors.green, fontSize: 22, fontWeight: "900" }}>{money(p.price)}</Text>
              </Row>
              <View style={{ marginTop: 10, gap: 6 }}>
                {KEYS.filter(([k]) => (p[k] as number) > 0).map(([k, many, one]) => (
                  <Row key={k}><Ionicons name="add-circle" size={17} color={colors.green} /><Text style={{ color: colors.text, fontSize: 14, marginLeft: 10 }}>{(p[k] as number).toLocaleString()} {(p[k] as number) === 1 ? one : many}</Text></Row>
                ))}
              </View>
              <View style={{ marginTop: 14 }}><Button onPress={() => void buy(p)} busy={busy === p.id} disabled={!paidPlan || busy !== null}>{paidPlan ? "Buy this pack" : "Pro or Elite only"}</Button></View>
            </Card>
          </Rise>
        )
      })}
      <Muted style={{ textAlign: "center", marginBottom: 8 }}>One-time payment, no renewal. Credits last as long as your plan does{list.data ? ` (or ${list.data.valid_days} days if your plan has no end date)` : ""}, and are used after your plan's own allowance. {cur === "INR" ? "Prices in rupees (₹). " : ""}Payments are handled securely by Cashfree.</Muted>
    </Screen>
  )
}
