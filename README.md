# TradeZournal mobile

The TradeZournal phone app for Android and iOS (React Native with Expo). It is a separate project: it talks to your existing TradeZournal server through the normal API and keeps no data of its own.

**What it does:** sign in with your TradeZournal account; push notifications (trades your forward tests open, economic releases you follow, rule warnings); live open positions of your MetaTrader account; the economic calendar with a bell to follow events; forward test results; settings. It never opens a broker order. It writes your journal entries (log, edit, delete), and on the Live trades screen an admin can close an open trade, which asks for confirmation first, the same as on the website.

## 1. Run it on your phone while you develop

```bash
npm install
cp .env.example .env        # then edit it: EXPO_PUBLIC_API_URL=https://your-domain/api/v1
npx expo start
```
Scan the QR code with **Expo Go** (Android or iPhone) to try the screens. Push notifications do not work in Expo Go: for those, make a development or preview build (step 3).

The sign-in screen has an **Advanced** link to point the app at a different server (for example a staging copy) without rebuilding.

## 2. One-time setup for push notifications

The TradeZournal server already has what it needs (a `push_devices` table, `POST /notifications/devices`, a job that sends new notifications every 30 seconds through Expo's push service). On the phone side:

1. Make a free account at https://expo.dev and run `npx eas-cli login`.
2. In this folder run `npx eas-cli init`. It prints a **project id**; put it in `.env` as `EAS_PROJECT_ID=...` and in your shell when you build (`EAS_PROJECT_ID=... eas build ...`), or paste it into `app.config.js` (`extra.eas.projectId`).
3. **Android:** create a Firebase project (https://console.firebase.google.com), add an Android app with package name `com.tradezournal.app`, download `google-services.json` into this folder (it is git-ignored and picked up automatically). Then, in the Firebase console, Project settings, Service accounts, generate a private key and upload it with `npx eas-cli credentials` (Android, Push Notifications (FCM V1)).
4. **iOS:** needs an Apple Developer account (99 USD a year). EAS creates the push key for you the first time you build: `npx eas-cli build -p ios`.

## 3. Build the apps

Set your server in `eas.json` (replace `YOUR-DOMAIN` in the two `EXPO_PUBLIC_API_URL` lines), then:

```bash
# Android: an installable .apk you can host on your own site (the download page links to it)
EAS_PROJECT_ID=your-id npx eas-cli build -p android --profile preview

# Android: a Play Store bundle (.aab)
EAS_PROJECT_ID=your-id npx eas-cli build -p android --profile production

# iOS: for TestFlight and the App Store
EAS_PROJECT_ID=your-id npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios
```
EAS builds in the cloud, so you do not need Android Studio or Xcode. When the Android build finishes it gives a download link for the `.apk`.

## 4. Put the links on the website

Open `tradezournal-frontend/lib/mobile-app.ts` in the TradeZournal repo and fill in the three links (the `.apk`, the Play Store page, the TestFlight or App Store page). The page at `/app` shows only the ones you have set.

## Notes

- Signed in for 30 days at a time; the sign-in token lives in the phone's secure storage (Keychain / Keystore).
- Turning notifications off in Settings stops pushes to every phone on your account; signing out stops them for that phone.
- The Positions screen opens the same live view as the website, which keeps the broker connection (and its hourly meter) running while you look. It closes by itself soon after you leave the screen.
