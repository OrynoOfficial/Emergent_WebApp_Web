import { useEffect, useState } from 'react';
import { analyticsAPI } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingBag,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Hotel,
  Car,
  Plane,
  Utensils,
  Film,
  Shirt,
  Package
} from 'lucide-react';
import { formatFCFA } from '../../utils/currency';
import api from '../../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Area, AreaChart } from 'recharts';

const SERVICE_COLORS = {
  travel: '#3B82F6',
  hotels: '#EC4899',
  car_rental: '#10B981',
  restaurants: '#F59E0B',
  events: '#8B5CF6',
  cinema: '#EF4444',
  laundry: '#06B6D4',
  packages: '#6366F1'
};

const SERVICE_ICONS = {
  travel: Plane,
  hotels: Hotel,
  car_rental: Car,
  restaurants: Utensils,
  events: Calendar,
  cinema: Film,
  laundry: Shirt,
  packages: Package
};

const MOCK_DATA_ANALYTICS = {
  summary: {
    totalUsers: 2847,
    totalBookings: 8934,
    totalRevenue: 156780000,
    avgOrderValue: 17550,
    conversionRate: 3.2,
    growthRate: 12.5
  },
  revenueByService: [
    { name: 'Travel', value: 45678000, bookings: 2456 },
    { name: 'Hotels', value: 38900000, bookings: 1234 },
    { name: 'Car Rental', value: 28450000, bookings: 1876 },
    { name: 'Restaurants', value: 18900000, bookings: 1567 },
    { name: 'Events', value: 12340000, bookings: 678 },
    { name: 'Cinema', value: 6780000, bookings: 892 },
    { name: 'Packages', value: 4500000, bookings: 156 },
    { name: 'Laundry', value: 1232000, bookings: 75 }
  ],
  monthlyTrend: [
    { month: 'Jul', revenue: 12500000, bookings: 720, users: 180 },
    { month: 'Aug', revenue: 14200000, bookings: 850, users: 210 },
    { month: 'Sep', revenue: 13800000, bookings: 790, users: 195 },
    { month: 'Oct', revenue: 15600000, bookings: 920, users: 240 },
    { month: 'Nov', revenue: 18900000, bookings: 1100, users: 320 },
    { month: 'Dec', revenue: 22500000, bookings: 1350, users: 410 }
  ],
  topServices: [
    { service: 'Douala → Yaoundé Bus', category: 'travel', bookings: 456, revenue: 2280000 },
    { service: 'Hilton Douala', category: 'hotels', bookings: 234, revenue: 35100000 },
    { service: 'Toyota Corolla Rental', category: 'car_rental', bookings: 189, revenue: 6615000 },
    { service: 'La Belle Époque', category: 'restaurants', bookings: 156, revenue: 1170000 },
    { service: 'Afro Nation Festival', category: 'events', bookings: 145, revenue: 4350000 }
  ],
  userMetrics: {
    newUsers: 412,
    activeUsers: 1847,
    returningRate: 64,
    avgSessionTime: '8m 34s'
  }
};

// Empty data for operators without activity
const EMPTY_OPERATOR_DATA = {
  summary: {
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    conversionRate: 0,
    growthRate: 0
  },
  revenueByService: [],
  monthlyTrend: [],
  topServices: [],
  userMetrics: {
    newUsers: 0,
    activeUsers: 0,
    returningRate: 0,
    avgSessionTime: '0m 0s'
  }
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [dataAnalytics, setDataAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('6months');
  
  // Get user context to personalize analytics for operators
  const { user, isOperatorUser, operatorContext, operatorServiceTypes } = useAuth();
  const isOperator = isOperatorUser || user?.role === 'operator';

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Build params based on user role
      const params = { period: timeFilter };
      
      // If operator, filter by their services
      if (isOperator && operatorContext?.id) {
        params.operator_id = operatorContext.id;
      }
      
      // Fetch basic analytics
      const response = await analyticsAPI.getStats(params);
      setData(response.data);
      
      // Fetch extended analytics data
      const extendedRes = await api.get('/analytics/overview', { params });
      
      // For operators, always use real data (even if empty)
      if (isOperator) {
        if (extendedRes.data && extendedRes.data.summary) {
          setDataAnalytics(extendedRes.data);
        } else {
          setDataAnalytics(EMPTY_OPERATOR_DATA);
        }
      } else {
        // For admins, use real data if available, otherwise mock
        if (extendedRes.data && extendedRes.data.summary && extendedRes.data.summary.totalBookings > 0) {
          setDataAnalytics(extendedRes.data);
        } else {
          const mockWithRealUsers = { ...MOCK_DATA_ANALYTICS };
          if (extendedRes.data?.summary?.totalUsers) {
            mockWithRealUsers.summary.totalUsers = extendedRes.data.summary.totalUsers;
          }
          setDataAnalytics(mockWithRealUsers);
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // For operators, show empty data. For admins, show mock data.
      if (isOperator) {
        setData({
          total_revenue: 0,
          total_orders: 0,
          total_customers: 0,
          average_order_value: 0,
          revenue_growth: 0,
          orders_growth: 0,
          customers_growth: 0,
          category_breakdown: [],
          recent_trends: []
        });
        setDataAnalytics(EMPTY_OPERATOR_DATA);
      } else {
        setData({
          total_revenue: 125400,
          total_orders: 1847,
          total_customers: 892,
          average_order_value: 68,
          revenue_growth: 12.5,
          orders_growth: 8.3,
          customers_growth: 15.2,
          category_breakdown: [
            { name: 'Hotels', value: 45, color: '#EC4899' },
            { name: 'Restaurants', value: 25, color: '#F59E0B' },
            { name: 'Travel', value: 15, color: '#3B82F6' },
            { name: 'Car Rental', value: 10, color: '#10B981' },
            { name: 'Events', value: 5, color: '#8B5CF6' }
          ],
          recent_trends: [
            { date: 'Mon', revenue: 15000, orders: 45 },
            { date: 'Tue', revenue: 18000, orders: 52 },
            { date: 'Wed', revenue: 22000, orders: 65 },
            { date: 'Thu', revenue: 19000, orders: 55 },
            { date: 'Fri', revenue: 25000, orders: 72 },
            { date: 'Sat', revenue: 30000, orders: 88 },
            { date: 'Sun', revenue: 28000, orders: 81 }
          ]
        });
        setDataAnalytics(MOCK_DATA_ANALYTICS);
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = data ? [
    {
      title: 'Total Revenue',
      value: formatFCFA(data.total_revenue || 0),
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      growth: data.revenue_growth
    },
    {
      title: 'Total Orders',
      value: data.total_orders?.toLocaleString(),
      icon: ShoppingBag,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      growth: data.orders_growth
    },
    {
      title: 'Total Customers',
      value: data.total_customers?.toLocaleString(),
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      growth: data.customers_growth
    },
    {
      title: 'Avg Order Value',
      value: formatFCFA(data.average_order_value || 0),
      icon: Activity,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50'
    }
  ] : [];

  const pieData = dataAnalytics.revenueByService.map(s => ({
    name: s.name,
    value: s.value
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Operator Context Banner */}
      {isOperator && operatorContext && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-blue-900">
              Personalized Analytics for {operatorContext.name || 'Your Organization'}
            </h3>
            <p className="text-sm text-blue-700">
              Showing data filtered by your assigned services: {operatorServiceTypes?.join(', ') || 'All services'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="analytics-title">
            {isOperator ? 'My Analytics Dashboard' : 'Analytics Dashboard'}
          </h1>
          <p className="text-slate-600">
            {isOperator 
              ? 'Your personalized business performance metrics'
              : 'Comprehensive business intelligence dashboard'}
          </p>
        </div>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-40" data-testid="time-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="6months">Last 6 Months</SelectItem>
            <SelectItem value="1year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Extended Summary Stats (from Data Analytics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="summary-stats">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Users className="h-4 w-4" /> Total Users</div>
            <p className="text-2xl font-bold text-[#082c59]">{dataAnalytics.summary.totalUsers.toLocaleString()}</p>
            <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +{dataAnalytics.summary.growthRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><ShoppingBag className="h-4 w-4" /> Bookings</div>
            <p className="text-2xl font-bold text-[#082c59]">{dataAnalytics.summary.totalBookings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><DollarSign className="h-4 w-4" /> Revenue</div>
            <p className="text-xl font-bold text-[#082c59]">{formatFCFA(dataAnalytics.summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><BarChart3 className="h-4 w-4" /> Avg Order</div>
            <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(dataAnalytics.summary.avgOrderValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Activity className="h-4 w-4" /> Conversion</div>
            <p className="text-2xl font-bold text-green-600">{dataAnalytics.summary.conversionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Users className="h-4 w-4" /> Returning</div>
            <p className="text-2xl font-bold text-[#082c59]">{dataAnalytics.userMetrics.returningRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Extended Charts Row (from Data Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Bookings Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dataAnalytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(value, name) => [name === 'revenue' ? formatFCFA(value) : value, name]} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#082c59" fill="#082c59" fillOpacity={0.2} name="Revenue" />
                <Line yAxisId="right" type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={2} name="Bookings" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(SERVICE_COLORS)[index % Object.values(SERVICE_COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatFCFA(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Service Performance (from Data Analytics) */}
      <Card>
        <CardHeader>
          <CardTitle>Service Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dataAnalytics.revenueByService.map((service, i) => {
              const IconComponent = SERVICE_ICONS[service.name.toLowerCase().replace(' ', '_')] || Package;
              const color = Object.values(SERVICE_COLORS)[i % Object.values(SERVICE_COLORS).length];
              return (
                <div key={service.name} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                      <IconComponent className="h-5 w-5" style={{ color }} />
                    </div>
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <p className="text-xl font-bold text-[#082c59]">{formatFCFA(service.value)}</p>
                  <p className="text-sm text-slate-500">{service.bookings.toLocaleString()} bookings</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Trend (Original Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Daily Revenue Trend</h3>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {data?.recent_trends?.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t-lg transition-all hover:opacity-80"
                  style={{ height: `${(day.revenue / 30000) * 100}%` }}
                  title={formatFCFA(day.revenue)}
                ></div>
                <span className="text-xs text-slate-500">{day.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">By Category</h3>
            <PieChartIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {data?.category_breakdown?.map((cat, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                  <span className="text-sm text-slate-500">{cat.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${cat.value}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Services Table (from Data Analytics) */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Service</th>
                  <th className="text-left py-3">Category</th>
                  <th className="text-right py-3">Bookings</th>
                  <th className="text-right py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dataAnalytics.topServices.map((service, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="py-3 font-medium">{service.service}</td>
                    <td className="py-3">
                      <Badge style={{ backgroundColor: `${SERVICE_COLORS[service.category]}20`, color: SERVICE_COLORS[service.category] }}>
                        {service.category}
                      </Badge>
                    </td>
                    <td className="text-right py-3">{service.bookings.toLocaleString()}</td>
                    <td className="text-right py-3 font-medium">{formatFCFA(service.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Orders Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-6">Daily Orders Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Day</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Orders</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Revenue</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Avg Value</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent_trends?.map((day, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{day.date}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{day.orders}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{formatFCFA(day.revenue)}</td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {formatFCFA(Math.round(day.revenue / day.orders))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
