/**
 * Capacitor storage shim
 * ──────────────────────
 * iOS Safari evicts WebView localStorage after 7 days of app dormancy.
 * To survive that we mirror every key we care about to the native
 * `@capacitor/preferences` store, which is a Keychain / SharedPreferences-
 * backed key/value bucket that lives outside the WebView cache.
 *
 * Strategy (zero touch to existing code):
 *   1. On app boot in a native shell, read all known keys from Preferences
 *      and hydrate them into `window.localStorage`. The rest of the app
 *      continues to read/write `localStorage` synchronously as usual.
 *   2. We monkey-patch `localStorage.setItem` and `removeItem` so every
 *      write also mirrors to Preferences asynchronously (fire-and-forget).
 *      The web target gets a no-op patch.
 *
 * Only the keys explicitly whitelisted in `MIRRORED_KEYS` are persisted —
 * we don't want to mirror UI-only flags (toasts, dismissed banners, etc.).
 *
 * Idempotent: safe to call `bootstrapStorage()` more than once.
 */
const MIRRORED_KEYS = [
  'access_token',
  'refresh_token',
  'user',
  'oryno_mobile_policy',
  'oryno_tz',
  'oryno_lang',
  'oryno_currency',
  'oryno_theme',
];

function isCapacitorNative() {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line no-undef
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

let bootstrapped = false;

/**
 * Hydrate `localStorage` from `@capacitor/preferences` on cold start and
 * install the setItem/removeItem monkey-patches so subsequent writes mirror
 * back to native storage.
 *
 * Resolves once hydration is complete so callers can `await` it before
 * mounting the React tree (avoids a flash of logged-out UI on cold app
 * launches after Safari evicts the WebView cache).
 */
export async function bootstrapStorage() {
  if (bootstrapped) return;
  bootstrapped = true;

  if (!isCapacitorNative() || typeof window === 'undefined') return;

  let Preferences;
  try {
    ({ Preferences } = await import('@capacitor/preferences'));
  } catch {
    // Plugin not installed (web-only build) — nothing to do.
    return;
  }

  // 1. Hydrate localStorage from Preferences for any mirrored key that's
  //    missing or stale on the web side.
  await Promise.all(
    MIRRORED_KEYS.map(async key => {
      try {
        const { value } = await Preferences.get({ key });
        if (value != null && window.localStorage.getItem(key) == null) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Best-effort. If a single key fails the rest still hydrate.
      }
    })
  );

  // 2. Mirror future writes back into Preferences. We keep references to the
  //    original methods so we can call through.
  const origSet = window.localStorage.setItem.bind(window.localStorage);
  const origRemove = window.localStorage.removeItem.bind(window.localStorage);

  window.localStorage.setItem = (key, value) => {
    origSet(key, value);
    if (MIRRORED_KEYS.includes(key)) {
      Preferences.set({ key, value: String(value) }).catch(() => { /* ignore */ });
    }
  };

  window.localStorage.removeItem = (key) => {
    origRemove(key);
    if (MIRRORED_KEYS.includes(key)) {
      Preferences.remove({ key }).catch(() => { /* ignore */ });
    }
  };
}
