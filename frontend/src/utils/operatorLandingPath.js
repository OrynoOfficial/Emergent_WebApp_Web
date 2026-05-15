// Maps an operator's primary service_type to its management page so that
// post-login (and other role-based redirects) drop a single-service operator
// straight onto the page they'll actually use, instead of the generic
// /admin/analytics overview. Multi-service operators or operators with no
// resolvable context fall back to /admin/analytics.

const SERVICE_TYPE_TO_PATH = {
  cinema: '/management/cinema',
  hotel: '/management/hotels',
  hotels: '/management/hotels',
  restaurant: '/management/restaurants',
  restaurants: '/management/restaurants',
  car_rental: '/management/car-rental',
  travel: '/management/travel',
  bus: '/management/travel',
  events: '/management/events',
  laundry: '/management/laundry',
  pressing: '/management/pressing',
  banquet: '/management/banquet',
  banquets: '/management/banquets',
  packages: '/management/packages',
  shipments: '/management/shipments',
};

/**
 * Resolve the best landing path for a logged-in user.
 *   - super_admin / admin → their respective admin home
 *   - operator with exactly one service type → that service's management page
 *   - operator with 0 or 2+ service types → /admin/analytics (overview)
 *   - everyone else → /dashboard
 */
export function resolveLandingPath(user) {
  if (!user) return '/dashboard';
  const role = user.role;
  if (role === 'super_admin') return '/admin/analytics';
  if (role === 'admin') return '/admin/admin-dashboard';

  const ctx = user.operator_context || {};
  const isOperator = role === 'operator' || !!user.operator_context;
  if (isOperator) {
    const services = Array.isArray(ctx.service_types) ? ctx.service_types : [];
    if (services.length === 1) {
      const path = SERVICE_TYPE_TO_PATH[services[0]];
      if (path) return path;
    }
    // Single-type fallback via operator_type when service_types is missing
    if (services.length === 0 && ctx.operator_type) {
      const path = SERVICE_TYPE_TO_PATH[ctx.operator_type];
      if (path) return path;
    }
    return '/admin/analytics';
  }

  return '/dashboard';
}
