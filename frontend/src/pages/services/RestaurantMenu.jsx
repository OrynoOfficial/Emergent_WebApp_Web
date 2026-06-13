import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DatePickerModal from '@/components/shared/DatePickerModal';
import useEmblaCarousel from 'embla-carousel-react';
import { 
  ArrowLeft, ShoppingCart, Plus, Minus, Trash2, 
  Calendar as CalendarIcon, Clock, Users, MapPin,
  Utensils, Star, CheckCircle, Loader2, Search, Flame,
  ChevronLeft, ChevronRight, Leaf, X, AlertTriangle, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const MENU_CATEGORIES = ['all', 'starters', 'mains', 'desserts', 'drinks', 'specials'];

const DIETARY_FILTERS = [
  { key: 'Peanuts', label: 'No Peanuts', color: 'amber' },
  { key: 'Gluten', label: 'Gluten-Free', color: 'rose' },
  { key: 'Dairy', label: 'No Dairy', color: 'blue' },
  { key: 'Eggs', label: 'No Eggs', color: 'yellow' },
  { key: 'Fish', label: 'No Fish', color: 'cyan' },
  { key: 'Shellfish', label: 'No Shellfish', color: 'teal' },
  { key: 'Soy', label: 'No Soy', color: 'lime' },
];

const ALLERGEN_BADGE_COLORS = {
  Peanuts: 'bg-amber-50 text-amber-700 border-amber-200',
  'Tree Nuts': 'bg-orange-50 text-orange-700 border-orange-200',
  Dairy: 'bg-blue-50 text-blue-700 border-blue-200',
  Eggs: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Gluten: 'bg-rose-50 text-rose-700 border-rose-200',
  Fish: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Shellfish: 'bg-teal-50 text-teal-700 border-teal-200',
  Soy: 'bg-lime-50 text-lime-700 border-lime-200',
  Sesame: 'bg-stone-50 text-stone-700 border-stone-200',
  Celery: 'bg-green-50 text-green-700 border-green-200',
};

const formatOpeningHours = (openingHours) => {
  if (!openingHours) return 'Hours not available';
  if (typeof openingHours === 'string') return openingHours;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const todayHours = openingHours[today];
  if (todayHours && todayHours.open && todayHours.close) return `${todayHours.open} - ${todayHours.close}`;
  for (const day of days) {
    if (openingHours[day]?.open && openingHours[day]?.close) return `${openingHours[day].open} - ${openingHours[day].close}`;
  }
  return 'Hours vary';
};

// ── Tiny swipeable image carousel for a menu item ──
function ItemImageCarousel({ images = [] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false });
  const [selectedIdx, setSelectedIdx] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIdx(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  if (!images.length) {
    return (
      <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 rounded-xl bg-[#F4F1EC] flex items-center justify-center">
        <Utensils className="w-8 h-8 text-[#C5A880]/50" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 rounded-xl overflow-hidden shadow-sm">
        <img src={images[0]} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>
    );
  }

  return (
    <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 relative rounded-xl overflow-hidden shadow-sm">
      <div ref={emblaRef} className="overflow-hidden w-full h-full">
        <div className="flex h-full">
          {images.slice(0, 3).map((img, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 h-full">
              <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          ))}
        </div>
      </div>
      {/* Dots */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1" data-testid="carousel-dots">
        {images.slice(0, 3).map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === selectedIdx ? 'bg-white w-3' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Ingredients Modal ──
function IngredientsModal({ open, onClose, itemName, ingredients = [], allergens = [] }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-[#082c59] flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#C5A880]" />
            {itemName}
          </DialogTitle>
          <DialogDescription className="sr-only">Ingredients used in {itemName}</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div>
            <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3 font-sans">Ingredients</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ing, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-[#F9F9F7] text-[#1A1D20] border-[#E2E8F0] font-sans text-sm px-3 py-1"
                >
                  {ing}
                </Badge>
              ))}
            </div>
            {ingredients.length === 0 && (
              <p className="text-sm text-[#64748B] italic">No ingredients listed for this item.</p>
            )}
          </div>
          {allergens.length > 0 && (
            <div>
              <p className="text-xs text-red-500 uppercase tracking-wider mb-2 font-sans flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Allergens
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((a, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={`font-sans text-xs px-2.5 py-1 ${ALLERGEN_BADGE_COLORS[a] || 'bg-red-50 text-red-700 border-red-200'}`}
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const MOCK_MENU_ITEMS = [
  { id: '1', name: 'Ndole with Plantains', category: 'mains', price: 5500, description: 'Traditional Cameroonian dish with bitter leaves and peanuts', image: '', images: [], available: true, popular: true, ingredients: ['Bitter leaves', 'Peanuts', 'Crayfish', 'Palm oil', 'Plantains'], allergens: ['Peanuts', 'Shellfish'] },
  { id: '2', name: 'Grilled Fish (Braise)', category: 'mains', price: 8000, description: 'Fresh tilapia grilled with spices and plantains', image: '', images: [], available: true, popular: true, ingredients: ['Tilapia', 'Tomatoes', 'Onions', 'Pepper', 'Plantains'], allergens: ['Fish'] },
  { id: '3', name: 'Poulet DG', category: 'mains', price: 7500, description: 'Chicken with plantains in a rich tomato sauce', image: '', images: [], available: true, popular: true, ingredients: ['Chicken', 'Plantains', 'Tomatoes', 'Carrots', 'Green beans'], allergens: [] },
  { id: '4', name: 'Eru Soup', category: 'mains', price: 6000, description: 'Spinach-like vegetable soup with waterleaf', image: '', images: [], available: true, ingredients: ['Eru leaves', 'Waterleaf', 'Crayfish', 'Palm oil'], allergens: ['Shellfish'] },
  { id: '5', name: 'Koki Beans', category: 'starters', price: 2500, description: 'Steamed bean cake wrapped in banana leaves', image: '', images: [], available: true, ingredients: ['Black-eyed beans', 'Palm oil', 'Banana leaves'], allergens: [] },
  { id: '6', name: 'Accra Banana', category: 'starters', price: 1500, description: 'Fried ripe banana fritters', image: '', images: [], available: true, ingredients: ['Ripe bananas', 'Flour', 'Sugar'], allergens: ['Gluten'] },
  { id: '7', name: 'Fresh Fruit Salad', category: 'desserts', price: 2000, description: 'Seasonal tropical fruits', image: '', images: [], available: true, ingredients: ['Mango', 'Pineapple', 'Papaya', 'Passion fruit'], allergens: [] },
  { id: '8', name: 'Gateau de Manioc', category: 'desserts', price: 2500, description: 'Traditional cassava cake', image: '', images: [], available: true, ingredients: ['Cassava', 'Coconut', 'Sugar', 'Eggs'], allergens: ['Eggs'] },
  { id: '9', name: 'Fresh Juice', category: 'drinks', price: 1500, description: 'Orange, pineapple, or passion fruit', image: '', images: [], available: true, allergens: [] },
  { id: '10', name: 'Bissap (Hibiscus)', category: 'drinks', price: 1000, description: 'Refreshing hibiscus drink', image: '', images: [], available: true, ingredients: ['Hibiscus flowers', 'Sugar', 'Ginger'], allergens: [] },
  { id: '11', name: "Chef's Special Platter", category: 'specials', price: 15000, description: 'Assortment of our best dishes for 2', image: '', images: [], available: true, popular: true, allergens: ['Peanuts', 'Fish', 'Shellfish'] },
  { id: '12', name: 'Suya Skewers', category: 'starters', price: 3000, description: 'Spiced grilled meat skewers', image: '', images: [], available: true, ingredients: ['Beef', 'Suya spice', 'Onions', 'Tomatoes'], allergens: ['Peanuts'] }
];

const MOCK_RESTAURANT = {
  id: '1',
  name: 'La Belle Epoque',
  cuisine_type: ['african', 'french'],
  city: 'Yaounde',
  address: 'Avenue Kennedy, Bastos',
  rating: 4.7,
  opening_hours: '11:00 - 22:00',
  phone: '+237 699 123 456'
};

export default function RestaurantMenu() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restaurantId = searchParams.get('id');
  
  const [restaurant, setRestaurant] = useState(MOCK_RESTAURANT);
  const [menuItems, setMenuItems] = useState(MOCK_MENU_ITEMS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [excludedAllergens, setExcludedAllergens] = useState([]);
  
  const [cart, setCart] = useState({});
  const [orderType, setOrderType] = useState('dine-in');
  
  const [reservationDate, setReservationDate] = useState(new Date());
  const [reservationTime, setReservationTime] = useState('19:00');
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isReservationDateOpen, setIsReservationDateOpen] = useState(false);

  // Ingredients modal state
  const [ingredientsModal, setIngredientsModal] = useState({ open: false, itemName: '', ingredients: [], allergens: [] });

  useEffect(() => {
    if (restaurantId) loadRestaurantData();
  }, [restaurantId]);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      const [restaurantRes, menuRes] = await Promise.all([
        api.get(`/restaurants/${restaurantId}`),
        api.get(`/restaurants/${restaurantId}/menu`)
      ]);
      if (restaurantRes.data) setRestaurant(restaurantRes.data);
      if (menuRes.data?.items?.length > 0) setMenuItems(menuRes.data.items);
    } catch (error) {
      console.error('Failed to load restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    // Search matches dish name OR ingredient name
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery
      || item.name.toLowerCase().includes(queryLower)
      || (item.ingredients || []).some(ing => ing.toLowerCase().includes(queryLower));
    // Allergen filter: exclude items containing any excluded allergen
    const matchesDiet = excludedAllergens.length === 0
      || !excludedAllergens.some(ea => (item.allergens || []).map(a => a.toLowerCase()).includes(ea.toLowerCase()));
    return matchesCategory && matchesSearch && matchesDiet;
  });

  const toggleAllergenFilter = (allergenKey) => {
    setExcludedAllergens(prev =>
      prev.includes(allergenKey) ? prev.filter(a => a !== allergenKey) : [...prev, allergenKey]
    );
  };

  const addToCart = (item) => setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  const removeFromCart = (itemId) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) newCart[itemId] -= 1;
      else delete newCart[itemId];
      return newCart;
    });
  };
  const clearItem = (itemId) => setCart(prev => { const c = { ...prev }; delete c[itemId]; return c; });

  const getCartItems = () => Object.entries(cart).map(([itemId, quantity]) => {
    const item = menuItems.find(i => i.id === itemId);
    return item ? { ...item, quantity } : null;
  }).filter(Boolean);

  const subtotal = getCartItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleProceed = () => {
    const orderDetails = {
      restaurant,
      items: getCartItems(),
      order_type: orderType,
      subtotal,
      total: subtotal,
      reservation_date: orderType === 'dine-in' ? format(reservationDate, 'yyyy-MM-dd') : null,
      reservation_time: orderType === 'dine-in' ? reservationTime : null,
      guests: orderType === 'dine-in' ? guests : null,
      special_requests: specialRequests
    };
    sessionStorage.setItem('restaurantOrder', JSON.stringify(orderDetails));
    sessionStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
    navigate('/services/restaurants/booking');
  };

  const heroImageUrl = restaurant.images?.[0] || 'https://images.unsplash.com/photo-1744776411214-31209006a0f6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwcmVzdGF1cmFudCUyMGludGVyaW9yfGVufDB8fHx8MTc3NjQ2NjY1Nnww&ixlib=rb-4.1.0&q=85';

  return (
    <div className="min-h-screen bg-[#F9F9F7] font-sans">
      {/* ── Premium Hero Header ── */}
      <div className="relative w-full" style={{ minHeight: '280px' }} data-testid="restaurant-hero-header">
        <div className="absolute inset-0">
          <img
            src={heroImageUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#082c59]/90 via-[#082c59]/50 to-[#082c59]/30" />
        </div>
        <div className="relative px-4 sm:px-6 pt-6 pb-8 flex flex-col justify-end" style={{ minHeight: '280px' }}>
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="absolute top-6 left-4 sm:left-6 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
            data-testid="back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="mt-auto">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white font-bold tracking-tight leading-tight" data-testid="restaurant-name">
              {restaurant.name}
            </h1>
            {restaurant.cuisine_type?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 mb-4">
                {restaurant.cuisine_type.map(c => (
                  <Badge key={c} className="bg-white/15 text-white/90 border-white/20 capitalize text-xs font-sans backdrop-blur-sm">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            {/* Key info pills */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5 text-white/90" data-testid="restaurant-location">
                <MapPin className="h-4 w-4 text-[#C5A880]" />
                <span className="text-sm font-medium">{restaurant.address ? `${restaurant.address}, ` : ''}{restaurant.city}</span>
              </div>
              <div className="flex items-center gap-1.5" data-testid="restaurant-rating">
                <Star className="h-4 w-4 text-[#C5A880] fill-[#C5A880]" />
                <span className="text-sm font-medium text-white">{restaurant.average_rating || restaurant.rating || 'N/A'}</span>
                {restaurant.total_ratings > 0 && <span className="text-xs text-white/60">({restaurant.total_ratings})</span>}
              </div>
              <div className="flex items-center gap-1.5 text-white/90" data-testid="restaurant-hours">
                <Clock className="h-4 w-4 text-[#C5A880]" />
                <span className="text-sm font-medium">{formatOpeningHours(restaurant.opening_hours)}</span>
              </div>
              {restaurant.phone && (
                <div className="flex items-center gap-1.5 text-white/60">
                  <span className="text-xs">{restaurant.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-4 sm:px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* ── Left: Menu (8 cols) ── */}
          <div className="col-span-12 lg:col-span-8" data-testid="menu-section">
            {/* Search & Filter Bar */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-serif text-2xl text-[#082c59] font-semibold tracking-tight">Menu</h2>
                <Badge className="bg-[#082c59]/8 text-[#082c59] border-0 font-sans text-xs">{filteredItems.length} items</Badge>
              </div>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                <Input
                  placeholder="Search dishes or ingredients..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-[#E2E8F0] rounded-xl h-11 font-sans text-sm"
                  data-testid="menu-search-input"
                />
              </div>

              {/* Category Pills */}
              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0" data-testid="category-tabs">
                  {MENU_CATEGORIES.map(cat => (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      data-testid={`category-tab-${cat}`}
                      className="capitalize rounded-full px-5 py-2 text-xs font-medium font-sans
                        data-[state=active]:bg-[#082c59] data-[state=active]:text-white data-[state=active]:border-[#082c59] data-[state=active]:shadow-sm
                        data-[state=inactive]:bg-white data-[state=inactive]:text-[#64748B] border border-[#E2E8F0]
                        transition-all"
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Dietary Filters */}
              <div className="mt-3 flex items-center gap-2 flex-wrap" data-testid="dietary-filters">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" /> Dietary
                </span>
                {DIETARY_FILTERS.map(df => {
                  const isActive = excludedAllergens.includes(df.key);
                  return (
                    <button
                      key={df.key}
                      onClick={() => toggleAllergenFilter(df.key)}
                      data-testid={`dietary-filter-${df.key.toLowerCase().replace(/\s/g,'-')}`}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all font-sans ${
                        isActive
                          ? `bg-${df.color}-100 text-${df.color}-700 border-${df.color}-300 ring-1 ring-${df.color}-300`
                          : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50'
                      }`}
                      style={isActive ? { backgroundColor: `var(--${df.color}-100, #fef3c7)` } : {}}
                    >
                      {df.label}
                    </button>
                  );
                })}
                {excludedAllergens.length > 0 && (
                  <button
                    onClick={() => setExcludedAllergens([])}
                    className="px-2 py-1 text-[10px] text-red-500 hover:text-red-700 font-medium font-sans"
                    data-testid="clear-dietary-filters"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-0" data-testid="menu-items-list">
              {filteredItems.map((item, idx) => {
                const itemImages = item.images?.length > 0 ? item.images : (item.image ? [item.image] : []);
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-5 py-6 ${idx < filteredItems.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
                    data-testid={`menu-item-${item.id}`}
                  >
                    {/* Image Carousel */}
                    <ItemImageCarousel images={itemImages} />

                    {/* Item Info */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-serif text-base sm:text-lg font-semibold text-[#1A1D20] leading-snug">{item.name}</h3>
                            {item.popular && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-semibold rounded-full border border-orange-200" data-testid={`popular-badge-${item.id}`}>
                                <Flame className="w-2.5 h-2.5" /> Popular
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#64748B] mt-1 leading-relaxed line-clamp-2 font-sans">{item.description}</p>
                          
                          {/* Price + Ingredients link */}
                          <div className="flex items-center gap-3 mt-2.5">
                            <span className="font-sans font-bold text-[#082c59] text-base">{formatFCFA(item.price)}</span>
                            {item.ingredients?.length > 0 && (
                              <button
                                onClick={() => setIngredientsModal({ open: true, itemName: item.name, ingredients: item.ingredients, allergens: item.allergens || [] })}
                                className="text-xs text-[#C5A880] hover:text-[#082c59] underline underline-offset-4 font-sans transition-colors"
                                data-testid={`view-ingredients-${item.id}`}
                              >
                                View Ingredients
                              </button>
                            )}
                          </div>
                          {/* Allergen tags */}
                          {item.allergens?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2" data-testid={`allergens-${item.id}`}>
                              {item.allergens.map(a => (
                                <span key={a} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border font-sans ${ALLERGEN_BADGE_COLORS[a] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                  <AlertTriangle className="w-2 h-2" />
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add to cart */}
                        <div className="flex-shrink-0 pt-1">
                          {cart[item.id] ? (
                            <div className="flex items-center gap-1 bg-white rounded-full border border-[#E2E8F0] p-1 shadow-sm" data-testid={`cart-controls-${item.id}`}>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                                data-testid={`decrease-qty-${item.id}`}
                              >
                                <Minus className="h-3.5 w-3.5 text-[#64748B]" />
                              </button>
                              <span className="w-6 text-center font-bold text-sm text-[#082c59] font-sans">{cart[item.id]}</span>
                              <button
                                onClick={() => addToCart(item)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                                data-testid={`increase-qty-${item.id}`}
                              >
                                <Plus className="h-3.5 w-3.5 text-[#64748B]" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => addToCart(item)}
                              className="bg-[#082c59] hover:bg-[#051A35] rounded-full h-9 px-4 text-xs font-sans font-medium shadow-sm"
                              data-testid={`add-to-cart-${item.id}`}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredItems.length === 0 && (
                <div className="text-center py-16">
                  <Utensils className="w-10 h-10 text-[#C5A880]/40 mx-auto mb-3" />
                  <p className="font-sans text-[#64748B] text-sm">No dishes found</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart & Reservation (4 cols, sticky) ── */}
          <div className="col-span-12 lg:col-span-4" data-testid="sidebar-section">
            <div className="lg:sticky lg:top-8 space-y-5">
              {/* Cart Summary */}
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(8,44,89,0.06)] border border-[#E2E8F0]/50 overflow-hidden" data-testid="cart-summary">
                <div className="p-5 border-b border-[#E2E8F0]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShoppingCart className="h-4 w-4 text-[#082c59]" />
                      <h3 className="font-serif text-base font-semibold text-[#082c59]">Your Order</h3>
                    </div>
                    {cartCount > 0 && (
                      <Badge className="bg-[#082c59] text-white border-0 text-[10px] font-sans px-2">{cartCount}</Badge>
                    )}
                  </div>
                </div>
                
                <div className="p-5">
                  {cartCount === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-[#F9F9F7] rounded-full flex items-center justify-center mx-auto mb-2">
                        <ShoppingCart className="w-5 h-5 text-[#C5A880]/60" />
                      </div>
                      <p className="text-sm text-[#64748B] font-sans">Your cart is empty</p>
                      <p className="text-xs text-[#64748B]/60 mt-0.5">Browse the menu to add items</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {getCartItems().map(item => (
                        <div key={item.id} className="flex items-center justify-between py-2 border-b border-[#E2E8F0] last:border-0" data-testid={`cart-item-${item.id}`}>
                          <div className="flex-1 mr-2 min-w-0">
                            <p className="font-sans font-medium text-sm text-[#1A1D20] truncate">{item.name}</p>
                            <p className="text-xs text-[#64748B] font-sans">{item.quantity} x {formatFCFA(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-sans font-bold text-sm text-[#082c59]">{formatFCFA(item.price * item.quantity)}</span>
                            <button onClick={() => clearItem(item.id)} className="p-1 hover:bg-red-50 rounded-full transition-colors" data-testid={`remove-cart-item-${item.id}`}>
                              <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 mt-1">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-bold text-[#1A1D20]">Total</span>
                          <span className="font-serif text-xl font-bold text-[#082c59]">{formatFCFA(subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reservation Details - Compact */}
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(8,44,89,0.06)] border border-[#E2E8F0]/50 overflow-hidden" data-testid="reservation-section">
                <div className="p-5 border-b border-[#E2E8F0]">
                  <h3 className="font-serif text-base font-semibold text-[#082c59]">Reservation</h3>
                </div>
                <div className="p-5 space-y-3">
                  {/* Order Type */}
                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider font-sans">Order Type</label>
                    <Select value={orderType} onValueChange={setOrderType}>
                      <SelectTrigger className="mt-1 bg-[#F9F9F7] border-[#E2E8F0] rounded-xl h-9 text-sm font-sans" data-testid="order-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="dine-in">Dine-in</SelectItem>
                        <SelectItem value="takeout">Takeout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {orderType === 'dine-in' && (
                    <>
                      {/* Date & Time side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider font-sans">Date</label>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start mt-1 bg-[#F9F9F7] border-[#E2E8F0] rounded-xl h-9 text-xs font-sans hover:bg-white"
                            onClick={() => setIsReservationDateOpen(true)}
                            data-testid="reservation-date-btn"
                          >
                            <CalendarIcon className="mr-1.5 h-3 w-3 text-[#C5A880]" />
                            {format(reservationDate, 'MMM d')}
                          </Button>
                          <DatePickerModal
                            isOpen={isReservationDateOpen}
                            onClose={() => setIsReservationDateOpen(false)}
                            onSelect={setReservationDate}
                            selectedDate={reservationDate}
                            title="Select Reservation Date"
                            minDate={new Date()}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider font-sans">Time</label>
                          <Select value={reservationTime} onValueChange={setReservationTime}>
                            <SelectTrigger className="mt-1 bg-[#F9F9F7] border-[#E2E8F0] rounded-xl h-9 text-xs font-sans" data-testid="reservation-time-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              {['11:00', '12:00', '13:00', '18:00', '19:00', '20:00', '21:00'].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider font-sans">Guests</label>
                        <Select value={String(guests)} onValueChange={v => setGuests(Number(v))}>
                          <SelectTrigger className="mt-1 bg-[#F9F9F7] border-[#E2E8F0] rounded-xl h-9 text-sm font-sans" data-testid="guests-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'Guest' : 'Guests'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider font-sans">Special Requests</label>
                    <Textarea
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="Allergies, preferences..."
                      className="mt-1 bg-[#F9F9F7] border-[#E2E8F0] rounded-xl min-h-[48px] text-xs font-sans resize-none"
                      rows={2}
                      data-testid="special-requests-textarea"
                    />
                  </div>
                </div>
              </div>

              {/* Proceed Button */}
              <Button 
                onClick={handleProceed}
                disabled={cartCount === 0} 
                className="w-full bg-[#C5A880] hover:bg-[#A98E64] text-[#1A1D20] h-12 rounded-full text-sm font-bold font-sans shadow-lg disabled:opacity-40 transition-colors"
                data-testid="proceed-to-booking-btn"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Proceed to Booking
              </Button>
              <p className="text-center text-[10px] text-[#64748B] font-sans">You will not be charged yet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients Modal */}
      <IngredientsModal
        open={ingredientsModal.open}
        onClose={() => setIngredientsModal({ open: false, itemName: '', ingredients: [], allergens: [] })}
        itemName={ingredientsModal.itemName}
        ingredients={ingredientsModal.ingredients}
        allergens={ingredientsModal.allergens}
      />
    </div>
  );
}
