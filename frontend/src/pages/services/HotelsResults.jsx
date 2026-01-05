import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  SlidersHorizontal, Search, Loader2, ChevronLeft, ChevronRight, X, CalendarDays
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const AMENITIES = [
  { key: 'wifi', label: 'WiFi', icon: Wifi },
  { key: 'parking', label: 'Parking', icon: Car },
  { key: 'restaurant', label: 'Restaurant', icon: Utensils },
  { key: 'pool', label: 'Pool', icon: Droplets },
  { key: 'gym', label: 'Gym', icon: Dumbbell },
];

const AmenityIcon = ({ amenity }) => {
  const getIcon = () => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi')) return <Wifi className="h-4 w-4" />;
    if (lower.includes('parking')) return <Car className="h-4 w-4" />;
    if (lower.includes('restaurant')) return <Utensils className="h-4 w-4" />;
    if (lower.includes('pool')) return <Droplets className="h-4 w-4" />;
    if (lower.includes('gym') || lower.includes('fitness')) return <Dumbbell className="h-4 w-4" />;
    return <Star className="h-4 w-4" />;
  };
  return getIcon();
};

const HotelCard = ({ hotel, nights, checkIn, checkOut, onViewDetails }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070',
  ];
  
  const images = hotel.images && hotel.images.length > 0 ? hotel.images : defaultImages;
  const totalPrice = hotel.price_per_night * nights;
  
  const goToPrevious = () => setSelectedImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
  const goToNext = () => setSelectedImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1);

  return (
    <>
      <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow bg-white">
        <div className="md:flex">
          {/* Image Section - Clickable Gallery */}
          <div className="md:w-1/3 relative cursor-pointer group" onClick={() => setGalleryOpen(true)}>
            {images[0] ? (
              <img 
                src={images[0]} 
                alt={hotel.name}
                className="w-full h-64 md:h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-64 md:h-full bg-gradient-to-br from-[#082c59]/10 to-[#082c59]/20 flex items-center justify-center min-h-[200px]">
                <MapPin className="w-16 h-16 text-[#082c59]/40" />
              </div>
            )}
            {images.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                +{images.length - 1} photos
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
          
          {/* Details Section - 2/3 width */}
          <div className="md:w-2/3 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{hotel.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[...Array(hotel.star_rating || 0)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">{hotel.star_rating} Star Hotel</span>
                </div>
                <div className="flex items-center text-gray-600 mb-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="text-sm">{hotel.address || hotel.city}</span>
                </div>
                {/* Guest Rating */}
                {hotel.guest_rating && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#082c59] text-white px-2 py-0.5">{hotel.guest_rating.toFixed(1)}</Badge>
                    <span className="text-sm text-gray-600">
                      {hotel.guest_rating >= 9 ? 'Excellent' : hotel.guest_rating >= 8 ? 'Very Good' : 'Good'}
                    </span>
                  </div>
                )}
              </div>
              {/* Price Section with Total */}
              <div className="text-right">
                <div className="text-sm text-gray-500">From</div>
                <div className="text-2xl font-bold text-[#082c59]">
                  {formatFCFA(hotel.price_per_night)}
                </div>
                <div className="text-sm text-gray-500">per night</div>
                {nights > 0 && (
                  <div className="mt-2 p-2 bg-slate-100 rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays className="w-3 h-3" />
                      <span>{nights} night{nights > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-lg font-bold text-[#082c59]">
                      {formatFCFA(totalPrice)}
                    </div>
                    <div className="text-xs text-gray-500">total</div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-gray-700 mb-4 line-clamp-2">{hotel.description}</p>

          {/* Feature Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {hotel.free_cancellation && (
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                Free Cancellation
              </Badge>
            )}
            {hotel.breakfast_included && (
              <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                Breakfast Included
              </Badge>
            )}
          </div>

          {/* Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Amenities:</p>
              <div className="flex flex-wrap gap-2">
                {hotel.amenities.slice(0, 6).map((amenity, index) => (
                  <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1">
                    <AmenityIcon amenity={amenity} />
                    <span className="capitalize">{amenity}</span>
                  </Badge>
                ))}
                {hotel.amenities.length > 6 && (
                  <Badge variant="secondary" className="text-xs">
                    +{hotel.amenities.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={() => onViewDetails(hotel)}
              className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]"
            >
              View Details
            </Button>
          </div>
        </div>
      </div>
    </Card>

    {/* Image Gallery Modal */}
    <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0">
        <div className="relative w-full h-full bg-black">
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          
          <img
            src={images[selectedImageIndex]}
            alt={`${hotel.name} - Image ${selectedImageIndex + 1}`}
            className="w-full h-full object-contain"
          />
          
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === selectedImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
          
          <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
            {selectedImageIndex + 1} / {images.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default function HotelsResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [selectedStars, setSelectedStars] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const destination = searchParams.get('destination') || searchParams.get('city') || '';
  const checkIn = searchParams.get('checkIn') || searchParams.get('check_in');
  const checkOut = searchParams.get('checkOut') || searchParams.get('check_out');
  const guests = parseInt(searchParams.get('guests') || searchParams.get('adults') || '2');
  const rooms = parseInt(searchParams.get('rooms') || '1');

  const nights = checkIn && checkOut 
    ? differenceInDays(new Date(checkOut), new Date(checkIn)) || 1
    : 1;

  const MOCK_HOTELS = [
    {
      id: '1',
      name: 'Hilton Douala',
      city: destination || 'Douala',
      address: 'Boulevard de la Liberté, Bonanjo',
      description: 'Experience luxury in the heart of Cameroon\'s economic capital. Our hotel offers world-class amenities, stunning harbor views, and exceptional service.',
      star_rating: 5,
      guest_rating: 9.2,
      price_per_night: 150000,
      amenities: ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070']
    },
    {
      id: '2',
      name: 'Sawa Hotel',
      city: destination || 'Douala',
      address: 'Rue Joss, Akwa',
      description: 'A comfortable stay in the vibrant Akwa district, perfect for business and leisure travelers.',
      star_rating: 4,
      guest_rating: 8.5,
      price_per_night: 85000,
      amenities: ['wifi', 'parking', 'restaurant'],
      free_cancellation: true,
      breakfast_included: false,
      images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=2070']
    },
    {
      id: '3',
      name: 'La Falaise Hotel',
      city: destination || 'Douala',
      address: 'Rue de la Falaise, Bonapriso',
      description: 'Elegant hotel with panoramic city views, featuring modern amenities and excellent dining options.',
      star_rating: 4,
      guest_rating: 8.8,
      price_per_night: 95000,
      amenities: ['wifi', 'parking', 'pool', 'restaurant'],
      free_cancellation: false,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2070']
    },
    {
      id: '4',
      name: 'Akwa Palace Hotel',
      city: destination || 'Douala',
      address: 'Boulevard de la Liberté, Akwa',
      description: 'Historic hotel offering classic elegance and modern comfort in the heart of Douala.',
      star_rating: 4,
      guest_rating: 8.1,
      price_per_night: 75000,
      amenities: ['wifi', 'parking', 'breakfast', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=2070']
    },
    {
      id: '5',
      name: 'Pullman Douala Rabingha',
      city: destination || 'Douala',
      address: 'Rue Castelnau, Bonanjo',
      description: 'Contemporary luxury hotel with state-of-the-art facilities and breathtaking ocean views.',
      star_rating: 5,
      guest_rating: 9.0,
      price_per_night: 180000,
      amenities: ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant'],
      free_cancellation: true,
      breakfast_included: true,
      images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=2070']
    }
  ];

  useEffect(() => {
    const fetchHotels = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/hotels/', { params: { city: destination } });
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

    // Filter by search term
    if (searchTerm) {
      result = result.filter(h => 
        h.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by price
    result = result.filter(h => 
      h.price_per_night >= priceRange[0] && h.price_per_night <= priceRange[1]
    );

    // Filter by stars
    if (selectedStars.length > 0) {
      result = result.filter(h => selectedStars.includes(h.star_rating));
    }

    // Filter by amenities
    if (selectedAmenities.length > 0) {
      result = result.filter(h => 
        selectedAmenities.every(a => h.amenities?.includes(a))
      );
    }

    // Sort
    switch (sortBy) {
      case 'price':
        result.sort((a, b) => a.price_per_night - b.price_per_night);
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

  const handleBook = (hotel) => {
    sessionStorage.setItem('selectedHotel', JSON.stringify(hotel));
    sessionStorage.setItem('hotelSearchParams', JSON.stringify({
      destination,
      checkIn,
      checkOut,
      guests,
      rooms,
      nights
    }));
    navigate(`/services/hotels/details/${hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&book=true`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-lg text-gray-600">Searching for hotels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-4" onClick={() => navigate('/services/hotels')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Hotels Found</h1>
              <p className="text-gray-600">Choose your perfect accommodation</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="stars">Stars</SelectItem>
              </SelectContent>
            </Select>
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="bg-white">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  {/* Price Range */}
                  <div>
                    <h4 className="font-medium mb-3">Price Range</h4>
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={0}
                      max={500000}
                      step={10000}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>{formatFCFA(priceRange[0])}</span>
                      <span>{formatFCFA(priceRange[1])}</span>
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div>
                    <h4 className="font-medium mb-3">Star Rating</h4>
                    <div className="flex flex-wrap gap-2">
                      {[5, 4, 3, 2, 1].map((star) => (
                        <Button
                          key={star}
                          variant={selectedStars.includes(star) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleStar(star)}
                          className={selectedStars.includes(star) ? 'bg-sky-600' : ''}
                        >
                          {star} <Star className="h-3 w-3 ml-1 fill-current" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div>
                    <h4 className="font-medium mb-3">Amenities</h4>
                    <div className="space-y-2">
                      {AMENITIES.map((amenity) => (
                        <div key={amenity.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={amenity.key}
                            checked={selectedAmenities.includes(amenity.key)}
                            onCheckedChange={() => toggleAmenity(amenity.key)}
                          />
                          <label htmlFor={amenity.key} className="text-sm flex items-center gap-2">
                            <amenity.icon className="w-4 h-4" />
                            {amenity.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="flex-1"
                    >
                      Clear All
                    </Button>
                    <Button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Search Summary */}
        {destination && (
          <Card className="mb-6 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span><strong>{destination}</strong></span>
                {checkIn && <span>• Check-in: {format(new Date(checkIn), 'MMM dd, yyyy')}</span>}
                {checkOut && <span>• Check-out: {format(new Date(checkOut), 'MMM dd, yyyy')}</span>}
                <span>• {guests} Guest{guests > 1 ? 's' : ''}</span>
                <span>• {rooms} Room{rooms > 1 ? 's' : ''}</span>
                <span>• {nights} {nights === 1 ? 'night' : 'nights'}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by hotel name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        {/* Results */}
        {filteredAndSortedHotels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm">
            <div className="w-24 h-24 bg-gradient-to-br from-[#082c59]/10 to-[#082c59]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-12 h-12 text-[#082c59]" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Hotels Found</h3>
            <p className="text-gray-500 mb-6">No hotels match your search criteria. Try adjusting your filters.</p>
            <Button onClick={clearFilters} className="bg-[#082c59] hover:bg-[#0a3a75]">
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-600">
              Showing {filteredAndSortedHotels.length} hotel{filteredAndSortedHotels.length > 1 ? 's' : ''} 
              {destination && ` in ${destination}`}
            </p>
            {filteredAndSortedHotels.map((hotel) => (
              <HotelCard
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
