// Small role-check helpers so we don't fire admin-only requests (like
// GET /api/operators) as non-admin users. Silences noisy 403s in the
// browser console.
export const isAdminRole = (user) =>
  user?.role === 'admin' || user?.role === 'super_admin';

export const canListOperators = (user) => isAdminRole(user);
