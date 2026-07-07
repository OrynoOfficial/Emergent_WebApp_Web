import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  Package, Plus, Edit, Trash2, MapPin, User, Phone, Weight, Ruler,
  RefreshCw, Search, Eye, Truck, CheckCircle, Clock, XCircle,
  PackageCheck, SlidersHorizontal, LayoutGrid, List, Filter,
  Camera,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { canListOperators } from '@/utils/roleHelpers';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import Pagination from '@/components/common/Pagination';
import MiniImageUploader from '@/components/shared/MiniImageUploader';

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

// Card view (similar to results page card style)
const ShipmentCard = ({ pkg, onView, onDelete, onAdvance }) => {
  const dim = pkg.dimensions || {};
  const dims = [dim.length_cm, dim.width_cm, dim.height_cm].filter(Boolean).join(' × ');
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 duration-200" data-testid={`shipment-card-${pkg.id}`}>
      <div className="relative h-24 bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] p-4">
        <div className="absolute top-3 right-3"><StatusBadge value={pkg.status} /></div>
        <div className="absolute bottom-3 left-4">
          <p className="text-[10px] text-white/60 font-mono uppercase tracking-widest">{pkg.tracking_number}</p>
          <p className="font-bold text-white text-sm flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {pkg.origin_city} → {pkg.destination_city}
          </p>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px]">Sender</p>
            <p className="font-medium text-slate-700 truncate">{pkg.sender?.name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px]">Receiver</p>
            <p className="font-medium text-slate-700 truncate">{pkg.receiver?.name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px]">Weight / Size</p>
            <p className="font-medium text-slate-700">{pkg.weight_kg || 0} kg{dims ? ` · ${dims}` : ''}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px]">Type</p>
            <Badge variant="outline" className="capitalize text-[10px] mt-0.5">{(pkg.package_type || 'parcel').replace('_', ' ')}</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div>
            <span className="font-bold text-[#082c59] text-base">{formatFCFA(pkg.price || 0)}</span>
            <span className="ml-2"><PaymentBadge value={pkg.payment_status} /></span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onView(pkg)} title="View" className="h-8 w-8 p-0" data-testid={`shipment-view-${pkg.id}`}>
              <Eye className="w-4 h-4" />
            </Button>
            {onAdvance && pkg.status !== 'delivered' && pkg.status !== 'cancelled' && (
              <Button size="sm" variant="ghost" onClick={() => onAdvance(pkg)} title="Advance status" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50" data-testid={`shipment-advance-${pkg.id}`}>
                <Truck className="w-4 h-4" />
              </Button>
            )}
            <PermissionGate permission="packages.delete">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => onDelete(pkg.id)} data-testid={`shipment-delete-${pkg.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PackageShipments() {
  const { user } = useAuth();
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
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);
  const [advancePkg, setAdvancePkg] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({ status: '', location: '', note: '', delivery_photos: [] });
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Internal-notes editing for the View dialog (admin / super_admin / operator only)
  const [internalNotesDraft, setInternalNotesDraft] = useState('');
  const [internalNotesSaving, setInternalNotesSaving] = useState(false);

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (scopeOperatorId) params.set('operator_id', scopeOperatorId);
      const res = await api.get(`/packages/?${params.toString()}`);
      setPackages(res.data.packages || []);
      if (canListOperators(user)) {
        try {
          const opRes = await api.get('/operators/');
          setOperators(opRes.data.operators || opRes.data || []);
        } catch { /* silent */ }
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId, user]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

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
    if (statusFilter !== 'all') v = v.filter((p) => p.status === statusFilter);
    if (paymentFilter !== 'all') v = v.filter((p) => p.payment_status === paymentFilter);
    if (typeFilter !== 'all') v = v.filter((p) => p.package_type === typeFilter);
    return v;
  }, [packages, search, statusFilter, paymentFilter, typeFilter]);

  // Reset pagination when filters change (React-recommended: adjust state during render)
  const filterKey = `${search}|${statusFilter}|${paymentFilter}|${typeFilter}`;
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
    setInternalNotesDraft(pkg.internal_notes || '');
    setIsViewOpen(true);
    activityLogger.serviceView(pkg.id, pkg.tracking_number);
  };

  const handleSaveInternalNotes = async () => {
    if (!viewingPkg) return;
    setInternalNotesSaving(true);
    try {
      await api.put(`/packages/${viewingPkg.id}`, { internal_notes: internalNotesDraft });
      toast.success('Internal notes saved');
      // Reflect in local state immediately
      setViewingPkg(p => p ? { ...p, internal_notes: internalNotesDraft } : p);
      setPackages(prev => prev.map(x => x.id === viewingPkg.id ? { ...x, internal_notes: internalNotesDraft } : x));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save note');
    } finally {
      setInternalNotesSaving(false);
    }
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
        toast.success('Shipment updated');
      } else {
        const res = await api.post('/packages/', payload);
        toast.success(`Shipment created · ${res.data.tracking_number}`);
      }
      setIsFormOpen(false);
      loadPackages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shipment?')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Deleted');
      loadPackages();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleAdvance = (pkg) => {
    const order = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    const idx = order.indexOf(pkg.status);
    // Legacy/unknown statuses (e.g. "active" from the old tours flow) get reset
    // to the start of the ladder so the operator can move them forward.
    let next;
    if (idx === -1) {
      next = 'pending';
    } else if (idx >= order.length - 1) {
      toast.info('Already delivered');
      return;
    } else {
      next = order[idx + 1];
    }
    // Pre-load the note that was previously saved for this stage (if any) so
    // operators can review and continue editing past notes instead of losing
    // them between sessions.
    const prev = (pkg.status_history || []).slice().reverse().find(e => e.status === next);
    setAdvancePkg(pkg);
    setAdvanceForm({
      status: next,
      location: prev?.location || pkg.current_location || (next === 'in_transit' ? '' : pkg.origin_city || ''),
      note: prev?.description || '',
      delivery_photos: prev?.photos || [],
    });
  };

  // When the user picks a different stage in the dialog, hydrate that stage's
  // last-known note/location/photos so prior context is never lost.
  useEffect(() => {
    if (!advancePkg || !advanceForm.status) return;
    const prev = (advancePkg.status_history || []).slice().reverse().find(e => e.status === advanceForm.status);
    setAdvanceForm(p => ({
      ...p,
      note: prev?.description || '',
      location: prev?.location || (advanceForm.status === advancePkg.status ? (advancePkg.current_location || '') : ''),
      delivery_photos: prev?.photos || [],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceForm.status, advancePkg?.id]);

  const handleSubmitAdvance = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!advancePkg || !advanceForm.status) return;
    if (advanceForm.status === 'delivered' && (advanceForm.delivery_photos?.length || 0) < 3) {
      toast.error('Upload 3 proof-of-delivery photos to mark as delivered');
      return;
    }
    setAdvanceSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.set('status', advanceForm.status);
      if (advanceForm.location?.trim()) params.set('location', advanceForm.location.trim());
      if (advanceForm.note?.trim()) params.set('note', advanceForm.note.trim());
      const body = advanceForm.status === 'delivered'
        ? { delivery_photos: advanceForm.delivery_photos }
        : {};
      await api.post(`/packages/${advancePkg.id}/status?${params.toString()}`, body);
      toast.success(`Status → ${advanceForm.status.replace(/_/g, ' ')}`);
      setAdvancePkg(null);
      loadPackages();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to advance status');
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (paymentFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-12">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#082c59] to-[#0d4a8f] rounded-xl flex items-center justify-center text-white">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Shipments</h1>
                <p className="text-sm text-slate-500">
                  {filteredPackages.length} shipment{filteredPackages.length === 1 ? '' : 's'} ·
                  {' '}{packages.filter((p) => p.status === 'in_transit').length} in transit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <OperatorScopeFilter serviceType="packages" value={scopeOperatorId} onChange={setScopeOperatorId} />
              <Button onClick={loadPackages} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <PermissionGate permission="packages.create">
                <Button onClick={() => openForm()} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="add-shipment-btn">
                  <Plus className="w-4 h-4 mr-1" /> New Shipment
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Search/Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tracking #, sender, receiver, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200 h-10"
                data-testid="shipment-search-input"
              />
            </div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-10 relative" data-testid="shipment-filters-btn">
                  <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Filters
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#082c59] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white">
                <SheetHeader>
                  <SheetTitle>Filter shipments</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Status</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')} className={`rounded-full ${statusFilter === 'all' ? 'bg-[#082c59]' : ''}`}>All</Button>
                      {STATUS_OPTIONS.map((s) => (
                        <Button key={s.value} variant={statusFilter === s.value ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s.value)} className={`rounded-full ${statusFilter === s.value ? 'bg-[#082c59]' : ''}`}>{s.label}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Payment</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={paymentFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentFilter('all')} className={`rounded-full ${paymentFilter === 'all' ? 'bg-[#082c59]' : ''}`}>All</Button>
                      {PAYMENT_OPTIONS.map((p) => (
                        <Button key={p.value} variant={paymentFilter === p.value ? 'default' : 'outline'} size="sm" onClick={() => setPaymentFilter(p.value)} className={`rounded-full ${paymentFilter === p.value ? 'bg-[#082c59]' : ''}`}>{p.label}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Package Type</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={typeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter('all')} className={`rounded-full ${typeFilter === 'all' ? 'bg-[#082c59]' : ''}`}>All</Button>
                      {PACKAGE_TYPES.map((t) => (
                        <Button key={t.value} variant={typeFilter === t.value ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(t.value)} className={`rounded-full ${typeFilter === t.value ? 'bg-[#082c59]' : ''}`}>{t.label}</Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={clearFilters} className="flex-1 rounded-xl">Clear All</Button>
                    <Button onClick={() => setFiltersOpen(false)} className="flex-1 bg-[#082c59] rounded-xl">Show {filteredPackages.length} results</Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-10 w-10 animate-spin text-[#082c59]" />
          </div>
        ) : filteredPackages.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <Package className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No shipments found</h3>
            <p className="text-slate-500 mb-4">
              {search || activeFiltersCount > 0 ? 'Try adjusting your filters' : 'Create your first shipment to get started'}
            </p>
            <PermissionGate permission="packages.create">
              <Button onClick={() => openForm()} className="bg-[#082c59]">
                <Plus className="w-4 h-4 mr-1" /> New Shipment
              </Button>
            </PermissionGate>
          </Card>
        ) : viewMode === 'list' || viewMode === 'details' ? (
          <Card className="overflow-hidden bg-white" data-testid="shipment-list-view">
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
                          <Button size="sm" variant="ghost" onClick={() => handleView(pkg)} data-testid={`shipment-list-view-${pkg.id}`}>View</Button>
                          {pkg.status !== 'delivered' && pkg.status !== 'cancelled' && (
                            <PermissionGate permission="packages.edit">
                              <Button size="sm" variant="ghost" onClick={() => handleAdvance(pkg)} className="text-blue-600" data-testid={`shipment-list-advance-${pkg.id}`}>
                                <Truck className="w-4 h-4 mr-1" /> Advance
                              </Button>
                            </PermissionGate>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="shipment-grid-view">
            {pagedPackages.map((pkg) => (
              <ShipmentCard
                key={pkg.id}
                pkg={pkg}
                onView={handleView}
                onDelete={handleDelete}
                onAdvance={handleAdvance}
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
          itemLabel="shipment"
        />
      </div>

      {/* Create/Edit Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto" data-testid="shipment-form-dialog">
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Edit Shipment' : 'New Shipment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Sender</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.sender.name} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, name: e.target.value } }))} /></div>
                <div><Label>Phone *</Label><Input value={form.sender.phone} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, phone: e.target.value } }))} /></div>
                <div><Label>Email</Label><Input type="email" value={form.sender.email} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, email: e.target.value } }))} /></div>
                <div><Label>Address</Label><Input value={form.sender.address} onChange={(e) => setForm((p) => ({ ...p, sender: { ...p.sender, address: e.target.value } }))} /></div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-emerald-600" /> Receiver</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.receiver.name} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, name: e.target.value } }))} /></div>
                <div><Label>Phone *</Label><Input value={form.receiver.phone} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, phone: e.target.value } }))} /></div>
                <div><Label>Email</Label><Input type="email" value={form.receiver.email} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, email: e.target.value } }))} /></div>
                <div><Label>Address</Label><Input value={form.receiver.address} onChange={(e) => setForm((p) => ({ ...p, receiver: { ...p.receiver, address: e.target.value } }))} /></div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-600" /> Route & Type</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Origin *</Label><Input value={form.origin_city} onChange={(e) => setForm((p) => ({ ...p, origin_city: e.target.value }))} /></div>
                <div><Label>Destination *</Label><Input value={form.destination_city} onChange={(e) => setForm((p) => ({ ...p, destination_city: e.target.value }))} /></div>
                <div><Label>Type</Label>
                  <Select value={form.package_type} onValueChange={(v) => setForm((p) => ({ ...p, package_type: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {PACKAGE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Weight className="h-4 w-4 text-amber-600" /> Weight & Dimensions</h3>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Weight (kg)</Label><Input type="number" step="0.01" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} /></div>
                <div><Label className="flex items-center gap-1"><Ruler className="h-3 w-3" /> Length</Label><Input type="number" value={form.dimensions.length_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, length_cm: e.target.value } }))} /></div>
                <div><Label>Width</Label><Input type="number" value={form.dimensions.width_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, width_cm: e.target.value } }))} /></div>
                <div><Label>Height</Label><Input type="number" value={form.dimensions.height_cm} onChange={(e) => setForm((p) => ({ ...p, dimensions: { ...p.dimensions, height_cm: e.target.value } }))} /></div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold text-slate-900 mb-3">Pricing & Delivery</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Declared Value</Label><Input type="number" value={form.declared_value} onChange={(e) => setForm((p) => ({ ...p, declared_value: e.target.value }))} /></div>
                <div><Label>Price *</Label><Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} /></div>
                <div><Label>Payment</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm((p) => ({ ...p, payment_status: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {PAYMENT_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><Label>Estimated Delivery</Label><Input type="date" value={form.estimated_delivery} onChange={(e) => setForm((p) => ({ ...p, estimated_delivery: e.target.value }))} /></div>
                <div><Label>Carrier / Vehicle</Label><Input value={form.carrier} onChange={(e) => setForm((p) => ({ ...p, carrier: e.target.value }))} placeholder="Truck #CE-1234" /></div>
              </div>
            </section>
            <section className="grid grid-cols-1 gap-3">
              {operators.length > 0 && (
                <div><Label>Operator</Label>
                  <Select value={form.operator_id || ''} onValueChange={(v) => setForm((p) => ({ ...p, operator_id: v }))}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select operator..." /></SelectTrigger>
                    <SelectContent className="bg-white max-h-60">
                      {operators.map((op) => (<SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Internal Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="save-shipment-btn">
              {editingPkg ? 'Update' : 'Create Shipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-3 sticky top-0 bg-white z-10 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-[#082c59]" /> Shipment Details</DialogTitle>
          </DialogHeader>
          {viewingPkg && (
            <div className="space-y-4 px-6 py-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">{viewingPkg.tracking_number}</p>
                <h3 className="font-bold text-lg text-slate-900 mt-1">{viewingPkg.origin_city} → {viewingPkg.destination_city}</h3>
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
                  <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {viewingPkg.sender?.phone}</p>
                  <p className="text-xs text-slate-500 mt-2">{viewingPkg.sender?.address}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Receiver</p>
                  <p className="font-medium">{viewingPkg.receiver?.name}</p>
                  <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" /> {viewingPkg.receiver?.phone}</p>
                  <p className="text-xs text-slate-500 mt-2">{viewingPkg.receiver?.address}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-slate-500 text-xs">Weight</p><p className="font-semibold">{viewingPkg.weight_kg || 0} kg</p></div>
                <div><p className="text-slate-500 text-xs">Dimensions (cm)</p><p className="font-semibold">{viewingPkg.dimensions ? `${viewingPkg.dimensions.length_cm || 0}×${viewingPkg.dimensions.width_cm || 0}×${viewingPkg.dimensions.height_cm || 0}` : '—'}</p></div>
                <div><p className="text-slate-500 text-xs">Declared Value</p><p className="font-semibold">{formatFCFA(viewingPkg.declared_value || 0)}</p></div>
                <div><p className="text-slate-500 text-xs">ETA</p><p className="font-semibold">{viewingPkg.estimated_delivery || '—'}</p></div>
                <div><p className="text-slate-500 text-xs">Carrier</p><p className="font-semibold">{viewingPkg.carrier || '—'}</p></div>
                <div><p className="text-slate-500 text-xs">Current Location</p><p className="font-semibold">{viewingPkg.current_location || '—'}</p></div>
              </div>
              {viewingPkg.description && (<div><p className="text-slate-500 text-xs mb-1">Description</p><p className="text-sm bg-slate-50 p-3 rounded">{viewingPkg.description}</p></div>)}

              {/* Customer-uploaded photos (taken at booking time) */}
              {Array.isArray(viewingPkg.package_photos) && viewingPkg.package_photos.length > 0 && (
                <div data-testid="package-photos-section">
                  <p className="text-slate-500 text-xs mb-2 flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Photos uploaded by customer
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingPkg.package_photos.map((url, i) => {
                      const fullUrl = url?.startsWith('/') ? `${import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || ''}${url}` : url;
                      return (
                        <a key={i} href={fullUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-[#082c59] transition">
                          <img src={fullUrl} alt={`Customer photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Operator proof-of-delivery photos (after delivery) */}
              {Array.isArray(viewingPkg.delivery_photos) && viewingPkg.delivery_photos.length > 0 && (
                <div data-testid="delivery-photos-section">
                  <p className="text-slate-500 text-xs mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Proof of delivery
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingPkg.delivery_photos.map((url, i) => {
                      const fullUrl = url?.startsWith('/') ? `${import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || ''}${url}` : url;
                      return (
                        <a key={i} href={fullUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-emerald-200 hover:ring-2 hover:ring-emerald-500 transition">
                          <img src={fullUrl} alt={`Proof of delivery ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-slate-500">Shipping price</span>
                <span className="text-2xl font-bold text-[#082c59]">{formatFCFA(viewingPkg.price || 0)}</span>
              </div>

              {/* INTERNAL NOTES — admin / super_admin / operator only.
                  Never returned by the public /track endpoint. */}
              {['admin', 'super_admin', 'operator'].includes(_user?.role) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 mt-2" data-testid="internal-notes-section">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm font-semibold text-amber-900">Internal notes <span className="text-amber-700/70 font-normal italic">— Customer won&apos;t see this</span></Label>
                      <p className="text-[11px] text-amber-700/80 mt-0.5">Visible only to admins, super-admins, the assigned operator and their team.</p>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] uppercase">Staff only</Badge>
                  </div>
                  <Textarea
                    value={internalNotesDraft}
                    onChange={(e) => setInternalNotesDraft(e.target.value)}
                    placeholder="Customer asked to deliver after 5pm. Receiver phone is unreliable, use sender's number for notification."
                    rows={3}
                    className="bg-white border-amber-200 focus:border-amber-400"
                    data-testid="internal-notes-textarea"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveInternalNotes}
                      disabled={internalNotesSaving || (internalNotesDraft || '') === (viewingPkg.internal_notes || '')}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="save-internal-notes-btn"
                    >
                      {internalNotesSaving ? 'Saving…' : 'Save note'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="px-6 py-3 border-t bg-slate-50 sticky bottom-0">
            <Button onClick={() => setIsViewOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Status Dialog */}
      <Dialog open={!!advancePkg} onOpenChange={(o) => { if (!o) setAdvancePkg(null); }}>
        <DialogContent className="max-w-xl bg-white p-0 overflow-hidden max-h-[92vh] overflow-y-auto" data-testid="advance-status-dialog">
          {/* Hero header */}
          <div className="bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">Advance shipment</h2>
                <p className="text-xs text-white/80">Move the package forward in the delivery pipeline</p>
              </div>
            </div>
            {advancePkg && (
              <div className="mt-4 flex items-center justify-between bg-white/10 backdrop-blur rounded-lg px-3 py-2">
                <div>
                  <p className="text-[10px] text-white/70 font-mono uppercase tracking-widest">{advancePkg.tracking_number}</p>
                  <p className="text-sm font-medium">{advancePkg.origin_city} → {advancePkg.destination_city}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/70 uppercase tracking-wide">Current</p>
                  <Badge className="bg-white text-[#082c59] capitalize">{(advancePkg.status || 'unknown').replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            )}
          </div>

          {advancePkg && (
            <form onSubmit={handleSubmitAdvance} className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Status ladder */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">New status</Label>
                <p className="text-[11px] text-slate-500 mt-0.5">Past stages are locked — once advanced, you cannot edit a previous status.</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {(() => {
                    const ladder = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
                    const currentIdx = ladder.indexOf(advancePkg.status);
                    return [
                    { value: 'pending', label: 'Pending', icon: Clock },
                    { value: 'picked_up', label: 'Picked up', icon: PackageCheck },
                    { value: 'in_transit', label: 'In transit', icon: Truck },
                    { value: 'out_for_delivery', label: 'Out for del.', icon: Truck },
                    { value: 'delivered', label: 'Delivered', icon: CheckCircle },
                  ].map((s) => {
                    const Icon = s.icon;
                    const active = advanceForm.status === s.value;
                    const stageIdx = ladder.indexOf(s.value);
                    // Lock current and past stages — operator can only move forward.
                    const locked = currentIdx !== -1 && stageIdx <= currentIdx;
                    return (
                      <button
                        type="button"
                        key={s.value}
                        onClick={() => { if (!locked) setAdvanceForm((p) => ({ ...p, status: s.value })); }}
                        disabled={locked}
                        title={locked ? (stageIdx === currentIdx ? 'Current status — already set' : 'Past stage — locked') : ''}
                        data-testid={`advance-status-${s.value}`}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-3 transition-all text-[11px] font-medium leading-tight relative ${
                          active
                            ? 'border-[#082c59] bg-[#082c59]/5 text-[#082c59] shadow-sm'
                            : locked
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-[#082c59]' : locked ? 'text-slate-400' : 'text-slate-400'}`} />
                        <span className="text-center">{s.label}</span>
                        {locked && stageIdx < currentIdx && (
                          <CheckCircle className="absolute top-1 right-1 h-3 w-3 text-emerald-500" />
                        )}
                      </button>
                    );
                  });
                  })()}
                </div>
              </div>

              {/* Proof-of-Delivery photos when marking as delivered */}
              {advanceForm.status === 'delivered' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    <Label className="font-semibold text-slate-800">
                      Proof of Delivery photos <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Upload <strong>3 photos</strong> at the drop-off — package handed over, signed receipt, or delivery location. Visible to the receiver on the public tracking page.
                  </p>
                  <MiniImageUploader
                    images={advanceForm.delivery_photos || []}
                    onChange={(imgs) => setAdvanceForm((p) => ({ ...p, delivery_photos: imgs }))}
                    max={3}
                    folder="package_pod"
                    accent="emerald"
                  />
                  {(advanceForm.delivery_photos?.length || 0) < 3 && (
                    <p className="text-xs text-amber-600 mt-2">
                      {3 - (advanceForm.delivery_photos?.length || 0)} more photo(s) required
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Current location</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-9"
                      placeholder="e.g. Bafoussam Hub, Douala depot..."
                      value={advanceForm.location}
                      onChange={(e) => setAdvanceForm((p) => ({ ...p, location: e.target.value }))}
                      data-testid="advance-location-input"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Note <span className="text-slate-400 normal-case font-normal">(visible to the customer)</span></Label>
                  <Textarea
                    placeholder="e.g. Delivered to receiver in person..."
                    rows={2}
                    value={advanceForm.note}
                    onChange={(e) => setAdvanceForm((p) => ({ ...p, note: e.target.value }))}
                    data-testid="advance-note-input"
                  />
                </div>
              </div>
            </form>
          )}

          <DialogFooter className="px-6 py-4 border-t bg-slate-50">
            <Button type="button" variant="outline" onClick={() => setAdvancePkg(null)} disabled={advanceSubmitting}>Cancel</Button>
            <Button
              type="button"
              onClick={handleSubmitAdvance}
              className="bg-[#082c59]"
              disabled={
                advanceSubmitting ||
                !advanceForm.status ||
                (advanceForm.status === 'delivered' && (advanceForm.delivery_photos?.length || 0) < 3)
              }
              data-testid="submit-advance-status-btn"
            >
              {advanceSubmitting ? 'Updating…' : `Update → ${advanceForm.status.replace(/_/g, ' ')}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
