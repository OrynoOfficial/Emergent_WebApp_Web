import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Bus, LayoutDashboard, MessageSquare, RefreshCw, Armchair, Plus, Edit, Trash2,
  MapPin, Clock, Users, ArrowRight, Eye, CheckCircle, Search, Filter, TrendingUp,
  DollarSign, Fuel, Settings, Wifi, Tv, Power, Coffee, Building2, ChevronLeft, ChevronRight,
  Receipt, Banknote, Replace as ReplaceIcon
} from 'lucide-react';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import { travelRouteApi, vehicleApi, operatorApi } from '@/api/management';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import { formatFCFA } from '@/utils/currency';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import SeatLayoutEditor from '@/components/travel/SeatLayoutEditor';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';

// Travel-specific components
import { RouteForm, VehicleForm, ViewDetailsDialog } from '@/components/management/travel';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Replace } from 'lucide-react';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';

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
          vehicleUtilization: vehicles.slice(0, 6).map((v) => ({
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
const VehicleCard = ({ vehicle, onView, onEdit, onDelete, onReplace }) => {
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
            <Button size="sm" variant="outline" onClick={() => onReplace?.(vehicle)} title="Replace on all active bookings" className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`replace-vehicle-btn-${vehicle.id}`}>
              <ReplaceIcon className="w-4 h-4" />
            </Button>
          </PermissionGate>
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

  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [replaceVehicle, setReplaceVehicle] = useState(null);

  // View modes + filters + pagination per tab (Routes / Vehicles)
  const [routeViewMode, setRouteViewMode] = useState('grid');   // 'grid' | 'list' | 'details'
  const [routeStatusFilter, setRouteStatusFilter] = useState('all'); // all | active | inactive
  const [routePage, setRoutePage] = useState(1);
  const [vehicleViewMode, setVehicleViewMode] = useState('grid');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('all'); // all | active | maintenance | retired
  const [vehiclePage, setVehiclePage] = useState(1);
  const PAGE_SIZE = 12;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const dashboardData = useRealDashboardData('travel', '30days', scopeOperatorId);

  // Filtered data
  const filteredRoutes = useMemo(() => {
    let r = routes;
    if (routeSearch) {
      const s = routeSearch.toLowerCase();
      r = r.filter(x =>
        x.from_city?.toLowerCase().includes(s) ||
        x.to_city?.toLowerCase().includes(s) ||
        x.operator_name?.toLowerCase().includes(s)
      );
    }
    if (routeStatusFilter !== 'all') {
      r = r.filter(x => (routeStatusFilter === 'active' ? x.is_active !== false : x.is_active === false));
    }
    return r;
  }, [routes, routeSearch, routeStatusFilter]);

  const filteredVehicles = useMemo(() => {
    let v = vehicles;
    if (vehicleSearch) {
      const s = vehicleSearch.toLowerCase();
      v = v.filter(x =>
        x.vehicle_name?.toLowerCase().includes(s) ||
        x.plate_number?.toLowerCase().includes(s)
      );
    }
    if (vehicleStatusFilter !== 'all') {
      v = v.filter(x => (x.status || 'active') === vehicleStatusFilter);
    }
    return v;
  }, [vehicles, vehicleSearch, vehicleStatusFilter]);

  // Pagination slices — reset to page 1 whenever filters change
  useEffect(() => { setRoutePage(1); }, [routeSearch, routeStatusFilter]);
  useEffect(() => { setVehiclePage(1); }, [vehicleSearch, vehicleStatusFilter]);
  const routeTotalPages = Math.max(1, Math.ceil(filteredRoutes.length / PAGE_SIZE));
  const vehicleTotalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const pagedRoutes = useMemo(() => filteredRoutes.slice((routePage - 1) * PAGE_SIZE, routePage * PAGE_SIZE), [filteredRoutes, routePage]);
  const pagedVehicles = useMemo(() => filteredVehicles.slice((vehiclePage - 1) * PAGE_SIZE, vehiclePage * PAGE_SIZE), [filteredVehicles, vehiclePage]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const routeParams = scopeOperatorId ? { operator_id: scopeOperatorId } : {};
      const [routesRes, vehiclesRes] = await Promise.all([
        travelRouteApi.list(routeParams),
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
  }, [isAdmin, scopeOperatorId]);

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
      // Operators cannot send status changes — strip it
      if (!isAdmin) {
        delete data.status;
      }
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
      <ManagementShell
        title="Travel Management Center"
        icon={Bus}
        subtitle="Manage routes, vehicles, and communications"
        scopeFilter={<OperatorScopeFilter serviceType="travel" value={scopeOperatorId} onChange={setScopeOperatorId} />}
        onRefresh={loadData}
        refreshing={loading}
        tabs={[
          { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { value: 'management', label: 'Management', icon: Bus },
          { value: 'communications', label: 'Communications', icon: MessageSquare },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        testIdPrefix="travel-mgmt"
      >

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
              recentBookingsSlot={
                <OperatorBookingsList serviceType="travel" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
              }
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
                <SubpageCard title="Routes" icon={MapPin} iconColorClass="text-blue-600" count={filteredRoutes.length} testId="travel-mgmt-subpage-card-routes">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search routes…"
                      value={routeSearch}
                      onChange={(e) => setRouteSearch(e.target.value)}
                      className="pl-9 h-8 bg-white text-sm"
                      data-testid="routes-search-input"
                    />
                  </div>
                  <Select value={routeStatusFilter} onValueChange={setRouteStatusFilter}>
                    <SelectTrigger className="w-32 h-8 bg-white text-sm" data-testid="routes-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <ViewModeToggle value={routeViewMode} onChange={setRouteViewMode} />
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openRouteDialog()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8" data-testid="add-route-btn">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Route
                    </Button>
                  </PermissionGate>
                </SubpageCard>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : filteredRoutes.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No routes found</h3>
                    <p className="text-slate-500 mb-4">
                      {routeSearch || routeStatusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first route to get started'}
                    </p>
                    <Button onClick={() => openRouteDialog()} className="bg-blue-600">
                      <Plus className="w-4 h-4 mr-2" /> Add Route
                    </Button>
                  </Card>
                ) : routeViewMode === 'list' ? (
                  /* List view — compact table for power users */
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Route</th>
                            <th className="px-4 py-3">Departure</th>
                            <th className="px-4 py-3">Arrival</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3">Vehicle</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRoutes.map((route) => (
                            <tr key={route.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{route.from_city} → {route.to_city}</td>
                              <td className="px-4 py-3 text-slate-700">{route.departure_time || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{route.arrival_time || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{route.price ? `${Number(route.price).toLocaleString()} FCFA` : '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{route.vehicle_name || '—'}</td>
                              <td className="px-4 py-3">
                                <Badge variant={route.is_active === false ? 'secondary' : 'default'} className={route.is_active === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}>
                                  {route.is_active === false ? 'Inactive' : 'Active'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button size="sm" variant="ghost" onClick={() => handleViewItem(route, 'route')} data-testid={`route-view-${route.id}`}>View</Button>
                                  <Button size="sm" variant="ghost" onClick={() => openRouteDialog(route)}>Edit</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : routeViewMode === 'details' ? (
                  /* Details view — single column, larger cards with full info */
                  <div className="space-y-4">
                    {pagedRoutes.map(route => (
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
                ) : (
                  /* Grid view (default) */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pagedRoutes.map(route => (
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

                <Pagination
                  page={routePage}
                  totalPages={routeTotalPages}
                  onChange={setRoutePage}
                  total={filteredRoutes.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="route"
                />
              </TabsContent>

              <TabsContent value="vehicles" className="space-y-4">
                <SubpageCard title="Vehicles" icon={Bus} iconColorClass="text-blue-600" count={filteredVehicles.length} testId="travel-mgmt-subpage-card-vehicles">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search vehicles…"
                      value={vehicleSearch}
                      onChange={(e) => setVehicleSearch(e.target.value)}
                      className="pl-9 h-8 bg-white text-sm"
                      data-testid="vehicles-search-input"
                    />
                  </div>
                  <Select value={vehicleStatusFilter} onValueChange={setVehicleStatusFilter}>
                    <SelectTrigger className="w-32 h-8 bg-white text-sm" data-testid="vehicles-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                  <ViewModeToggle value={vehicleViewMode} onChange={setVehicleViewMode} />
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openVehicleDialog()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8" data-testid="add-vehicle-btn">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Vehicle
                    </Button>
                  </PermissionGate>
                </SubpageCard>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : filteredVehicles.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Bus className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No vehicles found</h3>
                    <p className="text-slate-500 mb-4">
                      {vehicleSearch || vehicleStatusFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first vehicle to get started'}
                    </p>
                    <Button onClick={() => openVehicleDialog()} className="bg-blue-600">
                      <Plus className="w-4 h-4 mr-2" /> Add Vehicle
                    </Button>
                  </Card>
                ) : vehicleViewMode === 'list' ? (
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Vehicle</th>
                            <th className="px-4 py-3">Plate</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Capacity</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedVehicles.map((vehicle) => (
                            <tr key={vehicle.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{vehicle.vehicle_name || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{vehicle.plate_number || '—'}</td>
                              <td className="px-4 py-3 text-slate-700 capitalize">{vehicle.vehicle_type || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{vehicle.capacity ?? '—'}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="capitalize">{vehicle.status || 'active'}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button size="sm" variant="ghost" onClick={() => handleViewItem(vehicle, 'vehicle')} data-testid={`vehicle-view-${vehicle.id}`}>View</Button>
                                  <Button size="sm" variant="ghost" onClick={() => openVehicleDialog(vehicle)}>Edit</Button>
                                  <Button size="sm" variant="ghost" className="text-[#082c59] hover:bg-[#082c59]/10" onClick={() => setReplaceVehicle(vehicle)} title="Replace on all active bookings" data-testid={`replace-vehicle-btn-${vehicle.id}`}>
                                    <Replace className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : vehicleViewMode === 'details' ? (
                  <div className="space-y-4">
                    {pagedVehicles.map(vehicle => (
                      <VehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onView={(v) => handleViewItem(v, 'vehicle')}
                        onEdit={openVehicleDialog}
                        onDelete={handleDeleteVehicle}
                        onReplace={setReplaceVehicle}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pagedVehicles.map(vehicle => (
                      <VehicleCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        onView={(v) => handleViewItem(v, 'vehicle')}
                        onEdit={openVehicleDialog}
                        onDelete={handleDeleteVehicle}
                        onReplace={setReplaceVehicle}
                      />
                    ))}
                  </div>
                )}

                <Pagination
                  page={vehiclePage}
                  totalPages={vehicleTotalPages}
                  onChange={setVehiclePage}
                  total={filteredVehicles.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="vehicle"
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="mt-6">
            <ServiceCommunicationsHub
              serviceType="Travel"
              serviceTag="travel"
              operatorId={scopeOperatorId}
              serviceIcon={<Bus className="h-5 w-5 text-blue-600" />}
              primaryColor="blue"
            />
          </TabsContent>
        </ManagementShell>

      {/* Route Dialog */}
      <ServiceFormShell
        open={isRouteDialogOpen}
        onOpenChange={setIsRouteDialogOpen}
        icon={Bus}
        title={editingRoute ? 'Edit Route' : 'Create Route'}
        subtitle={editingRoute
          ? 'Update timings, pricing, vehicle assignment and amenities.'
          : 'Define a new travel route — origin, destination, schedule and vehicle.'}
        editing={!!editingRoute}
        accent="blue"
        leftColumn={
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
        }
        preview={
          <GenericPreviewCard
            cover={null}
            icon={Bus}
            badgeText="Travel"
            badgeClass="bg-blue-500 text-white"
            placeholderColor="from-blue-700 via-blue-600 to-sky-500"
            title={routeForm.from_city && routeForm.to_city ? `${routeForm.from_city} → ${routeForm.to_city}` : 'Origin → Destination'}
            subtitle={routeForm.vehicle_name || (routeForm.vehicle_type ? `${routeForm.vehicle_type} vehicle` : 'No vehicle assigned')}
            location={routeForm.departure_time && routeForm.arrival_time ? `🕐 ${routeForm.departure_time} – ${routeForm.arrival_time}` : 'Schedule pending'}
            tags={routeForm.amenities || []}
            tagsAccentClass="bg-blue-50 text-blue-700"
            priceLabel="Per-seat price"
            priceValue={routeForm.price ? `${Number(routeForm.price).toLocaleString()} FCFA` : '—'}
            accentTextClass="text-blue-700"
          />
        }
        submitting={false}
        submitLabel={editingRoute ? 'Update Route' : 'Create Route'}
        onSubmit={handleSaveRoute}
        submitDataTestId="save-route-btn"
      />

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

      {/* Walk-in Booking Modal */}

      {/* Replace Resource Modal */}
      <ReplaceResourceModal
        open={!!replaceVehicle}
        onClose={() => setReplaceVehicle(null)}
        serviceType="travel"
        oldResource={replaceVehicle}
        allResources={vehicles}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadData?.();
        }}
      />
    </div>
  );
}
