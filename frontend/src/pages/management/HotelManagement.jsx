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
  Hotel, Plus, Edit, Trash2, MapPin, Star, Bed, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Info, Calendar, Settings, Key, Wifi, Eye, Building2
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

const HOTEL_AMENITIES = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'parking', 'room_service', 'concierge', 'business_center', 'laundry', 'airport_shuttle'];
const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'penthouse', 'family', 'executive'];

const DEFAULT_HOTEL_FORM = {
  name: '',
  description: '',
  address: '',
  city: '',
  country: 'Cameroon',
  star_rating: 3,
  phone: '',
  email: '',
  amenities: [],
  images: [],
  operator_id: '',
  operator_name: ''
};

const DEFAULT_ROOM_FORM = {
  room_type: 'standard',
  room_name: '',
  description: '',
  base_price: '',
  capacity: 2,
  bed_type: 'double',
  amenities: [],
  beds: 1,
  floor: 1,
  size_sqm: 25,
  total_rooms: 1,
  available_rooms: 1,
  images: []
};

const ROOM_AMENITIES = [
  'wifi', 'tv', 'air_conditioning', 'mini_bar', 'safe', 'balcony',
  'sea_view', 'city_view', 'room_service', 'jacuzzi', 'kitchenette', 'workspace'
];

// Executive Dashboard Component
const ExecutiveDashboard = ({ hotels, rooms }) => {
  const dashboardData = useMemo(() => {
    const totalHotels = hotels.length;
    const totalRooms = rooms.length;
    const avgStarRating = hotels.length > 0
      ? (hotels.reduce((sum, h) => sum + (h.star_rating || 0), 0) / hotels.length).toFixed(1)
      : 0;

    // Hotel by star rating
    const starDistribution = [1, 2, 3, 4, 5].map(star => ({
      name: `${star} Star`,
      value: hotels.filter(h => h.star_rating === star).length,
      color: ['#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E'][star - 1]
    })).filter(d => d.value > 0);

    // Occupancy trend (static mock data for consistent rendering)
    const occupancyTrend = [
      { day: 'Mon', occupancy: 72, revenue: 450000 },
      { day: 'Tue', occupancy: 68, revenue: 380000 },
      { day: 'Wed', occupancy: 75, revenue: 520000 },
      { day: 'Thu', occupancy: 82, revenue: 580000 },
      { day: 'Fri', occupancy: 88, revenue: 650000 },
      { day: 'Sat', occupancy: 95, revenue: 720000 },
      { day: 'Sun', occupancy: 78, revenue: 480000 }
    ];

    // Room type distribution
    const roomTypeData = {};
    rooms.forEach(r => {
      const type = r.room_type || 'standard';
      roomTypeData[type] = (roomTypeData[type] || 0) + 1;
    });

    const roomDistribution = Object.entries(roomTypeData).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4'][i % 6]
    }));

    return {
      totalHotels,
      totalRooms,
      avgStarRating,
      starDistribution,
      occupancyTrend,
      roomDistribution
    };
  }, [hotels, rooms]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Total Hotels</p>
                <p className="text-2xl font-bold text-purple-900">{dashboardData.totalHotels}</p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <Hotel className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Total Rooms</p>
                <p className="text-2xl font-bold text-blue-900">{dashboardData.totalRooms}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <Bed className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-1">Avg. Star Rating</p>
                <p className="text-2xl font-bold text-yellow-900">{dashboardData.avgStarRating} ⭐</p>
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
                <p className="text-sm font-medium text-green-600 mb-1">Avg. Occupancy</p>
                <p className="text-2xl font-bold text-green-900">75%</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">+5% this week</span>
                </div>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <Users className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy & Revenue */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-purple-600" />
              Weekly Occupancy & Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.occupancyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="occupancy" stroke="#8B5CF6" fill="#C4B5FD" name="Occupancy %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Room Type Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-blue-600" />
              Room Types Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {dashboardData.roomDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.roomDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {dashboardData.roomDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No room data available</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {dashboardData.roomDistribution.map((item, i) => (
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
    { id: 1, from: 'Booking Alert', subject: 'New VIP reservation confirmed', time: '30 min ago', unread: true, type: 'booking' },
    { id: 2, from: 'Guest Review', subject: 'New 5-star review from guest', time: '2 hours ago', unread: true, type: 'review' },
    { id: 3, from: 'Maintenance', subject: 'Room 305 maintenance complete', time: '1 day ago', unread: false, type: 'system' }
  ]);

  const [announcementText, setAnnouncementText] = useState('');

  const sendAnnouncement = () => {
    if (announcementText.trim()) {
      toast.success('Announcement sent to staff');
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
                    msg.unread ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {msg.type === 'booking' && <Calendar className="h-4 w-4 text-blue-500" />}
                      {msg.type === 'review' && <Star className="h-4 w-4 text-yellow-500" />}
                      {msg.type === 'system' && <Settings className="h-4 w-4 text-gray-500" />}
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
              <Label className="text-sm font-medium">Send Staff Announcement</Label>
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
                <Key className="mr-2 h-4 w-4" /> Generate Room Access
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Bell className="mr-2 h-4 w-4" /> Create Special Offer
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" /> Contact Housekeeping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Business Analytics Component
const BusinessAnalytics = ({ hotels, rooms }) => {
  const analyticsData = useMemo(() => {
    // City distribution
    const cityDistribution = {};
    hotels.forEach(h => {
      const city = h.city || 'Unknown';
      cityDistribution[city] = (cityDistribution[city] || 0) + 1;
    });

    const cityData = Object.entries(cityDistribution).map(([name, value], i) => ({
      name,
      value,
      color: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'][i % 5]
    }));

    // Monthly trend (static mock data for consistent rendering)
    const monthlyTrend = [
      { month: 'Jan', bookings: 85, revenue: 1200000, occupancy: 68 },
      { month: 'Feb', bookings: 92, revenue: 1450000, occupancy: 72 },
      { month: 'Mar', bookings: 110, revenue: 1800000, occupancy: 78 },
      { month: 'Apr', bookings: 125, revenue: 2100000, occupancy: 82 },
      { month: 'May', bookings: 140, revenue: 2500000, occupancy: 85 },
      { month: 'Jun', bookings: 155, revenue: 2800000, occupancy: 88 }
    ];

    // Price analysis
    const priceByType = rooms.reduce((acc, r) => {
      const type = r.room_type || 'standard';
      if (!acc[type]) acc[type] = { total: 0, count: 0 };
      acc[type].total += r.price_per_night || 0;
      acc[type].count += 1;
      return acc;
    }, {});

    const priceData = Object.entries(priceByType).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      avgPrice: data.count > 0 ? Math.round(data.total / data.count) : 0
    }));

    return { cityData, monthlyTrend, priceData };
  }, [hotels, rooms]);

  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#8B5CF6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#8B5CF6" strokeWidth={2} name="Bookings" />
                <Line yAxisId="left" type="monotone" dataKey="occupancy" stroke="#3B82F6" strokeWidth={2} name="Occupancy %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hotels by City */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Hotels by City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.cityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Price by Room Type */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Avg. Price by Room Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.priceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis tickFormatter={(v) => formatFCFA(v)} />
                  <Tooltip formatter={(v) => formatFCFA(v)} />
                  <Bar dataKey="avgPrice" fill="#10B981" radius={[4, 4, 0, 0]} name="Avg Price/Night" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Main Component
export default function HotelManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState({ id: '', name: '' });

  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('hotel');
  const [editingHotel, setEditingHotel] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [hotelForm, setHotelForm] = useState(DEFAULT_HOTEL_FORM);
  const [roomForm, setRoomForm] = useState(DEFAULT_ROOM_FORM);

  const isOperator = user?.role === 'operator';

  const handleViewItem = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(item.id, type === 'hotel' ? item.name : item.name);
  };

  const loadHotels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/hotels/');
      setHotels(res.data.hotels || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load hotels:', error);
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async (hotelId) => {
    try {
      const res = await api.get(`/rooms/?hotel_id=${hotelId}`);
      setRooms(res.data.rooms || res.data || []);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  useEffect(() => {
    if (selectedHotel) {
      loadRooms(selectedHotel._id || selectedHotel.id);
    }
  }, [selectedHotel, loadRooms]);

  const openHotelDialog = (hotel = null) => {
    if (hotel) {
      setEditingHotel(hotel);
      setHotelForm({
        ...hotel,
        operator_id: hotel.operator_id || '',
        operator_name: hotel.operator_name || ''
      });
    } else {
      setEditingHotel(null);
      setHotelForm({
        ...DEFAULT_HOTEL_FORM,
        operator_id: selectedOperator.id || '',
        operator_name: selectedOperator.name || ''
      });
    }
    setIsHotelDialogOpen(true);
  };

  const handleSaveHotel = async () => {
    try {
      // Find operator name if only ID is set
      const operator = operators.find(op => (op._id || op.id) === hotelForm.operator_id);
      const dataToSave = {
        ...hotelForm,
        operator_name: operator?.name || hotelForm.operator_name || ''
      };
      
      const hotelId = editingHotel?._id || editingHotel?.id;
      if (editingHotel) {
        await api.put(`/hotels/${hotelId}`, dataToSave);
        toast.success('Hotel updated');
      } else {
        await api.post('/hotels/', dataToSave);
        toast.success('Hotel created');
      }
      setIsHotelDialogOpen(false);
      loadHotels();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save hotel');
    }
  };

  const handleDeleteHotel = async (hotel) => {
    const hotelId = hotel._id || hotel.id;
    if (!confirm('Delete this hotel?')) return;
    try {
      await api.delete(`/hotels/${hotelId}`);
      toast.success('Hotel deleted');
      loadHotels();
      if ((selectedHotel?._id || selectedHotel?.id) === hotelId) setSelectedHotel(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const openRoomDialog = (room = null) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm({ 
        ...room, 
        base_price: room.base_price?.toString() || room.price_per_night?.toString() || '',
        room_name: room.room_name || room.room_number || '',
        total_rooms: room.total_rooms || 1,
        available_rooms: room.available_rooms ?? room.total_rooms ?? 1
      });
    } else {
      setEditingRoom(null);
      setRoomForm(DEFAULT_ROOM_FORM);
    }
    setIsRoomDialogOpen(true);
  };

  const handleSaveRoom = async () => {
    try {
      const data = { 
        ...roomForm, 
        base_price: parseFloat(roomForm.base_price) || 0, 
        hotel_id: selectedHotel._id || selectedHotel.id,
        total_rooms: parseInt(roomForm.total_rooms) || 1,
        available_rooms: parseInt(roomForm.available_rooms) || parseInt(roomForm.total_rooms) || 1
      };
      // Remove any fields that shouldn't be sent
      delete data.price_per_night;
      delete data.name;
      delete data.quantity_available;
      delete data.room_number;
      
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom._id || editingRoom.id}`, data);
        toast.success('Room updated');
      } else {
        await api.post('/rooms/', data);
        toast.success('Room added');
      }
      setIsRoomDialogOpen(false);
      loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      toast.success('Room deleted');
      loadRooms(selectedHotel.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Hotel Management Center</h1>
          <p className="text-gray-600">Manage hotels, rooms, analytics, and communications</p>
        </div>
        <Button onClick={loadHotels} variant="outline" disabled={loading}>
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
            <Hotel className="h-4 w-4" /> Management
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
          <ExecutiveDashboard hotels={hotels} rooms={rooms} />
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="mt-6">
          {/* Operator Selector - Like in Travel Management */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Select Operator
              </CardTitle>
              <p className="text-sm text-slate-500">Choose an operator to manage their hotels, or view all hotels</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Select 
                  value={selectedOperator.id || 'all'} 
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setSelectedOperator({ id: '', name: '' });
                    } else {
                      const op = operators.find(o => (o._id || o.id) === value);
                      setSelectedOperator({ id: value, name: op?.name || '' });
                    }
                  }}
                >
                  <SelectTrigger className="w-[300px] bg-white">
                    <SelectValue placeholder="Select operator..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Operators</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op._id || op.id} value={op._id || op.id}>
                        <div className="flex items-center gap-2">
                          <span>{op.name}</span>
                          <span className="text-xs text-slate-400">({op.city})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOperator.id && (
                  <Badge className="bg-blue-100 text-blue-800">
                    Filtering: {selectedOperator.name}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="hotels">
            <TabsList>
              <TabsTrigger value="hotels">Hotels</TabsTrigger>
              <TabsTrigger value="rooms" disabled={!selectedHotel}>
                Rooms {selectedHotel && `(${selectedHotel.name})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hotels">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Hotels {selectedOperator.name && `- ${selectedOperator.name}`}</CardTitle>
                  <PermissionGate permission="hotels.create">
                    <Button onClick={() => openHotelDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Hotel
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : hotels.filter(h => !selectedOperator.id || h.operator_id === selectedOperator.id).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {selectedOperator.id ? `No hotels found for ${selectedOperator.name}.` : 'No hotels found.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {hotels
                        .filter(h => !selectedOperator.id || h.operator_id === selectedOperator.id)
                        .map(hotel => (
                        <Card
                          key={hotel._id || hotel.id}
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            (selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id) ? 'ring-2 ring-[#082c59]' : ''
                          }`}
                          onClick={() => setSelectedHotel(hotel)}
                        >
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-semibold">{hotel.name}</h3>
                                <div className="flex mt-1">{renderStars(hotel.star_rating)}</div>
                              </div>
                              <Badge variant="outline" className="bg-purple-50">{hotel.star_rating} Stars</Badge>
                            </div>
                            {/* Operator Badge */}
                            {hotel.operator_name && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2">
                                <Building2 className="w-3 h-3" />
                                <span>{hotel.operator_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                              <MapPin className="w-4 h-4" /> {hotel.city}
                            </div>
                            {hotel.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {hotel.amenities.slice(0, 4).map(a => (
                                  <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleViewItem(hotel, 'hotel'); }}
                                title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="hotels.edit">
                                <Button size="sm" variant="outline" className="flex-1"
                                  onClick={(e) => { e.stopPropagation(); openHotelDialog(hotel); }}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="hotels.delete">
                                <Button size="sm" variant="outline" className="text-red-600"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteHotel(hotel); }}>
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

            <TabsContent value="rooms">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Rooms - {selectedHotel?.name}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Manage room types, pricing, and availability</p>
                  </div>
                  <PermissionGate permission="hotels.manage_rooms">
                    <Button onClick={() => openRoomDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Room
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {rooms.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Hotel className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="font-medium">No rooms configured</p>
                      <p className="text-sm">Add your first room to start managing availability</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {rooms.map(room => {
                        const totalRooms = room.total_rooms || 1;
                        const availableRooms = room.available_rooms ?? totalRooms;
                        const isLowStock = availableRooms <= Math.ceil(totalRooms * 0.2); // 20% or less
                        const isOutOfStock = availableRooms <= 0;
                        
                        return (
                        <Card key={room.id || room._id} className="overflow-hidden hover:shadow-md transition-shadow">
                          <div className="flex">
                            {/* Room Image */}
                            <div className="w-40 h-32 bg-slate-100 flex-shrink-0 relative">
                              {room.images && room.images[0] ? (
                                <img src={room.images[0]} alt={room.room_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Bed className="w-10 h-10 text-slate-300" />
                                </div>
                              )}
                              {/* Availability Badge on Image */}
                              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold ${
                                isOutOfStock ? 'bg-red-600 text-white' :
                                isLowStock ? 'bg-amber-500 text-white' :
                                'bg-green-600 text-white'
                              }`}>
                                {availableRooms}/{totalRooms}
                              </div>
                            </div>
                            
                            {/* Room Details */}
                            <div className="flex-1 p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-lg">{room.room_name || room.room_number || `Room ${(room.id || room._id)?.slice(-4)}`}</h4>
                                  <p className="text-sm text-slate-500 capitalize">{room.room_type} • {room.bed_type} bed • {room.size_sqm || 25}m²</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-[#082c59]">{formatFCFA(room.base_price || room.price_per_night)}</p>
                                  <p className="text-xs text-slate-500">per night</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                  <Users className="w-4 h-4" />
                                  <span>{room.capacity} guests</span>
                                </div>
                                {/* Room Availability Status */}
                                <Badge className={
                                  isOutOfStock ? 'bg-red-100 text-red-800' :
                                  isLowStock ? 'bg-amber-100 text-amber-800' :
                                  'bg-green-100 text-green-800'
                                }>
                                  {isOutOfStock ? 'Sold Out' : isLowStock ? `Low Stock: ${availableRooms} left` : `${availableRooms} available`}
                                </Badge>
                                {room.amenities && room.amenities.length > 0 && (
                                  <div className="flex gap-1">
                                    {room.amenities.slice(0, 2).map((a, i) => (
                                      <Badge key={i} variant="outline" className="text-xs capitalize">
                                        {a.replace(/_/g, ' ')}
                                      </Badge>
                                    ))}
                                    {room.amenities.length > 2 && (
                                      <Badge variant="outline" className="text-xs">+{room.amenities.length - 2}</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {room.description && (
                                <p className="text-sm text-slate-500 mt-2 line-clamp-1">{room.description}</p>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex flex-col justify-center gap-2 p-4 border-l">
                              <PermissionGate permission="hotels.manage_rooms">
                                <Button size="sm" variant="outline" onClick={() => openRoomDialog(room)}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteRoom(room.id || room._id)}>
                                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                                </Button>
                              </PermissionGate>
                            </div>
                          </div>
                        </Card>
                      );})}
                    </div>
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
          <BusinessAnalytics hotels={hotels} rooms={rooms} />
        </TabsContent>
      </Tabs>

      {/* Hotel Dialog */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHotel ? 'Edit Hotel' : 'Add Hotel'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Hotel Name</Label>
              <Input value={hotelForm.name} onChange={e => setHotelForm(p => ({ ...p, name: e.target.value }))} placeholder="Hotel name" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={hotelForm.city} onChange={e => setHotelForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
            </div>
            <div>
              <Label>Star Rating</Label>
              <Select value={String(hotelForm.star_rating)} onValueChange={v => setHotelForm(p => ({ ...p, star_rating: parseInt(v) }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {[1, 2, 3, 4, 5].map(n => (<SelectItem key={n} value={String(n)}>{n} Star{n > 1 && 's'}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={hotelForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setHotelForm(p => ({ 
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
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        {op.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Select the operator who will manage this hotel</p>
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={hotelForm.address} onChange={e => setHotelForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={hotelForm.phone} onChange={e => setHotelForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={hotelForm.email} onChange={e => setHotelForm(p => ({ ...p, email: e.target.value }))} placeholder="hotel@example.com" />
            </div>
            <div className="col-span-2">
              <Label>Amenities</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {HOTEL_AMENITIES.map(amenity => (
                  <Badge
                    key={amenity}
                    variant={hotelForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setHotelForm(p => ({
                        ...p,
                        amenities: p.amenities?.includes(amenity)
                          ? p.amenities.filter(a => a !== amenity)
                          : [...(p.amenities || []), amenity]
                      }));
                    }}
                  >
                    {amenity.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={hotelForm.description} onChange={e => setHotelForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the hotel..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHotelDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveHotel} className="bg-[#082c59]">{editingHotel ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog - Enhanced */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
            <p className="text-sm text-slate-500">Configure room details for {selectedHotel?.name}</p>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Room Name</Label>
                <Input value={roomForm.room_name} onChange={e => setRoomForm(p => ({ ...p, room_name: e.target.value }))} placeholder="Deluxe Suite 101, Ocean View Room" />
              </div>
              <div>
                <Label>Room Type</Label>
                <Select value={roomForm.room_type} onValueChange={v => setRoomForm(p => ({ ...p, room_type: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {ROOM_TYPES.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing & Capacity Row */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Price/Night (FCFA)</Label>
                <Input type="number" value={roomForm.base_price} onChange={e => setRoomForm(p => ({ ...p, base_price: e.target.value }))} placeholder="25000" />
              </div>
              <div>
                <Label>Capacity (Guests)</Label>
                <Input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Total Rooms</Label>
                <Input type="number" min="1" value={roomForm.total_rooms} onChange={e => {
                  const total = parseInt(e.target.value) || 1;
                  setRoomForm(p => ({ 
                    ...p, 
                    total_rooms: total,
                    // Auto-adjust available if it exceeds total
                    available_rooms: Math.min(p.available_rooms || total, total)
                  }));
                }} placeholder="5" />
              </div>
              <div>
                <Label>Available Rooms</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max={roomForm.total_rooms || 1}
                  value={roomForm.available_rooms} 
                  onChange={e => setRoomForm(p => ({ ...p, available_rooms: Math.min(parseInt(e.target.value) || 0, p.total_rooms || 1) }))} 
                  placeholder="5" 
                />
                {roomForm.available_rooms <= Math.ceil((roomForm.total_rooms || 1) * 0.2) && roomForm.available_rooms > 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Low stock warning</p>
                )}
                {roomForm.available_rooms <= 0 && (
                  <p className="text-xs text-red-600 mt-1">❌ No rooms available</p>
                )}
              </div>
            </div>

            {/* Floor Row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Floor</Label>
                <Input type="number" value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Beds</Label>
                <Input type="number" min="1" value={roomForm.beds} onChange={e => setRoomForm(p => ({ ...p, beds: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Size (m²)</Label>
                <Input type="number" value={roomForm.size_sqm} onChange={e => setRoomForm(p => ({ ...p, size_sqm: parseFloat(e.target.value) || 25 }))} />
              </div>
            </div>

            {/* Room Features Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bed Type</Label>
                <Select value={roomForm.bed_type} onValueChange={v => setRoomForm(p => ({ ...p, bed_type: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="queen">Queen</SelectItem>
                    <SelectItem value="king">King</SelectItem>
                    <SelectItem value="twin">Twin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room Size (m²)</Label>
                <Input type="number" value={roomForm.size_sqm} onChange={e => setRoomForm(p => ({ ...p, size_sqm: parseInt(e.target.value) || 20 }))} placeholder="25" />
              </div>
            </div>

            {/* Room Amenities */}
            <div>
              <Label className="mb-2 block">Room Amenities</Label>
              <div className="flex flex-wrap gap-2">
                {ROOM_AMENITIES.map(amenity => (
                  <Badge
                    key={amenity}
                    variant={roomForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                    className={`cursor-pointer capitalize ${roomForm.amenities?.includes(amenity) ? 'bg-[#082c59]' : ''}`}
                    onClick={() => {
                      setRoomForm(p => ({
                        ...p,
                        amenities: p.amenities?.includes(amenity)
                          ? p.amenities.filter(a => a !== amenity)
                          : [...(p.amenities || []), amenity]
                      }));
                    }}
                  >
                    {amenity.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Room Images */}
            <div>
              <Label className="mb-2 block">Room Images (URLs)</Label>
              <div className="space-y-2">
                {(roomForm.images || []).map((img, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input 
                      value={img} 
                      onChange={e => {
                        const newImages = [...(roomForm.images || [])];
                        newImages[idx] = e.target.value;
                        setRoomForm(p => ({ ...p, images: newImages }));
                      }}
                      placeholder="https://example.com/room-image.jpg"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="text-red-600 shrink-0"
                      onClick={() => {
                        setRoomForm(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setRoomForm(p => ({ ...p, images: [...(p.images || []), ''] }))}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Image URL
                </Button>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea 
                value={roomForm.description} 
                onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))} 
                placeholder="Describe the room features, views, and special amenities..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} className="bg-[#082c59]">{editingRoom ? 'Update Room' : 'Add Room'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-purple-600" />
              {viewingType === 'hotel' ? 'Hotel Details' : 'Room Details'}
            </DialogTitle>
          </DialogHeader>
          {viewingItem && viewingType === 'hotel' && (
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-purple-900">{viewingItem.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {[...Array(viewingItem.star_rating || 3)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingItem.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">{viewingItem.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium">{viewingItem.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-xs">{viewingItem.email || 'N/A'}</p>
                </div>
              </div>
              {viewingItem.amenities?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingItem.amenities.map(a => (
                      <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingItem.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingItem.description}</p>
                </div>
              )}
            </div>
          )}
          {viewingItem && viewingType === 'room' && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-blue-900">{viewingItem.room_name || viewingItem.room_number}</h3>
                <Badge className="mt-1 capitalize">{viewingItem.room_type}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Price/Night</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingItem.base_price || viewingItem.price_per_night)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Capacity</p>
                  <p className="font-medium">{viewingItem.capacity} guests</p>
                </div>
                <div>
                  <p className="text-slate-500">Bed Type</p>
                  <p className="font-medium capitalize">{viewingItem.bed_type}</p>
                </div>
                <div>
                  <p className="text-slate-500">Room Inventory</p>
                  <p className="font-medium">
                    <span className={
                      (viewingItem.available_rooms || 0) <= 0 ? 'text-red-600' :
                      (viewingItem.available_rooms || 0) <= Math.ceil((viewingItem.total_rooms || 1) * 0.2) ? 'text-amber-600' :
                      'text-green-600'
                    }>
                      {viewingItem.available_rooms ?? viewingItem.total_rooms ?? 1}
                    </span>
                    <span className="text-slate-400"> / {viewingItem.total_rooms || 1} available</span>
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (viewingType === 'hotel') openHotelDialog(viewingItem);
              else openRoomDialog(viewingItem);
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
