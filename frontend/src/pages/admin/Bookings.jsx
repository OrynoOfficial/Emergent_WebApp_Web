import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Package, Check, X, Eye, Calendar, User, Mail, Building2,
  Globe2, Store, CreditCard, Banknote, Receipt, Loader2, RefreshCw
} from 'lucide-react';
import { formatFCFA } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import api from '../../api/client';
import OperatorScopeFilter from '../../components/common/OperatorScopeFilter';
import QuickDateRangeFilter, { inRange } from '../../components/common/QuickDateRangeFilter';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import Pagination from '../../components/common/Pagination';
import OrderDetailModal from '../../components/modals/OrderDetailModal';
import { toast } from 'sonner';

const CATEGORY_ICONS = {
  hotel: '🏨', restaurant: '🍽️', travel: '🚌', car_rental: '🚗',
  event: '🎫', package: '📦', cinema: '🎬', laundry: '👔', banquet: '🎊',
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  refunded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const CHANNEL_META = {
  online: { label: 'Online', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Globe2 },
  on_site: { label: 'Walk-in', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Store },
};

export default function AdminBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [dateRange, setDateRange] = useState({ preset: 'all', from: null, to: null });
  const [viewMode, setViewMode] = useState('list');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [refreshKey, channelFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Uses the unified endpoint that already supports channel + operator filters
      const res = await api.get('/operator/manual-bookings/', {
        params: { channel: channelFilter, limit: 500 },
      });
      setBookings(res.data?.bookings || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      toast.error('Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => ({
    total: bookings.length,
    online: bookings.filter(b => (b.channel || 'online') === 'online').length,
    on_site: bookings.filter(b => b.channel === 'on_site').length,
  }), [bookings]);

  const filtered = useMemo(() => {
    let r = [...bookings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(b =>
        (b.order_number || '').toLowerCase().includes(q) ||
        (b.guest_customer?.name || b.customer_name || b.user_email || '').toLowerCase().includes(q) ||
        (b.service_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') r = r.filter(b => b.status === statusFilter);
    if (categoryFilter !== 'all') r = r.filter(b => (b.service_type || b.service_category) === categoryFilter);
    if (operatorFilter) r = r.filter(b => b.operator_id === operatorFilter);
    if (dateRange.from || dateRange.to) r = r.filter(b => inRange(b.created_at, dateRange.from, dateRange.to));
    return r.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [bookings, searchQuery, statusFilter, categoryFilter, operatorFilter, dateRange]);

  // Pagination — keep the view scoped to a single page so admin lists don't blow up
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, categoryFilter, operatorFilter, dateRange, channelFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      await api.put(`/orders/${bookingId}/status`, { status: newStatus });
      toast.success(`Booking ${newStatus}`);
      setRefreshKey(k => k + 1);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openDetail = (order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const customerName = (b) => b.guest_customer?.name || b.customer_name || b.user_email || 'Customer';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-[#082c59] rounded-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            All Bookings
          </h1>
          <p className="text-slate-500 mt-1">View and manage all bookings (online + walk-in) across the platform</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickDateRangeFilter value={dateRange} onChange={setDateRange} />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Operator scope + channel tabs */}
      <div className="flex flex-wrap gap-4 items-center">
        <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
        <Tabs value={channelFilter} onValueChange={setChannelFilter}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all" data-testid="ab-channel-all">
              All <Badge className="ml-2 bg-slate-600 text-white">{counts.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="online" data-testid="ab-channel-online">
              <Globe2 className="h-3.5 w-3.5 mr-1" /> Online <Badge className="ml-2 bg-blue-500 text-white">{counts.online}</Badge>
            </TabsTrigger>
            <TabsTrigger value="on_site" data-testid="ab-channel-onsite">
              <Store className="h-3.5 w-3.5 mr-1" /> Walk-in <Badge className="ml-2 bg-amber-500 text-white">{counts.on_site}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search + filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search order #, customer, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="admin-bookings-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="car_rental">Car Rental</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="package">Packages</SelectItem>
                <SelectItem value="cinema">Cinema</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="banquet">Banquets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-700">No bookings found</h3>
            <p className="text-sm text-slate-500">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="admin-bookings-grid">
          {pageItems.map((b, idx) => {
            const chKey = b.channel === 'on_site' ? 'on_site' : 'online';
            const Ch = CHANNEL_META[chKey];
            return (
              <Card key={b.order_number || b.id || `grid-${idx}`} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#082c59] truncate">{b.order_number}</span>
                    <Badge className={`${Ch.color} border text-xs gap-1`}>
                      <Ch.icon className="h-3 w-3" /> {Ch.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CATEGORY_ICONS[b.service_type] || '📦'}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{b.service_name || b.service_type}</p>
                      <p className="text-xs text-slate-500 truncate">{customerName(b)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge>
                    {b.operator_name && <Badge variant="outline" className="text-xs bg-slate-100">{b.operator_name}</Badge>}
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-[10px] uppercase text-slate-400">Total</p>
                    <p className="text-xl font-bold text-[#082c59]">{formatFCFA(b.total_amount || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openDetail(b)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : viewMode === 'details' ? (
        <div className="space-y-3" data-testid="admin-bookings-details">
          {pageItems.map((b, idx) => {
            const chKey = b.channel === 'on_site' ? 'on_site' : 'online';
            const Ch = CHANNEL_META[chKey];
            return (
              <Card key={b.order_number || b.id || `details-${idx}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#082c59]">{b.order_number}</span>
                    <Badge className={`${Ch.color} border text-xs gap-1`}><Ch.icon className="h-3 w-3" /> {Ch.label}</Badge>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge>
                    <Badge variant="outline" className="text-xs bg-slate-100 capitalize">{b.service_type?.replace('_', ' ')}</Badge>
                  </div>
                  {b.service_name && <h3 className="font-semibold">{b.service_name}</h3>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase">Customer</p>
                      <p className="font-medium flex items-center gap-1"><User className="h-3 w-3" /> {customerName(b)}</p>
                    </div>
                    {(b.guest_customer?.email || b.customer_email) && (
                      <div>
                        <p className="text-slate-400 uppercase">Email</p>
                        <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> {b.guest_customer?.email || b.customer_email}</p>
                      </div>
                    )}
                    {b.operator_name && (
                      <div>
                        <p className="text-slate-400 uppercase">Operator</p>
                        <p className="font-medium flex items-center gap-1"><Building2 className="h-3 w-3" /> {b.operator_name}</p>
                      </div>
                    )}
                    {b.payment_method && (
                      <div>
                        <p className="text-slate-400 uppercase">Payment</p>
                        <p className="font-medium flex items-center gap-1 capitalize">
                          {b.payment_method === 'cash' ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                          {b.payment_method.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-400 uppercase">Date</p>
                      <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(b.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(b.total_amount || 0)}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(b)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      {b.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusUpdate(b.order_number, 'confirmed')}>
                            <Check className="h-4 w-4 mr-1" /> Confirm
                          </Button>
                          <Button variant="outline" size="sm" className="border-red-200 text-red-600" onClick={() => handleStatusUpdate(b.order_number, 'cancelled')}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card data-testid="admin-bookings-list">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Service</th>
                  <th className="text-left p-3 font-medium">Operator</th>
                  <th className="text-left p-3 font-medium">Channel</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((b, idx) => {
                  const chKey = b.channel === 'on_site' ? 'on_site' : 'online';
                  const Ch = CHANNEL_META[chKey];
                  return (
                    <tr key={b.order_number || b.id || `row-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-mono text-xs font-semibold text-[#082c59]">{b.order_number}</p>
                        <p className="text-xs text-slate-400">{formatDate(b.created_at)}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium truncate max-w-[200px]">{customerName(b)}</p>
                        {(b.guest_customer?.email || b.customer_email) && (
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">{b.guest_customer?.email || b.customer_email}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{CATEGORY_ICONS[b.service_type] || '📦'}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[150px]">{b.service_name || '-'}</p>
                            <p className="text-xs text-slate-400 capitalize">{b.service_type?.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 truncate max-w-[140px]">{b.operator_name || '—'}</td>
                      <td className="p-3">
                        <Badge className={`${Ch.color} border text-xs gap-1`}><Ch.icon className="h-3 w-3" /> {Ch.label}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-[#082c59]">{formatFCFA(b.total_amount || 0)}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(b)} title="View"><Eye className="h-4 w-4" /></Button>
                          {b.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50" onClick={() => handleStatusUpdate(b.order_number, 'confirmed')} title="Confirm"><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleStatusUpdate(b.order_number, 'cancelled')} title="Cancel"><X className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination footer (shown only when there's more than one page) */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="booking"
        className="mt-2"
      />

      {/* Detail Modal */}
      <OrderDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}
