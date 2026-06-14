// Banquet & Event Services — customer browsing page (Laundry-style polish).
//
// Customers arrive here from `/services/banquet`. Date is collected at
// checkout (mirrors the Laundry flow). Cards are swipeable + clickable;
// all filters are consolidated into a single "Filter" popover next to the
// search bar. Theme is rose/pink — the official banquet colour.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import {
  MapPin, Users, ArrowLeft, Loader2, PartyPopper, Plus, Minus, Package as PackageIcon,
  Building2, Armchair, TentTree, Camera, Video, UtensilsCrossed, Sparkles, Music2, Box,
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ShoppingBag,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useEventCart } from '@/hooks/useEventCart';
import EventCartDrawer from '@/components/banquet/EventCartDrawer';
import BanquetDetailsModal from '@/components/banquet/BanquetDetailsModal';

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
  per_event: 'flat', per_person: '/ person', per_hour: '/ hour',
  per_unit: '', flat_fee: 'flat',
};
const PLACEHOLDER = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800';

// ── Swipeable images on cards ───────────────────────────────────────────────
function SwipeableImages({ images, name, height = 'h-44' }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const safe = images && images.length > 0 ? images : [PLACEHOLDER];
  const scrollTo = (i, e) => {
    e?.stopPropagation();
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    ref.current.scrollTo({ left: w * i, behavior: 'smooth' });
    setIdx(i);
  };
  const onScroll = () => {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    setIdx(Math.round(ref.current.scrollLeft / w));
  };
  return (
    <div className={`relative ${height} group overflow-hidden`}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {safe.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full snap-center">
            <img src={src} alt={`${name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {safe.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => scrollTo(Math.max(0, idx - 1), e)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow transition flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-teal-700" />
          </button>
          <button
            type="button"
            onClick={(e) => scrollTo(Math.min(safe.length - 1, idx + 1), e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow transition flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-teal-700" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {safe.map((_, i) => (
              <button
                key={i}
                onClick={(e) => scrollTo(i, e)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/60 w-1.5'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Service card ────────────────────────────────────────────────────────────
function ServiceCard({ svc, inCart, qtyInCart, onAdd, onSetQty, onOpenDetails }) {
  const meta = CATEGORY_META[svc.category] || CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <Card
      className="group overflow-hidden bg-white rounded-2xl border border-teal-100/60 shadow-md hover:shadow-xl hover:border-teal-300 transition-all cursor-pointer"
      onClick={onOpenDetails}
      data-testid={`service-card-${svc.id}`}
    >
      <div className="relative">
        <SwipeableImages images={svc.images} name={svc.name} height="h-48" />
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-white/95 text-teal-700 font-medium shadow-sm">
            <Icon className="w-3 h-3 mr-1" /> {meta.label}
          </Badge>
        </div>
        {inCart && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-emerald-500 text-white border-0 shadow-md" data-testid={`in-cart-tag-${svc.id}`}>
              <Sparkles className="w-3 h-3 mr-1" /> In Cart · {qtyInCart}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2.5">
        <h3 className="font-bold text-slate-900 leading-tight line-clamp-1">{svc.name}</h3>

        {svc.description && (
          <p className="text-xs text-slate-600 line-clamp-2">{svc.description}</p>
        )}

        {(svc.address || svc.city) && (
          <div className="flex items-start gap-2 rounded-lg bg-teal-50/70 px-2.5 py-1.5 border border-teal-100">
            <MapPin className="w-3.5 h-3.5 text-teal-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{svc.address || svc.city}</p>
              {svc.address && svc.city && <p className="text-[10px] text-teal-700 font-medium">{svc.city}</p>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
          {svc.capacity_max != null && (
            <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
              <Users className="w-3 h-3 text-teal-700" /> {svc.capacity_min || 0}–{svc.capacity_max} guests
            </span>
          )}
          {svc.duration_hours && (
            <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
              <Box className="w-3 h-3 text-teal-700" /> {svc.duration_hours}h
            </span>
          )}
          {svc.unit_label && (
            <span className="inline-flex items-center gap-1 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
              <Box className="w-3 h-3 text-teal-700" /> per {svc.unit_label}{svc.min_quantity ? ` (min ${svc.min_quantity})` : ''}
            </span>
          )}
        </div>

        {/* Amenity preview (mostly halls) */}
        {Array.isArray(svc.amenities) && svc.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {svc.amenities.slice(0, 3).map(a => (
              <Badge key={a} variant="outline" className="text-[10px] font-normal py-0 px-1.5 bg-white border-teal-200 text-teal-700 capitalize">
                {String(a).replace(/_/g, ' ')}
              </Badge>
            ))}
            {svc.amenities.length > 3 && (
              <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-slate-500">+{svc.amenities.length - 3}</Badge>
            )}
          </div>
        )}

        <div className="flex items-end justify-between pt-2 border-t border-teal-100/60">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</div>
            <div className="text-xl font-bold text-teal-700 leading-tight">{formatFCFA(svc.base_price || 0)}</div>
            <div className="text-[11px] text-slate-500">{svc.unit_label ? `/ ${svc.unit_label}` : PRICING_SUFFIX[svc.pricing_model] || ''}</div>
          </div>
          {inCart ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="outline" className="h-8 w-8 border-teal-300" onClick={() => onSetQty(Math.max(1, qtyInCart - 1))}>
                <Minus className="w-3 h-3" />
              </Button>
              <Input
                type="number" value={qtyInCart} min="1"
                onChange={(e) => onSetQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-12 h-8 text-center text-sm"
                data-testid={`qty-input-${svc.id}`}
              />
              <Button size="icon" variant="outline" className="h-8 w-8 border-teal-300" onClick={() => onSetQty(qtyInCart + 1)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              size="sm"
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl shadow shadow-teal-500/20"
              data-testid={`add-to-cart-${svc.id}`}
            >
              <Plus className="w-4 h-4 mr-1" /> Add to Cart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Package card ────────────────────────────────────────────────────────────
function PackageCard({ pkg, services, inCart, onAdd, onRemove, onOpenDetails }) {
  // Resolve each line to its full service. Prefer the enriched `line.service`
  // returned by the backend (always present), fall back to the loaded services
  // list (which may be empty when the city filter yields no services).
  const resolve = (line) => line.service || services.find(s => s.id === line.service_id) || {};
  const memberCovers = (pkg.services || [])
    .map(line => resolve(line)?.images?.[0])
    .filter(Boolean);
  const galleryImages = [...(pkg.images || []), ...memberCovers].filter(Boolean).slice(0, 6);
  const totalItems = (pkg.services || []).reduce((s, l) => s + Number(l.quantity || 0), 0);

  return (
    <Card
      className="overflow-hidden border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-white rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer"
      onClick={onOpenDetails}
      data-testid={`package-card-${pkg.id}`}
    >
      <div className="relative">
        <SwipeableImages images={galleryImages} name={pkg.name} height="h-44" />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <Badge className="bg-teal-600 text-white font-medium shadow-sm">
            <PackageIcon className="w-3 h-3 mr-1" /> Bundle
          </Badge>
          {pkg.discount_percent > 0 && (
            <Badge className="bg-amber-400 text-amber-900 font-bold shadow-sm">−{pkg.discount_percent}%</Badge>
          )}
        </div>
        {inCart && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-emerald-500 text-white border-0 shadow-md" data-testid={`in-cart-tag-pkg-${pkg.id}`}>
              <Sparkles className="w-3 h-3 mr-1" /> In Cart
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-2.5">
        <h3 className="font-bold text-slate-900 text-lg leading-tight line-clamp-1">{pkg.name}</h3>
        {pkg.description && <p className="text-xs text-slate-600 line-clamp-2">{pkg.description}</p>}

        {/* Pronounced items list — first 3 with unit price */}
        <div className="space-y-1 pt-1 border-t border-teal-100/60">
          {(pkg.services || []).slice(0, 3).map((line, i) => {
            const full = resolve(line);
            const unitPrice = Number(full.base_price || 0);
            return (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <span className="text-slate-700 truncate flex-1">{full.name || line.service_name || line.service_id}</span>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{formatFCFA(unitPrice)}/u</span>
                <span className="font-semibold text-teal-700 flex-shrink-0">× {line.quantity}</span>
              </div>
            );
          })}
          {(pkg.services?.length || 0) > 3 && (
            <div className="text-[11px] text-teal-600 italic">+ {pkg.services.length - 3} more services</div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>{(pkg.services || []).length} services · {totalItems} items</span>
        </div>

        <div className="flex items-end justify-between pt-2 border-t border-teal-100/60">
          <div>
            {pkg.discount_percent > 0 && pkg.subtotal && (
              <div className="text-[10px] text-slate-400 line-through">{formatFCFA(pkg.subtotal)}</div>
            )}
            <div className="text-2xl font-bold text-teal-700 leading-tight">{formatFCFA(pkg.total_price || 0)}</div>
          </div>
          {inCart ? (
            <Button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              variant="outline"
              className="border-teal-400 text-teal-600"
              data-testid={`remove-package-${pkg.id}`}
            >
              Remove
            </Button>
          ) : (
            <Button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow shadow-teal-500/20"
              data-testid={`add-package-${pkg.id}`}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Bundle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function BanquetResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const cartApi = useEventCart();
  const { cart, setMeta, addItem, updateQty, removeItem, addPackage, removePackage, totals, count, clear } = cartApi;

  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const city = searchParams.get('city') || '';
  const guests = parseInt(searchParams.get('guests')) || cart.expected_guests || 0;
  const eventType = searchParams.get('type') || '';

  // Inline "Modify search" form state — pre-populated from URL on each change.
  const [editCity, setEditCity] = useState(city);
  const [editType, setEditType] = useState(eventType);
  const [editGuests, setEditGuests] = useState(guests || 50);
  useEffect(() => { setEditCity(city); setEditType(eventType); setEditGuests(guests || 50); }, [city, eventType, guests]);
  const applySearch = () => {
    const next = new URLSearchParams();
    if (editCity) next.set('city', editCity);
    if (editType) next.set('type', editType);
    if (editGuests) next.set('guests', String(editGuests));
    setSearchParams(next);
  };

  // Persist search params (sans date) into cart metadata.
  useEffect(() => {
    const updates = {};
    if (city && city !== cart.city) updates.city = city;
    if (guests && guests !== cart.expected_guests) updates.expected_guests = guests;
    if (eventType && eventType !== cart.event_type) updates.event_type = eventType;
    if (Object.keys(updates).length) setMeta(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, guests, eventType]);

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
        (s.city || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
      );
    }
    if (minPrice) list = list.filter(s => Number(s.base_price || 0) >= Number(minPrice));
    if (maxPrice) list = list.filter(s => Number(s.base_price || 0) <= Number(maxPrice));
    const sorted = [...list];
    switch (sortBy) {
      case 'price_low':  return sorted.sort((a, b) => Number(a.base_price || 0) - Number(b.base_price || 0));
      case 'price_high': return sorted.sort((a, b) => Number(b.base_price || 0) - Number(a.base_price || 0));
      case 'name':       return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:           return sorted;
    }
  }, [services, categoryTab, searchQuery, sortBy, minPrice, maxPrice]);

  const qtyOf = (svcId) => cart.items.find(i => i.service_id === svcId)?.quantity || 0;
  const isPkgInCart = (pkgId) => !!cart.packages.find(p => p.package_id === pkgId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50/60">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding services for your event…</p>
        </div>
      </div>
    );
  }

  const activeFilterCount = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (sortBy !== 'relevance' ? 1 : 0) + (categoryTab !== 'all' ? 1 : 0);

  return (
    <div className="min-h-screen bg-teal-50/40 pb-32">
      {/* Sticky header (teal-themed, matches Laundry pattern) */}
      <div className="bg-white border-b border-teal-100 shadow-sm sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/banquet')} className="gap-2 text-teal-700 hover:bg-teal-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>

          {/* Highlighted Search Criteria — rose gradient hero */}
          <Card className="shadow-sm bg-gradient-to-r from-teal-600 to-cyan-600 text-white mb-4 border-transparent" data-testid="banquet-search-criteria">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <PartyPopper className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold truncate">Banquet &amp; Event Services {city && `in ${city}`}</h2>
                    <div className="flex items-center gap-2 text-white/85 text-sm mt-0.5 flex-wrap">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{filteredServices.length} service{filteredServices.length === 1 ? '' : 's'}{packages.length ? ` · ${packages.length} bundle${packages.length === 1 ? '' : 's'}` : ''}</span>
                      {eventType && (
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] ml-1 capitalize">{eventType}</Badge>
                      )}
                      {guests > 0 && <Badge className="bg-white/20 text-white border-white/30 text-[10px]"><Users className="w-3 h-3 mr-1" />{guests} guests</Badge>}
                    </div>
                  </div>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/15 border-white/30 text-white hover:bg-white/25"
                      data-testid="modify-search-btn"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Modify search
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 bg-white p-4 space-y-3" data-testid="modify-search-popover">
                    <div>
                      <Label className="text-xs text-slate-600">City</Label>
                      <Input
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        placeholder="Yaoundé, Douala…"
                        className="mt-1 bg-white border-teal-200"
                        data-testid="modify-search-city"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Event type</Label>
                      <Select value={editType || 'any'} onValueChange={(v) => setEditType(v === 'any' ? '' : v)}>
                        <SelectTrigger className="mt-1 bg-white border-teal-200" data-testid="modify-search-type">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="wedding">Wedding</SelectItem>
                          <SelectItem value="conference">Conference</SelectItem>
                          <SelectItem value="birthday">Birthday</SelectItem>
                          <SelectItem value="corporate">Corporate</SelectItem>
                          <SelectItem value="graduation">Graduation</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Guests</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editGuests}
                        onChange={(e) => setEditGuests(Math.max(1, Number(e.target.value) || 0))}
                        className="mt-1 bg-white border-teal-200"
                        data-testid="modify-search-guests"
                      />
                    </div>
                    <Button
                      onClick={applySearch}
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                      data-testid="modify-search-apply"
                    >
                      <Search className="w-3.5 h-3.5 mr-1.5" /> Update results
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/15 border-white/30 text-white hover:bg-white/25"
                  onClick={() => setCartOpen(true)}
                  data-testid="header-cart-btn"
                >
                  <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Cart{count > 0 ? ` · ${count}` : ''}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search bar + single Filter button (mirror Laundry results) */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
              <Input
                placeholder="Search services by name, city or address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-teal-200 focus-visible:ring-teal-400"
                data-testid="services-search-input"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50 relative" data-testid="filter-button">
                  <SlidersHorizontal className="w-4 h-4 mr-2" /> Filter
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-teal-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 bg-white p-4 space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">Category</Label>
                  <Select value={categoryTab} onValueChange={setCategoryTab}>
                    <SelectTrigger className="mt-1 bg-white border-teal-200" data-testid="filter-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Sort by</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="mt-1 bg-white border-teal-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="price_low">Price: low to high</SelectItem>
                      <SelectItem value="price_high">Price: high to low</SelectItem>
                      <SelectItem value="name">Name (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Price range (FCFA)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min" className="bg-white border-teal-200" />
                    <span className="text-slate-400">–</span>
                    <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max" className="bg-white border-teal-200" />
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-teal-700"
                    onClick={() => { setMinPrice(''); setMaxPrice(''); setSortBy('relevance'); setCategoryTab('all'); }}
                  >
                    Reset filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Category quick-filters moved into the Filter popover above
            to keep this header tight. */}
      </div>

      {/* ── Pinned Cart Strip (top, primary cart trigger) ───────────────
          Always visible just under the search header. Clicking opens
          the cart drawer. The floating bottom FAB is hidden when this
          strip is rendered so the cart only lives at the top. */}
      {count > 0 && (
        <div className="bg-white border-b border-teal-200 shadow-sm sticky top-[148px] sm:top-[136px] z-10" data-testid="banquet-cart-strip">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2 min-w-0 rounded-lg hover:bg-teal-50 px-1 py-1 transition group"
              data-testid="cart-strip-open"
            >
              <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition">
                <PackageIcon className="w-4 h-4 text-teal-700" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold text-slate-900">{count} item{count === 1 ? '' : 's'} in cart</div>
                <div className="text-[11px] text-teal-700">Tap to review · pick your event date at checkout</div>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Subtotal</div>
                <div className="text-base font-bold text-teal-700">{formatFCFA(totals.total)}</div>
              </div>
              <Button
                onClick={() => navigate('/services/banquet/checkout')}
                size="sm"
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow"
                data-testid="cart-strip-checkout"
              >
                Checkout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-6 space-y-8">
        {packages.length > 0 && categoryTab === 'all' && (
          <section data-testid="packages-section">
            <div className="flex items-center gap-2 mb-4">
              <PackageIcon className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">Curated Bundles</h2>
              <Badge className="bg-teal-100 text-teal-700 border-0">Save more</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  services={services}
                  inCart={isPkgInCart(pkg.id)}
                  onAdd={() => addPackage(pkg)}
                  onRemove={() => removePackage(pkg.id)}
                  onOpenDetails={() => setDetailItem({ ...pkg, _type: 'package' })}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {categoryTab === 'all' ? 'All services' : CATEGORY_META[categoryTab]?.label}
            <span className="ml-2 text-sm font-normal text-slate-500">({filteredServices.length})</span>
          </h2>
          {filteredServices.length === 0 ? (
            <Card className="p-12 text-center bg-white border-teal-100">
              <Sparkles className="w-12 h-12 mx-auto text-teal-200 mb-3" />
              <p className="text-slate-500">No services match your filters. Try a different category or clear the filter.</p>
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
                    onOpenDetails={() => setDetailItem(svc)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Detail modal */}
      <BanquetDetailsModal
        open={!!detailItem}
        onOpenChange={(v) => { if (!v) setDetailItem(null); }}
        item={detailItem}
        services={services}
        qtyInCart={detailItem && detailItem._type !== 'package' ? qtyOf(detailItem.id) : 0}
        inCart={detailItem && detailItem._type === 'package' ? isPkgInCart(detailItem.id) : false}
        inCartSvcIds={cart.items.map(i => i.service_id)}
        onAdd={() => {
          if (!detailItem) return;
          if (detailItem._type === 'package') addPackage(detailItem);
          else addItem(detailItem, detailItem.min_quantity || 1);
        }}
        onSetQty={(n) => detailItem && updateQty(detailItem.id, n)}
        onRemove={() => detailItem && removePackage(detailItem.id)}
      />

      <EventCartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        hideFab={true}
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
