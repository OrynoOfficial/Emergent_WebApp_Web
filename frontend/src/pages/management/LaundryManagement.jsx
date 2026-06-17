import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import {
  Shirt, Plus, Edit, Trash2, MapPin, Clock, DollarSign, Package,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Users, Droplets, Eye, Banknote, Receipt, Replace as ReplaceIcon,
  Phone, Truck, Sparkles, Wallet, CreditCard
} from 'lucide-react';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import BulkActionsBar, { BulkSelectHeader, BulkSelectCell } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import PressingFormBody from '@/components/management/laundry/PressingFormBody';
import { Search } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const PAGE_SIZE = 12;

const CHART_COLORS = ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

const DEFAULT_PRESSING_FORM = {
  // Identity
  name: '',
  description: '',
  // Pricing model
  shop_type: 'laundry',          // 'laundry' | 'pressing' | 'both'
  price_per_kg: '',              // used when shop_type ∈ {laundry, both}
  item_prices: [],               // [{item, price}] — used when shop_type ∈ {pressing, both}
  // Location & contact
  address: '',
  city: '',
  phone: '',
  email: '',
  whatsapp: '',
  instagram: '',
  website: '',
  // Storefront
  images: [],
  services: [],
  operating_hours: {},
  turnaround_hours: 24,
  // Delivery / pickup
  delivery_available: false,
  delivery_fee: 0,
  pickup_radius_km: 0,
  express_available: false,
  express_surcharge: 50,
  min_order_amount: 0,
  // Accepted payments
  accepts_card: false,
  accepts_momo: true,
  accepts_cash: true,
  // Operator scope
  operator_id: '',
  operator_name: '',
  // Listing-level refund policy override
  refund_policy: null,
};

// Laundry specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

const BusinessAnalytics = () => {
  const analyticsData = useMemo(() => {
    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', orders: 185, revenue: 420000 },
      { month: 'Feb', orders: 210, revenue: 485000 },
      { month: 'Mar', orders: 245, revenue: 580000 },
      { month: 'Apr', orders: 228, revenue: 520000 },
      { month: 'May', orders: 275, revenue: 680000 },
      { month: 'Jun', orders: 310, revenue: 820000 }
    ];

    return { monthlyTrend };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#06B6D4" strokeWidth={2} name="Orders" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function LaundryManagement() {
  useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pressings, setPressings] = useState([]);
  const [replacePressing, setReplacePressing] = useState(null);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPressingDialogOpen, setIsPressingDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPressing, setViewingPressing] = useState(null);
  const [editingPressing, setEditingPressing] = useState(null);
  const [pressingForm, setPressingForm] = useState(DEFAULT_PRESSING_FORM);

  // Use the laundry dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  const [pressingSearch, setPressingSearch] = useState('');
  const [pressingPage, setPressingPage] = useState(1);
  const dashboardData = useRealDashboardData('laundry', '30days', scopeOperatorId);

  const filteredPressings = useMemo(() => {
    if (!pressingSearch) return pressings;
    const s = pressingSearch.toLowerCase();
    return pressings.filter(p =>
      (p.name || '').toLowerCase().includes(s) ||
      (p.city || '').toLowerCase().includes(s) ||
      (p.address || '').toLowerCase().includes(s)
    );
  }, [pressings, pressingSearch]);
  useEffect(() => { setPressingPage(1); }, [pressingSearch]);
  const pressingTotalPages = Math.max(1, Math.ceil(filteredPressings.length / PAGE_SIZE));
  const pagedPressings = useMemo(
    () => filteredPressings.slice((pressingPage - 1) * PAGE_SIZE, pressingPage * PAGE_SIZE),
    [filteredPressings, pressingPage]
  );

  // Bulk selection on the visible page.
  const pressingBulk = useBulkSelection(pagedPressings, { idKey: 'id' });
  const runBulk = async (action, ids) => {
    await api.post('/admin/bulk', { collection: 'pressings', action, ids });
    if (typeof loadPressings === 'function') await loadPressings();
  };
  const bulkPressingDelete     = (ids) => runBulk('delete', ids);
  const bulkPressingActivate   = (ids) => runBulk('activate', ids);
  const bulkPressingDeactivate = (ids) => runBulk('deactivate', ids);

  const handleViewPressing = (pressing) => {
    setViewingPressing(pressing);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(pressing.id, pressing.name);
  };

  const loadPressings = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/pressing/management/my-shops${params}`);
      // Backend returns `shops` from my-shops; older callers used `pressings`.
      setPressings(res.data.shops || res.data.pressings || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setPressings([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => {
    loadPressings();
  }, [loadPressings]);

  const openPressingDialog = (pressing = null) => {
    setEditingPressing(pressing);
    if (pressing) {
      setPressingForm({
        ...DEFAULT_PRESSING_FORM,
        ...pressing,
        price_per_kg: pressing.price_per_kg != null ? String(pressing.price_per_kg) : '',
        item_prices: Array.isArray(pressing.item_prices) ? pressing.item_prices : [],
        // Legacy rows: coerce services into list of strings (badge keys)
        services: (pressing.services || []).map((s) => (typeof s === 'string' ? s : (s?.type || s?.name || ''))).filter(Boolean),
        operator_id: pressing.operator_id || '',
        operator_name: pressing.operator_name || '',
      });
    } else {
      setPressingForm(DEFAULT_PRESSING_FORM);
    }
    setIsPressingDialogOpen(true);
  };

  const handleSavePressing = async () => {
    // Client-side validation up-front so the user gets a clear toast instead of
    // a vague 422 from the backend.
    if (!pressingForm.name?.trim() || !pressingForm.address?.trim() || !pressingForm.city?.trim()) {
      toast.error('Name, address and city are required.');
      return;
    }
    const st = pressingForm.shop_type || 'laundry';
    const kg = parseFloat(pressingForm.price_per_kg);
    if ((st === 'laundry' || st === 'both') && !(kg > 0)) {
      toast.error('Price per kg is required for a laundry shop.');
      return;
    }
    const items = (pressingForm.item_prices || []).filter((i) => (i.item || '').trim() && Number(i.price) > 0);
    if ((st === 'pressing' || st === 'both') && items.length === 0) {
      toast.error('Add at least one priced item for a pressing shop.');
      return;
    }
    try {
      const operator = operators.find((op) => (op._id || op.id) === pressingForm.operator_id);
      const payload = {
        name: pressingForm.name.trim(),
        description: pressingForm.description || '',
        shop_type: st,
        price_per_kg: st === 'pressing' ? null : (kg > 0 ? kg : 0),
        item_prices: st === 'laundry' ? [] : items.map((i) => ({
          item: i.item.trim(),
          price: Number(i.price),
          image_url: i.image_url || null,
        })),
        address: pressingForm.address.trim(),
        city: pressingForm.city.trim(),
        phone: pressingForm.phone || '',
        email: pressingForm.email || '',
        images: pressingForm.images || [],
        services: (pressingForm.services || []).map((s) => (typeof s === 'string' ? s : s?.type || s?.name || '')).filter(Boolean),
        operating_hours: pressingForm.operating_hours || {},
        turnaround_hours: Number(pressingForm.turnaround_hours) || 24,
        delivery_available: !!pressingForm.delivery_available,
        delivery_fee: Number(pressingForm.delivery_fee) || 0,
        pickup_radius_km: Number(pressingForm.pickup_radius_km) || 0,
        express_available: !!pressingForm.express_available,
        express_surcharge: Number(pressingForm.express_surcharge) || 0,
        min_order_amount: Number(pressingForm.min_order_amount) || 0,
        operator_id: pressingForm.operator_id || undefined,
        operator_name: operator?.name || pressingForm.operator_name || '',
        refund_policy: pressingForm.refund_policy || null,
      };
      if (editingPressing) {
        await api.put(`/pressing/${editingPressing.id}`, payload);
        toast.success('Shop updated');
      } else {
        await api.post('/pressing/', payload);
        toast.success('Shop created');
      }
      setIsPressingDialogOpen(false);
      loadPressings();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ')
        : (detail || 'Failed to save');
      toast.error(msg);
    }
  };

  const handleDeletePressing = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/pressing/${id}`);
      toast.success('Deleted');
      loadPressings();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <>
    <ManagementShell
      title="Laundry & Pressing Management"
      icon={Shirt}
      titleColorClass="text-purple-800"
      iconColorClass="text-purple-600"
      subtitle="Manage shops, orders, analytics, and communications"
      scopeFilter={<OperatorScopeFilter serviceType="pressing" value={scopeOperatorId} onChange={setScopeOperatorId} />}
      onRefresh={loadPressings}
      refreshing={loading}
      tabs={[
        { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { value: 'management', label: 'Management', icon: Shirt },
        { value: 'communications', label: 'Communications', icon: MessageSquare },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      testIdPrefix="laundry-mgmt"
    >

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Laundry"
            serviceIcon={<Shirt className="h-8 w-8" />}
            primaryColor="teal"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Shops"
            secondaryLabel="Services"
            secondaryCount={dashboardData.secondaryCount}
            recentBookingsSlot={
              <OperatorBookingsList serviceType="laundry" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
            }
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6 space-y-4">
          <SubpageCard title="Shops" icon={Shirt} iconColorClass="text-purple-600" count={filteredPressings.length} testId="laundry-mgmt-subpage-card">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search shops by name, city, address…"
                value={pressingSearch}
                onChange={(e) => setPressingSearch(e.target.value)}
                className="pl-9 h-8 bg-white text-sm"
                data-testid="pressings-search-input"
              />
            </div>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <PermissionGate permission="pressing.create">
              <Button onClick={() => openPressingDialog()} size="sm" className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-md shadow-purple-500/20 h-8" data-testid="add-pressing-btn">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Shop
              </Button>
            </PermissionGate>
          </SubpageCard>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredPressings.length === 0 ? (
            <Card className="p-12 text-center">
              <Shirt className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">{pressingSearch ? 'No shops match your search' : 'No shops found.'}</p>
            </Card>
          ) : viewMode === 'list' ? (
            <Card className="overflow-hidden" data-testid="pressings-list-view">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3 w-8">
                        <BulkSelectHeader
                          allSelected={pressingBulk.allSelected}
                          partiallySelected={pressingBulk.partiallySelected}
                          onToggleAll={pressingBulk.toggleAll}
                          testid="pressings-bulk-select-all"
                        />
                      </th>
                      <th className="px-4 py-3">Shop</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Pricing</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPressings.map(p => {
                      const st = p.shop_type || 'laundry';
                      const items = Array.isArray(p.item_prices) ? p.item_prices : [];
                      const minItem = items.map(i => Number(i.price)).filter(n => n > 0);
                      const priceCell = st === 'pressing'
                        ? (minItem.length ? `from ${formatFCFA(Math.min(...minItem))} / item` : '—')
                        : st === 'both'
                          ? `${formatFCFA(p.price_per_kg || 0)}/kg · ${items.length} items`
                          : `${formatFCFA(p.price_per_kg || 0)} / kg`;
                      return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 w-8">
                          <BulkSelectCell
                            selected={pressingBulk.isSelected(p.id)}
                            onToggle={pressingBulk.toggle}
                            id={p.id}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`capitalize ${
                            st === 'pressing' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                              : st === 'both' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`} data-testid={`shop-type-badge-${p.id}`}>
                            {st === 'both' ? 'Laundry + Pressing' : st}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.city || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{p.phone || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{priceCell}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleViewPressing(p)}>View</Button>
                            <PermissionGate permission="pressing.edit">
                              <Button size="sm" variant="ghost" onClick={() => openPressingDialog(p)}>Edit</Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className={viewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`pressings-${viewMode}-view`}>
              {pagedPressings.map(pressing => {
                const st = pressing.shop_type || 'laundry';
                const items = Array.isArray(pressing.item_prices) ? pressing.item_prices : [];
                const minItem = items.map(i => Number(i.price)).filter(n => n > 0);
                const cover = (pressing.images || [])[0];
                const typeBadge = st === 'pressing' ? 'bg-fuchsia-500 text-white border-transparent'
                  : st === 'both' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent'
                  : 'bg-purple-500 text-white border-transparent';
                const typeLabel = st === 'both' ? 'Laundry + Pressing' : st;
                const priceMain = st === 'pressing'
                  ? (minItem.length ? `from ${formatFCFA(Math.min(...minItem))} / item` : 'No prices')
                  : st === 'both'
                    ? `${formatFCFA(pressing.price_per_kg || 0)}/kg · ${items.length} items`
                    : `${formatFCFA(pressing.price_per_kg || 0)} / kg`;
                return (
                <Card
                  key={pressing.id}
                  className="overflow-hidden border-purple-100/50 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 transition-all"
                  data-testid={`pressing-card-${pressing.id}`}
                >
                  {/* Cover photo (or gradient fallback when no images yet) */}
                  <div className={`h-32 relative ${viewMode === 'details' ? 'md:hidden' : ''}`}>
                    {cover ? (
                      <img src={cover} alt={pressing.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center">
                        <Shirt className="h-10 w-10 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <Badge className={`absolute top-2 left-2 capitalize text-[10px] shadow-md ${typeBadge}`}>
                      {typeLabel}
                    </Badge>
                    {(pressing.images || []).length > 1 && (
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {(pressing.images || []).slice(1, 3).map((thumb, i) => (
                          <div key={i} className="w-9 h-9 rounded border-2 border-white/80 overflow-hidden shadow">
                            <img src={thumb} alt={`${pressing.name} ${i + 2}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="absolute bottom-2 right-2 text-white text-sm font-semibold truncate max-w-[60%] text-right drop-shadow" title={pressing.name}>{pressing.name}</p>
                  </div>

                  <CardContent className="pt-4 pb-4 space-y-2.5">
                    {viewMode === 'details' && (
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold flex-1 truncate text-slate-900">{pressing.name}</h3>
                        <Badge className={`capitalize text-[10px] ${typeBadge}`}>{typeLabel}</Badge>
                      </div>
                    )}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-purple-700" />{[pressing.address, pressing.city].filter(Boolean).join(' · ') || '—'}</div>
                      {pressing.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-purple-700" />{pressing.phone}</div>}
                      {pressing.turnaround_hours && <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-purple-700" />{pressing.turnaround_hours}h turnaround</div>}
                      {viewMode === 'details' && pressing.description && (
                        <div className="text-slate-600 pt-2 border-t border-purple-100/60 line-clamp-2">{pressing.description}</div>
                      )}
                    </div>

                    {/* Service-type chips */}
                    {pressing.services?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pressing.services.slice(0, viewMode === 'details' ? 8 : 4).map((s, idx) => (
                          <Badge key={typeof s === 'string' ? s : s?.name || idx} variant="outline" className="text-[10px] capitalize bg-purple-50 text-purple-800 border-purple-200">
                            {typeof s === 'string' ? s.replace(/_/g, ' ') : s?.name || s?.type || 'Service'}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Per-item prices preview for pressing/both */}
                    {st !== 'laundry' && items.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {items.slice(0, viewMode === 'details' ? 6 : 3).map((ip, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 border border-fuchsia-100 text-[10px] rounded">
                            <span className="text-fuchsia-900 font-medium">{ip.item}</span>
                            <span className="text-fuchsia-700">·</span>
                            <span className="text-fuchsia-900 font-bold">{formatFCFA(Number(ip.price))}</span>
                          </span>
                        ))}
                        {items.length > (viewMode === 'details' ? 6 : 3) && (
                          <span className="text-[10px] text-slate-400 self-center">+{items.length - (viewMode === 'details' ? 6 : 3)}</span>
                        )}
                      </div>
                    )}

                    {/* Logistics quick-info row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {pressing.delivery_available && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"><Truck className="w-2.5 h-2.5 mr-1" /> Delivery</Badge>
                      )}
                      {pressing.express_available && (
                        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-800 border-orange-200"><Sparkles className="w-2.5 h-2.5 mr-1" /> Express</Badge>
                      )}
                      {pressing.accepts_momo && <Wallet className="w-3.5 h-3.5 text-slate-400" title="Mobile money" />}
                      {pressing.accepts_card && <CreditCard className="w-3.5 h-3.5 text-slate-400" title="Card" />}
                      {pressing.accepts_cash && <Banknote className="w-3.5 h-3.5 text-slate-400" title="Cash" />}
                    </div>

                    <div className="font-bold text-purple-700 pt-2 border-t border-purple-100/60">{priceMain}</div>

                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => handleViewPressing(pressing)} title="View Details" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <PermissionGate permission="pressing.edit">
                        <Button size="sm" variant="outline" onClick={() => setReplacePressing(pressing)} title="Migrate bookings" className="text-purple-700 hover:bg-purple-50 border-purple-200" data-testid={`replace-pressing-btn-${pressing.id}`}>
                          <ReplaceIcon className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="pressing.edit">
                        <Button size="sm" variant="outline" className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => openPressingDialog(pressing)}>
                          <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="pressing.delete">
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeletePressing(pressing.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              );})}
            </div>
          )}

          <Pagination
            page={pressingPage}
            totalPages={pressingTotalPages}
            onChange={setPressingPage}
            total={filteredPressings.length}
            pageSize={PAGE_SIZE}
            itemLabel="shop"
          />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Laundry"
            serviceTag="pressing"
            operatorId={scopeOperatorId}
            serviceIcon={<Shirt className="h-5 w-5 text-purple-600" />}
            primaryColor="teal"
          />
        </TabsContent>
      </ManagementShell>

      <ServiceFormShell
        open={isPressingDialogOpen}
        onOpenChange={setIsPressingDialogOpen}
        icon={Shirt}
        title={editingPressing ? 'Edit Shop' : 'Add Pressing Shop'}
        subtitle={editingPressing
          ? 'Update services, pricing, contact and storefront photos.'
          : 'Register a new shop — pricing model, contact, logistics and storefront photos.'}
        editing={!!editingPressing}
        accent="purple"
        leftColumn={
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Storefront photos</Label>
              <div className="mt-2">
                <MiniImageUploader
                  images={pressingForm.images || []}
                  onChange={(imgs) => setPressingForm((p) => ({ ...p, images: imgs }))}
                  max={3}
                  folder="pressing"
                  accent="purple"
                  helperText="Up to 3 photos. The first is the cover."
                />
              </div>
            </div>
            <PressingFormBody
              form={pressingForm}
              setForm={setPressingForm}
              operatorSelector={
                <OperatorSelector
                  value={pressingForm.operator_id || ''}
                  onChange={(id, name) => setPressingForm((p) => ({ ...p, operator_id: id, operator_name: name }))}
                  operators={operators}
                  testId="pressing-operator-selector"
                />
              }
            />
          </div>
        }
        preview={
          <GenericPreviewCard
            cover={(pressingForm.images || [])[0]}
            thumbs={(pressingForm.images || []).slice(1, 3)}
            icon={Shirt}
            badgeText={
              pressingForm.shop_type === 'pressing' ? 'Pressing'
                : pressingForm.shop_type === 'both' ? 'Laundry + Pressing'
                : 'Laundry'
            }
            badgeClass="bg-purple-500 text-white"
            placeholderColor="from-purple-700 via-purple-600 to-fuchsia-500"
            title={pressingForm.name || 'Shop name'}
            subtitle={pressingForm.phone || 'Contact phone'}
            location={[pressingForm.address, pressingForm.city].filter(Boolean).join(' · ') || 'Address · City'}
            tags={(pressingForm.services || []).map((s) => (typeof s === 'string' ? s : s?.type || s?.name || '')).filter(Boolean)}
            tagsAccentClass="bg-purple-50 text-purple-700"
            priceLabel={
              pressingForm.shop_type === 'pressing' ? 'Starts at'
                : pressingForm.shop_type === 'both' ? 'Per kg · items'
                : 'Per Kg'
            }
            priceValue={(() => {
              if (pressingForm.shop_type === 'pressing') {
                const valid = (pressingForm.item_prices || [])
                  .map((i) => Number(i.price))
                  .filter((n) => n > 0);
                return valid.length ? `${Math.min(...valid).toLocaleString()} FCFA` : '—';
              }
              const kg = Number(pressingForm.price_per_kg);
              return kg > 0 ? `${kg.toLocaleString()} FCFA` : '—';
            })()}
            accentTextClass="text-purple-700"
          />
        }
        submitting={false}
        submitLabel={editingPressing ? 'Update Shop' : 'Add Shop'}
        onSubmit={handleSavePressing}
        submitDataTestId="save-pressing-btn"
      />

      {/* View Laundry/Pressing Dialog */}
      {/* View Laundry/Pressing Dialog — rebuilt: hero photo gallery, per-item gallery */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[92vh] overflow-y-auto p-0 sm:rounded-2xl">
          {viewingPressing && (() => {
            const st = viewingPressing.shop_type || 'laundry';
            const items = Array.isArray(viewingPressing.item_prices) ? viewingPressing.item_prices : [];
            const imgs = (viewingPressing.images || []).slice(0, 4);
            const stBadge = st === 'pressing' ? 'bg-fuchsia-500 text-white border-transparent'
              : st === 'both' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent'
              : 'bg-purple-500 text-white border-transparent';
            const stLabel = st === 'both' ? 'Laundry + Pressing' : st;
            return (
              <div data-testid="view-shop-content">
                {/* Hero gallery */}
                <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-500">
                  {imgs.length > 0 ? (
                    <div className={`grid gap-1 ${imgs.length === 1 ? 'grid-cols-1' : imgs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      <div className={`${imgs.length >= 3 ? 'col-span-2 row-span-2' : ''} h-64 relative`}>
                        <img src={imgs[0]} alt={viewingPressing.name} className="w-full h-full object-cover" />
                      </div>
                      {imgs.slice(1, 4).map((src, idx) => (
                        <div key={idx} className="h-32 hidden sm:block">
                          <img src={src} alt={`${viewingPressing.name} ${idx + 2}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center">
                      <Shirt className="h-16 w-16 text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent pointer-events-none" />
                  <button
                    onClick={() => setIsViewDialogOpen(false)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition"
                    aria-label="Close"
                  >
                    <span className="text-white text-lg leading-none">×</span>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <Badge className={`capitalize text-[10px] mb-2 ${stBadge}`}>{stLabel}</Badge>
                        <h2 className="text-2xl font-bold drop-shadow">{viewingPressing.name}</h2>
                        <p className="text-sm text-white/85 mt-1 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {[viewingPressing.address, viewingPressing.city].filter(Boolean).join(' · ') || 'Address unavailable'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">
                          {st === 'pressing' ? 'Starts at' : 'Per kg'}
                        </p>
                        <p className="text-2xl font-bold">
                          {st === 'pressing'
                            ? (items.filter(i => Number(i.price) > 0).length
                                ? formatFCFA(Math.min(...items.map(i => Number(i.price)).filter(n => n > 0)))
                                : '—')
                            : formatFCFA(viewingPressing.price_per_kg || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                  {viewingPressing.description && (
                    <p className="text-slate-700 text-sm leading-relaxed">{viewingPressing.description}</p>
                  )}

                  {/* Quick info row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
                    <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-purple-700/70 font-semibold mb-0.5">Phone</p>
                      <p className="font-medium text-slate-900">{viewingPressing.phone || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-purple-700/70 font-semibold mb-0.5">Email</p>
                      <p className="font-medium text-slate-900 truncate" title={viewingPressing.email}>{viewingPressing.email || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-purple-700/70 font-semibold mb-0.5">Turnaround</p>
                      <p className="font-medium text-slate-900">{viewingPressing.turnaround_hours || 24}h</p>
                    </div>
                    <div className="rounded-lg bg-purple-50/60 border border-purple-100 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-purple-700/70 font-semibold mb-0.5">Rating</p>
                      <p className="font-medium text-slate-900">{viewingPressing.rating ? `${viewingPressing.rating} (${viewingPressing.total_reviews || 0})` : 'No reviews yet'}</p>
                    </div>
                  </div>

                  {/* Services */}
                  {viewingPressing.services?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Services offered</p>
                      <div className="flex flex-wrap gap-1.5">
                        {viewingPressing.services.map((s, idx) => (
                          <Badge key={typeof s === 'string' ? s : s?.name || idx} variant="outline" className="text-xs capitalize bg-purple-50 text-purple-700 border-purple-200">
                            {typeof s === 'string' ? s.replace(/_/g, ' ') : s?.name || s?.type || 'Service'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-item gallery — the key new section */}
                  {st !== 'laundry' && items.length > 0 && (
                    <div data-testid="view-items-gallery">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Pressing menu &amp; prices</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {items.map((i, idx) => (
                          <div key={`${i.item}-${idx}`} className="rounded-xl border border-purple-100 bg-white overflow-hidden hover:shadow-md hover:border-purple-300 transition" data-testid={`view-item-card-${idx}`}>
                            <div className="aspect-square bg-gradient-to-br from-purple-100 via-purple-50 to-fuchsia-100 relative">
                              {i.image_url ? (
                                <img src={i.image_url} alt={i.item} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Shirt className="h-8 w-8 text-purple-400/50" />
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-semibold text-slate-900 truncate" title={i.item}>{i.item}</p>
                              <p className="text-sm font-bold text-purple-700 mt-0.5">{formatFCFA(Number(i.price))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(st === 'laundry' || st === 'both') && (
                    <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 flex items-center justify-between" data-testid="view-per-kg-banner">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-purple-700/80 font-semibold">Laundry — pay per kilo</p>
                        <p className="text-xs text-slate-600 mt-0.5">Drop off your laundry — billed on the total weight.</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{formatFCFA(viewingPressing.price_per_kg || 0)}<span className="text-xs text-slate-500 font-normal ml-1">/kg</span></p>
                    </div>
                  )}

                  {/* Logistics row */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-slate-200 p-3 flex items-center gap-3">
                      <Truck className={`h-5 w-5 ${viewingPressing.delivery_available ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <div>
                        <p className="text-xs text-slate-500">Pickup &amp; delivery</p>
                        <p className="font-medium text-slate-900">{viewingPressing.delivery_available ? `Yes — ${formatFCFA(viewingPressing.delivery_fee || 0)} (≤${viewingPressing.pickup_radius_km || 0} km)` : 'No delivery'}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 p-3 flex items-center gap-3">
                      <Sparkles className={`h-5 w-5 ${viewingPressing.express_available ? 'text-orange-500' : 'text-slate-300'}`} />
                      <div>
                        <p className="text-xs text-slate-500">Express service</p>
                        <p className="font-medium text-slate-900">{viewingPressing.express_available ? `+${viewingPressing.express_surcharge || 0}%` : 'Standard only'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="px-6 pb-5 pt-2 border-t border-purple-100/60 bg-purple-50/30 rounded-b-2xl">
                  <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="border-purple-200 text-purple-700 hover:bg-purple-50">
                    Close
                  </Button>
                  <Button onClick={() => { openPressingDialog(viewingPressing); setIsViewDialogOpen(false); }} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white">
                    <Edit className="w-4 h-4 mr-2" /> Edit shop
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      <ReplaceResourceModal
        open={!!replacePressing}
        onClose={() => setReplacePressing(null)}
        serviceType="laundry"
        oldResource={replacePressing}
        allResources={pressings}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadPressings?.();
        }}
      />

      <BulkActionsBar
        count={pressingBulk.count}
        entityLabel="shop"
        selectedIds={pressingBulk.selectedIds}
        selectedRows={pressingBulk.selectedRows}
        onClear={pressingBulk.clear}
        onDelete={bulkPressingDelete}
        onActivate={bulkPressingActivate}
        onDeactivate={bulkPressingDeactivate}
        onExport={(rows) => rows.map(s => ({
          id: s.id, name: s.name, shop_type: s.shop_type, city: s.city, phone: s.phone,
          price_per_kg: s.price_per_kg,
        }))}
      />
    </>
  );
}
