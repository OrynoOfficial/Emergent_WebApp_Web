import React, { useState, useEffect, useCallback } from 'react';
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
  Landmark, ChevronLeft, ChevronRight, X, Eye
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import DatePickerModal from '@/components/shared/DatePickerModal';

// Amenity Icon Component
const AmenityIcon = ({ amenity }) => {
  const getIcon = () => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi')) return <Wifi className="h-5 w-5 text-slate-700" />;
    if (lower.includes('parking')) return <Car className="h-5 w-5 text-slate-700" />;
    if (lower.includes('restaurant')) return <Utensils className="h-5 w-5 text-slate-700" />;
    if (lower.includes('pool')) return <Droplets className="h-5 w-5 text-slate-700" />;
    if (lower.includes('gym') || lower.includes('fitness')) return <Dumbbell className="h-5 w-5 text-slate-700" />;
    return <Star className="h-5 w-5 text-slate-700" />;
  };

  return (
    <div className="flex items-center gap-3">
      {getIcon()}
      <span className="text-sm text-slate-800 capitalize">{amenity.replace(/_/g, ' ')}</span>
    </div>
  );
};

// Landmark Icon Component
const LandmarkIcon = ({ mode }) => {
  switch (mode) {
    case 'walk': return <Plane style={{ transform: 'rotate(90deg)' }} className="h-5 w-5 text-slate-500" />;
    case 'drive': return <Car className="h-5 w-5 text-slate-500" />;
    default: return <Landmark className="h-5 w-5 text-slate-500" />;
  }
};

// Image Gallery Component
const ImageGallery = ({ images, hotelName }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070',
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2070'
  ];
  
  const galleryImages = images && images.length > 0 ? images : defaultImages;
  
  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };
  
  const goToNext = () => {
    setSelectedIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-2 h-64 md:h-96 rounded-xl overflow-hidden">
        {/* Main Image */}
        <div 
          className="col-span-2 row-span-2 relative cursor-pointer group"
          onClick={() => setIsModalOpen(true)}
        >
          <img 
            src={galleryImages[0]} 
            alt={hotelName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </div>
        
        {/* Thumbnail Grid */}
        {galleryImages.slice(1, 5).map((img, idx) => (
          <div 
            key={idx} 
            className="relative cursor-pointer group overflow-hidden"
            onClick={() => { setSelectedIndex(idx + 1); setIsModalOpen(true); }}
          >
            <img 
              src={img} 
              alt={`${hotelName} ${idx + 2}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {idx === 3 && galleryImages.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold">+{galleryImages.length - 5} more</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-none">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setIsModalOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="relative aspect-video">
              <img 
                src={galleryImages[selectedIndex]} 
                alt={`${hotelName} ${selectedIndex + 1}`}
                className="w-full h-full object-contain"
              />
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </div>
            
            <div className="p-4 text-center text-white">
              {selectedIndex + 1} / {galleryImages.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Room Card Component
const RoomCard = ({ room, nights, checkIn, checkOut, onReserve }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=2070',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=2074',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2070',
  ];
  
  const images = room.images && room.images.length > 0 ? room.images : defaultImages;
  // Support both base_price and price fields
  const pricePerNight = room.base_price || room.price || room.price_per_night || 0;
  const totalPrice = pricePerNight * nights;
  // Support room_name or room_type
  const roomName = room.room_name || room.room_type || 'Standard Room';
  // Support available_rooms or available
  const availableRooms = room.available_rooms || room.available || 0;
  
  const goToPrevious = () => setSelectedImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
  const goToNext = () => setSelectedImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1);

  return (
    <>
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border-slate-200">
      <div className="flex flex-col md:flex-row">
        {/* Room Image - Clickable with gallery indicator */}
        <div 
          className="w-full md:w-64 h-48 md:h-auto relative flex-shrink-0 cursor-pointer group"
          onClick={() => setGalleryOpen(true)}
        >
          <img 
            src={images[0]} 
            alt={roomName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Image navigation overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <div className="bg-white/90 rounded-full p-2">
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </div>
              <div className="bg-white/90 rounded-full px-3 py-1 text-sm font-medium text-slate-700">
                View {images.length} photos
              </div>
              <div className="bg-white/90 rounded-full p-2">
                <ChevronRight className="w-5 h-5 text-slate-700" />
              </div>
            </div>
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {images.length} photos
            </div>
          )}
        </div>
        
        {/* Room Details */}
        <div className="p-5 flex-1">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900 capitalize">{roomName}</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                  <Users className="w-4 h-4" /> Up to {room.capacity || 2} guests
                </span>
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                  <Bed className="w-4 h-4" /> {room.bed_type || 'Queen'}
                </span>
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                  <Maximize className="w-4 h-4" /> {room.size_sqm || 25} m²
                </span>
              </div>
            </div>
            <Badge variant={availableRooms > 2 ? 'secondary' : 'destructive'} className="whitespace-nowrap">
              {availableRooms} {availableRooms === 1 ? 'room' : 'rooms'} left
            </Badge>
          </div>
          
          {/* Room Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {room.amenities.slice(0, 6).map((a, i) => (
                <Badge key={i} variant="outline" className="text-xs capitalize bg-white">
                  {a.replace(/_/g, ' ')}
                </Badge>
              ))}
              {room.amenities.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{room.amenities.length - 6} more
                </Badge>
              )}
            </div>
          )}
          
          {/* Price Section - Enhanced */}
          <div className="flex justify-between items-end pt-4 border-t border-slate-100">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#082c59]">{formatFCFA(pricePerNight)}</span>
                <span className="text-slate-500 text-sm">/ night</span>
              </div>
              
              {/* Total Price Box - Always shown when nights > 0 */}
              {nights > 0 && (
                <div className="mt-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Your stay</p>
                      <p className="text-sm text-slate-700">
                        {nights} {nights === 1 ? 'night' : 'nights'} 
                        {checkIn && checkOut && (
                          <span className="text-slate-500 ml-1">
                            ({format(checkIn, 'MMM d')} - {format(checkOut, 'MMM d')})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium">Total</p>
                      <p className="text-xl font-bold text-[#082c59]">{formatFCFA(totalPrice)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => onReserve(room)} 
              className="bg-[#082c59] hover:bg-[#0a3a75] ml-4 h-12 px-6"
              size="lg"
            >
              Reserve Now
            </Button>
          </div>
        </div>
      </div>
    </Card>

    {/* Room Image Gallery Modal */}
    <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
      <DialogContent className="max-w-5xl w-full h-[85vh] p-0 bg-black border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg capitalize">{roomName}</h3>
                <p className="text-sm text-white/70">{images.length} photos</p>
              </div>
              <button
                onClick={() => setGalleryOpen(false)}
                className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Main Image */}
          <div className="flex-1 flex items-center justify-center relative">
            {images.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-3 transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}
            
            <img
              src={images[selectedImageIndex]}
              alt={`${roomName} - Image ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-2 overflow-x-auto">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      index === selectedImageIndex 
                        ? 'border-white scale-110' 
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-center text-white/70 text-sm mt-2">
                {selectedImageIndex + 1} / {images.length}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default function HotelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search Params State
  const [bookingParams, setBookingParams] = useState({
    checkIn: searchParams.get('checkIn') ? new Date(searchParams.get('checkIn')) : new Date(),
    checkOut: searchParams.get('checkOut') ? new Date(searchParams.get('checkOut')) : addDays(new Date(), 2),
    adults: parseInt(searchParams.get('adults') || searchParams.get('guests') || '2'),
    children: 0,
    rooms: 1
  });
  
  // Dialogs State
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isPoliciesDialogOpen, setIsPoliciesDialogOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  
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
        api.get(`/rooms/?hotel_id=${id}`)
      ]);
      
      setHotel(hotelRes.data);
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
  
  // Map URL
  const mapEmbedUrl = hotel.location?.lat && hotel.location?.lon 
    ? `https://maps.google.com/maps?q=${hotel.location.lat},${hotel.location.lon}&z=15&output=embed`
    : null;

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
                <div className="flex items-center gap-2 mt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-5 w-5 ${i < hotel.star_rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                  ))}
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

              {/* About Section */}
              <div id="about">
                <h2 className="text-2xl font-bold mb-4">About this property</h2>
                <p className="text-slate-600 leading-relaxed mb-4 whitespace-pre-line">
                  {truncateDescription(hotel.description, 3)}
                </p>
                {isDescriptionLong && (
                  <Button variant="link" className="p-0 text-[#082c59]" onClick={() => setIsAboutDialogOpen(true)}>
                    See all about this property &gt;
                  </Button>
                )}
                
                {/* Amenities Grid */}
                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    {hotel.amenities.map((amenity, index) => (
                      <AmenityIcon key={index} amenity={amenity} />
                    ))}
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
              
              {/* Policies Card */}
              <div className="p-6 border rounded-xl">
                <h3 className="font-bold text-lg mb-4">Policies</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Check-in</p>
                    <p className="text-slate-600">{checkInTime || '14:00'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Check-out</p>
                    <p className="text-slate-600">{checkOutTime || '12:00'}</p>
                  </div>
                </div>
                
                {Array.isArray(hotel.policies) && hotel.policies.length > 0 && (
                  <div className="mt-4">
                    <ul className="list-disc list-inside text-slate-600 space-y-1 text-sm">
                      {hotel.policies
                        .filter(p => !p.toLowerCase().startsWith('check-in:') && !p.toLowerCase().startsWith('check-out:'))
                        .slice(0, 3)
                        .map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                    </ul>
                  </div>
                )}
                
                <Button
                  variant="link"
                  className="p-0 mt-4 text-[#082c59]"
                  onClick={() => setIsPoliciesDialogOpen(true)}
                >
                  See all policies &gt;
                </Button>
              </div>

              {/* Explore Area */}
              <div>
                <h3 className="font-bold text-lg mb-4">Explore the area</h3>
                <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-slate-100">
                  {mapEmbedUrl ? (
                    <iframe 
                      src={mapEmbedUrl}
                      width="100%" 
                      height="100%" 
                      style={{border: 0}} 
                      allowFullScreen="" 
                      loading="lazy"
                      title={`Map of ${hotel.name}`}
                    ></iframe>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <MapPin className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <p className="font-semibold text-sm">{hotel.address}</p>
                {hotel.location?.lat && hotel.location?.lon && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${hotel.location.lat},${hotel.location.lon}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-[#082c59] hover:underline"
                  >
                    View in a map &gt;
                  </a>
                )}
                
                {/* Landmarks */}
                {hotel.landmarks && hotel.landmarks.length > 0 && (
                  <div className="mt-4 space-y-3">
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
              </div>
            </div>
          </div>
        </div>

        {/* Room Selection Section */}
        <div id="rooms" className="mt-12 pt-8 border-t">
          <h2 className="text-3xl font-bold mb-6">Choose your room</h2>
          
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
          <div className="space-y-4">
            {rooms.length === 0 ? (
              <Card>
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
