import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity, 
  BarChart2, Calendar, CheckCircle, Clock, AlertTriangle, Percent,
  ExternalLink
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart, Area
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4', '#EAB308', '#EF4444'];

/**
 * ServiceExecutiveDashboard - Reusable Dashboard component for all Service Management pages
 * 
 * @param {object} props
 * @param {string} props.serviceType - The type of service (Hotels, Travel, etc.)
 * @param {React.ReactNode} props.serviceIcon - The icon component for the service
 * @param {string} props.primaryColor - Primary color theme (blue, orange, purple, green, etc.)
 * @param {object} props.stats - Statistics object containing:
 *   - totalItems: Total number of items (hotels, vehicles, restaurants, etc.)
 *   - activeItems: Number of active items
 *   - totalBookings: Total bookings count
 *   - totalRevenue: Total revenue amount
 *   - avgRating: Average rating
 *   - occupancyRate: Occupancy/utilization percentage
 *   - bookingsGrowth: Growth percentage
 *   - revenueGrowth: Revenue growth percentage
 * @param {object} props.bookingsByStatus - Object with booking counts by status
 * @param {array} props.dailyTrend - Array of daily trend data
 * @param {array} props.distribution - Array of distribution data for pie chart
 * @param {array} props.recentBookings - Array of recent bookings
 * @param {string} props.itemLabel - Label for items (e.g., "Hotels", "Vehicles", "Restaurants")
 * @param {string} props.secondaryLabel - Secondary metric label (e.g., "Rooms", "Routes", "Menu Items")
 * @param {number} props.secondaryCount - Secondary metric count
 * @param {function} props.onViewAllBookings - Handler for "View All Bookings" button
 * @param {React.ReactNode} props.analyticsSection - Optional analytics section to render above Recent Bookings
 */
export default function ServiceExecutiveDashboard({
  serviceType = "Service",
  serviceIcon,
  primaryColor = "blue",
  stats = {},
  bookingsByStatus = {},
  dailyTrend = [],
  distribution = [],
  recentBookings = [],
  itemLabel = "Items",
  secondaryLabel = "Sub-items",
  secondaryCount = 0,
  onViewAllBookings,
  analyticsSection = null
}) {
  const navigate = useNavigate();
  
  // Extract stats with defaults
  const {
    totalItems = 0,
    activeItems = 0,
    totalBookings = 0,
    totalRevenue = 0,
    avgRating = 0,
    occupancyRate = 0,
    bookingsGrowth = 0,
    revenueGrowth = 0
  } = stats;
  
  // Generate default data if not provided (using seeded values instead of random)
  const chartDailyTrend = useMemo(() => {
    if (dailyTrend.length > 0) return dailyTrend;
    // Default mock data with fixed values instead of random
    return [
      { date: 'Mon', bookings: 18, revenue: 320000 },
      { date: 'Tue', bookings: 22, revenue: 410000 },
      { date: 'Wed', bookings: 15, revenue: 280000 },
      { date: 'Thu', bookings: 28, revenue: 520000 },
      { date: 'Fri', bookings: 35, revenue: 680000 },
      { date: 'Sat', bookings: 42, revenue: 820000 },
      { date: 'Sun', bookings: 30, revenue: 580000 }
    ];
  }, [dailyTrend]);
  
  const chartDistribution = useMemo(() => {
    if (distribution.length > 0) return distribution;
    // Default mock data with fixed values
    return [
      { type: 'Standard', count: 15, color: CHART_COLORS[0] },
      { type: 'Premium', count: 8, color: CHART_COLORS[1] },
      { type: 'VIP', count: 4, color: CHART_COLORS[2] }
    ];
  }, [distribution]);
  
  // Color mapping for different services
  const getColorConfig = () => {
    const configs = {
      blue: { gradient: 'from-blue-500 to-blue-600', light: 'text-blue-100', dark: 'text-blue-200', bg: 'bg-blue-200' },
      purple: { gradient: 'from-purple-500 to-purple-600', light: 'text-purple-100', dark: 'text-purple-200', bg: 'bg-purple-200' },
      orange: { gradient: 'from-orange-500 to-orange-600', light: 'text-orange-100', dark: 'text-orange-200', bg: 'bg-orange-200' },
      green: { gradient: 'from-emerald-500 to-emerald-600', light: 'text-emerald-100', dark: 'text-emerald-200', bg: 'bg-emerald-200' },
      amber: { gradient: 'from-amber-500 to-orange-500', light: 'text-amber-100', dark: 'text-amber-200', bg: 'bg-amber-200' },
      indigo: { gradient: 'from-indigo-500 to-indigo-600', light: 'text-indigo-100', dark: 'text-indigo-200', bg: 'bg-indigo-200' },
      pink: { gradient: 'from-pink-500 to-pink-600', light: 'text-pink-100', dark: 'text-pink-200', bg: 'bg-pink-200' },
      teal: { gradient: 'from-teal-500 to-teal-600', light: 'text-teal-100', dark: 'text-teal-200', bg: 'bg-teal-200' },
      red: { gradient: 'from-red-500 to-red-600', light: 'text-red-100', dark: 'text-red-200', bg: 'bg-red-200' }
    };
    return configs[primaryColor] || configs.blue;
  };
  
  const colorConfig = getColorConfig();
  
  const handleViewAllBookings = () => {
    if (onViewAllBookings) {
      onViewAllBookings();
    } else {
      navigate('/admin/bookings');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`bg-gradient-to-br ${colorConfig.gradient} text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`${colorConfig.light} text-sm font-medium`}>Total {itemLabel}</p>
                <p className="text-4xl font-bold mt-1">{totalItems}</p>
                <p className={`${colorConfig.dark} text-xs mt-2 flex items-center gap-1`}>
                  <Activity className="h-3 w-3" /> {activeItems} active
                </p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4">
                {serviceIcon || <BarChart2 className="h-8 w-8" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">{secondaryLabel}</p>
                <p className="text-4xl font-bold mt-1">{secondaryCount}</p>
                <p className="text-purple-200 text-xs mt-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Across all {itemLabel.toLowerCase()}
                </p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold mt-1">{formatFCFA(totalRevenue)}</p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${revenueGrowth >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {revenueGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}% vs last period
                </p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4">
                <DollarSign className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Avg. Utilization</p>
                <p className="text-4xl font-bold mt-1">{occupancyRate}%</p>
                <p className="text-amber-200 text-xs mt-2 flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Current rate
                </p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4">
                <Percent className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Total Bookings</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{totalBookings}</p>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                bookingsGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {bookingsGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {bookingsGrowth >= 0 ? '+' : ''}{bookingsGrowth}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Avg. Rating</p>
                <p className="text-2xl font-bold text-slate-800 mt-1 flex items-center gap-1">
                  {avgRating} <span className="text-yellow-500">★</span>
                </p>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className={`text-lg ${i <= Math.round(avgRating) ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Confirmed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{bookingsByStatus.confirmed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{bookingsByStatus.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart2 className="h-5 w-5 text-blue-600" />
              Bookings & Revenue Trend
            </CardTitle>
            <CardDescription>Daily performance over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} 
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatFCFA(value) : value, 
                      name === 'revenue' ? 'Revenue' : 'Bookings'
                    ]} 
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Bookings" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="type"
                  >
                    {chartDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {chartDistribution.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color || CHART_COLORS[i % CHART_COLORS.length] }} 
                  />
                  <span className="truncate">{item.type}: {item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Recent Bookings
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleViewAllBookings} className="gap-2">
              View All <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-2" />
              <p>No recent bookings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.slice(0, 5).map((booking, i) => (
                <div 
                  key={booking.id || i} 
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => handleViewAllBookings()}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-600' :
                      booking.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {booking.status === 'confirmed' ? <CheckCircle className="h-5 w-5" /> :
                       booking.status === 'pending' ? <Clock className="h-5 w-5" /> :
                       <Calendar className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{booking.customer_name || 'Guest'}</p>
                      <p className="text-xs text-slate-500">{booking.service_name || booking.item_name || 'Booking'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatFCFA(booking.amount || booking.total_price || 0)}</p>
                    <Badge className={`text-xs ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {booking.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
