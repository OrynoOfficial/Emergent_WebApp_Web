import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  ArrowLeft, Car, MapPin, Users, Fuel, Settings, Star, SlidersHorizontal,
  Snowflake, Radio, Navigation, Shield, Heart, LayoutGrid, List, Search,
  ChevronLeft, ChevronRight, X, Loader2, Gauge, Calendar, Check
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { useFavourites } from '@/hooks/useFavourites';
import { getLocationParam } from '@/components/LocationSelectionModal';
import { differenceInDays, format } from 'date-fns';

const VEHICLE_TYPES = ['all', 'economy', 'compact', 'sedan', 'suv', 'luxury', 'van'];
const TRANSMISSION_TYPES = ['all', 'automatic', 'manual'];

const MOCK_VEHICLES = [
  { id: '1', name: 'Toyota Corolla', type: 'sedan', brand: 'Toyota', model: 'Corolla', year: 2023, price_per_day: 35000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps'], rating: 4.7, trips: 89, images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'] },
  { id: '2', name: 'Honda CR-V', type: 'suv', brand: 'Honda', model: 'CR-V', year: 2022, price_per_day: 55000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps', 'sunroof'], rating: 4.8, trips: 56, images: ['https://images.unsplash.com/photo-1568844293986-8c8f5c01b3bc?w=800'] },
  { id: '3', name: 'Mercedes C-Class', type: 'luxury', brand: 'Mercedes', model: 'C-Class', year: 2023, price_per_day: 95000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps', 'leather', 'sunroof'], rating: 4.9, trips: 34, images: ['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800'] },
  { id: '4', name: 'Toyota Hiace', type: 'van', brand: 'Toyota', model: 'Hiace', year: 2021, price_per_day: 75000, seats: 15, transmission: 'manual', fuel_type: 'diesel', features: ['ac'], rating: 4.5, trips: 123, images: ['https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800'] },
  { id: '5', name: 'Suzuki Swift', type: 'economy', brand: 'Suzuki', model: 'Swift', year: 2022, price_per_day: 25000, seats: 5, transmission: 'manual', fuel_type: 'petrol', features: ['ac', 'bluetooth'], rating: 4.4, trips: 67, images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800'] },
  { id: '6', name: 'BMW X5', type: 'suv', brand: 'BMW', model: 'X5', year: 2023, price_per_day: 120000, seats: 7, transmission: 'automatic', fuel_type: 'diesel', features: ['ac', 'bluetooth', 'gps', 'leather', 'sunroof', '4wd'], rating: 4.9, trips: 28, images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800'] },
];

const getFeatureIcon = (feature) => {
  switch (feature) {
    case 'ac': return Snowflake;
    case 'bluetooth': return Radio;
    case 'gps': return Navigation;
    case 'leather': return Star;
    default: return Check;
  }
};

const getVehicleTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'luxury': return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white';
    case 'suv': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white';
    case 'sedan': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    case 'economy': return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
    case 'van': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
    default: return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
};

// Grid View Vehicle Card - Compact
const VehicleCardGrid = ({ vehicle, days, onSelect, isFav, toggleFav }) => {
  const totalPrice = vehicle.price_per_day * days;
  const defaultImage = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800';
  const image = vehicle.images?.[0] || vehicle.image || defaultImage;

  return (
    <Card className="group overflow-hidden bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300">
      {/* Image */}
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <img src={image} alt={vehicle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <button
          onClick={(e) => { e.stopPropagation(); if(toggleFav) toggleFav(vehicle); }}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-all"
        >
          <Heart className={`h-4 w-4 ${(isFav && isFav(vehicle._id || vehicle.id)) ? 'fill-red-500 text-red-500' : 'text-slate-500'}`} />
        </button>
        <Badge className={`absolute top-2 left-2 capitalize text-[10px] px-2 py-0.5 ${getVehicleTypeColor(vehicle.type)}`}>
          {vehicle.type}
        </Badge>
        {vehicle.rating && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {vehicle.rating}
          </div>
        )}
      </div>
      
      <CardContent className="p-3">
        <h3 className="font-bold text-sm text-slate-900 mb-0.5">{vehicle.name}</h3>
        <p className="text-[10px] text-slate-500 mb-2">{vehicle.year} · {vehicle.brand}</p>
        
        {/* Specs Row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
            <Users className="w-3 h-3" /> {vehicle.seats}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded capitalize">
            <Settings className="w-3 h-3" /> {vehicle.transmission}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded capitalize">
            <Fuel className="w-3 h-3" /> {vehicle.fuel_type}
          </span>
        </div>
        
        {/* Features */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {vehicle.features?.slice(0, 3).map((feature, idx) => {
            const Icon = getFeatureIcon(feature);
            return (
              <span key={idx} className="flex items-center gap-0.5 text-[10px] text-slate-500">
                <Icon className="h-2.5 w-2.5" /> {feature}
              </span>
            );
          })}
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <div>
            <div className="text-lg font-bold text-[#082c59]">{formatFCFA(vehicle.price_per_day)}</div>
            <div className="text-[10px] text-slate-500">per day{days > 1 ? ` · ${formatFCFA(totalPrice)} total` : ''}</div>
          </div>
          <Button onClick={() => onSelect(vehicle)} size="sm" className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs h-8 px-3">
            Select
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Vehicle Card - Compact
const VehicleCardList = ({ vehicle, days, onSelect, isFav, toggleFav }) => {
  const totalPrice = vehicle.price_per_day * days;
  const defaultImage = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800';
  const image = vehicle.images?.[0] || vehicle.image || defaultImage;

  return (
    <Card className="overflow-hidden bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-56 relative h-44 md:h-auto md:min-h-[160px] flex-shrink-0">
          <img src={image} alt={vehicle.name} className="w-full h-full object-cover" />
          <Badge className={`absolute top-2 left-2 capitalize text-[10px] px-2 py-0.5 ${getVehicleTypeColor(vehicle.type)}`}>
            {vehicle.type}
          </Badge>
          {vehicle.rating && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {vehicle.rating} ({vehicle.trips} trips)
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 mb-0.5">{vehicle.name}</h3>
            <p className="text-xs text-slate-500 mb-3">{vehicle.year} · {vehicle.brand} {vehicle.model}</p>
            
            <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.seats} seats</span>
              <span className="flex items-center gap-1 capitalize"><Settings className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.transmission}</span>
              <span className="flex items-center gap-1 capitalize"><Fuel className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.fuel_type}</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {vehicle.features?.map((feature, idx) => {
                const Icon = getFeatureIcon(feature);
                return (
                  <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded text-[10px] text-slate-600 capitalize border border-slate-100">
                    <Icon className="w-2.5 h-2.5" /> {feature}
                  </span>
                );
              })}
            </div>
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
            <div>
              <div className="text-lg font-bold text-[#082c59]">{formatFCFA(vehicle.price_per_day)}</div>
              <div className="text-[10px] text-slate-500">per day{days > 1 ? ` · Total: ${formatFCFA(totalPrice)}` : ''}</div>
            </div>
            <Button onClick={() => onSelect(vehicle)} size="sm" className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg h-9 px-4 text-xs">
              Select Vehicle
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function CarRentalResults() {

  const { isFav, toggleFav } = useFavourites('car_rental');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('price_low');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTransmission, setSelectedTransmission] = useState('all');

  const pickupLocation = searchParams.get('pickup') || '';
  const pickupDate = searchParams.get('pickupDate') || '';
  const returnDate = searchParams.get('returnDate') || '';
  
  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;
    return Math.max(1, differenceInDays(new Date(returnDate), new Date(pickupDate)));
  }, [pickupDate, returnDate]);

  useEffect(() => {
    loadVehicles();
  }, [searchParams]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/car-rental/', { params: { city: pickupLocation, ...getLocationParam() } });
      if (res.data.cars?.length > 0) {
        setVehicles(res.data.cars.map(car => ({
          ...car,
          id: car.id || car._id,
          name: `${car.make || car.brand} ${car.model}`,
          brand: car.make || car.brand,
          type: car.vehicle_type || car.type || 'sedan',
          price_per_day: car.price_per_day || 35000,
          seats: car.seats || 5,
          transmission: car.transmission || 'automatic',
          fuel_type: car.fuel_type || 'petrol',
          features: car.features || ['ac'],
          rating: car.rating || 4.5,
        })));
      } else {
        setVehicles(MOCK_VEHICLES);
      }
    } catch (error) {
      setVehicles(MOCK_VEHICLES);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    let filtered = [...vehicles];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.name?.toLowerCase().includes(query) ||
        v.brand?.toLowerCase().includes(query)
      );
    }
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(v => v.type === selectedType);
    }
    
    if (selectedTransmission !== 'all') {
      filtered = filtered.filter(v => v.transmission === selectedTransmission);
    }
    
    switch (sortBy) {
      case 'price_high':
        return filtered.sort((a, b) => b.price_per_day - a.price_per_day);
      case 'rating':
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'price_low':
      default:
        return filtered.sort((a, b) => a.price_per_day - b.price_per_day);
    }
  }, [vehicles, sortBy, searchQuery, selectedType, selectedTransmission]);

  const handleSelectVehicle = (vehicle) => {
    const vehicleId = vehicle._id || vehicle.id;
    sessionStorage.setItem('selectedVehicle', JSON.stringify({
      ...vehicle,
      pickupLocation,
      pickupDate,
      returnDate,
      days
    }));
    navigate(`/services/car-rental/details/${vehicleId}?pickupDate=${pickupDate}&returnDate=${returnDate}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding vehicles for you...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/car-rental')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">Available Vehicles</h1>
              <p className="text-sm text-slate-500">
                {filteredVehicles.length} vehicles found • {pickupLocation && `${pickupLocation} • `}
                {pickupDate && returnDate && `${format(new Date(pickupDate), 'MMM d')} - ${format(new Date(returnDate), 'MMM d')} (${days} days)`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-36 bg-white">
                <Car className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {VEHICLE_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type === 'all' ? 'All Types' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTransmission} onValueChange={setSelectedTransmission}>
              <SelectTrigger className="w-40 bg-white">
                <Settings className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Transmission" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {TRANSMISSION_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type === 'all' ? 'All' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
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
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-16">
            <Car className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No vehicles found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/car-rental')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <VehicleCardGrid
                key={vehicle.id}
                vehicle={vehicle}
                days={days}
                onSelect={handleSelectVehicle}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVehicles.map((vehicle) => (
              <VehicleCardList
                key={vehicle.id}
                vehicle={vehicle}
                days={days}
                onSelect={handleSelectVehicle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
