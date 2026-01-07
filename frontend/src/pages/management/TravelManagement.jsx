import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, LayoutDashboard, BarChart2, MessageSquare, RefreshCw, Armchair } from 'lucide-react';
import { travelRouteApi, vehicleApi, operatorApi } from '@/api/management';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import SeatLayoutEditor from '@/components/travel/SeatLayoutEditor';

// Travel-specific components
import { 
  RouteTable, 
  VehicleGrid, 
  RouteForm, 
  VehicleForm, 
  ViewDetailsDialog, 
  BusinessAnalytics 
} from '@/components/management/travel';

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

// Dashboard data generator hook
const useTravelDashboardData = (routes, vehicles) => {
  return useMemo(() => {
    const activeRoutes = routes.filter(r => r.status === 'active');
    const activeVehicles = vehicles.filter(v => v.maintenance_status === 'active');
    const totalRevenue = activeRoutes.reduce((sum, r) => sum + (r.price || 0) * 10, 0);
    const avgOccupancy = activeRoutes.length > 0 
      ? Math.round(activeRoutes.reduce((sum, r) => {
          const occupied = (r.total_seats || 0) - (r.available_seats || 0);
          return sum + (r.total_seats > 0 ? (occupied / r.total_seats) * 100 : 0);
        }, 0) / activeRoutes.length)
      : 0;

    const routeDistribution = ['normal', 'vip', 'luxury'].map((type, i) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count: routes.filter(r => r.vehicle_type === type).length,
      color: CHART_COLORS[i]
    })).filter(d => d.count > 0);

    const dailyTrend = [
      { date: 'Mon', bookings: 25, revenue: 380000 },
      { date: 'Tue', bookings: 32, revenue: 450000 },
      { date: 'Wed', bookings: 28, revenue: 420000 },
      { date: 'Thu', bookings: 38, revenue: 580000 },
      { date: 'Fri', bookings: 45, revenue: 720000 },
      { date: 'Sat', bookings: 52, revenue: 850000 },
      { date: 'Sun', bookings: 35, revenue: 540000 }
    ];

    return {
      stats: {
        totalItems: routes.length,
        activeItems: activeRoutes.length,
        totalBookings: routes.length * 8 + 50,
        totalRevenue,
        avgRating: 4.2,
        occupancyRate: avgOccupancy,
        bookingsGrowth: 12.5,
        revenueGrowth: 8.3
      },
      bookingsByStatus: {
        confirmed: Math.max(35, routes.length * 3),
        pending: Math.max(10, routes.length),
        cancelled: 3,
        completed: Math.max(25, routes.length * 2)
      },
      dailyTrend,
      distribution: routeDistribution,
      secondaryCount: activeVehicles.length
    };
  }, [routes, vehicles]);
};

export default function TravelManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const dashboardData = useTravelDashboardData(routes, vehicles);

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Travel Management Center</h1>
          <p className="text-gray-600">Manage routes, vehicles, analytics, and communications</p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Bus className="h-4 w-4" /> Management
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
          />
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="mt-6">
          <Tabs defaultValue="routes">
            <TabsList>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            </TabsList>

            <TabsContent value="routes">
              <RouteTable
                routes={routes}
                loading={loading}
                isAdmin={isAdmin}
                onAdd={() => openRouteDialog()}
                onView={(route) => handleViewItem(route, 'route')}
                onEdit={openRouteDialog}
                onDelete={handleDeleteRoute}
                onApprove={handleApproveRoute}
              />
            </TabsContent>

            <TabsContent value="vehicles">
              <VehicleGrid
                vehicles={vehicles}
                loading={loading}
                onAdd={() => openVehicleDialog()}
                onView={(vehicle) => handleViewItem(vehicle, 'vehicle')}
                onEdit={openVehicleDialog}
                onDelete={handleDeleteVehicle}
              />
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics routes={routes} vehicles={vehicles} />
        </TabsContent>
      </Tabs>

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
            <Button onClick={handleSaveRoute} className="bg-[#082c59]">{editingRoute ? 'Update' : 'Create'}</Button>
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
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVehicle} className="bg-[#082c59]">{editingVehicle ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat Layout Editor Dialog */}
      <Dialog open={isSeatLayoutOpen} onOpenChange={setIsSeatLayoutOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-[#082c59]" />
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
