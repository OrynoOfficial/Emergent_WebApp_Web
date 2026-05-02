import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Edit, Trash2, MapPin, Package, Truck, Clock, RefreshCw, Search,
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import PermissionGate from '@/components/common/PermissionGate';
import ViewModeToggle from '@/components/common/ViewModeToggle';
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

const FEATURES = ['tracking', 'insurance', 'fragile_handling', 'signature_required', 'temperature_controlled'];

const DEFAULT_SVC = {
  name: '',
  description: '',
  origin_city: '',
  destination_city: '',
  pricing_model: 'tiered',
  tiers: [
    { weight_min_kg: 0, weight_max_kg: 1, price: '', label: 'Document' },
    { weight_min_kg: 1.01, weight_max_kg: 5, price: '', label: 'Small Parcel' },
    { weight_min_kg: 5.01, weight_max_kg: 20, price: '', label: 'Large Parcel' },
  ],
  base_price: '',
  per_kg_rate: '',
  max_weight_kg: 20,
  max_length_cm: 80,
  max_width_cm: 60,
  max_height_cm: 50,
  accepted_types: ['parcel'],
  delivery_time_hours: 24,
  features: ['tracking'],
  images: [],
  operator_id: '',
};

const StatusBadge = ({ value }) => {
  const map = {
    active: { cls: 'bg-emerald-100 text-emerald-700', label: 'Active' },
    pending: { cls: 'bg-amber-100 text-amber-700', label: 'Pending Approval' },
    inactive: { cls: 'bg-slate-200 text-slate-700', label: 'Inactive' },
    suspended: { cls: 'bg-orange-100 text-orange-700', label: 'Suspended' },
    rejected: { cls: 'bg-red-100 text-red-700', label: 'Rejected' },
    draft: { cls: 'bg-slate-100 text-slate-600', label: 'Draft' },
  };
  const v = map[value] || map.draft;
  return <Badge className={`${v.cls} capitalize border-0`}>{v.label}</Badge>;
};

const formatHours = (h) => {
  const n = parseInt(h);
  if (!n) return '—';
  if (n < 24) return `${n}h`;
  const d = Math.floor(n / 24);
  const r = n % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
};

/**
 * Live preview card — mimics the customer-facing PackagesResults card.
 */
const ServicePreviewCard = ({ form }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImg = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);
  const cover = (form.images || [])[0];
  const thumbs = (form.images || []).slice(1, 3);

  // Compute preview price
  let priceSample = null;
  if (form.pricing_model === 'tiered') {
    const firstWithPrice = (form.tiers || []).find((t) => parseFloat(t.price) > 0);
    if (firstWithPrice) priceSample = { value: parseFloat(firstWithPrice.price), label: firstWithPrice.label || 'Sample' };
  } else if (form.pricing_model === 'per_kg') {
    const base = parseFloat(form.base_price) || 0;
    const perKg = parseFloat(form.per_kg_rate) || 0;
    if (base > 0 || perKg > 0) priceSample = { value: base + perKg * 2, label: '2 kg sample' };
  }

  return (
    <div className="rounded-2xl border-0 shadow-md overflow-hidden bg-white">
      <div className="relative h-36 overflow-hidden">
        {cover ? (
          <>
            <img src={getImg(cover)} alt={form.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-red-900/30 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-rose-800 flex items-center justify-center">
            <Package className="w-12 h-12 text-white/30" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-yellow-400 text-red-800 hover:bg-yellow-400 z-10 text-[10px]">
          <Truck className="w-2.5 h-2.5 mr-1" /> Logistics
        </Badge>
        {thumbs.length > 0 && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {thumbs.map((t, i) => (
              <img key={i} src={getImg(t)} alt="" className="w-8 h-8 rounded-md object-cover border-2 border-white/70 shadow" />
            ))}
          </div>
        )}
        <div className="absolute bottom-2 left-3 right-3 z-10 text-white">
          <p className="font-bold text-sm line-clamp-1 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {form.name || 'Service name…'}
          </p>
          <p className="text-white/70 text-[10px] truncate">
            {form.origin_city || 'Origin'} → {form.destination_city || 'Destination'}
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-xs mb-3 bg-red-50/50 rounded-lg p-2">
          <div className="text-center flex-1">
            <MapPin className="w-3 h-3 text-emerald-500 mx-auto mb-0.5" />
            <span className="text-slate-600 truncate block text-[11px]">{form.origin_city || '—'}</span>
          </div>
          <div className="flex-1 px-1"><div className="border-t-2 border-dashed border-red-300" /></div>
          <div className="text-center flex-1">
            <MapPin className="w-3 h-3 text-red-500 mx-auto mb-0.5" />
            <span className="text-slate-600 truncate block text-[11px]">{form.destination_city || '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-red-600" />
            <span>{formatHours(form.delivery_time_hours)}</span>
          </div>
          <span className="text-slate-400">up to {form.max_weight_kg || 0}kg</span>
        </div>

        {form.features?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {form.features.slice(0, 3).map((f) => (
              <Badge key={f} variant="secondary" className="text-[9px] capitalize bg-red-50 text-red-700 hover:bg-red-100 px-1.5 py-0">
                {f.replace(/_/g, ' ')}
              </Badge>
            ))}
            {form.features.length > 3 && <span className="text-[9px] text-slate-400 self-center">+{form.features.length - 3}</span>}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] text-slate-500">
            {priceSample ? `Estimated · ${priceSample.label}` : 'Set a price to preview'}
          </div>
          <div className="text-xl font-bold text-red-700">
            {priceSample ? `${priceSample.value.toLocaleString()} FCFA` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PackageServicesTab({ scopeOperatorId, operators }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_SVC);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (scopeOperatorId) params.set('operator_id', scopeOperatorId);
      const res = await api.get(`/package-services/?${params.toString()}`);
      setServices(res.data.services || []);
    } catch (err) {
      console.error('load services failed', err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return services;
    const s = search.toLowerCase();
    return services.filter((sv) =>
      (sv.name || '').toLowerCase().includes(s) ||
      (sv.origin_city || '').toLowerCase().includes(s) ||
      (sv.destination_city || '').toLowerCase().includes(s)
    );
  }, [services, search]);

  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openForm = (svc = null) => {
    setEditing(svc);
    if (svc) {
      setForm({
        ...DEFAULT_SVC,
        ...svc,
        tiers: svc.tiers?.length ? svc.tiers : DEFAULT_SVC.tiers,
        accepted_types: svc.accepted_types || [],
        features: svc.features || [],
        images: svc.images || [],
      });
    } else {
      setForm(DEFAULT_SVC);
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name || !form.origin_city || !form.destination_city) {
      toast.error('Name, origin and destination are required');
      return;
    }
    if (form.pricing_model === 'tiered' && !(form.tiers || []).some((t) => parseFloat(t.price) > 0)) {
      toast.error('Add at least one tier with a price');
      return;
    }
    if (form.pricing_model === 'per_kg' && !(parseFloat(form.base_price) >= 0 && parseFloat(form.per_kg_rate) >= 0)) {
      toast.error('Base price and per-kg rate are required');
      return;
    }

    setSubmitting(true);
    try {
      const operator = operators?.find((op) => (op._id || op.id) === form.operator_id);
      const payload = {
        ...form,
        max_weight_kg: parseFloat(form.max_weight_kg) || 0,
        max_length_cm: parseFloat(form.max_length_cm) || 0,
        max_width_cm: parseFloat(form.max_width_cm) || 0,
        max_height_cm: parseFloat(form.max_height_cm) || 0,
        delivery_time_hours: parseInt(form.delivery_time_hours) || 24,
        base_price: parseFloat(form.base_price) || 0,
        per_kg_rate: parseFloat(form.per_kg_rate) || 0,
        tiers: (form.tiers || []).map((t) => ({
          weight_min_kg: parseFloat(t.weight_min_kg) || 0,
          weight_max_kg: parseFloat(t.weight_max_kg) || 0,
          price: parseFloat(t.price) || 0,
          label: t.label || '',
          max_length_cm: t.max_length_cm ? parseFloat(t.max_length_cm) : null,
          max_width_cm: t.max_width_cm ? parseFloat(t.max_width_cm) : null,
          max_height_cm: t.max_height_cm ? parseFloat(t.max_height_cm) : null,
        })),
        operator_name: operator?.name || form.operator_name || '',
      };
      // Operators cannot set status — admins control activation via the Validation page
      delete payload.status;
      if (editing) {
        await api.put(`/package-services/${editing.id}`, payload);
        toast.success('Service updated');
      } else {
        await api.post('/package-services/', payload);
        toast.success('Service offering submitted — awaiting admin approval', { duration: 5000 });
      }
      setIsFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service offering?')) return;
    try {
      await api.delete(`/package-services/${id}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const ServiceCard = ({ svc }) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const getImg = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);
    const cover = (svc.images || [])[0];
    const thumbs = (svc.images || []).slice(1, 3);
    const cheapestTier = (svc.tiers || []).filter((t) => parseFloat(t.price) > 0)
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    const startingPrice = svc.pricing_model === 'tiered'
      ? (cheapestTier ? parseFloat(cheapestTier.price) : null)
      : (parseFloat(svc.base_price) > 0 ? parseFloat(svc.base_price) : null);

    return (
      <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5" data-testid={`service-card-${svc.id}`}>
        {/* Cover image w/ overlays */}
        <div className="relative h-36 overflow-hidden">
          {cover ? (
            <>
              <img src={getImg(cover)} alt={svc.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-red-900/30 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-rose-800 flex items-center justify-center">
              <Truck className="w-12 h-12 text-white/30" />
            </div>
          )}
          <div className="absolute top-2 left-2 z-10">
            <StatusBadge value={svc.status} />
          </div>
          {thumbs.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {thumbs.map((t, i) => (
                <img key={i} src={getImg(t)} alt="" className="w-9 h-9 rounded-md object-cover border-2 border-white/70 shadow" />
              ))}
            </div>
          )}
          <div className="absolute bottom-2 left-3 right-3 z-10 text-white">
            <p className="font-bold text-base line-clamp-1">{svc.name}</p>
            <p className="text-white/80 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {svc.origin_city} → {svc.destination_city}
            </p>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-1 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-red-600" />
              <span>{(parseInt(svc.delivery_time_hours) || 0)}h delivery</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Package className="w-3.5 h-3.5" />
              <span>up to {svc.max_weight_kg || 0}kg</span>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize">
              {svc.pricing_model === 'tiered' ? 'Tiered' : 'Per-kg'}
            </Badge>
          </div>

          {/* Pricing summary */}
          <div className="bg-red-50/40 rounded-lg p-3 mb-3">
            {svc.pricing_model === 'tiered' ? (
              <div className="space-y-1">
                {(svc.tiers || []).slice(0, 3).map((t, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-600">{t.label || `${t.weight_min_kg}–${t.weight_max_kg}kg`}</span>
                    <span className="font-bold text-red-700">{formatFCFA(t.price || 0)}</span>
                  </div>
                ))}
                {(svc.tiers?.length || 0) > 3 && <p className="text-[10px] text-slate-400">+{svc.tiers.length - 3} more tiers</p>}
              </div>
            ) : (
              <div className="text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Base price</span>
                  <span className="font-bold text-red-700">{formatFCFA(svc.base_price || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Per-kg rate</span>
                  <span className="font-bold text-red-700">{formatFCFA(svc.per_kg_rate || 0)}/kg</span>
                </div>
              </div>
            )}
          </div>

          {/* Types + Features */}
          {(svc.accepted_types || svc.features) && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(svc.accepted_types || []).slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] capitalize bg-slate-100 hover:bg-slate-100">
                  {t.replace(/_/g, ' ')}
                </Badge>
              ))}
              {(svc.features || []).slice(0, 2).map((f) => (
                <Badge key={f} variant="secondary" className="text-[10px] capitalize bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  {f.replace(/_/g, ' ')}
                </Badge>
              ))}
              {((svc.accepted_types?.length || 0) + (svc.features?.length || 0)) > 5 && (
                <span className="text-[10px] text-slate-400 self-center">+{(svc.accepted_types?.length || 0) + (svc.features?.length || 0) - 5}</span>
              )}
            </div>
          )}

          {/* Footer: starting price + actions */}
          <div className="flex items-end justify-between pt-3 border-t border-slate-100">
            <div>
              {startingPrice && (
                <>
                  <div className="text-[10px] text-slate-500">Starting at</div>
                  <div className="text-base font-bold text-red-700">{formatFCFA(startingPrice)}</div>
                </>
              )}
            </div>
            <div className="flex gap-1">
              <PermissionGate permission="packages.edit">
                <Button size="sm" variant="outline" onClick={() => openForm(svc)} className="h-8" data-testid={`edit-service-btn-${svc.id}`}>
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </PermissionGate>
              <PermissionGate permission="packages.delete">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => handleDelete(svc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </PermissionGate>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, origin, destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white"
            data-testid="services-search-input"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <PermissionGate permission="packages.create">
            <Button onClick={() => openForm()} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="add-service-btn">
              <Plus className="h-4 w-4 mr-1" /> New Service
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Truck className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 mb-4">{search ? 'No services match your search' : 'No service offerings yet — create your first to start receiving bookings.'}</p>
          <PermissionGate permission="packages.create">
            <Button onClick={() => openForm()} className="bg-[#082c59]"><Plus className="w-4 h-4 mr-2" /> New Service</Button>
          </PermissionGate>
        </Card>
      ) : viewMode === 'list' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Pricing</th>
                  <th className="px-4 py-3">Max Weight</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.origin_city} → {s.destination_city}</td>
                    <td className="px-4 py-3 capitalize">{s.pricing_model.replace('_', ' ')}</td>
                    <td className="px-4 py-3">{s.max_weight_kg} kg</td>
                    <td className="px-4 py-3">{s.delivery_time_hours}h</td>
                    <td className="px-4 py-3"><StatusBadge value={s.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openForm(s)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className={viewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'}>
          {paged.map((svc) => <ServiceCard key={svc.id} svc={svc} />)}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel="service"
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-6xl bg-white max-h-[94vh] overflow-y-auto p-0" data-testid="service-form-dialog">
          {/* Branded header */}
          <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-600 text-white px-6 py-5">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-white text-2xl flex items-center gap-2">
                    <Truck className="h-6 w-6" /> {editing ? 'Edit Service Offering' : 'New Service Offering'}
                  </DialogTitle>
                  <p className="text-white/80 text-sm mt-1">
                    {editing
                      ? 'Update your route, pricing tiers, photos and capacity. Activation status is managed by admins.'
                      : 'Define a delivery route and how you price it. Once submitted, the offering is reviewed by admins before going live.'}
                  </p>
                </div>
                {editing && (
                  <div className="flex-shrink-0">
                    <StatusBadge value={editing.status} />
                  </div>
                )}
              </div>
            </DialogHeader>
          </div>

          {/* Approval banner — only shown when creating */}
          {!editing && (
            <div className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong className="font-semibold">Admin approval required.</strong> New offerings start as
                <span className="mx-1 inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Pending Approval</span>
                and are reviewed by an admin via the Validation page. You'll be notified when it's activated.
              </div>
            </div>
          )}

          {editing && editing.status === 'pending' && (
            <div className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                This offering is awaiting <strong>admin approval</strong>. Edits won't bypass the review.
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* === LEFT: form fields === */}
              <div className="lg:col-span-2 space-y-5">
                {/* Photos */}
                <section className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50/60 to-rose-50/40 p-5">
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm uppercase tracking-wide flex items-center gap-2">
                    <Package className="h-4 w-4 text-red-500" /> Service Photos
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">Up to 3 photos showing your vehicles, hub or branding. The first photo is used as the cover on customer search results.</p>
                  <MiniImageUploader
                    images={form.images || []}
                    onChange={(imgs) => setForm((p) => ({ ...p, images: imgs }))}
                    max={3}
                    folder="package_services"
                    accent="red"
                    helperText="PNG/JPG up to 5MB each — the first photo is the cover"
                  />
                </section>

                {/* Basics */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Package className="h-4 w-4 text-red-500" /> Service Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Service Name *</Label>
                      <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Express Yaoundé → Douala" data-testid="service-name-input" className="bg-white" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What's special about this service?" className="bg-white" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-600" /> Origin City *</Label>
                        <Input value={form.origin_city} onChange={(e) => setForm((p) => ({ ...p, origin_city: e.target.value }))} placeholder="Yaoundé" className="bg-white" data-testid="origin-city-input" />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1"><MapPin className="h-3 w-3 text-red-500" /> Destination City *</Label>
                        <Input value={form.destination_city} onChange={(e) => setForm((p) => ({ ...p, destination_city: e.target.value }))} placeholder="Douala" className="bg-white" data-testid="destination-city-input" />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-600" /> Delivery Time (hrs)</Label>
                        <Input type="number" value={form.delivery_time_hours} onChange={(e) => setForm((p) => ({ ...p, delivery_time_hours: e.target.value }))} className="bg-white" data-testid="delivery-time-input" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pricing */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm uppercase tracking-wide">Pricing Model</h3>
                  <p className="text-xs text-slate-500 mb-3">Choose how customers are charged for this route.</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, pricing_model: 'tiered' }))}
                      className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${form.pricing_model === 'tiered' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      data-testid="pricing-tiered-radio"
                    >
                      <p className="font-semibold text-sm text-slate-900">Weight Tiers</p>
                      <p className="text-xs text-slate-500 mt-0.5">Flat price per weight bracket</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, pricing_model: 'per_kg' }))}
                      className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${form.pricing_model === 'per_kg' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      data-testid="pricing-per-kg-radio"
                    >
                      <p className="font-semibold text-sm text-slate-900">Base + Per-kg</p>
                      <p className="text-xs text-slate-500 mt-0.5">Fixed base + extra per kg</p>
                    </button>
                  </div>

                  {form.pricing_model === 'tiered' ? (
                    <div className="space-y-2 bg-white rounded-lg p-3 border border-slate-100">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-slate-400 px-1">
                        <span className="col-span-2">Min kg</span>
                        <span className="col-span-2">Max kg</span>
                        <span className="col-span-3">Label</span>
                        <span className="col-span-4">Price (FCFA)</span>
                        <span className="col-span-1"></span>
                      </div>
                      {(form.tiers || []).map((t, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <Input type="number" step="0.01" className="col-span-2" value={t.weight_min_kg} onChange={(e) => setForm((p) => ({ ...p, tiers: p.tiers.map((x, i) => i === idx ? { ...x, weight_min_kg: e.target.value } : x) }))} />
                          <Input type="number" step="0.01" className="col-span-2" value={t.weight_max_kg} onChange={(e) => setForm((p) => ({ ...p, tiers: p.tiers.map((x, i) => i === idx ? { ...x, weight_max_kg: e.target.value } : x) }))} />
                          <Input className="col-span-3" placeholder="e.g. Small" value={t.label || ''} onChange={(e) => setForm((p) => ({ ...p, tiers: p.tiers.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) }))} />
                          <Input type="number" className="col-span-4" placeholder="2000" value={t.price} onChange={(e) => setForm((p) => ({ ...p, tiers: p.tiers.map((x, i) => i === idx ? { ...x, price: e.target.value } : x) }))} />
                          <Button type="button" size="icon" variant="ghost" className="col-span-1 text-red-500" onClick={() => setForm((p) => ({ ...p, tiers: p.tiers.filter((_, i) => i !== idx) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => setForm((p) => ({ ...p, tiers: [...(p.tiers || []), { weight_min_kg: 0, weight_max_kg: 0, price: '', label: '' }] }))}>
                        <Plus className="h-3 w-3 mr-1" /> Add tier
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 bg-white rounded-lg p-3 border border-slate-100">
                      <div>
                        <Label>Base Price (FCFA) *</Label>
                        <Input type="number" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} placeholder="1500" data-testid="base-price-input" />
                        <p className="text-[10px] text-slate-400 mt-1">Charged regardless of weight</p>
                      </div>
                      <div>
                        <Label>Per-kg Rate (FCFA) *</Label>
                        <Input type="number" value={form.per_kg_rate} onChange={(e) => setForm((p) => ({ ...p, per_kg_rate: e.target.value }))} placeholder="400" data-testid="per-kg-rate-input" />
                        <p className="text-[10px] text-slate-400 mt-1">Added on top of base for each kg</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Capacity */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm uppercase tracking-wide">Capacity Limits</h3>
                  <p className="text-xs text-slate-500 mb-3">The maximum package this service can carry.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white rounded-lg p-3 border border-slate-100">
                    <div>
                      <Label>Max Weight (kg)</Label>
                      <Input type="number" step="0.1" value={form.max_weight_kg} onChange={(e) => setForm((p) => ({ ...p, max_weight_kg: e.target.value }))} data-testid="max-weight-input" />
                    </div>
                    <div>
                      <Label>Max Length (cm)</Label>
                      <Input type="number" value={form.max_length_cm} onChange={(e) => setForm((p) => ({ ...p, max_length_cm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max Width (cm)</Label>
                      <Input type="number" value={form.max_width_cm} onChange={(e) => setForm((p) => ({ ...p, max_width_cm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max Height (cm)</Label>
                      <Input type="number" value={form.max_height_cm} onChange={(e) => setForm((p) => ({ ...p, max_height_cm: e.target.value }))} />
                    </div>
                  </div>
                </section>

                {/* Types + Features */}
                <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1 text-sm uppercase tracking-wide">Accepted Package Types</h3>
                    <p className="text-xs text-slate-500 mb-3">Tap to toggle which kinds of packages this service accepts.</p>
                    <div className="flex flex-wrap gap-2">
                      {PACKAGE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setForm((p) => ({
                            ...p,
                            accepted_types: p.accepted_types?.includes(t.value)
                              ? p.accepted_types.filter((x) => x !== t.value)
                              : [...(p.accepted_types || []), t.value],
                          }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${form.accepted_types?.includes(t.value) ? 'bg-red-600 text-white border-red-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1 text-sm uppercase tracking-wide">Service Features</h3>
                    <p className="text-xs text-slate-500 mb-3">Things that make your service stand out.</p>
                    <div className="flex flex-wrap gap-2">
                      {FEATURES.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setForm((p) => ({
                            ...p,
                            features: p.features?.includes(f) ? p.features.filter((x) => x !== f) : [...(p.features || []), f],
                          }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition ${form.features?.includes(f) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                        >
                          {f.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Operator (admins only) */}
                {operators?.length > 0 && (
                  <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
                    <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wide">Operator Assignment</h3>
                    <Select value={form.operator_id || ''} onValueChange={(v) => setForm((p) => ({ ...p, operator_id: v }))}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select operator..." /></SelectTrigger>
                      <SelectContent className="bg-white max-h-60">
                        {operators.map((op) => (
                          <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>
                )}
              </div>

              {/* === RIGHT: Live Preview === */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-4 space-y-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Preview
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 normal-case font-normal">how customers will see it</span>
                  </div>
                  <ServicePreviewCard form={form} />

                  {/* Photo thumbnail summary */}
                  {(form.images || []).length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                        Photos ({form.images.length}/3)
                      </p>
                      <div className="flex gap-2">
                        {form.images.map((img, i) => {
                          const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
                          const url = img?.startsWith('/api') ? `${backendUrl}${img}` : img;
                          return (
                            <div key={i} className="relative">
                              <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow-sm" />
                              {i === 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">COVER</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-6 -mx-6 px-6 sticky bottom-0 bg-white">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={submitting} data-testid="save-service-btn">
                {submitting ? 'Saving…' : editing ? 'Update Service' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
