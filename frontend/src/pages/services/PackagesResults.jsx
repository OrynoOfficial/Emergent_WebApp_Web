import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Package, MapPin, Calendar, Star, Clock, Building, Truck, 
  LayoutGrid, List, Search, SlidersHorizontal, Heart, Loader2, Zap, Timer, Moon
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import { packageApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import api from '@/api/client';

const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg' }
};

const MOCK_SERVICES = [
  { id: '1', service_name: 'Express Courier', operator_name: 'SpeedPost Cameroon', pickup_location: 'Yaoundé', delivery_location: 'Douala', service_type: 'express', delivery_time: '4-6 hours', dispatch_time: '09:00 AM', rating: 4.8, total_bookings: 245, prices_by_size: { S: 5000, M: 8000, L: 12000, XL: 18000, XXL: 30000 } },
  { id: '2', service_name: 'Standard Delivery', operator_name: 'CamPost', pickup_location: 'Yaoundé', delivery_location: 'Douala', service_type: 'standard', delivery_time: '24-48 hours', dispatch_time: '08:00 AM', rating: 4.5, total_bookings: 523, prices_by_size: { S: 2500, M: 4000, L: 6000, XL: 10000, XXL: 18000 } },
  { id: '3', service_name: 'Same Day Rush', operator_name: 'QuickShip', pickup_location: 'Yaoundé', delivery_location: 'Douala', service_type: 'same-day', delivery_time: '6-8 hours', dispatch_time: '07:00 AM', rating: 4.9, total_bookings: 189, prices_by_size: { S: 7500, M: 12000, L: 18000, XL: 25000, XXL: 40000 } },
  { id: '4', service_name: 'Overnight Delivery', operator_name: 'NightExpress', pickup_location: 'Yaoundé', delivery_location: 'Douala', service_type: 'overnight', delivery_time: 'Next morning by 10 AM', dispatch_time: '06:00 PM', rating: 4.7, total_bookings: 312, prices_by_size: { S: 6000, M: 9500, L: 14000, XL: 20000, XXL: 35000 } },
  { id: '5', service_name: 'Economy Shipping', operator_name: 'BudgetCargo', pickup_location: 'Yaoundé', delivery_location: 'Douala', service_type: 'standard', delivery_time: '3-5 days', dispatch_time: '10:00 AM', rating: 4.2, total_bookings: 892, prices_by_size: { S: 1500, M: 2500, L: 4000, XL: 7000, XXL: 12000 } }
];

const SERVICE_TYPE_COLORS = {
  express: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white',
  standard: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
  'same-day': 'bg-gradient-to-r from-red-500 to-red-600 text-white',
  overnight: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
};

const SERVICE_TYPE_LABELS = {
  express: 'Express',
  standard: 'Standard',
  'same-day': 'Same Day',
  overnight: 'Overnight'
};

const getServiceIcon = (type) => {
  switch (type) {
    case 'express': return Zap;
    case 'same-day': return Timer;
    case 'overnight': return Moon;
    default: return Truck;
  }
};

// Grid View Service Card
const ServiceCardGrid = ({ service, packageSize, onSelect }) => {
  // Favourites handled by parent via isFav/toggleFav props
  const price = service.prices_by_size?.[packageSize] || 0;
  const ServiceIcon = getServiceIcon(service.service_type);
  
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Header */}
      <div className="relative h-32 bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] p-4">
        <button
          onClick={(e) => { e.stopPropagation(); if(toggleFav) toggleFav(item || {});  }}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
        >
          <Heart className={`h-4 w-4 ${(isFav && isFav(itemId)) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </button>
        
        <Badge className={`absolute top-3 left-3 ${SERVICE_TYPE_COLORS[service.service_type]}`}>
          <ServiceIcon className="w-3 h-3 mr-1" />
          {SERVICE_TYPE_LABELS[service.service_type]}
        </Badge>
        
        <div className="absolute bottom-4 left-4">
          <div className="flex items-center gap-2 text-white">
            <Package className="w-5 h-5" />
            <span className="font-bold text-lg">{service.service_name}</span>
          </div>
          <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
            <Building className="w-3 h-3" />
            {service.operator_name}
          </div>
        </div>
      </div>
      
      <CardContent className="p-5">
        {/* Route */}
        <div className="flex items-center justify-between text-sm mb-4 bg-slate-50 rounded-lg p-3">
          <div className="text-center">
            <MapPin className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <span className="text-slate-600">{service.pickup_location}</span>
          </div>
          <div className="flex-1 px-2">
            <div className="border-t-2 border-dashed border-slate-300" />
          </div>
          <div className="text-center">
            <MapPin className="w-4 h-4 text-red-500 mx-auto mb-1" />
            <span className="text-slate-600">{service.delivery_location}</span>
          </div>
        </div>
        
        {/* Info */}
        <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-[#082c59]" />
            <span>{service.delivery_time}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>{service.rating} ({service.total_bookings})</span>
          </div>
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Size {packageSize}</div>
            <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(price)}</div>
          </div>
          <Button onClick={() => onSelect(service)} className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
            Select
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Service Card
const ServiceCardList = ({ service, packageSize, onSelect }) => {
  const price = service.prices_by_size?.[packageSize] || 0;
  const ServiceIcon = getServiceIcon(service.service_type);
  
  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Left Section */}
        <div className="md:w-1/4 p-6 bg-gradient-to-br from-[#082c59] to-[#0a3a75] text-white flex flex-col justify-center">
          <Badge className={`w-fit mb-2 ${SERVICE_TYPE_COLORS[service.service_type]}`}>
            <ServiceIcon className="w-3 h-3 mr-1" />
            {SERVICE_TYPE_LABELS[service.service_type]}
          </Badge>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5" />
            <span className="font-bold">{service.service_name}</span>
          </div>
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <Building className="w-3 h-3" />
            {service.operator_name}
          </div>
        </div>
        
        {/* Middle Section */}
        <div className="md:w-1/2 p-6">
          {/* Route */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-500" />
              <span className="font-medium">{service.pickup_location}</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-slate-300" />
            <div className="flex items-center gap-2">
              <span className="font-medium">{service.delivery_location}</span>
              <MapPin className="w-5 h-5 text-red-500" />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#082c59]" />
              <span><strong>Delivery:</strong> {service.delivery_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#082c59]" />
              <span><strong>Dispatch:</strong> {service.dispatch_time}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{service.rating} ({service.total_bookings} deliveries)</span>
            </div>
          </div>
        </div>
        
        {/* Right Section */}
        <div className="md:w-1/4 p-6 bg-slate-50 flex flex-col justify-center items-center border-l">
          <div className="text-sm text-slate-500 mb-1">Size {packageSize}</div>
          <div className="text-3xl font-bold text-[#082c59] mb-1">{formatFCFA(price)}</div>
          <Button onClick={() => onSelect(service)} className="w-full mt-3 bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
            Select Service
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default function PackagesResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const packageSize = searchParams.get('size') || 'M';

  useEffect(() => {
    loadServices();
  }, [searchParams]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await packageApi.searchRoutes({ from, to });
      if (res.data.services?.length > 0) {
        setServices(res.data.services);
      } else {
        setServices(MOCK_SERVICES);
      }
    } catch (error) {
      setServices(MOCK_SERVICES);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    let filtered = [...services];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.service_name?.toLowerCase().includes(query) ||
        s.operator_name?.toLowerCase().includes(query)
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(s => s.service_type === typeFilter);
    }
    
    const getPrice = (s) => s.prices_by_size?.[packageSize] || 0;
    
    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) => getPrice(a) - getPrice(b));
      case 'price_high':
        return filtered.sort((a, b) => getPrice(b) - getPrice(a));
      case 'bookings':
        return filtered.sort((a, b) => (b.total_bookings || 0) - (a.total_bookings || 0));
      case 'rating':
      default:
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }, [services, sortBy, searchQuery, typeFilter, packageSize]);

  const handleSelect = (service) => {
    sessionStorage.setItem('selectedPackageService', JSON.stringify({
      ...service,
      from,
      to,
      packageSize,
      price: service.prices_by_size?.[packageSize] || 0
    }));
    navigate(`/services/packages/booking/${service.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding delivery services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/packages')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">
                {from} → {to}
              </h1>
              <p className="text-sm text-slate-500">
                {filteredServices.length} services found • Package Size: {packageSize}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-white">
                <Truck className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="express">Express</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="same-day">Same Day</SelectItem>
                <SelectItem value="overnight">Overnight</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="bookings">Most Popular</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white shadow-sm' : ''}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white shadow-sm' : ''}
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
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No services found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/packages')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <ServiceCardGrid key={service.id} service={service} packageSize={packageSize} onSelect={handleSelect} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map((service) => (
              <ServiceCardList key={service.id} service={service} packageSize={packageSize} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}