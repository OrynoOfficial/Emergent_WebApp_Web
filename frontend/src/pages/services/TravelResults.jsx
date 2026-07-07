import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import FilterChipSelect from '@/components/shared/FilterChipSelect';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import SmartSearchBar from '@/components/search/SmartSearchBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft, Clock, Bus, Star, MapPin, Users, Armchair, Wifi, Coffee, UtensilsCrossed, 
  Loader2, ArrowRight, Calendar, SlidersHorizontal, LayoutGrid, List, 
  ChevronLeft, ChevronRight, Zap, Shield, Check, Search, X, Edit2, Image, History, CalendarDays, AlertCircle
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, parse, isAfter, isBefore, isValid, startOfDay } from 'date-fns';
import { formatCurrency } from '../../utils/currency';
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';
import DatePickerField from '@/components/shared/DatePickerField';
import { travelApi } from '../../api/services';
import { isPast } from '../../utils/dateUtils';
import api from '../../api/client';
import { useFavourites } from '../../hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import TripDetailsModal from '@/components/services/TripDetailsModal';
import {
  TripCardGrid,
  TripCardList,
  safeParse,
} from './TravelResults/index';

export default function TravelResults() {
  const { t } = useTranslation();
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
  const [smartFilters, setSmartFilters] = useState({ places: new Set(), operators: new Set(), listings: new Set() });
  
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

  // Pre-booking modal state
  const [modalTrip, setModalTrip] = useState(null);

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

    // iter 249: chip omnibar — operator + listing (vehicle name). City is
    // typically pre-locked by the URL (from→to) so we don't expose place chips.
    const { operators, listings } = smartFilters;
    if (operators.size) filtered = filtered.filter(t => operators.has((t.operator_name || '').trim()));
    if (listings.size) filtered = filtered.filter(t => listings.has((t.vehicle_name || t.vehicle_type || '').trim()));

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return (a.price || 0) - (b.price || 0);
        case 'price_desc': return (b.price || 0) - (a.price || 0);
        case 'departure':
        default: {
          const timeA = a.departure_time?.replace(':', '') || '0000';
          const timeB = b.departure_time?.replace(':', '') || '0000';
          return parseInt(timeA) - parseInt(timeB);
        }
      }
    });

    return filtered;
  }, [trips, smartFilters, sortBy]);

  const handleTripSelect = (trip) => {
    // Prevent booking past trips
    if (isPast(trip.tripDate, trip.departure_time)) {
      return;
    }
    // Open pre-booking modal first; final navigation is handled by handleConfirmTrip
    setModalTrip(trip);
  };

  const handleConfirmTrip = (trip) => {
    setModalTrip(null);
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
        <div className="px-4 py-4">
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
                    <LandingSmartSearch
                      serviceType="travel"
                      pageType="travel_edit_from"
                      resultsPath="/services/travel/results"
                      cityParam="from"
                      cityLabel="From"
                      selectedCity={editFrom}
                      onSelectCity={(c) => setEditFrom(c)}
                      onClearCity={() => setEditFrom('')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">To</label>
                    <LandingSmartSearch
                      serviceType="travel"
                      pageType="travel_edit_to"
                      resultsPath="/services/travel/results"
                      cityParam="to"
                      cityLabel="To"
                      selectedCity={editTo}
                      onSelectCity={(c) => setEditTo(c)}
                      onClearCity={() => setEditTo('')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Date</label>
                    <DatePickerField
                      value={editDate}
                      onChange={setEditDate}
                      placeholder="Travel date"
                      title="Travel Date"
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

          {/* Search and Filters — chip omnibar (operator + vehicle) */}
          <SmartSearchBar
            items={trips}
            listingIcon={Bus}
            listingLabel="Vehicle"
            placeholder="Filter by operator or vehicle type/name…"
            getName={(t) => t.vehicle_name || t.vehicle_type}
            getCity={() => null}
            getOperator={(t) => t.operator_name}
            onFiltersChange={setSmartFilters}
          >
            <FilterChipSelect
              icon={SlidersHorizontal}
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'departure', label: 'Departure Time' },
                { value: 'price_asc', label: 'Price: Low to High' },
                { value: 'price_desc', label: 'Price: High to Low' },
              ]}
              allValue="departure"
            />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </SmartSearchBar>
        </div>
      </div>

      {/* Results Summary */}
      <div className="px-4 py-4">
        <p className="text-sm text-slate-600">
          {filteredAndSortedTrips.length} trips found
        </p>
      </div>

      {/* Trip Cards */}
      <div className="px-4 pb-8">
        {filteredAndSortedTrips.length === 0 ? (
          <Card className="p-12 text-center">
            <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('results.no_trips')}</h3>
            <p className="text-slate-500 mb-4">{t('results.adjust_search_criteria')}</p>
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
                isFav={isFav}
                toggleFav={toggleFav}
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
                isFav={isFav}
                toggleFav={toggleFav}
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

      {/* Pre-booking Trip Details Modal */}
      <TripDetailsModal
        open={!!modalTrip}
        onOpenChange={(o) => !o && setModalTrip(null)}
        trip={modalTrip}
        onContinue={handleConfirmTrip}
      />
    </div>
  );
}
