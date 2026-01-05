import { useEffect, useState } from 'react';
import { analyticsAPI, ordersAPI } from '../../api/client';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingBag,
  Calendar,
  BarChart,
  PieChart,
  Activity
} from 'lucide-react';
import { formatFCFA } from '../../utils/currency';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getStats({ period });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Mock data
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-slate-600">Monitor your business performance</p>
        </div>
        <div className="flex gap-2">
          {['day', 'week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.bgColor} rounded-2xl p-6 relative overflow-hidden`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                {stat.growth !== undefined && (
                  <div className={`flex items-center gap-1 mt-2 text-sm ${
                    stat.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{Math.abs(stat.growth)}%</span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Revenue Trend</h3>
            <BarChart className="h-5 w-5 text-slate-400" />
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
            <PieChart className="h-5 w-5 text-slate-400" />
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

      {/* Orders Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-6">Daily Orders</h3>
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
