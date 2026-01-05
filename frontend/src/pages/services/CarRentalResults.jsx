import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, Car, MapPin, Users, Fuel, Settings, 
  Star, Filter, SlidersHorizontal, Check,
  Snowflake, Radio, Navigation, Shield
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const VEHICLE_TYPES = ['all', 'economy', 'compact', 'sedan', 'suv', 'luxury', 'van'];
const TRANSMISSION_TYPES = ['all', 'automatic', 'manual'];
const FUEL_TYPES = ['all', 'petrol', 'diesel', 'hybrid', 'electric'];

const MOCK_VEHICLES = [
  { id: '1', name: 'Toyota Corolla', type: 'sedan', brand: 'Toyota', model: 'Corolla', year: 2023, price_per_day: 35000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps'], rating: 4.7, trips: 89, image: '' },
  { id: '2', name: 'Honda CR-V', type: 'suv', brand: 'Honda', model: 'CR-V', year: 2022, price_per_day: 55000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps', 'sunroof'], rating: 4.8, trips: 56, image: '' },
  { id: '3', name: 'Mercedes C-Class', type: 'luxury', brand: 'Mercedes', model: 'C-Class', year: 2023, price_per_day: 95000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth', 'gps', 'leather', 'sunroof'], rating: 4.9, trips: 34, image: '' },
  { id: '4', name: 'Toyota Hiace', type: 'van', brand: 'Toyota', model: 'Hiace', year: 2021, price_per_day: 75000, seats: 15, transmission: 'manual', fuel_type: 'diesel', features: ['ac'], rating: 4.5, trips: 123, image: '' },
  { id: '5', name: 'Suzuki Swift', type: 'economy', brand: 'Suzuki', model: 'Swift', year: 2022, price_per_day: 25000, seats: 5, transmission: 'manual', fuel_type: 'petrol', features: ['ac', 'bluetooth'], rating: 4.4, trips: 67, image: '' },
  { id: '6', name: 'BMW X5', type: 'suv', brand: 'BMW', model: 'X5', year: 2023, price_per_day: 120000, seats: 7, transmission: 'automatic', fuel_type: 'diesel', features: ['ac', 'bluetooth', 'gps', 'leather', 'sunroof', '4wd'], rating: 4.9, trips: 28, image: '' },
  { id: '7', name: 'Hyundai Accent', type: 'compact', brand: 'Hyundai', model: 'Accent', year: 2022, price_per_day: 30000, seats: 5, transmission: 'automatic', fuel_type: 'petrol', features: ['ac', 'bluetooth'], rating: 4.6, trips: 92, image: '' },
  { id: '8', name: 'Land Cruiser Prado', type: 'suv', brand: 'Toyota', model: 'Land Cruiser Prado', year: 2022, price_per_day: 150000, seats: 7, transmission: 'automatic', fuel_type: 'diesel', features: ['ac', 'bluetooth', 'gps', 'leather', '4wd'], rating: 4.8, trips: 45, image: '' }
];

export default function CarRentalResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    type: 'all',
    transmission: 'all',
    fuel: 'all',
    priceRange: [0, 200000],
    features: []
  });
  const [sortBy, setSortBy] = useState('price_low');

  const pickupLocation = searchParams.get('pickup') || '';
  const pickupDate = searchParams.get('pickupDate') || '';
  const returnDate = searchParams.get('returnDate') || '';

  useEffect(() => {
    loadVehicles();
  }, [searchParams]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const params = {
        city: pickupLocation,
        vehicle_type: filters.type !== 'all' ? filters.type : undefined,
        transmission: filters.transmission !== 'all' ? filters.transmission : undefined,
        fuel_type: filters.fuel !== 'all' ? filters.fuel : undefined
      };
      
      const res = await api.get('/car-rental/', { params });
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
          trips: car.trips || 0
        })));
      } else {
        // Use fallback mock data if API returns empty
        setVehicles(MOCK_VEHICLES);
      }
    } catch (error) {
      console.error('Failed to load vehicles:', error);
      setVehicles(MOCK_VEHICLES);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles
    .filter(v => filters.type === 'all' || v.type === filters.type)
    .filter(v => filters.transmission === 'all' || v.transmission === filters.transmission)
    .filter(v => filters.fuel === 'all' || v.fuel_type === filters.fuel)
    .filter(v => v.price_per_day >= filters.priceRange[0] && v.price_per_day <= filters.priceRange[1])
    .sort((a, b) => {
      if (sortBy === 'price_low') return a.price_per_day - b.price_per_day;
      if (sortBy === 'price_high') return b.price_per_day - a.price_per_day;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });

  const getFeatureIcon = (feature) => {
    switch (feature) {
      case 'ac': return <Snowflake className="w-3 h-3" />;
      case 'bluetooth': return <Radio className="w-3 h-3" />;
      case 'gps': return <Navigation className="w-3 h-3" />;
      default: return <Check className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/services/car-rental')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Modify Search
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Available Vehicles</h1>
                <p className="text-sm text-gray-600">
                  {pickupLocation && `${pickupLocation} • `}
                  {pickupDate && returnDate && `${pickupDate} - ${returnDate}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
                <Filter className="w-4 h-4 mr-2" /> Filters
              </Button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className={`w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card>
              <CardContent className="p-4 space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Vehicle Type</h3>
                  <Select value={filters.type} onValueChange={v => setFilters(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {VEHICLE_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t === 'all' ? 'All Types' : t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Transmission</h3>
                  <Select value={filters.transmission} onValueChange={v => setFilters(p => ({ ...p, transmission: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {TRANSMISSION_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t === 'all' ? 'Any' : t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Fuel Type</h3>
                  <Select value={filters.fuel} onValueChange={v => setFilters(p => ({ ...p, fuel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {FUEL_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t === 'all' ? 'Any' : t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Price Range (per day)</h3>
                  <div className="px-2">
                    <Slider
                      value={filters.priceRange}
                      onValueChange={v => setFilters(p => ({ ...p, priceRange: v }))}
                      min={0}
                      max={200000}
                      step={5000}
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <span>{formatFCFA(filters.priceRange[0])}</span>
                      <span>{formatFCFA(filters.priceRange[1])}</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setFilters({ type: 'all', transmission: 'all', fuel: 'all', priceRange: [0, 200000], features: [] })}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-4">{filteredVehicles.length} vehicles found</p>
            
            {loading ? (
              <div className="text-center py-12">Loading vehicles...</div>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No vehicles match your criteria</div>
            ) : (
              <div className="space-y-4">
                {filteredVehicles.map(vehicle => (
                  <Card key={vehicle.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/services/car-rental/details/${vehicle.id}`)}>
                    <div className="flex flex-col md:flex-row">
                      <div className="w-full md:w-64 h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Car className="w-20 h-20 text-slate-400" />
                      </div>
                      <CardContent className="p-4 flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge className="capitalize mb-2">{vehicle.type}</Badge>
                            <h3 className="text-xl font-semibold">{vehicle.name}</h3>
                            <p className="text-gray-500">{vehicle.brand} {vehicle.model} • {vehicle.year}</p>
                          </div>
                          <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold">{vehicle.rating}</span>
                            <span className="text-xs text-gray-500">({vehicle.trips} trips)</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 my-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {vehicle.seats} seats</span>
                          <span className="flex items-center gap-1"><Settings className="w-4 h-4" /> {vehicle.transmission}</span>
                          <span className="flex items-center gap-1"><Fuel className="w-4 h-4" /> {vehicle.fuel_type}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {vehicle.features?.slice(0, 4).map(f => (
                            <Badge key={f} variant="outline" className="text-xs capitalize">
                              {getFeatureIcon(f)} {f}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                          <div>
                            <span className="text-2xl font-bold text-[#082c59]">{formatFCFA(vehicle.price_per_day)}</span>
                            <span className="text-gray-500"> / day</span>
                          </div>
                          <Button className="bg-[#082c59]">View Details</Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
