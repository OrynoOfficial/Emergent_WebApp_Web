import { useState, useEffect, useCallback } from 'react';
import api from '@/api/client';

/**
 * Hook to fetch real operator-scoped dashboard stats from the backend.
 * Replaces all mock/derived data generators in management pages.
 */
export function useRealDashboardData(serviceType, period = '30days') {
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
      const res = await api.get(`/management/dashboard-stats?service_type=${serviceType}&period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceType, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, loading, refresh: fetchData };
}
