/**
 * PageTitle — dynamically updates `document.title` per route / page.
 *
 * Three usage surfaces, pick whichever fits the page:
 *
 *   1. Hook (inside a function component):
 *        usePageTitle('Bookings');
 *
 *   2. JSX component (drop-in, no extra import needed if the page already
 *      has a JSX return):
 *        <PageTitle title="Bookings" />
 *
 *   3. Zero-config fallback: <RouteTitleSync /> is mounted ONCE inside
 *      <BrowserRouter> (see App.jsx) and derives a sensible default title
 *      from the current pathname. Any page that calls usePageTitle / mounts
 *      <PageTitle> overrides this fallback.
 *
 * Output format: "<Page Name> · Oryno"  (or just "Oryno" on the root).
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'Oryno';

const setTitle = (title) => {
  const next = title && String(title).trim() ? `${title} · ${APP_NAME}` : APP_NAME;
  if (typeof document !== 'undefined' && document.title !== next) {
    document.title = next;
  }
};

export function usePageTitle(title) {
  useEffect(() => {
    setTitle(title);
  }, [title]);
}

export function PageTitle({ title }) {
  usePageTitle(title);
  return null;
}

/* ─── Pathname → default title ─────────────────────────────────────── */
// First-segment lookup. Anything not in this map falls back to a
// title-cased version of the first path segment (e.g. /admin/permissions
// → "Admin"). Pages can still override via <PageTitle>/usePageTitle.
const PATH_TITLES = {
  '/': 'Welcome',
  '/login': 'Sign In',
  '/register': 'Create Account',
  '/verify-account': 'Verify Account',
  '/dashboard': 'Dashboard',
  '/services': 'Services',
  '/bookings': 'My Bookings',
  '/orders': 'My Orders',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/messages': 'Messages',
  '/ratings': 'Reviews',
  '/track': 'Track Package',
  '/admin': 'Admin',
  '/admin/bookings': 'Bookings',
  '/admin/users': 'Users',
  '/admin/operators': 'Operators',
  '/admin/permissions': 'Permissions',
  '/admin/analytics': 'Analytics',
  '/admin/operator-comparison': 'Operator Comparison',
  '/admin/invitations': 'Invitations',
  '/admin/settings': 'Settings',
  '/operator': 'Operator',
  '/operator/dashboard': 'Operator Dashboard',
  '/operator/bookings': 'Bookings',
  '/operator/services': 'Services',
  '/operator/team': 'Team & Roles',
  '/operator/analytics': 'Analytics',
  '/management': 'Management',
  '/management/cinema': 'Cinema',
  '/management/hotel': 'Hotel',
  '/management/travel': 'Travel',
  '/management/restaurant': 'Restaurant',
  '/management/laundry': 'Laundry',
  '/management/package': 'Package',
  '/management/event': 'Events',
  '/management/banquet': 'Banquet',
  '/management/car-rental': 'Car Rental',
  '/payment/success': 'Payment Success',
  '/payment/cancel': 'Payment Canceled',
};

const titleCase = (s) =>
  s
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function deriveTitle(pathname) {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  // Try most specific prefix first (e.g. /admin/operators/123 → /admin/operators)
  const segs = pathname.split('/').filter(Boolean);
  while (segs.length) {
    const prefix = '/' + segs.join('/');
    if (PATH_TITLES[prefix]) return PATH_TITLES[prefix];
    segs.pop();
  }
  // Last resort: title-case the first segment.
  const first = pathname.split('/').filter(Boolean)[0];
  return first ? titleCase(first) : '';
}

export function RouteTitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    setTitle(deriveTitle(pathname));
  }, [pathname]);
  return null;
}

export default PageTitle;
