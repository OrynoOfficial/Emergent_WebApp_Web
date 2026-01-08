import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { 
  ArrowLeft, ShoppingCart, Plus, Minus, Trash2, 
  Calendar as CalendarIcon, Clock, Users, MapPin,
  Utensils, Star, CheckCircle, Tag, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const MENU_CATEGORIES = ['all', 'starters', 'mains', 'desserts', 'drinks', 'specials'];

const MOCK_MENU_ITEMS = [
  { id: '1', name: 'Ndolé with Plantains', category: 'mains', price: 5500, description: 'Traditional Cameroonian dish with bitter leaves and peanuts', image: '', available: true, popular: true },
  { id: '2', name: 'Grilled Fish (Braise)', category: 'mains', price: 8000, description: 'Fresh tilapia grilled with spices and plantains', image: '', available: true, popular: true },
  { id: '3', name: 'Poulet DG', category: 'mains', price: 7500, description: 'Chicken with plantains in a rich tomato sauce', image: '', available: true, popular: true },
  { id: '4', name: 'Eru Soup', category: 'mains', price: 6000, description: 'Spinach-like vegetable soup with waterleaf', image: '', available: true },
  { id: '5', name: 'Koki Beans', category: 'starters', price: 2500, description: 'Steamed bean cake wrapped in banana leaves', image: '', available: true },
  { id: '6', name: 'Accra Banana', category: 'starters', price: 1500, description: 'Fried ripe banana fritters', image: '', available: true },
  { id: '7', name: 'Fresh Fruit Salad', category: 'desserts', price: 2000, description: 'Seasonal tropical fruits', image: '', available: true },
  { id: '8', name: 'Gâteau de Manioc', category: 'desserts', price: 2500, description: 'Traditional cassava cake', image: '', available: true },
  { id: '9', name: 'Fresh Juice', category: 'drinks', price: 1500, description: 'Orange, pineapple, or passion fruit', image: '', available: true },
  { id: '10', name: 'Bissap (Hibiscus)', category: 'drinks', price: 1000, description: 'Refreshing hibiscus drink', image: '', available: true },
  { id: '11', name: 'Chef\'s Special Platter', category: 'specials', price: 15000, description: 'Assortment of our best dishes for 2', image: '', available: true, popular: true },
  { id: '12', name: 'Suya Skewers', category: 'starters', price: 3000, description: 'Spiced grilled meat skewers', image: '', available: true }
];

const MOCK_RESTAURANT = {
  id: '1',
  name: 'La Belle Époque',
  cuisine_type: ['african', 'french'],
  city: 'Yaoundé',
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
  
  // Cart State
  const [cart, setCart] = useState({});
  const [orderType, setOrderType] = useState('dine-in');
  
  // Reservation State
  const [reservationDate, setReservationDate] = useState(new Date());
  const [reservationTime, setReservationTime] = useState('19:00');
  const [guests, setGuests] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isReservationDateOpen, setIsReservationDateOpen] = useState(false);
  
  // Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  
  // Order State
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      loadRestaurantData();
    }
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
      // Keep mock data
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => 
    activeCategory === 'all' || item.category === activeCategory
  );

  const addToCart = (item) => {
    setCart(prev => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId] -= 1;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const clearItem = (itemId) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[itemId];
      return newCart;
    });
  };

  const getCartItems = () => {
    return Object.entries(cart).map(([itemId, quantity]) => {
      const item = menuItems.find(i => i.id === itemId);
      return { ...item, quantity };
    }).filter(Boolean);
  };

  const subtotal = getCartItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = subtotal * (promoDiscount / 100);
  const total = subtotal - discount;
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setApplyingPromo(true);
    try {
      const res = await api.post('/promo-codes/validate', {
        code: promoCode,
        service_type: 'restaurant',
        amount: subtotal
      });
      if (res.data?.valid) {
        setPromoDiscount(res.data.discount_percent || 10);
        setPromoMessage(`${res.data.discount_percent}% discount applied!`);
      } else {
        setPromoMessage('Invalid promo code');
      }
    } catch (error) {
      // Mock response
      if (promoCode.toUpperCase() === 'WELCOME10') {
        setPromoDiscount(10);
        setPromoMessage('10% discount applied!');
      } else if (promoCode.toUpperCase() === 'FOOD20') {
        setPromoDiscount(20);
        setPromoMessage('20% discount applied!');
      } else {
        setPromoMessage('Invalid promo code');
        setPromoDiscount(0);
      }
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleOrder = async () => {
    if (cartCount === 0) return;
    setIsOrdering(true);
    try {
      const orderData = {
        restaurant_id: restaurant.id,
        items: getCartItems().map(i => ({ item_id: i.id, quantity: i.quantity, price: i.price })),
        order_type: orderType,
        subtotal,
        discount,
        total,
        promo_code: promoDiscount > 0 ? promoCode : null,
        reservation_date: orderType === 'dine-in' ? format(reservationDate, 'yyyy-MM-dd') : null,
        reservation_time: orderType === 'dine-in' ? reservationTime : null,
        guests: orderType === 'dine-in' ? guests : null,
        special_requests: specialRequests
      };
      await api.post(`/restaurants/${restaurant.id}/orders`, orderData);
      navigate('/booking-confirmation?type=restaurant&status=success');
    } catch (error) {
      // For demo, navigate to confirmation anyway
      navigate('/booking-confirmation?type=restaurant&status=success');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#082c59] text-white py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{restaurant.name}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-200">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {restaurant.city}</span>
                <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" /> {restaurant.rating}</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {restaurant.opening_hours}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5" /> Menu
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Category Tabs */}
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                  <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
                    {MENU_CATEGORIES.map(cat => (
                      <TabsTrigger key={cat} value={cat} className="capitalize">{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {/* Menu Items */}
                <div className="space-y-3">
                  {filteredItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.name}</h4>
                          {item.popular && <Badge className="bg-orange-100 text-orange-700 border-0">Popular</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">{item.description}</p>
                        <p className="font-bold text-[#082c59] mt-1">{formatFCFA(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cart[item.id] ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-medium">{cart[item.id]}</span>
                            <Button size="sm" variant="outline" onClick={() => addToCart(item)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(item)} className="bg-[#082c59]">
                            <Plus className="h-4 w-4 mr-1" /> Add
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart & Order Section */}
          <div className="space-y-4">
            {/* Cart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Your Order</span>
                  {cartCount > 0 && <Badge>{cartCount} items</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cartCount === 0 ? (
                  <p className="text-slate-500 text-center py-4">Your cart is empty</p>
                ) : (
                  <div className="space-y-3">
                    {getCartItems().map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-slate-500">{item.quantity} x {formatFCFA(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatFCFA(item.price * item.quantity)}</span>
                          <Button size="sm" variant="ghost" onClick={() => clearItem(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatFCFA(subtotal)}</span></div>
                      {promoDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount ({promoDiscount}%)</span><span>-{formatFCFA(discount)}</span></div>}
                      <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatFCFA(total)}</span></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Promo Code */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Promo Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Enter code" />
                  <Button onClick={applyPromoCode} disabled={applyingPromo} variant="outline">
                    {applyingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                {promoMessage && <p className={`text-sm mt-2 ${promoDiscount > 0 ? 'text-green-600' : 'text-red-500'}`}>{promoMessage}</p>}
              </CardContent>
            </Card>

            {/* Order Type */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Order Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine-in">Dine-in Reservation</SelectItem>
                    <SelectItem value="takeout">Takeout</SelectItem>
                  </SelectContent>
                </Select>

                {orderType === 'dine-in' && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal mt-1"
                        onClick={() => setIsReservationDateOpen(true)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
                      <label className="text-sm font-medium">Time</label>
                      <Select value={reservationTime} onValueChange={setReservationTime}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['11:00', '12:00', '13:00', '18:00', '19:00', '20:00', '21:00'].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Guests</label>
                      <Select value={String(guests)} onValueChange={v => setGuests(Number(v))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'Guest' : 'Guests'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-sm font-medium">Special Requests</label>
                  <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Allergies, preferences, etc." className="mt-1" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Order Button - Proceed to Booking */}
            <Button 
              onClick={() => {
                // Store cart and order details for booking page
                const orderDetails = {
                  restaurant,
                  items: getCartItems().map(i => ({ ...i })),
                  order_type: orderType,
                  subtotal,
                  discount,
                  total,
                  promo_code: promoDiscount > 0 ? promoCode : null,
                  reservation_date: orderType === 'dine-in' ? format(reservationDate, 'yyyy-MM-dd') : null,
                  reservation_time: orderType === 'dine-in' ? reservationTime : null,
                  guests: orderType === 'dine-in' ? guests : null,
                  special_requests: specialRequests
                };
                sessionStorage.setItem('restaurantOrder', JSON.stringify(orderDetails));
                sessionStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
                navigate('/services/restaurants/booking');
              }} 
              disabled={cartCount === 0} 
              className="w-full bg-[#082c59] h-12 text-lg"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Proceed to Booking - {formatFCFA(total)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
