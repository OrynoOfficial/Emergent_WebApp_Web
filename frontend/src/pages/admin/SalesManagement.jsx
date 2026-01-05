import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Download,
  ArrowUp, ArrowDown, ShoppingCart, Users, Percent,
  Hotel, Bus, Car, Utensils, Ticket, Package, BarChart3
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const TIME_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last Quarter' },
  { value: '1y', label: 'This Year' }
];

const SERVICE_ICONS = {
  hotels: Hotel,
  travel: Bus,
  car_rental: Car,
  restaurants: Utensils,
  events: Ticket,
  packages: Package
};

export default function SalesManagement() {
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  // Mock data
  const salesSummary = {
    totalSales: 48500000,
    salesChange: 15.3,
    totalOrders: 1250,
    ordersChange: 8.7,
    avgOrderValue: 38800,
    avgValueChange: 6.1,
    conversionRate: 4.2,
    conversionChange: 0.8
  };

  const salesByService = [
    { service: 'hotels', name: 'Hotels', sales: 18500000, orders: 420, percentage: 38, change: 12.5 },
    { service: 'travel', name: 'Travel', sales: 12800000, orders: 520, percentage: 26, change: 18.2 },
    { service: 'car_rental', name: 'Car Rental', sales: 8200000, orders: 145, percentage: 17, change: 8.4 },
    { service: 'restaurants', name: 'Restaurants', sales: 5500000, orders: 125, percentage: 11, change: -2.1 },
    { service: 'events', name: 'Events', sales: 2500000, orders: 28, percentage: 5, change: 25.0 },
    { service: 'packages', name: 'Packages', sales: 1000000, orders: 12, percentage: 3, change: 45.0 }
  ];

  const dailySales = [
    { date: 'Dec 16', sales: 1450000, orders: 38 },
    { date: 'Dec 17', sales: 1680000, orders: 42 },
    { date: 'Dec 18', sales: 1320000, orders: 35 },
    { date: 'Dec 19', sales: 1890000, orders: 48 },
    { date: 'Dec 20', sales: 2150000, orders: 55 },
    { date: 'Dec 21', sales: 1950000, orders: 51 },
    { date: 'Dec 22', sales: 2060000, orders: 53 }
  ];

  const topProducts = [
    { name: 'Hilton Yaounde - Deluxe Room', category: 'hotels', sales: 4200000, units: 48 },
    { name: 'Yaounde-Douala Express', category: 'travel', sales: 2800000, units: 350 },
    { name: 'Mercedes C-Class Rental', category: 'car_rental', sales: 2100000, units: 22 },
    { name: 'La Belle Epoque - Fine Dining', category: 'restaurants', sales: 1500000, units: 85 },
    { name: 'Kribi Beach Package', category: 'packages', sales: 900000, units: 6 }
  ];

  const paymentMethods = [
    { method: 'MTN Mobile Money', amount: 22500000, percentage: 46, color: 'bg-yellow-500' },
    { method: 'Orange Money', amount: 14500000, percentage: 30, color: 'bg-orange-500' },
    { method: 'Card Payment', amount: 8500000, percentage: 18, color: 'bg-blue-500' },
    { method: 'Bank Transfer', amount: 3000000, percentage: 6, color: 'bg-gray-500' }
  ];

  const StatCard = ({ title, value, change, icon: Icon, prefix = '' }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold">{prefix}{typeof value === 'number' && value > 1000 ? value.toLocaleString() : value}</p>
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
          <h1 className="text-2xl font-bold text-[#082c59]">Sales Dashboard</h1>
          <p className="text-gray-600">Monitor sales performance and revenue</p>
        </div>
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {TIME_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sales" value={formatFCFA(salesSummary.totalSales)} change={salesSummary.salesChange} icon={DollarSign} />
        <StatCard title="Total Orders" value={salesSummary.totalOrders} change={salesSummary.ordersChange} icon={ShoppingCart} />
        <StatCard title="Avg. Order Value" value={formatFCFA(salesSummary.avgOrderValue)} change={salesSummary.avgValueChange} icon={TrendingUp} />
        <StatCard title="Conversion Rate" value={`${salesSummary.conversionRate}%`} change={salesSummary.conversionChange} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Service */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales by Service Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesByService.map(item => {
                const Icon = SERVICE_ICONS[item.service] || Package;
                return (
                  <div key={item.service} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#082c59]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{item.name}</span>
                        <span className="font-bold">{formatFCFA(item.sales)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#082c59] rounded-full" style={{ width: `${item.percentage}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-sm text-gray-500">
                        <span>{item.orders} orders ({item.percentage}%)</span>
                        <span className={item.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {item.change >= 0 ? '+' : ''}{item.change}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentMethods.map((pm, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{pm.method}</span>
                    <span className="font-medium">{pm.percentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${pm.color} rounded-full`} style={{ width: `${pm.percentage}%` }} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{formatFCFA(pm.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailySales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-500">{day.date}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#082c59] to-blue-400 rounded flex items-center justify-end pr-2"
                        style={{ width: `${(day.sales / 2500000) * 100}%` }}
                      >
                        <span className="text-xs text-white font-medium">{formatFCFA(day.sales)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm">{day.orders} orders</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, idx) => {
                const Icon = SERVICE_ICONS[product.category] || Package;
                return (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-lg font-bold text-[#082c59]">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{product.category.replace('_', ' ')}</Badge>
                        <span className="text-xs text-gray-500">{product.units} units</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#082c59]">{formatFCFA(product.sales)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
