/**
 * Salesforce-style "Use the App" Gate
 * ────────────────────────────────────
 * Two tiny hooks the rest of the app depends on:
 *
 *   useIsCapacitorNative()
 *     → true when this React bundle is running inside the native Capacitor
 *       shell (iOS/Android app). Detected via `window.Capacitor.isNativePlatform()`
 *       — which is injected by Capacitor at runtime; on the web bundle the
 *       global is simply undefined and we return false.
 *
 *   useIsMobileWebBrowser()
 *     → true when the user is on a phone/tablet *web* browser (i.e. NOT the
 *       native shell, NOT a desktop browser). Used by `<MobileAppGate>` to
 *       decide whether to take over the UI.
 *
 *   useMobileAccessPolicy()
 *     → the global super-admin setting: 'hybrid' | 'mobile_only' | 'web_only'.
 *       Fetched once on mount from the public endpoint (no auth needed) so
 *       the gate can fire even before login.
 */
import { useEffect, useState } from 'react';
import api from '../api/client';

export function isCapacitorNative() {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line no-undef
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export function useIsCapacitorNative() {
  // Capacitor doesn't change at runtime, so a one-shot read at mount is enough.
  const [native] = useState(isCapacitorNative);
  return native;
}

function detectIsMobileWebBrowser() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isCapacitorNative()) return false;

  // Pinned to standalone PWA installs too — once they "install" Oryno to the
  // home screen the experience is close enough to the native app that we
  // don't want to block it.
  const isStandalonePWA =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  if (isStandalonePWA) return false;

  const ua = navigator.userAgent || '';
  const looksMobileUA = /iPhone|iPad|iPod|Android|Mobile|Tablet|Silk|Opera Mini|Kindle|Mobi/i.test(ua);
  const isCoarsePointer =
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const isNarrowViewport = window.innerWidth <= 1024;
  // Either a real mobile UA *or* (touch device + narrow viewport) → treat as mobile.
  return looksMobileUA || (isCoarsePointer && isNarrowViewport);
}

export function useIsMobileWebBrowser() {
  const [isMobile, setIsMobile] = useState(detectIsMobileWebBrowser);
  useEffect(() => {
    const update = () => setIsMobile(detectIsMobileWebBrowser());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return isMobile;
}

export function useMobileAccessPolicy() {
  // Default to 'hybrid' so the gate stays OFF unless we successfully fetch a
  // stricter policy from the server. Failing closed here would lock everyone
  // out the moment the backend hiccups — failing open is the right default.
  const [policy, setPolicy] = useState('hybrid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/system-settings/public/mobile-access-policy');
        if (!cancelled) setPolicy(data?.mobile_access_policy || 'hybrid');
      } catch {
        if (!cancelled) setPolicy('hybrid');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { policy, loading };
}
