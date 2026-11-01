import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

/**
 * A preview of the "live trades" notification, made with the notification support the app already has, so it can be seen on a phone before the real one (a foreground service) is built.
 * It stays in the bar and changes its profit every few seconds for a minute, like the real one will. It has no running timer: that needs the real one. Its buttons are the same: a cross that hides it, and one that opens the app to close the trade.
 */
const ID = "live-preview"
const CHANNEL = "live-trades-preview"
let timer: ReturnType<typeof setInterval> | null = null

const money = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`

export const livePreviewAvailable = () => __DEV__ && Platform.OS === "android"  // a developer demo with made-up numbers: only in the dev app, never in a build people install

export async function stopLivePreview() {
  if (timer) clearInterval(timer)
  timer = null
  try { await Notifications.dismissNotificationAsync(ID); await Notifications.cancelScheduledNotificationAsync(ID) } catch { /* it was not showing */ }
}

export async function startLivePreview(): Promise<{ ok: boolean; message: string }> {
  if (!livePreviewAvailable()) return { ok: false, message: "The preview is for Android." }
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status
  if (status !== "granted") return { ok: false, message: "Notifications are switched off for TradeZournal in your phone's settings." }
  await stopLivePreview()
  // the buttons under the notification: a cross that hides it, and one that opens the app to close the trade (the app asks to confirm before closing anything)
  await Notifications.setNotificationCategoryAsync("live-trade", [
    { identifier: "hide", buttonTitle: "✕  Hide", options: { opensAppToForeground: false, isDestructive: true } },
    { identifier: "review", buttonTitle: "Close trade…", options: { opensAppToForeground: true } },
  ])
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Live trades (preview)", importance: Notifications.AndroidImportance.LOW, vibrationPattern: [0], showBadge: false })  // LOW: it sits in the bar, silent
  let pnl = 3.4, left = 24  // a minute at one change every 2.5 seconds
  const post = async () => {
    pnl += (Math.random() - 0.45) * 1.4
    await Notifications.scheduleNotificationAsync({
      identifier: ID,  // the same identifier each time: the notification in the bar is updated, not added to
      content: { title: `Live trades · ${money(pnl)}`, subtitle: "Preview", body: `SHORT BTCUSDTm 0.01 lots · ${money(pnl)}`, sticky: true, autoDismiss: false, categoryIdentifier: "live-trade", color: pnl >= 0 ? "#22d38a" : "#f4566e", priority: Notifications.AndroidNotificationPriority.LOW, data: { link: "/live" } },
      trigger: { channelId: CHANNEL },
    })
    if (--left <= 0) await stopLivePreview()
  }
  await post()
  timer = setInterval(() => { void post() }, 2500)
  return { ok: true, message: "Pull down your notification bar to see it. It updates for a minute, then goes away. This is only a preview with made-up numbers." }
}
