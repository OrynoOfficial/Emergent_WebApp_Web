/**
 * Vitest-style smoke check for the operator landing-path resolver. We don't
 * have vitest configured here so this is a CLI-runnable harness — invoke with
 *   node operatorLandingPath.test.mjs
 *
 * The behaviour we lock in: operators NEVER land on /management/* — they
 * always go to /admin/analytics, even when they manage a single service type
 * (because they may not actually hold the permission to view the management
 * page for that service).
 */
import { resolveLandingPath } from '../operatorLandingPath.js';

const cases = [
  { input: null,                                              expected: '/dashboard',              note: 'no user' },
  { input: { role: 'customer' },                              expected: '/dashboard',              note: 'customer' },
  { input: { role: 'super_admin' },                           expected: '/admin/analytics',        note: 'super admin' },
  { input: { role: 'admin' },                                 expected: '/admin/admin-dashboard',  note: 'plain admin' },
  { input: { role: 'operator' },                              expected: '/admin/analytics',        note: 'operator (no context)' },
  // The critical regression: previously a single-service operator was sent to
  // /management/cinema and got a hard "access denied" because their token did
  // not actually carry cinema.* permissions. Confirm they now land safely.
  { input: { role: 'operator', operator_context: { service_types: ['cinema'] } },
    expected: '/admin/analytics', note: 'single-service operator → still analytics' },
  { input: { role: 'operator', operator_context: { service_types: ['hotel', 'travel'] } },
    expected: '/admin/analytics', note: 'multi-service operator' },
];

let failed = 0;
for (const c of cases) {
  const got = resolveLandingPath(c.input);
  const ok = got === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.note}  →  expected ${c.expected}, got ${got}`);
}
process.exit(failed ? 1 : 0);
