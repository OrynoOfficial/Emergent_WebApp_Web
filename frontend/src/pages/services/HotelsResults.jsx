import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format, differenceInDays } from 'date-fns';
import {
  ArrowLeft, Star, MapPin, Wifi, Car, Utensils, Droplets, Dumbbell,
  SlidersHorizontal, Search, Loader2, ChevronLeft, ChevronRight, X, CalendarDays,
  LayoutGrid, List, Heart, Coffee, Sparkles, Check, Users, Edit2, Hotel
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { getLocationParam } from '@/components/LocationSelectionModal';

const AMENITIES = [
  { key: 'wifi', label: 'WiFi', icon: Wifi },
  { key: 'parking', label: 'Parking', icon: Car },
  { key: 'restaurant', label: 'Restaurant', icon: Utensils },
  { key: 'pool', label: 'Pool', icon: Droplets },
  { key: 'gym', label: 'Gym', icon: Dumbbell },
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'spa', label: 'Spa', icon: Sparkles },
];

const AmenityIcon = ({ amenity, className = "h-4 w-4" }) => {
  const lower = amenity.toLowerCase();
  if (lower.includes('wifi')) return <Wifi className={className} />;
  if (lower.includes('parking')) return <Car className={className} />;
  if (lower.includes('restaurant')) return <Utensils className={className} />;
  if (lower.includes('pool')) return <Droplets className={className} />;
  if (lower.includes('gym') || lower.includes('fitness')) return <Dumbbell className={className} />;
  if (lower.includes('breakfast')) return <Coffee className={className} />;
  if (lower.includes('spa')) return <Sparkles className={className} />;
  return <Star className={className} />;
};

// Horizontal scrollable image thumbnails
const ScrollableImageGallery = ({ images, onImageClick, hotelName }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative group">
      {/* Scroll buttons */}
      {canScrollLeft && (
        <button
          onClick={(e) => { e.stopPropagation(); scroll('left'); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronLeft className="h-5 w-5 text-slate-700" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={(e) => { e.stopPropagation(); scroll('right'); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
        >
          <ChevronRight className="h-5 w-5 text-slate-700" />
        </button>
      )}
      
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {images.map((img, idx) => (
          <div
            key={idx}
            onClick={() => onImageClick(idx)}
            className="flex-shrink-0 w-full h-56 md:w-72 md:h-48 snap-start cursor-pointer relative overflow-hidden rounded-lg"
          >
            <img
              src={img}
              alt={`${hotelName} ${idx + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
            {idx === 0 && images.length > 1 && (
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <span>1/{images.length}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Grid View Hotel Card - Compact Design
const HotelCardGrid = ({ hotel, nights, onViewDetails }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
  ];
  
  const images = hotel.images && hotel.images.length > 0 ? hotel.images : defaultImages;
  const totalPrice = hotel.price_per_night * nights;

  return (
    <>
      <Card className="group overflow-hidden bg-white rounded-xl border-0 shadow-sm hover:shadow-lg transition-all duration-300">
        {/* Image Section - Reduced height */}
        <div className="relative h-36 overflow-hidden">
          <img
            src={images[0]}
            alt={hotel.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onClick={() => { setSelectedImageIndex(0); setGalleryOpen(true); }}
          />
          
          {/* Favorite button */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-all"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
          </button>
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {hotel.free_cancellation && (
              <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5">Free Cancel</Badge>
            )}
            {hotel.breakfast_included && (
              <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5">Breakfast</Badge>
            )}
          </div>
          
          {/* Rating badge */}
          {hotel.guest_rating && (
            <div className="absolute bottom-2 right-2 bg-[#082c59] text-white px-2 py-0.5 rounded text-xs font-bold">
              {hotel.guest_rating.toFixed(1)}
            </div>
          )}
        </div>
        
        {/* Content - Compact */}
        <CardContent className="p-3">
          {/* Stars */}
          <div className="flex items-center gap-0.5 mb-1">
            {[...Array(hotel.star_rating || 0)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
          
          {/* Name & Location */}
          <h3 className="font-bold text-sm text-slate-900 mb-0.5 line-clamp-1">{hotel.name}</h3>
          <div className="flex items-center text-slate-500 text-xs mb-2">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{hotel.address || hotel.city}</span>
          </div>
          
          {/* Description */}
          {hotel.description && (
            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{hotel.description}</p>
          )}
          
          {/* Amenities - Compact */}
          <div className="flex flex-wrap gap-1 mb-2">
            {hotel.amenities?.slice(0, 3).map((amenity, idx) => (
              <div key={idx} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 capitalize">
                <AmenityIcon amenity={amenity} className="h-2.5 w-2.5" />
                {amenity}
              </div>
            ))}
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <div className="text-lg font-bold text-[#082c59]">{formatFCFA(hotel.price_per_night)}</div>
              <div className="text-[10px] text-slate-500">per night</div>
            </div>
            <Button
              onClick={() => onViewDetails(hotel)}
              size="sm"
              className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs px-3 h-8"
            >
              View Deal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-5xl w-full h-[85vh] p-0 bg-black border-none">
          <div className="relative w-full h-full flex flex-col">
            <button
              onClick={() => setGalleryOpen(false)}
              className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex-1 flex items-center justify-center relative px-12">
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-3"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setSelectedImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-3"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              <img
                src={images[selectedImageIndex]}
                alt={`${hotel.name} - ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            
            {/* Thumbnails */}
            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === selectedImageIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-center text-white/70 text-sm">{selectedImageIndex + 1} / {images.length}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Detail/List View Hotel Card - Compact Design
const HotelCardDetail = ({ hotel, nights, checkIn, checkOut, onViewDetails }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
  ];
  
  const images = hotel.images && hotel.images.length > 0 ? hotel.images : defaultImages;
  const totalPrice = hotel.price_per_night * nights;

  return (
    <>
      <Card className="overflow-hidden bg-white rounded-xl border-0 shadow-sm hover:shadow-md transition-all">
        <div className="flex">
          {/* Image Section - Reduced width */}
          <div className="w-48 md:w-64 relative flex-shrink-0">
            <img
              src={images[0]}
              alt={hotel.name}
              className="w-full h-full object-cover min-h-[180px] cursor-pointer"
              onClick={() => { setSelectedImageIndex(0); setGalleryOpen(true); }}
            />
            {/* Image counter */}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
              {images.length} photos
            </div>
            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {hotel.free_cancellation && (
                <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5">Free Cancel</Badge>
              )}
            </div>
          </div>
          
          {/* Details Section - Compact */}
          <div className="flex-1 p-4 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(hotel.star_rating || 0)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1 line-clamp-1">{hotel.name}</h3>
                <div className="flex items-center text-slate-500 text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span className="line-clamp-1">{hotel.address || hotel.city}</span>
                </div>
              </div>
              
              {/* Rating */}
              {hotel.guest_rating && (
                <div className="text-right ml-2">
                  <div className="bg-[#082c59] text-white font-bold px-2 py-1 rounded text-sm">
                    {hotel.guest_rating.toFixed(1)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {hotel.guest_rating >= 9 ? 'Excellent' : hotel.guest_rating >= 8 ? 'Very Good' : 'Good'}
                  </p>
                </div>
              )}
            </div>
            
            {/* Description */}
            {hotel.description && (
              <p className="text-xs text-slate-600 line-clamp-2 mb-2">{hotel.description}</p>
            )}
            
            {/* Amenities - Compact */}
            <div className="flex flex-wrap gap-1 mb-2">
              {hotel.amenities?.slice(0, 5).map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded text-[10px] text-slate-600 capitalize">
                  <AmenityIcon amenity={amenity} className="h-2.5 w-2.5" />
                  {amenity}
                </div>
              ))}
              {hotel.amenities?.length > 5 && (
                <span className="text-[10px] text-slate-500 px-1.5 py-0.5">+{hotel.amenities.length - 5}</span>
              )}
            </div>
            
            {/* Feature badges */}
            {hotel.breakfast_included && (
              <div className="flex items-center gap-1 text-xs text-orange-600 mb-2">
                <Check className="h-3 w-3" />
                <span>Breakfast Included</span>
              </div>
            )}
            
            {/* Price & CTA */}
            <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-lg font-bold text-[#082c59]">{formatFCFA(hotel.price_per_night)}</p>
                <p className="text-[10px] text-slate-500">per night</p>
                {nights > 1 && (
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {nights} nights: {formatFCFA(totalPrice)}
                  </p>
                )}
              </div>
              <Button
                onClick={() => onViewDetails(hotel)}
                size="sm"
                className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs h-8 px-4"
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-5xl w-full h-[85vh] p-0 bg-black border-none">
          <div className="relative w-full h-full flex flex-col">
            <button
              onClick={() => setGalleryOpen(false)}
              className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex-1 flex items-center justify-center relative px-12">
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-3"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setSelectedImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-3"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              <img
                src={images[selectedImageIndex]}
                alt={`${hotel.name} - ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            
            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === selectedImageIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default function HotelsResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [selectedStars, setSelectedStars] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Editable search state
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editDestination, setEditDestination] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editGuests, setEditGuests] = useState(2);

  const destination = searchParams.get('destination') || searchParams.get('city') || '';
  const checkIn = searchParams.get('checkIn') || searchParams.get('check_in');
  const checkOut = searchParams.get('checkOut') || searchParams.get('check_out');
  const guests = parseInt(searchParams.get('guests') || searchParams.get('adults') || '2');
  const rooms = parseInt(searchParams.get('rooms') || '1');

  const nights = checkIn && checkOut 
    ? differenceInDays(new Date(checkOut), new Date(checkIn)) || 1
    : 1;

  // Initialize edit fields when search params change
  useEffect(() => {
    setEditDestination(destination);
    setEditCheckIn(checkIn || '');
    setEditCheckOut(checkOut || '');
    setEditGuests(guests);
  }, [destination, checkIn, checkOut, guests]);

  const handleUpdateSearch = () => {
    const newParams = new URLSearchParams();
    if (editDestination) newParams.set('destination', editDestination);
    if (editCheckIn) newParams.set('checkIn', editCheckIn);
    if (editCheckOut) newParams.set('checkOut', editCheckOut);
    newParams.set('guests', editGuests.toString());
    setSearchParams(newParams);
    setIsEditingSearch(false);
  };

  const MOCK_HOTELS = [
    {
      id: '1',
      name: 'Hilton Douala',
      city: destination || 'Douala',
      address: 'Boulevard de la Liberté, Bonanjo',
      description: 'Experience luxury in the heart of Cameroon\'s economic capital. Our hotel offers world-class amenities, stunning harbor views, and exceptional service.',
      star_rating: 5,
      guest_rating: 9.2,
      total_reviews: 342,
      price_per_night: 150000,
      amenities: ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070']
    },
    {
      id: '2',
      name: 'Sawa Hotel',
      city: destination || 'Douala',
      address: 'Rue Joss, Akwa',
      description: 'A comfortable stay in the vibrant Akwa district, perfect for business and leisure travelers.',
      star_rating: 4,
      guest_rating: 8.5,
      total_reviews: 215,
      price_per_night: 85000,
      amenities: ['wifi', 'parking', 'restaurant'],
      free_cancellation: true,
      breakfast_included: false,
      images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070', 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2070']
    },
    {
      id: '3',
      name: 'La Falaise Hotel',
      city: destination || 'Douala',
      address: 'Rue de la Falaise, Bonapriso',
      description: 'Elegant hotel with panoramic city views, featuring modern amenities and excellent dining options.',
      star_rating: 4,
      guest_rating: 8.8,
      total_reviews: 189,
      price_per_night: 95000,
      amenities: ['wifi', 'parking', 'pool', 'restaurant'],
      free_cancellation: false,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070']
    },
    {
      id: '4',
      name: 'Akwa Palace Hotel',
      city: destination || 'Douala',
      address: 'Boulevard de la Liberté, Akwa',
      description: 'Historic hotel offering classic elegance and modern comfort in the heart of Douala.',
      star_rating: 4,
      guest_rating: 8.1,
      total_reviews: 276,
      price_per_night: 75000,
      amenities: ['wifi', 'parking', 'breakfast', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2070', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070']
    },
    {
      id: '5',
      name: 'Pullman Douala Rabingha',
      city: destination || 'Douala',
      address: 'Rue Castelnau, Bonanjo',
      description: 'Contemporary luxury hotel with state-of-the-art facilities and breathtaking ocean views.',
      star_rating: 5,
      guest_rating: 9.0,
      total_reviews: 421,
      price_per_night: 180000,
      amenities: ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=2070', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070']
    }
  ];

  useEffect(() => {
    const fetchHotels = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/hotels/', { params: { city: destination, ...getLocationParam() } });
        const data = response.data;
        if (data?.hotels && data.hotels.length > 0) {
          setHotels(data.hotels);
        } else {
          setHotels(MOCK_HOTELS);
        }
      } catch (error) {
        console.error('Failed to fetch hotels:', error);
        setHotels(MOCK_HOTELS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHotels();
  }, [destination]);

  const filteredAndSortedHotels = useMemo(() => {
    let result = [...hotels];

    if (searchTerm) {
      result = result.filter(h => 
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    result = result.filter(h => 
      h.price_per_night >= priceRange[0] && h.price_per_night <= priceRange[1]
    );

    if (selectedStars.length > 0) {
      result = result.filter(h => selectedStars.includes(h.star_rating));
    }

    if (selectedAmenities.length > 0) {
      result = result.filter(h => 
        selectedAmenities.every(a => h.amenities?.includes(a))
      );
    }

    switch (sortBy) {
      case 'price':
        result.sort((a, b) => a.price_per_night - b.price_per_night);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price_per_night - a.price_per_night);
        break;
      case 'rating':
        result.sort((a, b) => (b.guest_rating || 0) - (a.guest_rating || 0));
        break;
      case 'stars':
        result.sort((a, b) => (b.star_rating || 0) - (a.star_rating || 0));
        break;
      default:
        break;
    }

    return result;
  }, [hotels, searchTerm, priceRange, selectedStars, selectedAmenities, sortBy]);

  const handleViewDetails = (hotel) => {
    navigate(`/services/hotels/details/${hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
  };

  const toggleStar = (star) => {
    setSelectedStars(prev => 
      prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]
    );
  };

  const toggleAmenity = (amenity) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPriceRange([0, 500000]);
    setSelectedStars([]);
    setSelectedAmenities([]);
  };

  const activeFiltersCount = selectedStars.length + selectedAmenities.length + 
    (priceRange[0] > 0 || priceRange[1] < 500000 ? 1 : 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#082c59]/20 rounded-full animate-pulse"></div>
            <Loader2 className="h-12 w-12 animate-spin text-[#082c59] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-lg text-slate-600 mt-6 font-medium">Finding the best hotels for you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/services/hotels')} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Highlighted Search Criteria Header - Like TravelResults */}
          <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a4a8f] text-white mb-4">
            <CardContent className="p-4">
              {isEditingSearch ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Destination</label>
                    <Input 
                      value={editDestination} 
                      onChange={(e) => setEditDestination(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Check-in</label>
                    <Input 
                      type="date"
                      value={editCheckIn} 
                      onChange={(e) => setEditCheckIn(e.target.value)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Check-out</label>
                    <Input 
                      type="date"
                      value={editCheckOut} 
                      onChange={(e) => setEditCheckOut(e.target.value)}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Guests</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number"
                        min="1"
                        value={editGuests} 
                        onChange={(e) => setEditGuests(parseInt(e.target.value) || 1)}
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
                        <Hotel className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Hotels in {destination || 'All Cities'}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{filteredAndSortedHotels.length} properties found</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/20">
                      {checkIn && checkOut && (
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-white/70" />
                          <span className="text-sm">{format(new Date(checkIn), 'MMM d')} - {format(new Date(checkOut), 'MMM d')}</span>
                        </div>
                      )}
                      {nights > 0 && (
                        <Badge className="bg-white/20 text-white border-0">
                          {nights} night{nights > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-white/70" />
                        <span className="text-sm">{guests} guest{guests > 1 ? 's' : ''}</span>
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filters Bar */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search hotels by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
              />
            </div>
            
            {/* Controls */}
            <div className="flex gap-3 flex-wrap">
              {/* Sort Dropdown */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 h-12 rounded-xl border-slate-200">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl">
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="price">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                  <SelectItem value="stars">Star Rating</SelectItem>
                </SelectContent>
              </Select>
              
              {/* View Toggle */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 h-12 flex items-center gap-2 transition-colors ${
                    viewMode === 'grid' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 h-12 flex items-center gap-2 transition-colors ${
                    viewMode === 'list' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <List className="h-5 w-5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
              
              {/* Filter Button */}
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-12 rounded-xl px-5 relative">
                    <SlidersHorizontal className="mr-2 h-5 w-5" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[#082c59] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-xl">Filters</SheetTitle>
                  </SheetHeader>
                  <div className="py-6 space-y-8">
                    {/* Price Range */}
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-4">Price Range</h4>
                      <Slider
                        value={priceRange}
                        onValueChange={setPriceRange}
                        min={0}
                        max={500000}
                        step={10000}
                        className="mb-4"
                      />
                      <div className="flex justify-between text-sm">
                        <span className="px-3 py-1 bg-slate-100 rounded-full">{formatFCFA(priceRange[0])}</span>
                        <span className="px-3 py-1 bg-slate-100 rounded-full">{formatFCFA(priceRange[1])}</span>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-4">Star Rating</h4>
                      <div className="flex flex-wrap gap-2">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <Button
                            key={star}
                            variant={selectedStars.includes(star) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleStar(star)}
                            className={`rounded-full ${selectedStars.includes(star) ? 'bg-[#082c59]' : ''}`}
                          >
                            {star} <Star className="h-3 w-3 ml-1 fill-current" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Amenities */}
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-4">Amenities</h4>
                      <div className="space-y-3">
                        {AMENITIES.map((amenity) => (
                          <label key={amenity.key} className="flex items-center space-x-3 cursor-pointer group">
                            <Checkbox
                              id={amenity.key}
                              checked={selectedAmenities.includes(amenity.key)}
                              onCheckedChange={() => toggleAmenity(amenity.key)}
                              className="rounded"
                            />
                            <div className="flex items-center gap-2 text-slate-700 group-hover:text-slate-900">
                              <amenity.icon className="w-4 h-4" />
                              {amenity.label}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button variant="outline" onClick={clearFilters} className="flex-1 rounded-xl">
                        Clear All
                      </Button>
                      <Button onClick={() => setIsFilterOpen(false)} className="flex-1 bg-[#082c59] rounded-xl">
                        Show {filteredAndSortedHotels.length} Results
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Results */}
        {filteredAndSortedHotels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-md">
            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No Hotels Found</h3>
            <p className="text-slate-500 mb-6">Try adjusting your filters or search criteria</p>
            <Button onClick={clearFilters} className="bg-[#082c59] rounded-xl px-6">
              Clear All Filters
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedHotels.map((hotel) => (
              <HotelCardGrid
                key={hotel.id}
                hotel={hotel}
                nights={nights}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredAndSortedHotels.map((hotel) => (
              <HotelCardDetail
                key={hotel.id}
                hotel={hotel}
                nights={nights}
                checkIn={checkIn}
                checkOut={checkOut}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
