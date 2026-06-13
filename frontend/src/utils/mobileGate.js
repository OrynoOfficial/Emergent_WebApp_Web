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
  // Cache the last-known policy in localStorage so repeat visits don't flash
  // the login page before the gate decision lands. First-ever visit to a
  // device still defaults to 'hybrid' (fail-open), but the MobileAppGate
  // component renders an extra "curtain" while loading on a mobile UA so
  // even that first visit doesn't expose the signin page.
  const CACHE_KEY = 'oryno_mobile_policy';
  const initial = (() => {
    if (typeof window === 'undefined') return 'hybrid';
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      return cached === 'mobile_only' || cached === 'web_only' || cached === 'hybrid'
        ? cached
        : 'hybrid';
    } catch {
      return 'hybrid';
    }
  })();
  const [policy, setPolicy] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/system-settings/public/mobile-access-policy');
        const next = data?.mobile_access_policy || 'hybrid';
        if (!cancelled) {
          setPolicy(next);
          try { window.localStorage.setItem(CACHE_KEY, next); } catch { /* ignore */ }
        }
      } catch {
        if (!cancelled) setPolicy(prev => prev || 'hybrid');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { policy, loading };
}
