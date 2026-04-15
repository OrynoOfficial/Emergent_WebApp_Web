import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Star, MapPin, Clock, Phone, Globe, 
  Utensils, Users, Wifi, Car, Music, Wine,
  ChefHat, Leaf, Award, Heart
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import SubscribeButton from '@/components/shared/SubscribeButton';

const CUISINE_ICONS = {
  african: '🍲',
  french: '🥐',
  italian: '🍝',
  chinese: '🥢',
  japanese: '🍣',
  indian: '🍛',
  american: '🍔',
  seafood: '🦐',
  vegetarian: '🥗',
  default: '🍽️'
};

export default function RestaurantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    loadRestaurant();
  }, [id]);

  const loadRestaurant = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/restaurants/${id}`);
      setRestaurant(res.data);
      // Load menu items
      setMenu(res.data.menu || []);
    } catch (error) {
      console.error('Failed to load restaurant:', error);
      // Mock data
      setRestaurant({
        id,
        name: 'La Belle Époque',
        description: 'Experience fine French-African fusion cuisine in an elegant setting. Our award-winning chef combines traditional techniques with local ingredients to create unforgettable dishes.',
        cuisine_type: ['french', 'african', 'fusion'],
        city: 'Yaoundé',
        address: 'Avenue Kennedy, Bastos',
        rating: 4.7,
        reviews_count: 186,
        price_range: '$$$$',
        opening_hours: {
          monday: '12:00 - 22:00',
          tuesday: '12:00 - 22:00',
          wednesday: '12:00 - 22:00',
          thursday: '12:00 - 23:00',
          friday: '12:00 - 23:00',
          saturday: '11:00 - 23:00',
          sunday: '11:00 - 21:00'
        },
        phone: '+237 699 123 456',
        website: 'www.labelleepoque.cm',
        features: ['outdoor_seating', 'private_dining', 'live_music', 'wine_cellar', 'parking', 'wifi'],
        dress_code: 'Smart Casual',
        accepts_reservations: true
      });
      setMenu([
        { id: '1', category: 'Starters', name: 'Foie Gras Terrine', description: 'House-made foie gras with fig compote', price: 15000, popular: true },
        { id: '2', category: 'Starters', name: 'Ndolé Spring Rolls', description: 'Crispy rolls filled with traditional ndolé', price: 8000, vegetarian: false },
        { id: '3', category: 'Starters', name: 'Soup du Jour', description: 'Chef\'s daily soup creation', price: 5000 },
        { id: '4', category: 'Main Courses', name: 'Grilled Lobster', description: 'Whole lobster with garlic butter and local herbs', price: 45000, popular: true },
        { id: '5', category: 'Main Courses', name: 'Beef Bourguignon', description: 'Classic French stew with Cameroon red wine', price: 28000 },
        { id: '6', category: 'Main Courses', name: 'Poulet DG Revisité', description: 'Elevated version of the Cameroonian classic', price: 22000, popular: true },
        { id: '7', category: 'Main Courses', name: 'Grilled Fish', description: 'Fresh catch with plantain puree', price: 25000 },
        { id: '8', category: 'Desserts', name: 'Crème Brûlée', description: 'Vanilla bean crème brûlée', price: 8000 },
        { id: '9', category: 'Desserts', name: 'Chocolate Fondant', description: 'Warm chocolate cake with ice cream', price: 10000, popular: true },
        { id: '10', category: 'Beverages', name: 'House Wine (Glass)', description: 'Red, White, or Rosé', price: 5000 },
        { id: '11', category: 'Beverages', name: 'Fresh Juice', description: 'Mango, Passion Fruit, or Pineapple', price: 3000 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getFeatureIcon = (feature) => {
    switch (feature) {
      case 'outdoor_seating': return <Utensils className="w-4 h-4" />;
      case 'private_dining': return <Users className="w-4 h-4" />;
      case 'live_music': return <Music className="w-4 h-4" />;
      case 'wine_cellar': return <Wine className="w-4 h-4" />;
      case 'parking': return <Car className="w-4 h-4" />;
      case 'wifi': return <Wifi className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const menuCategories = ['all', ...new Set(menu.map(item => item.category))];
  const filteredMenu = activeCategory === 'all' ? menu : menu.filter(item => item.category === activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59]"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Restaurant not found</h2>
          <Button onClick={() => navigate('/services/restaurants')}>Back to Restaurants</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="h-72 bg-gradient-to-r from-amber-100 to-orange-100 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-8xl">{CUISINE_ICONS[restaurant.cuisine_type?.[0]] || CUISINE_ICONS.default}</span>
        </div>
        <div className="absolute bottom-4 right-4 flex gap-2">
          {restaurant.cuisine_type?.map(type => (
            <Badge key={type} className="bg-white/90 text-gray-800 capitalize">{type}</Badge>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Restaurant Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-[#082c59]">{restaurant.name}</h1>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-1" />
                        {restaurant.address}, {restaurant.city}
                      </div>
                      <Badge variant="outline">{restaurant.price_range}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="text-xl font-bold">{restaurant.rating}</span>
                      <span className="text-sm text-gray-500">({restaurant.reviews_count})</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">{restaurant.description}</p>
                
                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {restaurant.features?.map(feature => (
                    <Badge key={feature} variant="outline" className="capitalize flex items-center gap-1">
                      {getFeatureIcon(feature)}
                      {feature.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Menu */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ChefHat className="w-5 h-5" /> Menu
                </h2>
                
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {menuCategories.map(cat => (
                    <Button
                      key={cat}
                      variant={activeCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveCategory(cat)}
                      className={activeCategory === cat ? 'bg-[#082c59]' : ''}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </Button>
                  ))}
                </div>

                {/* Menu Items */}
                <div className="space-y-4">
                  {filteredMenu.map(item => (
                    <div key={item.id} className="flex justify-between items-start p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.popular && <Badge className="bg-amber-100 text-amber-800"><Award className="w-3 h-3 mr-1" /> Popular</Badge>}
                          {item.vegetarian && <Badge className="bg-green-100 text-green-800"><Leaf className="w-3 h-3 mr-1" /> Veg</Badge>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      </div>
                      <div className="text-lg font-bold text-[#082c59] ml-4">{formatFCFA(item.price)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Reservation Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Make a Reservation</h3>
                <Button 
                  className="w-full bg-[#082c59] h-12 mb-4" 
                  onClick={() => navigate(`/services/restaurants/booking?id=${restaurant.id}`)}
                >
                  Reserve a Table
                </Button>
                {restaurant.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Phone className="w-4 h-4" /> {restaurant.phone}
                  </div>
                )}
                {restaurant.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="w-4 h-4" /> {restaurant.website}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Opening Hours */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Opening Hours
                </h3>
                <div className="space-y-2 text-sm">
                  {restaurant.opening_hours && Object.entries(restaurant.opening_hours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize text-gray-600">{day}</span>
                      <span className="font-medium">{hours}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dress Code */}
            {restaurant.dress_code && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">Dress Code</h3>
                  <p className="text-gray-600">{restaurant.dress_code}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
