import Constants from "expo-constants"

/**
 * Where the TradeZournal API lives. Set EXPO_PUBLIC_API_URL when building (see eas.json); the sign-in screen can also override it at run time
 * (handy for testing against a staging server). It ends in /api/v1.
 */
export const DEFAULT_API_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || "https://tradezournal.com/api/v1"

export const WEBSITE_URL = DEFAULT_API_URL.replace(/\/api\/v1\/?$/, "")

/**
 * Whether this build may sell: show prices, upgrade buttons and the way to pay. It is true for the app downloaded from the website, and false for builds made for Google Play and the App Store
 * (profile "production" sets EXPO_PUBLIC_STORE_BUILD=1). The stores take 15 to 30 percent of anything sold through an app they distribute, and their rules do not let a store app point people
 * to another way to pay, so a store build shows a member's plan and usage but never a price, an upgrade button or a purchase link; plans are managed on the website.
 */
export const CAN_SELL = process.env.EXPO_PUBLIC_STORE_BUILD !== "1"
