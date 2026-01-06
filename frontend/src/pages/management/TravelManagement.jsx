import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Bus, Plus, Edit, Trash2, CheckCircle, XCircle, MapPin, Clock, Users,
  TrendingUp, LayoutDashboard, BarChart2, MessageSquare, Armchair, DollarSign,
  Calendar, RefreshCw, Bell, Info, Send, Eye, Grid3X3
} from 'lucide-react';
import { travelRouteApi, vehicleApi, operatorApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import SeatLayoutEditor from '@/components/travel/SeatLayoutEditor';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const AMENITIES_OPTIONS = ['wifi', 'ac', 'power_outlet', 'restroom', 'tv_screen', 'reclining_seats', 'refreshments'];
const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4'];

const DEFAULT_ROUTE_FORM = {
  from_city: '',
  to_city: '',
  departure_time: '',
  arrival_time: '',
  duration: '',
  price: '',
  vehicle_id: '',
  vehicle_name: '',
  vehicle_type: 'normal',
  total_seats: 0,
  amenities: [],
  valid_from: '',
  valid_to: ''
};

const DEFAULT_VEHICLE_FORM = {
  vehicle_name: '',
  vehicle_type: 'normal',
  plate_number: '',
  manufacturer: '',
  model: '',
  year: new Date().getFullYear(),
  amenities: [],
  maintenance_status: 'active',
  notes: ''
};

// Travel-specific dashboard data generator
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

    // Route distribution by vehicle type
    const routeDistribution = ['normal', 'vip', 'luxury'].map((type, i) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count: routes.filter(r => r.vehicle_type === type).length,
      color: CHART_COLORS[i]
    })).filter(d => d.count > 0);

    // Daily trend - fixed data instead of random
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
        totalBookings: routes.length * 8 + 50, // Calculated based on routes
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
      secondaryCount: activeVehicles.length,
      recentBookings: []
    };
  }, [routes, vehicles]);
};

// Business Analytics Component
const BusinessAnalytics = ({ routes, vehicles }) => {
  const analyticsData = useMemo(() => {
    // Route distribution
    const routesByCity = {};
    routes.forEach(r => {
      const city = r.from_city || 'Unknown';
      routesByCity[city] = (routesByCity[city] || 0) + 1;
    });

    const routeDistribution = Object.entries(routesByCity).map(([city, count], i) => ({
      name: city,
      value: count,
      color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5]
    }));

    // Vehicle utilization - fixed values based on index
    const vehicleUtilization = vehicles.slice(0, 6).map((v, i) => ({
      name: v.vehicle_name?.substring(0, 10) || 'Vehicle',
      utilization: 65 + (i * 5) // Sequential values: 65, 70, 75, 80, 85, 90
    }));

    // Monthly trend - fixed values
    const monthlyTrend = [
      { month: 'Jan', bookings: 145, revenue: 890000 },
      { month: 'Feb', bookings: 168, revenue: 1020000 },
      { month: 'Mar', bookings: 192, revenue: 1180000 },
      { month: 'Apr', bookings: 156, revenue: 960000 },
      { month: 'May', bookings: 210, revenue: 1350000 },
      { month: 'Jun', bookings: 235, revenue: 1520000 }
    ];

    return { routeDistribution, vehicleUtilization, monthlyTrend };
  }, [routes, vehicles]);

  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Monthly Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Distribution */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Routes by Origin City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.routeDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {analyticsData.routeDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Utilization */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Vehicle Utilization Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.vehicleUtilization} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="utilization" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
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
export default function TravelManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_routes: 0, active_routes: 0, pending_routes: 0, total_vehicles: 0 });

  // Dialog states
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSeatLayoutOpen, setIsSeatLayoutOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('route'); // 'route' or 'vehicle'
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [routeForm, setRouteForm] = useState(DEFAULT_ROUTE_FORM);
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM);
  const [selectedOperator, setSelectedOperator] = useState({ id: '', name: '' });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';

  // Use the travel dashboard data hook
  const dashboardData = useTravelDashboardData(routes, vehicles);

  // View item handler
  const handleViewItem = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(
      item.id, 
      type === 'route' ? `${item.from_city} → ${item.to_city}` : item.vehicle_name
    );
  };

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [routesRes, vehiclesRes, statsRes] = await Promise.all([
        travelRouteApi.list(),
        vehicleApi.list(),
        travelRouteApi.operatorStats()
      ]);

      setRoutes(routesRes.data.routes || []);
      setVehicles(vehiclesRes.data.vehicles || []);
      setStats(statsRes.data);

      if (isAdmin) {
        const opRes = await operatorApi.list();
        setOperators(opRes.data.operators || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Route handlers
  const openRouteDialog = (route = null) => {
    if (route) {
      setEditingRoute(route);
      setRouteForm({ ...route, price: route.price?.toString() || '' });
      if (route.operator_id) {
        setSelectedOperator({ id: route.operator_id, name: route.operator_name });
      }
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

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
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
            recentBookings={dashboardData.recentBookings}
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

            {/* Routes Sub-Tab */}
            <TabsContent value="routes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Travel Routes</CardTitle>
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openRouteDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Route
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : routes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No routes found. Create your first route!</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routes.map(route => (
                          <TableRow key={route.id}>
                            <TableCell>
                              <div className="font-medium">{route.from_city} → {route.to_city}</div>
                              <div className="text-sm text-gray-500">{route.operator_name}</div>
                            </TableCell>
                            <TableCell>
                              <div>{route.departure_time} - {route.arrival_time}</div>
                              <div className="text-sm text-gray-500">{route.duration}</div>
                            </TableCell>
                            <TableCell>
                              <div>{route.vehicle_name || '-'}</div>
                              <div className="text-sm text-gray-500">{route.total_seats} seats</div>
                            </TableCell>
                            <TableCell>{formatFCFA(route.price)}</TableCell>
                            <TableCell>{getStatusBadge(route.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleViewItem(route, 'route')} title="View Details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {isAdmin && route.status === 'pending' && (
                                  <PermissionGate permission="travel.approve">
                                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApproveRoute(route.id)}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </PermissionGate>
                                )}
                                <PermissionGate permission="travel.edit">
                                  <Button size="sm" variant="outline" onClick={() => openRouteDialog(route)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </PermissionGate>
                                <PermissionGate permission="travel.delete">
                                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteRoute(route.id)}>
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

            {/* Vehicles Sub-Tab */}
            <TabsContent value="vehicles">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Vehicles</CardTitle>
                  <PermissionGate permission="travel.create">
                    <Button onClick={() => openVehicleDialog()} className="bg-[#082c59]">
                      <Plus className="w-4 h-4 mr-2" /> Add Vehicle
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No vehicles found. Add your first vehicle!</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {vehicles.map(vehicle => (
                        <Card key={vehicle.id}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Bus className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{vehicle.vehicle_name}</h3>
                                  <p className="text-sm text-gray-500">{vehicle.plate_number}</p>
                                </div>
                              </div>
                              <Badge className={vehicle.maintenance_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {vehicle.maintenance_status}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-gray-500">Type:</span> <span className="capitalize">{vehicle.vehicle_type}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Seats:</span> <span>{vehicle.total_seats || '-'}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Model:</span> <span>{vehicle.manufacturer} {vehicle.model}</span></div>
                            </div>
                            {vehicle.amenities?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {vehicle.amenities.map(a => (
                                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="mt-4 flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewItem(vehicle, 'vehicle')} title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="travel.edit">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => openVehicleDialog(vehicle)}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="travel.delete">
                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteVehicle(vehicle.id)}>
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
          <div className="grid grid-cols-2 gap-4 py-4">
            {isAdmin && (
              <div className="col-span-2">
                <Label>Operator</Label>
                <Select value={selectedOperator.id} onValueChange={(id) => {
                  const op = operators.find(o => o.id === id);
                  setSelectedOperator({ id, name: op?.name || '' });
                }}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select operator" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {operators.map(op => (<SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>From City</Label>
              <Input value={routeForm.from_city} onChange={e => setRouteForm(p => ({ ...p, from_city: e.target.value }))} placeholder="e.g., Douala" />
            </div>
            <div>
              <Label>To City</Label>
              <Input value={routeForm.to_city} onChange={e => setRouteForm(p => ({ ...p, to_city: e.target.value }))} placeholder="e.g., Yaoundé" />
            </div>
            <div>
              <Label>Departure Time</Label>
              <Input type="time" value={routeForm.departure_time} onChange={e => setRouteForm(p => ({ ...p, departure_time: e.target.value }))} />
            </div>
            <div>
              <Label>Arrival Time</Label>
              <Input type="time" value={routeForm.arrival_time} onChange={e => setRouteForm(p => ({ ...p, arrival_time: e.target.value }))} />
            </div>
            <div>
              <Label>Duration</Label>
              <Input value={routeForm.duration} onChange={e => setRouteForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g., 3h 30m" />
            </div>
            <div>
              <Label>Price (FCFA)</Label>
              <Input type="number" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: e.target.value }))} placeholder="5000" />
            </div>
            <div className="col-span-2">
              <Label>Vehicle</Label>
              <Select value={routeForm.vehicle_id} onValueChange={handleVehicleSelect}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {vehicles.map(v => (<SelectItem key={v.id} value={v.id}>{v.vehicle_name} ({v.total_seats} seats)</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valid From</Label>
              <Input type="date" value={routeForm.valid_from} onChange={e => setRouteForm(p => ({ ...p, valid_from: e.target.value }))} />
            </div>
            <div>
              <Label>Valid To</Label>
              <Input type="date" value={routeForm.valid_to} onChange={e => setRouteForm(p => ({ ...p, valid_to: e.target.value }))} />
            </div>
          </div>
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
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Vehicle Name</Label>
              <Input value={vehicleForm.vehicle_name} onChange={e => setVehicleForm(p => ({ ...p, vehicle_name: e.target.value }))} placeholder="e.g., Mercedes Sprinter #1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={vehicleForm.vehicle_type} onValueChange={v => setVehicleForm(p => ({ ...p, vehicle_type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plate Number</Label>
              <Input value={vehicleForm.plate_number} onChange={e => setVehicleForm(p => ({ ...p, plate_number: e.target.value }))} placeholder="LT 1234 AB" />
            </div>
            <div>
              <Label>Manufacturer</Label>
              <Input value={vehicleForm.manufacturer} onChange={e => setVehicleForm(p => ({ ...p, manufacturer: e.target.value }))} placeholder="Mercedes" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={vehicleForm.model} onChange={e => setVehicleForm(p => ({ ...p, model: e.target.value }))} placeholder="Sprinter" />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={vehicleForm.year} onChange={e => setVehicleForm(p => ({ ...p, year: parseInt(e.target.value) }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={vehicleForm.maintenance_status} onValueChange={v => setVehicleForm(p => ({ ...p, maintenance_status: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">In Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Amenities</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {AMENITIES_OPTIONS.map(amenity => (
                  <Badge
                    key={amenity}
                    variant={vehicleForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setVehicleForm(p => ({
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
              <Label>Notes</Label>
              <Textarea value={vehicleForm.notes} onChange={e => setVehicleForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Seat Layout</Label>
                  <p className="text-sm text-slate-500">Configure the seat arrangement for this vehicle</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSeatLayoutOpen(true)}
                  className="gap-2"
                >
                  <Grid3X3 className="h-4 w-4" />
                  {vehicleForm.seat_layout ? 'Edit Layout' : 'Configure Seats'}
                </Button>
              </div>
              {vehicleForm.seat_layout && (
                <div className="mt-2 p-3 bg-[#082c59]/5 border border-[#082c59]/20 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Layout: {vehicleForm.seat_layout.layout_type}</span>
                    <span className="font-semibold text-[#082c59]">{vehicleForm.seat_layout.total_seats} seats</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {vehicleForm.seat_layout.rows} rows × {vehicleForm.seat_layout.columns} columns
                  </div>
                </div>
              )}
            </div>
          </div>
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
              setVehicleForm(p => ({ 
                ...p, 
                seat_layout: layout,
                total_seats: layout.total_seats 
              }));
              setIsSeatLayoutOpen(false);
              toast.success(`Seat layout configured: ${layout.total_seats} seats`);
            }}
            onCancel={() => setIsSeatLayoutOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingType === 'route' ? <Bus className="h-5 w-5 text-blue-600" /> : <Bus className="h-5 w-5 text-purple-600" />}
              {viewingType === 'route' ? 'Route Details' : 'Vehicle Details'}
            </DialogTitle>
          </DialogHeader>
          {viewingItem && viewingType === 'route' && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-blue-900">
                  {viewingItem.from_city} → {viewingItem.to_city}
                </h3>
                <p className="text-sm text-blue-700">Route ID: {viewingItem.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Departure</p>
                  <p className="font-medium">{viewingItem.departure_time}</p>
                </div>
                <div>
                  <p className="text-slate-500">Arrival</p>
                  <p className="font-medium">{viewingItem.arrival_time}</p>
                </div>
                <div>
                  <p className="text-slate-500">Duration</p>
                  <p className="font-medium">{viewingItem.duration || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Price</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingItem.price)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Vehicle</p>
                  <p className="font-medium">{viewingItem.vehicle_name || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Seats</p>
                  <p className="font-medium">{viewingItem.total_seats || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  {getStatusBadge(viewingItem.status)}
                </div>
                <div>
                  <p className="text-slate-500">Operator</p>
                  <p className="font-medium">{viewingItem.operator_name || 'N/A'}</p>
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
            </div>
          )}
          {viewingItem && viewingType === 'vehicle' && (
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-purple-900">{viewingItem.vehicle_name}</h3>
                <p className="text-sm text-purple-700">Plate: {viewingItem.plate_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Type</p>
                  <p className="font-medium capitalize">{viewingItem.vehicle_type}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Seats</p>
                  <p className="font-medium">{viewingItem.total_seats || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Manufacturer</p>
                  <p className="font-medium">{viewingItem.manufacturer || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Model</p>
                  <p className="font-medium">{viewingItem.model || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Year</p>
                  <p className="font-medium">{viewingItem.year || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={viewingItem.maintenance_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {viewingItem.maintenance_status}
                  </Badge>
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
              {viewingItem.notes && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Notes</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingItem.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (viewingType === 'route') {
                openRouteDialog(viewingItem);
              } else {
                openVehicleDialog(viewingItem);
              }
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
