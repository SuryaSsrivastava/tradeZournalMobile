import Constants, { ExecutionEnvironment } from "expo-constants"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import { api, ApiError, restoreSession, type LivePosition } from "./api"

/**
 * "Live trades" in the notification bar (Android): while a trade is open, one notification stays in the bar with its running profit and a timer since it opened, like a delivery or a
 * sale countdown. It is a foreground service (Notifee's) that asks the server for the open trades every few seconds and updates the notification; it stops by itself a little after the
 * last trade closes. It starts from the app (Home, Live trades) while the app is open, because Android does not let an app in the background start one. A trade that opens while the
 * app is closed is announced by a push notification instead; tapping it opens the app, which then starts this.
 *
 * This file is loaded at app start (app/_layout.tsx imports it), since the service has to be registered for Android to start it with no screen. Where Notifee is not there (Expo Go,
 * iPhone, or a build made without LIVE_NOTIFICATION=1) every function here quietly does nothing.
 */
type Notifee = typeof import("@notifee/react-native")
let N: Notifee | null = null
if (process.env.EXPO_PUBLIC_LIVE_NOTIFICATION === "1" && Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try { N = require("@notifee/react-native") as Notifee } catch { N = null }  // eslint-disable-line @typescript-eslint/no-require-imports
}

const CHANNEL = "live-trades"
const ENABLED = "tz.livenotif"
const ACCOUNTS = "tz.livenotif.accounts"
const CAN_CLOSE = "tz.livenotif.canclose"
const HIDDEN = "tz.livenotif.hidden"  // the member pressed the cross: stay hidden until the open trades are over
const POLL_MS = 10_000
const QUIET_POLLS = 3  // this many looks in a row with nothing open ends the service
const FAILED_POLLS = 8  // and this many failures in a row (no connection for over a minute)
let stopNow: (() => void) | null = null

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const liveNotificationAvailable = () => N !== null

export async function liveNotificationEnabled(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(ENABLED)) === "1" } catch { return false }
}

/** Switch it on or off (Settings). Switching off also stops one that is showing. */
export async function setLiveNotificationEnabled(on: boolean): Promise<{ ok: boolean; message: string }> {
  if (!N) return { ok: false, message: "This needs the installed Android app. It is not available in Expo Go." }
  if (on) {
    const perm = await N.default.requestPermission()
    if (perm.authorizationStatus < 1) return { ok: false, message: "Notifications are switched off for TradeZournal in your phone's settings." }
  } else {
    await stopLiveNotification()
  }
  try { await SecureStore.setItemAsync(ENABLED, on ? "1" : "0") } catch { /* it stays as it was */ }
  return { ok: true, message: on ? "On. When a trade is open, it shows in your notification bar." : "Off." }
}

/** Remember which accounts to watch and who may close, then start the service unless it is already showing. Called while the app is open and a trade is open. */
export async function startLiveNotification(accountId: number, canClose: boolean): Promise<void> {
  if (!N || !(await liveNotificationEnabled())) return
  if ((await SecureStore.getItemAsync(HIDDEN).catch(() => null)) === "1") return  // they hid it for this trade
  try {
    const ids = new Set<number>(JSON.parse((await SecureStore.getItemAsync(ACCOUNTS)) ?? "[]"))
    ids.add(accountId)
    await SecureStore.setItemAsync(ACCOUNTS, JSON.stringify([...ids]))
    await SecureStore.setItemAsync(CAN_CLOSE, canClose ? "1" : "0")
    if (stopNow) return  // already running in this process
    const shown = await N.default.getDisplayedNotifications()
    if (shown.some((n) => n.id === CHANNEL)) return  // running (it was started earlier and this screen came back)
    await show(null, [], "$")
  } catch { /* a notification is a nicety: never break the screen that asked for it */ }
}

export async function stopLiveNotification(): Promise<void> {
  if (!N) return
  try { await SecureStore.deleteItemAsync(ACCOUNTS) } catch { /* nothing stored */ }
  stopNow?.()
  try { await N.default.stopForegroundService(); await N.default.cancelNotification(CHANNEL) } catch { /* it was not showing */ }
}

/** The cross on the notification: remove it now and keep it away until the trades that are open now have closed. */
export async function hideLiveNotification(): Promise<void> {
  try { await SecureStore.setItemAsync(HIDDEN, "1") } catch { /* it will simply come back */ }
  await stopLiveNotification()
}

/** Called when nothing is open any more: the next trade shows the notification again. */
export async function clearLiveNotificationHidden(): Promise<void> {
  try { await SecureStore.deleteItemAsync(HIDDEN) } catch { /* nothing stored */ }
}

/** What the notification says for the trades open now. */
async function show(since: number | null, open: LivePosition[], currency: string): Promise<void> {
  if (!N) return
  const { default: notifee, AndroidImportance, AndroidStyle, AndroidForegroundServiceType } = N
  await notifee.createChannel({ id: CHANNEL, name: "Live trades", importance: AndroidImportance.LOW, vibration: false, badge: false })  // LOW: it sits in the bar, silent, never pops up
  const total = open.reduce((sum, p) => sum + p.profit, 0)
  const one = open.length === 1 ? open[0] : null
  const sym = currency && currency !== "USD" ? `${currency} ` : "$"
  const money = (n: number) => `${n >= 0 ? "+" : "-"}${sym}${Math.abs(n).toFixed(2)}`
  const canClose = (await SecureStore.getItemAsync(CAN_CLOSE).catch(() => "0")) === "1"
  await notifee.displayNotification({
    id: CHANNEL,
    title: open.length === 0 ? "Live trades" : `Live trades · ${money(total)}`,
    body: open.length === 0 ? "Looking for your open trades..." : one ? `${one.side.toUpperCase()} ${one.symbol}${one.volume ? ` ${one.volume} lots` : ""} · ${money(one.profit)}` : `${open.length} open trades`,
    android: {
      channelId: CHANNEL,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: "notification_icon",
      color: total >= 0 ? "#22d38a" : "#f4566e",
      ...(since ? { showTimestamp: true, timestamp: since, showChronometer: true, chronometerDirection: "up" as const } : {}),
      ...(open.length > 1 ? { style: { type: AndroidStyle.INBOX, lines: open.slice(0, 6).map((p) => `${p.side.toUpperCase()} ${p.symbol} · ${money(p.profit)}`) } } : {}),
      pressAction: { id: "open", launchActivity: "default" },
      actions: open.length > 0 ? [
        { title: "✕  Hide", pressAction: { id: "hide" } },
        ...(canClose ? [{ title: "Close trade…", pressAction: { id: "review", launchActivity: "default" } }] : []),
      ] : [],
    },
  })
}

if (N) {
  const notifee = N.default
  // Android starts this by itself with no screen. It runs until its promise ends, and the notification stays for exactly that long.
  notifee.registerForegroundService(() => new Promise<void>((done) => {
    let over = false
    stopNow = () => { over = true }
    void (async () => {
      let quiet = 0, failed = 0
      try {
        await restoreSession()  // this may be a fresh process with no screen: sign in again from the phone's secure storage
        while (!over) {
          try {
            const ids: number[] = JSON.parse((await SecureStore.getItemAsync(ACCOUNTS)) ?? "[]")
            if (ids.length === 0) break
            const views = await Promise.all(ids.map((id) => api.accountLive(id).catch((e) => { if (e instanceof ApiError && e.status === 401) throw e; return null })))
            failed = views.every((v) => v === null) ? failed + 1 : 0
            const open = views.flatMap((v) => (v?.state === "live" ? v.positions ?? [] : []))
            const currency = views.find((v) => v?.state === "live")?.currency ?? "USD"
            quiet = open.length === 0 && failed === 0 ? quiet + 1 : 0
            if (quiet >= QUIET_POLLS || failed >= FAILED_POLLS) break
            const opened = open.map((p) => (p.opened_at ? Date.parse(p.opened_at) : NaN)).filter((t) => Number.isFinite(t))
            await show(opened.length ? Math.min(...opened) : null, open, currency)
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) break  // signed out
            failed++
            if (failed >= FAILED_POLLS) break
          }
          await sleep(POLL_MS)
        }
      } finally {
        stopNow = null
        done()
      }
    })()
  }))

  // Taps on the notification are handled by the app when it opens (Gate in app/_layout.tsx); the background handler must still exist or Notifee warns.
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === N!.EventType.ACTION_PRESS && detail.pressAction?.id === "hide") await hideLiveNotification()  // the cross, pressed with the app closed
  })
}

/** Tell the app when the member taps the live notification (or "Close trade…"), so it can open the Live trades screen. */
export function onLiveNotificationPress(open: () => void): () => void {
  if (!N) return () => {}
  const { EventType } = N
  const off = N.default.onForegroundEvent(({ type, detail }) => {
    if (detail.notification?.id !== CHANNEL) return
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === "hide") void hideLiveNotification()  // the cross
    else if (type === EventType.PRESS || type === EventType.ACTION_PRESS) open()
  })
  void N.default.getInitialNotification().then((n) => { if (n?.notification.id === CHANNEL) open() }).catch(() => {})
  return off
}
