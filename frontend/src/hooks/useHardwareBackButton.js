import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Android hardware back-button handler.
 *
 * Behaviour (matches platform conventions):
 *   1. If the browser/route history can go back → pop one entry.
 *   2. Otherwise, if we're on a top-level route → minimise the app
 *      (Capacitor's `App.minimizeApp()` on Android is the polite alternative
 *      to `App.exitApp()` which most apps no longer do).
 *
 * The hook is a no-op on iOS and on the web — iOS has no hardware back
 * button and the web uses the browser's native chrome.
 */
const TOP_LEVEL_ROUTES = new Set([
  '/',
  '/dashboard',
  '/services',
  '/login',
  '/welcome',
]);

export default function useHardwareBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let listener;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line no-undef
      const cap = typeof window !== 'undefined' ? window.Capacitor : null;
      if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
      const platform = cap.getPlatform ? cap.getPlatform() : '';
      if (platform !== 'android') return; // iOS has no hardware back

      try {
        const { App } = await import('@capacitor/app');
        listener = await App.addListener('backButton', ({ canGoBack }) => {
          if (cancelled) return;
          if (canGoBack && !TOP_LEVEL_ROUTES.has(location.pathname)) {
            navigate(-1);
          } else {
            App.minimizeApp().catch(() => { /* ignore */ });
          }
        });
      } catch {
        // Plugin missing — nothing to do.
      }
    })();

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [location.pathname, navigate]);
}
