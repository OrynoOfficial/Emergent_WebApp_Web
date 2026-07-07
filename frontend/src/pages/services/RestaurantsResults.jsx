import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SmartSearchBar from '@/components/search/SmartSearchBar';
import FilterChipSelect from '@/components/shared/FilterChipSelect';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  ArrowLeft, Star, MapPin, Clock, Users, Utensils, SlidersHorizontal, Search, 
  Loader2, ChevronLeft, ChevronRight, X, DollarSign, Award, Phone,
  LayoutGrid, List, Wifi, Car, Music, Wine, Leaf, Coffee, Calendar, Edit2, Check
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';
import DatePickerField from '@/components/shared/DatePickerField';
import api from '@/api/client';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import { getLocationParam } from '@/components/LocationSelectionModal';

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
const RestaurantCardGrid = ({ restaurant, onViewDetails, onReserve, isFav, toggleFav }) => {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  // Favourites handled by parent via isFav/toggleFav props
  
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
          
          {/* Favorite & Subscribe buttons */}
          <div className="absolute top-2 right-2 z-10 flex gap-1.5">
            <SubscribeButton operatorId={restaurant.operator_id} operatorName={restaurant.operator_name} variant="icon" />
            <FavouriteButton
              isFavourite={!!(isFav && isFav(restaurant._id || restaurant.id))}
              onToggle={() => toggleFav && toggleFav(restaurant)}
              testId={`favourite-${restaurant._id || restaurant.id}`}
              className="p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-all"
              emptyClass="text-slate-600"
            />
          </div>
          
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
          {restaurant.tables_available != null && (
            <div className="absolute bottom-2 left-2 z-10" data-testid={`restaurant-fomo-grid-${restaurant._id || restaurant.id}`}>
              <AlmostSoldOutBadge count={restaurant.tables_available} unit="tables" />
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
const RestaurantCardList = ({ restaurant, onViewDetails, isFav, toggleFav }) => {
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
  const { t } = useTranslation();
  const { isFav, toggleFav } = useFavourites('restaurants');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [smartFilters, setSmartFilters] = useState({ places: new Set(), operators: new Set(), listings: new Set() });
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
      const res = await api.get('/restaurants/', { params: { city, ...getLocationParam() } });
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

    // iter 249: chip omnibar replaces free-text search.
    const { places, operators, listings } = smartFilters;
    if (places.size) filtered = filtered.filter(r => places.has((r.city || '').trim()));
    if (operators.size) filtered = filtered.filter(r => operators.has((r.operator_name || '').trim()));
    if (listings.size) filtered = filtered.filter(r => listings.has((r.name || '').trim()));

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
  }, [restaurants, sortBy, smartFilters, selectedCuisine]);

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
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/restaurants')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>

          {/* Highlighted Search Criteria Header - Like TravelResults with Orange theme */}
          <Card className="shadow-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white mb-4">
            <CardContent className="p-4">
              {isEditingSearch ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">City</label>
                    <LandingSmartSearch
                      serviceType="restaurant"
                      pageType="restaurants_edit"
                      resultsPath="/services/restaurants/results"
                      cityParam="city"
                      cityLabel="City"
                      selectedCity={editCity}
                      onSelectCity={(c) => setEditCity(c)}
                      onClearCity={() => setEditCity('')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Date</label>
                    <DatePickerField
                      value={editDate}
                      onChange={setEditDate}
                      placeholder="Reservation date"
                      title="Reservation Date"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70 mb-1 block">Time</label>
                    <Input 
                      type="time"
                      value={editTime} 
                      onChange={(e) => setEditTime(e.target.value)}
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
                      <Button size="sm" onClick={handleUpdateSearch} className="bg-white text-orange-600 hover:bg-white/90">
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
                        <Utensils className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Restaurants {city && `in ${city}`}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{filteredRestaurants.length} restaurants found</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 pl-6 border-l border-white/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-white/70" />
                        <span className="text-sm">{format(new Date(date), 'EEE, MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-white/70" />
                        <span className="text-sm">{time}</span>
                      </div>
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

          {/* Filters — chip omnibar replaces the free-text + city dropdown combo. */}
          <SmartSearchBar
            items={restaurants}
            listingIcon={Utensils}
            listingLabel="Restaurant"
            placeholder="Filter by city, operator, or restaurant name…"
            getName={(r) => r.name}
            getCity={(r) => r.city}
            getOperator={(r) => r.operator_name}
            onFiltersChange={setSmartFilters}
          >
            <FilterChipSelect
              icon={Utensils}
              label="Cuisine"
              value={selectedCuisine}
              onChange={setSelectedCuisine}
              options={[
                { value: 'all', label: 'All Cuisines' },
                ...CUISINE_TYPES.map(c => ({ value: c.toLowerCase(), label: c })),
              ]}
            />
            <FilterChipSelect
              icon={SlidersHorizontal}
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'rating', label: 'Top Rated' },
                { value: 'price_low', label: 'Price: Low to High' },
                { value: 'price_high', label: 'Price: High to Low' },
              ]}
              allValue="rating"
            />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </SmartSearchBar>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-6">
        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-16">
            <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">{t('results.no_restaurants')}</h3>
            <p className="text-slate-500 mb-4">{t('results.adjust_search')}</p>
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
                isFav={isFav}
                toggleFav={toggleFav}
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
