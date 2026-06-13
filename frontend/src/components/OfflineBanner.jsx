import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Top-of-screen offline strip.
 *
 * Native (Capacitor): subscribes to `@capacitor/network` so iOS/Android
 * status changes (airplane mode, cell drop, etc.) flip the banner instantly.
 *
 * Web: falls back to the browser's `online` / `offline` events. Less precise
 * (`navigator.onLine` famously lies on some captive portals) but good enough
 * for the desktop case where users have other signals.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let nativeListener;
    let cancelled = false;

    const setStatus = (isOnline) => {
      if (!cancelled) setOffline(!isOnline);
    };

    const setupNative = async () => {
      // eslint-disable-next-line no-undef
      if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
        return false;
      }
      try {
        const { Network } = await import('@capacitor/network');
        const current = await Network.getStatus();
        setStatus(current.connected);
        nativeListener = await Network.addListener('networkStatusChange', (s) => setStatus(s.connected));
        return true;
      } catch {
        return false;
      }
    };

    const handleOnline = () => setStatus(true);
    const handleOffline = () => setStatus(false);

    setupNative().then((nativeOk) => {
      if (cancelled) return;
      if (!nativeOk) {
        // Web fallback
        setStatus(typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
      }
    });

    return () => {
      cancelled = true;
      if (nativeListener) nativeListener.remove();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9998] bg-amber-500 text-white text-xs font-medium px-4 py-2 text-center shadow-md safe-area-top"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5" />
        You&apos;re offline — some actions will be queued until you reconnect.
      </span>
    </div>
  );
}
