// Banquet & Event Services — customer browsing page.
//
// Customers arrive here from `/services/banquet` (the search form) with
// `city`, `event_date`, `guests` in the query string. The page then lists
// available services across all categories AND the operator-built
// packages. Customers add multiple services to an event cart (one date
// per cart) and checkout in a single transaction.
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin, Users, ArrowLeft, Loader2, PartyPopper, Plus, Minus, Package as PackageIcon,
  Building2, Armchair, TentTree, Camera, Video, UtensilsCrossed, Sparkles, Music2, Box, Calendar,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useEventCart } from '@/hooks/useEventCart';
import EventCartDrawer from '@/components/banquet/EventCartDrawer';

const CATEGORIES = [
  { value: 'all',            label: 'All',              icon: Sparkles },
  { value: 'hall',           label: 'Halls',            icon: Building2 },
  { value: 'rental_item',    label: 'Rental Items',     icon: Armchair },
  { value: 'canopy',         label: 'Canopies',         icon: TentTree },
  { value: 'photographer',   label: 'Photographers',    icon: Camera },
  { value: 'videographer',   label: 'Videographers',    icon: Video },
  { value: 'catering',       label: 'Catering',         icon: UtensilsCrossed },
  { value: 'decoration',     label: 'Decoration',       icon: Sparkles },
  { value: 'sound_lighting', label: 'Sound & Lighting', icon: Music2 },
  { value: 'other',          label: 'Other',            icon: Box },
];

const CATEGORY_META = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const PRICING_SUFFIX = {
  per_event:  'flat',
  per_person: 'per person',
  per_hour:   'per hour',
  per_unit:   '',  // shown alongside unit label
  flat_fee:   'flat',
};

// Category-specific card. Hall = big image card; rental_item = compact qty card; talent = portrait.
function ServiceCard({ svc, inCart, qtyInCart, onAdd, onSetQty }) {
  const meta = CATEGORY_META[svc.category] || CATEGORY_META.other;
  const Icon = meta.icon;
  const placeholder = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600';
  const image = svc.images?.[0] || placeholder;

  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all" data-testid={`service-card-${svc.id}`}>
      <div className="h-44 relative overflow-hidden">
        <img src={image} alt={svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/95 text-purple-700 font-medium">
            <Icon className="w-3 h-3 mr-1" />
            {meta.label}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-bold text-slate-900 leading-tight line-clamp-1">{svc.name}</h3>
        <div className="text-xs text-slate-500 flex items-center gap-3">
          {svc.city && (<span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{svc.city}</span>)}
          {svc.capacity_max && (<span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />Up to {svc.capacity_max}</span>)}
          {svc.unit_label && (<span>per {svc.unit_label}</span>)}
        </div>
        <div className="flex items-baseline justify-between pt-2">
          <div>
            <div className="text-xl font-bold text-purple-700">{formatFCFA(svc.base_price || 0)}</div>
            <div className="text-xs text-slate-500">{svc.unit_label ? `/ ${svc.unit_label}` : PRICING_SUFFIX[svc.pricing_model] || ''}</div>
          </div>
          {inCart ? (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onSetQty(Math.max(1, qtyInCart - 1))}>
                <Minus className="w-3 h-3" />
              </Button>
              <Input
                type="number"
                value={qtyInCart}
                onChange={(e) => onSetQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 h-8 text-center"
                min="1"
                data-testid={`qty-input-${svc.id}`}
              />
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onSetQty(qtyInCart + 1)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button onClick={onAdd} className="bg-purple-600 hover:bg-purple-700" size="sm" data-testid={`add-to-cart-${svc.id}`}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PackageCard({ pkg, inCart, onAdd, onRemove }) {
  return (
    <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white rounded-2xl shadow-md hover:shadow-lg transition-all" data-testid={`package-card-${pkg.id}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PackageIcon className="w-5 h-5 text-purple-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Bundle</span>
          </div>
          {pkg.discount_percent > 0 && (
            <Badge className="bg-rose-600 text-white">−{pkg.discount_percent}% OFF</Badge>
          )}
        </div>
        <h3 className="font-bold text-slate-900 text-lg leading-tight">{pkg.name}</h3>
        {pkg.description && <p className="text-sm text-slate-600 line-clamp-2">{pkg.description}</p>}
        <div className="text-xs text-slate-500 space-y-1 pt-1 border-t">
          {(pkg.services || []).slice(0, 4).map((line, i) => (
            <div key={i} className="flex justify-between">
              <span>{line.service_name || line.service_id}</span>
              <span>× {line.quantity}</span>
            </div>
          ))}
          {(pkg.services?.length || 0) > 4 && (
            <div className="text-purple-600 italic">+ {pkg.services.length - 4} more</div>
          )}
        </div>
        <div className="flex items-baseline justify-between pt-2">
          <div>
            {pkg.discount_percent > 0 && (
              <div className="text-xs text-slate-400 line-through">{formatFCFA(pkg.subtotal || 0)}</div>
            )}
            <div className="text-2xl font-bold text-purple-700">{formatFCFA(pkg.total_price || 0)}</div>
          </div>
          {inCart ? (
            <Button onClick={onRemove} variant="outline" className="border-rose-400 text-rose-600" data-testid={`remove-package-${pkg.id}`}>
              Remove
            </Button>
          ) : (
            <Button onClick={onAdd} className="bg-purple-600 hover:bg-purple-700" data-testid={`add-package-${pkg.id}`}>
              <Plus className="w-4 h-4 mr-1" /> Add Bundle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BanquetResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cartApi = useEventCart();
  const { cart, setMeta, addItem, updateQty, removeItem, addPackage, removePackage, totals, count, clear } = cartApi;

  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const city = searchParams.get('city') || '';
  const eventDate = searchParams.get('event_date') || cart.event_date || '';
  const guests = parseInt(searchParams.get('guests')) || cart.expected_guests || 0;
  const eventType = searchParams.get('type') || '';

  // Persist the search params into the cart so the drawer + checkout see them.
  useEffect(() => {
    const updates = {};
    if (eventDate && eventDate !== cart.event_date) updates.event_date = eventDate;
    if (city && city !== cart.city) updates.city = city;
    if (guests && guests !== cart.expected_guests) updates.expected_guests = guests;
    if (eventType && eventType !== cart.event_type) updates.event_type = eventType;
    if (Object.keys(updates).length) setMeta(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDate, city, guests, eventType]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [svcRes, pkgRes] = await Promise.all([
          api.get('/banquets/', { params: { city, limit: 100 } }),
          api.get('/banquets/packages/', { params: { is_active: true, limit: 50 } }).catch(() => ({ data: { packages: [] } })),
        ]);
        setServices(svcRes.data.banquets || svcRes.data.venues || []);
        setPackages(pkgRes.data.packages || []);
      } catch (err) {
        console.error(err);
        setServices([]);
        setPackages([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [city]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (categoryTab !== 'all') list = list.filter(s => (s.category || 'hall') === categoryTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [services, categoryTab, searchQuery]);

  const qtyOf = (svcId) => cart.items.find(i => i.service_id === svcId)?.quantity || 0;
  const isPkgInCart = (pkgId) => !!cart.packages.find(p => p.package_id === pkgId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding services for your event…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/banquet')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-purple-600" />
              Banquet & Event Services
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 items-center text-sm text-slate-600">
            {city && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{city}</span>}
            {eventDate && <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" />{eventDate}</span>}
            {guests > 0 && <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{guests} guests</span>}
          </div>
          <Input
            placeholder="Search services by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-3 max-w-md"
            data-testid="services-search-input"
          />
        </div>

        {/* Category tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-3 overflow-x-auto">
          <Tabs value={categoryTab} onValueChange={setCategoryTab}>
            <TabsList className="bg-transparent flex flex-nowrap gap-1 h-auto p-0">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const n = c.value === 'all' ? services.length : services.filter(s => (s.category || 'hall') === c.value).length;
                return (
                  <TabsTrigger
                    key={c.value}
                    value={c.value}
                    className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-full px-4 py-2 text-sm whitespace-nowrap"
                    data-testid={`tab-${c.value}`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {c.label}
                    {n > 0 && <span className="ml-2 text-[10px] opacity-70">{n}</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Packages first — they're the headline offer */}
        {packages.length > 0 && categoryTab === 'all' && (
          <section data-testid="packages-section">
            <div className="flex items-center gap-2 mb-4">
              <PackageIcon className="w-5 h-5 text-purple-700" />
              <h2 className="text-lg font-bold text-slate-900">Curated Bundles</h2>
              <Badge className="bg-purple-100 text-purple-700">Save more</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  inCart={isPkgInCart(pkg.id)}
                  onAdd={() => addPackage(pkg)}
                  onRemove={() => removePackage(pkg.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Services grid */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {categoryTab === 'all' ? 'All services' : CATEGORY_META[categoryTab]?.label}
            <span className="ml-2 text-sm font-normal text-slate-500">({filteredServices.length})</span>
          </h2>
          {filteredServices.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No services match your filters. Try a different category or search term.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map(svc => {
                const q = qtyOf(svc.id);
                return (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    inCart={q > 0}
                    qtyInCart={q}
                    onAdd={() => addItem(svc, svc.min_quantity || 1)}
                    onSetQty={(n) => updateQty(svc.id, n)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <EventCartDrawer
        cart={cart}
        updateQty={updateQty}
        removeItem={removeItem}
        removePackage={removePackage}
        totals={totals}
        count={count}
        clear={clear}
      />
    </div>
  );
}
