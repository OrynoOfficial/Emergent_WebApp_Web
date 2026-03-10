import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Bus, LayoutDashboard, MessageSquare, RefreshCw, Armchair, Plus, Edit, Trash2,
  MapPin, Clock, Users, ArrowRight, Eye, CheckCircle, Search, Filter, TrendingUp,
  DollarSign, Fuel, Settings, Wifi, Tv, Power, Coffee, Building2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { travelRouteApi, vehicleApi, operatorApi } from '@/api/management';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import { formatFCFA } from '@/utils/currency';
import PermissionGate from '@/components/common/PermissionGate';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import SeatLayoutEditor from '@/components/travel/SeatLayoutEditor';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';

// Travel-specific components
import { RouteForm, VehicleForm, ViewDetailsDialog } from '@/components/management/travel';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4'];

const DEFAULT_ROUTE_FORM = {
  from_city: '', to_city: '', departure_time: '', arrival_time: '',
  duration: '', price: '', vehicle_id: '', vehicle_name: '',
  vehicle_type: 'normal', total_seats: 0, amenities: [],
  valid_from: '', valid_to: ''
};

const DEFAULT_VEHICLE_FORM = {
  vehicle_name: '', vehicle_type: 'normal', plate_number: '',
  manufacturer: '', model: '', year: new Date().getFullYear(),
  amenities: [], maintenance_status: 'active', notes: ''
};

// Amenity icons
const AMENITY_ICONS = {
  wifi: Wifi, ac: Fuel, power_outlet: Power, restroom: Coffee, 
  tv_screen: Tv, reclining_seats: Armchair, refreshments: Coffee
};

// Dashboard data now fetched from API via useRealDashboardData hook

// Analytics Section Component for Dashboard
const TravelAnalyticsSection = ({ routes, vehicles }) => {
  const [analyticsData, setAnalyticsData] = useState({
    routeDistribution: [], vehicleUtilization: [], monthlyTrend: []
  });

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const res = await api.get('/travel/analytics/dashboard');
        const data = res.data;
        setAnalyticsData({
          monthlyTrend: data.monthly_trend || [],
          vehicleUtilization: data.vehicle_utilization || [],
          routeDistribution: (data.route_popularity || []).map((r, i) => ({
            name: r.route,
            value: r.bookings,
            color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6]
          }))
        });
      } catch {
        // Fallback to computed data from routes/vehicles
        const routesByCity = {};
        routes.forEach(r => {
          const city = r.from_city || 'Unknown';
          routesByCity[city] = (routesByCity[city] || 0) + 1;
        });
        setAnalyticsData({
          monthlyTrend: [],
          vehicleUtilization: vehicles.slice(0, 6).map((v, i) => ({
            name: v.vehicle_name?.substring(0, 10) || 'Vehicle',
            utilization: 0
          })),
          routeDistribution: Object.entries(routesByCity).map(([city, count], i) => ({
            name: city, value: count,
            color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5]
          }))
        });
      }
    };
    loadAnalytics();
  }, [routes, vehicles]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="shadow-lg lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Monthly Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis yAxisId="left" stroke="#3B82F6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Vehicle Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.vehicleUtilization} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={70} fontSize={11} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Modern Route Card Component
const RouteCard = ({ route, onView, onEdit, onDelete, onApprove, isAdmin }) => {
  const statusColors = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    inactive: 'bg-slate-100 text-slate-800 border-slate-200',
    suspended: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{route.from_city}</h3>
              <p className="text-blue-100 text-sm">{route.operator_name || 'Unknown Operator'}</p>
            </div>
          </div>
          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-6 h-6" />
            <span className="text-xs text-blue-200 mt-1">{route.duration || '---'}</span>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-lg">{route.to_city}</h3>
            <Badge className={`mt-1 ${statusColors[route.status] || statusColors.inactive}`}>
              {route.status || 'inactive'}
            </Badge>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <Clock className="w-4 h-4 mx-auto text-slate-500 mb-1" />
            <p className="text-xs text-slate-500">Departure</p>
            <p className="font-semibold text-sm">{route.departure_time || '--:--'}</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <Clock className="w-4 h-4 mx-auto text-slate-500 mb-1" />
            <p className="text-xs text-slate-500">Arrival</p>
            <p className="font-semibold text-sm">{route.arrival_time || '--:--'}</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <Users className="w-4 h-4 mx-auto text-slate-500 mb-1" />
            <p className="text-xs text-slate-500">Seats</p>
            <p className="font-semibold text-sm">{route.total_seats || 0}</p>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded-lg">
            <DollarSign className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
            <p className="text-xs text-slate-500">Price</p>
            <p className="font-bold text-sm text-emerald-600">{formatFCFA(route.price)}</p>
          </div>
        </div>

        {route.vehicle_name && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
            <Bus className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{route.vehicle_name}</span>
            <Badge variant="outline" className="ml-auto text-xs capitalize">{route.vehicle_type}</Badge>
          </div>
        )}

        {route.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {route.amenities.slice(0, 5).map(a => {
              const Icon = AMENITY_ICONS[a] || Settings;
              return (
                <div key={a} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs">
                  <Icon className="w-3 h-3" />
                  <span className="capitalize">{a.replace('_', ' ')}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => onView(route)} className="flex-1">
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          {isAdmin && route.status === 'pending' && (
            <PermissionGate permission="travel.approve">
              <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => onApprove(route.id)}>
                <CheckCircle className="w-4 h-4" />
              </Button>
            </PermissionGate>
          )}
          <PermissionGate permission="travel.edit">
            <Button size="sm" variant="outline" onClick={() => onEdit(route)}>
              <Edit className="w-4 h-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="travel.delete">
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(route.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
};

// Modern Vehicle Card Component with Images
const VehicleCard = ({ vehicle, onView, onEdit, onDelete }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;
  const images = vehicle.images?.filter(img => img) || [];
  
  const statusColors = {
    active: 'bg-emerald-500',
    maintenance: 'bg-amber-500',
    retired: 'bg-slate-400'
  };

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {images.length > 0 ? (
          <>
            <img 
              src={getImageUrl(images[currentImageIndex])} 
              alt={vehicle.vehicle_name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {images.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} 
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow z-10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow z-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {currentImageIndex + 1}/{images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Bus className="w-20 h-20 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className={`${statusColors[vehicle.maintenance_status]} text-white border-0`}>
            {vehicle.maintenance_status}
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="bg-white/90 capitalize">
            {vehicle.vehicle_type}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900">{vehicle.vehicle_name}</h3>
            <p className="text-sm text-slate-500">{vehicle.plate_number}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{vehicle.total_seats || '-'}</p>
            <p className="text-xs text-slate-500">seats</p>
          </div>
        </div>
        
        {/* Operator Assignment */}
        {vehicle.operator_name && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800 truncate">{vehicle.operator_name}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Manufacturer</p>
            <p className="font-medium text-sm truncate">{vehicle.manufacturer || 'N/A'}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Model/Year</p>
            <p className="font-medium text-sm truncate">{vehicle.model || 'N/A'} {vehicle.year}</p>
          </div>
        </div>

        {vehicle.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {vehicle.amenities.slice(0, 4).map(a => (
              <Badge key={a} variant="outline" className="text-xs capitalize">{a.replace('_', ' ')}</Badge>
            ))}
            {vehicle.amenities.length > 4 && (
              <Badge variant="outline" className="text-xs">+{vehicle.amenities.length - 4}</Badge>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => onView(vehicle)} className="flex-1">
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          <PermissionGate permission="travel.edit">
            <Button size="sm" variant="outline" onClick={() => onEdit(vehicle)}>
              <Edit className="w-4 h-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="travel.delete">
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(vehicle.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
};

export default function TravelManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search states
  const [routeSearch, setRouteSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Dialog states
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSeatLayoutOpen, setIsSeatLayoutOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('route');
  
  // Form states
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [routeForm, setRouteForm] = useState(DEFAULT_ROUTE_FORM);
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM);
  const [selectedOperator, setSelectedOperator] = useState({ id: '', name: '' });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const dashboardData = useRealDashboardData('travel');

  // Filtered data
  const filteredRoutes = useMemo(() => {
    if (!routeSearch) return routes;
    const s = routeSearch.toLowerCase();
    return routes.filter(r => 
      r.from_city?.toLowerCase().includes(s) || 
      r.to_city?.toLowerCase().includes(s) ||
      r.operator_name?.toLowerCase().includes(s)
    );
  }, [routes, routeSearch]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return vehicles;
    const s = vehicleSearch.toLowerCase();
    return vehicles.filter(v => 
      v.vehicle_name?.toLowerCase().includes(s) || 
      v.plate_number?.toLowerCase().includes(s)
    );
  }, [vehicles, vehicleSearch]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [routesRes, vehiclesRes] = await Promise.all([
        travelRouteApi.list(),
        vehicleApi.list()
      ]);
      setRoutes(routesRes.data.routes || []);
      setVehicles(vehiclesRes.data.vehicles || []);
      if (isAdmin) {
        try {
          const opRes = await operatorApi.list();
          setOperators(opRes.data.operators || []);
        } catch { /* ignore */ }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  // View item handler
  const handleViewItem = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(item.id, type === 'route' ? `${item.from_city} → ${item.to_city}` : item.vehicle_name);
  };

  // Route handlers
  const openRouteDialog = (route = null) => {
    if (route) {
      setEditingRoute(route);
      setRouteForm({ ...route, price: route.price?.toString() || '' });
      if (route.operator_id) setSelectedOperator({ id: route.operator_id, name: route.operator_name });
    } else {
      setEditingRoute(null);
      setRouteForm(DEFAULT_ROUTE_FORM);
      if (isOperator && user?.operator_id) {
        setSelectedOperator({ id: user.operator_id, name: user.operator_name || '' });
      }
    }
    setIsRouteDialogOpen(true);
  };

  const handleSaveRoute = async () => {
    try {
      const data = {
        ...routeForm,
        price: parseFloat(routeForm.price) || 0,
        operator_id: selectedOperator.id,
        operator_name: selectedOperator.name
      };
      if (editingRoute) {
        await travelRouteApi.update(editingRoute.id, data);
        toast.success('Route updated');
      } else {
        await travelRouteApi.create(data);
        toast.success('Route created');
      }
      setIsRouteDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save route');
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    try {
      await travelRouteApi.delete(routeId);
      toast.success('Route deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete route');
    }
  };

  const handleApproveRoute = async (routeId) => {
    try {
      await travelRouteApi.approve(routeId);
      toast.success('Route approved');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve route');
    }
  };

  // Vehicle handlers
  const openVehicleDialog = (vehicle = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setVehicleForm(vehicle);
    } else {
      setEditingVehicle(null);
      setVehicleForm(DEFAULT_VEHICLE_FORM);
    }
    setIsVehicleDialogOpen(true);
  };

  const handleSaveVehicle = async () => {
    try {
      const data = {
        ...vehicleForm,
        operator_id: selectedOperator.id || user?.operator_id,
        operator_name: selectedOperator.name || user?.operator_name
      };
      if (editingVehicle) {
        await vehicleApi.update(editingVehicle.id, data);
        toast.success('Vehicle updated');
      } else {
        await vehicleApi.create(data);
        toast.success('Vehicle created');
      }
      setIsVehicleDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vehicle');
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await vehicleApi.delete(vehicleId);
      toast.success('Vehicle deleted');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete vehicle');
    }
  };

  const handleVehicleSelect = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setRouteForm(prev => ({
        ...prev,
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.vehicle_name,
        vehicle_type: vehicle.vehicle_type,
        total_seats: vehicle.total_seats || 0,
        amenities: vehicle.amenities || [],
        seat_layout: vehicle.seat_layout
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bus className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Travel Management Center</h1>
                <p className="text-slate-500">Manage routes, vehicles, and communications</p>
              </div>
            </div>
            <Button onClick={loadData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="management">
              <Bus className="h-4 w-4 mr-2" /> Management
            </TabsTrigger>
            <TabsTrigger value="communications">
              <MessageSquare className="h-4 w-4 mr-2" /> Communications
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <ServiceExecutiveDashboard
              serviceType="Travel"
              serviceIcon={<Bus className="h-8 w-8" />}
              primaryColor="blue"
              stats={dashboardData.stats}
              bookingsByStatus={dashboardData.bookingsByStatus}
              dailyTrend={dashboardData.dailyTrend}
              distribution={dashboardData.distribution}
              itemLabel="Routes"
              secondaryLabel="Vehicles"
              secondaryCount={dashboardData.secondaryCount}
              analyticsSection={<TravelAnalyticsSection routes={routes} vehicles={vehicles} />}
            />
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management" className="mt-6">
            <Tabs defaultValue="routes" className="space-y-6">
              <div className="flex items-center justify-between">
                <TabsList className="bg-white border shadow-sm p-1 rounded-lg">
                  <TabsTrigger value="routes" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 rounded px-4 py-2">
                    Routes ({routes.length})
                  </TabsTrigger>
                  <TabsTrigger value="vehicles" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 rounded px-4 py-2">
                    Vehicles ({vehicles.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="routes" className="space-y-4">
                {/* Search and Add */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search routes..."
                      value={routeSearch}
                      onChange={(e) => setRouteSearch(e.target.value)}
                      className="pl-10 bg-white"
                    />
                  </div>
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openRouteDialog()} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" /> Add Route
                    </Button>
                  </PermissionGate>
                </div>

                {/* Routes Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : filteredRoutes.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No routes found</h3>
                    <p className="text-slate-500 mb-4">
                      {routeSearch ? 'Try adjusting your search' : 'Create your first route to get started'}
                    </p>
                    <Button onClick={() => openRouteDialog()} className="bg-blue-600">
                      <Plus className="w-4 h-4 mr-2" /> Add Route
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRoutes.map(route => (
                      <RouteCard
                        key={route.id}
                        route={route}
                        isAdmin={isAdmin}
                        onView={(r) => handleViewItem(r, 'route')}
                        onEdit={openRouteDialog}
                        onDelete={handleDeleteRoute}
                        onApprove={handleApproveRoute}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vehicles" className="space-y-4">
                {/* Search and Add */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search vehicles..."
                      value={vehicleSearch}
                      onChange={(e) => setVehicleSearch(e.target.value)}
                      className="pl-10 bg-white"
                    />
                  </div>
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openVehicleDialog()} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" /> Add Vehicle
                    </Button>
                  </PermissionGate>
                </div>

                {/* Vehicles Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No vehicles found</h3>
                    <p className="text-slate-500 mb-4">
                      {vehicleSearch ? 'Try adjusting your search' : 'Add your first vehicle to get started'}
                    </p>
                    <Button onClick={() => openVehicleDialog()} className="bg-blue-600">
                      <Plus className="w-4 h-4 mr-2" /> Add Vehicle
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredVehicles.map(vehicle => (
                      <VehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onView={(v) => handleViewItem(v, 'vehicle')}
                        onEdit={openVehicleDialog}
                        onDelete={handleDeleteVehicle}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="mt-6">
            <ServiceCommunicationsHub
              serviceType="Travel"
              serviceTag="travel"
              serviceIcon={<Bus className="h-5 w-5 text-blue-600" />}
              primaryColor="blue"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Route Dialog */}
      <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Edit Route' : 'Create Route'}</DialogTitle>
          </DialogHeader>
          <RouteForm
            form={routeForm}
            onChange={setRouteForm}
            operators={operators}
            vehicles={vehicles}
            isAdmin={isAdmin}
            selectedOperator={selectedOperator}
            onOperatorChange={setSelectedOperator}
            onVehicleSelect={handleVehicleSelect}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRouteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoute} className="bg-blue-600">{editingRoute ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Dialog */}
      <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <VehicleForm
            form={vehicleForm}
            onChange={setVehicleForm}
            onOpenSeatLayout={() => setIsSeatLayoutOpen(true)}
            operators={operators}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVehicle} className="bg-blue-600">{editingVehicle ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat Layout Editor Dialog */}
      <Dialog open={isSeatLayoutOpen} onOpenChange={setIsSeatLayoutOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-blue-600" />
              Configure Seat Layout
            </DialogTitle>
          </DialogHeader>
          <SeatLayoutEditor
            initialLayout={vehicleForm.seat_layout}
            onSave={(layout) => {
              setVehicleForm(p => ({ ...p, seat_layout: layout, total_seats: layout.total_seats }));
              setIsSeatLayoutOpen(false);
              toast.success(`Seat layout configured: ${layout.total_seats} seats`);
            }}
            onCancel={() => setIsSeatLayoutOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <ViewDetailsDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        item={viewingItem}
        type={viewingType}
        onEdit={(item) => viewingType === 'route' ? openRouteDialog(item) : openVehicleDialog(item)}
      />
    </div>
  );
}
