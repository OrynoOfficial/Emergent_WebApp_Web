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
  LayoutGrid, List, Wifi, Car, Music, Wine, Leaf, Coffee
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

// Grid View Restaurant Card
const RestaurantCardGrid = ({ restaurant, onViewDetails, onReserve }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const defaultImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?q=80&w=2074',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070',
  ];
  
  const images = restaurant.images?.length > 0 ? restaurant.images : defaultImages;

  return (
    <>
      <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        {/* Image Section */}
        <div className="relative h-52 overflow-hidden">
          <ScrollableImageGallery
            images={images}
            name={restaurant.name}
            onImageClick={(idx) => { setSelectedImageIndex(idx); setGalleryOpen(true); }}
          />
          
          {/* Favorite button */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all"
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
          </button>
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <Badge className="bg-orange-500 text-white text-xs shadow-md">
              {restaurant.cuisine || 'African'}
            </Badge>
            {restaurant.price_range && (
              <Badge className="bg-emerald-500 text-white text-xs shadow-md">
                {restaurant.price_range}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Content */}
        <CardContent className="p-5">
          {/* Rating */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              {[...Array(Math.floor(restaurant.rating || 4))].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            {restaurant.rating && (
              <div className="flex items-center gap-1.5">
                <span className="bg-[#082c59] text-white text-xs font-bold px-2 py-1 rounded-md">
                  {restaurant.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          
          {/* Name & Location */}
          <h3 className="font-bold text-lg text-slate-900 mb-1 line-clamp-1">{restaurant.name}</h3>
          <div className="flex items-center text-slate-500 text-sm mb-3">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{restaurant.address || restaurant.city}</span>
          </div>
          
          {/* Features */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {restaurant.features?.slice(0, 3).map((feature, idx) => {
              const Icon = getFeatureIcon(feature);
              return (
                <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
                  <Icon className="h-3 w-3 text-slate-600" />
                  <span className="text-xs text-slate-600 capitalize">{feature}</span>
                </div>
              );
            })}
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-end justify-between pt-3 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Average</div>
              <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(restaurant.average_price || 15000)}</div>
              <div className="text-xs text-slate-500">per person</div>
            </div>
            <Button
              onClick={() => onViewDetails(restaurant)}
              className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl px-5"
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

// List View Restaurant Card
const RestaurantCardList = ({ restaurant, onViewDetails }) => {
  const defaultImages = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
  ];
  const images = restaurant.images?.length > 0 ? restaurant.images : defaultImages;

  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col lg:flex-row">
        {/* Image Section */}
        <div className="lg:w-2/5 relative h-64 lg:h-auto min-h-[250px]">
          <img
            src={images[0]}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {images.length} photos
          </div>
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <Badge className="bg-orange-500 text-white shadow-md">{restaurant.cuisine || 'African'}</Badge>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="lg:w-3/5 p-6 flex flex-col justify-between">
          <div>
            {/* Rating & Name */}
            <div className="flex items-center gap-2 mb-2">
              {[...Array(Math.floor(restaurant.rating || 4))].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-sm text-slate-500">{restaurant.rating || 4} Star Restaurant</span>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">{restaurant.name}</h3>
            <div className="flex items-center text-slate-500 text-sm mb-3">
              <MapPin className="w-4 h-4 mr-1" />
              {restaurant.address || restaurant.city}
            </div>
            
            <p className="text-slate-600 mb-4 line-clamp-2">{restaurant.description || 'Experience authentic cuisine in a warm and welcoming atmosphere.'}</p>
            
            {/* Features */}
            <div className="flex flex-wrap gap-2 mb-4">
              {restaurant.features?.slice(0, 5).map((feature, idx) => {
                const Icon = getFeatureIcon(feature);
                return (
                  <Badge key={idx} variant="outline" className="bg-slate-50">
                    <Icon className="w-3 h-3 mr-1" />
                    {feature}
                  </Badge>
                );
              })}
              {restaurant.features?.length > 5 && (
                <Badge variant="outline" className="bg-slate-50">+{restaurant.features.length - 5} more</Badge>
              )}
            </div>
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <div className="text-sm text-slate-500">Average per person</div>
              <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(restaurant.average_price || 15000)}</div>
              <div className="bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full inline-block mt-1">
                {restaurant.price_range || '$$'}
              </div>
            </div>
            <Button onClick={() => onViewDetails(restaurant)} className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
              View Menu & Reserve
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function RestaurantsResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const time = searchParams.get('time') || '19:00';
  const guests = parseInt(searchParams.get('guests')) || 2;

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
    navigate(`/services/restaurants/${restaurant.id}/menu`);
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
