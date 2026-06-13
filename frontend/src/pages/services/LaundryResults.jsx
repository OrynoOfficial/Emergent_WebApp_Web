import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, MapPin, Star, Clock, Shirt, Sparkles, Loader2, Search,
  LayoutGrid, List, SlidersHorizontal, Droplets, Wind, Scissors, Phone,
  Wallet, CreditCard, Banknote, Tag, ChevronLeft, ChevronRight, Edit2, Check, X,
} from 'lucide-react';
import { pressingApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import LaundryShopDetailsModal from '@/components/services/LaundryShopDetailsModal';
import LocationInput from '@/components/shared/LocationInput';
import { formatFCFA } from '@/utils/currency';

// ── Swipeable image gallery — used on cards ─────────────────────────────────
const SwipeableImages = ({ images, name, height = 'h-48', testId }) => {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const safeImages = images && images.length > 0 ? images : [PLACEHOLDER_IMG];

  const scrollTo = (i) => {
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
    <div className={`relative ${height} group overflow-hidden`} data-testid={testId}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {safeImages.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full snap-center relative">
            <img
              src={src}
              alt={`${name} ${i + 1}`}
              loading="lazy"
              onError={(e) => { e.target.style.visibility = 'hidden'; }}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      {safeImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(Math.max(0, idx - 1)); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/85 hover:bg-white shadow opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4 text-purple-800" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); scrollTo(Math.min(safeImages.length - 1, idx + 1)); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/85 hover:bg-white shadow opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4 text-purple-800" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {safeImages.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); scrollTo(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/50'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Service-type icon helpers ────────────────────────────────────────────────
const getServiceIcon = (service) => {
  const s = service?.toLowerCase?.() || '';
  if (s.includes('wash')) return Droplets;
  if (s.includes('iron')) return Wind;
  if (s.includes('dry')) return Sparkles;
  if (s.includes('alter')) return Scissors;
  return Shirt;
};

// ── Shop-type styling ────────────────────────────────────────────────────────
const SHOP_TYPE_BADGE = {
  laundry:  { label: 'Laundry',           cls: 'bg-purple-500 text-white border-purple-500',           icon: Droplets },
  pressing: { label: 'Pressing',          cls: 'bg-fuchsia-500 text-white border-fuchsia-500',       icon: Sparkles },
  both:     { label: 'Laundry + Pressing', cls: 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent', icon: Shirt },
};

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=900&q=70';

// ── Pricing derivation (shared by grid + list cards) ────────────────────────
function derivePricing(svc) {
  const st = svc.shop_type || (svc.item_prices?.length ? 'pressing' : 'laundry');
  if (st === 'pressing') {
    const valid = (svc.item_prices || []).map((i) => Number(i.price)).filter((n) => n > 0);
    return {
      shop_type: st,
      headline: valid.length ? formatFCFA(Math.min(...valid)) : '—',
      unitLabel: 'per item',
      footnote: valid.length ? `${valid.length} item${valid.length === 1 ? '' : 's'} priced` : 'No prices set',
    };
  }
  if (st === 'both') {
    const kg = Number(svc.price_per_kg) || 0;
    const itemCount = (svc.item_prices || []).filter((i) => Number(i.price) > 0).length;
    return {
      shop_type: st,
      headline: kg > 0 ? formatFCFA(kg) : '—',
      unitLabel: 'per kg',
      footnote: itemCount > 0 ? `+ ${itemCount} priced items` : 'Laundry + pressing',
    };
  }
  const kg = Number(svc.price_per_kg) || Number(svc.minPrice) || 0;
  return { shop_type: st, headline: kg > 0 ? formatFCFA(kg) : '—', unitLabel: 'per kg', footnote: 'Bulk wash' };
}

// ── Grid card ───────────────────────────────────────────────────────────────
const ServiceCardGrid = ({ service, onBook, isFav, toggleFav }) => {
  const ServiceIcon = getServiceIcon((service.services || [])[0]);
  const pricing = derivePricing(service);
  const StBadge = SHOP_TYPE_BADGE[pricing.shop_type] || SHOP_TYPE_BADGE.laundry;
  const StIcon = StBadge.icon;
  const sid = service._id || service.id;
  const turnaround = service.turnaround_hours;

  return (
    <Card
      className="group overflow-hidden bg-white rounded-2xl border border-purple-100/50 shadow-md hover:shadow-2xl hover:shadow-purple-500/10 hover:border-purple-300 transition-all duration-300 transform hover:-translate-y-1"
      data-testid={`laundry-card-grid-${sid}`}
    >
      {/* Hero — swipeable image gallery */}
      <div className="relative bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700">
        <SwipeableImages
          images={service.images || []}
          name={service.name}
          height="h-48"
          testId={`laundry-card-swipe-${sid}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent pointer-events-none" />

        {/* Top-right: Favourite + Subscribe */}
        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <SubscribeButton operatorId={service.operator_id} operatorName={service.operator_name} variant="icon" />
          <FavouriteButton
            isFavourite={!!(isFav && isFav(sid))}
            onToggle={() => toggleFav && toggleFav(service)}
            testId={`favourite-${sid}`}
            className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
            emptyClass="text-white"
          />
        </div>

        {/* Top-left: shop-type badge only (Express/Delivery flags hidden on listing card) */}
        <div className="absolute top-3 left-3 z-10">
          <Badge className={`${StBadge.cls} shadow-md`} data-testid={`shop-type-${sid}`}>
            <StIcon className="w-3 h-3 mr-1" /> {StBadge.label}
          </Badge>
        </div>

        {/* Rating pill */}
        {(service.rating || service.reviews) && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full z-10">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            {service.rating || '—'} {service.reviews ? `(${service.reviews})` : ''}
          </div>
        )}
        {service.slots_available != null && (
          <div className="absolute bottom-3 right-3 z-10" data-testid={`laundry-fomo-grid-${sid}`}>
            <AlmostSoldOutBadge count={service.slots_available} unit="slots" />
          </div>
        )}
      </div>

      <CardContent className="p-5 space-y-3.5">
        <div>
          <h3 className="font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-purple-700 transition-colors">{service.name}</h3>
          {/* Pronounced address block */}
          <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-purple-50/70 px-3 py-2 border border-purple-100">
            <MapPin className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate" title={service.address || ''}>
                {service.address || 'Address unavailable'}
              </p>
              {service.city && (
                <p className="text-xs text-purple-700 font-medium truncate">{service.city}</p>
              )}
            </div>
          </div>
        </div>

        {/* Service tags + turnaround */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(service.services || []).slice(0, 3).map((s, idx) => {
            const Icon = getServiceIcon(s);
            return (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-100 rounded-full">
                <Icon className="h-3 w-3 text-purple-700" />
                <span className="text-[11px] text-purple-800 capitalize">{(s || '').replace(/_/g, ' ')}</span>
              </span>
            );
          })}
          {turnaround && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[11px] text-amber-800">
              <Clock className="h-3 w-3" /> {turnaround}h
            </span>
          )}
        </div>

        {/* Payments accepted (compact icons) */}
        {(service.accepts_momo || service.accepts_card || service.accepts_cash) && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="uppercase tracking-wide">Pays:</span>
            <div className="flex items-center gap-1.5">
              {service.accepts_momo && <Wallet className="w-3.5 h-3.5 text-purple-700" title="Mobile money" />}
              {service.accepts_card && <CreditCard className="w-3.5 h-3.5 text-purple-700" title="Card" />}
              {service.accepts_cash && <Banknote className="w-3.5 h-3.5 text-purple-700" title="Cash" />}
            </div>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-purple-100/60">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</div>
            <div className="text-2xl font-bold text-purple-700 leading-tight" data-testid={`price-${sid}`}>{pricing.headline}</div>
            <div className="text-[11px] text-slate-500">{pricing.unitLabel} · {pricing.footnote}</div>
          </div>
          <Button
            onClick={() => onBook(service)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md shadow-purple-500/20"
            data-testid={`book-btn-${sid}`}
          >
            <ServiceIcon className="w-4 h-4 mr-2" /> Book
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── List card ───────────────────────────────────────────────────────────────
const ServiceCardList = ({ service, onBook, isFav, toggleFav }) => {
  const pricing = derivePricing(service);
  const StBadge = SHOP_TYPE_BADGE[pricing.shop_type] || SHOP_TYPE_BADGE.laundry;
  const StIcon = StBadge.icon;
  const sid = service._id || service.id;

  return (
    <Card
      className="overflow-hidden bg-white rounded-2xl border border-purple-100/50 shadow-md hover:shadow-xl hover:border-purple-300 transition-all"
      data-testid={`laundry-card-list-${sid}`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Cover with swipeable gallery */}
        <div className="md:w-1/3 relative bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700">
          <SwipeableImages
            images={service.images || []}
            name={service.name}
            height="h-56 md:h-full md:min-h-[280px]"
            testId={`laundry-list-swipe-${sid}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent md:bg-gradient-to-r pointer-events-none" />
          <div className="absolute top-3 left-3 z-10">
            <Badge className={`${StBadge.cls} shadow-md`}>
              <StIcon className="w-3 h-3 mr-1" /> {StBadge.label}
            </Badge>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            <SubscribeButton operatorId={service.operator_id} operatorName={service.operator_name} variant="icon" />
            <FavouriteButton
              isFavourite={!!(isFav && isFav(sid))}
              onToggle={() => toggleFav && toggleFav(service)}
              testId={`favourite-list-${sid}`}
              className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
              emptyClass="text-white"
            />
          </div>
        </div>

        {/* Details */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-700">{service.name}</h3>
              {/* Pronounced address block */}
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-purple-50/70 px-3 py-2 border border-purple-100 max-w-md">
                <MapPin className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate" title={service.address || ''}>
                    {service.address || 'Address unavailable'}
                  </p>
                  {service.city && (
                    <p className="text-xs text-purple-700 font-medium truncate">{service.city}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center text-sm text-slate-500 mt-2 gap-3 flex-wrap">
                {service.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {service.phone}</span>}
                {service.turnaround_hours && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {service.turnaround_hours}h turnaround</span>}
              </div>
            </div>
            {(service.rating || service.reviews) && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full whitespace-nowrap">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-amber-900">{service.rating || '—'}</span>
                {service.reviews ? <span className="text-xs text-amber-700/80">({service.reviews})</span> : null}
              </div>
            )}
          </div>

          {service.description && (
            <p className="text-slate-600 mb-3 line-clamp-2 text-sm">{service.description}</p>
          )}

          {/* Service tags */}
          {(service.services || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(service.services || []).map((s, idx) => {
                const Icon = getServiceIcon(s);
                return (
                  <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 capitalize">
                    <Icon className="w-3 h-3 mr-1" />
                    {(s || '').replace(/_/g, ' ')}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Per-item price preview (pressing/both shops) */}
          {pricing.shop_type !== 'laundry' && (service.item_prices || []).length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {(service.item_prices || []).slice(0, 4).map((ip, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 border border-fuchsia-100 text-[11px] rounded-md">
                  <Tag className="w-3 h-3 text-fuchsia-700" />
                  <span className="text-fuchsia-900 font-medium">{ip.item}</span>
                  <span className="text-fuchsia-700">·</span>
                  <span className="text-fuchsia-900 font-bold">{formatFCFA(Number(ip.price))}</span>
                </span>
              ))}
              {(service.item_prices || []).length > 4 && (
                <span className="text-[11px] text-slate-500 self-center">+{(service.item_prices || []).length - 4} more</span>
              )}
            </div>
          )}

          {/* Payments */}
          {(service.accepts_momo || service.accepts_card || service.accepts_cash) && (
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              <span className="uppercase tracking-wide">Pays:</span>
              <div className="flex items-center gap-2">
                {service.accepts_momo && <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5 text-purple-700" /> MoMo</span>}
                {service.accepts_card && <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-purple-700" /> Card</span>}
                {service.accepts_cash && <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-purple-700" /> Cash</span>}
              </div>
            </div>
          )}

          {/* Price + CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-purple-100/60">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</span>
              <span className="text-2xl font-bold text-purple-700 ml-2" data-testid={`list-price-${sid}`}>{pricing.headline}</span>
              <span className="text-xs text-slate-500 ml-1">{pricing.unitLabel}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{pricing.footnote}</p>
            </div>
            <Button
              onClick={() => onBook(service)}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md shadow-purple-500/20"
              data-testid={`book-list-btn-${sid}`}
            >
              <Shirt className="w-4 h-4 mr-2" /> Book Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function LaundryResults() {
  const { isFav, toggleFav } = useFavourites('laundry');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  // Pre-booking modal — clicking "Book" opens the info modal first; the
  // explicit "Continue to booking" CTA inside is what navigates to the
  // booking page (mirrors the Packages flow).
  const [previewShop, setPreviewShop] = useState(null);

  const city = searchParams.get('city') || '';
  // shop_type comes from the search page: 'laundry' | 'pressing' | '' (all)
  const shopType = searchParams.get('shop_type') || '';

  // Inline search-criteria editing (mirrors RestaurantsResults pattern)
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editCity, setEditCity] = useState(city);
  const [editShopType, setEditShopType] = useState(shopType);

  useEffect(() => {
    setEditCity(city);
    setEditShopType(shopType);
  }, [city, shopType]);

  const handleUpdateSearch = () => {
    const next = new URLSearchParams();
    if (editCity) next.set('city', editCity);
    if (editShopType) next.set('shop_type', editShopType);
    setSearchParams(next);
    setIsEditingSearch(false);
  };

  useEffect(() => { loadServices(); }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await pressingApi.list({ city });
      setServices(res.data.pressings || res.data.services || res.data.shops || []);
    } catch (error) {
      console.error('Failed to load laundry services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    let filtered = [...services];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) =>
        s.name?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q)
      );
    }
    // Pre-filter by the URL's shop_type (set on the search page).
    // 'laundry' shows laundry-only AND both-shops; 'pressing' shows pressing-only AND both.
    if (shopType === 'laundry') {
      filtered = filtered.filter((s) => (s.shop_type || 'laundry') === 'laundry' || s.shop_type === 'both');
    } else if (shopType === 'pressing') {
      filtered = filtered.filter((s) => s.shop_type === 'pressing' || s.shop_type === 'both');
    }
    const priceOf = (s) => {
      const st = s.shop_type || 'laundry';
      if (st === 'pressing') {
        const v = (s.item_prices || []).map((i) => Number(i.price)).filter((n) => n > 0);
        return v.length ? Math.min(...v) : Number.MAX_SAFE_INTEGER;
      }
      return Number(s.price_per_kg) || Number(s.minPrice) || Number.MAX_SAFE_INTEGER;
    };
    switch (sortBy) {
      case 'price_low':  return filtered.sort((a, b) => priceOf(a) - priceOf(b));
      case 'price_high': return filtered.sort((a, b) => priceOf(b) - priceOf(a));
      case 'reviews':    return filtered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
      case 'rating':
      default:           return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }, [services, sortBy, searchQuery, shopType]);

  const handleBook = (service) => {
    // Open the pre-booking info modal first — only the explicit CTA inside
    // navigates to the booking page.
    setPreviewShop(service);
  };

  const handleContinueToBooking = (service) => {
    sessionStorage.setItem('selectedLaundry', JSON.stringify(service));
    setPreviewShop(null);
    navigate(`/services/laundry/booking/${service.id || service._id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50/60">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding laundry &amp; pressing services...</p>
        </div>
      </div>
    );
  }

  const shopTypeLabel = shopType === 'laundry' ? 'Laundry shops' : shopType === 'pressing' ? 'Pressing shops' : 'Laundry & Pressing';

  return (
    <div className="min-h-screen bg-purple-50/60">
      {/* Header (purple-accented) */}
      <div className="bg-white border-b border-purple-100 shadow-sm sticky top-0 z-20" data-testid="laundry-results-header">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/laundry')} className="gap-2 text-purple-700 hover:bg-purple-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>

          {/* Highlighted Search Criteria Header — restaurants-style, purple-accented */}
          <Card className="shadow-sm bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white mb-4 border-transparent" data-testid="laundry-search-criteria">
            <CardContent className="p-4">
              {isEditingSearch ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">City</label>
                    <LocationInput
                      value={editCity}
                      onChange={setEditCity}
                      serviceType="pressing"
                      placeholder="Enter city"
                      iconColor="text-white/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Service type</label>
                    <Select value={editShopType || 'all'} onValueChange={(v) => setEditShopType(v === 'all' ? '' : v)}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All shops</SelectItem>
                        <SelectItem value="laundry">Laundry</SelectItem>
                        <SelectItem value="pressing">Pressing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={handleUpdateSearch} className="bg-white text-purple-700 hover:bg-white/90 flex-1">
                      <Check className="w-4 h-4 mr-1" /> Update
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingSearch(false)} className="text-white hover:bg-white/10">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shirt className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold truncate">{shopTypeLabel} {city && `in ${city}`}</h2>
                      <div className="flex items-center gap-2 text-white/80 text-sm mt-0.5 flex-wrap">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{filteredServices.length} shop{filteredServices.length === 1 ? '' : 's'} found</span>
                        {shopType && (
                          <Badge className="bg-white/20 text-white border-white/30 text-[10px] ml-1 capitalize">{shopType}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingSearch(true)}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    data-testid="laundry-edit-search-btn"
                  >
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-600/60" />
              <Input
                type="text"
                placeholder="Search by name, area or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-purple-50/40 border-purple-200 focus-visible:ring-purple-400"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white border-purple-200">
                <SlidersHorizontal className="w-4 h-4 mr-2 text-purple-700" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="reviews">Most reviews</SelectItem>
                <SelectItem value="price_low">Price: low to high</SelectItem>
                <SelectItem value="price_high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-purple-50 rounded-lg p-1 border border-purple-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500'}
                data-testid="view-mode-grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500'}
                data-testid="view-mode-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-6">
        {filteredServices.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-purple-100 mx-auto mb-4 flex items-center justify-center">
              <Shirt className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No services found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/laundry')} className="bg-purple-700 hover:bg-purple-800">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="laundry-grid-results">
            {filteredServices.map((service) => (
              <ServiceCardGrid key={service.id || service._id} service={service} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          <div className="space-y-4" data-testid="laundry-list-results">
            {filteredServices.map((service) => (
              <ServiceCardList key={service.id || service._id} service={service} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        )}
      </div>

      <LaundryShopDetailsModal
        open={!!previewShop}
        onOpenChange={(v) => { if (!v) setPreviewShop(null); }}
        shop={previewShop}
        onContinue={handleContinueToBooking}
      />
    </div>
  );
}
