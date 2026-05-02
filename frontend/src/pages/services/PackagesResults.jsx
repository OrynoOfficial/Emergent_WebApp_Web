import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ArrowLeft, Package, MapPin, Clock, Building, Truck,
  LayoutGrid, List, Search, SlidersHorizontal, Heart, Loader2, Shield,
  Edit2, Check, X, Weight, Ruler, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import { packageServiceApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import LocationInput from '@/components/shared/LocationInput';

const PACKAGE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'perishable', label: 'Perishable' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'heavy_goods', label: 'Heavy Goods' },
];

const FEATURE_OPTIONS = [
  { value: 'tracking', label: 'Tracking' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fragile_handling', label: 'Fragile Handling' },
  { value: 'signature_required', label: 'Signature Required' },
  { value: 'temperature_controlled', label: 'Temperature Controlled' },
];

const formatHours = (h) => {
  if (!h && h !== 0) return '—';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
};

const ServiceCardGrid = ({ service, onSelect, isFav, toggleFav }) => (
  <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1" data-testid={`service-card-${service.id}`}>
    <div className="relative h-32 bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] p-4">
      <div className="absolute top-3 right-3 flex gap-1.5">
        <SubscribeButton operatorId={service.operator_id} operatorName={service.operator_name} variant="icon" />
        <button
          onClick={(e) => { e.stopPropagation(); if (toggleFav) toggleFav(service); }}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
          data-testid={`fav-btn-${service.id}`}
        >
          <Heart className={`h-4 w-4 ${(isFav && isFav(service.id)) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </button>
      </div>
      <Badge className="absolute top-3 left-3 bg-yellow-400 text-[#082c59] hover:bg-yellow-400">
        <Truck className="w-3 h-3 mr-1" /> Logistics
      </Badge>
      <div className="absolute bottom-4 left-4">
        <div className="flex items-center gap-2 text-white">
          <Package className="w-5 h-5" />
          <span className="font-bold text-lg line-clamp-1">{service.name}</span>
        </div>
        <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
          <Building className="w-3 h-3" />
          {service.operator_name || 'Operator'}
        </div>
      </div>
    </div>

    <CardContent className="p-5">
      <div className="flex items-center justify-between text-sm mb-4 bg-slate-50 rounded-lg p-3">
        <div className="text-center flex-1 min-w-0">
          <MapPin className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
          <span className="text-slate-600 truncate block">{service.origin_city}</span>
        </div>
        <div className="flex-1 px-2"><div className="border-t-2 border-dashed border-slate-300" /></div>
        <div className="text-center flex-1 min-w-0">
          <MapPin className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <span className="text-slate-600 truncate block">{service.destination_city}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-[#082c59]" />
          <span>{formatHours(service.delivery_time_hours)}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Weight className="w-3.5 h-3.5" />
          <span className="text-xs">up to {service.max_weight_kg}kg</span>
        </div>
      </div>

      {service.features?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {service.features.slice(0, 3).map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px] capitalize">
              <Shield className="w-2.5 h-2.5 mr-1" />{f.replace(/_/g, ' ')}
            </Badge>
          ))}
          {service.features.length > 3 && <span className="text-[10px] text-slate-400">+{service.features.length - 3}</span>}
        </div>
      )}

      <div className="flex items-end justify-between pt-3 border-t border-slate-100">
        <div>
          <div className="text-xs text-slate-500">Estimated price</div>
          <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(service.calculated_price || 0)}</div>
        </div>
        <Button
          onClick={() => onSelect(service)}
          className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl"
          data-testid={`select-service-${service.id}`}
        >
          Select <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </CardContent>
  </Card>
);

const ServiceCardList = ({ service, onSelect, isFav, toggleFav }) => (
  <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
    <div className="flex flex-col md:flex-row">
      <div className="md:w-1/4 p-6 bg-gradient-to-br from-[#082c59] to-[#0a3a75] text-white flex flex-col justify-center">
        <Badge className="w-fit mb-2 bg-yellow-400 text-[#082c59] hover:bg-yellow-400">
          <Truck className="w-3 h-3 mr-1" /> Logistics
        </Badge>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5" />
          <span className="font-bold">{service.name}</span>
        </div>
        <div className="flex items-center gap-1 text-white/80 text-sm">
          <Building className="w-3 h-3" /> {service.operator_name || 'Operator'}
        </div>
      </div>

      <div className="md:w-1/2 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-emerald-500" /><span className="font-medium">{service.origin_city}</span></div>
          <div className="flex-1 border-t-2 border-dashed border-slate-300" />
          <div className="flex items-center gap-2"><span className="font-medium">{service.destination_city}</span><MapPin className="w-5 h-5 text-red-500" /></div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-2">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#082c59]" /><span><strong>Delivery:</strong> {formatHours(service.delivery_time_hours)}</span></div>
          <div className="flex items-center gap-2"><Package className="w-5 h-5 text-[#082c59]" /><span><strong>Max:</strong> {service.max_weight_kg}kg</span></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {service.features?.slice(0, 4).map((f) => (
            <Badge key={f} variant="secondary" className="capitalize text-xs">{f.replace(/_/g, ' ')}</Badge>
          ))}
        </div>
      </div>

      <div className="md:w-1/4 p-6 bg-slate-50 flex flex-col justify-center items-center border-l">
        <div className="text-sm text-slate-500 mb-1">Estimated price</div>
        <div className="text-3xl font-bold text-[#082c59] mb-1">{formatFCFA(service.calculated_price || 0)}</div>
        <Button
          onClick={() => onSelect(service)}
          className="w-full mt-3 bg-[#082c59] hover:bg-[#0a3a75] rounded-xl"
          data-testid={`select-service-list-${service.id}`}
        >
          Select Service <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <button
          onClick={() => toggleFav?.(service)}
          className="mt-2 text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"
        >
          <Heart className={`h-3.5 w-3.5 ${isFav?.(service.id) ? 'fill-red-500 text-red-500' : ''}`} />
          {isFav?.(service.id) ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  </Card>
);

export default function PackagesResults() {
  const { isFav, toggleFav } = useFavourites('packages');
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('price_low');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 200000]);
  const [maxDeliveryHours, setMaxDeliveryHours] = useState(0); // 0 = no limit
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [pricingModelFilter, setPricingModelFilter] = useState('all');
  const [minMaxWeight, setMinMaxWeight] = useState(0); // 0 = no filter

  // Editable search bar state
  const [isEditing, setIsEditing] = useState(false);
  const origin = urlParams.get('origin') || '';
  const destination = urlParams.get('destination') || '';
  const weight_kg = parseFloat(urlParams.get('weight_kg') || '0') || 0;
  const length_cm = parseFloat(urlParams.get('length_cm') || '0') || 0;
  const width_cm = parseFloat(urlParams.get('width_cm') || '0') || 0;
  const height_cm = parseFloat(urlParams.get('height_cm') || '0') || 0;
  const packageType = urlParams.get('package_type') || 'parcel';
  const shippingDate = urlParams.get('shipping_date');

  const [editForm, setEditForm] = useState({
    origin: '', destination: '', weight_kg: '', length_cm: '', width_cm: '', height_cm: '', package_type: 'parcel',
  });

  useEffect(() => {
    setEditForm({
      origin, destination,
      weight_kg: weight_kg ? String(weight_kg) : '',
      length_cm: length_cm ? String(length_cm) : '',
      width_cm: width_cm ? String(width_cm) : '',
      height_cm: height_cm ? String(height_cm) : '',
      package_type: packageType,
    });
  }, [origin, destination, weight_kg, length_cm, width_cm, height_cm, packageType]);

  const applyEdit = () => {
    const next = new URLSearchParams(urlParams);
    next.set('origin', editForm.origin || '');
    next.set('destination', editForm.destination || '');
    next.set('weight_kg', String(editForm.weight_kg || ''));
    next.set('length_cm', String(editForm.length_cm || ''));
    next.set('width_cm', String(editForm.width_cm || ''));
    next.set('height_cm', String(editForm.height_cm || ''));
    next.set('package_type', editForm.package_type || 'parcel');
    setUrlParams(next);
    setIsEditing(false);
  };

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await packageServiceApi.search({
          origin_city: origin,
          destination_city: destination,
          weight_kg,
          length_cm,
          width_cm,
          height_cm,
          package_type: packageType,
        });
        if (!cancel) setServices(res.data?.services || []);
      } catch (e) {
        console.error('Failed to load package services:', e);
        if (!cancel) setServices([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    return () => { cancel = true; };
  }, [origin, destination, weight_kg, length_cm, width_cm, height_cm, packageType]);

  const filteredServices = useMemo(() => {
    let filtered = [...services];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.operator_name?.toLowerCase().includes(q)
      );
    }
    filtered = filtered.filter(s => {
      const p = s.calculated_price || 0;
      if (p < priceRange[0] || p > priceRange[1]) return false;
      if (maxDeliveryHours && (s.delivery_time_hours || 0) > maxDeliveryHours) return false;
      if (pricingModelFilter !== 'all' && s.pricing_model !== pricingModelFilter) return false;
      if (minMaxWeight && (s.max_weight_kg || 0) < minMaxWeight) return false;
      if (selectedFeatures.length > 0 && !selectedFeatures.every(f => (s.features || []).includes(f))) return false;
      return true;
    });
    switch (sortBy) {
      case 'price_high':
        return filtered.sort((a, b) => (b.calculated_price || 0) - (a.calculated_price || 0));
      case 'fastest':
        return filtered.sort((a, b) => (a.delivery_time_hours || 9999) - (b.delivery_time_hours || 9999));
      case 'capacity':
        return filtered.sort((a, b) => (b.max_weight_kg || 0) - (a.max_weight_kg || 0));
      case 'price_low':
      default:
        return filtered.sort((a, b) => (a.calculated_price || 0) - (b.calculated_price || 0));
    }
  }, [services, sortBy, searchQuery, priceRange, maxDeliveryHours, selectedFeatures, pricingModelFilter, minMaxWeight]);

  const handleSelect = (service) => {
    sessionStorage.setItem('selectedPackageService', JSON.stringify(service));
    sessionStorage.setItem('packageBookingParams', JSON.stringify({
      origin_city: origin,
      destination_city: destination,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      package_type: packageType,
      shipping_date: shippingDate,
    }));
    navigate(`/services/packages/booking/${service.id}`);
  };

  const toggleFeature = (feature) => {
    setSelectedFeatures((prev) => prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]);
  };

  const clearFilters = () => {
    setPriceRange([0, 200000]);
    setMaxDeliveryHours(0);
    setSelectedFeatures([]);
    setPricingModelFilter('all');
    setMinMaxWeight(0);
  };

  const activeFiltersCount =
    selectedFeatures.length +
    (maxDeliveryHours > 0 ? 1 : 0) +
    (pricingModelFilter !== 'all' ? 1 : 0) +
    (minMaxWeight > 0 ? 1 : 0) +
    ((priceRange[0] > 0 || priceRange[1] < 200000) ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding delivery operators...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/services/packages')} data-testid="back-to-search">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          {/* Editable search summary card */}
          <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white mb-4 border-0">
            <CardContent className="p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Origin</Label>
                      <LocationInput
                        value={editForm.origin}
                        onChange={(v) => setEditForm((p) => ({ ...p, origin: v }))}
                        placeholder="Pickup city"
                        serviceType="packages"
                        iconColor="text-white/40"
                        excludeValue={editForm.destination}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Destination</Label>
                      <LocationInput
                        value={editForm.destination}
                        onChange={(v) => setEditForm((p) => ({ ...p, destination: v }))}
                        placeholder="Delivery city"
                        serviceType="packages"
                        iconColor="text-white/40"
                        excludeValue={editForm.origin}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Weight (kg)</Label>
                      <Input type="number" step="0.1" value={editForm.weight_kg} onChange={(e) => setEditForm((p) => ({ ...p, weight_kg: e.target.value }))} className="bg-white/10 border-white/20 text-white h-9 text-sm" data-testid="edit-weight" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Length</Label>
                      <Input type="number" value={editForm.length_cm} onChange={(e) => setEditForm((p) => ({ ...p, length_cm: e.target.value }))} className="bg-white/10 border-white/20 text-white h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Width</Label>
                      <Input type="number" value={editForm.width_cm} onChange={(e) => setEditForm((p) => ({ ...p, width_cm: e.target.value }))} className="bg-white/10 border-white/20 text-white h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Height</Label>
                      <Input type="number" value={editForm.height_cm} onChange={(e) => setEditForm((p) => ({ ...p, height_cm: e.target.value }))} className="bg-white/10 border-white/20 text-white h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/70 mb-1 block uppercase tracking-wide">Type</Label>
                      <Select value={editForm.package_type} onValueChange={(v) => setEditForm((p) => ({ ...p, package_type: v }))}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {PACKAGE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-white hover:bg-white/10">
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={applyEdit} className="bg-white text-[#082c59] hover:bg-white/90" data-testid="apply-edit-search">
                      <Check className="w-4 h-4 mr-1" /> Update Search
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold leading-tight truncate">{origin || '—'}</h2>
                        <ArrowRight className="w-4 h-4 text-white/60 flex-shrink-0" />
                        <h2 className="text-base font-bold leading-tight truncate">{destination || '—'}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/70 text-xs mt-1">
                        <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{weight_kg || 0} kg</span>
                        {(length_cm || width_cm || height_cm) ? (
                          <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{length_cm}×{width_cm}×{height_cm} cm</span>
                        ) : null}
                        <Badge className="bg-white/20 text-white border-0 capitalize text-[10px] px-2 py-0.5">{packageType.replace(/_/g, ' ')}</Badge>
                        {shippingDate ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(shippingDate), 'MMM d')}</span> : null}
                        <span>· {filteredServices.length} operators</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-shrink-0"
                    data-testid="edit-search-btn"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search operator or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
                data-testid="results-search-input"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44 bg-white"><SlidersHorizontal className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="fastest">Fastest Delivery</SelectItem>
                <SelectItem value="capacity">Highest Capacity</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Sheet */}
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative" data-testid="filters-btn">
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
                  <SheetTitle>Filter results</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-7">
                  {/* Price Range */}
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Price Range (FCFA)</Label>
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={0}
                      max={200000}
                      step={1000}
                      className="mb-3"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="px-3 py-1 bg-slate-100 rounded-full">{formatFCFA(priceRange[0])}</span>
                      <span className="px-3 py-1 bg-slate-100 rounded-full">{formatFCFA(priceRange[1])}</span>
                    </div>
                  </div>

                  {/* Max Delivery Time */}
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Max Delivery Time</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 0, label: 'Any' },
                        { value: 6, label: '≤ 6h' },
                        { value: 12, label: '≤ 12h' },
                        { value: 24, label: '≤ 24h' },
                        { value: 48, label: '≤ 2d' },
                        { value: 96, label: '≤ 4d' },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          variant={maxDeliveryHours === opt.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMaxDeliveryHours(opt.value)}
                          className={`rounded-full ${maxDeliveryHours === opt.value ? 'bg-[#082c59]' : ''}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Model */}
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Pricing Model</Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'tiered', label: 'Weight Tiers' },
                        { value: 'per_kg', label: 'Base + per-kg' },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          variant={pricingModelFilter === opt.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPricingModelFilter(opt.value)}
                          className={`rounded-full ${pricingModelFilter === opt.value ? 'bg-[#082c59]' : ''}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Capacity */}
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Minimum Capacity (max weight)</Label>
                    <div className="flex flex-wrap gap-2">
                      {[0, 5, 10, 20, 50, 100].map((w) => (
                        <Button
                          key={w}
                          variant={minMaxWeight === w ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMinMaxWeight(w)}
                          className={`rounded-full ${minMaxWeight === w ? 'bg-[#082c59]' : ''}`}
                        >
                          {w === 0 ? 'Any' : `${w}kg+`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <Label className="font-semibold text-slate-900 mb-3 block">Service Features</Label>
                    <div className="space-y-3">
                      {FEATURE_OPTIONS.map((f) => (
                        <label key={f.value} className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={selectedFeatures.includes(f.value)}
                            onCheckedChange={() => toggleFeature(f.value)}
                          />
                          <span className="text-sm text-slate-700">{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={clearFilters} className="flex-1 rounded-xl">Clear All</Button>
                    <Button onClick={() => setFilterOpen(false)} className="flex-1 bg-[#082c59] rounded-xl" data-testid="apply-filters-btn">
                      Show {filteredServices.length} Results
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-white shadow-sm' : ''} data-testid="view-grid"><LayoutGrid className="w-4 h-4" /></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-white shadow-sm' : ''} data-testid="view-list"><List className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredServices.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No operators available</h3>
            <p className="text-slate-500 mb-4">
              {services.length === 0
                ? 'No logistics operator currently serves this route with your package size/weight. Try adjusting your search.'
                : 'No service matches your filters. Try clearing them.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              {activeFiltersCount > 0 && (
                <Button onClick={clearFilters} variant="outline" data-testid="clear-filters-btn">Clear Filters</Button>
              )}
              <Button onClick={() => navigate('/services/packages')} className="bg-[#082c59]" data-testid="modify-search-btn">Modify Search</Button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="services-grid">
            {filteredServices.map((service) => (
              <ServiceCardGrid key={service.id} service={service} onSelect={handleSelect} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          <div className="space-y-4" data-testid="services-list">
            {filteredServices.map((service) => (
              <ServiceCardList key={service.id} service={service} onSelect={handleSelect} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
