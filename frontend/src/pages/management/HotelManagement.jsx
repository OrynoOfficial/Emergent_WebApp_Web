import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Hotel, Plus, LayoutDashboard, MessageSquare, RefreshCw, Bed,
  MapPin, ChevronLeft, Search, SlidersHorizontal, Grid3X3, List, X, Save, Building2
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';

import { useRealDashboardData } from '@/hooks/useRealDashboardData';

// Shared management components
import { Pagination, EmptyState, ConfirmDialog } from '@/components/management/shared';

// Hotel-specific components
import { HotelCard, RoomCard, HotelForm, RoomForm } from '@/components/management/hotel';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';

const ITEMS_PER_PAGE = 9;
const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Kribi', 'Limbe', 'Buea', 'Bamenda'];
const HOTEL_AMENITIES = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'parking', 'room_service', 'concierge', 'business_center', 'laundry', 'airport_shuttle'];
const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'penthouse', 'family', 'executive'];

const DEFAULT_HOTEL_FORM = {
  name: '', description: '', address: '', city: '', country: 'Cameroon',
  star_rating: 3, phone: '', email: '', amenities: [], images: [],
  operator_id: '', operator_name: ''
};

const DEFAULT_ROOM_FORM = {
  room_type: 'standard', room_name: '', description: '', base_price: '',
  capacity: 2, bed_type: 'double', amenities: [], beds: 1, floor: 1,
  size_sqm: 25, total_rooms: 1, available_rooms: 1, images: []
};

// Dashboard data now fetched from API via useRealDashboardData hook

export default function HotelManagement() {
  const { user } = useAuth();
  
  // Data state
  const [hotels, setHotels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('grid');
  const [roomViewMode, setRoomViewMode] = useState('list');
  const [hotelSearch, setHotelSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [showHotelFilters, setShowHotelFilters] = useState(false);
  const [showRoomFilters, setShowRoomFilters] = useState(false);
  const [hotelPage, setHotelPage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);
  
  // Filter state
  const [hotelFilters, setHotelFilters] = useState({ city: '', starRating: '', amenity: '' });
  const [roomFilters, setRoomFilters] = useState({ roomType: '', priceRange: '', availability: '' });
  const [selectedOperator, setSelectedOperator] = useState({ id: '', name: '' });
  
  // Selection state
  const [selectedHotel, setSelectedHotel] = useState(null);
  
  // Dialog state
  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Form state
  const [hotelForm, setHotelForm] = useState(DEFAULT_HOTEL_FORM);
  const [roomForm, setRoomForm] = useState(DEFAULT_ROOM_FORM);
  const [editingHotel, setEditingHotel] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [saving, setSaving] = useState(false);

  const dashboardData = useRealDashboardData('hotels');

  // Filtered hotels
  const filteredHotels = useMemo(() => {
    let result = hotels;
    if (selectedOperator.id) result = result.filter(h => h.operator_id === selectedOperator.id);
    if (hotelSearch) {
      const s = hotelSearch.toLowerCase();
      result = result.filter(h => h.name?.toLowerCase().includes(s) || h.city?.toLowerCase().includes(s) || h.operator_name?.toLowerCase().includes(s));
    }
    if (hotelFilters.city) result = result.filter(h => h.city === hotelFilters.city);
    if (hotelFilters.starRating) result = result.filter(h => h.star_rating === parseInt(hotelFilters.starRating));
    if (hotelFilters.amenity) result = result.filter(h => h.amenities?.includes(hotelFilters.amenity));
    return result;
  }, [hotels, selectedOperator.id, hotelSearch, hotelFilters]);

  const paginatedHotels = useMemo(() => 
    filteredHotels.slice((hotelPage - 1) * ITEMS_PER_PAGE, hotelPage * ITEMS_PER_PAGE), 
    [filteredHotels, hotelPage]
  );
  const totalHotelPages = Math.ceil(filteredHotels.length / ITEMS_PER_PAGE);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (roomSearch) {
      const s = roomSearch.toLowerCase();
      result = result.filter(r => r.room_name?.toLowerCase().includes(s) || r.room_type?.toLowerCase().includes(s));
    }
    if (roomFilters.roomType) result = result.filter(r => r.room_type === roomFilters.roomType);
    if (roomFilters.priceRange) {
      const [min, max] = roomFilters.priceRange.split('-').map(Number);
      result = result.filter(r => { const p = r.base_price || r.price_per_night || 0; return p >= min && (max ? p <= max : true); });
    }
    if (roomFilters.availability === 'available') result = result.filter(r => (r.available_rooms || 0) > 0);
    else if (roomFilters.availability === 'low') result = result.filter(r => { const a = r.available_rooms || 0, t = r.total_rooms || 1; return a > 0 && a <= Math.ceil(t * 0.2); });
    else if (roomFilters.availability === 'soldout') result = result.filter(r => (r.available_rooms || 0) <= 0);
    return result;
  }, [rooms, roomSearch, roomFilters]);

  const paginatedRooms = useMemo(() => 
    filteredRooms.slice((roomPage - 1) * ITEMS_PER_PAGE, roomPage * ITEMS_PER_PAGE), 
    [filteredRooms, roomPage]
  );
  const totalRoomPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);

  // Load data
  const loadHotels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hotels/');
      setHotels(res.data.hotels || res.data || []);
      try { 
        const opRes = await api.get('/operators/'); 
        setOperators(opRes.data.operators || opRes.data || []); 
      } catch { /* ignore operators fetch error */ }
    } catch { setHotels([]); }
    finally { setLoading(false); }
  }, []);

  const loadRooms = useCallback(async (hotelId) => {
    try { 
      const res = await api.get(`/rooms/?hotel_id=${hotelId}`); 
      setRooms(res.data.rooms || res.data || []); 
    } catch { setRooms([]); }
  }, []);

  useEffect(() => { loadHotels(); }, [loadHotels]);
  useEffect(() => { 
    if (selectedHotel) { 
      loadRooms(selectedHotel._id || selectedHotel.id); 
      setRoomPage(1); 
    } 
  }, [selectedHotel, loadRooms]);
  useEffect(() => { setHotelPage(1); }, [hotelSearch, hotelFilters, selectedOperator.id]);
  useEffect(() => { setRoomPage(1); }, [roomSearch, roomFilters]);

  // Hotel CRUD
  const openHotelDialog = (hotel = null) => {
    if (hotel) { 
      setEditingHotel(hotel); 
      setHotelForm({ ...hotel, images: hotel.images || [], operator_id: hotel.operator_id || '', operator_name: hotel.operator_name || '' }); 
    } else { 
      setEditingHotel(null); 
      setHotelForm({ ...DEFAULT_HOTEL_FORM, operator_id: selectedOperator.id || '', operator_name: selectedOperator.name || '' }); 
    }
    setIsHotelDialogOpen(true);
  };

  const handleSaveHotel = async () => {
    if ((hotelForm.images || []).length < 5) { toast.error('Please upload at least 5 images'); return; }
    try {
      setSaving(true);
      const operator = operators.find(op => (op._id || op.id) === hotelForm.operator_id);
      const data = { ...hotelForm, operator_name: operator?.name || hotelForm.operator_name || '' };
      if (editingHotel) { 
        await api.put(`/hotels/${editingHotel._id || editingHotel.id}`, data); 
        toast.success('Hotel updated'); 
      } else { 
        await api.post('/hotels/', data); 
        toast.success('Hotel created'); 
      }
      setIsHotelDialogOpen(false); 
      loadHotels();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save hotel'); }
    finally { setSaving(false); }
  };

  const confirmDeleteHotel = (hotel) => {
    setDeleteTarget({ type: 'hotel', item: hotel });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteHotel = async () => {
    if (!deleteTarget?.item) return;
    try {
      setSaving(true);
      await api.delete(`/hotels/${deleteTarget.item._id || deleteTarget.item.id}`);
      toast.success('Hotel deleted');
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      if ((selectedHotel?._id || selectedHotel?.id) === (deleteTarget.item._id || deleteTarget.item.id)) {
        setSelectedHotel(null);
      }
      loadHotels();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
    finally { setSaving(false); }
  };

  // Room CRUD
  const openRoomDialog = (room = null) => {
    if (room) { 
      setEditingRoom(room); 
      setRoomForm({ 
        ...room, 
        images: room.images || [], 
        base_price: room.base_price?.toString() || room.price_per_night?.toString() || '', 
        room_name: room.room_name || '', 
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
      setSaving(true);
      const data = { 
        ...roomForm, 
        base_price: parseFloat(roomForm.base_price) || 0, 
        hotel_id: selectedHotel._id || selectedHotel.id, 
        total_rooms: parseInt(roomForm.total_rooms) || 1, 
        available_rooms: parseInt(roomForm.available_rooms) || 1 
      };
      delete data.price_per_night; delete data.name; delete data.room_number;
      if (editingRoom) { 
        await api.put(`/rooms/${editingRoom._id || editingRoom.id}`, data); 
        toast.success('Room updated'); 
      } else { 
        await api.post('/rooms/', data); 
        toast.success('Room added'); 
      }
      setIsRoomDialogOpen(false); 
      loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save room'); }
    finally { setSaving(false); }
  };

  const confirmDeleteRoom = (roomId) => {
    setDeleteTarget({ type: 'room', id: roomId });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteRoom = async () => {
    if (!deleteTarget?.id) return;
    try {
      setSaving(true);
      await api.delete(`/rooms/${deleteTarget.id}`);
      toast.success('Room deleted');
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
    finally { setSaving(false); }
  };

  const clearHotelFilters = () => { 
    setHotelFilters({ city: '', starRating: '', amenity: '' }); 
    setHotelSearch(''); 
    setSelectedOperator({ id: '', name: '' }); 
  };
  
  const clearRoomFilters = () => { 
    setRoomFilters({ roomType: '', priceRange: '', availability: '' }); 
    setRoomSearch(''); 
  };

  const activeHotelFiltersCount = Object.values(hotelFilters).filter(Boolean).length + (hotelSearch ? 1 : 0) + (selectedOperator.id ? 1 : 0);
  const activeRoomFiltersCount = Object.values(roomFilters).filter(Boolean).length + (roomSearch ? 1 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#082c59] to-[#0a3a75] rounded-xl flex items-center justify-center shadow-lg">
                <Hotel className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Hotel Management</h1>
                <p className="text-slate-500">Manage hotels, rooms, and communications</p>
              </div>
            </div>
            <Button variant="outline" onClick={loadHotels} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="hotels">
              <Hotel className="h-4 w-4 mr-2" /> Hotels
            </TabsTrigger>
            <TabsTrigger value="rooms" disabled={!selectedHotel}>
              <Bed className="h-4 w-4 mr-2" /> Rooms
            </TabsTrigger>
            <TabsTrigger value="communications">
              <MessageSquare className="h-4 w-4 mr-2" /> Communications
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <ServiceExecutiveDashboard
              serviceType="Hotels"
              serviceIcon={<Hotel className="h-8 w-8" />}
              primaryColor="blue"
              stats={dashboardData.stats}
              bookingsByStatus={dashboardData.bookingsByStatus}
              dailyTrend={dashboardData.dailyTrend}
              distribution={dashboardData.distribution}
              itemLabel="Hotels"
              secondaryLabel="Rooms"
              secondaryCount={dashboardData.secondaryCount}
            />
          </TabsContent>

          {/* Hotels Tab */}
          <TabsContent value="hotels" className="space-y-4">
            {/* Search and Filters */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search hotels..." 
                      value={hotelSearch} 
                      onChange={(e) => setHotelSearch(e.target.value)} 
                      className="pl-10 bg-white" 
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant={showHotelFilters ? 'default' : 'outline'} 
                      onClick={() => setShowHotelFilters(!showHotelFilters)} 
                      className={`gap-2 ${showHotelFilters ? 'bg-[#082c59]' : ''}`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {activeHotelFiltersCount > 0 && (
                        <Badge className="ml-1 bg-white text-[#082c59] h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeHotelFiltersCount}
                        </Badge>
                      )}
                    </Button>
                    <div className="flex border rounded-lg overflow-hidden">
                      <Button 
                        variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('grid')} 
                        className={`rounded-none ${viewMode === 'grid' ? 'bg-[#082c59]' : ''}`}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={viewMode === 'list' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('list')} 
                        className={`rounded-none ${viewMode === 'list' ? 'bg-[#082c59]' : ''}`}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    <PermissionGate permission="hotels.create">
                      <Button onClick={() => openHotelDialog()} className="bg-[#082c59] gap-2">
                        <Plus className="w-4 h-4" /> Add Hotel
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
                
                {showHotelFilters && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">City</Label>
                        <Select value={hotelFilters.city || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, city: v === "all" ? "" : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All cities" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All cities</SelectItem>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Star Rating</Label>
                        <Select value={hotelFilters.starRating || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, starRating: v === "all" ? "" : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All ratings" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All ratings</SelectItem>
                            {[5, 4, 3, 2, 1].map(n => <SelectItem key={n} value={String(n)}>{n} Stars</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Amenity</Label>
                        <Select value={hotelFilters.amenity || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, amenity: v === "all" ? "" : v }))}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Any amenity" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">Any</SelectItem>
                            {HOTEL_AMENITIES.map(a => <SelectItem key={a} value={a} className="capitalize">{a.replace('_', ' ')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Operator</Label>
                        <Select 
                          value={selectedOperator.id || 'all'} 
                          onValueChange={(v) => { 
                            if (v === 'all') setSelectedOperator({ id: '', name: '' }); 
                            else { const op = operators.find(o => (o._id || o.id) === v); setSelectedOperator({ id: v, name: op?.name || '' }); } 
                          }}
                        >
                          <SelectTrigger className="bg-white"><SelectValue placeholder="All operators" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">All operators</SelectItem>
                            {operators.map(op => <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {activeHotelFiltersCount > 0 && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearHotelFilters} className="text-slate-500">
                          <X className="h-4 w-4 mr-1" /> Clear all
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-sm text-slate-500">Showing {paginatedHotels.length} of {filteredHotels.length} hotels</p>

            {/* Hotels List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-[#082c59]" />
              </div>
            ) : filteredHotels.length === 0 ? (
              <EmptyState
                icon={Hotel}
                title="No hotels found"
                description={hotelSearch ? "Try adjusting your search" : "Create your first hotel to get started"}
                actionLabel="Add Hotel"
                onAction={() => openHotelDialog()}
              />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedHotels.map(hotel => (
                  <HotelCard
                    key={hotel._id || hotel.id}
                    hotel={hotel}
                    viewMode="grid"
                    isSelected={(selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id)}
                    onEdit={() => openHotelDialog(hotel)}
                    onDelete={() => confirmDeleteHotel(hotel)}
                    onViewRooms={() => { setSelectedHotel(hotel); setActiveTab('rooms'); }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedHotels.map(hotel => (
                  <HotelCard
                    key={hotel._id || hotel.id}
                    hotel={hotel}
                    viewMode="list"
                    isSelected={(selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id)}
                    onEdit={() => openHotelDialog(hotel)}
                    onDelete={() => confirmDeleteHotel(hotel)}
                    onViewRooms={() => { setSelectedHotel(hotel); setActiveTab('rooms'); }}
                  />
                ))}
              </div>
            )}

            {totalHotelPages > 1 && (
              <Pagination
                currentPage={hotelPage}
                totalPages={totalHotelPages}
                totalItems={filteredHotels.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setHotelPage}
              />
            )}
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-4">
            {!selectedHotel ? (
              <EmptyState
                icon={Hotel}
                title="No hotel selected"
                description="Select a hotel to view its rooms"
                actionLabel="Go to Hotels"
                onAction={() => setActiveTab('hotels')}
              />
            ) : (
              <>
                {/* Selected Hotel Header */}
                <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a3a75] text-white">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/10 rounded-lg overflow-hidden">
                        {selectedHotel.images?.[0] ? (
                          <img 
                            src={selectedHotel.images[0].startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${selectedHotel.images[0]}` : selectedHotel.images[0]} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <Hotel className="h-8 w-8 text-white/50 m-4" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selectedHotel.name}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                          <MapPin className="w-4 h-4" /> {selectedHotel.city}
                        </div>
                        {selectedHotel.operator_name && (
                          <div className="flex items-center gap-2 mt-1.5 bg-white/10 px-2 py-1 rounded-md w-fit">
                            <Building2 className="w-3.5 h-3.5 text-white/70" />
                            <span className="text-white/90 text-xs font-medium">{selectedHotel.operator_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20" 
                      onClick={() => setActiveTab('hotels')}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                  </CardContent>
                </Card>

                {/* Room Search and Filters */}
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="Search rooms..." 
                          value={roomSearch} 
                          onChange={(e) => setRoomSearch(e.target.value)} 
                          className="pl-10 bg-white" 
                        />
                      </div>
                      <div className="flex gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex border rounded-lg overflow-hidden">
                          <Button 
                            variant={roomViewMode === 'grid' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setRoomViewMode('grid')} 
                            className={`rounded-none ${roomViewMode === 'grid' ? 'bg-[#082c59]' : ''}`}
                          >
                            <Grid3X3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant={roomViewMode === 'list' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setRoomViewMode('list')} 
                            className={`rounded-none ${roomViewMode === 'list' ? 'bg-[#082c59]' : ''}`}
                          >
                            <List className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button 
                          variant={showRoomFilters ? 'default' : 'outline'} 
                          onClick={() => setShowRoomFilters(!showRoomFilters)} 
                          className={`gap-2 ${showRoomFilters ? 'bg-[#082c59]' : ''}`}
                        >
                          <SlidersHorizontal className="h-4 w-4" />Filters
                        </Button>
                        <PermissionGate permission="hotels.manage_rooms">
                          <Button onClick={() => openRoomDialog()} className="bg-[#082c59] gap-2">
                            <Plus className="w-4 h-4" /> Add Room
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                    {showRoomFilters && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500 mb-1.5 block">Room Type</Label>
                          <Select value={roomFilters.roomType || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, roomType: v === "all" ? "" : v }))}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="All types" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="all">All types</SelectItem>
                              {ROOM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500 mb-1.5 block">Price Range</Label>
                          <Select value={roomFilters.priceRange || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, priceRange: v === "all" ? "" : v }))}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Any price" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="all">Any</SelectItem>
                              <SelectItem value="0-25000">Under 25k</SelectItem>
                              <SelectItem value="25000-50000">25k-50k</SelectItem>
                              <SelectItem value="50000-100000">50k-100k</SelectItem>
                              <SelectItem value="100000-999999999">Above 100k</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500 mb-1.5 block">Availability</Label>
                          <Select value={roomFilters.availability || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, availability: v === "all" ? "" : v }))}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="available">Available</SelectItem>
                              <SelectItem value="low">Low Stock</SelectItem>
                              <SelectItem value="soldout">Sold Out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <p className="text-sm text-slate-500">Showing {paginatedRooms.length} of {filteredRooms.length} rooms</p>

                {/* Rooms List */}
                {filteredRooms.length === 0 ? (
                  <EmptyState
                    icon={Bed}
                    title="No rooms found"
                    description="Add your first room to this hotel"
                    actionLabel="Add Room"
                    onAction={() => openRoomDialog()}
                  />
                ) : roomViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedRooms.map(room => (
                      <RoomCard
                        key={room.id || room._id}
                        room={room}
                        onEdit={openRoomDialog}
                        onDelete={confirmDeleteRoom}
                        viewMode="grid"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paginatedRooms.map(room => (
                      <RoomCard
                        key={room.id || room._id}
                        room={room}
                        onEdit={openRoomDialog}
                        onDelete={confirmDeleteRoom}
                        viewMode="list"
                      />
                    ))}
                  </div>
                )}

                {totalRoomPages > 1 && (
                  <Pagination
                    currentPage={roomPage}
                    totalPages={totalRoomPages}
                    totalItems={filteredRooms.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setRoomPage}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications">
            <ServiceCommunicationsHub 
              serviceType="Hotels" 
              serviceTag="hotels"
              serviceIcon={<Hotel className="h-5 w-5" />}
              primaryColor="blue"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Hotel Dialog */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Hotel className="h-5 w-5 text-[#082c59]" />
              {editingHotel ? 'Edit Hotel' : 'Add New Hotel'}
            </DialogTitle>
          </DialogHeader>
          <HotelForm 
            form={hotelForm} 
            onChange={setHotelForm} 
            operators={operators}
            isEditing={!!editingHotel}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsHotelDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveHotel} 
              className="bg-[#082c59]" 
              disabled={saving || (hotelForm.images || []).length < 5}
            >
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingHotel ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Bed className="h-5 w-5 text-[#082c59]" />
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </DialogTitle>
          </DialogHeader>
          <RoomForm 
            form={roomForm} 
            onChange={setRoomForm}
            isEditing={!!editingRoom}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} className="bg-[#082c59]" disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingRoom ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete ${deleteTarget?.type === 'hotel' ? 'Hotel' : 'Room'}?`}
        description="This action cannot be undone."
        warningMessage={deleteTarget?.type === 'hotel' ? 'All rooms associated with this hotel will also be deleted.' : undefined}
        onConfirm={deleteTarget?.type === 'hotel' ? handleDeleteHotel : handleDeleteRoom}
        isSubmitting={saving}
      />
    </div>
  );
}
