import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Download,
  ArrowUp, ArrowDown, ShoppingCart, Users, Percent,
  Hotel, Bus, Car, Utensils, Ticket, Package, BarChart3, FileText, FileSpreadsheet,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { ordersAPI } from '@/api/client';
import api from '@/api/client';
import ManagementShell from '@/components/management/shared/ManagementShell';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

const TIME_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last Quarter' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

// Helper: filter orders by time range
function filterOrdersByRange(orders, range) {
  if (!orders?.length) return [];
  const now = new Date();
  let start = null;
  let end = null;
  switch (range) {
    case 'today': {
      start = new Date(now); start.setHours(0, 0, 0, 0); break;
    }
    case '7d': start = new Date(now.getTime() - 7 * 86400000); break;
    case '30d': start = new Date(now.getTime() - 30 * 86400000); break;
    case '90d': start = new Date(now.getTime() - 90 * 86400000); break;
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
    case 'last_year': {
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear(), 0, 1);
      break;
    }
    case 'all': default: return orders;
  }
  return orders.filter((o) => {
    const d = new Date(o.created_at || o.booking_date || o.service_date || o.updated_at);
    if (isNaN(d)) return false;
    if (start && d < start) return false;
    if (end && d >= end) return false;
    return true;
  });
}

const SERVICE_ICONS = {
  hotels: Hotel,
  travel: Bus,
  car_rental: Car,
  restaurants: Utensils,
  events: Ticket,
  packages: Package
};

// StatCard component moved outside to prevent re-creation on each render
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

export default function SalesManagement() {
  const { user, isOperatorUser, operatorContext, operatorServiceTypes } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [allOrders, setAllOrders] = useState([]);
  const [operators, setOperators] = useState([]);

  // Determine user type for data filtering
  const isSuperAdmin = user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isAdminLike = isSuperAdmin || user?.role === 'admin';
  
  // Page title based on user role
  const pageTitle = isSuperAdmin 
    ? 'Platform Revenue Dashboard' 
    : isOperator 
      ? `Revenue Dashboard - ${operatorContext?.name || 'My Business'}`
      : 'Revenue Dashboard';
  
  const pageSubtitle = isSuperAdmin
    ? 'Cumulative revenue data across all operators and services'
    : isOperator
      ? 'Revenue performance for your services'
      : 'Monitor revenue performance';

  useEffect(() => {
    fetchSalesData();
  }, [timeRange, selectedOperatorId]);

  // Fetch operators for admin filter
  useEffect(() => {
    if (!isAdminLike) return;
    (async () => {
      try {
        const res = await api.get('/operators/');
        setOperators(res.data.operators || res.data || []);
      } catch { /* ignore */ }
    })();
  }, [isAdminLike]);

  // Helper: compute previous-period date window for delta comparison
  const getPeriodWindow = (range) => {
    const now = new Date();
    let start = null;
    let end = now;
    switch (range) {
      case 'today': start = new Date(now); start.setHours(0, 0, 0, 0); break;
      case '7d':  start = new Date(now.getTime() - 7  * 86400000); break;
      case '30d': start = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': start = new Date(now.getTime() - 90 * 86400000); break;
      case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'last_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end   = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
      case 'last_year': {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end   = new Date(now.getFullYear(), 0, 1);
        break;
      }
      default: start = new Date(0);
    }
    return { start, end };
  };

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      // Fetch real orders data and payment methods in parallel
      const params = { limit: 2000 };
      if (selectedOperatorId) params.operator_id = selectedOperatorId;
      const [ordersRes, paymentMethodsRes] = await Promise.all([
        ordersAPI.getAll(params),
        ordersAPI.getPaymentMethods({ time_range: timeRange })
      ]);

      const rawOrders = ordersRes.data?.orders || [];
      const orders = filterOrdersByRange(rawOrders, timeRange);
      setAllOrders(orders);
      const paymentData = paymentMethodsRes.data || {};

      // Compute previous-period orders for change-rate deltas
      const { start, end } = getPeriodWindow(timeRange);
      const periodMs = Math.max(1, end.getTime() - start.getTime());
      const prevStart = new Date(start.getTime() - periodMs);
      const prevEnd = start;
      const prevOrders = rawOrders.filter((o) => {
        const d = new Date(o.created_at || o.booking_date || o.service_date || o.updated_at);
        return !isNaN(d) && d >= prevStart && d < prevEnd;
      });

      // Calculate totals from real data
      const totalSales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? Math.floor(totalSales / totalOrders) : 0;

      // Previous period totals
      const prevTotalSales = prevOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const prevTotalOrders = prevOrders.length;
      const prevAvgOrderValue = prevTotalOrders > 0 ? Math.floor(prevTotalSales / prevTotalOrders) : 0;

      // % change helper — returns rounded value with sign preserved
      const pctChange = (curr, prev) => {
        if (!prev) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 1000) / 10; // 1 decimal
      };

      // Conversion rate = completed (or paid) orders / total orders × 100
      const isCompleted = (o) => ['completed', 'confirmed', 'delivered', 'fulfilled'].includes((o.status || '').toLowerCase()) || (o.payment_status || '').toLowerCase() === 'paid';
      const completedOrders = orders.filter(isCompleted).length;
      const prevCompletedOrders = prevOrders.filter(isCompleted).length;
      const conversionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 1000) / 10 : 0;
      const prevConversionRate = prevTotalOrders > 0 ? Math.round((prevCompletedOrders / prevTotalOrders) * 1000) / 10 : 0;
      
      // Calculate by service type
      const byService = {};
      orders.forEach(order => {
        const serviceType = order.service_type || order.service_category || 'other';
        if (!byService[serviceType]) {
          byService[serviceType] = { sales: 0, orders: 0 };
        }
        byService[serviceType].sales += order.total_amount || 0;
        byService[serviceType].orders += 1;
      });

      // Same by service for the previous period (for accurate per-service deltas)
      const prevByService = {};
      prevOrders.forEach(order => {
        const serviceType = order.service_type || order.service_category || 'other';
        if (!prevByService[serviceType]) prevByService[serviceType] = { sales: 0 };
        prevByService[serviceType].sales += order.total_amount || 0;
      });

      const salesByService = Object.entries(byService).map(([service, data]) => ({
        service,
        name: service.charAt(0).toUpperCase() + service.slice(1).replace('_', ' '),
        sales: data.sales,
        orders: data.orders,
        percentage: totalSales > 0 ? Math.round((data.sales / totalSales) * 100) : 0,
        change: pctChange(data.sales, prevByService[service]?.sales || 0),
      })).sort((a, b) => b.sales - a.sales);

      setSalesData({
        summary: {
          totalSales,
          salesChange: pctChange(totalSales, prevTotalSales),
          totalOrders,
          ordersChange: pctChange(totalOrders, prevTotalOrders),
          avgOrderValue,
          avgValueChange: pctChange(avgOrderValue, prevAvgOrderValue),
          conversionRate,
          conversionChange: Math.round((conversionRate - prevConversionRate) * 10) / 10,
        },
        salesByService,
        paymentMethods: paymentData.payment_methods || [],
        orders
      });
    } catch (error) {
      console.error('Failed to fetch sales data:', error);
      // Empty state — show zeros instead of mock so users don't think the platform has stale fake data
      setSalesData({
        summary: { totalSales: 0, salesChange: 0, totalOrders: 0, ordersChange: 0, avgOrderValue: 0, avgValueChange: 0, conversionRate: 0, conversionChange: 0 },
        salesByService: [],
        paymentMethods: [],
        orders: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Use fetched data or fallback
  const salesSummary = salesData?.summary || {
    totalSales: 0,
    salesChange: 0,
    totalOrders: 0,
    ordersChange: 0,
    avgOrderValue: 0,
    avgValueChange: 0,
    conversionRate: 0,
    conversionChange: 0
  };
  
  const salesByService = salesData?.salesByService || [];

  // Revenue by Operator (admin/super_admin only) from real orders
  const revenueByOperator = useMemo(() => {
    if (!isAdminLike) return [];
    const map = new Map();
    for (const o of allOrders) {
      const opId = o.operator_id || 'unknown';
      const opName = o.operator_name || (operators.find((op) => (op._id || op.id) === opId)?.name) || 'Unknown';
      const prev = map.get(opId) || { operatorId: opId, operator: opName, revenue: 0, orders: 0 };
      prev.revenue += o.total_amount || 0;
      prev.orders += 1;
      prev.operator = opName;
      map.set(opId, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [allOrders, operators, isAdminLike]);

  // --- Export helpers ---
  const buildExportRows = () => {
    // Flat rows for CSV/XLS/PDF
    return allOrders.map((o) => ({
      order_id: o.id || o._id || '',
      created_at: o.created_at || o.booking_date || '',
      service_type: o.service_type || o.service_category || '',
      operator: o.operator_name || '',
      customer: o.customer_name || o.user_email || '',
      status: o.status || '',
      payment_status: o.payment_status || '',
      total_amount: o.total_amount || 0,
    }));
  };

  const exportFileBase = () => {
    const opTag = selectedOperatorId
      ? operators.find((op) => (op._id || op.id) === selectedOperatorId)?.name?.replace(/\s+/g, '_') || 'operator'
      : 'all_operators';
    return `platform_revenue_${opTag}_${timeRange}_${new Date().toISOString().slice(0, 10)}`;
  };

  const handleExportCSV = () => {
    try {
      const rows = buildExportRows();
      if (!rows.length) { toast.error('No data to export'); return; }
      const header = Object.keys(rows[0]).join(',');
      const body = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csv = `${header}\n${body}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${exportFileBase()}.csv`);
      toast.success('CSV exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const handleExportXLS = () => {
    try {
      const rows = buildExportRows();
      if (!rows.length) { toast.error('No data to export'); return; }
      const summarySheet = XLSX.utils.json_to_sheet([
        { metric: 'Total Revenue', value: salesSummary.totalSales },
        { metric: 'Total Orders', value: salesSummary.totalOrders },
        { metric: 'Avg Order Value', value: salesSummary.avgOrderValue },
        { metric: 'Time Range', value: timeRange },
        { metric: 'Operator', value: selectedOperatorId ? (operators.find((o) => (o._id || o.id) === selectedOperatorId)?.name || selectedOperatorId) : 'All' },
      ]);
      const ordersSheet = XLSX.utils.json_to_sheet(rows);
      const byOpSheet = XLSX.utils.json_to_sheet(revenueByOperator.length ? revenueByOperator : salesByService);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
      XLSX.utils.book_append_sheet(wb, ordersSheet, 'Orders');
      XLSX.utils.book_append_sheet(wb, byOpSheet, isAdminLike ? 'By Operator' : 'By Service');
      XLSX.writeFile(wb, `${exportFileBase()}.xlsx`);
      toast.success('Excel exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Platform Revenue Report', 14, 16);
      doc.setFontSize(10);
      doc.text(`Period: ${timeRange}`, 14, 24);
      const opName = selectedOperatorId ? (operators.find((o) => (o._id || o.id) === selectedOperatorId)?.name || selectedOperatorId) : 'All operators';
      doc.text(`Operator: ${opName}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

      // Summary
      doc.autoTable({
        startY: 42,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue', formatFCFA(salesSummary.totalSales)],
          ['Total Orders', String(salesSummary.totalOrders)],
          ['Avg Order Value', formatFCFA(salesSummary.avgOrderValue)],
        ],
      });

      // By operator (if admin) OR by service
      const secondTable = isAdminLike && revenueByOperator.length
        ? { head: [['Operator', 'Orders', 'Revenue']], body: revenueByOperator.map((r) => [r.operator, r.orders, formatFCFA(r.revenue)]), title: 'Revenue by Operator' }
        : { head: [['Service', 'Orders', 'Revenue', 'Share']], body: salesByService.map((s) => [s.name, s.orders, formatFCFA(s.sales), `${s.percentage}%`]), title: 'Revenue by Service' };
      doc.text(secondTable.title, 14, doc.lastAutoTable.finalY + 10);
      doc.autoTable({ startY: doc.lastAutoTable.finalY + 14, head: secondTable.head, body: secondTable.body });

      doc.save(`${exportFileBase()}.pdf`);
      toast.success('PDF exported');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  // Use real payment methods data from API, or fallback to calculated mock
  const paymentMethods = salesData?.paymentMethods?.length > 0
    ? salesData.paymentMethods
    : [
        { method: 'MTN Mobile Money', amount: Math.floor(salesSummary.totalSales * 0.46), percentage: 46, color: 'bg-yellow-500' },
        { method: 'Orange Money', amount: Math.floor(salesSummary.totalSales * 0.30), percentage: 30, color: 'bg-orange-500' },
        { method: 'Card Payment', amount: Math.floor(salesSummary.totalSales * 0.18), percentage: 18, color: 'bg-blue-500' },
        { method: 'Bank Transfer', amount: Math.floor(salesSummary.totalSales * 0.06), percentage: 6, color: 'bg-gray-500' }
      ];

  // ---------------------------------------------------------------
  // Daily Sales Trend — dynamic last-N-days driven by `dailyTrendRange`.
  // Default: last 14 days, ending today. Filterable in the UI.
  // ---------------------------------------------------------------
  const [dailyTrendRange, setDailyTrendRange] = useState(14);
  const dailySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = new Map();
    for (let i = dailyTrendRange - 1; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), iso: key, sales: 0, orders: 0 });
    }
    for (const o of allOrders) {
      const ts = new Date(o.created_at || o.booking_date || o.service_date || o.updated_at);
      if (isNaN(ts)) continue;
      const key = ts.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.sales += o.total_amount || 0;
        bucket.orders += 1;
      }
    }
    return Array.from(buckets.values());
  }, [allOrders, dailyTrendRange]);

  const dailySalesMax = useMemo(() => dailySales.reduce((m, d) => Math.max(m, d.sales), 0) || 1, [dailySales]);

  // Top selling products
  const topProducts = salesByService.slice(0, 5).map((item, idx) => ({
    name: `${item.name} - Top Item ${idx + 1}`,
    category: item.service,
    sales: Math.floor(item.sales * 0.3),
    units: Math.floor(item.orders * 0.2)
  }));

  return (
    <ManagementShell
      title={pageTitle}
      icon={DollarSign}
      subtitle={pageSubtitle}
      scopeFilter={
        <div className="flex items-center gap-2 flex-wrap">
          {isAdminLike && (
            <OperatorScopeFilter value={selectedOperatorId} onChange={setSelectedOperatorId} />
          )}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {TIME_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" data-testid="revenue-export-btn">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white" align="end">
              <DropdownMenuItem onClick={handleExportCSV} data-testid="export-csv-item">
                <FileText className="w-4 h-4 mr-2" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLS} data-testid="export-xls-item">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} data-testid="export-pdf-item">
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      testIdPrefix="sales-mgmt"
      activeTab="all"
    >
      <div className="mt-4 space-y-6">
      {/* Badges */}
      {(isSuperAdmin || (isOperator && operatorServiceTypes?.length > 0)) && (
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <Badge className="bg-purple-100 text-purple-700">All Operators Combined</Badge>
          )}
          {isOperator && operatorServiceTypes?.length > 0 && (
            <Badge className="bg-blue-100 text-blue-700">
              Services: {operatorServiceTypes.join(', ')}
            </Badge>
          )}
        </div>
      )}

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
        <Card data-testid="daily-sales-trend-card">
          <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Daily Sales Trend</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {dailySales.length > 0 && `${dailySales[0].date} → ${dailySales[dailySales.length - 1].date} · live data`}
              </p>
            </div>
            <Select value={String(dailyTrendRange)} onValueChange={(v) => setDailyTrendRange(parseInt(v, 10))}>
              <SelectTrigger className="w-32 h-8 text-xs" data-testid="daily-sales-range-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {dailySales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3" data-testid={`daily-sales-row-${day.iso}`}>
                  <div className="w-16 text-xs text-gray-500 tabular-nums shrink-0">{day.date}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#082c59] to-blue-400 rounded flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${day.sales > 0 ? Math.max(6, (day.sales / dailySalesMax) * 100) : 0}%` }}
                      >
                        {day.sales > 0 && <span className="text-[11px] text-white font-medium tabular-nums">{formatFCFA(day.sales)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="w-16 text-right text-xs text-slate-600 tabular-nums shrink-0">{day.orders} orders</div>
                </div>
              ))}
              {dailySales.every((d) => d.orders === 0) && (
                <p className="text-center text-sm text-slate-500 italic py-6">No orders in the selected window.</p>
              )}
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

      {/* Revenue by Operator — admin & super_admin only */}
      {isAdminLike && revenueByOperator.length > 0 && (
        <Card data-testid="revenue-by-operator-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Revenue by Operator</CardTitle>
            <span className="text-xs text-slate-500">Top {Math.min(10, revenueByOperator.length)} of {revenueByOperator.length} operators</span>
          </CardHeader>
          <CardContent>
            <div className="h-80 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByOperator.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="operator" type="category" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatFCFA(v)} />
                  <Bar dataKey="revenue" fill="#082c59" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Operator</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByOperator.map((op, idx) => {
                    const share = salesSummary.totalSales > 0 ? ((op.revenue / salesSummary.totalSales) * 100).toFixed(1) : 0;
                    return (
                      <tr key={op.operatorId} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{op.operator}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{op.orders}</td>
                        <td className="px-4 py-2 text-right font-bold text-[#082c59]">{formatFCFA(op.revenue)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </ManagementShell>
  );
}
