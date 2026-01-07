import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

/**
 * BusinessAnalytics - Analytics component for travel management
 */
export function BusinessAnalytics({ routes, vehicles }) {
  const analyticsData = useMemo(() => {
    // Route distribution
    const routesByCity = {};
    routes.forEach(r => {
      const city = r.from_city || 'Unknown';
      routesByCity[city] = (routesByCity[city] || 0) + 1;
    });

    const routeDistribution = Object.entries(routesByCity).map(([city, count], i) => ({
      name: city,
      value: count,
      color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5]
    }));

    // Vehicle utilization - fixed values based on index
    const vehicleUtilization = vehicles.slice(0, 6).map((v, i) => ({
      name: v.vehicle_name?.substring(0, 10) || 'Vehicle',
      utilization: 65 + (i * 5) // Sequential values: 65, 70, 75, 80, 85, 90
    }));

    // Monthly trend - fixed values
    const monthlyTrend = [
      { month: 'Jan', bookings: 145, revenue: 890000 },
      { month: 'Feb', bookings: 168, revenue: 1020000 },
      { month: 'Mar', bookings: 192, revenue: 1180000 },
      { month: 'Apr', bookings: 156, revenue: 960000 },
      { month: 'May', bookings: 210, revenue: 1350000 },
      { month: 'Jun', bookings: 235, revenue: 1520000 }
    ];

    return { routeDistribution, vehicleUtilization, monthlyTrend };
  }, [routes, vehicles]);

  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Monthly Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#3B82F6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Routes by Origin City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.routeDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {analyticsData.routeDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Utilization */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Vehicle Utilization Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.vehicleUtilization} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BusinessAnalytics;
