import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Oryno — Capacitor configuration
 * ────────────────────────────────
 * Bundle ID:   tech.oryno.app
 * App name:    Oryno (Apple has a 30-char limit; this fits fine)
 *
 * The `webDir` points at the Vite production build. After `yarn build`
 * the compiled JS+HTML is copied into the native iOS/Android shells via
 * `npx cap sync`.
 *
 * `server.url` is intentionally NOT set — we ship the bundled web build
 * inside the app so launches work offline. Use `live-reload` only for
 * local development (`npx cap run ios --livereload --external`).
 */
const config: CapacitorConfig = {
  appId: 'tech.oryno.app',
  appName: 'Oryno',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    backgroundColor: '#082c59', // matches the brand splash on the white safe-area
  },
  android: {
    backgroundColor: '#082c59',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#082c59',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK', // dark icons on the light brand bar
      backgroundColor: '#082c59',
    },
  },
};

export default config;
