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
  Car, Plus, Edit, Trash2, MapPin, Calendar, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Info, Fuel, Settings, Key, Eye
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

const CHART_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const CAR_FEATURES = ['ac', 'gps', 'bluetooth', 'sunroof', 'leather_seats', 'backup_camera', 'cruise_control', 'heated_seats'];
const CAR_TYPES = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'sports', 'van', 'pickup'];

const DEFAULT_CAR_FORM = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  vehicle_type: 'sedan',
  seats: 5,
  doors: 4,
  transmission: 'automatic',
  fuel_type: 'petrol',
  price_per_day: '',
  price_per_hour: '',
  city: '',
  features: [],
  images: [],
  is_available: true,
  operator_id: '',
  operator_name: ''
};

// Car Rental specific dashboard data generator
const useCarRentalDashboardData = (cars) => {
  return useMemo(() => {
    const totalCars = cars.length;
    const availableCars = cars.filter(c => c.is_available).length;
    const totalRevenue = cars.reduce((sum, c) => sum + (c.price_per_day || 0) * 8, 0);
    const utilization = totalCars > 0 ? Math.round(((totalCars - availableCars) / totalCars) * 100) : 0;

    // Type distribution
    const typeCount = {};
    cars.forEach(c => {
      const type = c.car_type || 'sedan';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    const distribution = Object.entries(typeCount).slice(0, 5).map(([type, count], i) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
      color: CHART_COLORS[i]
    }));

    // Daily trend - fixed data
    const dailyTrend = [
      { date: 'Mon', bookings: 12, revenue: 180000 },
      { date: 'Tue', bookings: 15, revenue: 220000 },
      { date: 'Wed', bookings: 18, revenue: 280000 },
      { date: 'Thu', bookings: 22, revenue: 350000 },
      { date: 'Fri', bookings: 28, revenue: 450000 },
      { date: 'Sat', bookings: 35, revenue: 580000 },
      { date: 'Sun', bookings: 25, revenue: 420000 }
    ];

    return {
      stats: {
        totalItems: totalCars,
        activeItems: availableCars,
        totalBookings: totalCars * 6 + 25,
        totalRevenue: totalRevenue || totalCars * 180000,
        avgRating: 4.3,
        occupancyRate: utilization,
        bookingsGrowth: 18.5,
        revenueGrowth: 14.2
      },
      bookingsByStatus: {
        confirmed: Math.max(28, totalCars * 3),
        pending: Math.max(8, totalCars),
        cancelled: 2,
        completed: Math.max(22, totalCars * 2)
      },
      dailyTrend,
      distribution,
      secondaryCount: availableCars,
      recentBookings: []
    };
  }, [cars]);
};

// Business Analytics
const BusinessAnalytics = ({ cars }) => {
  const analyticsData = useMemo(() => {
    const cityData = {};
    cars.forEach(c => {
      const city = c.city || 'Unknown';
      cityData[city] = (cityData[city] || 0) + 1;
    });

    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', bookings: 65, revenue: 980000 },
      { month: 'Feb', bookings: 78, revenue: 1180000 },
      { month: 'Mar', bookings: 92, revenue: 1420000 },
      { month: 'Apr', bookings: 85, revenue: 1280000 },
      { month: 'May', bookings: 110, revenue: 1750000 },
      { month: 'Jun', bookings: 125, revenue: 2050000 }
    ];

    return {
      cityData: Object.entries(cityData).map(([name, value], i) => ({
        name, value, color: CHART_COLORS[i % CHART_COLORS.length]
      })),
      monthlyTrend
    };
  }, [cars]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#22C55E" strokeWidth={2} name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Fleet by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#22C55E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Component
export default function CarRentalManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cars, setCars] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCarDialogOpen, setIsCarDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingCar, setViewingCar] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [carForm, setCarForm] = useState(DEFAULT_CAR_FORM);

  // Use the car rental dashboard data hook
  const dashboardData = useCarRentalDashboardData(cars);

  const handleViewCar = (car) => {
    setViewingCar(car);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(car.id, `${car.brand} ${car.model}`);
  };

  const loadCars = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/car-rental/');
      setCars(res.data.cars || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load cars:', error);
      setCars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  const openCarDialog = (car = null) => {
    if (car) {
      setEditingCar(car);
      setCarForm({ 
        ...car, 
        price_per_day: car.price_per_day?.toString() || '',
        operator_id: car.operator_id || '',
        operator_name: car.operator_name || ''
      });
    } else {
      setEditingCar(null);
      setCarForm(DEFAULT_CAR_FORM);
    }
    setIsCarDialogOpen(true);
  };

  const handleSaveCar = async () => {
    try {
      // Find operator name if only ID is set
      const operator = operators.find(op => (op._id || op.id) === carForm.operator_id);
      const data = { 
        ...carForm, 
        price_per_day: parseFloat(carForm.price_per_day) || 0,
        price_per_hour: carForm.price_per_hour ? parseFloat(carForm.price_per_hour) : null,
        year: parseInt(carForm.year) || new Date().getFullYear(),
        seats: parseInt(carForm.seats) || 5,
        doors: parseInt(carForm.doors) || 4,
        operator_name: operator?.name || carForm.operator_name || ''
      };
      const carId = editingCar?._id || editingCar?.id;
      if (editingCar) {
        await api.put(`/car-rental/${carId}`, data);
        toast.success('Car updated');
      } else {
        await api.post('/car-rental/', data);
        toast.success('Car added');
      }
      setIsCarDialogOpen(false);
      loadCars();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteCar = async (car) => {
    const carId = car._id || car.id;
    if (!confirm('Delete this car?')) return;
    try {
      await api.delete(`/car-rental/${carId}`);
      toast.success('Car deleted');
      loadCars();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Car Rental Management Center</h1>
          <p className="text-gray-600">Manage fleet, bookings, analytics, and communications</p>
        </div>
        <Button onClick={loadCars} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Car className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Car Rental"
            serviceIcon={<Car className="h-8 w-8" />}
            primaryColor="green"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Vehicles"
            secondaryLabel="Available"
            secondaryCount={dashboardData.secondaryCount}
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fleet Management</CardTitle>
              <PermissionGate permission="car_rental.create">
                <Button onClick={() => openCarDialog()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> Add Car
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : cars.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No cars found. Add your first car!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cars.map(car => (
                    <Card key={car._id || car.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold">{car.brand} {car.model}</h3>
                            <p className="text-sm text-gray-500">{car.year} • {car.car_type}</p>
                          </div>
                          <Badge className={car.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {car.is_available ? 'Available' : 'Rented'}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{car.city}</div>
                          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />{car.seats} seats</div>
                          <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-gray-400" />{car.fuel_type}</div>
                        </div>
                        <div className="mt-3 font-bold text-green-600">{formatFCFA(car.price_per_day)}/day</div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewCar(car)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <PermissionGate permission="car_rental.edit">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openCarDialog(car)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="car_rental.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteCar(car)}>
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

        <TabsContent value="communications" className="mt-6">
          <CommunicationsHub user={user} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics cars={cars} />
        </TabsContent>
      </Tabs>

      {/* Car Dialog */}
      <Dialog open={isCarDialogOpen} onOpenChange={setIsCarDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCar ? 'Edit Car' : 'Add Car'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label>Brand</Label>
              <Input value={carForm.brand} onChange={e => setCarForm(p => ({ ...p, brand: e.target.value }))} placeholder="Toyota" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={carForm.model} onChange={e => setCarForm(p => ({ ...p, model: e.target.value }))} placeholder="Corolla" />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={carForm.year} onChange={e => setCarForm(p => ({ ...p, year: parseInt(e.target.value) }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={carForm.car_type} onValueChange={v => setCarForm(p => ({ ...p, car_type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {CAR_TYPES.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Input value={carForm.city} onChange={e => setCarForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
            </div>
            <div>
              <Label>Price/Day (FCFA)</Label>
              <Input type="number" value={carForm.price_per_day} onChange={e => setCarForm(p => ({ ...p, price_per_day: e.target.value }))} placeholder="25000" />
            </div>
            <div>
              <Label>Seats</Label>
              <Input type="number" value={carForm.seats} onChange={e => setCarForm(p => ({ ...p, seats: parseInt(e.target.value) }))} />
            </div>
            <div>
              <Label>Fuel Type</Label>
              <Select value={carForm.fuel_type} onValueChange={v => setCarForm(p => ({ ...p, fuel_type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={carForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setCarForm(p => ({ 
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
              <p className="text-xs text-slate-500 mt-1">Select the operator managing this vehicle</p>
            </div>
            <div className="col-span-2">
              <Label>Features</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CAR_FEATURES.map(feature => (
                  <Badge
                    key={feature}
                    variant={carForm.features?.includes(feature) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setCarForm(p => ({
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCarDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCar} className="bg-[#082c59]">{editingCar ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Car Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Car Details
            </DialogTitle>
          </DialogHeader>
          {viewingCar && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-blue-900">{viewingCar.brand} {viewingCar.model}</h3>
                <p className="text-sm text-blue-700">{viewingCar.year} • {viewingCar.transmission}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingCar.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Fuel Type</p>
                  <p className="font-medium capitalize">{viewingCar.fuel_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Seats</p>
                  <p className="font-medium">{viewingCar.seats} passengers</p>
                </div>
                <div>
                  <p className="text-slate-500">Price/Day</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingCar.price_per_day)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Plate Number</p>
                  <p className="font-medium">{viewingCar.plate_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={viewingCar.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                    {viewingCar.status}
                  </Badge>
                </div>
              </div>
              {viewingCar.features?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingCar.features.map(f => (
                      <Badge key={f} variant="outline" className="text-xs capitalize">{f.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openCarDialog(viewingCar); setIsViewDialogOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
