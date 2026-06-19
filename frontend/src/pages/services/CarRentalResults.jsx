import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SmartSearchBar from '@/components/search/SmartSearchBar';
import FilterChipSelect from '@/components/shared/FilterChipSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import CarRentalDetails from '@/pages/services/CarRentalDetails';
import { 
  ArrowLeft, Car, MapPin, Users, Fuel, Settings, Star, SlidersHorizontal,
  Snowflake, Radio, Navigation, Shield, LayoutGrid, List, Search,
  ChevronLeft, ChevronRight, X, Loader2, Gauge, Calendar, CalendarDays, Check, Edit2
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';
import DatePickerField from '@/components/shared/DatePickerField';
import ViewModeToggle from '@/components/common/ViewModeToggle';
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

// Distinct (but limited) palette for amenity chips — 5 colours rotated by feature
// keyword so users can scan a card at a glance.
const FEATURE_CHIP_COLORS = {
  ac:               'bg-sky-50 text-sky-700 border-sky-200',
  bluetooth:        'bg-indigo-50 text-indigo-700 border-indigo-200',
  gps:              'bg-emerald-50 text-emerald-700 border-emerald-200',
  leather:          'bg-amber-50 text-amber-700 border-amber-200',
  leather_seats:    'bg-amber-50 text-amber-700 border-amber-200',
  sunroof:          'bg-rose-50 text-rose-700 border-rose-200',
  cruise_control:   'bg-violet-50 text-violet-700 border-violet-200',
  backup_camera:    'bg-violet-50 text-violet-700 border-violet-200',
  usb:              'bg-indigo-50 text-indigo-700 border-indigo-200',
  power_outlet:     'bg-indigo-50 text-indigo-700 border-indigo-200',
};
const getFeatureChipClass = (feature) => FEATURE_CHIP_COLORS[feature] || 'bg-slate-50 text-slate-700 border-slate-200';

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
  const city = vehicle.city || vehicle.pickup_locations?.[0];

  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <img src={image} alt={vehicle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <SubscribeButton operatorId={vehicle.operator_id} operatorName={vehicle.operator_name} variant="icon" />
          <FavouriteButton
            isFavourite={!!(isFav && isFav(vehicle._id || vehicle.id))}
            onToggle={() => toggleFav && toggleFav(vehicle)}
            testId={`favourite-${vehicle._id || vehicle.id}`}
            className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all"
            emptyClass="text-slate-500"
          />
        </div>
        <Badge className={`absolute top-2 left-2 capitalize text-[10px] px-2 py-0.5 shadow-sm ${getVehicleTypeColor(vehicle.type)}`}>
          {vehicle.type}
        </Badge>
        {vehicle.rating ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {vehicle.rating}
            {vehicle.reviews_count ? <span className="text-white/70">({vehicle.reviews_count})</span> : null}
          </div>
        ) : null}
        {vehicle.units_available != null && (
          <div className="absolute bottom-2 left-2 z-10" data-testid={`car-fomo-grid-${vehicle._id || vehicle.id}`}>
            <AlmostSoldOutBadge count={vehicle.units_available} unit="cars" />
          </div>
        )}
      </div>

      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="font-bold text-sm text-slate-900 leading-tight">{vehicle.name}</h3>
          {vehicle.year && <span className="text-[10px] text-slate-500 shrink-0">{vehicle.year}</span>}
        </div>
        <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
          <Settings className="w-3 h-3" /> {vehicle.brand}{vehicle.model ? ` · ${vehicle.model}` : ''}
          {city && (
            <>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{city}</span>
            </>
          )}
        </p>

        {/* Specs Row */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
            <Users className="w-3 h-3" /> {vehicle.seats} seats
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded capitalize">
            <Settings className="w-3 h-3" /> {vehicle.transmission}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded capitalize">
            <Fuel className="w-3 h-3" /> {vehicle.fuel_type}
          </span>
        </div>

        {/* Policy highlights */}
        {(vehicle.mileage_policy || vehicle.fuel_policy) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {vehicle.mileage_policy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                <Gauge className="w-2.5 h-2.5" /> {vehicle.mileage_policy}
              </span>
            )}
            {vehicle.fuel_policy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                {vehicle.fuel_policy}
              </span>
            )}
          </div>
        )}

        {/* Features (max 4) */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {vehicle.features?.slice(0, 4).map((feature, idx) => {
            const Icon = getFeatureIcon(feature);
            return (
              <span key={idx} className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded capitalize border ${getFeatureChipClass(feature)}`}>
                <Icon className="h-2.5 w-2.5" /> {feature.replace(/_/g, ' ')}
              </span>
            );
          })}
          {vehicle.features?.length > 4 && (
            <span className="text-[10px] text-slate-400">+{vehicle.features.length - 4}</span>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <div>
            <div className="text-lg font-bold text-[#082c59]">{formatFCFA(vehicle.price_per_day)}</div>
            <div className="text-[10px] text-slate-500">
              per day{days > 1 ? ` · ${formatFCFA(totalPrice)} total` : ''}
            </div>
          </div>
          <Button onClick={() => onSelect(vehicle)} size="sm" className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs h-8 px-3 shadow-sm" data-testid="car-rental-view-details-grid">
            View Details
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
  const city = vehicle.city || vehicle.pickup_locations?.[0];

  return (
    <Card className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-60 relative h-48 md:h-auto md:min-h-[176px] flex-shrink-0">
          <img src={image} alt={vehicle.name} className="w-full h-full object-cover" />
          <Badge className={`absolute top-2 left-2 capitalize text-[10px] px-2 py-0.5 shadow-sm ${getVehicleTypeColor(vehicle.type)}`}>
            {vehicle.type}
          </Badge>
          <div className="absolute top-2 right-2 flex gap-1.5">
            <SubscribeButton operatorId={vehicle.operator_id} operatorName={vehicle.operator_name} variant="icon" />
            <FavouriteButton
              isFavourite={!!(isFav && isFav(vehicle._id || vehicle.id))}
              onToggle={() => toggleFav && toggleFav(vehicle)}
              testId={`favourite-list-${vehicle._id || vehicle.id}`}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all"
              emptyClass="text-slate-500"
            />
          </div>
          {vehicle.rating ? (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {vehicle.rating}
              {vehicle.reviews_count ? <span className="text-white/70">({vehicle.reviews_count})</span> : null}
            </div>
          ) : null}
          {vehicle.units_available != null && (
            <div className="absolute bottom-2 left-2 z-10" data-testid={`car-fomo-list-${vehicle._id || vehicle.id}`}>
              <AlmostSoldOutBadge count={vehicle.units_available} unit="cars" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 leading-tight">{vehicle.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center flex-wrap gap-x-2">
                  <span>{vehicle.year} · {vehicle.brand} {vehicle.model}</span>
                  {city && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{city}</span>
                    </>
                  )}
                  {vehicle.operator_name && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">by <span className="font-medium">{vehicle.operator_name}</span></span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-3 mb-2 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.seats} seats</span>
              <span className="flex items-center gap-1 capitalize"><Settings className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.transmission}</span>
              <span className="flex items-center gap-1 capitalize"><Fuel className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.fuel_type}</span>
              {vehicle.fuel_consumption && (
                <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-[#082c59]" /> {vehicle.fuel_consumption}</span>
              )}
            </div>

            {/* Policy highlights */}
            {(vehicle.mileage_policy || vehicle.fuel_policy) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {vehicle.mileage_policy && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {vehicle.mileage_policy}
                  </span>
                )}
                {vehicle.fuel_policy && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                    Fuel: {vehicle.fuel_policy}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {vehicle.features?.map((feature, idx) => {
                const Icon = getFeatureIcon(feature);
                return (
                  <span key={idx} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] capitalize border ${getFeatureChipClass(feature)}`}>
                    <Icon className="w-2.5 h-2.5" /> {feature.replace(/_/g, ' ')}
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
            <Button onClick={() => onSelect(vehicle)} size="sm" className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg h-9 px-4 text-xs shadow-sm" data-testid="car-rental-view-details-list">
              View Details
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function CarRentalResults() {

  const { isFav, toggleFav } = useFavourites('car_rental');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('price_low');
  const [smartFilters, setSmartFilters] = useState({ places: new Set(), operators: new Set(), listings: new Set() });
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTransmission, setSelectedTransmission] = useState('all');

  const pickupLocation = searchParams.get('pickup') || '';
  // URL params — accept both the canonical snake_case (set by
  // CarRentalSearch in iter 251+) and the legacy camelCase that older deep
  // links may still carry. Either side returning an empty string means the
  // dates weren't selected, in which case the rest of the page falls back
  // to "1 day" pricing and the trip-summary chip is hidden.
  const pickupDate = searchParams.get('pickup_date') || searchParams.get('pickupDate') || '';
  const returnDate = searchParams.get('return_date') || searchParams.get('returnDate') || '';

  // Editable search state
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editPickup, setEditPickup] = useState(pickupLocation);
  const [editPickupDate, setEditPickupDate] = useState(pickupDate);
  const [editReturnDate, setEditReturnDate] = useState(returnDate);

  useEffect(() => {
    setEditPickup(pickupLocation);
    setEditPickupDate(pickupDate);
    setEditReturnDate(returnDate);
  }, [pickupLocation, pickupDate, returnDate]);

  const handleUpdateSearch = () => {
    const newParams = new URLSearchParams();
    if (editPickup) newParams.set('pickup', editPickup);
    // Match the canonical snake_case keys the rest of the app uses.
    if (editPickupDate) newParams.set('pickup_date', editPickupDate);
    if (editReturnDate) newParams.set('return_date', editReturnDate);
    setSearchParams(newParams);
    setIsEditingSearch(false);
  };
  
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

    // iter 249: chip omnibar.
    const { places, operators, listings } = smartFilters;
    if (places.size) filtered = filtered.filter(v => places.has((v.city || '').trim()));
    if (operators.size) filtered = filtered.filter(v => operators.has((v.operator_name || '').trim()));
    if (listings.size) filtered = filtered.filter(v => listings.has(((v.vehicle_name || v.name) || '').trim()));

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
  }, [vehicles, sortBy, smartFilters, selectedType, selectedTransmission]);

  const [detailsVehicleId, setDetailsVehicleId] = useState(null);

  const handleSelectVehicle = (vehicle) => {
    const vehicleId = vehicle._id || vehicle.id;
    sessionStorage.setItem('selectedVehicle', JSON.stringify({
      ...vehicle,
      pickupLocation,
      pickupDate,
      returnDate,
      days
    }));
    // Open details as an inline modal preview — same pattern as the laundry
    // results page. The deep-link route still works for shared URLs.
    setDetailsVehicleId(vehicleId);
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
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/services/car-rental')} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Highlighted Editable Search Summary */}
          <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white mb-4" data-testid="car-rental-search-summary">
            <CardContent className="p-3">
              {isEditingSearch ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-white/70 mb-0.5 block">Pickup Location</label>
                    <LandingSmartSearch
                      serviceType="car_rental"
                      pageType="car_rental_edit"
                      resultsPath="/services/car-rental/results"
                      cityParam="pickup_location"
                      cityLabel="Pickup"
                      selectedCity={editPickup}
                      onSelectCity={(c) => setEditPickup(c)}
                      onClearCity={() => setEditPickup('')}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/70 mb-0.5 block">Pickup Date</label>
                    <DatePickerField
                      value={editPickupDate}
                      onChange={setEditPickupDate}
                      placeholder="Pickup"
                      title="Pickup Date"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/70 mb-0.5 block">Return Date</label>
                    <DatePickerField
                      value={editReturnDate}
                      onChange={setEditReturnDate}
                      placeholder="Return"
                      title="Return Date"
                      minDate={editPickupDate ? new Date(editPickupDate) : new Date()}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={handleUpdateSearch} className="bg-white text-[#082c59] hover:bg-white/90 h-9 flex-1" data-testid="car-rental-search-apply">
                      <Check className="w-4 h-4 mr-1" /> Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingSearch(false)} className="text-white hover:bg-white/10 h-9">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold leading-tight truncate">
                          Cars in {pickupLocation || 'All Cities'}
                        </h2>
                        <div className="flex items-center gap-1.5 text-white/70 text-xs mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span>{filteredVehicles.length} vehicles found</span>
                        </div>
                      </div>
                    </div>
                    {/* Trip summary + active filter chips — always visible
                        so the user can see what's actually applied. */}
                    <div className="flex items-center gap-2 flex-wrap text-xs" data-testid="car-rental-summary-chips">
                      {pickupDate && returnDate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
                          <CalendarDays className="w-3 h-3 text-white/70" />
                          {format(new Date(pickupDate), 'MMM d')} – {format(new Date(returnDate), 'MMM d')}
                          <span className="text-white/60">· {days} day{days !== 1 ? 's' : ''}</span>
                        </span>
                      )}
                      {selectedType !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-300/40 capitalize">
                          Type: {selectedType}
                        </span>
                      )}
                      {selectedTransmission !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-300/40 capitalize">
                          {selectedTransmission}
                        </span>
                      )}
                      {sortBy !== 'price_low' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-300/40">
                          Sort: {sortBy === 'price_high' ? 'Price high → low' : 'Rating'}
                        </span>
                      )}
                      {(smartFilters?.cities?.length || 0) + (smartFilters?.operators?.length || 0) + (smartFilters?.listings?.length || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-300/40">
                          {(smartFilters?.cities?.length || 0) + (smartFilters?.operators?.length || 0) + (smartFilters?.listings?.length || 0)} filter chip(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingSearch(true)}
                    className="text-white hover:bg-white/10 h-9 shrink-0"
                    data-testid="car-rental-search-edit"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters — chip omnibar */}
          <SmartSearchBar
            items={vehicles}
            listingIcon={Car}
            listingLabel="Vehicle"
            placeholder="Filter by city, operator, or vehicle name…"
            getName={(v) => v.vehicle_name || v.name}
            getCity={(v) => v.city}
            getOperator={(v) => v.operator_name}
            onFiltersChange={setSmartFilters}
          >
            <FilterChipSelect
              icon={Car}
              label="Vehicle Type"
              value={selectedType}
              onChange={setSelectedType}
              options={VEHICLE_TYPES.map(t => ({ value: t, label: t === 'all' ? 'All Types' : t }))}
            />
            <FilterChipSelect
              icon={Settings}
              label="Transmission"
              value={selectedTransmission}
              onChange={setSelectedTransmission}
              options={TRANSMISSION_TYPES.map(t => ({ value: t, label: t === 'all' ? 'All' : t }))}
            />
            <FilterChipSelect
              icon={SlidersHorizontal}
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'price_low', label: 'Price: Low to High' },
                { value: 'price_high', label: 'Price: High to Low' },
                { value: 'rating', label: 'Top Rated' },
              ]}
              allValue="price_low"
            />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </SmartSearchBar>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-6">
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
                isFav={isFav}
                toggleFav={toggleFav}
              />
            ))}
          </div>
        ) : viewMode === 'details' ? (
          <div className="space-y-6">
            {filteredVehicles.map((vehicle) => (
              <VehicleCardList
                key={vehicle.id}
                vehicle={vehicle}
                days={days}
                onSelect={handleSelectVehicle}
                isFav={isFav}
                toggleFav={toggleFav}
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
                isFav={isFav}
                toggleFav={toggleFav}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inline details preview modal — same pattern as LaundryResults */}
      <CarRentalDetails
        embedded
        vehicleId={detailsVehicleId}
        open={!!detailsVehicleId}
        onClose={() => setDetailsVehicleId(null)}
        pickupDate={pickupDate}
        returnDate={returnDate}
      />
    </div>
  );
}
