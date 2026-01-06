import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import { Input } from '../../components/ui/input';
import { 
  ArrowLeft, Clock, Bus, Star, MapPin, Users, Armchair, Wifi, Coffee, UtensilsCrossed, 
  Loader2, ArrowRight, Calendar, SlidersHorizontal, LayoutGrid, List, Heart, 
  ChevronLeft, ChevronRight, Zap, Shield, Check, Search, X
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, parse, isAfter, isBefore, isValid } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import { travelApi } from '../../api/services';

const safeParse = (dateString, formatString, backupDate = new Date()) => {
  try {
    const parsed = parse(dateString, formatString, new Date());
    if (isValid(parsed)) return parsed;
  } catch (e) {
    // Invalid date format, use backup
  }
  return backupDate;
};

const getAmenityIcon = (amenity) => {
  const amenityLower = amenity.toLowerCase();
  if (amenityLower.includes('wifi') || amenityLower.includes('internet')) return Wifi;
  if (amenityLower.includes('coffee') || amenityLower.includes('refreshment') || amenityLower.includes('snack')) return Coffee;
  if (amenityLower.includes('meal') || amenityLower.includes('food')) return UtensilsCrossed;
  if (amenityLower.includes('seat') || amenityLower.includes('comfort')) return Armchair;
  return Star;
};

const getDefaultAmenities = (vehicleType) => {
  const baseAmenities = ['Air Conditioning', 'Comfortable Seats'];
  switch(vehicleType?.toLowerCase()) {
    case 'vip': return [...baseAmenities, 'WiFi', 'Refreshments', 'Reclining Seats'];
    case 'comfort': return [...baseAmenities, 'WiFi', 'Snacks'];
    default: return baseAmenities;
  }
};

const getVehicleTypeStyle = (vehicleType) => {
  switch(vehicleType?.toLowerCase()) {
    case 'vip': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
    case 'comfort': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    case 'normal': return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
    default: return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
};

// Modern Trip Card for Grid View
const TripCardGrid = ({ trip, onSelect, tripDate }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);

  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Header with gradient */}
      <div className="relative h-32 bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f] p-4">
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </button>
        </div>
        <div className="absolute top-3 left-3">
          <Badge className={`${getVehicleTypeStyle(trip.vehicle_type)} shadow-lg`}>
            <Star className="w-3 h-3 mr-1" />
            {trip.vehicle_type}
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 text-white">
            <Bus className="w-5 h-5" />
            <span className="font-bold text-lg">{trip.operator_name}</span>
          </div>
        </div>
      </div>

      <CardContent className="p-5">
        {/* Route & Time */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#082c59]">{trip.departure_time}</p>
            <p className="text-sm text-slate-500">{trip.from_city}</p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <div className="text-xs text-slate-400 mb-1">{trip.duration || '~3h 30m'}</div>
            <div className="w-full h-[2px] bg-slate-200 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#082c59]" />
              <ArrowRight className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-[#082c59]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{trip.arrival_time}</p>
            <p className="text-sm text-slate-500">{trip.to_city}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex items-center justify-between text-sm bg-slate-50 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-1.5 text-orange-600">
            <Armchair className="w-4 h-4" />
            <span className="font-medium">{trip.available_seats || 40} seats</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Insured</span>
          </div>
        </div>

        {/* Amenities */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tripAmenities.slice(0, 3).map((amenity, idx) => {
            const Icon = getAmenityIcon(amenity);
            return (
              <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
                <Icon className="h-3 w-3 text-slate-600" />
                <span className="text-xs text-slate-600">{amenity}</span>
              </div>
            );
          })}
          {tripAmenities.length > 3 && (
            <div className="px-2 py-1 bg-slate-100 rounded-full">
              <span className="text-xs text-slate-500">+{tripAmenities.length - 3}</span>
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <div className="text-2xl font-bold text-[#082c59]">{formatCurrency(trip.price)}</div>
            <div className="text-xs text-slate-500">per person</div>
          </div>
          <Button
            onClick={() => onSelect({ ...trip, tripDate })}
            className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl px-5"
          >
            Select
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Modern Trip Card for List View
const TripCardList = ({ trip, onSelect, tripDate }) => {
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);

  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col lg:flex-row">
        {/* Left Section - Operator Info */}
        <div className="lg:w-1/4 p-6 bg-gradient-to-br from-[#082c59] to-[#0a3a75] text-white flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Bus className="w-6 h-6" />
            <span className="font-bold text-lg">{trip.operator_name}</span>
          </div>
          <Badge className={`w-fit ${getVehicleTypeStyle(trip.vehicle_type)}`}>
            <Star className="w-3 h-3 mr-1" />
            {trip.vehicle_type}
          </Badge>
          <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <Armchair className="w-4 h-4" />
              {trip.available_seats || 40} seats
            </span>
          </div>
        </div>

        {/* Middle Section - Route Details */}
        <div className="lg:w-1/2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-[#082c59]">{trip.departure_time}</p>
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {trip.from_city}
              </p>
            </div>
            <div className="flex-1 px-6 flex flex-col items-center">
              <div className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {trip.duration || '~3h 30m'}
              </div>
              <div className="w-full h-1 bg-slate-200 rounded-full relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#082c59] border-2 border-white shadow" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Direct</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">{trip.arrival_time}</p>
              <p className="text-slate-600 flex items-center gap-1 justify-end">
                <MapPin className="w-4 h-4" />
                {trip.to_city}
              </p>
            </div>
          </div>

          {/* Amenities */}
          <div className="flex flex-wrap gap-2">
            {tripAmenities.map((amenity, idx) => {
              const Icon = getAmenityIcon(amenity);
              return (
                <Badge key={idx} variant="outline" className="bg-slate-50 border-slate-200">
                  <Icon className="w-3 h-3 mr-1" />
                  {amenity}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Right Section - Price & CTA */}
        <div className="lg:w-1/4 p-6 bg-slate-50 flex flex-col justify-center items-center border-l">
          <div className="text-sm text-slate-500 mb-1">From</div>
          <div className="text-3xl font-bold text-[#082c59] mb-1">{formatCurrency(trip.price)}</div>
          <div className="text-sm text-slate-500 mb-4">per person</div>
          <Button
            onClick={() => onSelect({ ...trip, tripDate })}
            className="w-full bg-[#082c59] hover:bg-[#0a3a75] rounded-xl"
          >
            Select Trip
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default function TravelResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('departure');
  const [viewMode, setViewMode] = useState('grid');
  const [view, setView] = useState('outbound');
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [startDateOffset, setStartDateOffset] = useState(0);
  const [endDateOffset, setEndDateOffset] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const returnDate = searchParams.get('return') || searchParams.get('returnDate');
  const passengers = parseInt(searchParams.get('passengers')) || 1;
  const isRoundTrip = !!returnDate;

  const today = useMemo(() => new Date(), []);
  const searchBaseDate = useMemo(() => {
    const baseDate = view === 'return' && returnDate ? returnDate : date;
    return safeParse(baseDate, 'yyyy-MM-dd', new Date());
  }, [view, returnDate, date]);

  const getMockTrips = useCallback((fromCity, toCity) => [
    { id: 'ret-1', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '06:00', arrival_time: '09:30', price: 5000, vehicle_type: 'VIP', available_seats: 35, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments'] },
    { id: 'ret-2', operator_name: 'Finex Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '08:00', arrival_time: '11:30', price: 4500, vehicle_type: 'Comfort', available_seats: 42, duration: '3h 30m', amenities: ['Air Conditioning', 'Comfortable Seats'] },
    { id: 'ret-3', operator_name: 'Touristique Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '10:00', arrival_time: '13:30', price: 3500, vehicle_type: 'Normal', available_seats: 45, duration: '3h 30m', amenities: ['Air Conditioning'] },
    { id: 'ret-4', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '14:00', arrival_time: '17:30', price: 5000, vehicle_type: 'VIP', available_seats: 28, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments', 'Reclining Seats'] },
    { id: 'ret-5', operator_name: 'General Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '16:00', arrival_time: '19:30', price: 4000, vehicle_type: 'Comfort', available_seats: 38, duration: '3h 30m', amenities: ['Air Conditioning', 'Snacks'] },
    { id: 'ret-6', operator_name: 'Buca Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '18:00', arrival_time: '21:30', price: 3000, vehicle_type: 'Normal', available_seats: 50, duration: '3h 30m', amenities: ['Air Conditioning'] },
  ], []);

  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const tripFrom = view === 'return' ? to : from;
      const tripTo = view === 'return' ? from : to;
      const tripDate = view === 'return' && returnDate ? returnDate : date;
      
      const response = await travelApi.searchRoutes({
        from_city: tripFrom,
        to_city: tripTo,
        date: tripDate
      });
      const fetchedTrips = response.data?.routes || response.data || [];
      
      if (fetchedTrips.length === 0) {
        setTrips(getMockTrips(tripFrom, tripTo));
      } else {
        setTrips(fetchedTrips);
      }
    } catch (error) {
      const tripFrom = view === 'return' ? to : from;
      const tripTo = view === 'return' ? from : to;
      setTrips(getMockTrips(tripFrom, tripTo));
    } finally {
      setIsLoading(false);
    }
  }, [from, to, date, returnDate, view, getMockTrips]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const filteredAndSortedTrips = useMemo(() => {
    let filtered = [...trips];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trip => 
        trip.operator_name?.toLowerCase().includes(query) ||
        trip.vehicle_type?.toLowerCase().includes(query)
      );
    }
    
    switch (sortBy) {
      case 'price_asc':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return filtered.sort((a, b) => b.price - a.price);
      case 'departure':
      default:
        return filtered.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    }
  }, [trips, sortBy, searchQuery]);

  const handleSelectTrip = (trip) => {
    if (isRoundTrip && view === 'outbound') {
      setSelectedOutbound({
        ...trip,
        from_city: from,
        to_city: to,
        tripDate: date
      });
      setView('return');
      setStartDateOffset(0);
      setEndDateOffset(2);
      return;
    }

    const outboundTrip = selectedOutbound || trip;
    const returnTrip = isRoundTrip && view === 'return' ? {
      ...trip,
      from_city: to,
      to_city: from,
      tripDate: returnDate
    } : null;

    sessionStorage.setItem('selectedTrip', JSON.stringify({
      outbound: outboundTrip,
      return: returnTrip,
      passengers,
      departureDate: date,
      returnDate: returnDate
    }));

    navigate('/services/travel/booking');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding the best trips for you...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/travel')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">
                {view === 'return' ? `${to} → ${from}` : `${from} → ${to}`}
              </h1>
              <p className="text-sm text-slate-500">
                {filteredAndSortedTrips.length} trips found • {format(searchBaseDate, 'EEE, MMM d, yyyy')} • {passengers} passenger{passengers > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Round Trip Indicator */}
          {isRoundTrip && (
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex-1 py-2 px-4 rounded-lg text-center cursor-pointer transition-all ${
                view === 'outbound' ? 'bg-[#082c59] text-white' : 'bg-slate-100 text-slate-600'
              }`} onClick={() => setView('outbound')}>
                <span className="text-sm font-medium">Outbound: {from} → {to}</span>
                {selectedOutbound && <Check className="w-4 h-4 inline ml-2" />}
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
              <div className={`flex-1 py-2 px-4 rounded-lg text-center cursor-pointer transition-all ${
                view === 'return' ? 'bg-[#082c59] text-white' : 'bg-slate-100 text-slate-600'
              }`} onClick={() => selectedOutbound && setView('return')}>
                <span className="text-sm font-medium">Return: {to} → {from}</span>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by operator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="departure">Departure Time</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
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
        {filteredAndSortedTrips.length === 0 ? (
          <div className="text-center py-16">
            <Bus className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No trips found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/travel')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedTrips.map((trip, idx) => (
              <TripCardGrid
                key={`${trip.id}-${idx}`}
                trip={trip}
                onSelect={handleSelectTrip}
                tripDate={searchBaseDate}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedTrips.map((trip, idx) => (
              <TripCardList
                key={`${trip.id}-${idx}`}
                trip={trip}
                onSelect={handleSelectTrip}
                tripDate={searchBaseDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
