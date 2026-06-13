# Oryno Mobile Apps — Setup Guide (Capacitor)

This document is the **runbook for going from the current web codebase to a published iOS + Android app**. The Capacitor scaffold is already in place — what's left requires a developer machine (macOS for iOS, any OS for Android) plus the paid store accounts.

---

## ✅ Already done in this repo

- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` and the recommended plugin set (`preferences`, `network`, `app`, `status-bar`, `splash-screen`) installed (Capacitor 7.x, Node 20 compatible).
- `capacitor.config.ts` created (`appId: tech.oryno.app`, `appName: Oryno`, `webDir: dist`).
- API client (`src/api/client.js`) automatically sends `X-Oryno-Client: mobile-app/<ver> (ios|android)` header from inside the native shell — this is what the backend mobile-gate middleware looks for to tell the native app apart from a phone web browser.
- `<MobileAppGate>` self-disables on Capacitor (it reads `window.Capacitor.isNativePlatform()`).
- Backend `MobileAccessGateMiddleware` already lets the native app through and only blocks phone/tablet *web* traffic.

---

## 🛠️ One-time setup on a developer machine

You'll need:

| Tool | Why | Where |
|---|---|---|
| **Node 20 LTS** | Build | https://nodejs.org |
| **Xcode 15+** | iOS build (macOS only) | App Store |
| **Android Studio Hedgehog+** | Android build | https://developer.android.com/studio |
| **Apple Developer account** | App Store deploy ($99/yr) | https://developer.apple.com |
| **Google Play Console** | Play Store deploy ($25 one-time) | https://play.google.com/console |
| **CocoaPods** | iOS native deps | `sudo gem install cocoapods` |

---

## 🚀 First-time platform bootstrap

```bash
cd /app/frontend

# 1. Build the web bundle that ships inside the apps.
yarn build              # produces ./dist

# 2. Add the native platforms (only needed the very first time).
npx cap add ios
npx cap add android

# 3. Copy the web build into both shells.
npx cap sync

# 4. Open each shell in its IDE.
npx cap open ios        # → launches Xcode
npx cap open android    # → launches Android Studio
```

After step 2 you'll have new folders `frontend/ios/` and `frontend/android/`. **Commit those to git** so future builds start from a known state.

---

## 🔁 Day-to-day dev loop

```bash
# After any change to the React code:
yarn build && npx cap sync

# Or, much faster with live-reload (the device reloads on every save):
npx cap run ios     --livereload --external
npx cap run android --livereload --external
```

`--external` makes Capacitor point the app at your laptop's IP on the LAN, so the device reads the live Vite dev server. Set `VITE_API_URL` accordingly (e.g. `http://192.168.1.42:8001/api`) or keep the production URL.

---

## 🏷️ Build-time configuration

Add these to a `.env.production` file under `/app/frontend/` before building the mobile bundle:

```
VITE_API_URL=https://app.oryno.tech/api
VITE_APP_VERSION=1.0.0
VITE_APP_STORE_URL=https://apps.apple.com/app/oryno/id<your-app-id>
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=tech.oryno.app
```

`VITE_APP_VERSION` is what the backend sees on the `X-Oryno-Client` header — bump it on each release.

---

## 📲 Store-listing checklist

### iOS — App Store Connect
1. Create app record at https://appstoreconnect.apple.com → "+ New App"
   - Platform: iOS · Bundle ID: `tech.oryno.app` (must match `capacitor.config.ts`)
   - Name: **Oryno** · Primary language: English · SKU: `oryno-app`
2. Privacy policy URL: `https://oryno.tech/privacy`
3. Screenshots required: 6.7" iPhone (1290×2796), 6.1" iPhone, 12.9" iPad — at least 3 each
4. Privacy nutrition labels: Personal data (name, email, phone), Usage data (analytics)
5. Test on TestFlight → submit for review (avg 24-48h)

### Android — Google Play Console
1. Create app → Default language English · App name **Oryno** · Free
2. Set **Package name** to `tech.oryno.app` (immutable after first upload)
3. Privacy policy URL: `https://oryno.tech/privacy`
4. Screenshots: phone (16:9) + 7" tablet + 10" tablet — at least 2 each
5. Data Safety form (matches App Store nutrition labels)
6. Internal testing → Closed testing → Production

---

## 🔐 Signing keys

### iOS — Automatic via Xcode + your Apple Dev account
Sign in to Xcode → Preferences → Accounts → add your Apple ID. Xcode handles certificates and provisioning profiles automatically (or use Fastlane match for CI).

### Android — Generate once, then store the keystore safely
```bash
keytool -genkey -v -keystore oryno-release.keystore \
  -alias oryno -keyalg RSA -keysize 2048 -validity 10000
```
Add to `frontend/android/key.properties` (do NOT commit):
```
storePassword=...
keyPassword=...
keyAlias=oryno
storeFile=/abs/path/to/oryno-release.keystore
```
And reference it from `frontend/android/app/build.gradle`. Losing this keystore = you can never update the app under the same listing again — back it up to 1Password.

---

## 🔗 Deep links (post-MVP)

To make password-reset / verify-account emails open the app on tap:

- **iOS — Universal Links**: serve `https://app.oryno.tech/.well-known/apple-app-site-association` (JSON) with the team-id and bundle-id mapped to `/*`.
- **Android — App Links**: serve `https://app.oryno.tech/.well-known/assetlinks.json` and add an `<intent-filter>` to the main Activity for `android:host="app.oryno.tech"`.

The backend already serves these as plain static files if dropped into `frontend/public/.well-known/`.

---

## 🚦 Flip the gate live

Once the apps are on the stores:

1. Super-admin → **Settings → System → Mobile Access Policy**
2. Switch from **Hybrid** to **Mobile-app-only**
3. Anyone on a phone/tablet web browser instantly gets the takeover, signed out, and pointed to the store. Desktops keep working as before. Native app users sail through (header bypass).

You can roll back to **Hybrid** at any time with one click.

---

## 📦 Recommended OTA / live updates (optional, post-launch)

For app-store-bypassing hot fixes:

- **Capgo** (paid, easy): `npx @capgo/cli@latest init` — push JS bundle updates from the CLI in seconds.
- **Capacitor LiveUpdates** (free, IONIC AppFlow): one-time setup, channel-based rollouts.

This means JS-only bug fixes don't have to wait for a 24-48h Apple review.
