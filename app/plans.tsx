import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { useEffect, useRef, useState } from "react"
import { Alert, AppState, Text, View } from "react-native"
import { api, apiServer, type PlanCoupon, type SubscriptionInfo } from "../src/api"
import { CAN_SELL } from "../src/config"
import { CheckMark, Confetti, Pop, success } from "../src/delight"
import { Press, Rise } from "../src/fx"
import { useLoad } from "../src/hooks"
import { OfferTile } from "../src/offer"
import { colors } from "../src/theme"
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Pill, Row, Screen } from "../src/ui"

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "")
const n = (v: number | null | undefined, one: string, many: string) => (v == null ? `Unlimited ${many}` : `${v.toLocaleString()} ${v === 1 ? one : many}`)

/** Plans and pricing, in rupees in India and dollars elsewhere. Only the downloaded app sells (see CAN_SELL): store builds never reach this screen's buying parts. */
export default function Plans() {
  const router = useRouter()
  const info = useLoad(() => api.plans())
  const price = useLoad(() => api.pricing())
  const usage = useLoad(() => api.planUsage())
  const sub = useLoad(() => api.subscription())
  const [yearly, setYearly] = useState(true)  // yearly first, as on the website
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)  // the payment page is open in the browser
  const [paid, setPaid] = useState(false)
  const [code, setCode] = useState("")
  const [coupon, setCoupon] = useState<PlanCoupon | null>(null)  // a coupon that checked out: its lowered prices replace the shown ones
  const [couponNote, setCouponNote] = useState<string | null>(null)
  const lastPlan = useRef<string | null>(null)

  const current = usage.data?.plan ?? "starter"
  const s: SubscriptionInfo | null = sub.data?.subscription ?? null
  const live = !!s && ["active", "past_due"].includes(s.status)
  const cur = price.data?.currency ?? "USD"
  const money = (v: number) => (cur === "INR" ? `₹${Math.round(v).toLocaleString("en-IN")}` : `$${v % 1 === 0 ? v : v.toFixed(2)}`)

  const check = async () => {
    setBusy("check"); setError(null)
    try {
      const r = await api.refreshSubscription()
      await Promise.all([usage.refresh(), sub.refresh()])
      if (r.subscription && r.subscription.status === "active") { setPaid(true); setWaiting(false); success() }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the payment.")
    } finally {
      setBusy(null)
    }
  }

  // back from the browser: ask the server where the payment stands
  useEffect(() => {
    if (!waiting) return
    const listener = AppState.addEventListener("change", (st) => { if (st === "active") void check() })
    return () => listener.remove()
  }, [waiting]) // eslint-disable-line react-hooks/exhaustive-deps

  const upgrade = async (plan: string) => {
    setBusy(plan); setError(null); setPaid(false)
    try {
      const r = await api.subscribe(plan, yearly ? "yearly" : "monthly", coupon?.code ?? "")
      lastPlan.current = plan
      setWaiting(true)
      await WebBrowser.openBrowserAsync(`${apiServer()}/plans/pay?s=${encodeURIComponent(r.checkout.subscription_session_id)}&m=${encodeURIComponent(r.checkout.mode)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the payment page.")
    } finally {
      setBusy(null)
    }
  }

  const applyCoupon = async () => {
    if (!code.trim()) return
    setBusy("coupon"); setCouponNote(null)
    try {
      const r = await api.checkPlanCoupon(code.trim())
      if (r.ok && r.tiers && r.currency === cur) setCoupon(r)
      else { setCoupon(null); setCouponNote(r.ok ? "Prices changed currency. Please apply the coupon again." : r.error ?? "That coupon is not valid.") }
    } catch (e) {
      setCouponNote(e instanceof Error ? e.message : "Could not check the coupon.")
    } finally {
      setBusy(null)
    }
  }

  const stop = () => Alert.alert("Cancel the renewal?", `Your plan stays until ${date(s?.access_until) || "the end of the period you paid for"}, then it does not renew.`, [
    { text: "Keep it", style: "cancel" },
    { text: "Cancel renewal", style: "destructive", onPress: async () => { setBusy("cancel"); try { await api.cancelSubscription(); await sub.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Could not cancel.") } finally { setBusy(null) } } },
  ])

  if (!CAN_SELL) return <Screen padTop={false}><Card><Label>Your plan</Label><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", textTransform: "capitalize" }}>{current}</Text><Muted style={{ marginTop: 4 }}>{usage.data?.ends_on ? `Active until ${date(usage.data.ends_on)}` : "Your plan and usage are in Profile."}</Muted></Card></Screen>

  const tiers = ["pro", "elite"].filter((id) => price.data?.tiers[id] && info.data?.[id])
  // every price the server sends is a price PER MONTH: `monthly` when billed monthly, `yearly` when billed yearly (twelve of them are charged at once), `list` the usual price
  const savings = (id: string) => { const t = price.data?.tiers[id]; return t && t.monthly > 0 ? Math.round((1 - t.yearly / t.monthly) * 100) : 0 }
  const topSave = Math.max(0, ...tiers.map(savings))
  const bestOff = Math.max(0, ...Object.values(price.data?.tiers ?? {}).flatMap((t) => [t.monthly, t.yearly].map((v) => (t.list > 0 ? Math.round((1 - v / t.list) * 100) : 0))))  // the biggest discount on offer, as on the website

  return (
    <Screen padTop={false} refreshing={price.refreshing} onRefresh={() => { void price.refresh(); void usage.refresh(); void sub.refresh() }}>
      {paid ? (
        <Rise><Card style={{ borderColor: `${colors.green}88` }}>
          <Confetti height={220} />
          <Row><Pop><CheckMark size={44} /></Pop><View style={{ marginLeft: 14, flex: 1 }}><Text style={{ color: colors.green, fontSize: 18, fontWeight: "800" }}>You are on {current[0].toUpperCase() + current.slice(1)}</Text><Muted>Thank you. Screenshots, live trades and the rest are unlocked.</Muted></View></Row>
        </Card></Rise>
      ) : null}

      <Rise>
        <Card>
          <Label>Your plan</Label>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", textTransform: "capitalize" }}>{current}</Text>
            {live && s ? <Text style={{ color: s.cancel_requested ? colors.amber : colors.green, fontSize: 12, fontWeight: "800" }}>{s.status === "past_due" ? "PAYMENT FAILED" : s.cancel_requested ? "ENDS SOON" : "RENEWS AUTOMATICALLY"}</Text> : null}
          </Row>
          {live && s ? <Muted style={{ marginTop: 4 }}>{s.cancel_requested ? `Not renewing. Your plan stays until ${date(s.access_until)}.` : `${money(s.amount)} ${s.period === "yearly" ? "a year" : "a month"} · next payment ${date(s.next_charge_at)}`}</Muted> : <Muted style={{ marginTop: 4 }}>{current === "starter" ? "The free plan. Upgrade for more room and the features below." : `Active until ${date(usage.data?.ends_on)}`}</Muted>}
          {live && s && !s.cancel_requested ? <View style={{ marginTop: 12 }}><Button tone="ghost" onPress={stop} busy={busy === "cancel"}>Cancel the renewal</Button></View> : null}
        </Card>
      </Rise>

      {price.data?.offer && bestOff > 0 ? <OfferTile label={price.data.offer.label} endsAt={price.data.offer.ends_at} best={bestOff} /> : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {current !== "starter" && !usage.data?.lapsed ? (
        <Rise delay={70}>
          <Press onPress={() => router.push("/addons" as never)}>
            <Card><Row style={{ justifyContent: "space-between" }}><Row style={{ flex: 1 }}><Ionicons name="add-circle" size={24} color={colors.green} /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Running low? Buy an add-on pack</Text><Muted>Extra AI requests, accounts and reviews. Your plan stays as it is.</Muted></View></Row><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Row></Card>
          </Press>
        </Rise>
      ) : null}

      {!live ? (
        <Card style={{ borderColor: coupon ? `${colors.green}77` : colors.border }}>
          <Row style={{ gap: 10, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><Field label="Have a coupon?" value={code} onChangeText={(v) => { setCode(v); setCoupon(null); setCouponNote(null) }} autoCapitalize="characters" autoCorrect={false} placeholder="Enter code" /></View>
            <View style={{ marginTop: 22 }}><Button tone="ghost" onPress={() => void applyCoupon()} busy={busy === "coupon"}>Apply</Button></View>
          </Row>
          {coupon ? <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700", marginTop: -4 }}>{coupon.label} applied. The prices below include it, and it also lowers every renewal while you stay subscribed.</Text> : null}
          {couponNote ? <Text style={{ color: colors.red, fontSize: 13, marginTop: -4 }}>{couponNote}</Text> : null}
        </Card>
      ) : null}

      {waiting ? (
        <Card style={{ borderColor: `${colors.blue}77` }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Finished paying?</Text>
          <Muted style={{ marginTop: 4, marginBottom: 12 }}>When you come back from the payment page we check it for you. Banks can take a minute.</Muted>
          <Button onPress={() => void check()} busy={busy === "check"}>Check my payment</Button>
        </Card>
      ) : null}

      {!price.loaded || !info.loaded ? <Loading /> : (
        <>
          <Row style={{ justifyContent: "center", marginTop: 4, marginBottom: 6 }}>
            <Pill active={!yearly} onPress={() => setYearly(false)}>Monthly</Pill>
            <Pill active={yearly} onPress={() => setYearly(true)}>{topSave > 0 ? `Yearly · save ${topSave}%` : "Yearly"}</Pill>
          </Row>
          {tiers.map((id, i) => {
            const p = info.data![id], t = price.data!.tiers[id]
            const before = yearly ? t.yearly : t.monthly  // the price with no coupon
            const c = coupon?.tiers?.[id]
            const perMonth = c ? (yearly ? c.yearly : c.monthly) : before
            // struck through: the price before the coupon, or (with no coupon) the usual price while an offer runs, as on the website
            const usual = c ? (perMonth < before ? before : null) : price.data!.offer && perMonth > 0 && t.list > perMonth ? t.list : null
            const off = usual ? Math.round((1 - perMonth / usual) * 100) : 0
            const saved = Math.round(((c ? coupon!.tiers![id].monthly : t.monthly) - perMonth) * 12) * (yearly ? 1 : 0)  // what paying yearly saves over twelve monthly payments
            const billedYearly = c ? c.billed_yearly : perMonth * 12
            const gst = cur === "INR" ? " · GST included" : ""
            const here = current === id && !usage.data?.lapsed
            return (
              <Rise key={id} delay={80 + i * 80}>
                <Card style={{ borderColor: id === "pro" ? `${colors.green}77` : colors.border }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{p.label}</Text>
                    {id === "pro" ? <View style={{ backgroundColor: `${colors.green}22`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}><Text style={{ color: colors.green, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 }}>MOST POPULAR</Text></View> : null}
                  </Row>
                  <Muted style={{ marginTop: 2 }}>{p.tagline}</Muted>
                  <Row style={{ alignItems: "flex-end", marginTop: 10 }}>
                    {usual ? <Text style={{ color: colors.muted, fontSize: 15, marginRight: 8, marginBottom: 6, textDecorationLine: "line-through" }}>{money(usual)}</Text> : null}
                    <Text style={{ color: colors.green, fontSize: 34, fontWeight: "900", letterSpacing: -1 }}>{money(perMonth)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 14, marginLeft: 4, marginBottom: 6 }}>/ month</Text>
                    {off > 0 ? <View style={{ backgroundColor: colors.amber, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10, marginBottom: 7 }}><Text style={{ color: "#1a1203", fontSize: 10.5, fontWeight: "900" }}>{off}% OFF</Text></View> : null}
                  </Row>
                  {yearly && saved > 0 ? <View style={{ alignSelf: "flex-start", backgroundColor: `${colors.green}1f`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 }}><Text style={{ color: colors.green, fontSize: 12, fontWeight: "800" }}>Save {money(saved)} a year vs monthly billing</Text></View> : null}
                  <Muted style={{ marginTop: 6 }}>{yearly ? `Billed ${money(billedYearly)} yearly${usual ? `, instead of ${money(usual * 12)}` : ""}${gst}` : `Billed monthly${gst}`}</Muted>
                  <View style={{ marginTop: 12, gap: 7 }}>
                    <Feature on text={n(p.connected_accounts, "connected account", "connected accounts")} />
                    <Feature on={p.replay_screenshots} text="Trade screenshots, with zoom" />
                    <Feature on={p.live_positions} text="Live trades, with close" />
                    <Feature on text={n(p.forward_tests, "forward test", "forward tests")} />
                    <Feature on text={n(p.strategies, "saved strategy", "saved strategies")} />
                    <Feature on text={`${n(p.ai_requests, "AI request", "AI requests")} a month`} />
                    <Feature on={(p.coach_reviews ?? 0) > 0} text={`${n(p.coach_reviews, "AI coach review", "AI coach reviews")} a month`} />
                    <Feature on={p.premium_models} text="The best AI models" />
                    <Feature on text={`${p.support} support`} />
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <Button onPress={() => void upgrade(id)} busy={busy === id} disabled={here || live || busy !== null}>{here ? "Your plan" : live ? "Cancel the current renewal to switch" : `Upgrade to ${p.label}`}</Button>
                  </View>
                </Card>
              </Rise>
            )
          })}
          <Muted style={{ textAlign: "center", marginTop: 2, marginBottom: 8 }}>{cur === "INR" ? "Prices in rupees (₹), with UPI AutoPay." : "Prices in US dollars."} Subscriptions renew automatically until you cancel, here, any time. Payments are handled securely by Cashfree.</Muted>
        </>
      )}
    </Screen>
  )
}

function Feature({ on, text }: { on: boolean; text: string }) {
  return (
    <Row>
      <Ionicons name={on ? "checkmark-circle" : "close-circle-outline"} size={18} color={on ? colors.green : colors.muted} />
      <Text style={{ color: on ? colors.text : colors.muted, fontSize: 14, marginLeft: 10, flex: 1 }}>{text}</Text>
    </Row>
  )
}
