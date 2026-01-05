import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Package, MapPin, Calendar, Star, 
  Clock, Building, Truck, LayoutGrid, List
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import { packageApi } from '@/api/management';

// Package sizes for reference
const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg' }
};

// Mock delivery services data
const MOCK_SERVICES = [
  {
    id: '1',
    service_name: 'Express Courier',
    operator_name: 'SpeedPost Cameroon',
    pickup_location: 'Yaoundé',
    delivery_location: 'Douala',
    service_type: 'express',
    delivery_time: '4-6 hours',
    dispatch_time: '09:00 AM',
    rating: 4.8,
    total_bookings: 245,
    status: 'active',
    prices_by_size: { S: 5000, M: 8000, L: 12000, XL: 18000, XXL: 30000 }
  },
  {
    id: '2',
    service_name: 'Standard Delivery',
    operator_name: 'CamPost',
    pickup_location: 'Yaoundé',
    delivery_location: 'Douala',
    service_type: 'standard',
    delivery_time: '24-48 hours',
    dispatch_time: '08:00 AM',
    rating: 4.5,
    total_bookings: 523,
    status: 'active',
    prices_by_size: { S: 2500, M: 4000, L: 6000, XL: 10000, XXL: 18000 }
  },
  {
    id: '3',
    service_name: 'Same Day Rush',
    operator_name: 'QuickShip',
    pickup_location: 'Yaoundé',
    delivery_location: 'Douala',
    service_type: 'same-day',
    delivery_time: '6-8 hours',
    dispatch_time: '07:00 AM',
    rating: 4.9,
    total_bookings: 189,
    status: 'active',
    prices_by_size: { S: 7500, M: 12000, L: 18000, XL: 25000, XXL: 40000 }
  },
  {
    id: '4',
    service_name: 'Overnight Delivery',
    operator_name: 'NightExpress',
    pickup_location: 'Yaoundé',
    delivery_location: 'Douala',
    service_type: 'overnight',
    delivery_time: 'Next morning by 10 AM',
    dispatch_time: '06:00 PM',
    rating: 4.7,
    total_bookings: 312,
    status: 'active',
    prices_by_size: { S: 6000, M: 9500, L: 14000, XL: 20000, XXL: 35000 }
  },
  {
    id: '5',
    service_name: 'Economy Shipping',
    operator_name: 'BudgetCargo',
    pickup_location: 'Yaoundé',
    delivery_location: 'Douala',
    service_type: 'standard',
    delivery_time: '3-5 days',
    dispatch_time: '10:00 AM',
    rating: 4.2,
    total_bookings: 892,
    status: 'active',
    prices_by_size: { S: 1500, M: 2500, L: 4000, XL: 7000, XXL: 12000 }
  }
];

const SERVICE_TYPE_COLORS = {
  express: 'bg-orange-100 text-orange-700',
  standard: 'bg-blue-100 text-blue-700',
  'same-day': 'bg-red-100 text-red-700',
  overnight: 'bg-purple-100 text-purple-700'
};

const SERVICE_TYPE_LABELS = {
  express: 'Express',
  standard: 'Standard',
  'same-day': 'Same Day',
  overnight: 'Overnight'
};

const ServiceCard = ({ service, searchParams, onSelect }) => {
  const price = service.prices_by_size?.[searchParams.package_size] || 0;

  return (
    <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-white border border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#082c59] to-[#0a4a8f] rounded-xl shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1">
                {service.service_name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Building className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600 font-medium">{service.operator_name}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={SERVICE_TYPE_COLORS[service.service_type]}>
              {SERVICE_TYPE_LABELS[service.service_type]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Route Information */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <MapPin className="h-4 w-4 text-green-500" />
              <span>From</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>To</span>
              <MapPin className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-semibold text-slate-800 text-sm">{service.pickup_location}</span>
            <div className="flex-1 mx-3 border-t-2 border-dashed border-slate-300"></div>
            <span className="font-semibold text-slate-800 text-sm">{service.delivery_location}</span>
          </div>
        </div>

        {/* Package & Delivery Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Package Size</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">{searchParams.package_size}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {PACKAGE_SIZES[searchParams.package_size]?.dimensions}
                </span>
              </div>
            </div>

            {service.delivery_time && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Est. Delivery</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{service.delivery_time}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {searchParams.shipping_date && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Shipping Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {format(new Date(searchParams.shipping_date), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            )}

            {service.dispatch_time && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Dispatch Time</p>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{service.dispatch_time}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rating and Price */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
              <span className="text-sm font-medium text-slate-700">{service.rating}</span>
              <span className="text-xs text-slate-500">({service.total_bookings} trips)</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium">Price</p>
            <p className="text-[#082c59] text-2xl font-bold">{formatFCFA(price)}</p>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => onSelect(service)}
          className="w-full bg-[#082c59] hover:bg-[#0a3a75] text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Package className="h-4 w-4 mr-2" />
          Book Now
        </Button>
      </CardContent>
    </Card>
  );
};

export default function PackagesResults() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState(null);
  const [sortBy, setSortBy] = useState('rating');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const params = JSON.parse(sessionStorage.getItem('packageSearchParams') || 'null');
    if (!params) {
      navigate('/services/packages');
      return;
    }
    setSearchParams(params);
    loadServices(params);
  }, [navigate]);

  const loadServices = async (params) => {
    try {
      setLoading(true);
      const res = await packageApi.list({
        pickup_location: params.pickup_location,
        delivery_location: params.delivery_location
      });
      const data = res.data?.services || [];
      if (data.length > 0) {
        setServices(data);
      } else {
        // Use mock data filtered by route
        const filtered = MOCK_SERVICES.filter(
          s => s.pickup_location === params.pickup_location && 
               s.delivery_location === params.delivery_location
        );
        // If no exact match, show all mock services with updated locations
        if (filtered.length > 0) {
          setServices(filtered);
        } else {
          setServices(MOCK_SERVICES.map(s => ({
            ...s,
            pickup_location: params.pickup_location,
            delivery_location: params.delivery_location
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load services:', error);
      // Use mock data on error
      setServices(MOCK_SERVICES.map(s => ({
        ...s,
        pickup_location: params.pickup_location,
        delivery_location: params.delivery_location
      })));
    } finally {
      setLoading(false);
    }
  };

  const sortedServices = useMemo(() => {
    if (!services.length) return [];
    return [...services].sort((a, b) => {
      const priceA = a.prices_by_size?.[searchParams?.package_size] || 0;
      const priceB = b.prices_by_size?.[searchParams?.package_size] || 0;
      
      switch (sortBy) {
        case 'price_low': return priceA - priceB;
        case 'price_high': return priceB - priceA;
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'fastest': return (a.delivery_time?.includes('hour') ? 0 : 1) - (b.delivery_time?.includes('hour') ? 0 : 1);
        default: return 0;
      }
    });
  }, [services, sortBy, searchParams?.package_size]);

  const handleSelectService = (service) => {
    sessionStorage.setItem('selectedPackageService', JSON.stringify(service));
    sessionStorage.setItem('packageBookingParams', JSON.stringify(searchParams));
    navigate(`/services/packages/booking/${service.id}`);
  };

  if (!searchParams) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/services/packages')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Delivery Services</h1>
                <p className="text-sm text-gray-600">
                  {searchParams.pickup_location} → {searchParams.delivery_location} • Size {searchParams.package_size}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={viewMode === 'grid' ? 'bg-[#082c59]' : ''}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-[#082c59]' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="fastest">Fastest Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59] mx-auto"></div>
            <p className="mt-4 text-slate-600">Finding delivery services...</p>
          </div>
        ) : sortedServices.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-slate-200 rounded-full flex items-center justify-center">
              <Package className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">No services found</h2>
            <p className="text-slate-500 mb-4">Try a different route or date</p>
            <Button onClick={() => navigate('/services/packages')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : (
          <>
            <p className="text-slate-600 mb-4">{sortedServices.length} delivery services available</p>
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
            }>
              {sortedServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  searchParams={searchParams}
                  onSelect={handleSelectService}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
