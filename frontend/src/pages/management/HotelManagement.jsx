import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Hotel, Plus, Edit, Trash2, MapPin, Star, Bed, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Info, Calendar, Settings, Key, Wifi, Eye, Building2,
  Search, Filter, ChevronLeft, ChevronRight, Upload, X, Image as ImageIcon,
  SlidersHorizontal, Grid3X3, List, ArrowUpDown, Check
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
const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Kribi', 'Limbe', 'Buea', 'Bamenda'];

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

const ITEMS_PER_PAGE = 9;

// Image Upload Component
const ImageUploader = ({ images, onImagesChange, maxImages = 10, minImages = 5 }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    const newImages = [...images];

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'hotels');

        const response = await api.post('/uploads/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          newImages.push(response.data.file_url);
        }
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    onImagesChange(newImages);
    setUploading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Hotel Images ({images.length}/{maxImages})
        </Label>
        <span className="text-xs text-slate-500">
          Min: {minImages}, Max: {maxImages}
        </span>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-slate-50 p-2">
          <div className="flex gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group flex-shrink-0">
                <img
                  src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img}
                  alt={`Hotel ${idx + 1}`}
                  className="h-20 w-28 object-cover rounded-lg border-2 border-white shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <X className="h-3 w-3" />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-[#082c59] text-white text-[10px] px-1.5 py-0.5 rounded">
                    Main
                  </span>
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragActive ? 'border-[#082c59] bg-blue-50' : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-[#082c59]" />
              <span className="text-sm text-slate-600">Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">
                Drop images here or <span className="text-[#082c59] font-medium">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB each</p>
            </>
          )}
        </div>
      )}

      {images.length < minImages && images.length > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Add at least {minImages - images.length} more image(s)
        </p>
      )}
    </div>
  );
};

// Room Image Uploader Component
const RoomImageUploader = ({ images, onImagesChange, maxImages = 5 }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    const newImages = [...images];

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) continue;

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'rooms');

        const response = await api.post('/uploads/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          newImages.push(response.data.file_url);
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    onImagesChange(newImages);
    setUploading(false);
  };

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Room Images ({images.length}/{maxImages})</Label>
      
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img}
                alt={`Room ${idx + 1}`}
                className="h-16 w-24 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < maxImages && (
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Images
          </Button>
        </div>
      )}
    </div>
  );
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {startPage > 1 && (
        <>
          <Button
            variant={currentPage === 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(1)}
            className="h-8 w-8 p-0"
          >
            1
          </Button>
          {startPage > 2 && <span className="px-2 text-slate-400">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <Button
          key={page}
          variant={currentPage === page ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPageChange(page)}
          className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-[#082c59]' : ''}`}
        >
          {page}
        </Button>
      ))}
      
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2 text-slate-400">...</span>}
          <Button
            variant={currentPage === totalPages ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(totalPages)}
            className="h-8 w-8 p-0"
          >
            {totalPages}
          </Button>
        </>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Executive Dashboard Component
const ExecutiveDashboard = ({ hotels, rooms }) => {
  const dashboardData = useMemo(() => {
    const totalHotels = hotels.length;
    const totalRooms = rooms.length;
    const avgStarRating = hotels.length > 0
      ? (hotels.reduce((sum, h) => sum + (h.star_rating || 0), 0) / hotels.length).toFixed(1)
      : 0;

    const starDistribution = [1, 2, 3, 4, 5].map(star => ({
      name: `${star} Star`,
      value: hotels.filter(h => h.star_rating === star).length,
      color: ['#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E'][star - 1]
    })).filter(d => d.value > 0);

    const occupancyTrend = [
      { day: 'Mon', occupancy: 72, revenue: 450000 },
      { day: 'Tue', occupancy: 68, revenue: 380000 },
      { day: 'Wed', occupancy: 75, revenue: 520000 },
      { day: 'Thu', occupancy: 82, revenue: 580000 },
      { day: 'Fri', occupancy: 88, revenue: 650000 },
      { day: 'Sat', occupancy: 95, revenue: 720000 },
      { day: 'Sun', occupancy: 78, revenue: 480000 }
    ];

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

    return { totalHotels, totalRooms, avgStarRating, starDistribution, occupancyTrend, roomDistribution };
  }, [hotels, rooms]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Total Hotels</p>
                <p className="text-3xl font-bold text-purple-900">{dashboardData.totalHotels}</p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <Hotel className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Total Rooms</p>
                <p className="text-3xl font-bold text-blue-900">{dashboardData.totalRooms}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <Bed className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-1">Avg. Rating</p>
                <p className="text-3xl font-bold text-yellow-900">{dashboardData.avgStarRating} ⭐</p>
              </div>
              <div className="bg-yellow-200 rounded-full p-3">
                <Star className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Avg. Occupancy</p>
                <p className="text-3xl font-bold text-green-900">75%</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-purple-600" />
              Weekly Occupancy Trend
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

  // Search and Filter States
  const [hotelSearch, setHotelSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [hotelFilters, setHotelFilters] = useState({
    city: '',
    starRating: '',
    amenity: ''
  });
  const [roomFilters, setRoomFilters] = useState({
    roomType: '',
    priceRange: '',
    availability: ''
  });
  const [showHotelFilters, setShowHotelFilters] = useState(false);
  const [showRoomFilters, setShowRoomFilters] = useState(false);

  // Pagination States
  const [hotelPage, setHotelPage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);

  // View mode
  const [viewMode, setViewMode] = useState('grid');

  // Dialog States
  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('hotel');
  const [editingHotel, setEditingHotel] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [hotelForm, setHotelForm] = useState(DEFAULT_HOTEL_FORM);
  const [roomForm, setRoomForm] = useState(DEFAULT_ROOM_FORM);

  // Filter and search hotels
  const filteredHotels = useMemo(() => {
    let result = hotels;

    // Apply operator filter
    if (selectedOperator.id) {
      result = result.filter(h => h.operator_id === selectedOperator.id);
    }

    // Apply search
    if (hotelSearch) {
      const search = hotelSearch.toLowerCase();
      result = result.filter(h =>
        h.name?.toLowerCase().includes(search) ||
        h.city?.toLowerCase().includes(search) ||
        h.address?.toLowerCase().includes(search) ||
        h.operator_name?.toLowerCase().includes(search)
      );
    }

    // Apply filters
    if (hotelFilters.city) {
      result = result.filter(h => h.city === hotelFilters.city);
    }
    if (hotelFilters.starRating) {
      result = result.filter(h => h.star_rating === parseInt(hotelFilters.starRating));
    }
    if (hotelFilters.amenity) {
      result = result.filter(h => h.amenities?.includes(hotelFilters.amenity));
    }

    return result;
  }, [hotels, selectedOperator.id, hotelSearch, hotelFilters]);

  // Paginate hotels
  const paginatedHotels = useMemo(() => {
    const start = (hotelPage - 1) * ITEMS_PER_PAGE;
    return filteredHotels.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHotels, hotelPage]);

  const totalHotelPages = Math.ceil(filteredHotels.length / ITEMS_PER_PAGE);

  // Filter and search rooms
  const filteredRooms = useMemo(() => {
    let result = rooms;

    // Apply search
    if (roomSearch) {
      const search = roomSearch.toLowerCase();
      result = result.filter(r =>
        r.room_name?.toLowerCase().includes(search) ||
        r.room_type?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
      );
    }

    // Apply filters
    if (roomFilters.roomType) {
      result = result.filter(r => r.room_type === roomFilters.roomType);
    }
    if (roomFilters.priceRange) {
      const [min, max] = roomFilters.priceRange.split('-').map(Number);
      result = result.filter(r => {
        const price = r.base_price || r.price_per_night || 0;
        return price >= min && (max ? price <= max : true);
      });
    }
    if (roomFilters.availability === 'available') {
      result = result.filter(r => (r.available_rooms || 0) > 0);
    } else if (roomFilters.availability === 'low') {
      result = result.filter(r => {
        const available = r.available_rooms || 0;
        const total = r.total_rooms || 1;
        return available > 0 && available <= Math.ceil(total * 0.2);
      });
    } else if (roomFilters.availability === 'soldout') {
      result = result.filter(r => (r.available_rooms || 0) <= 0);
    }

    return result;
  }, [rooms, roomSearch, roomFilters]);

  // Paginate rooms
  const paginatedRooms = useMemo(() => {
    const start = (roomPage - 1) * ITEMS_PER_PAGE;
    return filteredRooms.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRooms, roomPage]);

  const totalRoomPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);

  const loadHotels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/hotels/');
      setHotels(res.data.hotels || res.data || []);
      
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
      setRoomPage(1);
    }
  }, [selectedHotel, loadRooms]);

  // Reset page when filters change
  useEffect(() => {
    setHotelPage(1);
  }, [hotelSearch, hotelFilters, selectedOperator.id]);

  useEffect(() => {
    setRoomPage(1);
  }, [roomSearch, roomFilters]);

  const openHotelDialog = (hotel = null) => {
    if (hotel) {
      setEditingHotel(hotel);
      setHotelForm({
        ...hotel,
        images: hotel.images || [],
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
    if (hotelForm.images.length < 5) {
      toast.error('Please upload at least 5 images');
      return;
    }

    try {
      const operator = operators.find(op => (op._id || op.id) === hotelForm.operator_id);
      const dataToSave = {
        ...hotelForm,
        operator_name: operator?.name || hotelForm.operator_name || ''
      };
      
      const hotelId = editingHotel?._id || editingHotel?.id;
      if (editingHotel) {
        await api.put(`/hotels/${hotelId}`, dataToSave);
        toast.success('Hotel updated successfully');
      } else {
        await api.post('/hotels/', dataToSave);
        toast.success('Hotel created successfully');
      }
      setIsHotelDialogOpen(false);
      loadHotels();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save hotel');
    }
  };

  const handleDeleteHotel = async (hotel) => {
    const hotelId = hotel._id || hotel.id;
    if (!confirm('Are you sure you want to delete this hotel?')) return;
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
        images: room.images || [],
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
      delete data.price_per_night;
      delete data.name;
      delete data.quantity_available;
      delete data.room_number;
      
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom._id || editingRoom.id}`, data);
        toast.success('Room updated successfully');
      } else {
        await api.post('/rooms/', data);
        toast.success('Room added successfully');
      }
      setIsRoomDialogOpen(false);
      loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save room');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      toast.success('Room deleted');
      loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ));
  };

  const clearHotelFilters = () => {
    setHotelFilters({ city: '', starRating: '', amenity: '' });
    setHotelSearch('');
  };

  const clearRoomFilters = () => {
    setRoomFilters({ roomType: '', priceRange: '', availability: '' });
    setRoomSearch('');
  };

  const activeHotelFiltersCount = Object.values(hotelFilters).filter(Boolean).length + (hotelSearch ? 1 : 0);
  const activeRoomFiltersCount = Object.values(roomFilters).filter(Boolean).length + (roomSearch ? 1 : 0);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#082c59]">Hotel Management Center</h1>
          <p className="text-slate-500 mt-1">Manage hotels, rooms, and view analytics</p>
        </div>
        <Button onClick={loadHotels} variant="outline" disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-white shadow-sm">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="hotels" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Hotel className="h-4 w-4" /> Hotels
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" disabled={!selectedHotel}>
            <Bed className="h-4 w-4" /> Rooms
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <BarChart2 className="h-4 w-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard hotels={hotels} rooms={rooms} />
        </TabsContent>

        {/* Hotels Tab */}
        <TabsContent value="hotels" className="mt-6 space-y-4">
          {/* Search and Filters Bar */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search hotels by name, city, or operator..."
                    value={hotelSearch}
                    onChange={(e) => setHotelSearch(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={showHotelFilters ? 'default' : 'outline'}
                    onClick={() => setShowHotelFilters(!showHotelFilters)}
                    className={`gap-2 ${showHotelFilters ? 'bg-[#082c59]' : ''}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeHotelFiltersCount > 0 && (
                      <Badge className="ml-1 bg-white text-[#082c59] h-5 w-5 p-0 flex items-center justify-center">
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

              {/* Expanded Filters */}
              {showHotelFilters && (
                <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">City</Label>
                    <Select value={hotelFilters.city} onValueChange={(v) => setHotelFilters(p => ({ ...p, city: v }))}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="All cities" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="">All cities</SelectItem>
                        {CITIES.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Star Rating</Label>
                    <Select value={hotelFilters.starRating} onValueChange={(v) => setHotelFilters(p => ({ ...p, starRating: v }))}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="All ratings" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="">All ratings</SelectItem>
                        {[5, 4, 3, 2, 1].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} Star{n > 1 && 's'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Amenity</Label>
                    <Select value={hotelFilters.amenity} onValueChange={(v) => setHotelFilters(p => ({ ...p, amenity: v }))}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Any amenity" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="">Any amenity</SelectItem>
                        {HOTEL_AMENITIES.map(a => (
                          <SelectItem key={a} value={a} className="capitalize">{a.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Operator</Label>
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
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="All operators" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All operators</SelectItem>
                        {operators.map(op => (
                          <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {activeHotelFiltersCount > 0 && (
                    <div className="col-span-full flex justify-end">
                      <Button variant="ghost" size="sm" onClick={clearHotelFilters} className="text-slate-500">
                        <X className="h-4 w-4 mr-1" /> Clear all filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {paginatedHotels.length} of {filteredHotels.length} hotels
              {selectedOperator.name && <span className="ml-1">for <strong>{selectedOperator.name}</strong></span>}
            </p>
          </div>

          {/* Hotels Grid/List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-[#082c59]" />
            </div>
          ) : filteredHotels.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-16 text-center">
                <Hotel className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No hotels found</h3>
                <p className="text-slate-500 mt-1">
                  {activeHotelFiltersCount > 0 ? 'Try adjusting your filters' : 'Add your first hotel to get started'}
                </p>
                {activeHotelFiltersCount > 0 && (
                  <Button variant="outline" onClick={clearHotelFilters} className="mt-4">
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedHotels.map(hotel => (
                <Card
                  key={hotel._id || hotel.id}
                  className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden group ${
                    (selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id) 
                      ? 'ring-2 ring-[#082c59] shadow-lg' 
                      : 'shadow-sm'
                  }`}
                  onClick={() => {
                    setSelectedHotel(hotel);
                    setActiveTab('rooms');
                  }}
                >
                  {/* Hotel Images Carousel */}
                  <div className="relative h-40 bg-slate-100">
                    {hotel.images && hotel.images.length > 0 ? (
                      <ScrollArea className="h-full w-full">
                        <div className="flex h-40">
                          {hotel.images.slice(0, 5).map((img, idx) => (
                            <img
                              key={idx}
                              src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img}
                              alt={`${hotel.name} ${idx + 1}`}
                              className="h-full w-full object-cover flex-shrink-0"
                            />
                          ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Hotel className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-white/90 text-[#082c59] shadow-sm">
                        {hotel.star_rating} ⭐
                      </Badge>
                    </div>
                    {hotel.images && hotel.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        +{hotel.images.length - 1} photos
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{hotel.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> 
                          <span className="truncate">{hotel.city}</span>
                        </div>
                      </div>
                    </div>

                    {hotel.operator_name && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-3 w-fit">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{hotel.operator_name}</span>
                      </div>
                    )}

                    {hotel.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {hotel.amenities.slice(0, 3).map(a => (
                          <Badge key={a} variant="outline" className="text-xs capitalize bg-slate-50">
                            {a.replace('_', ' ')}
                          </Badge>
                        ))}
                        {hotel.amenities.length > 3 && (
                          <Badge variant="outline" className="text-xs bg-slate-50">
                            +{hotel.amenities.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelectedHotel(hotel);
                          setActiveTab('rooms');
                        }}
                      >
                        <Bed className="w-4 h-4 mr-1" /> Rooms
                      </Button>
                      <PermissionGate permission="hotels.edit">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); openHotelDialog(hotel); }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="hotels.delete">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); handleDeleteHotel(hotel); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="space-y-3">
              {paginatedHotels.map(hotel => (
                <Card
                  key={hotel._id || hotel.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    (selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id) 
                      ? 'ring-2 ring-[#082c59]' 
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedHotel(hotel);
                    setActiveTab('rooms');
                  }}
                >
                  <CardContent className="p-4 flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-32 h-24 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                      {hotel.images && hotel.images[0] ? (
                        <img
                          src={hotel.images[0].startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${hotel.images[0]}` : hotel.images[0]}
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Hotel className="h-8 w-8 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-lg">{hotel.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {hotel.city}
                            </span>
                            <span className="flex items-center gap-1">
                              {renderStars(hotel.star_rating)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <PermissionGate permission="hotels.edit">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openHotelDialog(hotel); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="hotels.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteHotel(hotel); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </div>

                      {hotel.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {hotel.amenities.slice(0, 5).map(a => (
                            <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Images Preview */}
                    {hotel.images && hotel.images.length > 1 && (
                      <div className="hidden lg:flex gap-1 flex-shrink-0">
                        {hotel.images.slice(1, 4).map((img, idx) => (
                          <div key={idx} className="w-16 h-24 rounded overflow-hidden">
                            <img
                              src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {hotel.images.length > 4 && (
                          <div className="w-16 h-24 rounded bg-slate-100 flex items-center justify-center">
                            <span className="text-sm text-slate-500">+{hotel.images.length - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalHotelPages > 1 && (
            <Pagination
              currentPage={hotelPage}
              totalPages={totalHotelPages}
              onPageChange={setHotelPage}
            />
          )}
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="mt-6 space-y-4">
          {!selectedHotel ? (
            <Card className="shadow-sm">
              <CardContent className="py-16 text-center">
                <Hotel className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No hotel selected</h3>
                <p className="text-slate-500 mt-1">Select a hotel from the Hotels tab to manage its rooms</p>
                <Button onClick={() => setActiveTab('hotels')} className="mt-4 bg-[#082c59]">
                  Go to Hotels
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Selected Hotel Info */}
              <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a3a75] text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/10 rounded-lg overflow-hidden">
                        {selectedHotel.images && selectedHotel.images[0] ? (
                          <img
                            src={selectedHotel.images[0].startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${selectedHotel.images[0]}` : selectedHotel.images[0]}
                            alt={selectedHotel.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Hotel className="h-8 w-8 text-white/50" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selectedHotel.name}</h2>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                          <MapPin className="w-4 h-4" /> {selectedHotel.city}
                          <span className="mx-2">•</span>
                          {renderStars(selectedHotel.star_rating)}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      onClick={() => setActiveTab('hotels')}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back to Hotels
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Room Search and Filters */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search rooms by name, type..."
                        value={roomSearch}
                        onChange={(e) => setRoomSearch(e.target.value)}
                        className="pl-10 bg-white"
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={showRoomFilters ? 'default' : 'outline'}
                        onClick={() => setShowRoomFilters(!showRoomFilters)}
                        className={`gap-2 ${showRoomFilters ? 'bg-[#082c59]' : ''}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeRoomFiltersCount > 0 && (
                          <Badge className="ml-1 bg-white text-[#082c59] h-5 w-5 p-0 flex items-center justify-center">
                            {activeRoomFiltersCount}
                          </Badge>
                        )}
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
                        <Select value={roomFilters.roomType} onValueChange={(v) => setRoomFilters(p => ({ ...p, roomType: v }))}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="">All types</SelectItem>
                            {ROOM_TYPES.map(type => (
                              <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Price Range</Label>
                        <Select value={roomFilters.priceRange} onValueChange={(v) => setRoomFilters(p => ({ ...p, priceRange: v }))}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Any price" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="">Any price</SelectItem>
                            <SelectItem value="0-25000">Under 25,000 FCFA</SelectItem>
                            <SelectItem value="25000-50000">25,000 - 50,000 FCFA</SelectItem>
                            <SelectItem value="50000-100000">50,000 - 100,000 FCFA</SelectItem>
                            <SelectItem value="100000-">Above 100,000 FCFA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs text-slate-500 mb-1.5 block">Availability</Label>
                        <Select value={roomFilters.availability} onValueChange={(v) => setRoomFilters(p => ({ ...p, availability: v }))}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="">All</SelectItem>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="low">Low Stock</SelectItem>
                            <SelectItem value="soldout">Sold Out</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {activeRoomFiltersCount > 0 && (
                        <div className="col-span-full flex justify-end">
                          <Button variant="ghost" size="sm" onClick={clearRoomFilters} className="text-slate-500">
                            <X className="h-4 w-4 mr-1" /> Clear filters
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing {paginatedRooms.length} of {filteredRooms.length} rooms
                </p>
              </div>

              {/* Rooms List */}
              {filteredRooms.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="py-16 text-center">
                    <Bed className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No rooms found</h3>
                    <p className="text-slate-500 mt-1">
                      {activeRoomFiltersCount > 0 ? 'Try adjusting your filters' : 'Add your first room to get started'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {paginatedRooms.map(room => {
                    const totalRooms = room.total_rooms || 1;
                    const availableRooms = room.available_rooms ?? totalRooms;
                    const isLowStock = availableRooms <= Math.ceil(totalRooms * 0.2) && availableRooms > 0;
                    const isOutOfStock = availableRooms <= 0;
                    
                    return (
                      <Card key={room.id || room._id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex">
                          {/* Room Images */}
                          <div className="w-48 h-36 bg-slate-100 flex-shrink-0 relative">
                            {room.images && room.images.length > 0 ? (
                              <ScrollArea className="h-full w-full">
                                <div className="flex h-36">
                                  {room.images.map((img, idx) => (
                                    <img 
                                      key={idx}
                                      src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img}
                                      alt={room.room_name} 
                                      className="h-full w-48 object-cover flex-shrink-0" 
                                    />
                                  ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                              </ScrollArea>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Bed className="w-12 h-12 text-slate-300" />
                              </div>
                            )}
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
                                <h4 className="font-bold text-lg">{room.room_name || `Room ${(room.id || room._id)?.slice(-4)}`}</h4>
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
                          <div className="flex flex-col justify-center gap-2 p-4 border-l bg-slate-50">
                            <PermissionGate permission="hotels.manage_rooms">
                              <Button size="sm" variant="outline" onClick={() => openRoomDialog(room)} className="bg-white">
                                <Edit className="w-4 h-4 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 bg-white hover:bg-red-50" onClick={() => handleDeleteRoom(room.id || room._id)}>
                                <Trash2 className="w-4 h-4 mr-1" /> Delete
                              </Button>
                            </PermissionGate>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalRoomPages > 1 && (
                <Pagination
                  currentPage={roomPage}
                  totalPages={totalRoomPages}
                  onPageChange={setRoomPage}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <ExecutiveDashboard hotels={hotels} rooms={rooms} />
        </TabsContent>
      </Tabs>

      {/* Hotel Dialog */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Hotel className="h-5 w-5 text-[#082c59]" />
              {editingHotel ? 'Edit Hotel' : 'Add New Hotel'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Image Upload Section */}
            <ImageUploader
              images={hotelForm.images}
              onImagesChange={(images) => setHotelForm(p => ({ ...p, images }))}
              maxImages={10}
              minImages={5}
            />

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Hotel Name *</Label>
                <Input 
                  value={hotelForm.name} 
                  onChange={e => setHotelForm(p => ({ ...p, name: e.target.value }))} 
                  placeholder="Enter hotel name" 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>City *</Label>
                <Select value={hotelForm.city} onValueChange={v => setHotelForm(p => ({ ...p, city: v }))}>
                  <SelectTrigger className="bg-white mt-1.5">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {CITIES.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Star Rating</Label>
                <Select value={String(hotelForm.star_rating)} onValueChange={v => setHotelForm(p => ({ ...p, star_rating: parseInt(v) }))}>
                  <SelectTrigger className="bg-white mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Star{n > 1 && 's'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Operator Selection */}
            <div>
              <Label>Operator</Label>
              <Select 
                value={hotelForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setHotelForm(p => ({ ...p, operator_id: v, operator_name: op?.name || '' }));
                }}
              >
                <SelectTrigger className="bg-white mt-1.5">
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
            </div>

            {/* Address */}
            <div>
              <Label>Address *</Label>
              <Input 
                value={hotelForm.address} 
                onChange={e => setHotelForm(p => ({ ...p, address: e.target.value }))} 
                placeholder="Full street address" 
                className="mt-1.5"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input 
                  value={hotelForm.phone} 
                  onChange={e => setHotelForm(p => ({ ...p, phone: e.target.value }))} 
                  placeholder="+237..." 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={hotelForm.email} 
                  onChange={e => setHotelForm(p => ({ ...p, email: e.target.value }))} 
                  placeholder="hotel@example.com" 
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Amenities */}
            <div>
              <Label className="mb-2 block">Amenities</Label>
              <div className="flex flex-wrap gap-2">
                {HOTEL_AMENITIES.map(amenity => (
                  <Badge
                    key={amenity}
                    variant={hotelForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                    className={`cursor-pointer capitalize transition-colors ${
                      hotelForm.amenities?.includes(amenity) ? 'bg-[#082c59]' : 'hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setHotelForm(p => ({
                        ...p,
                        amenities: p.amenities?.includes(amenity)
                          ? p.amenities.filter(a => a !== amenity)
                          : [...(p.amenities || []), amenity]
                      }));
                    }}
                  >
                    {hotelForm.amenities?.includes(amenity) && <Check className="w-3 h-3 mr-1" />}
                    {amenity.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea 
                value={hotelForm.description} 
                onChange={e => setHotelForm(p => ({ ...p, description: e.target.value }))} 
                placeholder="Describe the hotel, its features, and what makes it special..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsHotelDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveHotel} 
              className="bg-[#082c59]"
              disabled={hotelForm.images.length < 5}
            >
              {editingHotel ? 'Update Hotel' : 'Create Hotel'}
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
            <p className="text-sm text-slate-500">Configure room for {selectedHotel?.name}</p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Room Images Upload */}
            <RoomImageUploader
              images={roomForm.images}
              onImagesChange={(images) => setRoomForm(p => ({ ...p, images }))}
              maxImages={5}
            />

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Room Name *</Label>
                <Input 
                  value={roomForm.room_name} 
                  onChange={e => setRoomForm(p => ({ ...p, room_name: e.target.value }))} 
                  placeholder="Deluxe Suite 101" 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Room Type</Label>
                <Select value={roomForm.room_type} onValueChange={v => setRoomForm(p => ({ ...p, room_type: v }))}>
                  <SelectTrigger className="bg-white mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {ROOM_TYPES.map(type => (
                      <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing & Capacity */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Price/Night (FCFA) *</Label>
                <Input 
                  type="number" 
                  value={roomForm.base_price} 
                  onChange={e => setRoomForm(p => ({ ...p, base_price: e.target.value }))} 
                  placeholder="25000" 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input 
                  type="number" 
                  value={roomForm.capacity} 
                  onChange={e => setRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Total Rooms</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={roomForm.total_rooms} 
                  onChange={e => {
                    const total = parseInt(e.target.value) || 1;
                    setRoomForm(p => ({ 
                      ...p, 
                      total_rooms: total,
                      available_rooms: Math.min(p.available_rooms || total, total)
                    }));
                  }} 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Available</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max={roomForm.total_rooms || 1}
                  value={roomForm.available_rooms} 
                  onChange={e => setRoomForm(p => ({ ...p, available_rooms: Math.min(parseInt(e.target.value) || 0, p.total_rooms || 1) }))} 
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Room Features */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Bed Type</Label>
                <Select value={roomForm.bed_type} onValueChange={v => setRoomForm(p => ({ ...p, bed_type: v }))}>
                  <SelectTrigger className="bg-white mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
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
                <Label>Floor</Label>
                <Input 
                  type="number" 
                  value={roomForm.floor} 
                  onChange={e => setRoomForm(p => ({ ...p, floor: parseInt(e.target.value) || 1 }))} 
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Size (m²)</Label>
                <Input 
                  type="number" 
                  value={roomForm.size_sqm} 
                  onChange={e => setRoomForm(p => ({ ...p, size_sqm: parseInt(e.target.value) || 25 }))} 
                  className="mt-1.5"
                />
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
                    className={`cursor-pointer capitalize transition-colors ${
                      roomForm.amenities?.includes(amenity) ? 'bg-[#082c59]' : 'hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setRoomForm(p => ({
                        ...p,
                        amenities: p.amenities?.includes(amenity)
                          ? p.amenities.filter(a => a !== amenity)
                          : [...(p.amenities || []), amenity]
                      }));
                    }}
                  >
                    {roomForm.amenities?.includes(amenity) && <Check className="w-3 h-3 mr-1" />}
                    {amenity.replace(/_/g, ' ')}
                  </Badge>
                ))}
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
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} className="bg-[#082c59]">
              {editingRoom ? 'Update Room' : 'Add Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
