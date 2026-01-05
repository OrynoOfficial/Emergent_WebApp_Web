import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  ArrowLeft, Star, MapPin, Clock, Users, Utensils, SlidersHorizontal, Search, 
  Loader2, ChevronLeft, ChevronRight, X, DollarSign, Award, Phone
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const CUISINE_TYPES = ['African', 'French', 'Italian', 'Chinese', 'Lebanese', 'Seafood', 'Fast Food', 'Fusion'];

const RestaurantCard = ({ restaurant, reservationDate, reservationTime, guests, onViewDetails, onReserve }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?q=80&w=2074',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070',
  ];
  
  const images = restaurant.images && restaurant.images.length > 0 ? restaurant.images : defaultImages;
  
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
                alt={restaurant.name}
                className="w-full h-64 md:h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-64 md:h-full bg-gradient-to-br from-[#082c59]/10 to-[#082c59]/20 flex items-center justify-center min-h-[200px]">
                <Utensils className="w-16 h-16 text-[#082c59]/40" />
              </div>
            )}
            {images.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                +{images.length - 1} photos
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
          
          {/* Details Section */}
          <div className="md:w-2/3 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{restaurant.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  {restaurant.rating && (
                    <>
                      <div className="flex">
                        {[...Array(Math.floor(restaurant.rating))].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">{restaurant.rating} rating</span>
                    </>
                  )}
                </div>
                <div className="flex items-center text-gray-600 mb-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="text-sm">{restaurant.address || restaurant.city}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Utensils className="w-4 h-4" />
                    {restaurant.cuisine}
                  </span>
                  {restaurant.price_range && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {restaurant.price_range}
                    </span>
                  )}
                </div>
              </div>
              {/* Price Section */}
              <div className="text-right">
                <div className="text-sm text-gray-500">Average</div>
                <div className="text-2xl font-bold text-[#082c59]">
                  {formatFCFA(restaurant.average_price || 15000)}
                </div>
                <div className="text-sm text-gray-500">per person</div>
              </div>
            </div>

            <p className="text-gray-700 mb-4 line-clamp-2">{restaurant.description}</p>

            {/* Features */}
            {restaurant.features && restaurant.features.length > 0 && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {restaurant.features.slice(0, 4).map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-xs capitalize">
                      {feature}
                    </Badge>
                  ))}
                  {restaurant.features.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{restaurant.features.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                onClick={() => onViewDetails(restaurant)}
                className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]"
              >
                View Menu
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Image Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 bg-black border-none">
          <div className="relative w-full h-full">
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
              alt={`${restaurant.name} - Image ${selectedImageIndex + 1}`}
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

export default function RestaurantsResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 100000]);

  // Search params
  const city = searchParams.get('city') || '';
  const cuisine = searchParams.get('cuisine') || '';
  const reservationDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const reservationTime = searchParams.get('time') || '19:00';
  const guests = parseInt(searchParams.get('guests') || '2');

  const MOCK_RESTAURANTS = [
    {
      id: '1',
      name: 'Le Patio Restaurant',
      city: city || 'Douala',
      address: 'Rue Joss, Akwa, Douala',
      description: 'Upscale dining with French and African fusion cuisine. Perfect for romantic dinners and business meetings.',
      cuisine: 'French-African Fusion',
      rating: 4.8,
      price_range: '$$$$',
      average_price: 35000,
      features: ['outdoor seating', 'fine dining', 'wine selection', 'private rooms'],
      opening_hours: '11:00 - 23:00',
      images: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070']
    },
    {
      id: '2',
      name: 'Mama Africa Kitchen',
      city: city || 'Douala',
      address: 'Boulevard de la Liberté, Bonanjo',
      description: 'Authentic Cameroonian cuisine served in a warm, family-friendly atmosphere. Known for the best ndolé in the city.',
      cuisine: 'African',
      rating: 4.6,
      price_range: '$$',
      average_price: 15000,
      features: ['traditional food', 'live music', 'family friendly'],
      opening_hours: '10:00 - 22:00',
      images: ['https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?q=80&w=2074']
    },
    {
      id: '3',
      name: 'Dragon Palace',
      city: city || 'Douala',
      address: 'Rue de l\'Hôpital, Bonapriso',
      description: 'Authentic Chinese and Asian cuisine with fresh ingredients and traditional cooking methods.',
      cuisine: 'Chinese',
      rating: 4.4,
      price_range: '$$$',
      average_price: 20000,
      features: ['dim sum', 'private dining', 'vegetarian options'],
      opening_hours: '11:30 - 22:30',
      images: ['https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070']
    },
    {
      id: '4',
      name: 'La Terrasse Méditerranéenne',
      city: city || 'Douala',
      address: 'Rue des Palmiers, Bonapriso',
      description: 'Lebanese and Mediterranean cuisine with stunning rooftop views. Great for sunset dining.',
      cuisine: 'Lebanese',
      rating: 4.5,
      price_range: '$$$',
      average_price: 25000,
      features: ['rooftop', 'mezze platters', 'shisha', 'vegetarian'],
      opening_hours: '12:00 - 00:00',
      images: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070']
    },
    {
      id: '5',
      name: 'Ocean Fresh Seafood',
      city: city || 'Douala',
      address: 'Port de Pêche, Deido',
      description: 'Fresh catch of the day prepared in various styles. The best seafood spot in Douala.',
      cuisine: 'Seafood',
      rating: 4.7,
      price_range: '$$$',
      average_price: 28000,
      features: ['fresh seafood', 'waterfront', 'grilled fish', 'local specialties'],
      opening_hours: '11:00 - 22:00',
      images: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070']
    },
    {
      id: '6',
      name: 'Burger & Co',
      city: city || 'Douala',
      address: 'Avenue de Gaulle, Akwa',
      description: 'Gourmet burgers and American-style fast food in a trendy setting. Perfect for quick bites.',
      cuisine: 'Fast Food',
      rating: 4.2,
      price_range: '$$',
      average_price: 8000,
      features: ['burgers', 'milkshakes', 'fast service', 'delivery'],
      opening_hours: '10:00 - 23:00',
      images: ['https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=2072']
    }
  ];

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/restaurants/', {
          params: { city, cuisine }
        });
        setRestaurants(response.data?.restaurants || response.data || []);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
        // Use mock data
        let filteredMock = [...MOCK_RESTAURANTS];
        if (cuisine && cuisine !== 'All Cuisines') {
          filteredMock = filteredMock.filter(r => 
            r.cuisine.toLowerCase().includes(cuisine.toLowerCase())
          );
        }
        setRestaurants(filteredMock);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, [city, cuisine]);

  const filteredAndSortedRestaurants = useMemo(() => {
    let result = [...restaurants];

    // Helper to get cuisine string
    const getCuisineString = (r) => {
      if (typeof r.cuisine === 'string') return r.cuisine;
      if (Array.isArray(r.cuisine_type)) return r.cuisine_type.join(' ');
      if (typeof r.cuisine_type === 'string') return r.cuisine_type;
      return '';
    };

    // Apply search filter
    if (searchTerm) {
      result = result.filter(r => 
        r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCuisineString(r).toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply cuisine filter
    if (selectedCuisines.length > 0) {
      result = result.filter(r => {
        const cuisineStr = getCuisineString(r).toLowerCase();
        return selectedCuisines.some(c => cuisineStr.includes(c.toLowerCase()));
      });
    }

    // Apply price filter
    result = result.filter(r => 
      (r.average_price || 15000) >= priceRange[0] && 
      (r.average_price || 15000) <= priceRange[1]
    );

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => (a.average_price || 15000) - (b.average_price || 15000));
        break;
      case 'price-high':
        result.sort((a, b) => (b.average_price || 15000) - (a.average_price || 15000));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return result;
  }, [restaurants, searchTerm, selectedCuisines, priceRange, sortBy]);

  const handleViewDetails = (restaurant) => {
    navigate(`/services/restaurants/details/${restaurant.id}`);
  };

  const handleReserve = (restaurant) => {
    sessionStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
    sessionStorage.setItem('restaurantReservation', JSON.stringify({
      city,
      date: reservationDate,
      time: reservationTime,
      guests
    }));
    navigate(`/services/restaurants/booking?restaurant=${restaurant.id}`);
  };

  const toggleCuisine = (cuisine) => {
    setSelectedCuisines(prev => 
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCuisines([]);
    setPriceRange([0, 100000]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-lg text-gray-600">Finding restaurants...</p>
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
            <Button variant="ghost" className="mr-4" onClick={() => navigate('/services/restaurants')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Restaurants Found</h1>
              <p className="text-gray-600">
                {city && `in ${city} • `}
                {format(new Date(reservationDate), 'MMM d, yyyy')} at {reservationTime} • {guests} guest{guests > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Mobile Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-4">
                  <div>
                    <h4 className="font-semibold mb-3">Cuisine Type</h4>
                    <div className="space-y-2">
                      {CUISINE_TYPES.map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`mobile-${type}`}
                            checked={selectedCuisines.includes(type)}
                            onCheckedChange={() => toggleCuisine(type)}
                          />
                          <label htmlFor={`mobile-${type}`} className="text-sm">{type}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Best Rating</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <Card className="p-6 sticky top-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">Filters</h3>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Cuisine Type</h4>
                  <div className="space-y-2">
                    {CUISINE_TYPES.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={selectedCuisines.includes(type)}
                          onCheckedChange={() => toggleCuisine(type)}
                        />
                        <label htmlFor={type} className="text-sm cursor-pointer">{type}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="flex-1 space-y-6">
            <p className="text-gray-600">
              Showing {filteredAndSortedRestaurants.length} restaurant{filteredAndSortedRestaurants.length !== 1 ? 's' : ''} 
              {city && ` in ${city}`}
            </p>
            {filteredAndSortedRestaurants.length === 0 ? (
              <Card className="p-12 text-center">
                <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No restaurants found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search criteria</p>
                <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
              </Card>
            ) : (
              filteredAndSortedRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  reservationDate={reservationDate}
                  reservationTime={reservationTime}
                  guests={guests}
                  onViewDetails={handleViewDetails}
                  onReserve={handleReserve}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
