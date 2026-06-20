// Resolve the post-login landing path. Honors the user's `default_landing_page`
// preference (set in Settings → Preferences). Operators normally land on
// /admin/analytics — never on a service-management page directly, because they
// may not actually hold the permission to access that page (which causes a
// hard "access denied" on first login). Analytics is the safe, always-permitted
// overview.

function roleBasedDefault(user) {
  if (!user) return '/dashboard';
  const role = user.role;
  if (role === 'super_admin') return '/admin/analytics';
  if (role === 'admin') return '/admin/admin-dashboard';
  const isOperator = role === 'operator' || !!user.operator_context;
  if (isOperator) return '/admin/analytics';
  return '/dashboard';
}

/**
 * @param {object} user — the authenticated user document
 * @returns {string} an absolute path
 *
 * Pref values (Settings → Preferences → Default landing page):
 *   - 'auto'      → role-based default
 *   - 'dashboard' → /dashboard
 *   - 'orders'    → /orders
 *   - 'services'  → /  (browse services)
 */
export function resolveLandingPath(user) {
  let landing = 'auto';
  try {
    landing = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('oryno_landing') || 'auto')
      : 'auto';
  } catch { /* ignore */ }

  if (landing === 'dashboard') return '/dashboard';
  if (landing === 'orders') return '/orders';
  if (landing === 'services') return '/';
  return roleBasedDefault(user);
}
