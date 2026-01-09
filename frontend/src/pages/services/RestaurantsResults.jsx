import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2, ChevronLeft, ChevronRight, X, DollarSign, Award, Phone, Heart,
  LayoutGrid, List, Wifi, Car, Music, Wine, Leaf, Coffee, Calendar, Edit2, Check
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const CUISINE_TYPES = ['African', 'French', 'Italian', 'Chinese', 'Lebanese', 'Seafood', 'Fast Food', 'Fusion'];

const getFeatureIcon = (feature) => {
  const f = feature.toLowerCase();
  if (f.includes('wifi')) return Wifi;
  if (f.includes('parking')) return Car;
  if (f.includes('music') || f.includes('live')) return Music;
  if (f.includes('wine') || f.includes('bar')) return Wine;
  if (f.includes('vegan') || f.includes('vegetarian')) return Leaf;
  if (f.includes('coffee') || f.includes('dessert')) return Coffee;
  return Star;
};

// Scrollable Image Gallery Component
const ScrollableImageGallery = ({ images, onImageClick, name }) => {
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
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative group">
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
              alt={`${name} ${idx + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
            {idx === 0 && images.length > 1 && (
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                1/{images.length}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Grid View Restaurant Card - Compact Design
const RestaurantCardGrid = ({ restaurant, onViewDetails, onReserve }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
  ];
  
  const images = restaurant.images?.length > 0 ? restaurant.images : defaultImages;

  return (
    <>
      <Card className="group overflow-hidden bg-white rounded-xl border-0 shadow-sm hover:shadow-lg transition-all duration-300">
        {/* Image Section - Reduced height */}
        <div className="relative h-36 overflow-hidden">
          <img
            src={images[0]}
            alt={restaurant.name}
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
          <div className="absolute top-2 left-2 flex gap-1.5">
            <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5 shadow-sm">
              {restaurant.cuisine || 'African'}
            </Badge>
            {restaurant.price_range && (
              <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 shadow-sm">
                {restaurant.price_range}
              </Badge>
            )}
          </div>
          
          {/* Rating badge */}
          {restaurant.rating && (
            <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-0.5 rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        {/* Content - More compact */}
        <CardContent className="p-3">
          {/* Name & Location */}
          <h3 className="font-bold text-sm text-slate-900 mb-0.5 line-clamp-1">{restaurant.name}</h3>
          <div className="flex items-center text-slate-500 text-xs mb-2">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{restaurant.address || restaurant.city}</span>
          </div>
          
          {/* Features - Inline */}
          {restaurant.features?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {restaurant.features.slice(0, 2).map((feature, idx) => (
                <span key={idx} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">{feature}</span>
              ))}
            </div>
          )}
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <div className="text-lg font-bold text-[#082c59]">{formatFCFA(restaurant.average_price || 15000)}</div>
              <div className="text-[10px] text-slate-500">per person</div>
            </div>
            <Button
              onClick={() => onViewDetails(restaurant)}
              size="sm"
              className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs px-3 h-8"
            >
              View Menu
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
                alt={`${restaurant.name} - ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// List View Restaurant Card - Compact Design
const RestaurantCardList = ({ restaurant, onViewDetails }) => {
  const defaultImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
  ];
  const images = restaurant.images?.length > 0 ? restaurant.images : defaultImages;

  return (
    <Card className="overflow-hidden bg-white rounded-xl border-0 shadow-sm hover:shadow-md transition-all">
      <div className="flex">
        {/* Image Section - Reduced width */}
        <div className="w-40 md:w-52 relative flex-shrink-0">
          <img
            src={images[0]}
            alt={restaurant.name}
            className="w-full h-full object-cover min-h-[160px]"
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5">{restaurant.cuisine || 'African'}</Badge>
          </div>
          {restaurant.rating && (
            <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 mb-1">{restaurant.name}</h3>
            <div className="flex items-center text-slate-500 text-xs mb-2">
              <MapPin className="w-3 h-3 mr-1" />
              {restaurant.address || restaurant.city}
            </div>
            
            <p className="text-slate-600 text-sm mb-2 line-clamp-1">{restaurant.description || 'Experience authentic cuisine in a warm and welcoming atmosphere.'}</p>
            
            {/* Features - Inline */}
            {restaurant.features?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {restaurant.features.slice(0, 3).map((feature, idx) => (
                  <span key={idx} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">{feature}</span>
                ))}
                {restaurant.features.length > 3 && (
                  <span className="text-[10px] text-slate-500">+{restaurant.features.length - 3}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t">
            <div>
              <div className="text-lg font-bold text-[#082c59]">{formatFCFA(restaurant.average_price || 15000)}</div>
              <div className="text-[10px] text-slate-500">per person • {restaurant.price_range || '$$'}</div>
            </div>
            <Button onClick={() => onViewDetails(restaurant)} size="sm" className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg text-xs h-8">
              View Menu
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function RestaurantsResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');

  // Editable search state
  const [isEditingSearch, setIsEditingSearch] = useState(false);
  const [editCity, setEditCity] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editGuests, setEditGuests] = useState(2);

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const time = searchParams.get('time') || '19:00';
  const guests = parseInt(searchParams.get('guests')) || 2;

  // Initialize edit fields when search params change
  useEffect(() => {
    setEditCity(city);
    setEditDate(date);
    setEditTime(time);
    setEditGuests(guests);
  }, [city, date, time, guests]);

  const handleUpdateSearch = () => {
    const newParams = new URLSearchParams();
    if (editCity) newParams.set('city', editCity);
    newParams.set('date', editDate);
    newParams.set('time', editTime);
    newParams.set('guests', editGuests.toString());
    setSearchParams(newParams);
    setIsEditingSearch(false);
  };

  useEffect(() => {
    loadRestaurants();
  }, [searchParams]);

  const loadRestaurants = async () => {
    setLoading(true);
    try {
      const res = await api.get('/restaurants/', { params: { city } });
      if (res.data.restaurants?.length > 0) {
        setRestaurants(res.data.restaurants);
      } else {
        // Mock data
        setRestaurants([
          { id: '1', name: 'Le Bistrot Français', city: 'Yaoundé', cuisine: 'French', rating: 4.8, average_price: 25000, price_range: '$$$', address: 'Avenue Kennedy', features: ['Wine Bar', 'Fine Dining', 'Parking'], images: [] },
          { id: '2', name: 'Mama Africa Kitchen', city: 'Yaoundé', cuisine: 'African', rating: 4.6, average_price: 8000, price_range: '$$', address: 'Rue de la Joie', features: ['Live Music', 'Traditional', 'Family Friendly'], images: [] },
          { id: '3', name: 'Dragon Palace', city: 'Douala', cuisine: 'Chinese', rating: 4.5, average_price: 15000, price_range: '$$', address: 'Boulevard Central', features: ['Dim Sum', 'Private Rooms', 'WiFi'], images: [] },
          { id: '4', name: 'La Terrazza', city: 'Yaoundé', cuisine: 'Italian', rating: 4.7, average_price: 20000, price_range: '$$$', address: 'Quartier Bastos', features: ['Rooftop', 'Pizza Oven', 'Cocktails'], images: [] },
          { id: '5', name: 'Cedar House', city: 'Douala', cuisine: 'Lebanese', rating: 4.4, average_price: 12000, price_range: '$$', address: 'Avenue Foch', features: ['Hookah', 'Vegetarian Options', 'Late Night'], images: [] },
        ]);
      }
    } catch (error) {
      setRestaurants([
        { id: '1', name: 'Le Bistrot Français', city: 'Yaoundé', cuisine: 'French', rating: 4.8, average_price: 25000, price_range: '$$$', address: 'Avenue Kennedy', features: ['Wine Bar', 'Fine Dining', 'Parking'], images: [] },
        { id: '2', name: 'Mama Africa Kitchen', city: 'Yaoundé', cuisine: 'African', rating: 4.6, average_price: 8000, price_range: '$$', address: 'Rue de la Joie', features: ['Live Music', 'Traditional', 'Family Friendly'], images: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = useMemo(() => {
    let filtered = [...restaurants];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(query) ||
        r.cuisine?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCuisine !== 'all') {
      filtered = filtered.filter(r => r.cuisine?.toLowerCase() === selectedCuisine.toLowerCase());
    }
    
    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) => (a.average_price || 0) - (b.average_price || 0));
      case 'price_high':
        return filtered.sort((a, b) => (b.average_price || 0) - (a.average_price || 0));
      case 'rating':
      default:
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }, [restaurants, sortBy, searchQuery, selectedCuisine]);

  const handleViewDetails = (restaurant) => {
    sessionStorage.setItem('selectedRestaurant', JSON.stringify({
      ...restaurant,
      date,
      time,
      guests
    }));
    // Navigate to menu page first, where user can select items before booking
    navigate(`/services/restaurants/menu?id=${restaurant.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding restaurants for you...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/restaurants')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">Restaurants {city && `in ${city}`}</h1>
              <p className="text-sm text-slate-500">
                {filteredRestaurants.length} restaurants found • {format(new Date(date), 'EEE, MMM d')} at {time} • {guests} guests
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
              <SelectTrigger className="w-40 bg-white">
                <Utensils className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Cuisine" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Cuisines</SelectItem>
                {CUISINE_TYPES.map(cuisine => (
                  <SelectItem key={cuisine} value={cuisine.toLowerCase()}>{cuisine}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
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
        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-16">
            <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No restaurants found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/restaurants')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCardGrid
                key={restaurant.id}
                restaurant={restaurant}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCardList
                key={restaurant.id}
                restaurant={restaurant}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
