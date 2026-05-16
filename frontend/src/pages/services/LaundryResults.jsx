import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, MapPin, Star, Clock, Truck, Shirt, Sparkles, Loader2, Search,
  LayoutGrid, List, SlidersHorizontal, Droplets, Wind, Scissors, Phone,
  Wallet, CreditCard, Banknote, Tag,
} from 'lucide-react';
import { pressingApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import { formatFCFA } from '@/utils/currency';

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
  laundry:  { label: 'Laundry',           cls: 'bg-cyan-500 text-white border-cyan-500',           icon: Droplets },
  pressing: { label: 'Pressing',          cls: 'bg-violet-500 text-white border-violet-500',       icon: Sparkles },
  both:     { label: 'Laundry + Pressing', cls: 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-transparent', icon: Shirt },
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
  const cover = (service.images && service.images[0]) || service.image || PLACEHOLDER_IMG;
  const sid = service._id || service.id;
  const deliveryEnabled = !!(service.delivery_available ?? service.delivery);
  const expressEnabled  = !!(service.express_available ?? service.express);
  const turnaround = service.turnaround_hours;

  return (
    <Card
      className="group overflow-hidden bg-white rounded-2xl border border-cyan-100/50 shadow-md hover:shadow-2xl hover:shadow-cyan-500/10 hover:border-cyan-300 transition-all duration-300 transform hover:-translate-y-1"
      data-testid={`laundry-card-grid-${sid}`}
    >
      {/* Hero */}
      <div className="h-48 relative overflow-hidden bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-700">
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={(e) => { e.target.style.visibility = 'hidden'; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Brand-icon overlay (visible only when img has not painted yet or failed) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-0">
          <Shirt className="h-12 w-12 text-white/30" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

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

        {/* Top-left: shop-type + service flags */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <Badge className={`${StBadge.cls} shadow-md`} data-testid={`shop-type-${sid}`}>
            <StIcon className="w-3 h-3 mr-1" /> {StBadge.label}
          </Badge>
          <div className="flex gap-1.5">
            {expressEnabled && (
              <Badge className="bg-orange-500 text-white border-transparent shadow-sm" data-testid={`express-${sid}`}>
                <Sparkles className="w-3 h-3 mr-1" /> Express
              </Badge>
            )}
            {deliveryEnabled && (
              <Badge className="bg-emerald-500 text-white border-transparent shadow-sm" data-testid={`delivery-${sid}`}>
                <Truck className="w-3 h-3 mr-1" /> Delivery
              </Badge>
            )}
          </div>
        </div>

        {/* Rating pill */}
        {(service.rating || service.reviews) && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
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
          <h3 className="font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-cyan-700 transition-colors">{service.name}</h3>
          <div className="flex items-center text-slate-500 text-sm mt-0.5 gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate" title={`${service.address || ''}${service.city ? ' · ' + service.city : ''}`}>
              {[service.address, service.city].filter(Boolean).join(' · ') || 'Address unavailable'}
            </span>
          </div>
        </div>

        {/* Service tags + turnaround */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(service.services || []).slice(0, 3).map((s, idx) => {
            const Icon = getServiceIcon(s);
            return (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 border border-cyan-100 rounded-full">
                <Icon className="h-3 w-3 text-cyan-700" />
                <span className="text-[11px] text-cyan-800 capitalize">{(s || '').replace(/_/g, ' ')}</span>
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
              {service.accepts_momo && <Wallet className="w-3.5 h-3.5 text-cyan-700" title="Mobile money" />}
              {service.accepts_card && <CreditCard className="w-3.5 h-3.5 text-cyan-700" title="Card" />}
              {service.accepts_cash && <Banknote className="w-3.5 h-3.5 text-cyan-700" title="Cash" />}
            </div>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-cyan-100/60">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</div>
            <div className="text-2xl font-bold text-cyan-700 leading-tight" data-testid={`price-${sid}`}>{pricing.headline}</div>
            <div className="text-[11px] text-slate-500">{pricing.unitLabel} · {pricing.footnote}</div>
          </div>
          <Button
            onClick={() => onBook(service)}
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl shadow-md shadow-cyan-500/20"
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
  const cover = (service.images && service.images[0]) || service.image || PLACEHOLDER_IMG;
  const sid = service._id || service.id;
  const deliveryEnabled = !!(service.delivery_available ?? service.delivery);
  const expressEnabled  = !!(service.express_available ?? service.express);

  return (
    <Card
      className="overflow-hidden bg-white rounded-2xl border border-cyan-100/50 shadow-md hover:shadow-xl hover:border-cyan-300 transition-all"
      data-testid={`laundry-card-list-${sid}`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Cover with thumbnails */}
        <div className="md:w-1/3 relative">
          <div className="h-56 md:h-full relative bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-700">
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              loading="lazy"
              onError={(e) => { e.target.style.visibility = 'hidden'; }}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-0">
              <Shirt className="h-12 w-12 text-white/30" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent md:bg-gradient-to-r" />
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              <Badge className={`${StBadge.cls} shadow-md`}>
                <StIcon className="w-3 h-3 mr-1" /> {StBadge.label}
              </Badge>
              <div className="flex gap-1.5">
                {expressEnabled && <Badge className="bg-orange-500 text-white border-transparent"><Sparkles className="w-3 h-3 mr-1" /> Express</Badge>}
                {deliveryEnabled && <Badge className="bg-emerald-500 text-white border-transparent"><Truck className="w-3 h-3 mr-1" /> Delivery</Badge>}
              </div>
            </div>
            <div className="absolute top-3 right-3 flex gap-1.5">
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
          {/* Thumbnail strip (2nd & 3rd images if present) */}
          {(service.images || []).length > 1 && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {(service.images || []).slice(1, 3).map((thumb, i) => (
                <div key={i} className="w-12 h-12 rounded-md overflow-hidden border-2 border-white/80 shadow-md">
                  <img src={thumb} alt={`${service.name} ${i + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-cyan-700">{service.name}</h3>
              <div className="flex items-center text-sm text-slate-500 mt-0.5 gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[service.address, service.city].filter(Boolean).join(' · ') || 'Unknown'}</span>
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
                  <Badge key={idx} variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200 capitalize">
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
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-100 text-[11px] rounded-md">
                  <Tag className="w-3 h-3 text-violet-700" />
                  <span className="text-violet-900 font-medium">{ip.item}</span>
                  <span className="text-violet-700">·</span>
                  <span className="text-violet-900 font-bold">{formatFCFA(Number(ip.price))}</span>
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
                {service.accepts_momo && <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5 text-cyan-700" /> MoMo</span>}
                {service.accepts_card && <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-cyan-700" /> Card</span>}
                {service.accepts_cash && <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-cyan-700" /> Cash</span>}
              </div>
            </div>
          )}

          {/* Price + CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-cyan-100/60">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">From</span>
              <span className="text-2xl font-bold text-cyan-700 ml-2" data-testid={`list-price-${sid}`}>{pricing.headline}</span>
              <span className="text-xs text-slate-500 ml-1">{pricing.unitLabel}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">{pricing.footnote}</p>
            </div>
            <Button
              onClick={() => onBook(service)}
              className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl shadow-md shadow-cyan-500/20"
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
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [shopTypeFilter, setShopTypeFilter] = useState('all');

  const city = searchParams.get('city') || '';

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
    if (deliveryFilter === 'delivery') filtered = filtered.filter((s) => s.delivery_available ?? s.delivery);
    else if (deliveryFilter === 'express') filtered = filtered.filter((s) => s.express_available ?? s.express);
    if (shopTypeFilter !== 'all') {
      filtered = filtered.filter((s) => (s.shop_type || 'laundry') === shopTypeFilter);
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
  }, [services, sortBy, searchQuery, deliveryFilter, shopTypeFilter]);

  const handleBook = (service) => {
    sessionStorage.setItem('selectedLaundry', JSON.stringify(service));
    navigate(`/services/laundry/booking/${service.id || service._id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cyan-50 via-white to-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding laundry &amp; pressing services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-50">
      {/* Header (cyan-accented) */}
      <div className="bg-white border-b border-cyan-100 shadow-sm sticky top-0 z-20" data-testid="laundry-results-header">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/laundry')} className="gap-2 text-cyan-700 hover:bg-cyan-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Laundry &amp; Pressing</h1>
                <p className="text-sm text-slate-500">
                  <span className="text-cyan-700 font-semibold">{filteredServices.length}</span> shop{filteredServices.length === 1 ? '' : 's'} found
                  {city && <span className="text-slate-400"> · in <span className="text-slate-600">{city}</span></span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600/60" />
              <Input
                type="text"
                placeholder="Search by name, area or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-cyan-50/40 border-cyan-200 focus-visible:ring-cyan-400"
              />
            </div>
            <Select value={shopTypeFilter} onValueChange={setShopTypeFilter}>
              <SelectTrigger className="w-40 bg-white border-cyan-200" data-testid="shop-type-filter">
                <Shirt className="w-4 h-4 mr-2 text-cyan-700" />
                <SelectValue placeholder="Shop type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="pressing">Pressing</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="w-40 bg-white border-cyan-200">
                <Truck className="w-4 h-4 mr-2 text-cyan-700" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All services</SelectItem>
                <SelectItem value="delivery">With delivery</SelectItem>
                <SelectItem value="express">Express only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white border-cyan-200">
                <SlidersHorizontal className="w-4 h-4 mr-2 text-cyan-700" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="reviews">Most reviews</SelectItem>
                <SelectItem value="price_low">Price: low to high</SelectItem>
                <SelectItem value="price_high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-cyan-50 rounded-lg p-1 border border-cyan-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500'}
                data-testid="view-mode-grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500'}
                data-testid="view-mode-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredServices.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-cyan-100 mx-auto mb-4 flex items-center justify-center">
              <Shirt className="w-8 h-8 text-cyan-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No services found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/laundry')} className="bg-cyan-700 hover:bg-cyan-800">
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
    </div>
  );
}
