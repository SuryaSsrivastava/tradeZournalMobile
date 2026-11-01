// The Expo configuration. Dynamic (instead of app.json) so the Android Firebase file is used only when you have added it.
const fs = require("fs")

const hasFirebase = fs.existsSync("./google-services.json")

// The site the app talks to. Google sign-in returns to https://<this site>/auth/mobile, and the app claims that address (an Android App Link): the website lists this app's package and
// signing key in /.well-known/assetlinks.json, which is how Android knows it may open the app straight from it, with no "open the external app?" question.
let apiHost = "tradezournal.com"
try { apiHost = new URL(process.env.EXPO_PUBLIC_API_URL || "https://tradezournal.com/api/v1").host } catch { /* keep the default */ }

module.exports = {
  expo: {
    name: "TradeZournal",
    slug: "edgelabhub",
    owner: "edgelabhub",
    scheme: "tradezournal",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    icon: "./assets/icon.png",
    backgroundColor: "#0b0e14",
    splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#0b0e14" },
    ios: {
      bundleIdentifier: "com.tradezournal.app",
      supportsTablet: false,
      infoPlist: { UIBackgroundModes: ["remote-notification"], ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: "com.tradezournal.app",
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0b0e14" },
      permissions: ["POST_NOTIFICATIONS"],
      intentFilters: [{ action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: apiHost, pathPrefix: "/auth/mobile" }], category: ["BROWSABLE", "DEFAULT"] }],
      ...(hasFirebase ? { googleServicesFile: "./google-services.json" } : {}),
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      ["expo-share-intent", { disableIOS: true, androidIntentFilters: ["image/*"] }],  // "Share" a screenshot from the gallery or TradingView straight to TradeZournal (Android)
      ["expo-local-authentication", { faceIDPermission: "Use Face ID to unlock TradeZournal." }],
      ...(process.env.LIVE_NOTIFICATION === "1" ? ["./plugins/withLiveService"] : []),  // the live-trades notification: experimental, only in builds that ask for it (profile "live")
      ...(process.env.WIDGET === "1" ? [["react-native-android-widget", { widgets: [{ name: "Today", label: "TradeZournal today", description: "Today's result and your open trades", minWidth: "180dp", minHeight: "110dp", targetCellWidth: 3, targetCellHeight: 2, resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000 }] }]] : []),  // the home-screen widget: only in builds that ask for it (profile "widget")
      ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#22d38a" }],
    ],
    experiments: { typedRoutes: false },
    extra: {
      // `eas init` writes the project id here; it is needed for push tokens
      eas: { projectId: process.env.EAS_PROJECT_ID || "15d1cee2-979f-416d-96cd-65645c7d0844" },
    },
  },
}
