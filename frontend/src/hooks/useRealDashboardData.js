import { useState, useEffect, useCallback } from 'react';
import api from '@/api/client';

/**
 * Hook to fetch real operator-scoped dashboard stats from the backend.
 * Replaces all mock/derived data generators in management pages.
 * @param {string} serviceType - e.g. 'hotels', 'travel', 'restaurants'
 * @param {string} period - '7days', '30days', '90days', '1year'
 * @param {string} operatorId - optional operator ID for admin scoping
 */
export function useRealDashboardData(serviceType, period = '30days', operatorId = '') {
  const [data, setData] = useState({
    stats: {
      totalItems: 0, activeItems: 0, totalBookings: 0, totalRevenue: 0,
      avgRating: 0, occupancyRate: 0, bookingsGrowth: 0, revenueGrowth: 0,
    },
    bookingsByStatus: { confirmed: 0, pending: 0, completed: 0, cancelled: 0 },
    dailyTrend: [],
    distribution: [],
    recentBookings: [],
    secondaryCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const opParam = operatorId ? `&operator_id=${operatorId}` : '';
      const res = await api.get(`/management/dashboard-stats?service_type=${serviceType}&period=${period}${opParam}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceType, period, operatorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, loading, refresh: fetchData };
}
