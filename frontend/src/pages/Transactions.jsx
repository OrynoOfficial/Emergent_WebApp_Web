import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  CreditCard, Search, Loader2, TrendingUp, TrendingDown,
  Calendar, ChevronLeft, ChevronRight, Building2, User, Mail,
  CheckCircle, Clock, XCircle, RotateCw, Banknote, Smartphone, X
} from 'lucide-react';
import { ordersAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { formatFCFA } from '../utils/currency';
import OperatorScopeFilter from '../components/common/OperatorScopeFilter';
import QuickDateRangeFilter, { inRange } from '../components/common/QuickDateRangeFilter';
import ViewModeToggle from '../components/common/ViewModeToggle';

const ITEMS_PER_PAGE = 15;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

const METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'stripe', label: 'Card (Stripe)' },
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

const methodIcon = (m) => {
  if (m === 'cash') return <Banknote className="h-3.5 w-3.5" />;
  if (m === 'mtn_momo' || m === 'orange_money') return <Smartphone className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
};

const statusColor = (s) => {
  switch (s?.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'success':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'pending':
    case 'processing':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'refunded':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'failed':
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const statusIcon = (s) => {
  switch (s?.toLowerCase()) {
    case 'paid':
    case 'completed':
      return <CheckCircle className="h-3 w-3" />;
    case 'pending':
      return <Clock className="h-3 w-3" />;
    case 'refunded':
      return <RotateCw className="h-3 w-3" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="h-3 w-3" />;
    default:
      return null;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export default function Transactions() {
  const { user, isOperatorUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [dateRange, setDateRange] = useState({ preset: 'last_30_days', from: null, to: null });
  const [viewMode, setViewMode] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, [isAdmin, isOperator]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, methodFilter, operatorFilter, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let res;
      if (isAdmin) {
        res = await ordersAPI.getAll({ limit: 500 });
      } else if (isOperator) {
        res = await ordersAPI.getOperatorOrders({ limit: 500, operator_id: user?.operator_id });
      } else {
        res = await ordersAPI.getMyOrders({ limit: 500 });
      }
      const orders = res.data?.orders || [];
      // Derive transactions from orders that have a payment signal
      const txns = orders
        .filter((o) => o.payment_method || o.payment_status || o.paid_at)
        .map((o) => ({
          id: o.id || o._id,
          transaction_ref: `TXN-${(o.order_number || o.id || '').toString().slice(-10).toUpperCase()}`,
          order_number: o.order_number,
          amount: o.total_amount || o.final_amount || 0,
          currency: o.currency || 'XAF',
          status: (o.payment_status || o.status || 'pending').toLowerCase(),
          method: o.payment_method || '',
          service_type: o.service_type || o.service_category || 'general',
          service_name: o.service_name || o.service_title || '',
          customer_name: o.customer_name || o.guest_customer?.name || o.user_email || 'Customer',
          customer_email: o.customer_email || o.user_email || o.guest_customer?.email || '',
          operator_id: o.operator_id || '',
          operator_name: o.operator_name || '',
          channel: o.channel || 'online',
          created_at: o.paid_at || o.created_at || o.updated_at,
        }));
      setTransactions(txns);
    } catch (e) {
      console.error('Failed to load transactions:', e);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...transactions];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.transaction_ref?.toLowerCase().includes(q) ||
        t.order_number?.toLowerCase().includes(q) ||
        t.customer_name?.toLowerCase().includes(q) ||
        t.customer_email?.toLowerCase().includes(q) ||
        t.service_type?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (methodFilter !== 'all') result = result.filter(t => t.method === methodFilter);
    if (operatorFilter) result = result.filter(t => t.operator_id === operatorFilter);
    if (dateRange.from || dateRange.to) result = result.filter(t => inRange(t.created_at, dateRange.from, dateRange.to));
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [transactions, searchQuery, statusFilter, methodFilter, operatorFilter, dateRange]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const s = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(s, s + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, t) => sum + (t.amount || 0), 0);
    const paidAmount = filtered.filter(t => t.status === 'paid' || t.status === 'completed').reduce((s, t) => s + t.amount, 0);
    const refundedAmount = filtered.filter(t => t.status === 'refunded').reduce((s, t) => s + t.amount, 0);
    return { total, paidAmount, refundedAmount, count: filtered.length, net: paidAmount - refundedAmount };
  }, [filtered]);

  const hasFilters = searchQuery || statusFilter !== 'all' || methodFilter !== 'all' || operatorFilter || dateRange.preset !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3" data-testid="transactions-title">
            <div className="p-2 bg-[#082c59] rounded-lg">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            {isAdmin ? 'All Transactions' : 'Transactions'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? 'All payment transactions across the platform'
              : isOperator
                ? 'Payment transactions for your services'
                : 'History of your payments and refunds'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickDateRangeFilter value={dateRange} onChange={setDateRange} />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Admin operator filter */}
      {isAdmin && (
        <div className="flex">
          <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 font-medium">Transactions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-sm text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Paid</p>
            <p className="text-xl font-bold text-emerald-700">{formatFCFA(stats.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <p className="text-sm text-indigo-600 font-medium flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Refunded</p>
            <p className="text-xl font-bold text-indigo-700">{formatFCFA(stats.refundedAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#082c59]/5 to-[#082c59]/10 border-[#082c59]/20">
          <CardContent className="p-4">
            <p className="text-sm text-[#082c59] font-medium">Net Revenue</p>
            <p className="text-xl font-bold text-[#082c59]">{formatFCFA(stats.net)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search transaction ref, customer, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="transactions-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {METHOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setMethodFilter('all'); setOperatorFilter(''); setDateRange({ preset: 'all', from: null, to: null }); }}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
        </div>
      ) : paginated.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700">No transactions found</h3>
            <p className="text-sm text-slate-500">{hasFilters ? 'Try clearing filters' : 'Transactions will appear here after payment is made'}</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="transactions-grid-view">
          {paginated.map(t => (
            <Card key={t.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs font-bold text-[#082c59] truncate">{t.transaction_ref}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(t.status)} gap-1`}>
                    {statusIcon(t.status)} {t.status}
                  </Badge>
                </div>
                <div className="text-sm">
                  <p className="font-medium truncate">{t.customer_name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.service_name || t.service_type}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-[10px] uppercase text-slate-400">Amount</p>
                  <p className="text-xl font-bold text-[#082c59]">{formatFCFA(t.amount)}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 capitalize">{methodIcon(t.method)} {t.method?.replace('_', ' ') || '—'}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(t.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === 'details' ? (
        <div className="space-y-3" data-testid="transactions-details-view">
          {paginated.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-all">
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#082c59]">{t.transaction_ref}</span>
                  <Badge variant="outline" className={`text-xs ${statusColor(t.status)} gap-1`}>{statusIcon(t.status)} {t.status}</Badge>
                  {t.channel === 'on_site' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Walk-in</Badge>}
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 capitalize">{t.service_type?.replace('_', ' ')}</Badge>
                </div>
                {t.service_name && <p className="text-sm font-medium">{t.service_name}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Customer</p>
                    <p className="text-slate-700 font-medium flex items-center gap-1"><User className="h-3 w-3" /> {t.customer_name}</p>
                  </div>
                  {t.customer_email && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Email</p>
                      <p className="text-slate-700 font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {t.customer_email}</p>
                    </div>
                  )}
                  {t.operator_name && (
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide">Operator</p>
                      <p className="text-slate-700 font-medium flex items-center gap-1"><Building2 className="h-3 w-3" /> {t.operator_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Method</p>
                    <p className="text-slate-700 font-medium flex items-center gap-1 capitalize">{methodIcon(t.method)} {t.method?.replace('_', ' ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Date</p>
                    <p className="text-slate-700 font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(t.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Order</p>
                    <p className="text-slate-700 font-medium font-mono">{t.order_number}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(t.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card data-testid="transactions-list-view">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-left p-3 font-medium">Customer</th>
                    <th className="text-left p-3 font-medium">Service</th>
                    {isAdmin && <th className="text-left p-3 font-medium">Operator</th>}
                    <th className="text-left p-3 font-medium">Method</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(t => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono text-xs text-[#082c59] font-semibold">{t.transaction_ref}</td>
                      <td className="p-3">
                        <p className="font-medium truncate max-w-[180px]">{t.customer_name}</p>
                        {t.customer_email && <p className="text-xs text-slate-400 truncate max-w-[180px]">{t.customer_email}</p>}
                      </td>
                      <td className="p-3 capitalize">
                        {t.service_name ? (
                          <p className="truncate max-w-[180px]">{t.service_name}</p>
                        ) : t.service_type?.replace('_', ' ')}
                      </td>
                      {isAdmin && <td className="p-3 text-slate-600 truncate max-w-[140px]">{t.operator_name || '—'}</td>}
                      <td className="p-3 capitalize">
                        <span className="inline-flex items-center gap-1 text-slate-600">{methodIcon(t.method)} {t.method?.replace('_', ' ') || '—'}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${statusColor(t.status)} gap-1 capitalize`}>{statusIcon(t.status)} {t.status}</Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-[#082c59]">{formatFCFA(t.amount)}</td>
                      <td className="p-3 text-slate-500">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
