import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { 
  ArrowLeft, ShoppingCart, Plus, Minus, Trash2, 
  Calendar as CalendarIcon, Clock, Users, MapPin,
  Utensils, Star, CheckCircle, Loader2, Search, Flame
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const MENU_CATEGORIES = ['all', 'starters', 'mains', 'desserts', 'drinks', 'specials'];

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

const MOCK_MENU_ITEMS = [
  { id: '1', name: 'Ndole with Plantains', category: 'mains', price: 5500, description: 'Traditional Cameroonian dish with bitter leaves and peanuts', image: '', available: true, popular: true },
  { id: '2', name: 'Grilled Fish (Braise)', category: 'mains', price: 8000, description: 'Fresh tilapia grilled with spices and plantains', image: '', available: true, popular: true },
  { id: '3', name: 'Poulet DG', category: 'mains', price: 7500, description: 'Chicken with plantains in a rich tomato sauce', image: '', available: true, popular: true },
  { id: '4', name: 'Eru Soup', category: 'mains', price: 6000, description: 'Spinach-like vegetable soup with waterleaf', image: '', available: true },
  { id: '5', name: 'Koki Beans', category: 'starters', price: 2500, description: 'Steamed bean cake wrapped in banana leaves', image: '', available: true },
  { id: '6', name: 'Accra Banana', category: 'starters', price: 1500, description: 'Fried ripe banana fritters', image: '', available: true },
  { id: '7', name: 'Fresh Fruit Salad', category: 'desserts', price: 2000, description: 'Seasonal tropical fruits', image: '', available: true },
  { id: '8', name: 'Gateau de Manioc', category: 'desserts', price: 2500, description: 'Traditional cassava cake', image: '', available: true },
  { id: '9', name: 'Fresh Juice', category: 'drinks', price: 1500, description: 'Orange, pineapple, or passion fruit', image: '', available: true },
  { id: '10', name: 'Bissap (Hibiscus)', category: 'drinks', price: 1000, description: 'Refreshing hibiscus drink', image: '', available: true },
  { id: '11', name: "Chef's Special Platter", category: 'specials', price: 15000, description: 'Assortment of our best dishes for 2', image: '', available: true, popular: true },
  { id: '12', name: 'Suya Skewers', category: 'starters', price: 3000, description: 'Spiced grilled meat skewers', image: '', available: true }
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
  
  const [cart, setCart] = useState({});
  const [orderType, setOrderType] = useState('dine-in');
  
  const [reservationDate, setReservationDate] = useState(new Date());
  const [reservationTime, setReservationTime] = useState('19:00');
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isReservationDateOpen, setIsReservationDateOpen] = useState(false);

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
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#082c59] via-[#0a3a75] to-[#082c59] text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{restaurant.name}</h1>
              <div className="flex items-center gap-4 text-sm text-white/70 mt-1">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {restaurant.city}</span>
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400" /> {restaurant.average_rating || restaurant.rating || 'N/A'}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatOpeningHours(restaurant.opening_hours)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Menu */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Menu Header */}
              <div className="bg-gradient-to-r from-[#082c59]/5 to-slate-100 p-5 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#082c59] flex items-center gap-2">
                    <Utensils className="h-5 w-5" /> Menu
                  </h2>
                  <Badge className="bg-[#082c59]/10 text-[#082c59] border-0">{filteredItems.length} items</Badge>
                </div>
                
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search dishes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-slate-200 rounded-xl"
                  />
                </div>

                {/* Category Pills */}
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                  <TabsList className="flex flex-wrap gap-1.5 h-auto bg-transparent p-0">
                    {MENU_CATEGORIES.map(cat => (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        className="capitalize rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-[#082c59] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 border border-slate-200 data-[state=active]:border-[#082c59]"
                      >
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Menu Items */}
              <div className="p-4 space-y-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                      cart[item.id] 
                        ? 'bg-[#082c59]/5 border border-[#082c59]/20' 
                        : 'bg-slate-50 border border-transparent hover:border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex-1 mr-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                        {item.popular && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded-full">
                            <Flame className="w-3 h-3" /> Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
                      <p className="font-bold text-[#082c59] text-sm mt-1">{formatFCFA(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cart[item.id] ? (
                        <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-0.5">
                          <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors">
                            <Minus className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm text-[#082c59]">{cart[item.id]}</span>
                          <button onClick={() => addToCart(item)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors">
                            <Plus className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => addToCart(item)} className="bg-[#082c59] hover:bg-[#0a3a75] rounded-lg h-8 px-3 text-xs">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Cart & Reservation */}
          <div className="space-y-5">
            {/* Cart Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-4">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold">Your Order</h3>
                  </div>
                  {cartCount > 0 && (
                    <Badge className="bg-white/20 text-white border-0 text-xs">{cartCount} items</Badge>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                {cartCount === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShoppingCart className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">Your cart is empty</p>
                    <p className="text-xs text-slate-400 mt-1">Add items from the menu</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {getCartItems().map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                        <div className="flex-1 mr-2">
                          <p className="font-medium text-sm text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.quantity} x {formatFCFA(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#082c59]">{formatFCFA(item.price * item.quantity)}</span>
                          <button onClick={() => clearItem(item.id)} className="p-1 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-xl font-bold text-[#082c59]">{formatFCFA(subtotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reservation Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#082c59]/5 to-slate-100 p-4 border-b border-slate-200">
                <h3 className="font-bold text-[#082c59] text-sm">Reservation Details</h3>
              </div>
              <div className="p-4 space-y-3.5">
                {/* Order Type */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Order Type</label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="dine-in">Dine-in Reservation</SelectItem>
                      <SelectItem value="takeout">Takeout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {orderType === 'dine-in' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</label>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start mt-1.5 bg-slate-50 border-slate-200 rounded-xl hover:bg-slate-100"
                        onClick={() => setIsReservationDateOpen(true)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-[#082c59]" />
                        {format(reservationDate, 'PPP')}
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
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Time</label>
                      <Select value={reservationTime} onValueChange={setReservationTime}>
                        <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {['11:00', '12:00', '13:00', '18:00', '19:00', '20:00', '21:00'].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Guests</label>
                      <Select value={String(guests)} onValueChange={v => setGuests(Number(v))}>
                        <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200 rounded-xl">
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
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Special Requests</label>
                  <Textarea
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Allergies, preferences, etc."
                    className="mt-1.5 bg-slate-50 border-slate-200 rounded-xl min-h-[60px] text-sm"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Proceed Button */}
            <div className="space-y-2">
              <Button 
                onClick={handleProceed}
                disabled={cartCount === 0} 
                className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 rounded-xl text-base font-bold shadow-lg"
                data-testid="proceed-to-booking-btn"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Final Step
              </Button>
              <p className="text-center text-xs text-slate-500">You will not be charged yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
