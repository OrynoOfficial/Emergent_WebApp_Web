import { useEffect, useRef } from 'react';
import { Smartphone, Monitor, Apple, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import {
  useIsCapacitorNative,
  useIsMobileWebBrowser,
  useMobileAccessPolicy,
} from '../utils/mobileGate';

// Hard-coded store links — easy to update once the apps are listed.
const APP_STORE_URL =
  import.meta.env.VITE_APP_STORE_URL ||
  'https://apps.apple.com/app/oryno/id0000000000';
const PLAY_STORE_URL =
  import.meta.env.VITE_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=tech.oryno.app';

function detectMobileOS() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'unknown';
}

/**
 * Salesforce-style takeover that appears on every protected route when:
 *   • the global `mobile_access_policy` is `mobile_only`, AND
 *   • the user is on a phone/tablet WEB browser (not the native app), AND
 *   • the user is NOT a super-admin (super-admins always have the escape hatch)
 *
 * The takeover signs the user out so they don't keep a live session on a
 * blocked client. They can then re-open the native app and sign in there.
 */
export default function MobileAppGate() {
  const { user, logout } = useAuth();
  const isNative = useIsCapacitorNative();
  const isMobileWeb = useIsMobileWebBrowser();
  const { policy, loading } = useMobileAccessPolicy();
  const signedOutRef = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const shouldGate =
    !loading && !isNative && isMobileWeb && policy === 'mobile_only' && !isSuperAdmin;

  // Sign the user out (once) as soon as we decide to gate them. Matches
  // Salesforce's "you can't be here, here's your boot" behaviour.
  useEffect(() => {
    if (shouldGate && !signedOutRef.current && user) {
      signedOutRef.current = true;
      try {
        logout();
      } catch {
        // best-effort — even if logout throws, we still render the takeover
      }
    }
  }, [shouldGate, user, logout]);

  if (!shouldGate) return null;

  const os = detectMobileOS();

  return (
    <div
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#082c59] flex items-center justify-center p-6 overflow-y-auto"
      data-testid="mobile-app-gate"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#082c59] to-[#0a3a75] text-white px-6 pt-8 pb-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Get the Oryno app</h1>
          <p className="mt-2 text-sm text-white/85 leading-relaxed">
            On phones, Oryno runs as a native app.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {/* Always show both store buttons so iOS and Android users can grab the
              right one on the spot. */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mobile-gate-app-store"
            >
              <Button
                variant={os === 'android' ? 'outline' : 'default'}
                className={`w-full h-12 rounded-xl font-medium ${
                  os === 'ios' ? 'bg-[#082c59] hover:bg-[#0a3a75] text-white' : ''
                }`}
              >
                <Apple className="mr-2 h-5 w-5" /> App Store
              </Button>
            </a>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mobile-gate-play-store"
            >
              <Button
                variant={os === 'ios' ? 'outline' : 'default'}
                className={`w-full h-12 rounded-xl font-medium ${
                  os === 'android' ? 'bg-[#082c59] hover:bg-[#0a3a75] text-white' : ''
                }`}
              >
                <Play className="mr-2 h-5 w-5" /> Google Play
              </Button>
            </a>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
            <Monitor className="h-5 w-5 text-slate-500 flex-shrink-0" />
            <div className="text-sm text-slate-700">
              On a laptop? Use <span className="font-medium text-[#082c59]">app.oryno.tech</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
