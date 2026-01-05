import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, Clock, Bus, Star, MapPin, Users, Armchair, Wifi, Coffee, UtensilsCrossed, Loader2, ArrowRight, Calendar } from 'lucide-react';
import { format, addDays, subDays, isSameDay, parse, isAfter, isBefore, isValid } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import { travelApi } from '../../api/services';

const safeParse = (dateString, formatString, backupDate = new Date()) => {
  try {
    const parsed = parse(dateString, formatString, new Date());
    if (isValid(parsed)) return parsed;
  } catch (e) {
    // Fallback to backup date on parsing error
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

// Vehicle type/class color mapping
const getVehicleTypeStyle = (vehicleType) => {
  switch(vehicleType?.toLowerCase()) {
    case 'vip': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'comfort': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'normal': return 'bg-green-100 text-green-800 border-green-300';
    default: return 'bg-slate-100 text-slate-800 border-slate-300';
  }
};

// Trip Card Component matching original design
const TripCard = ({ trip, onSelect, tripDate }) => {
  const tripAmenities = trip.amenities?.length > 0 
    ? trip.amenities 
    : getDefaultAmenities(trip.vehicle_type);
  
  const amenityIcons = tripAmenities.slice(0, 4).map(amenity => {
    const IconComponent = getAmenityIcon(amenity);
    return { icon: IconComponent, name: amenity };
  });

  return (
    <Card className="bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden hover:scale-[1.02]">
      <CardHeader className="p-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-[#082c59]" />
            <CardTitle className="text-lg font-bold text-slate-800">{trip.operator_name}</CardTitle>
          </div>
          <div className={`flex items-center gap-1 text-sm px-3 py-1 rounded-full border font-medium ${getVehicleTypeStyle(trip.vehicle_type)}`}>
            <Star className="w-4 h-4" />
            <span className="capitalize">{trip.vehicle_type}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Time and Location Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-[#082c59]" />
            <div>
              <p className="font-bold text-[#082c59]">{trip.departure_time}</p>
              <p className="text-slate-600">{trip.from_city}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-[#082c59]" />
            <div>
              <p className="font-bold text-[#082c59]">{trip.arrival_time}</p>
              <p className="text-slate-600">{trip.to_city}</p>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-2">
          <div className="flex items-center gap-1 text-orange-600 font-medium">
            <Armchair className="w-4 h-4 text-orange-500" />
            <span>{trip.available_seats || 40} seats available</span>
          </div>
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <Clock className="w-4 h-4 text-green-500" />
            <span>{trip.duration || '~3h 30m'}</span>
          </div>
        </div>

        {/* Amenities - Original styling */}
        <div className="flex flex-wrap gap-2">
          {amenityIcons.map(({ icon: Icon, name }, idx) => (
            <Badge key={idx} variant="outline" className="bg-white text-slate-600 border-slate-300 text-xs">
              <Icon className="w-3 h-3 mr-1" />
              {name}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-4 bg-slate-50 flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-[#082c59]">{formatCurrency(trip.price)}</p>
          <p className="text-xs text-slate-500">per person</p>
        </div>
        <Button 
          onClick={() => onSelect({ ...trip, tripDate })} 
          className="bg-[#082c59] hover:bg-[#0a3a75] text-white px-6"
        >
          Select
        </Button>
      </CardFooter>
    </Card>
  );
};

// Date Group Component
const DateGroup = ({ date, trips, onSelect, isToday }) => {
  const dateLabel = isToday 
    ? 'Today' 
    : isSameDay(date, addDays(new Date(), 1)) 
      ? 'Tomorrow' 
      : format(date, 'EEEE, MMMM d');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-[#082c59]">{dateLabel}</h2>
        <div className="h-px flex-1 bg-slate-300" />
        <span className="text-sm text-slate-600">{trips.length} trips</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip, idx) => (
          <TripCard 
            key={`${trip.id}-${idx}`} 
            trip={trip} 
            onSelect={onSelect}
            tripDate={date}
          />
        ))}
      </div>
    </div>
  );
};

export default function TravelResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('departure');
  const [view, setView] = useState('outbound'); // 'outbound' or 'return'
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [startDateOffset, setStartDateOffset] = useState(0);
  const [endDateOffset, setEndDateOffset] = useState(2);

  // Parse search parameters
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  // Support both 'return' and 'returnDate' param names for compatibility
  const returnDate = searchParams.get('return') || searchParams.get('returnDate');
  const passengers = parseInt(searchParams.get('passengers')) || 1;
  const isRoundTrip = !!returnDate;

  const today = useMemo(() => new Date(), []);
  const searchBaseDate = useMemo(() => {
    // Use return date as base when in return view
    const baseDate = view === 'return' && returnDate ? returnDate : date;
    return safeParse(baseDate, 'yyyy-MM-dd', new Date());
  }, [view, returnDate, date]);

  // Generate mock trips based on from/to
  const getMockTrips = useCallback((fromCity, toCity) => [
    { id: 'ret-1', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '06:00', arrival_time: '09:30', price: 5000, vehicle_type: 'VIP', available_seats: 35, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments'] },
    { id: 'ret-2', operator_name: 'Finex Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '08:00', arrival_time: '11:30', price: 4500, vehicle_type: 'Comfort', available_seats: 42, duration: '3h 30m', amenities: ['Air Conditioning', 'Comfortable Seats'] },
    { id: 'ret-3', operator_name: 'Touristique Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '10:00', arrival_time: '13:30', price: 3500, vehicle_type: 'Normal', available_seats: 45, duration: '3h 30m', amenities: ['Air Conditioning'] },
    { id: 'ret-4', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '14:00', arrival_time: '17:30', price: 5000, vehicle_type: 'VIP', available_seats: 28, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments', 'Reclining Seats'] },
    { id: 'ret-5', operator_name: 'General Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '16:00', arrival_time: '19:30', price: 4000, vehicle_type: 'Comfort', available_seats: 38, duration: '3h 30m', amenities: ['Air Conditioning', 'Snacks'] },
    { id: 'ret-6', operator_name: 'Buca Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '18:00', arrival_time: '21:30', price: 3000, vehicle_type: 'Normal', available_seats: 50, duration: '3h 30m', amenities: ['Air Conditioning'] },
  ], []);

  // Load trips from API with swap for return trips
  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      // For return view, swap from and to cities
      const tripFrom = view === 'return' ? to : from;
      const tripTo = view === 'return' ? from : to;
      const tripDate = view === 'return' && returnDate ? returnDate : date;
      
      console.log(`Loading trips: ${tripFrom} → ${tripTo} on ${tripDate} (view: ${view})`);
      
      const response = await travelApi.searchRoutes({
        from_city: tripFrom,
        to_city: tripTo,
        date: tripDate
      });
      const fetchedTrips = response.data?.routes || response.data || [];
      
      // If no trips from API, use mock data with correct cities
      if (fetchedTrips.length === 0) {
        setTrips(getMockTrips(tripFrom, tripTo));
      } else {
        setTrips(fetchedTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
      const tripFrom = view === 'return' ? to : from;
      const tripTo = view === 'return' ? from : to;
      setTrips(getMockTrips(tripFrom, tripTo));
    } finally {
      setIsLoading(false);
    }
  }, [from, to, date, returnDate, view, getMockTrips]);

  // Reload trips when view changes
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Group trips by date
  const groupTripsByDate = useCallback(() => {
    const groups = [];
    
    for (let i = -startDateOffset; i <= endDateOffset; i++) {
      const targetDate = addDays(searchBaseDate, i);
      
      // Don't show dates before today
      if (isBefore(targetDate, today) && !isSameDay(targetDate, today)) continue;
      
      // Filter trips for this date (mock: show all for demo)
      const dateTrips = trips.map(trip => ({
        ...trip,
        tripDate: targetDate
      }));
      
      if (dateTrips.length > 0) {
        groups.push({
          date: targetDate,
          trips: dateTrips
        });
      }
    }
    
    return groups;
  }, [trips, searchBaseDate, startDateOffset, endDateOffset, today]);

  const groupedTrips = groupTripsByDate();

  // Sort trips
  const sortedTrips = useMemo(() => {
    const allTrips = [...trips];
    switch (sortBy) {
      case 'price_asc':
        return allTrips.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return allTrips.sort((a, b) => b.price - a.price);
      default:
        return allTrips.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    }
  }, [trips, sortBy]);

  const handleSelectTrip = (trip) => {
    if (isRoundTrip && view === 'outbound') {
      // Store outbound trip and switch to return view
      setSelectedOutbound({
        ...trip,
        from_city: from,
        to_city: to,
        tripDate: date
      });
      setView('return');
      // Reset date offsets for return trip
      setStartDateOffset(0);
      setEndDateOffset(2);
      return;
    }

    // Store trip data and navigate to booking
    const outboundTrip = selectedOutbound || trip;
    const returnTrip = isRoundTrip && view === 'return' ? {
      ...trip,
      from_city: to,
      to_city: from,
      tripDate: returnDate
    } : null;
    
    const bookingData = {
      outbound: {
        ...outboundTrip,
        from_city: outboundTrip.from_city || from,
        to_city: outboundTrip.to_city || to
      },
      return: returnTrip,
      passengers,
      isRoundTrip,
      departureDate: date,
      returnDate: returnDate
    };
    sessionStorage.setItem('selectedTrip', JSON.stringify(bookingData));
    navigate('/services/travel/booking');
  };

  const canLoadPrevious = useMemo(() => {
    const nextDateToLoad = subDays(searchBaseDate, startDateOffset + 1);
    return !isBefore(nextDateToLoad, today);
  }, [searchBaseDate, startDateOffset, today]);

  const title = view === 'outbound' ? 'Select your outbound trip' : 'Select your return trip';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="icon"
              className="mr-4 bg-white hover:bg-slate-100 rounded-full shadow"
              onClick={() => view === 'return' ? setView('outbound') : navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5 text-[#082c59]" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-[#082c59]">{title}</h1>
          </div>

          {/* Search Summary */}
          <div className="p-4 rounded-xl mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 bg-[#082c59] text-white shadow-lg">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{view === 'return' ? `${to} → ${from}` : `${from} → ${to}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{view === 'return' && returnDate 
                ? format(safeParse(returnDate, 'yyyy-MM-dd'), 'EEE, MMM d')
                : format(safeParse(date, 'yyyy-MM-dd'), 'EEE, MMM d')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{passengers} passenger{passengers > 1 ? 's' : ''}</span>
            </div>
            {isRoundTrip && (
              <Badge className="bg-white/20 text-white">
                {view === 'return' ? 'Return Trip' : 'Outbound Trip'}
              </Badge>
            )}
          </div>

          {/* Selected outbound summary (if on return step) */}
          {isRoundTrip && selectedOutbound && view === 'return' && (
            <div className="bg-white rounded-lg p-4 mb-6 shadow border border-slate-200">
              <p className="text-sm text-slate-500">Outbound selected:</p>
              <p className="font-semibold text-[#082c59]">
                {selectedOutbound.operator_name} • {selectedOutbound.departure_time} - {selectedOutbound.arrival_time} • {formatCurrency(selectedOutbound.price)}
              </p>
            </div>
          )}

          {/* Sort */}
          <div className="flex justify-end mb-6">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white text-slate-900 shadow">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="departure">Departure Time</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="bg-white p-6 rounded-lg flex items-center gap-3 shadow">
                <Loader2 className="h-6 w-6 animate-spin text-[#082c59]" />
                <span className="text-lg font-semibold text-slate-800">Loading travel routes...</span>
              </div>
            </div>
          ) : groupedTrips.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white rounded-xl shadow">
              <Bus className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h2 className="text-xl font-semibold text-slate-800">No trips found for the selected criteria.</h2>
              <Button
                onClick={() => navigate('/services/travel')}
                variant="outline"
                className="mt-4"
              >
                Back to Search
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Load Previous Button */}
              {canLoadPrevious && (
                <div className="text-center">
                  <Button
                    onClick={() => setStartDateOffset(prev => prev + 2)}
                    className="bg-white hover:bg-slate-100 text-[#082c59] border border-slate-300 shadow"
                  >
                    Load Previous Dates
                  </Button>
                </div>
              )}

              {/* Date Groups */}
              {groupedTrips.map((dateGroup) => (
                <DateGroup
                  key={dateGroup.date.toISOString()}
                  date={dateGroup.date}
                  trips={dateGroup.trips}
                  onSelect={handleSelectTrip}
                  isToday={isSameDay(dateGroup.date, today)}
                />
              ))}

              {/* Load More Button */}
              <div className="text-center">
                <Button
                  onClick={() => setEndDateOffset(prev => prev + 2)}
                  className="bg-white hover:bg-slate-100 text-[#082c59] border border-slate-300 shadow"
                >
                  Load More Dates
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
