import { useEffect, useState } from 'react';
import { Smartphone, Download, Monitor, ShieldCheck } from 'lucide-react';
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
  const [signedOut, setSignedOut] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const shouldGate =
    !loading && !isNative && isMobileWeb && policy === 'mobile_only' && !isSuperAdmin;

  // Sign the user out (once) as soon as we decide to gate them. Matches
  // Salesforce's "you can't be here, here's your boot" behaviour.
  useEffect(() => {
    if (shouldGate && !signedOut && user) {
      try {
        logout();
      } catch {
        // best-effort — even if logout throws, we still render the takeover
      }
      setSignedOut(true);
    }
  }, [shouldGate, signedOut, user, logout]);

  if (!shouldGate) return null;

  const os = detectMobileOS();
  const storeHref = os === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
  const storeLabel = os === 'android' ? 'Get it on Google Play' : 'Download on the App Store';

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
          <h1 className="text-2xl font-semibold tracking-tight">Oryno is mobile-app-only</h1>
          <p className="mt-2 text-sm text-white/80 leading-relaxed">
            For security &amp; performance, your organisation requires the
            Oryno app on phones and tablets.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <a
            href={storeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            data-testid="mobile-gate-install-cta"
          >
            <Button className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-white font-medium rounded-xl">
              <Download className="mr-2 h-5 w-5" /> {storeLabel}
            </Button>
          </a>

          {os === 'unknown' && (
            <div className="flex gap-3">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                data-testid="mobile-gate-app-store"
              >
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  iOS · App Store
                </Button>
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                data-testid="mobile-gate-play-store"
              >
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  Android · Play Store
                </Button>
              </a>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-3">
            <Monitor className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              Need to keep working right now? Open <span className="font-medium">app.oryno.tech</span> from a desktop or laptop — the web app stays available there.
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 leading-relaxed">
              You&apos;ve been signed out of this browser session for security.
              Sign back in inside the Oryno app once installed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
