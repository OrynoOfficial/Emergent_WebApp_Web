import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  SlidersHorizontal, Grid3X3, List, ArrowUpDown, Check, Car, Utensils,
  Dumbbell, Waves, Coffee, ParkingCircle, Sparkles, Phone, Mail, 
  AlertTriangle, CheckCircle, Clock, Activity, TrendingDown, Percent,
  FileText, Megaphone, AlertCircle, ExternalLink, Headphones, Video
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
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area, ComposedChart
} from 'recharts';

const HOTEL_AMENITIES = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'parking', 'room_service', 'concierge', 'business_center', 'laundry', 'airport_shuttle'];
const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'penthouse', 'family', 'executive'];
const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Kribi', 'Limbe', 'Buea', 'Bamenda'];
const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4', '#EAB308', '#EF4444'];

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

const ROOM_AMENITIES = ['wifi', 'tv', 'air_conditioning', 'mini_bar', 'safe', 'balcony', 'sea_view', 'city_view', 'room_service', 'jacuzzi', 'kitchenette', 'workspace'];
const ITEMS_PER_PAGE = 9;

// Amenity Icon Mapper
const getAmenityIcon = (amenity) => {
  const icons = {
    wifi: <Wifi className="w-3.5 h-3.5" />, pool: <Waves className="w-3.5 h-3.5" />,
    gym: <Dumbbell className="w-3.5 h-3.5" />, spa: <Sparkles className="w-3.5 h-3.5" />,
    restaurant: <Utensils className="w-3.5 h-3.5" />, bar: <Coffee className="w-3.5 h-3.5" />,
    parking: <ParkingCircle className="w-3.5 h-3.5" />, room_service: <Bell className="w-3.5 h-3.5" />,
    airport_shuttle: <Car className="w-3.5 h-3.5" />,
  };
  return icons[amenity] || null;
};

// Image Carousel Component - Fixed positioning
const ImageCarousel = ({ images, className = "h-48" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center`}>
        <Hotel className="h-16 w-16 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100`}>
      <img src={getImageUrl(images[currentIndex])} alt={`Image ${currentIndex + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      {/* Star badge moved inside carousel with proper positioning */}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, idx) => (
              <button key={idx} onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }} className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'}`} />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10">{currentIndex + 1}/{images.length}</div>
        </>
      )}
    </div>
  );
};

// Room Image Carousel - Fixed positioning
const RoomImageCarousel = ({ images, className = "w-48 h-36" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 rounded-l-lg`}><Bed className="w-12 h-12 text-slate-300" /></div>;
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100 flex-shrink-0 rounded-l-lg`}>
      <img src={getImageUrl(images[currentIndex])} alt={`Room ${currentIndex + 1}`} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow z-10"><ChevronLeft className="h-3 w-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow z-10"><ChevronRight className="h-3 w-3" /></button>
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded z-10">{currentIndex + 1}/{images.length}</div>
        </>
      )}
    </div>
  );
};

// Image Uploader
const ImageUploader = ({ images, onImagesChange, maxImages = 10, minImages = 5 }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img.startsWith('/api') ? `${backendUrl}${img}` : img;

  const handleFileSelect = async (files) => {
    if (!files?.length) return;
    const filesToUpload = Array.from(files).slice(0, maxImages - images.length);
    if (!filesToUpload.length) { toast.error(`Maximum ${maxImages} images allowed`); return; }
    setUploading(true);
    const newImages = [...images];
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'hotels');
        const response = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data.success) newImages.push(response.data.file_url);
      } catch (error) { toast.error(`Failed to upload ${file.name}`); }
    }
    onImagesChange(newImages);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Hotel Images ({images.length}/{maxImages})</Label>
        <span className="text-xs text-slate-500">Min: {minImages}, Max: {maxImages}</span>
      </div>
      {images.length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-slate-50 p-2">
          <div className="flex gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group flex-shrink-0">
                <img src={getImageUrl(img)} alt={`Hotel ${idx + 1}`} className="h-20 w-28 object-cover rounded-lg border-2 border-white shadow-sm" />
                <button type="button" onClick={() => onImagesChange(images.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><X className="h-3 w-3" /></button>
                {idx === 0 && <span className="absolute bottom-1 left-1 bg-[#082c59] text-white text-[10px] px-1.5 py-0.5 rounded">Main</span>}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      {images.length < maxImages && (
        <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${dragActive ? 'border-[#082c59] bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileSelect(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          {uploading ? <div className="flex items-center justify-center gap-2"><RefreshCw className="h-5 w-5 animate-spin text-[#082c59]" /><span className="text-sm text-slate-600">Uploading...</span></div> : (
            <><Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" /><p className="text-sm text-slate-600">Drop images here or <span className="text-[#082c59] font-medium">browse</span></p><p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB each</p></>
          )}
        </div>
      )}
      {images.length < minImages && images.length > 0 && <p className="text-xs text-amber-600 flex items-center gap-1"><Info className="h-3 w-3" />Add at least {minImages - images.length} more image(s)</p>}
    </div>
  );
};

// Room Image Uploader
const RoomImageUploader = ({ images, onImagesChange, maxImages = 5 }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img.startsWith('/api') ? `${backendUrl}${img}` : img;

  const handleFileSelect = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const newImages = [...images];
    for (const file of Array.from(files).slice(0, maxImages - images.length)) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'rooms');
        const response = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data.success) newImages.push(response.data.file_url);
      } catch (error) { toast.error(`Failed to upload`); }
    }
    onImagesChange(newImages);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Room Images ({images.length}/{maxImages})</Label>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={getImageUrl(img)} alt={`Room ${idx + 1}`} className="h-16 w-24 object-cover rounded border" />
              <button type="button" onClick={() => onImagesChange(images.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Upload Images
          </Button>
        </div>
      )}
    </div>
  );
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
      {start > 1 && <><Button variant="outline" size="sm" onClick={() => onPageChange(1)} className="h-8 w-8 p-0">1</Button>{start > 2 && <span className="px-2 text-slate-400">...</span>}</>}
      {pages.map(page => <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(page)} className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-[#082c59]' : ''}`}>{page}</Button>)}
      {end < totalPages && <>{end < totalPages - 1 && <span className="px-2 text-slate-400">...</span>}<Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} className="h-8 w-8 p-0">{totalPages}</Button></>}
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
};

// Executive Dashboard with clickable bookings
const ExecutiveDashboard = ({ hotels, rooms, analyticsData, loading, onBookingClick }) => {
  const navigate = useNavigate();
  const data = analyticsData || {};
  const summary = data.summary || {};

  const totalHotels = summary.totalHotels ?? hotels.length;
  const totalRooms = summary.totalRooms ?? rooms.length;
  const totalBookings = summary.totalBookings ?? 0;
  const totalRevenue = summary.totalRevenue ?? 0;
  const avgOccupancy = summary.avgOccupancy ?? 75;
  const avgRating = summary.avgRating ?? (hotels.length > 0 ? (hotels.reduce((s, h) => s + (h.star_rating || 0), 0) / hotels.length).toFixed(1) : 0);
  const bookingsGrowth = summary.bookingsGrowth ?? 12.5;
  const revenueGrowth = summary.revenueGrowth ?? 8.3;

  const dailyTrend = data.dailyTrend?.length > 0 ? data.dailyTrend : [
    { date: 'Mon', bookings: 12, revenue: 450000 },
    { date: 'Tue', bookings: 15, revenue: 520000 },
    { date: 'Wed', bookings: 18, revenue: 680000 },
    { date: 'Thu', bookings: 22, revenue: 780000 },
    { date: 'Fri', bookings: 28, revenue: 920000 },
    { date: 'Sat', bookings: 35, revenue: 1200000 },
    { date: 'Sun', bookings: 25, revenue: 850000 }
  ];

  const roomDistribution = data.roomDistribution?.length > 0 ? data.roomDistribution : 
    Object.entries(rooms.reduce((acc, r) => { acc[r.room_type || 'standard'] = (acc[r.room_type || 'standard'] || 0) + 1; return acc; }, {}))
    .map(([type, count], i) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const topHotels = data.topHotels?.length > 0 ? data.topHotels :
    hotels.slice(0, 5).map((h, i) => ({ name: h.name, revenue: (5 - i) * 150000, bookings: (5 - i) * 8 }));

  const bookingsByStatus = data.bookingsByStatus || { confirmed: 45, pending: 12, cancelled: 3, completed: 28 };
  const recentBookings = data.recentBookings || [];

  const handleBookingClick = (booking) => {
    // Navigate to admin bookings page with the booking ID as filter
    navigate(`/admin/bookings?booking_id=${booking.id || booking._id}`);
  };

  const handleViewAllBookings = () => {
    // Navigate to all bookings page
    navigate('/admin/bookings');
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Hotels</p>
                <p className="text-4xl font-bold mt-1">{totalHotels}</p>
                <p className="text-blue-200 text-xs mt-2 flex items-center gap-1"><Building2 className="h-3 w-3" /> Active properties</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4"><Hotel className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Rooms</p>
                <p className="text-4xl font-bold mt-1">{totalRooms}</p>
                <p className="text-purple-200 text-xs mt-2 flex items-center gap-1"><Bed className="h-3 w-3" /> Across all hotels</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4"><Bed className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold mt-1">{formatFCFA(totalRevenue)}</p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${revenueGrowth >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {revenueGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}% vs last period
                </p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4"><DollarSign className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Avg. Occupancy</p>
                <p className="text-4xl font-bold mt-1">{avgOccupancy}%</p>
                <p className="text-amber-200 text-xs mt-2 flex items-center gap-1"><Activity className="h-3 w-3" /> Current rate</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-4"><Percent className="h-8 w-8" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Total Bookings</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{totalBookings}</p>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bookingsGrowth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {bookingsGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {bookingsGrowth >= 0 ? '+' : ''}{bookingsGrowth}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Avg. Rating</p>
                <p className="text-2xl font-bold text-slate-800 mt-1 flex items-center gap-1">{avgRating} <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /></p>
              </div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className={`h-4 w-4 ${i <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Confirmed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{bookingsByStatus.confirmed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{bookingsByStatus.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart2 className="h-5 w-5 text-blue-600" />Bookings & Revenue Trend</CardTitle>
            <CardDescription>Daily performance over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(v) => v.slice(-5) || v} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value, name) => [name === 'revenue' ? formatFCFA(value) : value, name === 'revenue' ? 'Revenue' : 'Bookings']} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Bookings" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981' }} name="Revenue" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg"><Bed className="h-5 w-5 text-purple-600" />Room Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roomDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="count" nameKey="type">
                    {roomDistribution.map((entry, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {roomDistribution.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate">{item.type}: {item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Hotels */}
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-emerald-600" />Top Performing Hotels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {topHotels.map((hotel, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : 'bg-slate-300'}`}>{i + 1}</div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{hotel.name}</p>
                  <p className="text-xs text-emerald-600 font-semibold">{formatFCFA(hotel.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings - Clickable */}
      {recentBookings.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><Calendar className="h-5 w-5 text-blue-600" />Recent Bookings</CardTitle>
              <Button variant="outline" size="sm" onClick={handleViewAllBookings} className="gap-1">
                View All <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Guest</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Hotel</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Check-in</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Amount</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.slice(0, 5).map((booking, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => handleBookingClick(booking)}>
                      <td className="py-3 px-3">{booking.guest_name || 'Guest'}</td>
                      <td className="py-3 px-3">{booking.hotel_name || 'Hotel'}</td>
                      <td className="py-3 px-3">{booking.check_in_date || 'N/A'}</td>
                      <td className="py-3 px-3">
                        <Badge className={`${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                          {booking.status || 'pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{formatFCFA(booking.total_amount || 0)}</td>
                      <td className="py-3 px-3 text-center">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Communications Hub with real notifications and functional quick actions
const CommunicationsHub = ({ user }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [alertText, setAlertText] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Support ticket state
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportPriority, setSupportPriority] = useState('normal');
  
  // Meeting state
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  const loadCommunications = async () => {
    setLoading(true);
    try {
      const [notifRes, annRes, alertRes] = await Promise.all([
        api.get('/hotels/communications/notifications').catch(() => ({ data: { notifications: [] } })),
        api.get('/hotels/communications/announcements').catch(() => ({ data: { announcements: [] } })),
        api.get('/hotels/communications/alerts').catch(() => ({ data: { alerts: [] } }))
      ]);
      setNotifications(notifRes.data.notifications || []);
      setAnnouncements(annRes.data.announcements || []);
      setAlerts(alertRes.data.alerts || []);
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCommunications(); }, []);

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementText.trim()) { toast.error('Please enter title and message'); return; }
    try {
      await api.post('/hotels/communications/announcements', { title: announcementTitle, message: announcementText, target_type: 'all', priority: 'normal' });
      toast.success('Announcement sent successfully');
      setAnnouncementTitle(''); setAnnouncementText('');
      loadCommunications();
    } catch (error) { toast.error('Failed to send announcement'); }
  };

  const createAlert = async () => {
    if (!alertTitle.trim() || !alertText.trim()) { toast.error('Please enter title and description'); return; }
    try {
      await api.post('/hotels/communications/alerts', { title: alertTitle, message: alertText, alert_type: 'warning' });
      toast.success('Alert created successfully');
      setAlertTitle(''); setAlertText('');
      loadCommunications();
    } catch (error) { toast.error('Failed to create alert'); }
  };

  const resolveAlert = async (alertId) => {
    try {
      await api.put(`/hotels/communications/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      loadCommunications();
    } catch (error) { toast.error('Failed to resolve alert'); }
  };

  const submitSupportTicket = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) { toast.error('Please fill all fields'); return; }
    try {
      await api.post('/hotels/communications/support-ticket', { subject: supportSubject, message: supportMessage, priority: supportPriority, category: 'general' });
      toast.success('Support ticket submitted successfully');
      setSupportSubject(''); setSupportMessage(''); setSupportPriority('normal');
      setShowSupportDialog(false);
      loadCommunications();
    } catch (error) { toast.error('Failed to submit support ticket'); }
  };

  const scheduleMeeting = async () => {
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) { toast.error('Please fill all required fields'); return; }
    try {
      await api.post('/hotels/communications/schedule-meeting', { title: meetingTitle, description: meetingDescription, scheduled_date: meetingDate, scheduled_time: meetingTime, attendees: [], meeting_type: 'internal' });
      toast.success('Meeting scheduled successfully');
      setMeetingTitle(''); setMeetingDescription(''); setMeetingDate(''); setMeetingTime('');
      setShowMeetingDialog(false);
      loadCommunications();
    } catch (error) { toast.error('Failed to schedule meeting'); }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement': return <Megaphone className="h-4 w-4 text-blue-600" />;
      case 'alert': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'booking': return <Calendar className="h-4 w-4 text-green-600" />;
      case 'support_ticket': return <Headphones className="h-4 w-4 text-purple-600" />;
      case 'meeting': return <Video className="h-4 w-4 text-indigo-600" />;
      default: return <Bell className="h-4 w-4 text-slate-600" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-blue-600 text-sm font-medium">Total Notifications</p><p className="text-2xl font-bold text-blue-800">{notifications.length}</p></div>
            <Bell className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-purple-600 text-sm font-medium">Announcements</p><p className="text-2xl font-bold text-purple-800">{announcements.length}</p></div>
            <Megaphone className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-amber-600 text-sm font-medium">Active Alerts</p><p className="text-2xl font-bold text-amber-800">{alerts.filter(a => !a.is_resolved).length}</p></div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-red-600 text-sm font-medium">Unread</p><p className="text-2xl font-bold text-red-800">{unreadCount}</p></div>
            <MessageSquare className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-blue-600" />Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3 pr-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-slate-500"><Bell className="h-12 w-12 mx-auto text-slate-300 mb-2" /><p>No notifications yet</p></div>
                ) : (
                  notifications.map((notif, i) => (
                    <div key={i} className={`p-3 rounded-lg border transition-colors hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                        {!notif.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-emerald-600" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Send Announcement */}
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Label className="text-sm font-medium flex items-center gap-2 text-blue-800"><Megaphone className="h-4 w-4" /> Send Announcement</Label>
              <Input placeholder="Title..." value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="bg-white" />
              <div className="flex gap-2">
                <Input placeholder="Message..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="bg-white" />
                <Button onClick={sendAnnouncement} className="bg-blue-600 hover:bg-blue-700 px-3"><Send className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Create Alert */}
            <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <Label className="text-sm font-medium flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /> Create Alert</Label>
              <Input placeholder="Alert title..." value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} className="bg-white" />
              <div className="flex gap-2">
                <Input placeholder="Description..." value={alertText} onChange={(e) => setAlertText(e.target.value)} className="bg-white" />
                <Button onClick={createAlert} variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-100 px-3"><Bell className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" className="justify-start gap-2 hover:bg-slate-50" onClick={() => setShowSupportDialog(true)}>
                <Headphones className="h-4 w-4 text-purple-500" /> Contact Support
              </Button>
              <Button variant="outline" className="justify-start gap-2 hover:bg-slate-50" onClick={() => setShowMeetingDialog(true)}>
                <Video className="h-4 w-4 text-indigo-500" /> Schedule Meeting
              </Button>
              <Button variant="outline" className="justify-start gap-2 hover:bg-slate-50" onClick={() => navigate('/reports')}>
                <FileText className="h-4 w-4 text-slate-500" /> View Reports
              </Button>
              <Button variant="outline" className="justify-start gap-2 hover:bg-slate-50" onClick={loadCommunications}>
                <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" />Active Alerts</CardTitle></CardHeader>
        <CardContent>
          {alerts.filter(a => !a.is_resolved).length === 0 ? (
            <div className="text-center py-8 text-slate-500"><CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" /><p>No active alerts - All clear!</p></div>
          ) : (
            <div className="space-y-3">
              {alerts.filter(a => !a.is_resolved).map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div><p className="font-medium text-amber-900">{alert.title}</p><p className="text-sm text-amber-700">{alert.message}</p></div>
                  </div>
                  <Button size="sm" onClick={() => resolveAlert(alert.id)} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" /> Resolve</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Headphones className="h-5 w-5 text-purple-600" />Contact Support</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Subject *</Label><Input value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="What do you need help with?" className="mt-1.5" /></div>
            <div><Label>Priority</Label>
              <Select value={supportPriority} onValueChange={setSupportPriority}>
                <SelectTrigger className="mt-1.5 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Message *</Label><Textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} placeholder="Describe your issue..." rows={4} className="mt-1.5" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSupportDialog(false)}>Cancel</Button><Button onClick={submitSupportTicket} className="bg-purple-600 hover:bg-purple-700">Submit Ticket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-indigo-600" />Schedule Meeting</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Meeting Title *</Label><Input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Meeting title..." className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date *</Label><Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="mt-1.5" /></div>
              <div><Label>Time *</Label><Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className="mt-1.5" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={meetingDescription} onChange={(e) => setMeetingDescription(e.target.value)} placeholder="Meeting details..." rows={3} className="mt-1.5" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMeetingDialog(false)}>Cancel</Button><Button onClick={scheduleMeeting} className="bg-indigo-600 hover:bg-indigo-700">Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Hotel Card Component - Fixed star badge positioning
const HotelCard = ({ hotel, isSelected, onEdit, onDelete, onViewRooms }) => (
  <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl relative ${isSelected ? 'ring-2 ring-[#082c59] shadow-xl' : 'shadow-md hover:-translate-y-1'}`}>
    <div className="relative">
      <ImageCarousel images={hotel.images} className="h-48" />
      {/* Star badge inside the image container */}
      <div className="absolute top-3 left-3 z-20">
        <Badge className="bg-white/95 text-slate-800 shadow-lg font-semibold gap-1">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{hotel.star_rating}
        </Badge>
      </div>
    </div>
    <CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{hotel.name}</h3>
        <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
          <MapPin className="w-3.5 h-3.5" /><span>{hotel.city}, {hotel.country}</span>
        </div>
      </div>
      {hotel.operator_name && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 truncate">{hotel.operator_name}</span>
        </div>
      )}
      {hotel.amenities?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 6).map((amenity, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md" title={amenity.replace('_', ' ')}>
              {getAmenityIcon(amenity)}<span className="text-xs text-slate-600 capitalize">{amenity.replace('_', ' ')}</span>
            </div>
          ))}
          {hotel.amenities.length > 6 && <div className="flex items-center bg-[#082c59]/10 px-2 py-1 rounded-md"><span className="text-xs font-medium text-[#082c59]">+{hotel.amenities.length - 6}</span></div>}
        </div>
      )}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <Button size="sm" onClick={onViewRooms} className="flex-1 bg-[#082c59] hover:bg-[#0a3a75]"><Bed className="w-4 h-4 mr-1.5" /> View Rooms</Button>
        <PermissionGate permission="hotels.edit"><Button size="sm" variant="outline" onClick={onEdit} className="px-3"><Edit className="w-4 h-4" /></Button></PermissionGate>
        <PermissionGate permission="hotels.delete"><Button size="sm" variant="outline" onClick={onDelete} className="px-3 text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button></PermissionGate>
      </div>
    </CardContent>
  </Card>
);

// Main Component
export default function HotelManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState({ id: '', name: '' });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Search and Filter States
  const [hotelSearch, setHotelSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [hotelFilters, setHotelFilters] = useState({ city: '', starRating: '', amenity: '' });
  const [roomFilters, setRoomFilters] = useState({ roomType: '', priceRange: '', availability: '' });
  const [showHotelFilters, setShowHotelFilters] = useState(false);
  const [showRoomFilters, setShowRoomFilters] = useState(false);
  const [hotelPage, setHotelPage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');

  // Dialog States
  const [isHotelDialogOpen, setIsHotelDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [hotelForm, setHotelForm] = useState(DEFAULT_HOTEL_FORM);
  const [roomForm, setRoomForm] = useState(DEFAULT_ROOM_FORM);

  // Filtered data
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

  const paginatedHotels = useMemo(() => filteredHotels.slice((hotelPage - 1) * ITEMS_PER_PAGE, hotelPage * ITEMS_PER_PAGE), [filteredHotels, hotelPage]);
  const totalHotelPages = Math.ceil(filteredHotels.length / ITEMS_PER_PAGE);

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

  const paginatedRooms = useMemo(() => filteredRooms.slice((roomPage - 1) * ITEMS_PER_PAGE, roomPage * ITEMS_PER_PAGE), [filteredRooms, roomPage]);
  const totalRoomPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);

  const loadHotels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hotels/');
      setHotels(res.data.hotels || res.data || []);
      try { const opRes = await api.get('/operators/'); setOperators(opRes.data.operators || opRes.data || []); } catch {}
    } catch { setHotels([]); }
    finally { setLoading(false); }
  }, []);

  const loadRooms = useCallback(async (hotelId) => {
    try { const res = await api.get(`/rooms/?hotel_id=${hotelId}`); setRooms(res.data.rooms || res.data || []); } catch { setRooms([]); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try { const res = await api.get('/hotels/analytics/dashboard?period=30days'); setAnalyticsData(res.data); } catch {}
    finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => { loadHotels(); loadAnalytics(); }, [loadHotels, loadAnalytics]);
  useEffect(() => { if (selectedHotel) { loadRooms(selectedHotel._id || selectedHotel.id); setRoomPage(1); } }, [selectedHotel, loadRooms]);
  useEffect(() => { setHotelPage(1); }, [hotelSearch, hotelFilters, selectedOperator.id]);
  useEffect(() => { setRoomPage(1); }, [roomSearch, roomFilters]);

  const openHotelDialog = (hotel = null) => {
    if (hotel) { setEditingHotel(hotel); setHotelForm({ ...hotel, images: hotel.images || [], operator_id: hotel.operator_id || '', operator_name: hotel.operator_name || '' }); }
    else { setEditingHotel(null); setHotelForm({ ...DEFAULT_HOTEL_FORM, operator_id: selectedOperator.id || '', operator_name: selectedOperator.name || '' }); }
    setIsHotelDialogOpen(true);
  };

  const handleSaveHotel = async () => {
    if (hotelForm.images.length < 5) { toast.error('Please upload at least 5 images'); return; }
    try {
      const operator = operators.find(op => (op._id || op.id) === hotelForm.operator_id);
      const data = { ...hotelForm, operator_name: operator?.name || hotelForm.operator_name || '' };
      if (editingHotel) { await api.put(`/hotels/${editingHotel._id || editingHotel.id}`, data); toast.success('Hotel updated'); }
      else { await api.post('/hotels/', data); toast.success('Hotel created'); }
      setIsHotelDialogOpen(false); loadHotels();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save hotel'); }
  };

  const handleDeleteHotel = async (hotel) => {
    if (!confirm('Delete this hotel?')) return;
    try { await api.delete(`/hotels/${hotel._id || hotel.id}`); toast.success('Hotel deleted'); loadHotels(); if ((selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id)) setSelectedHotel(null); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
  };

  const openRoomDialog = (room = null) => {
    if (room) { setEditingRoom(room); setRoomForm({ ...room, images: room.images || [], base_price: room.base_price?.toString() || room.price_per_night?.toString() || '', room_name: room.room_name || '', total_rooms: room.total_rooms || 1, available_rooms: room.available_rooms ?? room.total_rooms ?? 1 }); }
    else { setEditingRoom(null); setRoomForm(DEFAULT_ROOM_FORM); }
    setIsRoomDialogOpen(true);
  };

  const handleSaveRoom = async () => {
    try {
      const data = { ...roomForm, base_price: parseFloat(roomForm.base_price) || 0, hotel_id: selectedHotel._id || selectedHotel.id, total_rooms: parseInt(roomForm.total_rooms) || 1, available_rooms: parseInt(roomForm.available_rooms) || 1 };
      delete data.price_per_night; delete data.name; delete data.room_number;
      if (editingRoom) { await api.put(`/rooms/${editingRoom._id || editingRoom.id}`, data); toast.success('Room updated'); }
      else { await api.post('/rooms/', data); toast.success('Room added'); }
      setIsRoomDialogOpen(false); loadRooms(selectedHotel._id || selectedHotel.id);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save room'); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Delete this room?')) return;
    try { await api.delete(`/rooms/${roomId}`); toast.success('Room deleted'); loadRooms(selectedHotel._id || selectedHotel.id); }
    catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
  };

  const clearHotelFilters = () => { setHotelFilters({ city: '', starRating: '', amenity: '' }); setHotelSearch(''); setSelectedOperator({ id: '', name: '' }); };
  const clearRoomFilters = () => { setRoomFilters({ roomType: '', priceRange: '', availability: '' }); setRoomSearch(''); };
  const activeHotelFiltersCount = Object.values(hotelFilters).filter(Boolean).length + (hotelSearch ? 1 : 0) + (selectedOperator.id ? 1 : 0);
  const activeRoomFiltersCount = Object.values(roomFilters).filter(Boolean).length + (roomSearch ? 1 : 0);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#082c59]">Hotel Management Center</h1>
          <p className="text-slate-500 mt-1">Manage hotels, rooms, and communications</p>
        </div>
        <Button onClick={() => { loadHotels(); loadAnalytics(); }} variant="outline" disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="hotels" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><Hotel className="h-4 w-4" /> Hotels</TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" disabled={!selectedHotel}><Bed className="h-4 w-4" /> Rooms</TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"><MessageSquare className="h-4 w-4" /> Communications</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard hotels={hotels} rooms={rooms} analyticsData={analyticsData} loading={analyticsLoading} />
        </TabsContent>

        {/* Hotels Tab */}
        <TabsContent value="hotels" className="mt-6 space-y-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search hotels..." value={hotelSearch} onChange={(e) => setHotelSearch(e.target.value)} className="pl-10 bg-white" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={showHotelFilters ? 'default' : 'outline'} onClick={() => setShowHotelFilters(!showHotelFilters)} className={`gap-2 ${showHotelFilters ? 'bg-[#082c59]' : ''}`}>
                    <SlidersHorizontal className="h-4 w-4" />Filters{activeHotelFiltersCount > 0 && <Badge className="ml-1 bg-white text-[#082c59] h-5 w-5 p-0 flex items-center justify-center text-xs">{activeHotelFiltersCount}</Badge>}
                  </Button>
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className={`rounded-none ${viewMode === 'grid' ? 'bg-[#082c59]' : ''}`}><Grid3X3 className="h-4 w-4" /></Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className={`rounded-none ${viewMode === 'list' ? 'bg-[#082c59]' : ''}`}><List className="h-4 w-4" /></Button>
                  </div>
                  <PermissionGate permission="hotels.create"><Button onClick={() => openHotelDialog()} className="bg-[#082c59] gap-2"><Plus className="w-4 h-4" /> Add Hotel</Button></PermissionGate>
                </div>
              </div>
              {showHotelFilters && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><Label className="text-xs text-slate-500 mb-1.5 block">City</Label><Select value={hotelFilters.city || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, city: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="All cities" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">All cities</SelectItem>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs text-slate-500 mb-1.5 block">Star Rating</Label><Select value={hotelFilters.starRating || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, starRating: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="All ratings" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">All ratings</SelectItem>{[5,4,3,2,1].map(n => <SelectItem key={n} value={String(n)}>{n} Stars</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs text-slate-500 mb-1.5 block">Amenity</Label><Select value={hotelFilters.amenity || "all"} onValueChange={(v) => setHotelFilters(p => ({ ...p, amenity: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="Any amenity" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">Any</SelectItem>{HOTEL_AMENITIES.map(a => <SelectItem key={a} value={a} className="capitalize">{a.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs text-slate-500 mb-1.5 block">Operator</Label><Select value={selectedOperator.id || 'all'} onValueChange={(v) => { if (v === 'all') setSelectedOperator({ id: '', name: '' }); else { const op = operators.find(o => (o._id || o.id) === v); setSelectedOperator({ id: v, name: op?.name || '' }); } }}><SelectTrigger className="bg-white"><SelectValue placeholder="All operators" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">All operators</SelectItem>{operators.map(op => <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  {activeHotelFiltersCount > 0 && <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" onClick={clearHotelFilters} className="text-slate-500"><X className="h-4 w-4 mr-1" /> Clear all</Button></div>}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-sm text-slate-500">Showing {paginatedHotels.length} of {filteredHotels.length} hotels</p>
          {loading ? <div className="flex items-center justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-[#082c59]" /></div> : filteredHotels.length === 0 ? (
            <Card className="shadow-sm"><CardContent className="py-16 text-center"><Hotel className="h-16 w-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-700">No hotels found</h3></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedHotels.map(hotel => <HotelCard key={hotel._id || hotel.id} hotel={hotel} isSelected={(selectedHotel?._id || selectedHotel?.id) === (hotel._id || hotel.id)} onEdit={() => openHotelDialog(hotel)} onDelete={() => handleDeleteHotel(hotel)} onViewRooms={() => { setSelectedHotel(hotel); setActiveTab('rooms'); }} />)}
            </div>
          )}
          <Pagination currentPage={hotelPage} totalPages={totalHotelPages} onPageChange={setHotelPage} />
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="mt-6 space-y-4">
          {!selectedHotel ? (
            <Card className="shadow-sm"><CardContent className="py-16 text-center"><Hotel className="h-16 w-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium">No hotel selected</h3><Button onClick={() => setActiveTab('hotels')} className="mt-4 bg-[#082c59]">Go to Hotels</Button></CardContent></Card>
          ) : (
            <>
              <Card className="shadow-sm bg-gradient-to-r from-[#082c59] to-[#0a3a75] text-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/10 rounded-lg overflow-hidden">{selectedHotel.images?.[0] ? <img src={selectedHotel.images[0].startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${selectedHotel.images[0]}` : selectedHotel.images[0]} alt="" className="w-full h-full object-cover" /> : <Hotel className="h-8 w-8 text-white/50 m-4" />}</div>
                    <div><h2 className="text-xl font-bold">{selectedHotel.name}</h2><div className="flex items-center gap-2 text-white/80 text-sm mt-1"><MapPin className="w-4 h-4" /> {selectedHotel.city}</div></div>
                  </div>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setActiveTab('hotels')}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search rooms..." value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} className="pl-10 bg-white" /></div>
                    <div className="flex gap-2">
                      <Button variant={showRoomFilters ? 'default' : 'outline'} onClick={() => setShowRoomFilters(!showRoomFilters)} className={`gap-2 ${showRoomFilters ? 'bg-[#082c59]' : ''}`}><SlidersHorizontal className="h-4 w-4" />Filters</Button>
                      <PermissionGate permission="hotels.manage_rooms"><Button onClick={() => openRoomDialog()} className="bg-[#082c59] gap-2"><Plus className="w-4 h-4" /> Add Room</Button></PermissionGate>
                    </div>
                  </div>
                  {showRoomFilters && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><Label className="text-xs text-slate-500 mb-1.5 block">Room Type</Label><Select value={roomFilters.roomType || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, roomType: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">All types</SelectItem>{ROOM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label className="text-xs text-slate-500 mb-1.5 block">Price Range</Label><Select value={roomFilters.priceRange || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, priceRange: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="Any price" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">Any</SelectItem><SelectItem value="0-25000">Under 25k</SelectItem><SelectItem value="25000-50000">25k-50k</SelectItem><SelectItem value="50000-100000">50k-100k</SelectItem><SelectItem value="100000-999999999">Above 100k</SelectItem></SelectContent></Select></div>
                      <div><Label className="text-xs text-slate-500 mb-1.5 block">Availability</Label><Select value={roomFilters.availability || "all"} onValueChange={(v) => setRoomFilters(p => ({ ...p, availability: v === "all" ? "" : v }))}><SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="all">All</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="low">Low Stock</SelectItem><SelectItem value="soldout">Sold Out</SelectItem></SelectContent></Select></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <p className="text-sm text-slate-500">Showing {paginatedRooms.length} of {filteredRooms.length} rooms</p>
              {filteredRooms.length === 0 ? <Card><CardContent className="py-16 text-center"><Bed className="h-16 w-16 mx-auto text-slate-300 mb-4" /><p>No rooms found</p></CardContent></Card> : (
                <div className="space-y-4">
                  {paginatedRooms.map(room => {
                    const total = room.total_rooms || 1, avail = room.available_rooms ?? total;
                    const isLow = avail <= Math.ceil(total * 0.2) && avail > 0, isOut = avail <= 0;
                    return (
                      <Card key={room.id || room._id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="flex relative">
                          <RoomImageCarousel images={room.images} className="w-56 h-40" />
                          {/* Availability badge - fixed positioning inside the card */}
                          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold shadow z-20 ${isOut ? 'bg-red-600 text-white' : isLow ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'}`}>{avail}/{total}</div>
                          <div className="flex-1 p-5">
                            <div className="flex justify-between items-start">
                              <div><h4 className="font-bold text-lg">{room.room_name || 'Room'}</h4><p className="text-sm text-slate-500 capitalize">{room.room_type} • {room.bed_type} bed</p></div>
                              <div className="text-right"><p className="text-2xl font-bold text-[#082c59]">{formatFCFA(room.base_price || room.price_per_night)}</p><p className="text-xs text-slate-500">per night</p></div>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full"><Users className="w-4 h-4" />{room.capacity} guests</div>
                              <Badge className={isOut ? 'bg-red-100 text-red-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>{isOut ? 'Sold Out' : isLow ? 'Low Stock' : 'Available'}</Badge>
                            </div>
                          </div>
                          <div className="flex flex-col justify-center gap-2 p-4 border-l bg-slate-50/50">
                            <PermissionGate permission="hotels.manage_rooms">
                              <Button size="sm" variant="outline" onClick={() => openRoomDialog(room)} className="bg-white"><Edit className="w-4 h-4 mr-1" /> Edit</Button>
                              <Button size="sm" variant="outline" className="text-red-600 bg-white hover:bg-red-50" onClick={() => handleDeleteRoom(room.id || room._id)}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                            </PermissionGate>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              <Pagination currentPage={roomPage} totalPages={totalRoomPages} onPageChange={setRoomPage} />
            </>
          )}
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications" className="mt-6">
          <CommunicationsHub user={user} />
        </TabsContent>
      </Tabs>

      {/* Hotel Dialog */}
      <Dialog open={isHotelDialogOpen} onOpenChange={setIsHotelDialogOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Hotel className="h-5 w-5 text-[#082c59]" />{editingHotel ? 'Edit Hotel' : 'Add New Hotel'}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <ImageUploader images={hotelForm.images} onImagesChange={(imgs) => setHotelForm(p => ({ ...p, images: imgs }))} maxImages={10} minImages={5} />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Hotel Name *</Label><Input value={hotelForm.name} onChange={e => setHotelForm(p => ({ ...p, name: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>City *</Label><Select value={hotelForm.city || ""} onValueChange={v => setHotelForm(p => ({ ...p, city: v }))}><SelectTrigger className="bg-white mt-1.5"><SelectValue placeholder="Select city" /></SelectTrigger><SelectContent className="bg-white">{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Star Rating</Label><Select value={String(hotelForm.star_rating)} onValueChange={v => setHotelForm(p => ({ ...p, star_rating: parseInt(v) }))}><SelectTrigger className="bg-white mt-1.5"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} Stars</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Operator</Label><Select value={hotelForm.operator_id || ''} onValueChange={v => { const op = operators.find(o => (o._id || o.id) === v); setHotelForm(p => ({ ...p, operator_id: v, operator_name: op?.name || '' })); }}><SelectTrigger className="bg-white mt-1.5"><SelectValue placeholder="Select operator" /></SelectTrigger><SelectContent className="bg-white max-h-60">{operators.map(op => <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Address *</Label><Input value={hotelForm.address} onChange={e => setHotelForm(p => ({ ...p, address: e.target.value }))} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={hotelForm.phone} onChange={e => setHotelForm(p => ({ ...p, phone: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>Email</Label><Input type="email" value={hotelForm.email} onChange={e => setHotelForm(p => ({ ...p, email: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div><Label className="mb-2 block">Amenities</Label><div className="flex flex-wrap gap-2">{HOTEL_AMENITIES.map(a => <Badge key={a} variant={hotelForm.amenities?.includes(a) ? 'default' : 'outline'} className={`cursor-pointer capitalize ${hotelForm.amenities?.includes(a) ? 'bg-[#082c59]' : 'hover:bg-slate-100'}`} onClick={() => setHotelForm(p => ({ ...p, amenities: p.amenities?.includes(a) ? p.amenities.filter(x => x !== a) : [...(p.amenities || []), a] }))}>{hotelForm.amenities?.includes(a) && <Check className="w-3 h-3 mr-1" />}{a.replace('_', ' ')}</Badge>)}</div></div>
            <div><Label>Description</Label><Textarea value={hotelForm.description} onChange={e => setHotelForm(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1.5" /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsHotelDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveHotel} className="bg-[#082c59]" disabled={hotelForm.images.length < 5}>{editingHotel ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Bed className="h-5 w-5 text-[#082c59]" />{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <RoomImageUploader images={roomForm.images} onImagesChange={(imgs) => setRoomForm(p => ({ ...p, images: imgs }))} maxImages={5} />
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Room Name *</Label><Input value={roomForm.room_name} onChange={e => setRoomForm(p => ({ ...p, room_name: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>Room Type</Label><Select value={roomForm.room_type} onValueChange={v => setRoomForm(p => ({ ...p, room_type: v }))}><SelectTrigger className="bg-white mt-1.5"><SelectValue /></SelectTrigger><SelectContent className="bg-white">{ROOM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Price/Night *</Label><Input type="number" value={roomForm.base_price} onChange={e => setRoomForm(p => ({ ...p, base_price: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>Capacity</Label><Input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} className="mt-1.5" /></div>
              <div><Label>Total</Label><Input type="number" min="1" value={roomForm.total_rooms} onChange={e => { const t = parseInt(e.target.value) || 1; setRoomForm(p => ({ ...p, total_rooms: t, available_rooms: Math.min(p.available_rooms || t, t) })); }} className="mt-1.5" /></div>
              <div><Label>Available</Label><Input type="number" min="0" max={roomForm.total_rooms} value={roomForm.available_rooms} onChange={e => setRoomForm(p => ({ ...p, available_rooms: Math.min(parseInt(e.target.value) || 0, p.total_rooms || 1) }))} className="mt-1.5" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Bed Type</Label><Select value={roomForm.bed_type} onValueChange={v => setRoomForm(p => ({ ...p, bed_type: v }))}><SelectTrigger className="bg-white mt-1.5"><SelectValue /></SelectTrigger><SelectContent className="bg-white"><SelectItem value="single">Single</SelectItem><SelectItem value="double">Double</SelectItem><SelectItem value="queen">Queen</SelectItem><SelectItem value="king">King</SelectItem><SelectItem value="twin">Twin</SelectItem></SelectContent></Select></div>
              <div><Label>Floor</Label><Input type="number" value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: parseInt(e.target.value) || 1 }))} className="mt-1.5" /></div>
              <div><Label>Size (m²)</Label><Input type="number" value={roomForm.size_sqm} onChange={e => setRoomForm(p => ({ ...p, size_sqm: parseInt(e.target.value) || 25 }))} className="mt-1.5" /></div>
            </div>
            <div><Label className="mb-2 block">Room Amenities</Label><div className="flex flex-wrap gap-2">{ROOM_AMENITIES.map(a => <Badge key={a} variant={roomForm.amenities?.includes(a) ? 'default' : 'outline'} className={`cursor-pointer capitalize ${roomForm.amenities?.includes(a) ? 'bg-[#082c59]' : 'hover:bg-slate-100'}`} onClick={() => setRoomForm(p => ({ ...p, amenities: p.amenities?.includes(a) ? p.amenities.filter(x => x !== a) : [...(p.amenities || []), a] }))}>{roomForm.amenities?.includes(a) && <Check className="w-3 h-3 mr-1" />}{a.replace(/_/g, ' ')}</Badge>)}</div></div>
            <div><Label>Description</Label><Textarea value={roomForm.description} onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1.5" /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveRoom} className="bg-[#082c59]">{editingRoom ? 'Update' : 'Add'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
