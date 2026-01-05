import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Users,
  Hotel, Bus, Car, Utensils, Ticket, Package,
  DollarSign, ShoppingCart, Star, ArrowUp, ArrowDown
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const TIME_RANGES = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' }
];

const SERVICE_COLORS = {
  hotels: 'bg-blue-500',
  travel: 'bg-green-500',
  car_rental: 'bg-purple-500',
  restaurants: 'bg-orange-500',
  events: 'bg-pink-500',
  packages: 'bg-indigo-500'
};

export default function BookingAnalytics() {
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  // Mock data - in production, fetch from API
  const stats = {
    totalBookings: 12450,
    bookingsChange: 12.5,
    totalRevenue: 245000000,
    revenueChange: 8.3,
    avgBookingValue: 19678,
    avgValueChange: -2.1,
    conversionRate: 4.2,
    conversionChange: 0.5,
    cancelRate: 3.8,
    cancelChange: -0.3
  };

  const serviceBreakdown = [
    { service: 'hotels', name: 'Hotels', bookings: 3200, revenue: 85000000, percentage: 35 },
    { service: 'travel', name: 'Travel', bookings: 4500, revenue: 72000000, percentage: 29 },
    { service: 'car_rental', name: 'Car Rental', bookings: 1800, revenue: 45000000, percentage: 18 },
    { service: 'restaurants', name: 'Restaurants', bookings: 1950, revenue: 28000000, percentage: 11 },
    { service: 'events', name: 'Events', bookings: 650, revenue: 10000000, percentage: 4 },
    { service: 'packages', name: 'Packages', bookings: 350, revenue: 5000000, percentage: 3 }
  ];

  const topPerformers = [
    { name: 'Hilton Yaounde', service: 'hotels', bookings: 450, revenue: 38000000, rating: 4.8 },
    { name: 'Express Voyage Douala', service: 'travel', bookings: 1200, revenue: 24000000, rating: 4.5 },
    { name: 'Premium Auto Rentals', service: 'car_rental', bookings: 380, revenue: 19000000, rating: 4.7 },
    { name: 'La Belle Epoque', service: 'restaurants', bookings: 520, revenue: 8500000, rating: 4.9 },
    { name: 'Mont Febe Hotel', service: 'hotels', bookings: 320, revenue: 28000000, rating: 4.6 }
  ];

  const recentTrends = [
    { period: 'Week 1', bookings: 2800, revenue: 55000000 },
    { period: 'Week 2', bookings: 3100, revenue: 62000000 },
    { period: 'Week 3', bookings: 2950, revenue: 58000000 },
    { period: 'Week 4', bookings: 3600, revenue: 70000000 }
  ];

  const StatCard = ({ title, value, change, icon: Icon, prefix = '', suffix = '' }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span>{Math.abs(change)}% vs last period</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <Icon className="w-6 h-6 text-[#082c59]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Booking Analytics</h1>
          <p className="text-gray-600">Monitor booking performance and trends</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {TIME_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Bookings" value={stats.totalBookings} change={stats.bookingsChange} icon={ShoppingCart} />
        <StatCard title="Total Revenue" value={formatFCFA(stats.totalRevenue)} change={stats.revenueChange} icon={DollarSign} />
        <StatCard title="Avg. Booking Value" value={formatFCFA(stats.avgBookingValue)} change={stats.avgValueChange} icon={TrendingUp} />
        <StatCard title="Conversion Rate" value={stats.conversionRate} change={stats.conversionChange} icon={Users} suffix="%" />
        <StatCard title="Cancellation Rate" value={stats.cancelRate} change={stats.cancelChange} icon={TrendingDown} suffix="%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bookings by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceBreakdown.map(item => (
                <div key={item.service} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium">{item.name}</div>
                  <div className="flex-1">
                    <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${SERVICE_COLORS[item.service]} rounded-full flex items-center justify-end pr-3`}
                        style={{ width: `${item.percentage}%` }}
                      >
                        <span className="text-xs text-white font-medium">{item.percentage}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm">{item.bookings.toLocaleString()}</div>
                  <div className="w-32 text-right text-sm font-medium">{formatFCFA(item.revenue)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTrends.map((trend, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{trend.period}</p>
                    <p className="text-sm text-gray-500">{trend.bookings.toLocaleString()} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#082c59]">{formatFCFA(trend.revenue)}</p>
                    {idx > 0 && (
                      <p className={`text-xs ${trend.revenue > recentTrends[idx-1].revenue ? 'text-green-600' : 'text-red-600'}`}>
                        {trend.revenue > recentTrends[idx-1].revenue ? '+' : ''}
                        {Math.round((trend.revenue - recentTrends[idx-1].revenue) / recentTrends[idx-1].revenue * 100)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Operators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-4 font-medium">Operator</th>
                  <th className="text-left p-4 font-medium">Service</th>
                  <th className="text-left p-4 font-medium">Bookings</th>
                  <th className="text-left p-4 font-medium">Revenue</th>
                  <th className="text-left p-4 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((op, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">
                          {idx + 1}
                        </div>
                        <span className="font-medium">{op.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize">{op.service.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-4">{op.bookings.toLocaleString()}</td>
                    <td className="p-4 font-medium">{formatFCFA(op.revenue)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{op.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
