# Releasing TradeZournal mobile

How a version gets from this folder to people's phones. Version 1.0.0 goes out as a direct APK download from the website; Google Play and the App Store come later (see the end).

## Before you start (once per release)
1. **Deploy the website and backend** (`tradezournal-web`). The app depends on them:
   - Google sign-in returning to the app (`/auth/mobile` page and `/.well-known/assetlinks.json`),
   - the trade open/close pushes,
   - the download route for the installer.
2. **On the server**, next to `docker-compose.prod.yml`, make the folder the installer lives in, then recreate Caddy so it mounts the folder and loads the new `deploy/Caddyfile`:
   ```bash
   mkdir -p downloads
   docker compose -f docker-compose.prod.yml up -d caddy
   ```
3. Check the ownership file is live (Android uses it to open the app straight from the Google sign-in return):
   ```bash
   curl -s https://tradezournal.com/.well-known/assetlinks.json
   ```
   It must print the JSON with package `com.tradezournal.app`. Its fingerprint is the one of the EAS signing key; every APK from this project uses that key.

## Build
```bash
git add -A && git commit -m "Release 1.0.0" && git tag v1.0.0   # a build you can reproduce
npx eas-cli build -p android --profile release                  # an installable .apk; the Android version number goes up by itself
```
The `release` profile is `preview` with an automatic version number, so a later APK always installs over an earlier one. The download link appears when the build finishes (about 15 to 20 minutes).

## Test the APK before anyone else gets it
Uninstall every TradeZournal on the test phone (including the dev app), install the new APK, and check:
- [ ] The app opens (a release build once failed to open: this is the check that catches that).
- [ ] Sign in with email and password. Sign out. Sign in with **Continue with Google**: it should return to the app with no "open the external app?" question.
- [ ] Home loads: Today, Live trades (with a trade open), guard rails, ticker, market sessions.
- [ ] Journal: all three tabs, log a trade, open a day on the Calendar tab, open a screenshot and zoom.
- [ ] Markets: search, open a stock. Portfolio: broker sign-in if you use one.
- [ ] More → Settings → **Send a test notification** arrives. Developer items are not visible (no Preview buttons, no server address, no "Advanced" on sign-in).
- [ ] Profile: edit the name, change nothing else, sign out.

## Publish
1. Copy the APK to the server (the path and user are yours; the key is `tradezournal-key.pem`):
   ```bash
   scp -i tradezournal-key.pem tradezournal-1.0.0.apk <user>@<server>:<folder with docker-compose.prod.yml>/downloads/
   ```
   Download it first from the build page (`curl -L -o tradezournal-1.0.0.apk "<link from the build>"`). EAS keeps build files for a limited time, so the copy on your server is the permanent one.
2. In `tradezournal-frontend/lib/mobile-app.ts` set the link, then deploy the website:
   ```ts
   androidApk: "/downloads/tradezournal-1.0.0.apk",
   ```
3. Check it from outside: `curl -I https://tradezournal.com/downloads/tradezournal-1.0.0.apk` should say `200` and `application/vnd.android.package-archive`. Then open `https://tradezournal.com/app` on an Android phone and install from the button.

Because the file is not from Google Play, Android asks to allow installs from the browser, and Play Protect may say it does not know the app ("More details", then "Install anyway"). The download page tells people this.

## The next version
Bump `version` in `app.config.js` and in `tradezournal-frontend/lib/mobile-app.ts`, build with the same `release` profile, test, upload under a **new file name** (`tradezournal-1.1.0.apk`), and change the link. Keep the old file for a while.

## Before Google Play or the App Store (not done yet)
- **Account deletion.** Both stores require a way to delete an account from inside the app, plus a web page for the store form, because the app lets people create an account (Google sign-in does). The app side is built (Profile, bottom: "Delete my account", calls `DELETE /auth/me`). Still to do: deploy the backend for it, and a public web page / privacy-policy line that says how to delete an account (the store forms ask for a link).
- Google Play: a Play Console account, `eas build --profile production` (an .aab), the store listing, the Data safety form, the financial-features declaration and a content rating. Add Play's app-signing key fingerprint to `assetlinks.json` next to the current one, or Google sign-in will show the "open the external app?" question again for Play installs.
- App Store: an Apple Developer account, an iOS build, and a universal-links setup for Google sign-in (Android's `assetlinks.json` does not cover iPhone).
- The live-trades notification bar (`LIVE_NOTIFICATION=1`, profile `live`) is not in normal builds: it needs a device test first.

## Version 1.1 features (price alerts, app lock, share cards, recaps, streaks/badges, account deletion, widget)
- **Backend first.** The server half is applied in `tradezournal-web/tradezournal-backend` (uncommitted): `DELETE /auth/me`, `/notifications/price-alerts`, migration `0098`, the engagement notices (post-trade prompt, morning briefing, streak reminder) and three new notification prefs. Commit, push, pull on the server, run `alembic upgrade head`, and rebuild/restart the api **and** the alerts worker and beat (the new celery tasks are `check_price_alerts`, `send_morning_briefings`, `send_streak_reminders`). Until then the new screens show an error; everything else works.
- **New native modules** (a new build is needed, no OTA): `expo-local-authentication` (app lock), `react-native-view-shot` and `expo-sharing` (share cards), `expo-share-intent` (share a screenshot to the app), `expo-image-manipulator` (shrinks it) and `@react-native-async-storage/async-storage` (offline copies). The share plugin sets the main activity to `singleTask`: re-test Google sign-in.
- **Home-screen widget** is opt-in, like the live notification: build with `npx eas-cli build -p android --profile widget` (sets `WIDGET=1`). It adds the entry `index.js` hook and the `react-native-android-widget` plugin. Device-test it (add "TradeZournal today" from the widget picker, check the numbers, tap opens the app) before adding `WIDGET`/`EXPO_PUBLIC_WIDGET` to the `release` profile.
- `index.js` is now the app entry (it only imports `expo-router/entry`, and the widget handler when `EXPO_PUBLIC_WIDGET=1`). The release build must be phone-tested as always: if the app does not open, the entry is the first thing to check (`"main"` in package.json).
- Test list for 1.1: price alert fires and the push arrives; app lock asks on open and after 30 s away, "Sign out instead" works; share a trade and the week (with and without "Hide amounts"); Settings recap toggles stick; Badges screen; delete a throw-away account.
- Also in 1.1: **post-trade prompt** (a push with Calm / Rushed / Add note buttons that save onto the trade), **morning briefing**, **streak reminder** (Settings, "Reminders and recaps"), **share a screenshot into the app** (share a picture to TradeZournal, pick the trade), **works offline** (saved copies of Home/Journal/Alerts/Accounts, new trades and edits are kept and uploaded when back online; an amber bar shows while offline).
- Test list additions: turn on airplane mode, open the app (saved data + amber bar), log a trade, turn it off (toast "Back online"), check the trade is on the website; share a gallery picture to TradeZournal and attach it to a trade; close a trade on a live account and use the buttons on the push; share-to-app with the app closed.

## Selling, and Google Play / App Store builds
Google and Apple take 15 to 30 percent of anything sold through an app they distribute, and their rules do not let a store app steer people to another way to pay. So selling is switched by one flag, `CAN_SELL` in `src/config.ts`:
- **The app downloaded from the website** (profiles `release`, `preview`, `development`...) can sell: "Plans and pricing" (More), "See plans" (Profile), upgrade buttons on plan-limit errors, and the payment page (opened in the browser; Cashfree handles the subscription). Prices are in rupees in India and dollars elsewhere, decided by the server.
- **Store builds** (profile `production`, which sets `EXPO_PUBLIC_STORE_BUILD=1`) show a member's plan and usage but **no price, no upgrade button, no link to pay**, and the "Upgrade to ..." sentence is cut from plan-limit messages. People manage their plan on the website. Do not add a "buy on our website" line to a store build: that is exactly what the stores forbid.
- Partner offers (prop firms, brokers) stay in both: they are real-world services, not digital goods. They carry a commission disclosure.
- Store reviews also need: in-app account deletion (done) and a public page saying how to delete an account (still to do).
