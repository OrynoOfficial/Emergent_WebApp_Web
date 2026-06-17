// Operator-level Refund Policies management.
//
// One screen lets an operator set their **default** cancellation policy
// (Strict / Standard / Flexible / Custom-via-API) per service category they
// offer. Each individual listing can still override via the inline picker
// on its editor — but this screen handles the bulk-default case so ops
// don't have to touch 50+ hotels one by one.
//
// Resolution order at refund time:
//   Listing override > Operator default (this screen) > Platform default
import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Settings as SettingsIcon, Hotel, Bus, Car, Utensils, Calendar, Film, Sparkles, Package, Shirt, Save } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';
import { useAuth } from '@/contexts/AuthContext';

// Display config for every service type the platform supports. Icons + accent
// colours match the rest of the management UI so this feels native.
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

export default function OperatorRefundPolicies() {
  const { user } = useAuth();
  const operatorId = user?.operator_id || user?.operatorId;
  const [byService, setByService] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(null);

  useEffect(() => {
    if (!operatorId) {
      setLoading(false);
      return;
    }
    api.get(`/operators/${operatorId}/refund-policies`)
      .then(r => setByService(r.data?.by_service || {}))
      .catch(err => toast.error(err.response?.data?.detail || 'Could not load policies'))
      .finally(() => setLoading(false));
  }, [operatorId]);

  const savePolicy = async (serviceKey, policy) => {
    if (!operatorId) return;
    setSavingService(serviceKey);
    try {
      // `policy === null` clears the override and falls back to platform default
      const payload = policy
        ? { preset: policy.preset, custom_tiers: policy.custom_tiers || [] }
        : { preset: null };
      await api.put(`/operators/${operatorId}/refund-policies/${serviceKey}`, payload);
      // Mirror local state to match what we just persisted
      setByService(prev => {
        const next = { ...prev };
        if (policy) next[serviceKey] = policy;
        else delete next[serviceKey];
        return next;
      });
      toast.success(policy ? `${serviceKey} → ${policy.preset}` : `Reverted ${serviceKey} to platform default`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingService(null);
    }
  };

  const configuredCount = useMemo(() => Object.keys(byService).length, [byService]);

  if (!operatorId) {
    return (
      <div className="p-6 text-center">
        <SettingsIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Sign in as an operator to manage refund policies.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="operator-refund-policies-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-700" />
            Refund Policies
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set the default cancellation policy for each of your service categories.
            Individual listings can still override these in their own editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{configuredCount}/{SERVICE_CATALOG.length} services customised</span>
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold">
            Resolution: Listing → Operator → Platform
          </span>
        </div>
      </div>

      {/* One card per service category */}
      <div className="grid lg:grid-cols-2 gap-6">
        {SERVICE_CATALOG.map(svc => {
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
                    {isCustomised ? `Custom: ${currentPolicy.preset}` : 'Platform default'}
                  </span>
                </div>
              </div>

              <CancellationPolicyPicker
                serviceType={svc.key}
                scope="operator"
                value={currentPolicy}
                onChange={(next) => savePolicy(svc.key, next)}
                compact
              />
            </Card>
          );
        })}
      </div>

      {/* Footer help */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="flex items-start gap-2">
          <Save className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-semibold text-slate-700">Auto-save</span> — changes are persisted immediately to your operator profile.
            New bookings on existing or future listings will use the policy in effect at the moment the refund is requested.
          </span>
        </p>
      </div>
    </div>
  );
}
