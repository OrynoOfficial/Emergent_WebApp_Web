# Universal / App Links manifests

These two files are fetched directly by **Apple servers** (iOS Universal Links)
and **Google's Asset Links Verifier** (Android App Links) to confirm that
the `tech.oryno.app` mobile apps are allowed to handle URLs on the
`oryno.tech` and `app.oryno.tech` domains.

| File | Fetched by | Required Content-Type | Required path |
|------|------------|------------------------|---------------|
| `apple-app-site-association` | `app-site-association.apple.com` | `application/json` | `https://<domain>/.well-known/apple-app-site-association` (no extension!) |
| `assetlinks.json`            | `play.google.com` / users' phones | `application/json` | `https://<domain>/.well-known/assetlinks.json` |

## Deployment notes

- **AASA must be served with `Content-Type: application/json`** despite having no `.json` extension. After every redeploy:
  ```
  curl -I https://app.oryno.tech/.well-known/apple-app-site-association
  ```
  If `Content-Type` is anything other than `application/json`, the static-file host needs a MIME-type rule.
- **Both files must be served over HTTPS**, no redirects, no auth, no cookies. Apple and Google both reject 3xx/4xx/5xx responses.
- **CDN cache TTL ≤ 24h** — when you rotate keys you don't want to wait a week.

## Verification

- Apple: open the AASA in a browser; it should validate as JSON. Apple fetches once per app install, so you can also force-revalidate with Settings → General → VPN & Device Management on a test phone.
- Android: `https://developers.google.com/digital-asset-links/tools/generator` — paste the package name and domain, it tells you exactly which SHA-256 the file is missing.

## Editing

- The Apple Team ID (`HW8J5D45GC`) is baked into `appIDs`. If Apple ever rotates it, search-and-replace both occurrences.
- The Android SHA-256 fingerprints are still **placeholders**. Replace them with:
  1. Your **upload key** fingerprint: `keytool -list -v -keystore oryno-release.keystore`
  2. **Play App Signing** fingerprint: Play Console → App integrity → "App signing key certificate"

Both slots are needed — Slot 1 covers users who sideload, Slot 2 covers Play-installed users.
