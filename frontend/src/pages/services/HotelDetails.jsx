import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { format, addDays, differenceInDays } from 'date-fns';
import { 
  ArrowLeft, Star, MapPin, Wifi, Car, Utensils, Droplets, Dumbbell,
  CheckCircle, Clock, Users, CalendarIcon, Bed, Maximize, Plane,
  Landmark, ChevronLeft, ChevronRight, X, Eye, Coffee, Sparkles,
  ChevronDown, ChevronUp, LayoutGrid, List, Navigation, ShoppingBag, Film, Music
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import DatePickerModal from '@/components/shared/DatePickerModal';
import LocationMap from '@/components/shared/LocationMap';
import {
  HotelImageGallery as ImageGallery,
  HotelRoomCard as RoomCard,
  AmenityIcon,
  LandmarkIcon,
} from './HotelDetails/index';

export default function HotelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);
  
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Safe date parser — guards against "null"/"undefined" strings and invalid dates
  const parseDateParam = (raw, fallback) => {
    if (!raw || raw === 'null' || raw === 'undefined') return fallback;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? fallback : d;
  };

  const initialCheckIn = parseDateParam(searchParams.get('checkIn') || searchParams.get('check_in') || searchParams.get('checkin'), new Date());
  const initialCheckOut = parseDateParam(
    searchParams.get('checkOut') || searchParams.get('check_out') || searchParams.get('checkout'),
    addDays(initialCheckIn, 2)
  );

  // Search Params State
  const [bookingParams, setBookingParams] = useState({
    checkIn: initialCheckIn,
    checkOut: initialCheckOut,
    adults: parseInt(searchParams.get('adults') || searchParams.get('guests') || '2'),
    children: 0,
    rooms: parseInt(searchParams.get('rooms') || '1')
  });
  
  // Dialogs State
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isPoliciesDialogOpen, setIsPoliciesDialogOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState('list');
  const [policiesExpanded, setPoliciesExpanded] = useState(false);
  const [nearbyServiceFilter, setNearbyServiceFilter] = useState(null);
  const [nearbyPins, setNearbyPins] = useState([]);
  
  const nights = differenceInDays(bookingParams.checkOut, bookingParams.checkIn) || 1;
  
  // Extract policy times
  const extractPolicyTime = useCallback((policies, key) => {
    if (!Array.isArray(policies)) return '';
    const entry = policies.find(
      (p) => typeof p === 'string' && p.toLowerCase().startsWith(`${key}:`)
    );
    return entry ? entry.split(':').slice(1).join(':').trim() : '';
  }, []);

  useEffect(() => {
    loadHotelDetails();
  }, [id]);

  const loadHotelDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [hotelRes, roomsRes] = await Promise.all([
        api.get(`/hotels/${id}`),
        api.get(`/rooms/?hotel_id=${id}&check_in=${bookingParams.checkIn.toISOString().split('T')[0]}&check_out=${bookingParams.checkOut.toISOString().split('T')[0]}`)
      ]);
      
      // Map the hotel doc and inject location.lat/lon from backend latitude/longitude
      const hotelDoc = hotelRes.data || {};
      setHotel({
        ...hotelDoc,
        location: hotelDoc.location || (hotelDoc.latitude && hotelDoc.longitude
          ? { lat: hotelDoc.latitude, lon: hotelDoc.longitude }
          : null),
      });
      setRooms(roomsRes.data.rooms || []);
    } catch (err) {
      console.error('Failed to load hotel:', err);
      // Mock data fallback
      setHotel({
        id,
        name: 'Grand Hilton Yaoundé',
        description: 'Experience luxury in the heart of Cameroon\'s capital. Our hotel offers world-class amenities, stunning city views, and exceptional service. Located minutes from the business district, this property features spacious rooms, multiple dining options, a full-service spa, and a rooftop infinity pool with panoramic views of the city.\n\nOur dedicated staff ensures every guest receives personalized attention and memorable experiences throughout their stay.',
        city: 'Yaoundé',
        address: 'Boulevard du 20 Mai, Centre Ville, Yaoundé',
        star_rating: 5,
        rating: 9.2,
        total_reviews: 342,
        price_per_night: 125000,
        amenities: ['wifi', 'parking', 'breakfast', 'restaurant', 'gym', 'pool', 'spa', 'room_service', 'laundry', 'airport_shuttle'],
        policies: ['Check-in: 14:00', 'Check-out: 12:00', 'No smoking in rooms', 'Pets not allowed', 'Valid ID required at check-in'],
        policy_tags: ['Free cancellation until 24 hours before check-in', 'Pay at property available'],
        location: { lat: 3.8480, lon: 11.5021 },
        landmarks: [
          { name: 'Yaoundé Nsimalen Airport', distance: '25 min drive', mode: 'drive' },
          { name: 'National Museum', distance: '10 min walk', mode: 'walk' },
          { name: 'Unity Palace', distance: '15 min drive', mode: 'drive' },
          { name: 'Central Market', distance: '5 min walk', mode: 'walk' }
        ],
        images: []
      });
      setRooms([
        { id: '1', room_type: 'Standard Room', price: 85000, capacity: 2, amenities: ['wifi', 'tv', 'ac', 'minibar'], bed_type: 'Queen', size_sqm: 28, available: 5 },
        { id: '2', room_type: 'Deluxe Room', price: 120000, capacity: 2, amenities: ['wifi', 'tv', 'ac', 'minibar', 'balcony'], bed_type: 'King', size_sqm: 35, available: 3 },
        { id: '3', room_type: 'Executive Suite', price: 180000, capacity: 3, amenities: ['wifi', 'tv', 'ac', 'minibar', 'balcony', 'living_room'], bed_type: 'King', size_sqm: 55, available: 2 },
        { id: '4', room_type: 'Presidential Suite', price: 350000, capacity: 4, amenities: ['wifi', 'tv', 'ac', 'minibar', 'balcony', 'living_room', 'jacuzzi', 'kitchen'], bed_type: 'King', size_sqm: 85, available: 1 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (field, date) => {
    setBookingParams(prev => {
      const updated = { ...prev, [field]: date };
      // Ensure checkout is after checkin
      if (field === 'checkIn' && date >= prev.checkOut) {
        updated.checkOut = addDays(date, 1);
      }
      sessionStorage.setItem('hotelSearchParams', JSON.stringify({
        ...updated,
        checkIn: updated.checkIn.toISOString(),
        checkOut: updated.checkOut.toISOString()
      }));
      return updated;
    });
  };

  const handleGuestsChange = (field, value) => {
    setBookingParams(prev => {
      const updated = { ...prev, [field]: value };
      sessionStorage.setItem('hotelSearchParams', JSON.stringify({
        ...updated,
        checkIn: updated.checkIn.toISOString(),
        checkOut: updated.checkOut.toISOString()
      }));
      return updated;
    });
  };

  const handleReserve = (room) => {
    // Store hotel data with room details for booking page
    // Support multiple price field names: base_price, price, price_per_night
    const roomPrice = room.base_price || room.price || room.price_per_night || 0;
    const hotelData = {
      ...hotel,
      price_per_night: roomPrice,
      room_type: room.room_name || room.room_type || 'Standard Room',
      room_id: room.id,
      selected_room: room
    };
    
    // Store search params in the format expected by HotelBooking.jsx
    const searchParamsData = {
      checkIn: bookingParams.checkIn.toISOString(),
      checkOut: bookingParams.checkOut.toISOString(),
      adults: bookingParams.adults,
      children: bookingParams.children,
      rooms: bookingParams.rooms
    };
    
    // Use the keys that HotelBooking.jsx expects
    sessionStorage.setItem('selectedHotel', JSON.stringify(hotelData));
    sessionStorage.setItem('hotelSearchParams', JSON.stringify(searchParamsData));
    
    navigate('/services/hotels/booking');
  };

  const ratingLabel = (rating) => {
    if (rating >= 9) return 'Excellent';
    if (rating >= 8) return 'Very Good';
    if (rating >= 7) return 'Good';
    return 'Okay';
  };

  const truncateDescription = (text, maxLines = 5) => {
    if (!text) return '';
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join('\n') + '...';
  };

  // Fetch nearby services when filter is selected
  useEffect(() => {
    if (!nearbyServiceFilter || !hotel?.city) {
      setNearbyPins([]);
      return;
    }
    const baseLat = hotel.location?.lat || 4.05;
    const baseLon = hotel.location?.lon || 9.7;
    
    const generatePins = (names, type) => {
      return names.map((name, i) => ({
        id: `${type}-${i}`,
        name,
        lat: baseLat + (Math.sin(i * 1.8) * 0.008) + (Math.random() * 0.004 - 0.002),
        lon: baseLon + (Math.cos(i * 1.8) * 0.008) + (Math.random() * 0.004 - 0.002),
        type
      }));
    };

    const fetchNearby = async () => {
      try {
        const endpointMap = {
          'restaurants': '/restaurants/',
          'car-rental': '/car-rental/',
          'cinemas': '/cinemas/',
          'events': '/events/'
        };
        const endpoint = endpointMap[nearbyServiceFilter];
        if (!endpoint) return;

        const res = await api.get(endpoint, { params: { city: hotel.city, limit: 6 } });
        const data = res.data || {};
        const items = data.restaurants || data.events || data.items || data.results || [];
        
        if (items.length > 0) {
          const names = items.slice(0, 6).map(item => item.name || item.title || 'Service');
          setNearbyPins(generatePins(names, nearbyServiceFilter));
        } else {
          throw new Error('empty');
        }
      } catch {
        const fallbackNames = {
          'restaurants': ['Restaurant Le Plateau', 'Chez Mama', 'Brasserie du Port', 'Le Jardin'],
          'car-rental': ['Avis Douala', 'Hertz Akwa', 'EuroCar', 'City Wheels'],
          'cinemas': ['CanalOlympia', 'Ciné Palace', 'StarCinema'],
          'events': ['Festival de Jazz', 'Marché Artisanal', 'Concert Live', 'Expo Photo']
        };
        setNearbyPins(generatePins(fallbackNames[nearbyServiceFilter] || ['Service 1', 'Service 2', 'Service 3'], nearbyServiceFilter));
      }
    };
    fetchNearby();
  }, [nearbyServiceFilter, hotel?.city, hotel?.location?.lat, hotel?.location?.lon]);

  // (Nearby service icons are handled internally by the shared LocationMap component.)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4 text-center">
        <div>
          <h2 className="text-xl font-semibold mb-4">Error loading hotel</h2>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const checkInTime = extractPolicyTime(hotel?.policies, 'check-in');
  const checkOutTime = extractPolicyTime(hotel?.policies, 'check-out');
  const isDescriptionLong = hotel?.description && hotel.description.split('\n').length > 3;

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Back Button */}
        <div className="mb-6">
          <Button onClick={() => navigate(-1)} variant="link" className="text-slate-800 p-0 hover:no-underline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
        </div>

        {/* Image Gallery */}
        <ImageGallery images={hotel.images} hotelName={hotel.name} />

        {/* Main Content */}
        <div className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - 2/3 */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Hotel Header */}
              <div>
                <h1 className="text-4xl font-bold text-slate-900">{hotel.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-5 w-5 ${i < hotel.star_rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                </div>
                
                {/* Policy Tags */}
                {hotel.policy_tags?.map((tag, idx) => (
                  <div key={idx} className="flex items-center gap-2 mt-3 text-green-700 font-medium text-sm">
                    <CheckCircle className="h-5 w-5" />
                    <span>{tag}</span>
                  </div>
                ))}
                
                {/* Rating Badge */}
                {hotel.rating > 0 && (
                  <div className="flex items-center gap-4 mt-4">
                    <Badge className="bg-[#082c59] text-white text-lg px-3 py-1">{hotel.rating.toFixed(1)}</Badge>
                    <div>
                      <p className="font-semibold text-slate-800">{ratingLabel(hotel.rating)}</p>
                      <a href="#reviews" className="text-sm text-[#082c59] hover:underline">
                        See all {hotel.total_reviews} reviews &gt;
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* About Section - Modern Revamp */}
              <div id="about" className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4 text-slate-900">About this property</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                    {truncateDescription(hotel.description, 3)}
                  </p>
                  {isDescriptionLong && (
                    <Button variant="link" className="p-0 text-[#082c59] mt-2" onClick={() => setIsAboutDialogOpen(true)}>
                      Read full description &gt;
                    </Button>
                  )}
                </div>
                
                {/* Expandable Amenities */}
                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="border-t border-slate-100">
                    <button
                      onClick={() => setAmenitiesExpanded(!amenitiesExpanded)}
                      className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                      data-testid="amenities-toggle"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#082c59]/10 rounded-lg flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-[#082c59]" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-slate-900">Amenities</h3>
                          <p className="text-xs text-slate-500">{hotel.amenities.length} amenities available</p>
                        </div>
                      </div>
                      {amenitiesExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </button>
                    
                    {/* Preview - always visible */}
                    <div className="px-5 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {hotel.amenities.slice(0, amenitiesExpanded ? hotel.amenities.length : 4).map((amenity, index) => (
                          <div key={index} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                            <AmenityIcon amenity={amenity} />
                          </div>
                        ))}
                      </div>
                      {!amenitiesExpanded && hotel.amenities.length > 4 && (
                        <button
                          onClick={() => setAmenitiesExpanded(true)}
                          className="mt-3 text-sm text-[#082c59] font-medium hover:underline"
                        >
                          +{hotel.amenities.length - 4} more amenities
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - 1/3 */}
            <div className="space-y-6">
              
              {/* Select Room Button */}
              <a href="#rooms">
                <Button className="w-full bg-[#082c59] hover:bg-[#0a3a75] text-lg py-6">
                  Select a Room
                </Button>
              </a>
              
              {/* Policies Card - Modern expandable like About section */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-4">Policies</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        <p className="text-xs font-semibold text-emerald-700">Check-in</p>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">{checkInTime || '14:00'}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <p className="text-xs font-semibold text-amber-700">Check-out</p>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">{checkOutTime || '12:00'}</p>
                    </div>
                  </div>
                </div>

                {Array.isArray(hotel.policies) && hotel.policies.length > 0 && (
                  <div className="border-t border-slate-100">
                    <button
                      onClick={() => setPoliciesExpanded(!policiesExpanded)}
                      className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                      data-testid="policies-toggle"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#082c59]/10 rounded-lg flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-[#082c59]" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-semibold text-slate-900 text-sm">Additional Policies</h4>
                          <p className="text-xs text-slate-500">{hotel.policies.filter(p => !p.toLowerCase().startsWith('check-in:') && !p.toLowerCase().startsWith('check-out:')).length} policies</p>
                        </div>
                      </div>
                      {policiesExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </button>
                    {policiesExpanded && (
                      <div className="px-5 pb-4">
                        <ul className="space-y-2">
                          {hotel.policies
                            .filter(p => !p.toLowerCase().startsWith('check-in:') && !p.toLowerCase().startsWith('check-out:'))
                            .map((p, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Explore Area - Live Map (uses shared LocationMap) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-[#082c59]" />
                    Explore the area
                  </h3>
                  <LocationMap
                    lat={hotel.location?.lat ?? hotel.latitude}
                    lon={hotel.location?.lon ?? hotel.longitude}
                    title={hotel.name}
                    address={hotel.address}
                    nearbyPins={nearbyPins}
                  />

                  {/* Nearby Landmarks */}
                  {hotel.landmarks && hotel.landmarks.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">Nearby Attractions</h4>
                      {hotel.landmarks.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <LandmarkIcon mode={item.mode} />
                          <div className="flex justify-between w-full text-sm">
                            <span className="text-slate-800">{item.name}</span>
                            <span className="text-slate-500">{item.distance}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Platform Services Nearby - Dynamic Filters */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Oryno Services Nearby</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'restaurants', icon: Utensils, label: 'Restaurants', bg: 'bg-orange-50', border: 'border-orange-200', activeBg: 'bg-orange-500', color: 'text-orange-500', activeColor: 'text-white' },
                        { key: 'car-rental', icon: Car, label: 'Car Rentals', bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-500', color: 'text-blue-500', activeColor: 'text-white' },
                        { key: 'cinemas', icon: Film, label: 'Cinemas', bg: 'bg-purple-50', border: 'border-purple-200', activeBg: 'bg-purple-500', color: 'text-purple-500', activeColor: 'text-white' },
                        { key: 'events', icon: Music, label: 'Events', bg: 'bg-pink-50', border: 'border-pink-200', activeBg: 'bg-pink-500', color: 'text-pink-500', activeColor: 'text-white' },
                      ].map(svc => {
                        const isActive = nearbyServiceFilter === svc.key;
                        return (
                          <button
                            key={svc.key}
                            onClick={() => setNearbyServiceFilter(isActive ? null : svc.key)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-all ${
                              isActive
                                ? `${svc.activeBg} ${svc.activeColor} border-transparent shadow-sm`
                                : `${svc.bg} ${svc.border} text-slate-700 hover:opacity-80`
                            }`}
                            data-testid={`filter-${svc.key}`}
                          >
                            <svc.icon className={`w-4 h-4 shrink-0 ${isActive ? svc.activeColor : svc.color}`} />
                            <span>{svc.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {nearbyServiceFilter && (
                      <p className="text-xs text-slate-500 mt-2 italic">Showing {nearbyServiceFilter.replace('-', ' ')} near {hotel.city || hotel.address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Room Selection Section */}
        <div id="rooms" className="mt-12 pt-8 border-t">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Choose your room</h2>
              <p className="text-slate-500 mt-1">Select from our premium accommodations</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Room View Toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setRoomViewMode('list')}
                  className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
                    roomViewMode === 'list' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  data-testid="room-view-list"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setRoomViewMode('grid')}
                  className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${
                    roomViewMode === 'grid' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  data-testid="room-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
              </div>
              {/* Highlighted Room Count */}
              <div className="bg-[#082c59] text-white px-4 py-2.5 rounded-lg shadow-md" data-testid="room-types-count">
                <span className="text-lg font-bold">{rooms.length}</span>
                <span className="text-sm ml-1.5">room type{rooms.length !== 1 ? 's' : ''} available</span>
              </div>
            </div>
          </div>
          
          {/* Booking Controls */}
          <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 py-4 mb-6 rounded-lg">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Check-in Date */}
              <Button 
                variant="outline" 
                className="justify-start text-left font-normal"
                onClick={() => setIsCheckInOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Check-in: {format(bookingParams.checkIn, 'MMM dd, yyyy')}
              </Button>
              
              {/* Check-out Date */}
              <Button 
                variant="outline" 
                className="justify-start text-left font-normal"
                onClick={() => setIsCheckOutOpen(true)}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Check-out: {format(bookingParams.checkOut, 'MMM dd, yyyy')}
              </Button>
              
              {/* Guests Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <Users className="mr-2 h-4 w-4" />
                    {bookingParams.adults} Adults, {bookingParams.children} Children, {bookingParams.rooms} Room
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 bg-white">
                  <div className="grid gap-4">
                    <h4 className="font-medium leading-none">Travelers</h4>
                    
                    <div className="flex items-center justify-between gap-8">
                      <Label>Adults</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('adults', Math.max(1, bookingParams.adults - 1))}
                          className="h-8 w-8"
                        >-</Button>
                        <span className="w-8 text-center">{bookingParams.adults}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('adults', Math.min(10, bookingParams.adults + 1))}
                          className="h-8 w-8"
                        >+</Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-8">
                      <Label>Children</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('children', Math.max(0, bookingParams.children - 1))}
                          className="h-8 w-8"
                        >-</Button>
                        <span className="w-8 text-center">{bookingParams.children}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('children', Math.min(6, bookingParams.children + 1))}
                          className="h-8 w-8"
                        >+</Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-8">
                      <Label>Rooms</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('rooms', Math.max(1, bookingParams.rooms - 1))}
                          className="h-8 w-8"
                        >-</Button>
                        <span className="w-8 text-center">{bookingParams.rooms}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => handleGuestsChange('rooms', Math.min(5, bookingParams.rooms + 1))}
                          className="h-8 w-8"
                        >+</Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Badge variant="secondary" className="ml-auto">
                {nights} {nights === 1 ? 'night' : 'nights'}
              </Badge>
            </div>
          </div>
          
          {/* Stay Summary Banner */}
          <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white p-4 rounded-xl mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-blue-200">Check-in</p>
                  <p className="font-bold">{format(bookingParams.checkIn, 'MMM dd')}</p>
                  <p className="text-xs text-blue-200">{checkInTime || '14:00'}</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-0.5 bg-blue-300/50"></div>
                  <p className="text-sm font-semibold mt-1">{nights} {nights === 1 ? 'Night' : 'Nights'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-blue-200">Check-out</p>
                  <p className="font-bold">{format(bookingParams.checkOut, 'MMM dd')}</p>
                  <p className="text-xs text-blue-200">{checkOutTime || '12:00'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-200">Total Guests</p>
                <p className="font-bold">{bookingParams.adults + bookingParams.children} Guest{bookingParams.adults + bookingParams.children > 1 ? 's' : ''}</p>
                <p className="text-xs text-blue-200">{bookingParams.rooms} Room{bookingParams.rooms > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          
          {/* Room Cards */}
          <div className={roomViewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4' 
            : 'space-y-4'
          }>
            {rooms.length === 0 ? (
              <Card className={roomViewMode === 'grid' ? 'md:col-span-2' : ''}>
                <CardContent className="p-8 text-center text-slate-500">
                  No rooms available for the selected dates.
                </CardContent>
              </Card>
            ) : (
              rooms.map(room => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  nights={nights}
                  checkIn={bookingParams.checkIn}
                  checkOut={bookingParams.checkOut}
                  onReserve={handleReserve}
                  compact={roomViewMode === 'grid'}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* About Dialog */}
      <Dialog open={isAboutDialogOpen} onOpenChange={setIsAboutDialogOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>About this property</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{hotel.description}</p>
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-4">Amenities</h4>
                <div className="grid grid-cols-2 gap-4">
                  {hotel.amenities.map((amenity, index) => (
                    <AmenityIcon key={index} amenity={amenity} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Policies Dialog */}
      <Dialog open={isPoliciesDialogOpen} onOpenChange={setIsPoliciesDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Hotel Policies</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <span className="font-semibold">Check-in</span>
                </div>
                <p className="text-slate-600">{checkInTime || '14:00'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <span className="font-semibold">Check-out</span>
                </div>
                <p className="text-slate-600">{checkOutTime || '12:00'}</p>
              </div>
            </div>
            
            {Array.isArray(hotel.policies) && hotel.policies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Additional Policies</h4>
                <ul className="space-y-2">
                  {hotel.policies
                    .filter(p => !p.toLowerCase().startsWith('check-in:') && !p.toLowerCase().startsWith('check-out:'))
                    .map((policy, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-600">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{policy}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Picker Modals */}
      <DatePickerModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onSelect={(date) => handleDateChange('checkIn', date)}
        selectedDate={bookingParams.checkIn}
        title="Select Check-in Date"
        minDate={new Date()}
      />
      
      <DatePickerModal
        isOpen={isCheckOutOpen}
        onClose={() => setIsCheckOutOpen(false)}
        onSelect={(date) => handleDateChange('checkOut', date)}
        selectedDate={bookingParams.checkOut}
        title="Select Check-out Date"
        minDate={addDays(bookingParams.checkIn, 1)}
      />
    </div>
  );
}
