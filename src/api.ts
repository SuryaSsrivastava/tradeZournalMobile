import * as Crypto from "expo-crypto"
import * as Linking from "expo-linking"
import * as SecureStore from "expo-secure-store"
import * as WebBrowser from "expo-web-browser"
import { Platform } from "react-native"
import { DEFAULT_API_URL } from "./config"
import { markOffline } from "./net"

// ---- types: the parts of the TradeZournal API this app reads --------------------------------------------------------------------------------------------------------------------

export type User = { id: number; email: string; name: string; timezone: string; plan: string; is_admin: boolean; plan_expires_at?: string | null; has_password?: boolean; has_google?: boolean; created_at?: string | null }
export type PlanUsage = { credits?: Record<string, number>; plan: string; lapsed: boolean; limits: Record<string, number | null>; used: Record<string, number>; resets_on: string | null; ends_on: string | null }
export type Notice = { id: number; kind: string; title: string; body: string; link: string; read: boolean; created_at: string }
export type Account = {
  goals?: Partial<Goals>
  id: number; name: string; kind: string; broker?: string | null; server?: string | null; is_prop: boolean; status: "active" | "connecting" | "error" | "paused"
  hint: string; prop: {
    balance: number; equity: number; today: number
    state?: "ok" | "warn" | "breached"; basis?: string; trading_days?: number; min_days?: number; profitable_days?: number
    meters?: { key: "daily" | "drawdown"; label: string; limit: number; used: number; left: number; state: "ok" | "warn" | "breached" }[]
    target?: { amount: number; gained: number; progress: number; hit: boolean } | null
  } | null
  starting_balance?: number; rules?: PropRules; last_sync_at?: string | null; last_error?: string; trades_synced?: number; currency?: string | null
}
export type LivePosition = { id: string; symbol: string; side: "Long" | "Short"; volume: number | null; open_price: number | null; price: number | null; stop: number | null; target: number | null; profit: number; swap: number | null; opened_at: string | null }
export type LiveView = { state: "starting" | "live" | "error" | "unsupported" | "ended"; message?: string; positions?: LivePosition[]; balance?: number | null; equity?: number | null; currency?: string; floating?: number; at?: string }
export type ForwardStats = { n: number; wins: number; winRate: number; expectancy: number; profitFactor: number | null; totalR: number; maxDrawdownR: number }
export type Forward = { id: number; name: string; symbol: string; timeframe: string; status: "active" | "stopped"; started_at: string; evaluated_at: string | null; stats: ForwardStats | null; max_trades: number | null }
export type ForwardTrade = { id: number; side: "long" | "short"; entry: number; stop: number; target: number; exit?: number | null; r_multiple?: number | null; entry_at: string; exit_at?: string | null; exit_reason?: string | null }
export type ForwardFull = Forward & { result: { closed: ForwardTrade[]; open: ForwardTrade[]; stats: ForwardStats } | null }
export type EconEvent = { id: string; series: string; time: string; country: string; currency: string; name: string; importance: "high" | "medium" | "low"; actual: string; forecast: string; previous: string; above_forecast: boolean | null }
export type NewsAlerts = { enabled: boolean; currencies: string[]; lead_minutes: number; events: string[] }
export type PropRules = { daily_loss_pct?: number; max_dd_pct?: number; trailing?: boolean; target_pct?: number; min_days?: number }
export type NewAccount = { name: string; kind: "manual" | "metaapi"; starting_balance: number; is_prop: boolean; rules?: PropRules; broker?: "mt5"; login?: string; mt_password?: string; server?: string; platform?: "mt4" | "mt5" }
export type PlanInfo = { label: string; tagline: string; strategies: number | null; explanations: number | null; coach_reviews: number | null; forward_tests: number | null; replay_sessions: number | null; ai_requests: number | null; connected_accounts: number | null; replay_screenshots: boolean; live_positions: boolean; premium_models: boolean; support: string }
export type Pricing = { currency: "USD" | "INR"; tiers: Record<string, { monthly: number; yearly: number; list: number }>; offer: { label: string; ends_at: string | null } | null }
export type SubscriptionInfo = { id: number; plan: string; period: "monthly" | "yearly"; currency: string; amount: number; status: string; next_charge_at: string | null; access_until: string | null; cancel_requested: boolean; failed_count: number; last_error: string; last_payment_at: string | null }
export type AddonPack = { id: string; label: string; price: number; ai_requests: number; explanations: number; connected_accounts: number; coach_reviews: number }
export type AddonList = { currency: "USD" | "INR"; packs: AddonPack[]; valid_days: number; paid_only: boolean }
export type CreditRow = { left: number; expires_at: string | null }
export type PlanCoupon = { ok: boolean; error?: string; label?: string; code?: string; currency?: "USD" | "INR"; tiers?: Record<string, { monthly: number; yearly: number; billed_yearly: number }> }
export type AddonOrder = { id: number; status: string; label: string }
export type BrokerLink = { id: number; broker: "dhan" | "fyers" | "angel"; label: string; name: string; status: "active" | "error"; error: string; alias: string; balance: number | null; needs_login?: boolean }
export type Holding = { symbol: string; name: string; exchange: string; qty: number; avg: number; ltp: number | null; invested: number; value: number | null; pnl: number | null; pnl_pct: number | null; day_pnl: number | null; link_id: number; broker: string; broker_label: string; account: string }
export type Portfolio = { holdings: Holding[]; problems: { link_id: number; name: string; error: string }[]; totals: { invested: number; value: number; pnl: number; pnl_pct: number | null; day_pnl: number; day_pct: number | null; unpriced: number; count: number }; cached_at?: number }
export type WatchStock = { id: number; market: string; symbol: string; name: string; added_price: number | null; added_at: string; price: number | null; chg_1d: number | null; pe: number | null; market_cap: number | null; sector: string; investable: boolean }
export type InvestOrder = { id: number; broker: string; side: string; symbol: string; qty: number; order_type: string; price: number | null; status: string; broker_order_id: string; message: string; created_at: string }
export type JournalTrade = {
  id: number; symbol: string; side: "Long" | "Short"; setup: string; entry: number; exit: number; qty: number; risk: number; opened_at: string; exit_at: string | null
  emotions: string[]; tags: string[]; rating: number; note: string; source: string; broker: string; fees: number; pnl: number | null
  stop: number | null; target: number | null; followed_plan: boolean | null; account_id: number | null; manual: boolean
}
export type NewTrade = { symbol: string; side: "Long" | "Short"; entry: number; exit: number; qty: number; risk: number; setup?: string; rating?: number; note?: string; emotions?: string[]; tags?: string[]; followed_plan?: boolean | null }
export type TradeEdit = { note?: string; rating?: number; setup?: string; emotions?: string[]; tags?: string[]; followed_plan?: boolean | null }
export type Market = "nse" | "us" | "crypto" | "forex"
export type ScreenRow = { symbol: string; name: string; sector: string; market: string; price?: number | null; chg_1d?: number | null; ret_1y?: number | null; market_cap?: number | null; pe?: number | null; roe?: number | null; div_yield?: number | null; volume_24h?: number | null; [k: string]: unknown }
export type ScreenResult = { total: number; matched: number; updated_at: string | null; rows: ScreenRow[] }
export type ScreenSpec = { filters: { field: string; op: string; value: number | string }[]; sort?: { field: string; dir: "asc" | "desc" } | null; search?: string; limit?: number | null }
export type AssetDetail = { symbol: string; name: string; sector: string; industry: string; market: Market; metrics: Record<string, number | null>; history: [number, number][]; about: string; website: string; facts: Record<string, unknown>; peers: { symbol: string; name: string; price: number | null; pe: number | null; ret_1y: number | null }[] }
export type BacktestStats = { trades: number; win_rate?: number; expectancy_r?: number; total_r?: number; profit_factor?: number | null; max_drawdown_pct?: number; max_drawdown_r?: number; return_pct?: number; avg_win_r?: number; avg_loss_r?: number; sqn?: number | null; backtest_id?: number }
export type StrategyRow = { s: { id: number; name: string; description: string; version: number; updated_at: string; shared_by?: string | null }; stats: BacktestStats | null; symbol: string | null; provider: string; runs: number }
export type BacktestTrade = { id: number; symbol: string; side: string; entry_at: string; exit_at: string; entry: number; exit: number; r_multiple: number; exit_reason: string; session: string }
export type ManualShot = { id: number; trade_id: number; caption: string; thumb: string; created_at: string }
export type ReplayShot = { id: number; session_id: number; trade_id: number | null; caption: string; thumb: string; created_at: string }
export type BrokerInfo = { id: "dhan" | "fyers" | "angel"; label: string; fields: { key: string; label: string; secret: boolean }[]; help: string; login: boolean; oauth: boolean }
export type Goals = { max_trades_day: number | null; max_daily_loss: number | null; max_losses_in_row: number | null; daily_goal: number | null; monthly_goal: number | null; profit_target: number | null }
export type Rules = Goals & { checklist: string[] }
export type Meter = { key: string; label: string; kind: "limit" | "goal"; limit: number; value: number; state: "ok" | "warn" | "breached" | "achieved"; text: string; period: "day" | "month" | "total" }
export type DisciplineScope = { scope: string; account_id: number | null; meters: Meter[] }
export type Prefs = { push: boolean; promos?: boolean; digest?: boolean; daily_recap?: boolean; monthly_report?: boolean; [k: string]: unknown }
export type PriceAlert = { id: number; symbol: string; name: string; direction: "above" | "below"; price: number; created_at: string; triggered_at: string | null; triggered_price: number | null }
export type MarketQuote = { symbol: string; name: string; category: string; price: number | null; change_pct: number | null }

// ---- the connection -----------------------------------------------------------------------------------------------------------------------------------------------------------

const TOKEN_KEY = "tz.token"
const SERVER_KEY = "tz.server"

let token: string | null = null
let server: string = DEFAULT_API_URL
let onUnauthorized: () => void = () => {}

export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }
export const apiServer = () => server
/** The address TradeZournal itself answers on (no path), so a link can be checked to be ours before the sign-in token is sent along with it. */
export const apiOrigin = () => { try { return new URL(server).origin } catch { return "" } }
export const authHeader = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {})

export async function restoreSession(): Promise<boolean> {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY)
    const saved = await SecureStore.getItemAsync(SERVER_KEY)
    server = saved && validServer(saved) ? saved : DEFAULT_API_URL  // a half-typed address saved earlier must never replace the built-in one
  } catch { token = null }
  return !!token
}

/** A full web address: http(s)://host... (anything else, like "/api/", cannot be reached). */
export const validServer = (url: string) => /^https?:\/\/[^\s/]+(\/\S*)?$/i.test(url.trim())

export async function saveServer(url: string) {
  const clean = url.trim().replace(/\/+$/, "")
  server = clean && validServer(clean) ? clean : DEFAULT_API_URL
  try { await SecureStore.setItemAsync(SERVER_KEY, server) } catch { /* keep it for this run */ }
}

export async function forgetSession() {
  token = null
  try { await SecureStore.deleteItemAsync(TOKEN_KEY) } catch { /* nothing stored */ }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "x-tz-Client": "mobile", ...(init.headers as Record<string, string> | undefined) }
  if (init.body) headers["Content-Type"] = "application/json"
  if (auth && token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${server}${path}`, { ...init, headers })
  } catch {
    markOffline(true)
    throw new ApiError(0, "Can't reach TradeZournal. Check your connection.")
  }
  markOffline(false)  // any answer at all means we are connected
  if (res.status === 401 && auth) { onUnauthorized(); throw new ApiError(401, "Your session ended. Sign in again.") }
  if (!res.ok) {
    let detail = `Something went wrong (${res.status}).`
    try { const j = await res.json(); if (typeof j.detail === "string") detail = j.detail } catch { /* not JSON */ }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function startSession(r: { user: User; access_token: string }): Promise<User> {
  token = r.access_token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  return r.user
}

export async function login(email: string, password: string): Promise<User> {
  return startSession(await request<{ user: User; access_token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }, false))
}

const b64url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_state: "That Google sign-in did not match this phone. Try again.",
  google_failed: "Google could not complete the sign-in. Try again.",
  google_unverified: "Your Google email address is not verified.",
  google_not_configured: "Google sign-in is not set up on the server yet.",
  disabled: "This account is disabled.",
}

/**
 * Sign in with Google in the phone's secure browser sheet. The app keeps a secret and gives the server only its hash; the server answers with a one-time code in the app's own address
 * (tradezournal://auth), and the code plus the secret are traded for a normal session. Returns null when the person closes the sheet.
 */
export async function googleSignIn(): Promise<User | null> {
  const verifier = b64url(btoa(String.fromCharCode(...Crypto.getRandomBytes(32))))  // 43 characters
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }))
  // Android comes back through the site's web address, which the app has proved it owns (so no "open the external app?" question); iPhone through the app's own address
  const viaLink = Platform.OS === "android" && apiOrigin().startsWith("https://")
  const back = viaLink ? `${apiOrigin()}/auth/mobile` : "tradezournal://auth"
  const result = await WebBrowser.openAuthSessionAsync(`${server}/auth/google/login?mobile_challenge=${challenge}${viaLink ? "&mobile_return=link" : ""}`, back)
  if (result.type !== "success") return null
  const q = Linking.parse(result.url).queryParams ?? {}
  if (typeof q.error === "string") throw new ApiError(400, GOOGLE_ERRORS[q.error] ?? "Google sign-in did not work. Try again.")
  if (typeof q.code !== "string") throw new ApiError(400, "Google sign-in did not finish. Try again.")
  return startSession(await request<{ user: User; access_token: string }>("/auth/google/mobile", { method: "POST", body: JSON.stringify({ code: q.code, verifier }) }, false))
}

export const api = {
  me: () => request<User>("/auth/me"),
  updateProfile: (b: { name?: string; timezone?: string }) => request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(b) }),
  changePassword: (current: string | null, next: string) => request<void>("/auth/password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) }),
  planUsage: () => request<PlanUsage>("/plans/usage"),
  notices: (limit = 40) => request<{ items: Notice[]; unread: number }>(`/notifications?limit=${limit}`),
  readNotice: (id: number) => request<void>(`/notifications/${id}/read`, { method: "POST" }),
  readAll: () => request<void>("/notifications/read-all", { method: "POST" }),
  clearNotices: () => request<void>("/notifications", { method: "DELETE" }),
  prefs: () => request<Prefs>("/notifications/prefs"),
  savePrefs: (b: Partial<Prefs>) => request<Prefs>("/notifications/prefs", { method: "PUT", body: JSON.stringify(b) }),
  registerDevice: (tokenValue: string, platform: string, name: string) => request<void>("/notifications/devices", { method: "POST", body: JSON.stringify({ token: tokenValue, platform, name }) }),
  unregisterDevice: (tokenValue: string) => request<void>(`/notifications/devices?token=${encodeURIComponent(tokenValue)}`, { method: "DELETE" }),
  testPush: () => request<void>("/notifications/devices/test", { method: "POST" }),
  accounts: () => request<{ accounts: Account[] }>("/accounts"),
  updateTradingAccount: (id: number, b: { name?: string; is_prop?: boolean; starting_balance?: number; rules?: PropRules; paused?: boolean }) => request<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  removeTradingAccount: (id: number, deleteTrades: boolean) => request<void>(`/accounts/${id}?delete_trades=${deleteTrades}`, { method: "DELETE" }),
  addAccount: (b: NewAccount) => request<Account>("/accounts", { method: "POST", body: JSON.stringify(b) }),
  closePosition: (accountId: number, positionId: string) => request<{ closed: boolean }>(`/accounts/${accountId}/positions/${encodeURIComponent(positionId)}/close`, { method: "POST" }),
  /** Read an account's new trades from MetaTrader now. `auto` is the app doing it by itself on opening the account: the same sync, without the "your trades are in" notice. */
  syncAccount: (id: number, auto = false) => request<{ added: number; error: string | null; connecting?: boolean; skipped?: boolean }>(`/accounts/${id}/sync?auto=${auto}`, { method: "POST" }),
  accountLive: (id: number) => request<LiveView>(`/accounts/${id}/live`),
  forwardTests: () => request<Forward[]>("/forward"),
  setForwardStatus: (id: number, status: "active" | "stopped") => request<Forward>(`/forward/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteForward: (id: number) => request<void>(`/forward/${id}`, { method: "DELETE" }),
  forwardTest: (id: number) => request<ForwardFull>(`/forward/${id}`),
  calendar: (importance: string, countries: string[]) =>
    request<{ events: EconEvent[]; available: boolean }>(`/market/economic-calendar?importance=${importance}&countries=${encodeURIComponent(countries.join(","))}&back=1&ahead=7`),
  investBrokers: () => request<{ brokers: BrokerInfo[] }>("/invest/brokers"),
  connectBroker: (broker: string, name: string, credentials: Record<string, string>) => request<BrokerLink>("/invest/links", { method: "POST", body: JSON.stringify({ broker, name, credentials }) }),
  startBrokerLogin: (linkId: number) => request<{ url: string }>(`/invest/links/${linkId}/login`, { method: "POST" }),
  investLinks: () => request<{ links: BrokerLink[] }>("/invest/links"),
  investPortfolio: (linkId?: number, fresh?: boolean) => request<Portfolio>(`/invest/portfolio?${linkId ? `link_id=${linkId}&` : ""}${fresh ? "refresh=true" : ""}`),
  investWatchlist: () => request<{ stocks: WatchStock[] }>("/invest/screened"),
  investOrders: () => request<{ orders: InvestOrder[] }>("/invest/orders"),
  investChart: (symbol: string) => request<{ symbol: string; history: [number, number][] }>(`/invest/chart/${encodeURIComponent(symbol)}`),
  journalTrades: (limit = 300) => request<JournalTrade[]>(`/journal/trades?limit=${limit}`),
  addJournalTrade: (b: NewTrade) => request<JournalTrade>("/journal/trades", { method: "POST", body: JSON.stringify(b) }),
  editJournalTrade: (id: number, b: TradeEdit) => request<JournalTrade>(`/journal/trades/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  addTradeShot: (id: number, b: { image: string; thumb: string; caption: string }) => request<ManualShot>(`/journal/trades/${id}/shots`, { method: "POST", body: JSON.stringify(b) }),
  deleteJournalTrade: (id: number) => request<void>(`/journal/trades/${id}`, { method: "DELETE" }),
  screen: (market: Market, spec: ScreenSpec, offset = 0, page = 50) => request<ScreenResult>("/screener/query", { method: "POST", body: JSON.stringify({ market, spec, offset, page }) }),
  asset: (market: string, symbol: string) => request<AssetDetail>(`/screener/${market}/${encodeURIComponent(symbol)}`),
  strategies: (limit = 30) => request<StrategyRow[]>(`/strategies/overview?limit=${limit}&skip_forward=true`),
  backtestTrades: (id: number) => request<BacktestTrade[]>(`/backtests/${id}/trades`),
  rules: () => request<Rules>("/journal/rules"),
  saveRules: (b: Rules) => request<Rules>("/journal/rules", { method: "PUT", body: JSON.stringify(b) }),
  saveAccountGoals: (id: number, goals: Goals) => request<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ goals }) }),
  discipline: () => request<{ scopes: DisciplineScope[] }>("/journal/discipline"),
  journalShotCounts: () => request<Record<string, number>>("/journal/screenshot-counts"),
  tradeShots: (id: number) => request<ManualShot[]>(`/journal/trades/${id}/shots`),
  tradeShotImage: (id: number) => request<{ image: string }>(`/journal/shots/${id}/image`),
  journalTradeShots: (id: number) => request<ReplayShot[]>(`/journal/trades/${id}/screenshots`),
  replayShotImage: (id: number) => request<{ image: string }>(`/replay/screenshots/${id}/image`),
  plans: () => request<Record<string, PlanInfo>>("/plans", {}, false),
  pricing: () => request<Pricing>("/plans/pricing", {}, false),
  subscription: () => request<{ subscription: SubscriptionInfo | null }>("/plans/subscription"),
  subscribe: (plan: string, period: "monthly" | "yearly", coupon = "") => request<{ subscription: SubscriptionInfo; checkout: { subscription_session_id: string; mode: string } }>("/plans/subscribe", { method: "POST", body: JSON.stringify({ plan, period, coupon }) }),
  refreshSubscription: () => request<{ subscription: SubscriptionInfo | null }>("/plans/subscription/refresh", { method: "POST" }),
  cancelSubscription: () => request<{ subscription: SubscriptionInfo | null }>("/plans/subscription/cancel", { method: "POST" }),
  addons: () => request<AddonList>("/plans/addons", {}, false),
  addonCredits: () => request<{ credits: Record<string, CreditRow> }>("/plans/addons/credits"),
  checkPlanCoupon: (code: string) => request<PlanCoupon>("/plans/coupons/plans", { method: "POST", body: JSON.stringify({ code }) }),
  buyAddon: (packId: string) => request<{ status: "paid" | "pending"; checkout: { payment_session_id: string; mode: string } | null; order: AddonOrder }>("/plans/addons/checkout", { method: "POST", body: JSON.stringify({ pack_id: packId }) }),
  refreshOrder: (id: number) => request<AddonOrder>(`/plans/addons/orders/${id}/refresh`, { method: "POST" }),
  deleteAccount: (confirmEmail: string) => request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ confirm_email: confirmEmail.trim() }) }),
  priceAlerts: () => request<{ items: PriceAlert[]; max_open: number }>("/notifications/price-alerts"),
  addPriceAlert: (b: { symbol: string; direction: "above" | "below"; price: number }) => request<PriceAlert>("/notifications/price-alerts", { method: "POST", body: JSON.stringify(b) }),
  removePriceAlert: (id: number) => request<void>(`/notifications/price-alerts/${id}`, { method: "DELETE" }),
  quotes: () => request<{ symbols: MarketQuote[] }>("/market/symbols?provider=forex"),
  newsAlerts: () => request<NewsAlerts>("/notifications/news-alerts"),
  saveNewsAlerts: (b: NewsAlerts) => request<NewsAlerts>("/notifications/news-alerts", { method: "PUT", body: JSON.stringify(b) }),
}
