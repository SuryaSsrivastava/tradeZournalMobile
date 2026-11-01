import * as Device from "expo-device"
import Constants, { ExecutionEnvironment } from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { api } from "./api"

// Show a notification even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

let registered: string | null = null

/** Where a notification's `link` (a web path such as /forward/12) should take the member inside the app. */
export function routeFor(link?: string | null): string {
  const l = link ?? ""
  const tr = l.match(/^\/trade\/(\d+)/)
  if (tr) return `/trade/${tr[1]}`
  const fwd = l.match(/^\/forward\/(\d+)/)
  if (fwd) return `/forward/${fwd[1]}`
  if (l.startsWith("/calendar")) return "/calendar"
  if (l.startsWith("/markets/")) return "/price-alerts"
  if (l.startsWith("/live") || l.startsWith("/accounts")) return "/positions"
  return "/alerts"
}

/** Ask for permission, get this phone's Expo push token and tell the server about it. Returns a short status the Settings screen can show. */
export async function registerForPush(): Promise<{ ok: boolean; message: string }> {
  if (!Device.isDevice) return { ok: false, message: "Push notifications need a real phone, not a simulator." }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return { ok: false, message: "Push notifications do not work in Expo Go. Install the app build to use them." }
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("alerts", {
        name: "Alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#22d38a",
      })
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Could not set up the notification channel." }
    }
  }
  try {  // the buttons on the "how did it feel?" notification: two feelings and a reply box, each saved on the trade
    await Notifications.setNotificationCategoryAsync("trade-review", [
      { identifier: "feel:calm", buttonTitle: "😌 Calm", options: { opensAppToForeground: true } },
      { identifier: "feel:fomo", buttonTitle: "😬 Rushed", options: { opensAppToForeground: true } },
      { identifier: "note", buttonTitle: "✏️ Add note", textInput: { submitButtonTitle: "Save", placeholder: "What happened?" }, options: { opensAppToForeground: true } },
    ])
  } catch { /* the notification still arrives, without buttons */ }
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status
  if (status !== "granted") return { ok: false, message: "Notifications are switched off for EdgeLabHub in your phone's settings." }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId || Constants.easConfig?.projectId
  if (!projectId) return { ok: false, message: "This build has no Expo project id, so it cannot receive push notifications. See the README (eas init)." }
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    await api.registerDevice(token, Platform.OS, Device.deviceName ?? Device.modelName ?? "")
    registered = token
    return { ok: true, message: "Push notifications are on for this phone." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not turn push notifications on." }
  }
}

/** Sign-out: stop pushing to this phone. */
export async function unregisterPush() {
  if (!registered) return
  try { await api.unregisterDevice(registered) } catch { /* the server forgets a dead phone by itself */ }
  registered = null
}
