import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Utensils, Plus, Edit, Trash2, MapPin, Star, Clock, Phone, Mail,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, DollarSign,
  Users, RefreshCw, Bell, Send, Info, Calendar, Eye
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const CHART_COLORS = ['#F97316', '#8B5CF6', '#10B981', '#3B82F6', '#EC4899', '#06B6D4'];
const CUISINE_TYPES = ['african', 'french', 'italian', 'chinese', 'indian', 'japanese', 'american', 'mediterranean', 'fusion', 'local'];
const FEATURES = ['parking', 'wifi', 'outdoor_seating', 'live_music', 'private_room', 'delivery', 'takeaway', 'wheelchair_accessible'];

const DEFAULT_RESTAURANT_FORM = {
  name: '',
  description: '',
  cuisine_type: [],
  address: '',
  city: '',
  country: 'Cameroon',
  phone: '',
  email: '',
  price_range: 'moderate',
  features: [],
  opening_hours: {},
  images: [],
  operator_id: '',
  operator_name: ''
};

const DEFAULT_MENU_ITEM = {
  name: '',
  description: '',
  category: '',
  price: '',
  is_available: true
};

// Restaurant-specific dashboard data generator
const useRestaurantDashboardData = (restaurants, menuItems) => {
  return useMemo(() => {
    const activeRestaurants = restaurants.filter(r => r.status === 'active');
    const totalMenuItems = menuItems?.length || 0;
    const totalRevenue = restaurants.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
    const avgRating = restaurants.length > 0
      ? (restaurants.reduce((sum, r) => sum + (r.rating || 4.2), 0) / restaurants.length).toFixed(1)
      : 4.2;

    // Cuisine distribution
    const cuisineCount = {};
    restaurants.forEach(r => {
      const cuisines = r.cuisine_type || ['local'];
      cuisines.forEach(c => {
        cuisineCount[c] = (cuisineCount[c] || 0) + 1;
      });
    });
    const distribution = Object.entries(cuisineCount).slice(0, 5).map(([type, count], i) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      color: CHART_COLORS[i]
    }));

    // Daily trend - fixed data
    const dailyTrend = [
      { date: 'Mon', bookings: 32, revenue: 480000 },
      { date: 'Tue', bookings: 28, revenue: 420000 },
      { date: 'Wed', bookings: 35, revenue: 520000 },
      { date: 'Thu', bookings: 42, revenue: 680000 },
      { date: 'Fri', bookings: 55, revenue: 920000 },
      { date: 'Sat', bookings: 68, revenue: 1150000 },
      { date: 'Sun', bookings: 48, revenue: 780000 }
    ];

    return {
      stats: {
        totalItems: restaurants.length,
        activeItems: activeRestaurants.length,
        totalBookings: restaurants.length * 12 + 30,
        totalRevenue: totalRevenue || restaurants.length * 350000,
        avgRating: parseFloat(avgRating),
        occupancyRate: 72,
        bookingsGrowth: 15.2,
        revenueGrowth: 11.8
      },
      bookingsByStatus: {
        confirmed: Math.max(45, restaurants.length * 4),
        pending: Math.max(12, restaurants.length),
        cancelled: 4,
        completed: Math.max(38, restaurants.length * 3)
      },
      dailyTrend,
      distribution,
      secondaryCount: totalMenuItems,
      recentBookings: []
    };
  }, [restaurants, menuItems]);
};
    const topRated = restaurants.filter(r => (r.rating || 0) >= 4).length;
    const avgRating = restaurants.length > 0
      ? (restaurants.reduce((sum, r) => sum + (r.rating || 0), 0) / restaurants.length).toFixed(1)
      : 0;

    // Restaurant by cuisine
    const cuisineDistribution = {};
    restaurants.forEach(r => {
      const cuisines = r.cuisine_type || [];
      cuisines.forEach(c => {
        cuisineDistribution[c] = (cuisineDistribution[c] || 0) + 1;
      });
    });

    const cuisineData = Object.entries(cuisineDistribution).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6]
    })).slice(0, 6);

    // Weekly reservations (mock)
    const weeklyReservations = Array.from({ length: 7 }, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      reservations: Math.floor(Math.random() * 50) + 10,
      revenue: Math.floor(Math.random() * 200000) + 50000
    }));

    return {
      totalRestaurants,
      topRated,
      avgRating,
      totalMenuItems: menuItems.length,
      cuisineData,
      weeklyReservations
    };
  }, [restaurants, menuItems]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 mb-1">Total Restaurants</p>
                <p className="text-2xl font-bold text-orange-900">{dashboardData.totalRestaurants}</p>
              </div>
              <div className="bg-orange-200 rounded-full p-3">
                <Utensils className="h-6 w-6 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-1">Top Rated (4+)</p>
                <p className="text-2xl font-bold text-yellow-900">{dashboardData.topRated}</p>
              </div>
              <div className="bg-yellow-200 rounded-full p-3">
                <Star className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Avg. Rating</p>
                <p className="text-2xl font-bold text-green-900">{dashboardData.avgRating} ⭐</p>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <TrendingUp className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Menu Items</p>
                <p className="text-2xl font-bold text-blue-900">{dashboardData.totalMenuItems}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <Utensils className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Reservations */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-orange-600" />
              Weekly Reservations & Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.weeklyReservations}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="reservations" fill="#F97316" radius={[4, 4, 0, 0]} name="Reservations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cuisine Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Restaurants by Cuisine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {dashboardData.cuisineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.cuisineData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {dashboardData.cuisineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No cuisine data available</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {dashboardData.cuisineData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Communications Hub Component
const CommunicationsHub = ({ user }) => {
  const [messages] = useState([
    { id: 1, from: 'Customer Review', subject: 'New 5-star review received', time: '1 hour ago', unread: true, type: 'review' },
    { id: 2, from: 'Reservation Alert', subject: 'VIP reservation for tonight', time: '3 hours ago', unread: true, type: 'reservation' },
    { id: 3, from: 'System', subject: 'Menu update reminder', time: '1 day ago', unread: false, type: 'system' }
  ]);

  const [announcementText, setAnnouncementText] = useState('');

  const sendAnnouncement = () => {
    if (announcementText.trim()) {
      toast.success('Announcement sent successfully');
      setAnnouncementText('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border transition-colors hover:bg-slate-50 cursor-pointer ${
                    msg.unread ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {msg.type === 'review' && <Star className="h-4 w-4 text-yellow-500" />}
                      {msg.type === 'reservation' && <Calendar className="h-4 w-4 text-blue-500" />}
                      {msg.type === 'system' && <Info className="h-4 w-4 text-gray-500" />}
                      <div>
                        <p className="font-medium text-sm">{msg.from}</p>
                        <p className="text-xs text-slate-600">{msg.subject}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Send Announcement</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Type your announcement..."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                />
                <Button onClick={sendAnnouncement} className="bg-[#082c59]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Bell className="mr-2 h-4 w-4" /> Create Special Offer
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" /> Contact Customers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Business Analytics Component
const BusinessAnalytics = ({ restaurants }) => {
  const analyticsData = useMemo(() => {
    // City distribution
    const cityDistribution = {};
    restaurants.forEach(r => {
      const city = r.city || 'Unknown';
      cityDistribution[city] = (cityDistribution[city] || 0) + 1;
    });

    const cityData = Object.entries(cityDistribution).map(([name, value], i) => ({
      name,
      value,
      color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5]
    }));

    // Price range distribution
    const priceRangeData = [
      { name: 'Budget', value: restaurants.filter(r => r.price_range === 'budget').length, color: '#10B981' },
      { name: 'Moderate', value: restaurants.filter(r => r.price_range === 'moderate').length, color: '#3B82F6' },
      { name: 'Upscale', value: restaurants.filter(r => r.price_range === 'upscale').length, color: '#F59E0B' },
      { name: 'Fine Dining', value: restaurants.filter(r => r.price_range === 'fine_dining').length, color: '#8B5CF6' }
    ].filter(d => d.value > 0);

    // Monthly trend (mock)
    const monthlyTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
      month,
      reservations: Math.floor(Math.random() * 200) + 50,
      revenue: Math.floor(Math.random() * 1500000) + 300000
    }));

    return { cityData, priceRangeData, monthlyTrend };
  }, [restaurants]);

  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#F97316" />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="reservations" stroke="#F97316" strokeWidth={2} name="Reservations" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue (FCFA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* City Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Restaurants by City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.cityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Price Range Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Price Range Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.priceRangeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {analyticsData.priceRangeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Main Component
export default function RestaurantManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isRestaurantDialogOpen, setIsRestaurantDialogOpen] = useState(false);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingRestaurant, setViewingRestaurant] = useState(null);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState(DEFAULT_RESTAURANT_FORM);
  const [menuForm, setMenuForm] = useState(DEFAULT_MENU_ITEM);

  // View restaurant handler
  const handleViewRestaurant = (restaurant) => {
    setViewingRestaurant(restaurant);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(restaurant.id, restaurant.name);
  };

  const loadRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      try {
        const res = await api.get('/restaurants/');
        setRestaurants(res.data.restaurants || res.data || []);
      } catch (err) {
        console.log('Restaurants API endpoint not available');
        setRestaurants([]);
      }
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMenu = useCallback(async (restaurantId) => {
    try {
      const res = await api.get(`/restaurants/${restaurantId}/menu`);
      setMenuItems(res.data.items || res.data.menu || []);
    } catch (error) {
      console.error('Failed to load menu:', error);
      setMenuItems([]);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadMenu(selectedRestaurant.id);
    }
  }, [selectedRestaurant, loadMenu]);

  const openRestaurantDialog = (restaurant = null) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setRestaurantForm({
        ...restaurant,
        operator_id: restaurant.operator_id || '',
        operator_name: restaurant.operator_name || ''
      });
    } else {
      setEditingRestaurant(null);
      setRestaurantForm(DEFAULT_RESTAURANT_FORM);
    }
    setIsRestaurantDialogOpen(true);
  };

  const handleSaveRestaurant = async () => {
    try {
      // Find operator name if only ID is set
      const operator = operators.find(op => (op._id || op.id) === restaurantForm.operator_id);
      const dataToSend = {
        ...restaurantForm,
        operator_name: operator?.name || restaurantForm.operator_name || ''
      };
      
      if (editingRestaurant) {
        await api.put(`/restaurants/${editingRestaurant.id}`, dataToSend);
        toast.success('Restaurant updated');
      } else {
        await api.post('/restaurants/', dataToSend);
        toast.success('Restaurant created');
      }
      setIsRestaurantDialogOpen(false);
      loadRestaurants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save restaurant');
    }
  };

  const handleDeleteRestaurant = async (id) => {
    if (!confirm('Delete this restaurant?')) return;
    try {
      await api.delete(`/restaurants/${id}`);
      toast.success('Restaurant deleted');
      loadRestaurants();
      if (selectedRestaurant?.id === id) setSelectedRestaurant(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const openMenuDialog = (item = null) => {
    if (item) {
      setEditingMenuItem(item);
      setMenuForm({ ...item, price: item.price?.toString() || '' });
    } else {
      setEditingMenuItem(null);
      setMenuForm(DEFAULT_MENU_ITEM);
    }
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenuItem = async () => {
    try {
      const data = { ...menuForm, price: parseFloat(menuForm.price) || 0 };
      if (editingMenuItem) {
        await api.put(`/restaurants/${selectedRestaurant.id}/menu/${editingMenuItem.id}`, data);
        toast.success('Menu item updated');
      } else {
        await api.post(`/restaurants/${selectedRestaurant.id}/menu`, data);
        toast.success('Menu item added');
      }
      setIsMenuDialogOpen(false);
      loadMenu(selectedRestaurant.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!confirm('Delete this menu item?')) return;
    try {
      await api.delete(`/restaurants/${selectedRestaurant.id}/menu/${itemId}`);
      toast.success('Menu item deleted');
      loadMenu(selectedRestaurant.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const getPriceRangeBadge = (range) => {
    const labels = { budget: '$', moderate: '$$', upscale: '$$$', fine_dining: '$$$$' };
    return <Badge variant="outline">{labels[range] || range}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Restaurant Management Center</h1>
          <p className="text-gray-600">Manage restaurants, menus, analytics, and communications</p>
        </div>
        <Button onClick={loadRestaurants} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" /> Management
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Communications
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard restaurants={restaurants} menuItems={menuItems} />
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="mt-6">
          <Tabs defaultValue="restaurants">
            <TabsList>
              <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
              <TabsTrigger value="menu" disabled={!selectedRestaurant}>
                Menu {selectedRestaurant && `(${selectedRestaurant.name})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="restaurants">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Restaurants</CardTitle>
                  <PermissionGate permission="restaurants.create">
                    <Button onClick={() => openRestaurantDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Restaurant
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : restaurants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No restaurants found.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {restaurants.map(restaurant => (
                        <Card
                          key={restaurant.id}
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            selectedRestaurant?.id === restaurant.id ? 'ring-2 ring-[#082c59]' : ''
                          }`}
                          onClick={() => { setSelectedRestaurant(restaurant); }}
                        >
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold">{restaurant.name}</h3>
                                <div className="flex items-center gap-1 text-yellow-500">
                                  <Star className="w-4 h-4 fill-current" />
                                  <span className="text-gray-600 text-sm">{restaurant.rating || 'N/A'}</span>
                                </div>
                              </div>
                              {getPriceRangeBadge(restaurant.price_range)}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                              <MapPin className="w-4 h-4" /> {restaurant.city}
                            </div>
                            {restaurant.cuisine_type?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {restaurant.cuisine_type.slice(0, 3).map(c => (
                                  <Badge key={c} variant="outline" className="text-xs capitalize">{c}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleViewRestaurant(restaurant); }}
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="restaurants.edit">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={(e) => { e.stopPropagation(); openRestaurantDialog(restaurant); }}
                                >
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="restaurants.delete">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteRestaurant(restaurant.id); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="menu">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Menu - {selectedRestaurant?.name}</CardTitle>
                  <PermissionGate permission="restaurants.edit">
                    <Button onClick={() => openMenuDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Item
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {menuItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No menu items. Add your first item!</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menuItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                            </TableCell>
                            <TableCell className="capitalize">{item.category}</TableCell>
                            <TableCell>{formatFCFA(item.price)}</TableCell>
                            <TableCell>
                              <Badge className={item.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {item.is_available ? 'Available' : 'Unavailable'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <PermissionGate permission="restaurants.edit">
                                  <Button size="sm" variant="outline" onClick={() => openMenuDialog(item)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </PermissionGate>
                                <PermissionGate permission="restaurants.delete">
                                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteMenuItem(item.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications" className="mt-6">
          <CommunicationsHub user={user} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics restaurants={restaurants} />
        </TabsContent>
      </Tabs>

      {/* Restaurant Dialog */}
      <Dialog open={isRestaurantDialogOpen} onOpenChange={setIsRestaurantDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Restaurant Name</Label>
              <Input value={restaurantForm.name} onChange={e => setRestaurantForm(p => ({ ...p, name: e.target.value }))} placeholder="Restaurant name" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={restaurantForm.city} onChange={e => setRestaurantForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
            </div>
            <div>
              <Label>Price Range</Label>
              <Select value={restaurantForm.price_range} onValueChange={v => setRestaurantForm(p => ({ ...p, price_range: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="budget">Budget ($)</SelectItem>
                  <SelectItem value="moderate">Moderate ($$)</SelectItem>
                  <SelectItem value="upscale">Upscale ($$$)</SelectItem>
                  <SelectItem value="fine_dining">Fine Dining ($$$$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={restaurantForm.address} onChange={e => setRestaurantForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={restaurantForm.phone} onChange={e => setRestaurantForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={restaurantForm.email} onChange={e => setRestaurantForm(p => ({ ...p, email: e.target.value }))} placeholder="restaurant@example.com" />
            </div>
            <div className="col-span-2">
              <Label>Cuisine Types</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CUISINE_TYPES.map(cuisine => (
                  <Badge
                    key={cuisine}
                    variant={restaurantForm.cuisine_type?.includes(cuisine) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setRestaurantForm(p => ({
                        ...p,
                        cuisine_type: p.cuisine_type?.includes(cuisine)
                          ? p.cuisine_type.filter(c => c !== cuisine)
                          : [...(p.cuisine_type || []), cuisine]
                      }));
                    }}
                  >
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Features</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {FEATURES.map(feature => (
                  <Badge
                    key={feature}
                    variant={restaurantForm.features?.includes(feature) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setRestaurantForm(p => ({
                        ...p,
                        features: p.features?.includes(feature)
                          ? p.features.filter(f => f !== feature)
                          : [...(p.features || []), feature]
                      }));
                    }}
                  >
                    {feature.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={restaurantForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setRestaurantForm(p => ({ 
                    ...p, 
                    operator_id: v,
                    operator_name: op?.name || ''
                  }));
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select an operator..." />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  {operators.map(op => (
                    <SelectItem key={op._id || op.id} value={op._id || op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Select the operator managing this restaurant</p>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={restaurantForm.description} onChange={e => setRestaurantForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the restaurant..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestaurantDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRestaurant} className="bg-[#082c59]">{editingRestaurant ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Item Name</Label>
              <Input value={menuForm.name} onChange={e => setMenuForm(p => ({ ...p, name: e.target.value }))} placeholder="Grilled Chicken" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={menuForm.category} onChange={e => setMenuForm(p => ({ ...p, category: e.target.value }))} placeholder="Main Course" />
            </div>
            <div>
              <Label>Price (FCFA)</Label>
              <Input type="number" value={menuForm.price} onChange={e => setMenuForm(p => ({ ...p, price: e.target.value }))} placeholder="5000" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={menuForm.description} onChange={e => setMenuForm(p => ({ ...p, description: e.target.value }))} placeholder="Item description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMenuItem} className="bg-[#082c59]">{editingMenuItem ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Restaurant Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-orange-600" />
              Restaurant Details
            </DialogTitle>
          </DialogHeader>
          {viewingRestaurant && (
            <div className="space-y-4 py-4">
              <div className="bg-orange-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-orange-900">{viewingRestaurant.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm text-orange-700">{viewingRestaurant.rating || 'No rating'}</span>
                  {getPriceRangeBadge(viewingRestaurant.price_range)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingRestaurant.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">{viewingRestaurant.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {viewingRestaurant.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-xs">{viewingRestaurant.email || 'N/A'}</p>
                </div>
              </div>
              {viewingRestaurant.cuisine_type?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Cuisine Types</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingRestaurant.cuisine_type.map(c => (
                      <Badge key={c} variant="outline" className="text-xs capitalize">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingRestaurant.features?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingRestaurant.features.map(f => (
                      <Badge key={f} className="text-xs capitalize bg-green-100 text-green-700">{f.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingRestaurant.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingRestaurant.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              openRestaurantDialog(viewingRestaurant);
              setIsViewDialogOpen(false);
            }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
