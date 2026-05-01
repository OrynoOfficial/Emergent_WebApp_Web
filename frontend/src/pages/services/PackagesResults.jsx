import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Package, MapPin, Clock, Building, Truck,
  LayoutGrid, List, Search, SlidersHorizontal, Heart, Loader2, Shield, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import { packageServiceApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';

const formatHours = (h) => {
  if (!h && h !== 0) return '—';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
};

const ServiceCardGrid = ({ service, onSelect, isFav, toggleFav }) => (
  <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
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
        <Truck className="w-3 h-3 mr-1" />
        Logistics
      </Badge>
      <div className="absolute bottom-4 left-4">
        <div className="flex items-center gap-2 text-white">
          <Package className="w-5 h-5" />
          <span className="font-bold text-lg">{service.name}</span>
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

      <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-[#082c59]" />
          <span>{formatHours(service.delivery_time_hours)}</span>
        </div>
        {service.features?.length > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 text-xs">
            <Shield className="w-3 h-3" />
            <span>{service.features.length} feature{service.features.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

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
          Select
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
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#082c59]" /><span><strong>Delivery:</strong> {formatHours(service.delivery_time_hours)}</span></div>
          <div className="flex items-center gap-2"><Package className="w-5 h-5 text-[#082c59]" /><span><strong>Max:</strong> {service.max_weight_kg}kg</span></div>
          {service.features?.slice(0, 3).map((f) => (
            <Badge key={f} variant="secondary" className="capitalize">{f.replace(/_/g, ' ')}</Badge>
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
          Select Service
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
  const [urlParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('price_low');
  const [searchQuery, setSearchQuery] = useState('');

  const origin = urlParams.get('origin') || '';
  const destination = urlParams.get('destination') || '';
  const weight_kg = parseFloat(urlParams.get('weight_kg') || '0') || 0;
  const length_cm = parseFloat(urlParams.get('length_cm') || '0') || 0;
  const width_cm = parseFloat(urlParams.get('width_cm') || '0') || 0;
  const height_cm = parseFloat(urlParams.get('height_cm') || '0') || 0;
  const packageType = urlParams.get('package_type') || 'parcel';
  const shippingDate = urlParams.get('shipping_date');

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
    switch (sortBy) {
      case 'price_high':
        return filtered.sort((a, b) => (b.calculated_price || 0) - (a.calculated_price || 0));
      case 'fastest':
        return filtered.sort((a, b) => (a.delivery_time_hours || 9999) - (b.delivery_time_hours || 9999));
      case 'price_low':
      default:
        return filtered.sort((a, b) => (a.calculated_price || 0) - (b.calculated_price || 0));
    }
  }, [services, sortBy, searchQuery]);

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
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/packages')} className="gap-2" data-testid="back-to-search">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">{origin} → {destination}</h1>
              <p className="text-sm text-slate-500">
                {filteredServices.length} operator{filteredServices.length !== 1 ? 's' : ''} found • {weight_kg}kg
                {(length_cm || width_cm || height_cm) ? ` • ${length_cm}×${width_cm}×${height_cm} cm` : ''}
                {shippingDate ? ` • ${format(new Date(shippingDate), 'PPP')}` : ''}
              </p>
            </div>
          </div>

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
              <SelectTrigger className="w-48 bg-white"><SlidersHorizontal className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="fastest">Fastest Delivery</SelectItem>
              </SelectContent>
            </Select>
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
            <p className="text-slate-500 mb-4">No logistics operator currently serves this route with your package size/weight. Try adjusting your search.</p>
            <Button onClick={() => navigate('/services/packages')} className="bg-[#082c59]" data-testid="modify-search-btn">Modify Search</Button>
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
