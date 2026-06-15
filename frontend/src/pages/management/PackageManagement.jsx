import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { Textarea } from '@/components/ui/textarea';
import {
  Package, Plus, Edit, Trash2, MapPin, User, Phone, Weight, Ruler,
  LayoutDashboard, BarChart2, MessageSquare, RefreshCw, Search,
  Receipt, Eye, Truck, CheckCircle, Clock, XCircle, PackageCheck,
  Replace as ReplaceIcon,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import PackageServicesTab from '@/components/management/package/PackageServicesTab';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

const PAGE_SIZE = 12;

const PACKAGE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'perishable', label: 'Perishable' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'heavy_goods', label: 'Heavy Goods' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'picked_up', label: 'Picked Up', color: 'bg-blue-100 text-blue-700', icon: PackageCheck },
  { value: 'in_transit', label: 'In Transit', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-purple-100 text-purple-700', icon: Truck },
  { value: 'delivered', label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  { value: 'returned', label: 'Returned', color: 'bg-slate-200 text-slate-700', icon: XCircle },
];

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid', color: 'bg-amber-100 text-amber-700' },
  { value: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'refunded', label: 'Refunded', color: 'bg-slate-200 text-slate-700' },
];

const DEFAULT_FORM = {
  sender: { name: '', phone: '', email: '', address: '' },
  receiver: { name: '', phone: '', email: '', address: '' },
  origin_city: '',
  destination_city: '',
  package_type: 'parcel',
  weight_kg: '',
  dimensions: { length_cm: '', width_cm: '', height_cm: '' },
  declared_value: '',
  description: '',
  notes: '',
  price: '',
  payment_status: 'unpaid',
  operator_id: '',
  estimated_delivery: '',
  carrier: '',
};

const StatusBadge = ({ value }) => {
  const opt = STATUS_OPTIONS.find((o) => o.value === value) || STATUS_OPTIONS[0];
  const Icon = opt.icon;
  return (
    <Badge className={`${opt.color} gap-1 capitalize border-0`}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </Badge>
  );
};

const PaymentBadge = ({ value }) => {
  const opt = PAYMENT_OPTIONS.find((o) => o.value === value) || PAYMENT_OPTIONS[0];
  return <Badge className={`${opt.color} capitalize border-0`}>{opt.label}</Badge>;
};

const PackageAnalytics = ({ packages }) => {
  const data = useMemo(() => {
    const byStatus = STATUS_OPTIONS.map((s) => ({
      name: s.label,
      count: packages.filter((p) => p.status === s.value).length,
    }));
    const monthly = [
      { month: 'Jan', shipments: 18, revenue: 950000 },
      { month: 'Feb', shipments: 24, revenue: 1280000 },
      { month: 'Mar', shipments: 31, revenue: 1700000 },
      { month: 'Apr', shipments: 27, revenue: 1450000 },
      { month: 'May', shipments: 42, revenue: 2300000 },
      { month: 'Jun', shipments: 51, revenue: 2820000 },
    ];
    return { byStatus, monthly };
  }, [packages]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-md">
        <CardHeader><CardTitle>Shipments by Status</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-md">
        <CardHeader><CardTitle>Monthly Performance</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="shipments" stroke="#3B82F6" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Card view (grid + details share the same card with size variants)
const PackageCard = ({ pkg, onView, onEdit, onDelete, onAdvance, onReplace, dense = false }) => {
  const dim = pkg.dimensions || {};
  const dims = [dim.length_cm, dim.width_cm, dim.height_cm].filter(Boolean).join(' × ');
  return (
    <Card className={`hover:shadow-lg transition-shadow ${dense ? '' : 'shadow-md'}`} data-testid={`package-card-${pkg.id}`}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-mono">{pkg.tracking_number}</p>
            <p className="font-semibold text-slate-900 truncate flex items-center gap-1">
              <MapPin className="h-4 w-4 text-blue-600" /> {pkg.origin_city} → {pkg.destination_city}
            </p>
          </div>
          <StatusBadge value={pkg.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mb-3">
          <div>
            <p className="text-slate-400">Sender</p>
            <p className="font-medium text-slate-700 truncate">{pkg.sender?.name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400">Receiver</p>
            <p className="font-medium text-slate-700 truncate">{pkg.receiver?.name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400">Weight / Dim</p>
            <p className="font-medium text-slate-700">{pkg.weight_kg || 0} kg{dims ? ` · ${dims} cm` : ''}</p>
          </div>
          <div>
            <p className="text-slate-400">Type</p>
            <Badge variant="outline" className="capitalize text-xs">{(pkg.package_type || 'parcel').replace('_', ' ')}</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-3 mt-2">
          <div>
            <span className="font-bold text-[#082c59] text-base">{formatFCFA(pkg.price || 0)}</span>
            <span className="ml-2"><PaymentBadge value={pkg.payment_status} /></span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onView(pkg)} title="View" data-testid={`pkg-view-${pkg.id}`}>
              <Eye className="w-4 h-4" />
            </Button>
            {onAdvance && pkg.status !== 'delivered' && pkg.status !== 'cancelled' && (
              <Button size="sm" variant="outline" onClick={() => onAdvance(pkg)} title="Advance status" className="text-blue-600 hover:bg-blue-50" data-testid={`pkg-advance-${pkg.id}`}>
                <Truck className="w-4 h-4" />
              </Button>
            )}
            {onReplace && (
              <PermissionGate permission="packages.edit">
                <Button size="sm" variant="outline" onClick={() => onReplace(pkg)} title="Migrate shipments" className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`pkg-replace-${pkg.id}`}>
                  <ReplaceIcon className="w-4 h-4" />
                </Button>
              </PermissionGate>
            )}
            <PermissionGate permission="packages.edit">
              <Button size="sm" variant="outline" onClick={() => onEdit(pkg)} title="Edit" data-testid={`pkg-edit-${pkg.id}`}>
                <Edit className="w-4 h-4" />
              </Button>
            </PermissionGate>
            <PermissionGate permission="packages.delete">
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDelete(pkg.id)} data-testid={`pkg-delete-${pkg.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const PackageDetailsCard = ({ pkg, onView, onEdit, onAdvance, onReplace }) => {
  const dim = pkg.dimensions || {};
  const dims = [dim.length_cm, dim.width_cm, dim.height_cm].filter(Boolean).join(' × ');
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow" data-testid={`package-details-${pkg.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">{pkg.tracking_number}</p>
            <h3 className="font-bold text-lg text-slate-900 mt-1 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" /> {pkg.origin_city} → {pkg.destination_city}
            </h3>
            <p className="text-sm text-slate-500 mt-1 capitalize">
              {(pkg.package_type || 'parcel').replace('_', ' ')} · {pkg.weight_kg || 0} kg
              {dims ? ` · ${dims} cm` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge value={pkg.status} />
            <PaymentBadge value={pkg.payment_status} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><User className="h-3 w-3" /> Sender</p>
            <p className="font-medium text-slate-900">{pkg.sender?.name || '—'}</p>
            <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {pkg.sender?.phone || '—'}</p>
            <p className="text-xs text-slate-600 mt-1">{pkg.sender?.address || '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><User className="h-3 w-3" /> Receiver</p>
            <p className="font-medium text-slate-900">{pkg.receiver?.name || '—'}</p>
            <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {pkg.receiver?.phone || '—'}</p>
            <p className="text-xs text-slate-600 mt-1">{pkg.receiver?.address || '—'}</p>
          </div>
        </div>
        {pkg.description && (
          <p className="mt-4 text-sm text-slate-600 italic border-l-4 border-blue-200 pl-3">{pkg.description}</p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <span className="text-xl font-bold text-[#082c59]">{formatFCFA(pkg.price || 0)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onView(pkg)} data-testid={`pkg-details-view-${pkg.id}`}>
              <Eye className="w-4 h-4 mr-1" /> View
            </Button>
            {onAdvance && pkg.status !== 'delivered' && pkg.status !== 'cancelled' && (
              <Button size="sm" variant="outline" onClick={() => onAdvance(pkg)} className="text-blue-600 hover:bg-blue-50">
                <Truck className="w-4 h-4 mr-1" /> Advance
              </Button>
            )}
            {onReplace && (
              <PermissionGate permission="packages.edit">
                <Button size="sm" variant="outline" onClick={() => onReplace(pkg)} className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`pkg-details-replace-${pkg.id}`}>
                  <ReplaceIcon className="w-4 h-4 mr-1" /> Replace
                </Button>
              </PermissionGate>
            )}
            <PermissionGate permission="packages.edit">
              <Button size="sm" variant="outline" onClick={() => onEdit(pkg)}>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            </PermissionGate>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PackageManagement() {
  const { user: _user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [packages, setPackages] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingPkg, setViewingPkg] = useState(null);
  const [editingPkg, setEditingPkg] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [replacePkg, setReplacePkg] = useState(null);
  const [advancePkg, setAdvancePkg] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({ status: '', location: '', note: '' });
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);

  const dashboardData = useRealDashboardData('packages', '30days', scopeOperatorId);

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (scopeOperatorId) params.set('operator_id', scopeOperatorId);
      const res = await api.get(`/packages/?${params.toString()}`);
      setPackages(res.data.packages || []);
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Failed to load packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  // Filter packages
  const filteredPackages = useMemo(() => {
    let v = [...packages];
    if (search) {
      const s = search.toLowerCase();
      v = v.filter((p) =>
        (p.tracking_number || '').toLowerCase().includes(s) ||
        (p.sender?.name || '').toLowerCase().includes(s) ||
        (p.receiver?.name || '').toLowerCase().includes(s) ||
        (p.origin_city || '').toLowerCase().includes(s) ||
        (p.destination_city || '').toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') {
      v = v.filter((p) => p.status === statusFilter);
    }
    return v;
  }, [packages, search, statusFilter]);

  // Reset pagination when filters change (React-recommended: adjust state during render)
  const filterKey = `${search}|${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) { setPrevFilterKey(filterKey); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const pagedPackages = useMemo(
    () => filteredPackages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPackages, page]
  );

  const openForm = (pkg = null) => {
    setEditingPkg(pkg);
    if (pkg) {
      setForm({
        sender: { name: '', phone: '', email: '', address: '', ...(pkg.sender || {}) },
        receiver: { name: '', phone: '', email: '', address: '', ...(pkg.receiver || {}) },
        origin_city: pkg.origin_city || '',
        destination_city: pkg.destination_city || '',
        package_type: pkg.package_type || 'parcel',
        weight_kg: pkg.weight_kg ?? '',
        dimensions: { length_cm: '', width_cm: '', height_cm: '', ...(pkg.dimensions || {}) },
        declared_value: pkg.declared_value ?? '',
        description: pkg.description || '',
        notes: pkg.notes || '',
        price: pkg.price ?? '',
        payment_status: pkg.payment_status || 'unpaid',
        operator_id: pkg.operator_id || '',
        estimated_delivery: pkg.estimated_delivery || '',
        carrier: pkg.carrier || '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setIsFormOpen(true);
  };

  const handleView = (pkg) => {
    setViewingPkg(pkg);
    setIsViewOpen(true);
    activityLogger.serviceView(pkg.id, pkg.tracking_number);
  };

  const handleSave = async () => {
    if (!form.sender.name || !form.sender.phone || !form.receiver.name || !form.receiver.phone) {
      toast.error('Sender and receiver name + phone are required');
      return;
    }
    if (!form.origin_city || !form.destination_city) {
      toast.error('Origin and destination cities are required');
      return;
    }
    try {
      const operator = operators.find((op) => (op._id || op.id) === form.operator_id);
      const payload = {
        ...form,
        weight_kg: parseFloat(form.weight_kg) || 0,
        declared_value: parseFloat(form.declared_value) || 0,
        price: parseFloat(form.price) || 0,
        dimensions: {
          length_cm: parseFloat(form.dimensions.length_cm) || 0,
          width_cm: parseFloat(form.dimensions.width_cm) || 0,
          height_cm: parseFloat(form.dimensions.height_cm) || 0,
        },
        operator_name: operator?.name || '',
      };
      if (editingPkg) {
        await api.put(`/packages/${editingPkg.id}`, payload);
        toast.success('Package updated');
      } else {
        const res = await api.post('/packages/', payload);
        toast.success(`Package created · ${res.data.tracking_number}`);
      }
      setIsFormOpen(false);
      loadPackages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this package record?')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Deleted');
      loadPackages();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleAdvance = (pkg) => {
    // Open the advance dialog with auto-suggested next status + sensible defaults
    const order = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    const idx = order.indexOf(pkg.status);
    const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
    if (!next) {
      toast.info('Already at the final status');
      return;
    }
    setAdvancePkg(pkg);
    setAdvanceForm({
      status: next,
      location: pkg.current_location || (next === 'in_transit' ? '' : pkg.origin_city || ''),
      note: '',
    });
  };

  const handleSubmitAdvance = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!advancePkg || !advanceForm.status) return;
    setAdvanceSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.set('status', advanceForm.status);
      if (advanceForm.location?.trim()) params.set('location', advanceForm.location.trim());
      if (advanceForm.note?.trim()) params.set('note', advanceForm.note.trim());
      await api.post(`/packages/${advancePkg.id}/status?${params.toString()}`);
      toast.success(`Status → ${advanceForm.status.replace(/_/g, ' ')}`);
      setAdvancePkg(null);
      loadPackages();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to advance status');
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  return (
    <>
    <ManagementShell
      title="Package & Logistics Management"
      icon={Truck}
      subtitle="Track and manage physical shipments, deliveries and dispatch."
      scopeFilter={<OperatorScopeFilter serviceType="packages" value={scopeOperatorId} onChange={setScopeOperatorId} />}
      onRefresh={loadPackages}
      refreshing={loading}
      tabs={[
        { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { value: 'services', label: 'Services', icon: Truck, testId: 'tab-services' },
        { value: 'communications', label: 'Communications', icon: MessageSquare },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      testIdPrefix="packages-mgmt"
    >

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Packages"
            serviceIcon={<Package className="h-8 w-8" />}
            primaryColor="blue"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Shipments"
            secondaryLabel="In Transit"
            secondaryCount={packages.filter((p) => p.status === 'in_transit').length}
            recentBookingsSlot={
              <OperatorBookingsList serviceType="package" compact viewAllHref="/admin/bookings" />
            }
          />
        </TabsContent>

        <TabsContent value="services" className="mt-6" data-testid="services-tab-content">
          <PackageServicesTab scopeOperatorId={scopeOperatorId} operators={operators} />
        </TabsContent>

        <TabsContent value="management" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by tracking, sender, receiver, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white"
                data-testid="package-search-input"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 bg-white" data-testid="package-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <PermissionGate permission="packages.create">
                <Button onClick={() => openForm()} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="add-package-btn">
                  <Plus className="w-4 h-4 mr-2" /> New Shipment
                </Button>
              </PermissionGate>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : filteredPackages.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No packages yet</h3>
              <p className="text-slate-500 mb-4">
                {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first shipment to get started'}
              </p>
              <PermissionGate permission="packages.create">
                <Button onClick={() => openForm()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> New Shipment
                </Button>
              </PermissionGate>
            </Card>
          ) : viewMode === 'list' ? (
            <Card className="overflow-hidden" data-testid="package-list-view">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tracking #</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Sender</th>
                      <th className="px-4 py-3">Receiver</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPackages.map((pkg) => (
                      <tr key={pkg.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs">{pkg.tracking_number}</td>
                        <td className="px-4 py-3 text-slate-700">{pkg.origin_city} → {pkg.destination_city}</td>
                        <td className="px-4 py-3 text-slate-700">{pkg.sender?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{pkg.receiver?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{pkg.weight_kg || 0} kg</td>
                        <td className="px-4 py-3"><StatusBadge value={pkg.status} /></td>
                        <td className="px-4 py-3"><PaymentBadge value={pkg.payment_status} /></td>
                        <td className="px-4 py-3 font-bold text-[#082c59]">{formatFCFA(pkg.price || 0)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => handleView(pkg)} data-testid={`pkg-list-view-${pkg.id}`}>View</Button>
                            <PermissionGate permission="packages.edit">
                              <Button size="sm" variant="ghost" onClick={() => openForm(pkg)}>Edit</Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : viewMode === 'details' ? (
            <div className="space-y-4" data-testid="package-details-view">
              {pagedPackages.map((pkg) => (
                <PackageDetailsCard
                  key={pkg.id}
                  pkg={pkg}
                  onView={handleView}
                  onEdit={openForm}
                  onAdvance={handleAdvance}
                  onReplace={setReplacePkg}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="package-grid-view">
              {pagedPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onView={handleView}
                  onEdit={openForm}
                  onDelete={handleDelete}
                  onAdvance={handleAdvance}
                  onReplace={setReplacePkg}
                />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            total={filteredPackages.length}
            pageSize={PAGE_SIZE}
            itemLabel="package"
          />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Packages"
            serviceTag="packages"
            operatorId={scopeOperatorId}
            serviceIcon={<Package className="h-5 w-5 text-blue-600" />}
            primaryColor="blue"
          />
        </TabsContent>
      </ManagementShell>

      {/* Create/Edit Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto" data-testid="package-form-dialog">
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Edit Shipment' : 'New Shipment'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sender */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" /> Sender
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={form.sender.name} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, name: e.target.value } }))} placeholder="Full name" data-testid="sender-name-input" />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={form.sender.phone} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, phone: e.target.value } }))} placeholder="+237..." data-testid="sender-phone-input" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.sender.email} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, email: e.target.value } }))} placeholder="optional" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.sender.address} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, address: e.target.value } }))} placeholder="Pickup address" />
                </div>
              </div>
            </section>

            {/* Receiver */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" /> Receiver
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={form.receiver.name} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, name: e.target.value } }))} placeholder="Full name" data-testid="receiver-name-input" />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={form.receiver.phone} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, phone: e.target.value } }))} placeholder="+237..." data-testid="receiver-phone-input" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.receiver.email} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, email: e.target.value } }))} placeholder="optional" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.receiver.address} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, address: e.target.value } }))} placeholder="Delivery address" />
                </div>
              </div>
            </section>

            {/* Route + Type */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" /> Route & Type
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Origin City *</Label>
                  <Input value={form.origin_city} onChange={(e) => setForm((p) => ({ ...p, origin_city: e.target.value }))} placeholder="Yaoundé" data-testid="origin-city-input" />
                </div>
                <div>
                  <Label>Destination City *</Label>
                  <Input value={form.destination_city} onChange={(e) => setForm((p) => ({ ...p, destination_city: e.target.value }))} placeholder="Douala" data-testid="destination-city-input" />
                </div>
                <div>
                  <Label>Package Type</Label>
                  <Select value={form.package_type} onValueChange={(v) => setForm((p) => ({ ...p, package_type: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {PACKAGE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Weight + Dimensions */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Weight className="h-4 w-4 text-amber-600" /> Weight & Dimensions
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} data-testid="weight-input" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Ruler className="h-3 w-3" /> Length (cm)</Label>
                  <Input type="number" value={form.dimensions.length_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, length_cm: e.target.value } }))} />
                </div>
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number" value={form.dimensions.width_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, width_cm: e.target.value } }))} />
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input type="number" value={form.dimensions.height_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, height_cm: e.target.value } }))} />
                </div>
              </div>
            </section>

            {/* Pricing & ETA */}
            <section>
              <h3 className="font-semibold text-slate-900 mb-3">Pricing & Delivery</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Declared Value (FCFA)</Label>
                  <Input type="number" value={form.declared_value} onChange={(e) => setForm((p) => ({ ...p, declared_value: e.target.value }))} placeholder="50000" />
                </div>
                <div>
                  <Label>Shipping Price (FCFA) *</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="5000" data-testid="price-input" />
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm((p) => ({ ...p, payment_status: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {PAYMENT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Estimated Delivery Date</Label>
                  <Input
                    type="date"
                    value={form.estimated_delivery}
                    onChange={(e) => setForm((p) => ({ ...p, estimated_delivery: e.target.value }))}
                    data-testid="estimated-delivery-input"
                  />
                  <p className="text-xs text-slate-400 mt-1">Shown to the recipient on the public tracking page</p>
                </div>
                <div>
                  <Label>Carrier / Vehicle</Label>
                  <Input
                    value={form.carrier}
                    onChange={(e) => setForm((p) => ({ ...p, carrier: e.target.value }))}
                    placeholder="e.g. Musango Express, Truck #CE-1234"
                    data-testid="carrier-input"
                  />
                  <p className="text-xs text-slate-400 mt-1">Free-text — appears as "Carrier" on the tracking widget</p>
                </div>
              </div>
            </section>

            {/* Operator + Notes */}
            <section className="grid grid-cols-1 gap-3">
              {operators.length > 0 && (
                <div>
                  <Label>Operator (logistics company)</Label>
                  <Select
                    value={form.operator_id || ''}
                    onValueChange={(v) => setForm((p) => ({ ...p, operator_id: v }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select operator..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-60">
                      {operators.map((op) => (
                        <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Contents, handling notes..." />
              </div>
              <div>
                <Label>Internal Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes for the dispatch team..." />
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="save-package-btn">
              {editingPkg ? 'Update' : 'Create Shipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[#082c59]" /> Shipment Details
            </DialogTitle>
          </DialogHeader>
          {viewingPkg && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">{viewingPkg.tracking_number}</p>
                <h3 className="font-bold text-lg text-slate-900 mt-1">
                  {viewingPkg.origin_city} → {viewingPkg.destination_city}
                </h3>
                <div className="flex gap-2 mt-2">
                  <StatusBadge value={viewingPkg.status} />
                  <PaymentBadge value={viewingPkg.payment_status} />
                  <Badge variant="outline" className="capitalize">{(viewingPkg.package_type || 'parcel').replace('_', ' ')}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Sender</p>
                  <p className="font-medium">{viewingPkg.sender?.name}</p>
                  <p className="text-sm text-slate-600">{viewingPkg.sender?.phone}</p>
                  <p className="text-sm text-slate-600">{viewingPkg.sender?.email}</p>
                  <p className="text-xs text-slate-500 mt-2">{viewingPkg.sender?.address}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Receiver</p>
                  <p className="font-medium">{viewingPkg.receiver?.name}</p>
                  <p className="text-sm text-slate-600">{viewingPkg.receiver?.phone}</p>
                  <p className="text-sm text-slate-600">{viewingPkg.receiver?.email}</p>
                  <p className="text-xs text-slate-500 mt-2">{viewingPkg.receiver?.address}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Weight</p>
                  <p className="font-semibold">{viewingPkg.weight_kg || 0} kg</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Dimensions (cm)</p>
                  <p className="font-semibold">
                    {viewingPkg.dimensions
                      ? `${viewingPkg.dimensions.length_cm || 0} × ${viewingPkg.dimensions.width_cm || 0} × ${viewingPkg.dimensions.height_cm || 0}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Declared Value</p>
                  <p className="font-semibold">{formatFCFA(viewingPkg.declared_value || 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Estimated Delivery</p>
                  <p className="font-semibold">{viewingPkg.estimated_delivery || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Carrier</p>
                  <p className="font-semibold">{viewingPkg.carrier || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Current Location</p>
                  <p className="font-semibold">{viewingPkg.current_location || '—'}</p>
                </div>
              </div>
              {viewingPkg.description && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingPkg.description}</p>
                </div>
              )}
              {viewingPkg.notes && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Internal Notes</p>
                  <p className="text-sm bg-amber-50 p-3 rounded text-amber-800">{viewingPkg.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-slate-500">Shipping price</span>
                <span className="text-2xl font-bold text-[#082c59]">{formatFCFA(viewingPkg.price || 0)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openForm(viewingPkg); setIsViewOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewOpen(false)} className="bg-[#082c59] hover:bg-[#0a3a75]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReplaceResourceModal
        open={!!replacePkg}
        onClose={() => setReplacePkg(null)}
        serviceType="package"
        oldResource={replacePkg}
        allResources={packages}
        onSuccess={() => loadPackages?.()}
      />

      {/* Advance Status Dialog (location + note) */}
      <Dialog open={!!advancePkg} onOpenChange={(o) => { if (!o) setAdvancePkg(null); }}>
        <DialogContent className="max-w-md bg-white" data-testid="advance-status-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#082c59]" /> Advance Shipment Status
            </DialogTitle>
          </DialogHeader>

          {advancePkg && (
            <form onSubmit={handleSubmitAdvance} className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-slate-400 font-mono">{advancePkg.tracking_number}</p>
                <p className="font-medium text-slate-900">{advancePkg.origin_city} → {advancePkg.destination_city}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">
                  Current: <strong>{(advancePkg.status || '').replace(/_/g, ' ')}</strong>
                </p>
              </div>

              <div>
                <Label htmlFor="advance-status">New Status *</Label>
                <Select
                  value={advanceForm.status}
                  onValueChange={(v) => setAdvanceForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger className="bg-white" data-testid="advance-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {STATUS_OPTIONS
                      .filter((s) => !['cancelled', 'returned'].includes(s.value))
                      .map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="advance-location">Current Location</Label>
                <Input
                  id="advance-location"
                  data-testid="advance-location-input"
                  placeholder="e.g. Bafoussam Hub, On the road to Douala..."
                  value={advanceForm.location}
                  onChange={(e) => setAdvanceForm((p) => ({ ...p, location: e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1">Shown on the public tracking page as "Current Location"</p>
              </div>

              <div>
                <Label htmlFor="advance-note">Note (optional)</Label>
                <Textarea
                  id="advance-note"
                  data-testid="advance-note-input"
                  placeholder="e.g. Delayed at customs, expected to clear by 4pm"
                  rows={2}
                  value={advanceForm.note}
                  onChange={(e) => setAdvanceForm((p) => ({ ...p, note: e.target.value }))}
                />
                <p className="text-xs text-slate-400 mt-1">Visible to the recipient on the public timeline</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdvancePkg(null)} disabled={advanceSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#082c59] hover:bg-[#0a3a75]"
                  disabled={advanceSubmitting || !advanceForm.status}
                  data-testid="confirm-advance-btn"
                >
                  {advanceSubmitting ? 'Updating…' : 'Update Status'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
