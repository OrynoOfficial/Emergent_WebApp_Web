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
  ChevronDown, ChevronUp, SlidersHorizontal,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { canListOperators } from '@/utils/roleHelpers';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import GeocodePinRow from '@/components/shared/GeocodePinRow';
import { geocodeAddress } from '@/utils/geocode';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import ServicesToolbar from '@/components/management/banquet/ServicesToolbar';
import ServicesGrid from '@/components/management/banquet/ServicesGrid';
import ServiceDialog from '@/components/management/banquet/ServiceDialog';
import ServiceViewModal from '@/components/management/banquet/ServiceViewModal';
import RentalInventoryTab from '@/components/management/banquet/RentalInventoryTab';
import BulkActionsBar from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import ManagementShell from '@/components/management/shared/ManagementShell';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';

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
  { value: 'other',          label: 'Other Service (not Rental Item)', icon: Box,    accent: 'bg-slate-100 text-slate-700' },
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
  latitude: null,
  longitude: null,
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
  linked_inventory_id: '',
  refund_policy: null,
};

// ────────────────────────────────────────────────────────────────────
// Category-aware form. Only renders the fields that actually apply to
// the picked category — keeps the editor short and unambiguous.
//
// When `Rental Item` is picked, a `Linked Inventory Item` dropdown is
// required. If the operator has no inventory items yet, the rest of the
// form is greyed out and a banner prompts them to create one first
// (mirrors the Vehicles→Routes UX).
// ────────────────────────────────────────────────────────────────────
function CategoryAwareFields({ form, setForm, categoryOperators, inventoryItems, onCreateInventory }) {
  const cat = form.category || 'hall';
  const allowedModels = PRICING_MODELS_BY_CATEGORY[cat] || ['per_event'];
  const isRentalItem = cat === 'rental_item';
  // Local search box for the Linked Inventory dropdown so operators with
  // dozens of stock items don't have to scroll endlessly.
  const [inventorySearch, setInventorySearch] = useState('');
  // Filter inventory to operators the form already picked (or show all when no operator chosen yet).
  const scopedInventory = useMemo(() => {
    const base = !form.operator_id ? inventoryItems : inventoryItems.filter(it => it.operator_id === form.operator_id);
    if (!inventorySearch.trim()) return base;
    const q = inventorySearch.trim().toLowerCase();
    return base.filter(it => (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q));
  }, [inventoryItems, form.operator_id, inventorySearch]);
  const needsInventoryFirst = isRentalItem && scopedInventory.length === 0 && !inventorySearch.trim();
  const lockOtherFields = needsInventoryFirst;

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
            setForm(p => ({ ...p, category: v, pricing_model: next, linked_inventory_id: v === 'rental_item' ? p.linked_inventory_id : '' }));
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

      {/* ── Rental Item ⇄ Linked Inventory picker ───────────────────────
          Rental Item services MUST link to a banquet_items doc so stock
          tracking + return/damage lifecycle kick in. If the operator has
          no inventory yet, we grey-out the rest of the form and surface
          a banner with a one-click CTA to create the first item. */}
      {isRentalItem && (
        <div className="col-span-2">
          {needsInventoryFirst ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3" data-testid="rental-item-needs-inventory-banner">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
                  <Armchair className="w-5 h-5 text-amber-800" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">You need a Rental Inventory item first</p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Rental Item services track physical stock. Create an inventory item ({form.operator_id ? 'for this operator' : 'first pick an operator above'}), then link it here.
                  </p>
                  {form.operator_id && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={onCreateInventory}
                      className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="create-inventory-cta"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Create inventory item
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <Label className="flex items-center gap-1.5">
                Linked Rental Inventory <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={form.linked_inventory_id || ''}
                onValueChange={(v) => setForm(p => ({ ...p, linked_inventory_id: v }))}
              >
                <SelectTrigger data-testid="linked-inventory-select">
                  <SelectValue placeholder="Pick the inventory item this service rents out…" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-1.5 sticky top-0 bg-white z-10 border-b border-slate-100 mb-1">
                    <Input
                      autoFocus
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="Search inventory by name or category…"
                      className="h-8 text-xs"
                      data-testid="linked-inventory-search-input"
                      // Keep Radix Select from intercepting space / arrow keys
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {scopedInventory.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500 text-center">
                      No inventory matches “{inventorySearch}”.
                    </div>
                  )}
                  {scopedInventory.map(it => (
                    <SelectItem key={it.id} value={it.id}>
                      <span className="inline-flex items-center gap-2">
                        <Armchair className="w-3.5 h-3.5" />
                        {it.name} <span className="text-slate-500 text-xs">— {it.available_units || 0} / {it.total_units || 0} avail</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 mt-1">
                Stock is tracked in the Rental Inventory tab. The service&apos;s `base_price` is what customers pay; per-booking limits below.
              </p>
            </>
          )}
        </div>
      )}

      {/* All fields below are greyed out when a rental_item service has no
          linked inventory yet — forces the operator to set up stock first. */}
      <fieldset disabled={lockOtherFields} className={`col-span-2 ${lockOtherFields ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 gap-4">
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

      {/* hall-only: subtype */}
      {cat === 'hall' && (
        <div className="col-span-2">
          <Label>Venue Type</Label>
          <Select value={form.venue_type || 'hall'} onValueChange={v => setForm(p => ({ ...p, venue_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VENUE_SUBTYPES.map(v => (<SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Location — shown on EVERY category so live-maps + Banquet results
          can geo-tag each service (chairs delivered to Douala, photographer
          available in Yaoundé, etc.). Stored on `city` + `address`, with
          optional `latitude`/`longitude` pin set by the geocoder. */}
      <div>
        <Label>City</Label>
        <Input
          value={form.city}
          // Touching the city invalidates any previously-pinned coords so a
          // stale pin doesn't survive a relocation. Operator clicks Pin again
          // to refresh.
          onChange={e => setForm(p => ({ ...p, city: e.target.value, latitude: null, longitude: null }))}
          placeholder="Douala"
          data-testid="service-city-input"
        />
      </div>
      <div>
        <Label>Address / Pickup Point</Label>
        <Input
          value={form.address}
          onChange={e => setForm(p => ({ ...p, address: e.target.value, latitude: null, longitude: null }))}
          placeholder={cat === 'hall' ? 'Rue Joss, Douala' : 'Where this service operates or items are picked up'}
          data-testid="service-address-input"
        />
      </div>

      {/* ── Geocoder row — operator pins the exact venue on a map by hitting
            Nominatim. Stored on form.latitude / form.longitude and sent in
            the save payload so customer-facing maps zoom to the actual spot
            instead of the city centre. */}
      <div className="col-span-2">
        <GeocodePinRow
          city={form.city}
          address={form.address}
          latitude={form.latitude}
          longitude={form.longitude}
          onPin={({ lat, lon }) => setForm(p => ({ ...p, latitude: lat, longitude: lon }))}
          onClear={() => setForm(p => ({ ...p, latitude: null, longitude: null }))}
          testIdPrefix="banquet-form-geocode"
        />
      </div>

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

      {/* Listing-level refund policy override */}
      <div className="col-span-2 pt-3 border-t border-slate-200" data-testid="banquet-form-refund-policy">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Refund Policy <span className="text-slate-400 font-normal normal-case">(overrides operator default)</span>
        </Label>
        <div className="mt-2">
          <CancellationPolicyPicker
            serviceType="banquet"
            scope="listing"
            value={form.refund_policy}
            onChange={(v) => setForm(p => ({ ...p, refund_policy: v }))}
          />
        </div>
      </div>
        </div>
      </fieldset>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Packages tab — operator-built bundles
// ────────────────────────────────────────────────────────────────────
function PackagesTab({ services, scopeOperatorId, operators = [] }) {
  const { user } = useAuth();
  const isAdminOrSuper = user?.role === 'super_admin' || user?.role === 'admin';
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', services: [], discount_percent: 0, is_active: true,
    operator_id: '', operator_name: '',
    // Package-level location — overrides member-service locations on the
    // customer-facing live map (e.g. wedding bundle hosted in Yaoundé even
    // if individual services are based in Douala).
    city: '', address: '', latitude: null, longitude: null,
  });

  // Only services owned by the selected operator can be bundled — mirrors the
  // backend ownership check in /banquets/packages/.
  const eligibleServices = useMemo(() => {
    if (!form.operator_id) return services;
    return services.filter(s => s.operator_id === form.operator_id);
  }, [services, form.operator_id]);

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
    setForm({
      name: '', description: '', images: [], services: [], discount_percent: 0, is_active: true,
      // Default operator_id to the active scope so operators don't have to
      // pick it manually. Admin/super-admin can still override via the picker.
      operator_id: scopeOperatorId || '',
      operator_name: scopeOperatorId
        ? (operators.find(o => (o._id || o.id) === scopeOperatorId)?.name || '')
        : '',
      city: '', address: '', latitude: null, longitude: null,
    });
    setOpen(true);
  }

  function openEdit(pkg) {
    setEditing(pkg);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      images: Array.isArray(pkg.images) ? pkg.images : [],
      services: (pkg.services || []).map(s => ({ service_id: s.service_id, quantity: s.quantity || 1 })),
      discount_percent: pkg.discount_percent || 0,
      is_active: pkg.is_active !== false,
      operator_id: pkg.operator_id || '',
      operator_name: pkg.operator_name || '',
      city: pkg.city || '',
      address: pkg.address || '',
      latitude: typeof pkg.latitude === 'number' ? pkg.latitude : null,
      longitude: typeof pkg.longitude === 'number' ? pkg.longitude : null,
    });
    setOpen(true);
  }

  const save = async () => {
    if (!form.name || form.services.length === 0) {
      toast.error('Pick at least one service and give the package a name.');
      return;
    }
    // Admin/super-admin MUST explicitly pick an operator — otherwise the backend
    // 400s ("operator_id is required") on package creation. Operators have
    // operator_id auto-stamped from their JWT so this guard only fires for admins.
    if (isAdminOrSuper && !form.operator_id) {
      toast.error('Pick the operator that owns this package.');
      return;
    }
    try {
      // Silently geocode the package's own location when it has city/address
      // but no pin yet, so the customer-facing map can zoom to the bundle's
      // venue instead of bouncing between each member service.
      let { latitude, longitude } = form;
      if ((latitude == null || longitude == null) && (form.address || form.city)) {
        const queryParts = [form.address, form.city, 'Cameroon'].filter(Boolean).join(', ');
        const hit = await geocodeAddress(queryParts);
        if (hit) {
          latitude = hit.lat;
          longitude = hit.lon;
        }
      }
      const payload = {
        ...form,
        discount_percent: Number(form.discount_percent) || 0,
        // Send operator_id explicitly so admin-created packages aren't
        // orphaned (and so Edit re-saves preserve original ownership).
        operator_id: form.operator_id || undefined,
        city: form.city || null,
        address: form.address || null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      };
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
      const svc = eligibleServices.find(s => s.id === line.service_id) || services.find(s => s.id === line.service_id);
      if (!svc) return sum;
      return sum + (Number(svc.base_price) || 0) * (line.quantity || 1);
    }, 0);
  }, [form.services, eligibleServices, services]);
  const total = subtotal * (1 - (Number(form.discount_percent) || 0) / 100);

  return (
    <div className="space-y-4">
      {/* ── Subpage toolbar — single modal card strip ─────────────────── */}
      <Card className="border-slate-200 shadow-sm" data-testid="bq-mgmt-subpage-card-packages">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <PackageIcon className="h-4 w-4 text-[#082c59]" />
            <h2 className="text-sm font-semibold text-[#082c59]">Event Packages</h2>
            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 px-1.5 py-0">{packages.length}</Badge>
            <span className="hidden md:inline text-xs text-slate-500 ml-2">Bundle multiple services with an optional discount.</span>
          </div>
          <PermissionGate permission="banquets.create">
            <Button onClick={openCreate} className="bg-[#082c59] h-8" size="sm" data-testid="add-package-btn">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Package
            </Button>
          </PermissionGate>
        </div>
      </Card>

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

            {/* ── Package-level location ──
                Even though each member service has its own city/address, the
                bundle itself happens at ONE venue (a wedding hall, a hotel
                garden, etc.). We capture that here so the customer-facing
                live map shows the package's actual location instead of pin-
                hopping between member services. Member services keep their
                own locations on their own pages. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Event City</Label>
                <Input
                  value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value, latitude: null, longitude: null }))}
                  placeholder="Douala"
                  data-testid="banquet-package-city-input"
                />
              </div>
              <div>
                <Label>Event Venue / Address</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value, latitude: null, longitude: null }))}
                  placeholder="Where the bundle gets delivered"
                  data-testid="banquet-package-address-input"
                />
              </div>
            </div>
            <GeocodePinRow
              city={form.city}
              address={form.address}
              latitude={form.latitude}
              longitude={form.longitude}
              onPin={({ lat, lon }) => setForm(p => ({ ...p, latitude: lat, longitude: lon }))}
              onClear={() => setForm(p => ({ ...p, latitude: null, longitude: null }))}
              testIdPrefix="banquet-package-geocode"
              helperText="No pin yet — the package map will fall back to the bundle’s city centre, then to its member services."
            />

            {/* Operator picker — admin/super-admin must scope packages to an
                operator (the backend requires operator_id). Operators have it
                auto-stamped from their JWT so this section is hidden. */}
            {isAdminOrSuper && (
              <div>
                <OperatorSelector
                  value={form.operator_id || ''}
                  onChange={(id, name) => setForm(p => ({
                    ...p, operator_id: id, operator_name: name,
                    // Drop services that don't belong to the newly-picked
                    // operator so the backend ownership check stays happy.
                    services: (p.services || []).filter(s => {
                      const svc = services.find(x => x.id === s.service_id);
                      return !svc || svc.operator_id === id;
                    }),
                  }))}
                  operators={operators}
                  testId="banquet-package-operator-selector"
                />
                {!form.operator_id && (
                  <p className="text-xs text-amber-600 mt-1">Pick the operator that owns this package — bundles can only mix services from a single operator.</p>
                )}
              </div>
            )}

            <div>
              <Label>Package photos</Label>
              <MiniImageUploader
                images={form.images || []}
                onChange={(imgs) => setForm(p => ({ ...p, images: imgs }))}
                max={5}
                folder="banquet_packages"
                accent="pink"
                helperText="Up to 5 photos shown in the customer-facing package modal (swipeable gallery)."
              />
            </div>
            <div>
              <Label>Services in this bundle</Label>
              <div className="mt-2 space-y-2 max-h-72 overflow-y-auto border rounded-md p-2 bg-slate-50/50">
                {eligibleServices.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    {isAdminOrSuper && !form.operator_id
                      ? 'Pick an operator above to load their services.'
                      : 'Add some services first — they\u2019ll show up here.'}
                  </p>
                ) : eligibleServices.map(svc => {
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

  // Bulk selection on the visible page (card grid wires checkboxes via
  // BulkSelectCardWrapper inside <ServicesGrid bulk={…} />).
  const banquetBulk = useBulkSelection(paged, { idKey: 'id' });
  const _banquetBulkRun = async (action, ids) => {
    await api.post('/admin/bulk', { collection: 'banquets', action, ids });
    if (typeof loadServices === 'function') await loadServices();
  };
  const bulkBanquetDelete     = (ids) => _banquetBulkRun('delete', ids);
  const bulkBanquetActivate   = (ids) => _banquetBulkRun('activate', ids);
  const bulkBanquetDeactivate = (ids) => _banquetBulkRun('deactivate', ids);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/banquets/management/my-venues${params}`);
      setServices(res.data.venues || res.data.banquets || []);
      if (canListOperators(user)) {
        try {
          const opRes = await api.get('/operators/');
          setOperators(opRes.data.operators || opRes.data || []);
        } catch { /* silent */ }
      }
    } catch (err) {
      console.error(err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId, user]);

  useEffect(() => { loadServices(); }, [loadServices]);

  // Operators relevant to the *currently picked category* in the modal.
  // Refetched whenever the operator opens the modal or flips the
  // category dropdown — so the selector only shows operators who
  // actually offer this kind of service.
  const [categoryOperators, setCategoryOperators] = useState([]);
  // Inventory items the linked-inventory dropdown can pick from.
  const [inventoryItems, setInventoryItems] = useState([]);
  const loadInventory = useCallback(async () => {
    try {
      const params = scopeOperatorId ? { operator_id: scopeOperatorId, is_active: true } : { is_active: true };
      const res = await api.get('/inventory/banquet-items', { params });
      setInventoryItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to load inventory items:', err);
      setInventoryItems([]);
    }
  }, [scopeOperatorId]);
  useEffect(() => { loadInventory(); }, [loadInventory]);
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
        linked_inventory_id: svc.linked_inventory_id || '',
        latitude: typeof svc.latitude === 'number' ? svc.latitude : (svc.location?.lat ?? null),
        longitude: typeof svc.longitude === 'number' ? svc.longitude : (svc.location?.lon ?? null),
        refund_policy: svc.refund_policy || null,
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
      // Auto-geocode silently when we have an address/city but no pin yet.
      // Operator can still click "Pin on Map" manually for finer control;
      // this just makes sure new venues are never created without coords.
      let { latitude, longitude } = form;
      if ((latitude == null || longitude == null) && (form.address || form.city)) {
        const queryParts = [form.address, form.city, 'Cameroon'].filter(Boolean).join(', ');
        const hit = await geocodeAddress(queryParts);
        if (hit) {
          latitude = hit.lat;
          longitude = hit.lon;
        }
      }
      const op = (categoryOperators.length ? categoryOperators : operators).find(o => (o._id || o.id) === form.operator_id);
      const payload = {
        category: form.category,
        pricing_model: form.pricing_model,
        name: form.name,
        description: form.description,
        venue_type: form.category === 'hall' ? form.venue_type : null,
        address: form.address || null,
        city: form.city || null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
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
        linked_inventory_id: form.linked_inventory_id || null,
        refund_policy: form.refund_policy || null,
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
    <>
    <ManagementShell
      title="Banquet & Event Services"
      icon={PartyPopper}
      subtitle="Halls, chairs & cutlery, canopies, photographers and event packages — all in one place."
      scopeFilter={<OperatorScopeFilter serviceType="banquet" value={scopeOperatorId} onChange={setScopeOperatorId} />}
      onRefresh={loadServices}
      refreshing={loading}
      tabs={[
        { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { value: 'management', label: 'Services', icon: Layers, testId: 'services-tab' },
        { value: 'rentals', label: 'Rental Inventory', icon: Armchair, testId: 'rentals-tab' },
        { value: 'packages', label: 'Packages', icon: PackageIcon, testId: 'packages-tab' },
        { value: 'communications', label: 'Communications', icon: MessageSquare },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      filterActive={activeTab === 'management' && !!(search || categoryFilter !== 'all')}
      activeTabLabelOverrides={{ management: 'Services' }}
      testIdPrefix="bq-mgmt"
    >
        <TabsContent value="dashboard" className="mt-0">
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

        <TabsContent value="management" className="mt-0 space-y-4">
          <ServicesToolbar
            count={filtered.length}
            search={search}
            onSearch={setSearch}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            categories={CATEGORIES}
            onAdd={() => openDialog()}
          />

          <ServicesGrid
            services={paged}
            hasFilters={!!(search || categoryFilter !== 'all')}
            viewMode={viewMode}
            categoryByValue={CATEGORY_BY_VALUE}
            pricingLabel={PRICING_LABEL}
            loading={loading}
            onView={handleView}
            onEdit={openDialog}
            onDelete={handleDelete}
            bulk={banquetBulk}
          />

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
          <PackagesTab services={services} scopeOperatorId={scopeOperatorId} operators={operators} />
        </TabsContent>

        <TabsContent value="rentals" className="mt-6">
          <RentalInventoryTab operators={operators} scopeOperatorId={scopeOperatorId} />
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
    </ManagementShell>

      {/* Add / Edit Service modal — extracted to /components/management/banquet/ServiceDialog.jsx */}
      <ServiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editing={editing}
        form={form}
        previewMeta={previewMeta}
        pricingLabel={PRICING_LABEL}
        leftColumn={
          <CategoryAwareFields
            form={form}
            setForm={setForm}
            categoryOperators={categoryOperators}
            inventoryItems={inventoryItems}
            onCreateInventory={() => {
              setIsDialogOpen(false);
              setActiveTab('rentals');
              toast.info('Create your inventory item, then re-open the Service form to link it.');
            }}
          />
        }
        onSubmit={handleSave}
      />

      {/* View Service modal — extracted to /components/management/banquet/ServiceViewModal.jsx */}
      <ServiceViewModal
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        viewing={viewing}
        categoryByValue={CATEGORY_BY_VALUE}
        pricingLabel={PRICING_LABEL}
        onEdit={openDialog}
      />

      <BulkActionsBar
        count={banquetBulk.count}
        entityLabel="service"
        selectedIds={banquetBulk.selectedIds}
        selectedRows={banquetBulk.selectedRows}
        onClear={banquetBulk.clear}
        onDelete={bulkBanquetDelete}
        onActivate={bulkBanquetActivate}
        onDeactivate={bulkBanquetDeactivate}
        onExport={(rows) => rows.map(s => ({
          id: s.id, name: s.name, category: s.category, city: s.city,
          capacity_min: s.capacity_min, capacity_max: s.capacity_max,
          base_price: s.base_price, operator: s.operator_name || '',
        }))}
      />
    </>
  );
}
