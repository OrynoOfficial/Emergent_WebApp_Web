import { useEffect, useRef } from 'react';
import { Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  useIsCapacitorNative,
  useIsMobileWebBrowser,
  useMobileAccessPolicy,
} from '../utils/mobileGate';
import { MARKETING_LINKS } from '../pages/auth/AuthConstants';

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
 * Inline Apple logo SVG — used inside the App Store badge. Keeping the SVG
 * inline (vs. <img>) lets us recolour it via `currentColor` for hover/focus
 * states without juggling a second asset.
 */
function AppleLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/**
 * Inline Google Play colour mark — the canonical four-colour play prism.
 * Kept as a single SVG so the badge stays crisp on retina without bundling
 * an extra PNG.
 */
function GooglePlayLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {/* Blue left edge */}
      <path
        d="M4.5 3.2C4.2 3.5 4 4 4 4.7v30.6c0 .7.2 1.2.5 1.5l.1.1L21 21V19L4.6 3.2z"
        fill="#2196F3"
      />
      {/* Yellow right tip */}
      <path
        d="M26 26.5 21 21v-2l5-5 .1.1 6 3.4c1.7 1 1.7 2.6 0 3.5l-6.1 3.5z"
        fill="#FFC107"
      />
      {/* Green top triangle */}
      <path
        d="M26.1 26.4 21 21 4.5 36.8c.6.6 1.5.7 2.5.1l19.1-10.5"
        fill="#4CAF50"
      />
      {/* Red bottom triangle */}
      <path
        d="M26.1 13.6 7 3.1C6 2.5 5.1 2.6 4.5 3.2L21 19l5.1-5.4z"
        fill="#F44336"
      />
    </svg>
  );
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
        <div className="px-6 pt-8 pb-6 text-center">
          {/* Brand mark — same logo as the login screen so the gate feels
              continuous with the rest of the app. */}
          <img
            src="/images/logo.png"
            alt="Oryno"
            className="mx-auto h-12 w-auto object-contain"
          />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Get the Oryno app
          </h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            On phones and tablets, Oryno runs as a native app for a faster,
            smoother experience.
            <br />
            Install it below — and on a laptop, keep using the web app at{' '}
            <span className="font-medium text-[#082c59]">app.oryno.tech</span>.
          </p>
        </div>

        <div className="px-6 pb-7 space-y-3">
          {/* Real store badges — Apple lockup on the left, Google Play on the
              right. Both buttons are dark with the official wordmarks so they
              feel like the actual store CTAs users already know. */}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mobile-gate-app-store"
            className={`flex items-center gap-3 w-full h-14 px-5 rounded-xl bg-black text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all ${
              os === 'ios' ? 'ring-2 ring-[#082c59] ring-offset-2' : ''
            }`}
          >
            <AppleLogo className="h-7 w-7 flex-shrink-0" />
            <div className="flex flex-col items-start leading-tight text-left">
              <span className="text-[10px] uppercase tracking-wide text-white/75">
                Download on the
              </span>
              <span className="text-lg font-semibold -mt-0.5">App Store</span>
            </div>
          </a>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mobile-gate-play-store"
            className={`flex items-center gap-3 w-full h-14 px-5 rounded-xl bg-black text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all ${
              os === 'android' ? 'ring-2 ring-[#082c59] ring-offset-2' : ''
            }`}
          >
            <GooglePlayLogo className="h-7 w-7 flex-shrink-0" />
            <div className="flex flex-col items-start leading-tight text-left">
              <span className="text-[10px] uppercase tracking-wide text-white/75">
                Get it on
              </span>
              <span className="text-lg font-semibold -mt-0.5">Google Play</span>
            </div>
          </a>

          <a
            href={MARKETING_LINKS.HOME}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="mobile-gate-homepage"
            className="mt-1 flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Monitor className="h-4 w-4" />
            Visit the Oryno homepage
          </a>
        </div>
      </div>
    </div>
  );
}
