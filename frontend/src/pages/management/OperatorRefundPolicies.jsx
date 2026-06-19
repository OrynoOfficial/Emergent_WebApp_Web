// Refund Policies management — works for both operators AND admins.
//
// Operator scope (role=operator):
//   - Page is automatically pinned to the user's own operator
//   - SERVICE_CATALOG is filtered to only the categories the operator
//     actually offers (operator.service_types). Showing all 9 was misleading.
//
// Admin / Super-admin scope:
//   - Top selector lets them switch between:
//       1) "Platform default" — the fallback policy for every service category
//       2) Any individual operator — to edit their per-service overrides
//   - All edits propagate via the same picker → simply route to the right
//     backend endpoint (refunds/platform-defaults vs operators/{id}/refund-policies).
//
// Resolution order at refund time:
//   Listing override > Operator default > Platform default > Hardcoded preset
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings as SettingsIcon, Hotel, Bus, Car, Utensils, Calendar, Film, Sparkles, Package, Shirt, Save, Globe, Building2 } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';
import { useAuth } from '@/contexts/AuthContext';

const SERVICE_CATALOG = [
  { key: 'hotel',      label: 'Hotels',       icon: Hotel,     accent: 'pink',     tagline: 'Bookings, rooms, nights' },
  { key: 'travel',     label: 'Travel',       icon: Bus,       accent: 'blue',     tagline: 'Routes, schedules, seats' },
  { key: 'car_rental', label: 'Car Rentals',  icon: Car,       accent: 'emerald',  tagline: 'Vehicles, daily rentals' },
  { key: 'restaurant', label: 'Restaurants',  icon: Utensils,  accent: 'amber',    tagline: 'Reservations, dining' },
  { key: 'event',      label: 'Events',       icon: Calendar,  accent: 'orange',   tagline: 'Showtimes, concerts' },
  { key: 'cinema',     label: 'Cinema',       icon: Film,      accent: 'indigo',   tagline: 'Movie screenings' },
  { key: 'banquet',    label: 'Banquet',      icon: Sparkles,  accent: 'teal',     tagline: 'Halls, services, packages' },
  { key: 'laundry',    label: 'Laundry',      icon: Shirt,     accent: 'sky',      tagline: 'Pick-up & delivery' },
  { key: 'package',    label: 'Packages',     icon: Package,   accent: 'violet',   tagline: 'Bundled services' },
];

const accentText = {
  pink: 'text-pink-600 bg-pink-50',
  blue: 'text-blue-600 bg-blue-50',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  orange: 'text-orange-600 bg-orange-50',
  indigo: 'text-indigo-600 bg-indigo-50',
  teal: 'text-teal-600 bg-teal-50',
  sky: 'text-sky-600 bg-sky-50',
  violet: 'text-violet-600 bg-violet-50',
};

// service_types stored on operators use multiple slug variants — normalise
// them to the catalog keys so a row like `['events', 'banquets']` maps to
// `{event, banquet}`.
const SERVICE_TAG_ALIASES = {
  hotel: 'hotel', hotels: 'hotel',
  travel: 'travel',
  car_rental: 'car_rental', 'car-rental': 'car_rental', car_rentals: 'car_rental',
  restaurant: 'restaurant', restaurants: 'restaurant', catering: 'restaurant',
  event: 'event', events: 'event',
  cinema: 'cinema', cinemas: 'cinema',
  banquet: 'banquet', banquets: 'banquet',
  laundry: 'laundry', pressing: 'laundry', pressings: 'laundry',
  package: 'package', packages: 'package', logistics: 'package',
};

const normalizeServiceTypes = (raw) => {
  const set = new Set();
  for (const tag of raw || []) {
    const k = SERVICE_TAG_ALIASES[String(tag).toLowerCase().trim()];
    if (k) set.add(k);
  }
  return set;
};

export default function OperatorRefundPolicies() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const ownOperatorId = user?.operator_id || user?.operatorId;

  // Selector state — for admins this drives which scope is shown.
  // Value is either '__platform__' or an operator_id.
  const [scopeId, setScopeId] = useState(isAdmin ? '__platform__' : ownOperatorId || '');
  const [operators, setOperators] = useState([]);

  const [byService, setByService] = useState({});
  const [allowedServiceTypes, setAllowedServiceTypes] = useState(null); // null = show all
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(null);

  // For admins — load the operator list once so the selector can render.
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/operators')
      .then(r => setOperators(r.data?.operators || r.data || []))
      .catch(() => setOperators([]));
  }, [isAdmin]);

  // Re-fetch policies whenever the selected scope changes.
  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      if (scopeId === '__platform__') {
        const r = await api.get('/refunds/platform-defaults');
        setByService(r.data?.by_service || {});
        setAllowedServiceTypes(null); // platform default covers every category
      } else if (scopeId) {
        const r = await api.get(`/operators/${scopeId}/refund-policies`);
        setByService(r.data?.by_service || {});
        // Scope visible categories to operator.service_types when known.
        const opRow = operators.find(o => o._id === scopeId || o.id === scopeId);
        if (opRow?.service_types?.length) {
          setAllowedServiceTypes(normalizeServiceTypes(opRow.service_types));
        } else if (!isAdmin) {
          // Operator-self path: opRow may not be in the loaded list — fetch.
          const me = await api.get(`/operators/${scopeId}`).catch(() => null);
          const types = me?.data?.service_types || me?.data?.operator?.service_types || [];
          setAllowedServiceTypes(types.length ? normalizeServiceTypes(types) : null);
        } else {
          setAllowedServiceTypes(null);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load policies');
    } finally {
      setLoading(false);
    }
  }, [scopeId, operators, isAdmin]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const savePolicy = async (serviceKey, policy) => {
    setSavingService(serviceKey);
    try {
      const payload = policy
        ? { preset: policy.preset, custom_tiers: policy.custom_tiers || [] }
        : { preset: null };
      if (scopeId === '__platform__') {
        await api.put(`/refunds/platform-defaults/${serviceKey}`, payload);
      } else {
        await api.put(`/operators/${scopeId}/refund-policies/${serviceKey}`, payload);
      }
      setByService(prev => {
        const next = { ...prev };
        if (policy) next[serviceKey] = policy;
        else delete next[serviceKey];
        return next;
      });
      toast.success(policy ? `${serviceKey} → ${policy.preset}` : `Reverted ${serviceKey} to default`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingService(null);
    }
  };

  const visibleCatalog = useMemo(() => {
    if (!allowedServiceTypes) return SERVICE_CATALOG;
    return SERVICE_CATALOG.filter(s => allowedServiceTypes.has(s.key));
  }, [allowedServiceTypes]);

  const configuredCount = useMemo(() => Object.keys(byService).length, [byService]);

  if (!isAdmin && !ownOperatorId) {
    return (
      <div className="p-6 text-center">
        <SettingsIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Sign in as an operator to manage refund policies.</p>
      </div>
    );
  }

  const isPlatformScope = scopeId === '__platform__';
  const selectedOp = operators.find(o => (o._id || o.id) === scopeId);

  return (
    <div className="space-y-6" data-testid="operator-refund-policies-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-700" />
            Refund Policies
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
            {isPlatformScope
              ? 'Platform-wide default cancellation policy per service category. Operators inherit these unless they configure their own override below.'
              : 'Set the default cancellation policy for each service category. Individual listings can still override these in their own editor.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{configuredCount}/{visibleCatalog.length} configured</span>
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold">
            Listing → Operator → Platform
          </span>
        </div>
      </div>

      {/* Admin / super-admin: scope selector */}
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl p-3" data-testid="policy-scope-selector">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</span>
          <Select value={scopeId} onValueChange={setScopeId}>
            <SelectTrigger className="w-80 bg-white" data-testid="policy-scope-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white max-h-80">
              <SelectItem value="__platform__">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium">Platform default</span>
                </div>
              </SelectItem>
              {operators.map(op => (
                <SelectItem key={op._id || op.id} value={op._id || op.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{op.name}</span>
                    {op.service_types?.length ? (
                      <span className="text-[10px] text-slate-400 ml-1">· {op.service_types.slice(0, 3).join(', ')}</span>
                    ) : null}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isPlatformScope && selectedOp && (
            <span className="text-xs text-slate-500">
              {selectedOp.service_types?.length
                ? `Showing ${selectedOp.service_types.length} service categor${selectedOp.service_types.length === 1 ? 'y' : 'ies'} this operator offers.`
                : 'This operator has no service types configured — showing all categories.'}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : visibleCatalog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center" data-testid="policies-empty-state">
          <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-700">No service categories assigned</h3>
          <p className="text-sm text-slate-500 mt-1">
            This operator does not offer any services yet. Assign service categories from the operator profile, then come back here to set their refund policies.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {visibleCatalog.map(svc => {
            const Icon = svc.icon;
            const currentPolicy = byService[svc.key] || null;
            const isCustomised = !!currentPolicy;
            return (
              <Card key={svc.key} data-testid={`refund-policy-card-${svc.key}`} className="p-5 bg-white border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accentText[svc.accent]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{svc.label}</h3>
                      <p className="text-xs text-slate-500">{svc.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingService === svc.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCustomised ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isCustomised ? `Custom: ${currentPolicy.preset}` : (isPlatformScope ? 'Unset' : 'Inherits default')}
                    </span>
                  </div>
                </div>

                <CancellationPolicyPicker
                  serviceType={svc.key}
                  scope={isPlatformScope ? 'platform' : 'operator'}
                  value={currentPolicy}
                  onChange={(next) => savePolicy(svc.key, next)}
                  compact
                />
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer help */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="flex items-start gap-2">
          <Save className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-semibold text-slate-700">Auto-save</span> — changes are persisted immediately.
            New bookings will use the policy in effect when the refund is requested.
          </span>
        </p>
      </div>
    </div>
  );
}
