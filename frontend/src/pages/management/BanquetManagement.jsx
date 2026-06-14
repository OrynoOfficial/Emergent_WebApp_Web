import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import CategoryDetailsFields from '@/components/banquet/CategoryDetailsFields';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import {
  PartyPopper, Plus, Edit, Trash2, MapPin, Users, RefreshCw,
  LayoutDashboard, MessageSquare, Eye, Search, Layers,
  Building2, Armchair, TentTree, Camera, Video, UtensilsCrossed,
  Sparkles, Music2, Box, Package as PackageIcon,
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
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';

const PAGE_SIZE = 12;

// ────────────────────────────────────────────────────────────────────
// Service-category metadata. Each category drives:
//  - which fields the editor shows
//  - which pricing models are available
//  - the badge colour + icon on the cards
// Keep this in sync with `backend/models/banquet.py:ServiceCategory`.
// ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'hall',           label: 'Hall / Venue',          icon: Building2,       accent: 'bg-pink-100 text-pink-700' },
  { value: 'rental_item',    label: 'Rental Item',           icon: Armchair,        accent: 'bg-amber-100 text-amber-700' },
  { value: 'canopy',         label: 'Canopy / Tent',         icon: TentTree,        accent: 'bg-emerald-100 text-emerald-700' },
  { value: 'photographer',   label: 'Photographer',          icon: Camera,          accent: 'bg-indigo-100 text-indigo-700' },
  { value: 'videographer',   label: 'Videographer',          icon: Video,           accent: 'bg-purple-100 text-purple-700' },
  { value: 'catering',       label: 'Catering',              icon: UtensilsCrossed, accent: 'bg-orange-100 text-orange-700' },
  { value: 'decoration',     label: 'Decoration',            icon: Sparkles,        accent: 'bg-rose-100 text-rose-700' },
  { value: 'sound_lighting', label: 'Sound & Lighting',      icon: Music2,          accent: 'bg-cyan-100 text-cyan-700' },
  { value: 'other',          label: 'Other',                 icon: Box,             accent: 'bg-slate-100 text-slate-700' },
];

const CATEGORY_BY_VALUE = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

// Which pricing models make sense per category. The first entry is the default.
const PRICING_MODELS_BY_CATEGORY = {
  hall:           ['per_event', 'per_person', 'per_hour'],
  rental_item:    ['per_unit'],
  canopy:         ['per_unit', 'per_event'],
  photographer:   ['flat_fee', 'per_hour'],
  videographer:   ['flat_fee', 'per_hour'],
  catering:       ['per_person', 'per_event'],
  decoration:     ['per_event', 'flat_fee'],
  sound_lighting: ['per_event', 'per_hour'],
  other:          ['per_event', 'per_unit', 'per_hour', 'per_person', 'flat_fee'],
};

const PRICING_LABEL = {
  per_event:  'Per event',
  per_person: 'Per person',
  per_hour:   'Per hour',
  per_unit:   'Per unit',
  flat_fee:   'Flat fee',
};

const VENUE_SUBTYPES = ['hall', 'garden', 'rooftop', 'ballroom', 'banquet hall', 'open air'];
const HALL_AMENITIES = ['catering', 'decoration', 'entertainment', 'photography', 'sound_system', 'lighting', 'valet_parking', 'wifi', 'a/c'];

const DEFAULT_FORM = {
  category: 'hall',
  pricing_model: 'per_event',
  name: '',
  description: '',
  venue_type: 'hall',
  address: '',
  city: '',
  capacity_min: 50,
  capacity_max: 200,
  base_price: '',
  unit_label: '',
  min_quantity: '',
  max_quantity: '',
  duration_hours: '',
  amenities: [],
  category_details: {},
  images: [],
  phone: '',
  email: '',
  operator_id: '',
  operator_name: '',
};

// ────────────────────────────────────────────────────────────────────
// Category-aware form. Only renders the fields that actually apply to
// the picked category — keeps the editor short and unambiguous.
// ────────────────────────────────────────────────────────────────────
function CategoryAwareFields({ form, setForm, categoryOperators }) {
  const cat = form.category || 'hall';
  const allowedModels = PRICING_MODELS_BY_CATEGORY[cat] || ['per_event'];

  // Guard against a desync: when the user rapidly swaps categories the
  // controlled `pricing_model` may end up outside `allowedModels`, which
  // makes shadcn's Select render an empty trigger and submit posts an
  // empty value → backend 422. Snap to the first allowed model.
  React.useEffect(() => {
    if (!allowedModels.includes(form.pricing_model)) {
      setForm(p => ({ ...p, pricing_model: allowedModels[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const showCapacity = cat === 'hall' || cat === 'canopy';
  const showAddress = cat === 'hall';
  const showUnitFields = ['rental_item', 'canopy'].includes(cat);
  const showDuration = ['per_hour'].includes(form.pricing_model);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* photos */}
      <div className="col-span-2">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Service photos</Label>
        <div className="mt-2">
          <MiniImageUploader
            images={form.images || []}
            onChange={(imgs) => setForm(p => ({ ...p, images: imgs }))}
            max={3}
            folder="banquets"
            accent="pink"
            helperText="Up to 3 photos. The first is the cover."
          />
        </div>
      </div>

      {/* category picker */}
      <div className="col-span-2">
        <Label>Service Category</Label>
        <Select
          value={cat}
          onValueChange={(v) => {
            const next = PRICING_MODELS_BY_CATEGORY[v]?.[0] || 'per_event';
            setForm(p => ({ ...p, category: v, pricing_model: next }));
          }}
        >
          <SelectTrigger data-testid="service-category-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <SelectItem key={c.value} value={c.value}>
                  <span className="inline-flex items-center gap-2"><Icon className="w-4 h-4" /> {c.label}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* name */}
      <div className="col-span-2">
        <Label>Service Name</Label>
        <Input
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder={cat === 'hall' ? 'e.g. Akwa Grand Ballroom' :
                       cat === 'rental_item' ? 'e.g. Tiffany Gold Chair' :
                       cat === 'canopy' ? 'e.g. 10×20 White Canopy' :
                       cat === 'photographer' ? 'e.g. Wedding Photographer (Studio Lumière)' :
                       cat === 'videographer' ? 'e.g. Cinematic Wedding Video' :
                       cat === 'catering' ? 'e.g. Buffet — Cameroonian Classics' :
                       'Service name'}
          data-testid="service-name-input"
        />
      </div>

      {/* hall-only: subtype + address + capacity */}
      {cat === 'hall' && (
        <>
          <div>
            <Label>Venue Type</Label>
            <Select value={form.venue_type || 'hall'} onValueChange={v => setForm(p => ({ ...p, venue_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENUE_SUBTYPES.map(v => (<SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
          </div>
        </>
      )}

      {showAddress && (
        <div className="col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rue Joss, Douala" />
        </div>
      )}

      {showCapacity && (
        <>
          <div>
            <Label>Min. Capacity</Label>
            <Input type="number" value={form.capacity_min} onChange={e => setForm(p => ({ ...p, capacity_min: e.target.value }))} placeholder="50" />
          </div>
          <div>
            <Label>Max. Capacity</Label>
            <Input type="number" value={form.capacity_max} onChange={e => setForm(p => ({ ...p, capacity_max: e.target.value }))} placeholder="200" />
          </div>
        </>
      )}

      {/* pricing model + base price */}
      <div>
        <Label>Pricing</Label>
        <Select value={form.pricing_model} onValueChange={v => setForm(p => ({ ...p, pricing_model: v }))}>
          <SelectTrigger data-testid="pricing-model-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {allowedModels.map(m => (<SelectItem key={m} value={m}>{PRICING_LABEL[m]}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Base Price (FCFA)</Label>
        <Input
          type="number"
          value={form.base_price}
          onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))}
          placeholder="50000"
          data-testid="base-price-input"
        />
      </div>

      {/* per-unit fields */}
      {showUnitFields && (
        <>
          <div>
            <Label>Unit Label</Label>
            <Input
              value={form.unit_label}
              onChange={e => setForm(p => ({ ...p, unit_label: e.target.value }))}
              placeholder={cat === 'canopy' ? 'canopy' : 'chair / plate / spoon'}
              data-testid="unit-label-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Min Qty</Label>
              <Input type="number" value={form.min_quantity} onChange={e => setForm(p => ({ ...p, min_quantity: e.target.value }))} placeholder="10" />
            </div>
            <div>
              <Label className="text-xs">Max Qty</Label>
              <Input type="number" value={form.max_quantity} onChange={e => setForm(p => ({ ...p, max_quantity: e.target.value }))} placeholder="500" />
            </div>
          </div>
        </>
      )}

      {/* hourly talent — default duration */}
      {showDuration && (
        <div className="col-span-2">
          <Label>Default Duration (hours)</Label>
          <Input
            type="number"
            step="0.5"
            value={form.duration_hours}
            onChange={e => setForm(p => ({ ...p, duration_hours: e.target.value }))}
            placeholder="4"
          />
        </div>
      )}

      {/* amenities — meaningful for halls + catering + decoration */}
      {['hall', 'catering', 'decoration', 'sound_lighting'].includes(cat) && (
        <div className="col-span-2">
          <Label>What&apos;s included</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {HALL_AMENITIES.map(a => (
              <Badge
                key={a}
                variant={form.amenities?.includes(a) ? 'default' : 'outline'}
                className="cursor-pointer capitalize"
                onClick={() => setForm(p => ({
                  ...p,
                  amenities: p.amenities?.includes(a) ? p.amenities.filter(x => x !== a) : [...(p.amenities || []), a],
                }))}
              >
                {a.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* operator — scoped to operators selling this category */}
      <div className="col-span-2">
        <OperatorSelector
          value={form.operator_id || ''}
          onChange={(id, name) => setForm(p => ({ ...p, operator_id: id, operator_name: name }))}
          operators={categoryOperators}
          testId="banquet-operator-selector"
        />
        {categoryOperators.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">
            No operators are currently set up for &ldquo;{cat}&rdquo;. Assign this category to an operator first, or add the operator&apos;s first {cat} service via super-admin.
          </p>
        )}
      </div>

      {/* description */}
      <div className="col-span-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the service…" />
      </div>

      {/* category-specific rich fields */}
      <CategoryDetailsFields
        category={cat}
        details={form.category_details || {}}
        onChange={(next) => setForm(p => ({ ...p, category_details: next }))}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Packages tab — operator-built bundles
// ────────────────────────────────────────────────────────────────────
function PackagesTab({ services, scopeOperatorId }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', services: [], discount_percent: 0, is_active: true });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/banquets/packages/${params}`);
      setPackages(res.data.packages || []);
    } catch (err) {
      console.error(err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', services: [], discount_percent: 0, is_active: true });
    setOpen(true);
  }

  function openEdit(pkg) {
    setEditing(pkg);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      services: (pkg.services || []).map(s => ({ service_id: s.service_id, quantity: s.quantity || 1 })),
      discount_percent: pkg.discount_percent || 0,
      is_active: pkg.is_active !== false,
    });
    setOpen(true);
  }

  const save = async () => {
    if (!form.name || form.services.length === 0) {
      toast.error('Pick at least one service and give the package a name.');
      return;
    }
    try {
      const payload = { ...form, discount_percent: Number(form.discount_percent) || 0 };
      if (editing) await api.put(`/banquets/packages/${editing.id}`, payload);
      else await api.post('/banquets/packages/', payload);
      toast.success(editing ? 'Package updated' : 'Package created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this package?')) return;
    try {
      await api.delete(`/banquets/packages/${id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const toggleService = (svcId) => {
    setForm(p => {
      const exists = p.services.find(s => s.service_id === svcId);
      if (exists) return { ...p, services: p.services.filter(s => s.service_id !== svcId) };
      return { ...p, services: [...p.services, { service_id: svcId, quantity: 1 }] };
    });
  };

  const setQty = (svcId, qty) => {
    setForm(p => ({
      ...p,
      services: p.services.map(s => s.service_id === svcId ? { ...s, quantity: Number(qty) || 1 } : s),
    }));
  };

  const subtotal = useMemo(() => {
    return form.services.reduce((sum, line) => {
      const svc = services.find(s => s.id === line.service_id);
      if (!svc) return sum;
      return sum + (Number(svc.base_price) || 0) * (line.quantity || 1);
    }, 0);
  }, [form.services, services]);
  const total = subtotal * (1 - (Number(form.discount_percent) || 0) / 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#082c59]">Event Packages</h2>
          <p className="text-sm text-slate-500">Bundle multiple services together with an optional discount.</p>
        </div>
        <PermissionGate permission="banquets.create">
          <Button onClick={openCreate} className="bg-[#082c59]" data-testid="add-package-btn">
            <Plus className="w-4 h-4 mr-2" /> New Package
          </Button>
        </PermissionGate>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading…</div>
      ) : packages.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageIcon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No packages yet. Bundle a hall, chairs, plates and a photographer to sell a &ldquo;Wedding Day Bundle&rdquo; in one click.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => {
            // Resolve member services so we can pull cover images + meta
            const memberSvcs = (pkg.services || []).map(line => {
              const full = services.find(s => s.id === line.service_id);
              return {
                ...line,
                cover: full?.images?.[0] || null,
                full,
              };
            });
            const coversWithImage = memberSvcs.filter(m => m.cover);
            const heroCover = coversWithImage[0]?.cover || pkg.cover_image || null;
            const stripCovers = coversWithImage.slice(1, 4);
            const itemCount = memberSvcs.reduce((sum, m) => sum + (m.quantity || 0), 0);
            const categoriesUsed = Array.from(new Set(memberSvcs.map(m => m.category).filter(Boolean)));

            return (
              <Card key={pkg.id} className="overflow-hidden hover:shadow-xl transition-shadow group" data-testid={`package-card-${pkg.id}`}>
                {/* Hero composite: first member service's cover, with up to 3 thumbnails strip on top */}
                <div className="relative h-40 w-full bg-gradient-to-br from-pink-100 via-rose-100 to-amber-100 overflow-hidden">
                  {heroCover ? (
                    <img src={heroCover} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PackageIcon className="w-14 h-14 text-pink-300" />
                    </div>
                  )}
                  {/* Strip of additional service thumbnails */}
                  {stripCovers.length > 0 && (
                    <div className="absolute top-2 right-2 flex -space-x-2">
                      {stripCovers.map((m, i) => (
                        <img
                          key={i}
                          src={m.cover}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className={`${pkg.is_active ? 'bg-emerald-500/95 text-white' : 'bg-slate-500/90 text-white'} border-0 shadow-sm`}>
                      {pkg.is_active ? 'Active' : 'Draft'}
                    </Badge>
                  </div>
                  {/* Price + savings ribbon */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                    <div className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-md shadow-sm">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Bundle</div>
                      <div className="text-sm font-bold text-emerald-700 leading-tight">{formatFCFA(pkg.total_price || 0)}</div>
                    </div>
                    {pkg.discount_percent > 0 && (
                      <Badge className="bg-rose-500/95 text-white border-0 shadow-sm">−{pkg.discount_percent}%</Badge>
                    )}
                  </div>
                </div>

                <CardContent className="pt-3 pb-4">
                  <h3 className="font-semibold leading-tight line-clamp-1 mb-1" title={pkg.name}>{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{pkg.description}</p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-2">
                    <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {memberSvcs.length} services</span>
                    {itemCount > 0 && <span className="inline-flex items-center gap-1"><Box className="w-3 h-3" /> {itemCount} items</span>}
                    {pkg.discount_percent > 0 && pkg.subtotal && (
                      <span className="text-rose-600 inline-flex items-center gap-1">save {formatFCFA((pkg.subtotal || 0) - (pkg.total_price || 0))}</span>
                    )}
                  </div>

                  {/* Category chips */}
                  {categoriesUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {categoriesUsed.slice(0, 5).map(cat => {
                        const m = CATEGORY_BY_VALUE[cat] || CATEGORY_BY_VALUE.other;
                        const CIcon = m.icon;
                        return (
                          <Badge key={cat} variant="outline" className={`text-[10px] font-normal py-0 px-1.5 ${m.accent}`}>
                            <CIcon className="w-3 h-3 mr-1" /> {m.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Service breakdown — compact list with thumb + name + qty */}
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {memberSvcs.slice(0, 4).map((m, i) => {
                      const meta = CATEGORY_BY_VALUE[m.category] || CATEGORY_BY_VALUE.other;
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-center gap-2 text-[12px] border-b border-slate-100 last:border-b-0 py-1">
                          {m.cover ? (
                            <img src={m.cover} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${meta.accent}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span className="flex-1 truncate text-slate-700">{m.service_name || m.full?.name || m.service_id}</span>
                          <span className="text-xs text-slate-500 flex-shrink-0">× {m.quantity}</span>
                        </div>
                      );
                    })}
                    {memberSvcs.length > 4 && (
                      <div className="text-[11px] text-slate-500 text-center pt-1">+{memberSvcs.length - 4} more services</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    {pkg.discount_percent > 0 && (
                      <div className="text-xs text-slate-500">
                        <span className="line-through">{formatFCFA(pkg.subtotal || 0)}</span>
                      </div>
                    )}
                    <div className="flex gap-1 ml-auto">
                      <Button size="sm" variant="outline" onClick={() => setViewing(pkg)} title="View details" data-testid={`view-package-btn-${pkg.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <PermissionGate permission="banquets.edit">
                        <Button size="sm" variant="outline" onClick={() => openEdit(pkg)} data-testid={`edit-package-btn-${pkg.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="banquets.delete">
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => remove(pkg.id)} data-testid={`delete-package-btn-${pkg.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5 text-pink-600" />
              {editing ? 'Edit Package' : 'Create Event Package'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Package Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Wedding Day Bundle — 200 guests"
                data-testid="package-name-input"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What this package covers, ideal guest count, etc."
              />
            </div>
            <div>
              <Label>Services in this bundle</Label>
              <div className="mt-2 space-y-2 max-h-72 overflow-y-auto border rounded-md p-2 bg-slate-50/50">
                {services.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Add some services first &mdash; they&apos;ll show up here.</p>
                ) : services.map(svc => {
                  const line = form.services.find(s => s.service_id === svc.id);
                  const meta = CATEGORY_BY_VALUE[svc.category] || CATEGORY_BY_VALUE.other;
                  const Icon = meta.icon;
                  const cover = (svc.images && svc.images[0]) || null;
                  const isPicked = !!line;
                  return (
                    <div
                      key={svc.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${isPicked ? 'bg-pink-50 border-pink-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isPicked}
                          onChange={() => toggleService(svc.id)}
                          className="flex-shrink-0"
                        />
                        {cover ? (
                          <img src={cover} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${meta.accent}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{svc.name}</span>
                            <Badge variant="outline" className={`text-[10px] font-normal py-0 px-1.5 ${meta.accent} border-0`}>{meta.label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-medium text-emerald-700">{formatFCFA(svc.base_price || 0)}</span>
                            <span>·</span>
                            <span>{PRICING_LABEL[svc.pricing_model || svc.price_type] || 'price'}</span>
                            {svc.city && (<><span>·</span><span className="truncate">{svc.city}</span></>)}
                          </div>
                        </div>
                      </label>
                      {isPicked && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Label className="text-xs text-slate-500">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            step="0.5"
                            value={line.quantity}
                            onChange={e => setQty(svc.id, e.target.value)}
                            className="w-20 h-8"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bundle Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discount_percent}
                  onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  />
                  <span className="text-sm">Active (customers can book)</span>
                </label>
              </div>
            </div>
            <Card className="bg-pink-50 border-pink-200">
              <CardContent className="pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Subtotal</span>
                  <span className="font-medium">{formatFCFA(subtotal)}</span>
                </div>
                {Number(form.discount_percent) > 0 && (
                  <div className="flex items-baseline justify-between text-rose-700">
                    <span className="text-sm">Discount ({form.discount_percent}%)</span>
                    <span className="font-medium">−{formatFCFA(subtotal - total)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-pink-200">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-emerald-700">{formatFCFA(total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* ── Live customer preview ────────────────────────────────
                Shows the operator exactly how the package will be merchandised
                on the customer-facing card so they can iterate on naming,
                discount, and service mix without leaving the modal. */}
            {form.services.length > 0 && (() => {
              const picked = form.services.map(line => {
                const full = services.find(s => s.id === line.service_id);
                return {
                  ...line,
                  full,
                  cover: full?.images?.[0] || null,
                  name: full?.name || line.service_name,
                };
              });
              const heroCover = picked.find(p => p.cover)?.cover || null;
              const stripCovers = picked.filter(p => p.cover).slice(1, 4);
              const totalItems = picked.reduce((s, p) => s + Number(p.quantity || 0), 0);
              const heroIcon = (CATEGORY_BY_VALUE[picked[0]?.category] || CATEGORY_BY_VALUE.other);
              const HeroIcon = heroIcon.icon;
              return (
                <div className="border-t pt-3">
                  <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">Live preview · how customers will see it</p>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-w-sm mx-auto">
                    <div className="relative h-32 bg-gradient-to-br from-pink-100 via-rose-100 to-amber-100">
                      {heroCover ? (
                        <img src={heroCover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <HeroIcon className="w-12 h-12 text-pink-300" />
                        </div>
                      )}
                      {stripCovers.length > 0 && (
                        <div className="absolute top-2 right-2 flex -space-x-2">
                          {stripCovers.map((m, i) => (
                            <img key={i} src={m.cover} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ))}
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                        <div className="bg-white/95 backdrop-blur px-2 py-0.5 rounded">
                          <div className="text-[9px] uppercase text-slate-500 font-semibold">Bundle</div>
                          <div className="text-xs font-bold text-emerald-700">{formatFCFA(total)}</div>
                        </div>
                        {Number(form.discount_percent) > 0 && (
                          <Badge className="bg-rose-500/95 text-white border-0 text-[10px]">−{form.discount_percent}%</Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm leading-tight line-clamp-1">{form.name || 'Untitled bundle'}</p>
                      {form.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{form.description}</p>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2">
                        <span>{picked.length} services</span>
                        {totalItems > 0 && <><span>·</span><span>{totalItems} items</span></>}
                        {!form.is_active && <><span>·</span><span className="text-amber-600 font-medium">Draft (hidden)</span></>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#082c59]" data-testid="save-package-btn">
              {editing ? 'Update Package' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Package Dialog — full bundle breakdown with member service photos */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto p-0">
          {viewing && (() => {
            const members = (viewing.services || []).map(line => {
              const full = services.find(s => s.id === line.service_id);
              return { ...line, full, cover: full?.images?.[0] || null };
            });
            const covers = members.filter(m => m.cover).map(m => m.cover);
            const heroCover = covers[0] || null;
            const stripCovers = covers.slice(1, 4);
            const totalItems = members.reduce((s, m) => s + Number(m.quantity || 0), 0);
            const cats = Array.from(new Set(members.map(m => m.category || m.full?.category).filter(Boolean)));
            return (
              <>
                {/* Hero */}
                <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-pink-200 via-rose-200 to-amber-200">
                  {heroCover ? (
                    <img src={heroCover} alt={viewing.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PackageIcon className="w-16 h-16 text-pink-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {stripCovers.length > 0 && (
                    <div className="absolute top-3 right-3 flex -space-x-2">
                      {stripCovers.map((c, i) => (
                        <img key={i} src={c} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow" />
                      ))}
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge className={`${viewing.is_active ? 'bg-emerald-500/95' : 'bg-slate-500/90'} text-white border-0 shadow-sm`}>
                      {viewing.is_active ? 'Active' : 'Draft'}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white drop-shadow">
                    <div>
                      <h2 className="text-2xl font-bold leading-tight">{viewing.name}</h2>
                      <p className="text-xs text-white/80 mt-0.5">{members.length} services · {totalItems} items</p>
                    </div>
                    <div className="bg-white/95 backdrop-blur rounded-md px-3 py-1.5 shadow text-right text-slate-800 flex-shrink-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Bundle</div>
                      <div className="text-base font-bold text-emerald-700">{formatFCFA(viewing.total_price || 0)}</div>
                      {viewing.discount_percent > 0 && (
                        <div className="text-[10px] text-rose-600 font-medium">−{viewing.discount_percent}% off</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {viewing.description && (
                    <p className="text-sm text-slate-700 leading-relaxed">{viewing.description}</p>
                  )}

                  {cats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cats.map(cat => {
                        const m = CATEGORY_BY_VALUE[cat] || CATEGORY_BY_VALUE.other;
                        const CIcon = m.icon;
                        return (
                          <Badge key={cat} variant="outline" className={`text-xs font-normal ${m.accent} border-0`}>
                            <CIcon className="w-3 h-3 mr-1" /> {m.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Member services with photos */}
                  <div>
                    <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">Includes</p>
                    <div className="space-y-2">
                      {members.map((m, i) => {
                        const meta = CATEGORY_BY_VALUE[m.category || m.full?.category] || CATEGORY_BY_VALUE.other;
                        const Icon = meta.icon;
                        return (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 bg-slate-50">
                            {m.cover ? (
                              <img src={m.cover} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                            ) : (
                              <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${meta.accent}`}>
                                <Icon className="w-6 h-6" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{m.service_name || m.full?.name || m.service_id}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className={`text-[10px] font-normal py-0 px-1.5 ${meta.accent} border-0`}>{meta.label}</Badge>
                                {m.full?.base_price && (
                                  <span className="text-emerald-700 font-medium">{formatFCFA(m.full.base_price)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-slate-700 flex-shrink-0">× {m.quantity}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing breakdown */}
                  <div className="bg-pink-50 rounded-lg border border-pink-200 p-3 text-sm">
                    {viewing.subtotal && (
                      <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-medium">{formatFCFA(viewing.subtotal)}</span></div>
                    )}
                    {viewing.discount_percent > 0 && viewing.subtotal && (
                      <div className="flex justify-between text-rose-700"><span>Discount ({viewing.discount_percent}%)</span><span>−{formatFCFA(viewing.subtotal - viewing.total_price)}</span></div>
                    )}
                    <div className="flex justify-between mt-1 pt-1 border-t border-pink-200">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold text-emerald-700">{formatFCFA(viewing.total_price || 0)}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter className="px-5 pb-5 pt-0 border-t">
                  <PermissionGate permission="banquets.edit">
                    <Button variant="outline" onClick={() => { setViewing(null); openEdit(viewing); }}>
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                  </PermissionGate>
                  <Button onClick={() => setViewing(null)} className="bg-[#082c59]">Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────
export default function BanquetManagement() {
  // user lookup retained for future role-aware tweaks (e.g. operator-scoped UI hints).
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [services, setServices] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [bookingsRefreshKey] = useState(0);

  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const dashboardData = useRealDashboardData('banquets', '30days', scopeOperatorId);

  const filtered = useMemo(() => {
    let list = services;
    if (categoryFilter !== 'all') list = list.filter(s => (s.category || 'hall') === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [services, search, categoryFilter]);

  // Natural clamp: when filters change and `filtered` shrinks, `safePage`
  // collapses to the last valid page. No setState-in-effect needed.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/banquets/management/my-venues${params}`);
      setServices(res.data.venues || res.data.banquets || []);
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (err) {
      console.error(err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { loadServices(); }, [loadServices]);

  // Operators relevant to the *currently picked category* in the modal.
  // Refetched whenever the operator opens the modal or flips the
  // category dropdown — so the selector only shows operators who
  // actually offer this kind of service.
  const [categoryOperators, setCategoryOperators] = useState([]);
  useEffect(() => {
    if (!isDialogOpen) return;
    const cat = form.category || 'hall';
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/operators/by-service-category', {
          params: { service_type: 'banquet', category: cat },
        });
        if (!cancelled) setCategoryOperators(res.data.operators || []);
      } catch (err) {
        console.error('by-service-category failed', err);
        if (!cancelled) setCategoryOperators([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isDialogOpen, form.category]);

  function openDialog(svc = null) {
    setEditing(svc);
    if (svc) {
      setForm({
        ...DEFAULT_FORM,
        ...svc,
        category: svc.category || 'hall',
        pricing_model: svc.pricing_model || (svc.price_type === 'per_person' ? 'per_person' : 'per_event'),
        base_price: svc.base_price?.toString() || '',
        capacity_min: svc.capacity_min ?? '',
        capacity_max: svc.capacity_max ?? '',
        min_quantity: svc.min_quantity ?? '',
        max_quantity: svc.max_quantity ?? '',
        duration_hours: svc.duration_hours ?? '',
        unit_label: svc.unit_label || '',
        amenities: svc.amenities || [],
        category_details: svc.category_details || {},
        operator_id: svc.operator_id || '',
        operator_name: svc.operator_name || '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setIsDialogOpen(true);
  }

  const handleSave = async () => {
    // Client-side validation. Backend rejects payload with 422 if these are
    // missing — surface that *before* hitting the wire so the operator sees
    // exactly what's needed instead of a generic "Failed to save".
    if (!form.name?.trim()) { toast.error('Service name is required'); return; }
    if (!form.operator_id) { toast.error('Please pick an operator'); return; }
    const price = parseFloat(form.base_price);
    if (!price || price <= 0) { toast.error('Base price must be greater than 0'); return; }
    try {
      const op = (categoryOperators.length ? categoryOperators : operators).find(o => (o._id || o.id) === form.operator_id);
      const payload = {
        category: form.category,
        pricing_model: form.pricing_model,
        name: form.name,
        description: form.description,
        venue_type: form.category === 'hall' ? form.venue_type : null,
        address: form.address || null,
        city: form.city || null,
        capacity_min: form.capacity_min !== '' ? parseInt(form.capacity_min, 10) : null,
        capacity_max: form.capacity_max !== '' ? parseInt(form.capacity_max, 10) : null,
        base_price: price,
        // legacy field kept in sync for backward compat with old search UIs
        price_type: form.pricing_model === 'per_person' ? 'per_person' : 'per_event',
        unit_label: form.unit_label || null,
        min_quantity: form.min_quantity !== '' ? parseInt(form.min_quantity, 10) : null,
        max_quantity: form.max_quantity !== '' ? parseInt(form.max_quantity, 10) : null,
        duration_hours: form.duration_hours !== '' ? parseFloat(form.duration_hours) : null,
        amenities: form.amenities || [],
        category_details: form.category_details || {},
        images: form.images || [],
        phone: form.phone || null,
        email: form.email || null,
        operator_id: form.operator_id || null,
        operator_name: op?.name || form.operator_name || '',
      };
      if (editing) {
        await api.put(`/banquets/${editing.id}`, payload);
        toast.success('Service updated');
      } else {
        await api.post('/banquets/', payload);
        toast.success('Service created');
      }
      setIsDialogOpen(false);
      loadServices();
    } catch (err) {
      // FastAPI 422 returns `{ detail: [{ loc, msg }, …] }`. Render the
      // first field error so the user can fix it inline rather than
      // staring at "[object Object]" — or worse, an empty toast.
      const d = err.response?.data?.detail;
      let msg = 'Failed to save service';
      if (Array.isArray(d) && d[0]?.msg) {
        msg = `${d[0].loc?.slice(-1)?.[0] || 'Field'}: ${d[0].msg}`;
      } else if (typeof d === 'string' && d) {
        msg = d;
      } else if (err.response?.status === 422) {
        msg = 'Some fields are invalid. Double-check the pricing model and required fields.';
      } else if (err.message) {
        msg = err.message;
      }
      toast.error(msg);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service?')) return;
    try {
      await api.delete(`/banquets/${id}`);
      toast.success('Deleted');
      loadServices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleView = (svc) => {
    setViewing(svc);
    setIsViewOpen(true);
    activityLogger.serviceView(svc.id, svc.name);
  };

  // Category-aware preview meta for the form's right-column preview card.
  const previewMeta = CATEGORY_BY_VALUE[form.category] || CATEGORY_BY_VALUE.hall;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Banquet & Event Services</h1>
          <p className="text-gray-600">Halls, chairs & cutlery, canopies, photographers and event packages — all in one place.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OperatorScopeFilter serviceType="banquet" value={scopeOperatorId} onChange={setScopeOperatorId} />
          <Button onClick={loadServices} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management" data-testid="services-tab"><Layers className="h-4 w-4 mr-2" />Services</TabsTrigger>
          <TabsTrigger value="packages" data-testid="packages-tab"><PackageIcon className="h-4 w-4 mr-2" />Packages</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Banquet"
            serviceIcon={<PartyPopper className="h-8 w-8" />}
            primaryColor="pink"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Services"
            secondaryLabel="Categories"
            secondaryCount={new Set(services.map(s => s.category || 'hall')).size}
            recentBookingsSlot={
              <OperatorBookingsList serviceType="banquet" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
            }
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-2 max-w-2xl items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search services by name, city, address…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white"
                  data-testid="services-search-input"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 bg-white" data-testid="category-filter-select">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <PermissionGate permission="banquets.create">
                <Button onClick={() => openDialog()} className="bg-[#082c59]" data-testid="add-service-btn">
                  <Plus className="w-4 h-4 mr-2" /> Add Service
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Category filter is in the dropdown beside the search — chips removed by request to keep the toolbar clean. */}

          {loading ? (
            <div className="text-center py-8">Loading…</div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <PartyPopper className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">{search || categoryFilter !== 'all' ? 'No services match your filters' : 'No services yet. Click "Add Service" to get started.'}</p>
            </Card>
          ) : (
            <div className={viewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`services-${viewMode}-view`}>
              {paged.map(svc => {
                const meta = CATEGORY_BY_VALUE[svc.category || 'hall'] || CATEGORY_BY_VALUE.hall;
                const Icon = meta.icon;
                const cover = (svc.images && svc.images[0]) || null;
                const detailEntries = Object.entries(svc.category_details || {})
                  .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
                  .slice(0, 4);
                return (
                  <Card key={svc.id} className="overflow-hidden hover:shadow-xl transition-shadow group" data-testid={`service-card-${svc.id}`}>
                    {/* Cover image — full-bleed; falls back to a tinted icon hero */}
                    <div className="relative h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                      {cover ? (
                        <img src={cover} alt={svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${meta.accent}`}>
                          <Icon className="w-14 h-14 opacity-50" />
                        </div>
                      )}
                      {/* Category chip overlay */}
                      <div className="absolute top-2 left-2">
                        <Badge className={`${meta.accent} border-0 shadow-sm inline-flex items-center gap-1`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </Badge>
                      </div>
                      {/* Image count chip (when more than one) */}
                      {svc.images && svc.images.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                          +{svc.images.length - 1} more
                        </div>
                      )}
                      {/* Price ribbon */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                        <div className="bg-white/95 backdrop-blur px-2.5 py-1 rounded-md shadow-sm">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{PRICING_LABEL[svc.pricing_model || svc.price_type] || 'Price'}</div>
                          <div className="text-sm font-bold text-emerald-700 leading-tight">{formatFCFA(svc.base_price || 0)}</div>
                        </div>
                      </div>
                    </div>

                    <CardContent className="pt-3 pb-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold leading-tight line-clamp-1" title={svc.name}>{svc.name}</h3>
                      </div>

                      {svc.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{svc.description}</p>
                      )}

                      <div className="space-y-1 text-xs text-slate-600">
                        {svc.city && (
                          <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{svc.address ? `${svc.address}, ` : ''}{svc.city}</span>
                          </div>
                        )}
                        {(svc.capacity_max != null) && (
                          <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />{svc.capacity_min || 0}–{svc.capacity_max} guests</div>
                        )}
                        {svc.unit_label && (
                          <div className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            Sold by the <strong className="font-medium">{svc.unit_label}</strong>
                            {svc.min_quantity ? ` (min ${svc.min_quantity})` : ''}
                          </div>
                        )}
                        {svc.duration_hours && (
                          <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />Default {svc.duration_hours}h session</div>
                        )}
                      </div>

                      {/* Category-specific details summary (up to 4 chips) */}
                      {detailEntries.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {detailEntries.map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-slate-600">
                              {String(k).replace(/_/g, ' ')}: <strong className="font-medium ml-1 truncate max-w-[120px]">{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Amenities preview for halls */}
                      {Array.isArray(svc.amenities) && svc.amenities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {svc.amenities.slice(0, 3).map(a => (
                            <Badge key={a} variant="secondary" className="text-[10px] font-normal py-0 px-1.5">{String(a).replace(/_/g, ' ')}</Badge>
                          ))}
                          {svc.amenities.length > 3 && (
                            <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5 text-slate-500">+{svc.amenities.length - 3}</Badge>
                          )}
                        </div>
                      )}

                      {/* Operator + contact strip */}
                      {(svc.operator_name || svc.phone || svc.email) && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                          {svc.operator_name && <span className="inline-flex items-center gap-1 truncate"><Building2 className="w-3 h-3" /> {svc.operator_name}</span>}
                          {(svc.phone || svc.email) && (
                            <span className="truncate text-right">{svc.phone || svc.email}</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => handleView(svc)} title="View details" data-testid={`view-service-btn-${svc.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <PermissionGate permission="banquets.edit">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => openDialog(svc)} data-testid={`edit-service-btn-${svc.id}`}>
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="banquets.delete">
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(svc.id)} data-testid={`delete-service-btn-${svc.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
        </TabsContent>

        <TabsContent value="packages" className="mt-6">
          <PackagesTab services={services} scopeOperatorId={scopeOperatorId} />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Banquet"
            serviceTag="banquets"
            operatorId={scopeOperatorId}
            serviceIcon={<PartyPopper className="h-5 w-5 text-pink-600" />}
            primaryColor="pink"
          />
        </TabsContent>
      </Tabs>

      {/* Add / Edit Service Modal */}
      <ServiceFormShell
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        icon={previewMeta.icon}
        title={editing ? 'Edit Service' : 'Add Service'}
        subtitle={editing
          ? 'Update category, pricing and photos.'
          : 'List a new service — hall, rental items, canopy, photographer, catering, anything you offer for events.'}
        editing={!!editing}
        accent="pink"
        leftColumn={<CategoryAwareFields form={form} setForm={setForm} categoryOperators={categoryOperators} />}
        preview={
          <div className="space-y-3">
            <GenericPreviewCard
              cover={(form.images || [])[0]}
              thumbs={(form.images || []).slice(1, 3)}
              icon={previewMeta.icon}
              badgeText={previewMeta.label}
              badgeClass="bg-pink-500 text-white"
              placeholderColor="from-pink-600 via-rose-500 to-fuchsia-500"
              title={form.name || 'Service name'}
              subtitle={form.category === 'hall' ? (form.venue_type || 'Venue') : previewMeta.label}
              location={[
                form.city,
                form.capacity_max ? `Up to ${form.capacity_max} guests` : null,
                form.unit_label ? `Sold by the ${form.unit_label}` : null,
              ].filter(Boolean).join(' · ') || (form.category === 'hall' ? 'City · Capacity' : 'Service details')}
              tags={form.amenities || []}
              tagsAccentClass="bg-pink-50 text-pink-700"
              priceLabel={PRICING_LABEL[form.pricing_model] || 'Price'}
              priceValue={form.base_price ? `${Number(form.base_price).toLocaleString()} FCFA` : '—'}
              accentTextClass="text-pink-700"
            />

            {/* Extra image gallery — surface ALL uploaded shots so the operator
                doesn't have to scroll the form to know what they've added. */}
            {Array.isArray(form.images) && form.images.length > 3 && (
              <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                  Gallery · {form.images.length} photos
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {form.images.slice(0, 8).map((img, i) => (
                    <img key={i} src={img} alt="" className="aspect-square rounded-md object-cover" />
                  ))}
                  {form.images.length > 8 && (
                    <div className="aspect-square rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500">
                      +{form.images.length - 8}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description preview — operators love seeing how their copy will read */}
            {form.description && (
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">About</div>
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-5">{form.description}</p>
              </div>
            )}

            {/* Category-specific details surfaced as a chip grid. Empty values
                are filtered so the operator sees only what they've filled in.
                eslint-disable-next-line react/no-unstable-nested-components */}
            {/* eslint-disable-next-line react/no-unstable-nested-components */}
            {(() => {
              const cd = form.category_details || {};
              const entries = Object.entries(cd).filter(([, v]) =>
                v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
              );
              if (entries.length === 0) return null;
              return (
                /* eslint-disable-next-line react/no-unstable-nested-components */
                <div className="bg-pink-50 rounded-xl border border-pink-200 p-3" data-testid="modal-category-details">
                  <div className="text-[10px] uppercase tracking-wider text-pink-700 font-semibold mb-2">
                    {previewMeta.label} details
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {entries.map(([k, v]) => (
                      <div key={k} className="bg-white rounded px-2 py-1 border border-pink-100">
                        <div className="text-[9px] text-slate-500 capitalize">{String(k).replace(/_/g, ' ')}</div>
                        <div className="text-xs font-medium text-slate-800 truncate" title={Array.isArray(v) ? v.join(', ') : String(v)}>
                          {Array.isArray(v) ? v.join(', ') : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Operator + contact strip — visible only when known */}
            {(form.operator_name || form.phone || form.email || form.duration_hours || form.min_quantity) && (
              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                {form.operator_name && (
                  <div className="text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500">Operator</span>
                    <span className="font-medium text-slate-800 truncate">{form.operator_name}</span>
                  </div>
                )}
                {form.duration_hours && (
                  <div className="text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500">Default duration</span>
                    <span className="font-medium text-slate-800">{form.duration_hours}h</span>
                  </div>
                )}
                {form.min_quantity && (
                  <div className="text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500">Min quantity</span>
                    <span className="font-medium text-slate-800">{form.min_quantity}</span>
                  </div>
                )}
                {form.phone && (
                  <div className="text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-medium text-slate-800 truncate">{form.phone}</span>
                  </div>
                )}
                {form.email && (
                  <div className="text-[11px] flex items-center justify-between gap-2">
                    <span className="text-slate-500">Email</span>
                    <span className="font-medium text-slate-800 truncate">{form.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        }
        submitting={false}
        submitLabel={editing ? 'Update Service' : 'Add Service'}
        onSubmit={handleSave}
        submitDataTestId="save-service-btn"
      />

      {/* View Service Dialog — rich preview matching the customer-facing card */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto p-0">
          {viewing && (() => {
            const meta = CATEGORY_BY_VALUE[viewing.category || 'hall'] || CATEGORY_BY_VALUE.hall;
            const Icon = meta.icon;
            const images = Array.isArray(viewing.images) ? viewing.images.filter(Boolean) : [];
            const cover = images[0];
            const thumbs = images.slice(1, 6);
            const detailEntries = Object.entries(viewing.category_details || {})
              .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
            return (
              <>
                {/* Hero image (or icon fallback) with title overlay */}
                <div className="relative h-56 w-full overflow-hidden">
                  {cover ? (
                    <img src={cover} alt={viewing.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${meta.accent}`}>
                      <Icon className="w-20 h-20 opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <div className="text-white drop-shadow">
                      <Badge className={`${meta.accent} border-0 mb-1 inline-flex items-center gap-1`}>
                        <Icon className="w-3.5 h-3.5" /> {meta.label}
                      </Badge>
                      <h2 className="text-2xl font-bold leading-tight">{viewing.name}</h2>
                    </div>
                    <div className="bg-white/95 backdrop-blur rounded-md px-3 py-1.5 shadow text-right flex-shrink-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{PRICING_LABEL[viewing.pricing_model || viewing.price_type] || 'Price'}</div>
                      <div className="text-base font-bold text-emerald-700">{formatFCFA(viewing.base_price || 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Thumbnail strip — when more than one image is uploaded */}
                {thumbs.length > 0 && (
                  <div className="px-5 pt-3 flex gap-2 overflow-x-auto pb-1">
                    {thumbs.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0 ring-1 ring-slate-200" />
                    ))}
                    {images.length > 6 && (
                      <div className="w-16 h-16 rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 flex-shrink-0">
                        +{images.length - 6}
                      </div>
                    )}
                  </div>
                )}

                <div className="px-5 py-4 space-y-4">
                  {/* Description */}
                  {viewing.description && (
                    <p className="text-sm text-slate-700 leading-relaxed">{viewing.description}</p>
                  )}

                  {/* Facts grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {(viewing.address || viewing.city) && (
                      <div className="col-span-2">
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Location</p>
                        <p className="font-medium flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{viewing.address ? `${viewing.address}, ` : ''}{viewing.city}</p>
                      </div>
                    )}
                    {(viewing.capacity_min != null || viewing.capacity_max != null) && (
                      <div>
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Capacity</p>
                        <p className="font-medium flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" />{viewing.capacity_min || 0}–{viewing.capacity_max || '∞'} guests</p>
                      </div>
                    )}
                    {viewing.duration_hours && (
                      <div>
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Default duration</p>
                        <p className="font-medium flex items-center gap-1.5"><Layers className="w-4 h-4 text-slate-400" />{viewing.duration_hours}h session</p>
                      </div>
                    )}
                    {viewing.unit_label && (
                      <div>
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Unit</p>
                        <p className="font-medium flex items-center gap-1.5"><Box className="w-4 h-4 text-slate-400" />per {viewing.unit_label}{viewing.min_quantity ? ` (min ${viewing.min_quantity})` : ''}</p>
                      </div>
                    )}
                    {viewing.operator_name && (
                      <div>
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Operator</p>
                        <p className="font-medium flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" />{viewing.operator_name}</p>
                      </div>
                    )}
                    {(viewing.phone || viewing.email) && (
                      <div className="col-span-2">
                        <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-0.5">Contact</p>
                        <p className="font-medium text-slate-700">{[viewing.phone, viewing.email].filter(Boolean).join(' · ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Category-specific details */}
                  {detailEntries.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">{meta.label} details</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {detailEntries.map(([k, v]) => (
                          <div key={k} className="bg-white rounded px-2 py-1.5 border border-slate-100">
                            <div className="text-[10px] text-slate-500 capitalize">{String(k).replace(/_/g, ' ')}</div>
                            <div className="font-medium text-slate-800 truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amenities (mainly halls) */}
                  {Array.isArray(viewing.amenities) && viewing.amenities.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">Includes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {viewing.amenities.map(a => (
                          <Badge key={a} variant="outline" className="text-xs font-normal capitalize">{String(a).replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="px-5 pb-5 pt-0 border-t">
                  <Button variant="outline" onClick={() => { openDialog(viewing); setIsViewOpen(false); }}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button onClick={() => setIsViewOpen(false)} className="bg-[#082c59]">Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
