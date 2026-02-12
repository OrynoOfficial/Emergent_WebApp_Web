import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft, Clock, Bus, Star, MapPin, Users, Armchair, Wifi, Coffee, UtensilsCrossed, 
  Loader2, ArrowRight, Calendar, SlidersHorizontal, LayoutGrid, List, Heart, 
  ChevronLeft, ChevronRight, Zap, Shield, Check, Search, X, Edit2, Image, History, CalendarDays, AlertCircle
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, parse, isAfter, isBefore, isValid, startOfDay } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import { travelApi } from '../../api/services';
import { isPast } from '../../utils/dateUtils';
import api from '../../api/client';
import { useFavourites } from '../../hooks/useFavourites';

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
    default: return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
};

// Vehicle Image Thumbnail Component
const VehicleImageThumbnails = ({ images, vehicleName, onImageClick }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;
  const displayImages = (images || []).slice(0, 4);
  
  if (!displayImages.length) return null;
  
  return (
    <div className="flex gap-1 mt-2">
      {displayImages.map((img, idx) => (
        <button 
          key={idx}
          onClick={(e) => { e.stopPropagation(); onImageClick(img, vehicleName); }}
          className="w-10 h-8 rounded overflow-hidden bg-slate-100 hover:ring-2 hover:ring-blue-400 transition-all"
        >
          <img 
            src={getImageUrl(img)} 
            alt={`${vehicleName} ${idx + 1}`} 
            className="w-full h-full object-cover"
          />
        </button>
      ))}
      {(images || []).length > 4 && (
        <div className="w-10 h-8 rounded bg-slate-200 flex items-center justify-center text-xs text-slate-600">
          +{images.length - 4}
        </div>
      )}
    </div>
  );
};

// Modern Trip Card for Grid View with Vehicle Info
const TripCardGrid = ({ trip, onSelect, tripDate, onImageClick, isFav, toggleFav }) => {
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);
  const isTripPast = isPast(tripDate, trip.departure_time);
  const tripId = trip._id || trip.id;

  return (
    <Card 
      className={`group overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all duration-300 ${
        isTripPast 
          ? 'cursor-not-allowed' 
          : 'hover:shadow-2xl transform hover:-translate-y-1'
      }`}
      style={isTripPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      {/* Header with gradient */}
      <div className={`relative h-32 p-4 ${isTripPast ? 'bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700' : 'bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#0d4a8f]'}`}>
        {/* Past Trip Indicator */}
        {isTripPast && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-slate-700 text-white">
              <AlertCircle className="w-3 h-3 mr-1" /> Departed
            </Badge>
          </div>
        )}
        {!isTripPast && (
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFav(trip); }}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
              data-testid={`fav-btn-${tripId}`}
            >
              <Heart className={`h-4 w-4 ${isFav(tripId) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className={`${isTripPast ? 'bg-slate-600' : getVehicleTypeStyle(trip.vehicle_type)} shadow-lg`}>
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
            <p className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{trip.departure_time}</p>
            <p className="text-sm text-slate-500">{trip.from_city}</p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <div className="text-xs text-slate-400 mb-1">{trip.duration || '~3h 30m'}</div>
            <div className="w-full h-[2px] bg-slate-200 relative">
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isTripPast ? 'bg-slate-400' : 'bg-[#082c59]'}`} />
              <ArrowRight className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`} />
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isTripPast ? 'bg-slate-400' : 'bg-emerald-500'}`} />
            </div>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-emerald-600'}`}>{trip.arrival_time}</p>
            <p className="text-sm text-slate-500">{trip.to_city}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className={`flex items-center justify-between text-sm rounded-xl p-3 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-slate-50'}`}>
          <div className={`flex items-center gap-1.5 ${isTripPast ? 'text-slate-400' : 'text-orange-600'}`}>
            <Armchair className="w-4 h-4" />
            <span className="font-medium">{isTripPast ? 'No longer available' : trip.available_seats === 0 ? 'Sold Out' : `${trip.available_seats ?? trip.total_seats ?? 40} seats`}</span>
          </div>
          {!isTripPast && (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Insured</span>
            </div>
          )}
        </div>

        {/* Vehicle Name & Images */}
        {trip.vehicle_name && (
          <div className={`rounded-lg p-2.5 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-blue-50'}`}>
            <div className="flex items-center gap-2">
              <Bus className={`w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${isTripPast ? 'text-slate-500' : 'text-blue-800'}`}>{trip.vehicle_name}</span>
            </div>
            {!isTripPast && trip.vehicle_images?.length > 0 && (
              <VehicleImageThumbnails 
                images={trip.vehicle_images} 
                vehicleName={trip.vehicle_name}
                onImageClick={onImageClick}
              />
            )}
          </div>
        )}

        {/* Amenities */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tripAmenities.slice(0, 3).map((amenity, idx) => {
            const Icon = getAmenityIcon(amenity);
            return (
              <div key={idx} className={`flex items-center gap-1 px-2 py-1 rounded-full ${isTripPast ? 'bg-slate-100' : 'bg-slate-100'}`}>
                <Icon className={`h-3 w-3 ${isTripPast ? 'text-slate-400' : 'text-slate-600'}`} />
                <span className={`text-xs ${isTripPast ? 'text-slate-400' : 'text-slate-600'}`}>{amenity}</span>
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
            <div className={`text-2xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{formatCurrency(trip.price)}</div>
            <div className="text-xs text-slate-500">per person</div>
          </div>
          {isTripPast ? (
            <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl px-5">
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={() => onSelect({ ...trip, tripDate })}
              className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl px-5"
            >
              Select
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Modern Trip Card for List View with Vehicle Info
const TripCardList = ({ trip, onSelect, tripDate, onImageClick, isFav, toggleFav }) => {
  const tripAmenities = trip.amenities?.length > 0 ? trip.amenities : getDefaultAmenities(trip.vehicle_type);
  const isTripPast = isPast(tripDate, trip.departure_time);

  return (
    <Card 
      className={`overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all ${
        isTripPast ? 'cursor-not-allowed' : 'hover:shadow-xl'
      }`}
      style={isTripPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      <div className="flex flex-col lg:flex-row">
        {/* Left Section - Operator Info */}
        <div className={`lg:w-1/4 p-6 text-white flex flex-col justify-center ${isTripPast ? 'bg-gradient-to-br from-slate-500 to-slate-600' : 'bg-gradient-to-br from-[#082c59] to-[#0a3a75]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Bus className="w-6 h-6" />
            <span className="font-bold text-lg">{trip.operator_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`w-fit ${isTripPast ? 'bg-slate-600' : getVehicleTypeStyle(trip.vehicle_type)}`}>
              <Star className="w-3 h-3 mr-1" />
              {trip.vehicle_type}
            </Badge>
            {isTripPast && (
              <Badge className="bg-slate-700">
                <AlertCircle className="w-3 h-3 mr-1" /> Departed
              </Badge>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <Armchair className="w-4 h-4" />
              {isTripPast ? 'N/A' : trip.available_seats === 0 ? 'Sold Out' : `${trip.available_seats ?? trip.total_seats ?? 40} seats`}
            </span>
          </div>
        </div>

        {/* Middle Section - Route Details */}
        <div className="lg:w-1/2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-3xl font-bold ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{trip.departure_time}</p>
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
              <div className={`w-full h-1 rounded-full relative ${isTripPast ? 'bg-slate-200' : 'bg-slate-200'}`}>
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${isTripPast ? 'bg-slate-400' : 'bg-[#082c59]'}`} />
                <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${isTripPast ? 'bg-slate-400' : 'bg-emerald-500'}`} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Direct</p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${isTripPast ? 'text-slate-400' : 'text-emerald-600'}`}>{trip.arrival_time}</p>
              <p className="text-slate-600 flex items-center gap-1 justify-end">
                <MapPin className="w-4 h-4" />
                {trip.to_city}
              </p>
            </div>
          </div>

          {/* Vehicle Name & Images */}
          {trip.vehicle_name && (
            <div className={`rounded-lg p-3 mb-3 ${isTripPast ? 'bg-slate-100' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-2">
                <Bus className={`w-4 h-4 ${isTripPast ? 'text-slate-400' : 'text-blue-600'}`} />
                <span className={`text-sm font-semibold ${isTripPast ? 'text-slate-500' : 'text-blue-800'}`}>{trip.vehicle_name}</span>
              </div>
              {!isTripPast && trip.vehicle_images?.length > 0 && (
                <VehicleImageThumbnails 
                  images={trip.vehicle_images} 
                  vehicleName={trip.vehicle_name}
                  onImageClick={onImageClick}
                />
              )}
            </div>
          )}

          {/* Amenities */}
          <div className="flex flex-wrap gap-2">
            {tripAmenities.map((amenity, idx) => {
              const Icon = getAmenityIcon(amenity);
              return (
                <Badge key={idx} variant="outline" className={`${isTripPast ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-50 border-slate-200'}`}>
                  <Icon className={`w-3 h-3 mr-1 ${isTripPast ? 'text-slate-400' : ''}`} />
                  {amenity}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Right Section - Price & CTA */}
        <div className={`lg:w-1/4 p-6 flex flex-col justify-center items-center border-l ${isTripPast ? 'bg-slate-100' : 'bg-slate-50'}`}>
          <div className="text-sm text-slate-500 mb-1">From</div>
          <div className={`text-3xl font-bold mb-1 ${isTripPast ? 'text-slate-400' : 'text-[#082c59]'}`}>{formatCurrency(trip.price)}</div>
          <div className="text-sm text-slate-500 mb-4">per person</div>
          {isTripPast ? (
            <Button disabled className="w-full bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl">
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={() => onSelect({ ...trip, tripDate })}
              className="w-full bg-[#082c59] hover:bg-[#0a3a75] rounded-xl"
            >
              Select Trip
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default function TravelResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isFav, toggleFav } = useFavourites('travel');
  
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('departure');
  const [viewMode, setViewMode] = useState('grid');
  const [view, setView] = useState('outbound');
  const [selectedOutbound, setSelectedOutbound] = useState(null);
  const [startDateOffset, setStartDateOffset] = useState(0);
  const [endDateOffset, setEndDateOffset] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Trip date view tab: 'current', 'past', 'future'
  const [tripDateView, setTripDateView] = useState('current');
  
  // Editable search state
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPassengers, setEditPassengers] = useState(1);
  
  // Image preview state
  const [previewImage, setPreviewImage] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const returnDate = searchParams.get('return') || searchParams.get('returnDate');
  const passengers = parseInt(searchParams.get('passengers')) || 1;
  const isRoundTrip = !!returnDate;

  const today = useMemo(() => startOfDay(new Date()), []);
  const searchBaseDate = useMemo(() => {
    const baseDate = view === 'return' && returnDate ? returnDate : date;
    return safeParse(baseDate, 'yyyy-MM-dd', new Date());
  }, [view, returnDate, date]);

  // Calculate available past and future dates
  const availablePastDates = useMemo(() => {
    const dates = [];
    const searchDate = safeParse(date, 'yyyy-MM-dd', new Date());
    // Past trips only if the search date itself is not in the actual past
    if (!isBefore(searchDate, today)) {
      // Show dates before the search date (but not actual past dates)
      for (let i = 1; i <= 3; i++) {
        const pastDate = subDays(searchDate, i);
        // Only include if the past date is today or in the future
        if (!isBefore(pastDate, today)) {
          dates.push(pastDate);
        }
      }
    }
    return dates.reverse(); // Oldest first
  }, [date, today]);

  const availableFutureDates = useMemo(() => {
    const dates = [];
    const searchDate = safeParse(date, 'yyyy-MM-dd', new Date());
    // Future trips: up to 3 dates after the given date
    for (let i = 1; i <= 3; i++) {
      dates.push(addDays(searchDate, i));
    }
    return dates;
  }, [date]);

  // Initialize edit fields
  useEffect(() => {
    setEditFrom(from);
    setEditTo(to);
    setEditDate(date);
    setEditPassengers(passengers);
  }, [from, to, date, passengers]);

  const getMockTrips = useCallback((fromCity, toCity) => [
    { id: 'ret-1', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '06:00', arrival_time: '09:30', price: 5000, vehicle_type: 'VIP', available_seats: 35, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments'], vehicle_name: 'Mercedes Sprinter VIP', vehicle_images: [] },
    { id: 'ret-2', operator_name: 'Finex Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '08:00', arrival_time: '11:30', price: 4500, vehicle_type: 'Comfort', available_seats: 42, duration: '3h 30m', amenities: ['Air Conditioning', 'Comfortable Seats'], vehicle_name: 'Toyota Coaster' },
    { id: 'ret-3', operator_name: 'Touristique Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '10:00', arrival_time: '13:30', price: 3500, vehicle_type: 'Normal', available_seats: 45, duration: '3h 30m', amenities: ['Air Conditioning'], vehicle_name: 'Yutong Bus' },
    { id: 'ret-4', operator_name: 'Vatican Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '14:00', arrival_time: '17:30', price: 5000, vehicle_type: 'VIP', available_seats: 28, duration: '3h 30m', amenities: ['WiFi', 'Air Conditioning', 'Refreshments', 'Reclining Seats'], vehicle_name: 'Mercedes Sprinter Executive' },
    { id: 'ret-5', operator_name: 'General Express', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '16:00', arrival_time: '19:30', price: 4000, vehicle_type: 'Comfort', available_seats: 38, duration: '3h 30m', amenities: ['Air Conditioning', 'Snacks'], vehicle_name: 'Higer Bus' },
    { id: 'ret-6', operator_name: 'Buca Voyage', from_city: fromCity || 'Douala', to_city: toCity || 'Yaoundé', departure_time: '18:00', arrival_time: '21:30', price: 3000, vehicle_type: 'Normal', available_seats: 50, duration: '3h 30m', amenities: ['Air Conditioning'], vehicle_name: 'Standard Coach' },
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
      let fetchedTrips = response.data?.routes || response.data || [];
      
      if (fetchedTrips.length === 0) {
        setTrips(getMockTrips(tripFrom, tripTo));
      } else {
        // Fetch dynamic seat availability for all routes
        try {
          const routeIds = fetchedTrips.map(t => t._id || t.id).filter(Boolean).join(',');
          if (routeIds && tripDate) {
            const seatRes = await api.get(`/seat-bookings/available-counts?route_ids=${routeIds}&travel_date=${tripDate}`);
            const counts = seatRes.data?.counts || {};
            fetchedTrips = fetchedTrips.map(t => {
              const rid = t._id || t.id;
              const sc = counts[rid];
              return sc ? { ...t, available_seats: sc.available, total_seats: sc.total } : t;
            });
          }
        } catch { /* seat counts are optional enhancement */ }
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
        trip.vehicle_type?.toLowerCase().includes(query) ||
        trip.vehicle_name?.toLowerCase().includes(query)
      );
    }
    
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return (a.price || 0) - (b.price || 0);
        case 'price_desc': return (b.price || 0) - (a.price || 0);
        case 'departure':
        default:
          const timeA = a.departure_time?.replace(':', '') || '0000';
          const timeB = b.departure_time?.replace(':', '') || '0000';
          return parseInt(timeA) - parseInt(timeB);
      }
    });
    
    return filtered;
  }, [trips, searchQuery, sortBy]);

  const handleTripSelect = (trip) => {
    // Prevent booking past trips
    if (isPast(trip.tripDate, trip.departure_time)) {
      return;
    }
    
    if (isRoundTrip && view === 'outbound') {
      setSelectedOutbound(trip);
      setView('return');
    } else {
      // Prepare booking data and store in sessionStorage
      const searchData = { from, to, date, passengers };
      if (returnDate) searchData.returnDate = returnDate;
      
      const bookingData = isRoundTrip
        ? { outbound: selectedOutbound, return: trip, ...searchData, isRoundTrip: true }
        : { outbound: trip, ...searchData, isRoundTrip: false };
      
      // Store in sessionStorage for the booking page
      sessionStorage.setItem('selectedTrip', JSON.stringify(bookingData));
      
      // Navigate to the booking page
      navigate('/services/travel/booking', { state: bookingData });
    }
  };

  // Handle date tab change for past/future trips
  const handleDateTabChange = (newDate) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', format(newDate, 'yyyy-MM-dd'));
    setSearchParams(newParams);
    setTripDateView('current');
  };

  const handleImageClick = (imageUrl, title) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const fullUrl = imageUrl?.startsWith('/api') ? `${backendUrl}${imageUrl}` : imageUrl;
    setPreviewImage(fullUrl);
    setPreviewTitle(title);
  };

  const handleUpdateSearch = () => {
    const newParams = new URLSearchParams();
    newParams.set('from', editFrom);
    newParams.set('to', editTo);
    newParams.set('date', editDate);
    newParams.set('passengers', editPassengers.toString());
    if (returnDate) newParams.set('return', returnDate);
    setSearchParams(newParams);
    setIsEditingSearch(false);
  };

  const tripDate = format(searchBaseDate, 'yyyy-MM-dd');

  const returnTrip = isRoundTrip && view === 'return' ? {
    ...trips[0],
    from_city: to,
    to_city: from
  } : null;

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
          </div>

          {/* Highlighted Search Criteria Header - Editable */}
          <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a3a75] text-white mb-4">
            <CardContent className="p-4">
              {isEditingSearch ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">From</label>
                    <Input 
                      value={editFrom} 
                      onChange={(e) => setEditFrom(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder="Departure city"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">To</label>
                    <Input 
                      value={editTo} 
                      onChange={(e) => setEditTo(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder="Destination city"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Date</label>
                    <Input 
                      type="date"
                      value={editDate} 
                      onChange={(e) => setEditDate(e.target.value)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Passengers</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        min="1"
                        value={editPassengers} 
                        onChange={(e) => setEditPassengers(parseInt(e.target.value) || 1)}
                        className="bg-white/10 border-white/20 text-white flex-1"
                      />
                      <Button size="sm" onClick={handleUpdateSearch} className="bg-white text-[#082c59] hover:bg-white/90">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingSearch(false)} className="text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{view === 'return' ? `${to} → ${from}` : `${from} → ${to}`}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Travel Route</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-white/70" />
                        <span className="text-sm">{format(searchBaseDate, 'EEE, MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-white/70" />
                        <span className="text-sm">{passengers} passenger{passengers > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditingSearch(true)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Past/Current/Future Trips Tabs */}
          <div className="mb-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg overflow-x-auto">
              {/* Past Trips Button */}
              {availablePastDates.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-200 rounded text-xs text-slate-600">
                    <History className="w-3 h-3" />
                    <span className="hidden sm:inline">Past:</span>
                  </div>
                  {availablePastDates.map((pastDate) => (
                    <Button
                      key={pastDate.toISOString()}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateTabChange(pastDate)}
                      className="text-xs px-2 py-1 h-7 hover:bg-blue-100 hover:text-blue-700"
                    >
                      {format(pastDate, 'MMM d')}
                    </Button>
                  ))}
                  <div className="w-px h-5 bg-slate-300 mx-1" />
                </div>
              )}
              
              {/* Current Date - Highlighted */}
              <Button
                variant="default"
                size="sm"
                className="text-xs px-3 py-1 h-7 bg-[#082c59] text-white hover:bg-[#0a3a75]"
              >
                <Calendar className="w-3 h-3 mr-1" />
                {format(safeParse(date, 'yyyy-MM-dd', new Date()), 'MMM d')} (Selected)
              </Button>
              
              {/* Future Trips */}
              {availableFutureDates.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-px h-5 bg-slate-300 mx-1" />
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-200 rounded text-xs text-slate-600">
                    <CalendarDays className="w-3 h-3" />
                    <span className="hidden sm:inline">Future:</span>
                  </div>
                  {availableFutureDates.map((futureDate) => (
                    <Button
                      key={futureDate.toISOString()}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateTabChange(futureDate)}
                      className="text-xs px-2 py-1 h-7 hover:bg-green-100 hover:text-green-700"
                    >
                      {format(futureDate, 'MMM d')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Click on a date to see available trips for that day
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by operator or vehicle..."
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

      {/* Results Summary */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-sm text-slate-600">
          {filteredAndSortedTrips.length} trips found
        </p>
      </div>

      {/* Trip Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {filteredAndSortedTrips.length === 0 ? (
          <Card className="p-12 text-center">
            <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No trips found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search criteria</p>
            <Button onClick={() => setIsEditingSearch(true)} className="bg-[#082c59]">
              <Edit2 className="w-4 h-4 mr-2" /> Modify Search
            </Button>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedTrips.map((trip, idx) => (
              <TripCardGrid 
                key={trip.id || idx} 
                trip={trip} 
                onSelect={handleTripSelect}
                tripDate={tripDate}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedTrips.map((trip, idx) => (
              <TripCardList 
                key={trip.id || idx} 
                trip={trip} 
                onSelect={handleTripSelect}
                tripDate={tripDate}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex items-center justify-center p-4">
              <img 
                src={previewImage} 
                alt={previewTitle}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
