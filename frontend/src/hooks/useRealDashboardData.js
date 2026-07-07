import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/api/client';

/**
 * Hook to fetch real operator-scoped dashboard stats from the backend.
 * Replaces all mock/derived data generators in management pages.
 *
 * Real-time behaviour:
 *   1. Re-fetches on window focus (operator alt-tabs back → fresh data).
 *   2. Re-fetches when the tab becomes visible again after being hidden.
 *   3. Polls every 30s while the tab is visible so a newly confirmed
 *      MoMo / Walk-in booking shows up within one polling cycle even if
 *      the operator never leaves the tab.
 *   4. Explicit `refresh()` returned so callers can hard-refresh after a
 *      mutation (e.g. an admin marks a booking confirmed elsewhere).
 *
 * @param {string} serviceType - e.g. 'hotels', 'travel', 'restaurants'
 * @param {string} period - '7days', '30days', '90days', '1year'
 * @param {string} operatorId - optional operator ID for admin scoping
 * @param {number} pollMs - polling interval while tab is visible. Set 0 to disable.
 */
export function useRealDashboardData(serviceType, period = '30days', operatorId = '', pollMs = 30000) {
  const [data, setData] = useState({
    stats: {
      totalItems: 0, activeItems: 0, totalBookings: 0, totalRevenue: 0,
      grossBookings: 0, grossRevenue: 0,
      avgRating: 0, occupancyRate: 0, bookingsGrowth: 0, revenueGrowth: 0,
    },
    bookingsByStatus: { confirmed: 0, pending: 0, completed: 0, cancelled: 0 },
    dailyTrend: [],
    distribution: [],
    recentBookings: [],
    secondaryCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const inflight = useRef(false);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    // Prevent overlapping requests when both polling + focus fire together.
    if (inflight.current) return;
    inflight.current = true;
    if (!silent) setLoading(true);
    try {
      const opParam = operatorId ? `&operator_id=${operatorId}` : '';
      const res = await api.get(`/management/dashboard-stats?service_type=${serviceType}&period=${period}${opParam}`);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      inflight.current = false;
      if (!silent) setLoading(false);
    }
  }, [serviceType, period, operatorId]);

  // Initial fetch + when params change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Focus / visibility → silent refetch (no spinner flash)
  useEffect(() => {
    const onFocus = () => fetchData({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchData]);

  // Poll while visible
  useEffect(() => {
    if (!pollMs || pollMs <= 0) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    }, pollMs);
    return () => clearInterval(id);
  }, [fetchData, pollMs]);

  return { ...data, loading, lastUpdated, refresh: () => fetchData({ silent: false }) };
}
