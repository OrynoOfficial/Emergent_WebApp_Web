// Resolve the post-login landing path. Operators always land on /admin/analytics
// — never on a service-management page directly, because they may not actually
// hold the permission to access that page (which causes a hard "access denied"
// on first login). Analytics is the safe, always-permitted overview.

/**
 * @param {object} user — the authenticated user document
 * @returns {string} an absolute path
 *   - super_admin → /admin/analytics
 *   - admin       → /admin/admin-dashboard
 *   - operator    → /admin/analytics   (DO NOT short-circuit into /management/*)
 *   - everyone else → /dashboard
 */
export function resolveLandingPath(user) {
  if (!user) return '/dashboard';
  const role = user.role;
  if (role === 'super_admin') return '/admin/analytics';
  if (role === 'admin') return '/admin/admin-dashboard';
  const isOperator = role === 'operator' || !!user.operator_context;
  if (isOperator) return '/admin/analytics';
  return '/dashboard';
}
