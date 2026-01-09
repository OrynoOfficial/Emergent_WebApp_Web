import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI, ordersAPI } from '../api/client';
import { formatCurrency } from '../utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  ShoppingBag,
  DollarSign,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Package,
  Star,
  Calendar,
  Hotel,
  Car,
  Bus,
  Utensils,
  Film,
  Sparkles,
  BarChart3,
  Users,
  Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mock data for charts
const SPENDING_DATA = [
  { name: 'Hotels', value: 45000, color: '#EC4899' },
  { name: 'Travel', value: 28000, color: '#3B82F6' },
  { name: 'Car Rental', value: 18000, color: '#10B981' },
  { name: 'Restaurants', value: 12000, color: '#F59E0B' },
  { name: 'Events', value: 8000, color: '#8B5CF6' },
  { name: 'Other', value: 5000, color: '#64748B' },
];

const ACTIVITY_DATA = [
  { name: 'Mon', bookings: 4, spending: 25000 },
  { name: 'Tue', bookings: 6, spending: 35000 },
  { name: 'Wed', bookings: 3, spending: 18000 },
  { name: 'Thu', bookings: 8, spending: 52000 },
  { name: 'Fri', bookings: 12, spending: 78000 },
  { name: 'Sat', bookings: 15, spending: 95000 },
  { name: 'Sun', bookings: 9, spending: 48000 },
];

const MONTHLY_DATA = [
  { month: 'Jul', revenue: 125000, bookings: 24 },
  { month: 'Aug', revenue: 158000, bookings: 32 },
  { month: 'Sep', revenue: 142000, bookings: 28 },
  { month: 'Oct', revenue: 189000, bookings: 38 },
  { month: 'Nov', revenue: 215000, bookings: 45 },
  { month: 'Dec', revenue: 267000, bookings: 52 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('7days');

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ordersRes] = await Promise.all([
        analyticsAPI.getDashboard().catch(() => ({ data: null })),
        ordersAPI.getMyOrders({ limit: 5 }).catch(() => ({ data: { orders: [] } })),
      ]);
      setAnalytics(analyticsRes.data);
      setOrders(ordersRes.data?.orders || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const canManage = isAdmin || isOperator;

  const stats = [
    {
      title: 'Total Orders',
      value: analytics?.total_orders || 12,
      icon: ShoppingBag,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100',
      iconBg: 'bg-blue-500',
      growth: 12
    },
    {
      title: 'Total Spent',
      value: formatCurrency(analytics?.total_spent || 156000),
      icon: DollarSign,
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100',
      iconBg: 'bg-purple-500',
      growth: 8
    },
    {
      title: 'Completed',
      value: analytics?.completed_orders || 10,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGradient: 'from-emerald-50 to-emerald-100',
      iconBg: 'bg-emerald-500',
      growth: 15
    },
    {
      title: 'Pending',
      value: analytics?.pending_orders || 2,
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      bgGradient: 'from-amber-50 to-amber-100',
      iconBg: 'bg-amber-500',
      growth: -5
    }
  ];

  const quickActions = [
    { label: 'Hotels', icon: Hotel, path: '/services/hotels', color: 'bg-pink-500', lightColor: 'bg-pink-100' },
    { label: 'Restaurants', icon: Utensils, path: '/services/restaurants', color: 'bg-orange-500', lightColor: 'bg-orange-100' },
    { label: 'Travel', icon: Bus, path: '/services/travel', color: 'bg-blue-500', lightColor: 'bg-blue-100' },
    { label: 'Car Rental', icon: Car, path: '/services/car-rental', color: 'bg-emerald-500', lightColor: 'bg-emerald-100' },
    { label: 'Events', icon: Calendar, path: '/services/events', color: 'bg-amber-500', lightColor: 'bg-amber-100' },
    { label: 'Cinema', icon: Film, path: '/services/cinema', color: 'bg-cyan-500', lightColor: 'bg-cyan-100' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton loading */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 rounded-2xl skeleton"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-2xl skeleton"></div>
          <div className="h-80 rounded-2xl skeleton"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
          <p className="text-slate-500">Track your bookings and spending</p>
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-40 bg-white">
            <Calendar className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${stat.bgGradient} rounded-2xl p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
          >
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                {stat.growth !== undefined && (
                  <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${
                    stat.growth >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {stat.growth >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>{Math.abs(stat.growth)}%</span>
                    <span className="text-slate-500 font-normal">vs last period</span>
                  </div>
                )}
              </div>
              <div className={`${stat.iconBg} p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/30 group-hover:scale-125 transition-transform duration-500"></div>
            <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full bg-white/20"></div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SPENDING_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {SPENDING_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {SPENDING_DATA.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-medium text-slate-800 ml-auto">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Trend */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-blue-500" />
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA}>
                  <defs>
                    <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `${(v/1000)}k`} />
                  <Tooltip 
                    formatter={(value, name) => [name === 'spending' ? formatCurrency(value) : value, name === 'spending' ? 'Spent' : 'Bookings']}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="spending" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fill="url(#colorSpending)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.path}
                className="flex flex-col items-center p-4 rounded-xl hover:bg-slate-50 transition-all duration-200 group hover:shadow-md hover:-translate-y-1"
              >
                <div className={`w-14 h-14 rounded-2xl ${action.lightColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                  <action.icon className={`h-7 w-7`} style={{ color: action.color.replace('bg-', '#').replace('-500', '') }} />
                </div>
                <span className="text-sm font-medium text-slate-700 text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Link to="/orders">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-slate-400" />
                </div>
                <h4 className="text-lg font-medium text-slate-700 mb-2">No orders yet</h4>
                <p className="text-slate-500 mb-4">Start exploring our services</p>
                <Link to="/services">
                  <Button>
                    Browse Services <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order, idx) => (
                  <div
                    key={order.id || order._id || idx}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all duration-200 cursor-pointer hover:shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">
                        {order.service_name || 'Service Booking'}
                      </h4>
                      <p className="text-sm text-slate-500">Order #{order.order_number || `ORY-${1000 + idx}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(order.total_amount || 15000)}</p>
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status || 'confirmed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Top Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Hotel Bookings', count: 5, icon: Hotel, color: '#EC4899' },
                { name: 'Bus Tickets', count: 4, icon: Bus, color: '#3B82F6' },
                { name: 'Car Rentals', count: 2, icon: Car, color: '#10B981' },
                { name: 'Restaurant Reservations', count: 1, icon: Utensils, color: '#F59E0B' },
              ].map((service, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${service.color}20` }}>
                    <service.icon className="h-5 w-5" style={{ color: service.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm">{service.name}</p>
                    <p className="text-xs text-slate-500">{service.count} bookings</p>
                  </div>
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(service.count / 5) * 100}%`,
                        backgroundColor: service.color 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
