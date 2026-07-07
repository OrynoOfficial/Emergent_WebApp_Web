import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Car, Plus, Edit, Trash2, MapPin, Users, DollarSign,
  LayoutDashboard, MessageSquare, TrendingUp, RefreshCw,
  Fuel, Settings, Eye, Search, Calendar, Gauge, ChevronLeft, ChevronRight, Building2,
  Banknote, Receipt, Replace as ReplaceIcon, RotateCcw
} from 'lucide-react';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { canListOperators } from '@/utils/roleHelpers';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import { extractErrorMessage } from '@/utils/apiError';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import CarRentalsLifecycleTab from '@/components/management/car-rental/CarRentalsLifecycleTab';
import BulkActionsBar, { BulkSelectHeader, BulkSelectCell } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const PAGE_SIZE = 12;

const CHART_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const CAR_FEATURES = ['ac', 'gps', 'bluetooth', 'sunroof', 'leather_seats', 'backup_camera', 'cruise_control', 'heated_seats'];
const CAR_TYPES = ['economy', 'compact', 'sedan', 'suv', 'luxury', 'sports', 'van', 'pickup'];

const DEFAULT_CAR_FORM = {
  brand: '', model: '', year: new Date().getFullYear(), car_type: 'sedan',
  seats: 5, doors: 4, transmission: 'automatic', fuel_type: 'petrol',
  price_per_day: '', price_per_hour: '', city: '', features: [],
  images: [], is_available: true, operator_id: '', operator_name: '', plate_number: '',
  // Richer optional fields
  description: '',
  mileage_policy: 'Unlimited mileage',
  fuel_policy: 'Full to Full',
  minimum_driver_age: 21,
  min_rental_days: 1,
  max_rental_days: 30,
  pickup_locations: [],
  trunk_capacity: '',
  fuel_consumption: '',
  policies: [],
  total_units: 1,
  refund_policy: null,
};

// Car Rental specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

// Analytics Section for Dashboard
const CarRentalAnalyticsSection = ({ cars }) => {
  const analyticsData = useMemo(() => {
    const cityData = {};
    cars.forEach(c => {
      const city = c.city || 'Unknown';
      cityData[city] = (cityData[city] || 0) + 1;
    });

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="shadow-lg lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
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
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Fleet by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={70} fontSize={11} />
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

// Image Carousel Component for Car Modal
const CarImageCarousel = ({ images, className = "h-48" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  if (!images?.length) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center rounded-lg`}>
        <Car className="h-16 w-16 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${className} relative group overflow-hidden bg-slate-100 rounded-lg`}>
      <img 
        src={getImageUrl(images[currentIndex])} 
        alt={`Car ${currentIndex + 1}`} 
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
      />
      {images.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)} 
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)} 
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentIndex(idx)} 
                className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'}`} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Modern Car Card Component
const CarCard = ({ car, onView, onEdit, onDelete, onReplace }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;
  const images = car.images?.filter(img => img) || [];

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
      {/* Image Section */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {images.length > 0 ? (
          <img 
            src={getImageUrl(images[0])} 
            alt={`${car.brand} ${car.model}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-20 h-20 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className={car.is_available ? 'bg-emerald-500 text-white border-0' : 'bg-red-500 text-white border-0'}>
            {car.is_available ? 'Available' : 'Rented'}
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="bg-white/90 capitalize">{car.car_type}</Badge>
        </div>
        <div className="absolute bottom-3 left-3 text-white">
          <h3 className="font-bold text-lg">{car.brand} {car.model}</h3>
          <p className="text-white/80 text-sm">{car.year} • {car.transmission}</p>
        </div>
      </div>
      
      <CardContent className="p-3">
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          <div className="text-center p-1.5 bg-slate-50 rounded-md">
            <Users className="w-3 h-3 mx-auto text-slate-500 mb-0.5" />
            <p className="text-[10px] text-slate-500">Seats</p>
            <p className="font-semibold text-xs">{car.seats}</p>
          </div>
          <div className="text-center p-1.5 bg-slate-50 rounded-md">
            <Fuel className="w-3 h-3 mx-auto text-slate-500 mb-0.5" />
            <p className="text-[10px] text-slate-500">Fuel</p>
            <p className="font-semibold text-xs capitalize">{car.fuel_type?.slice(0, 6)}</p>
          </div>
          <div className="text-center p-1.5 bg-slate-50 rounded-md">
            <Gauge className="w-3 h-3 mx-auto text-slate-500 mb-0.5" />
            <p className="text-[10px] text-slate-500">Trans.</p>
            <p className="font-semibold text-xs capitalize">{car.transmission?.slice(0, 4)}</p>
          </div>
          <div className="text-center p-1.5 bg-emerald-50 rounded-md">
            <DollarSign className="w-3 h-3 mx-auto text-emerald-600 mb-0.5" />
            <p className="text-[10px] text-slate-500">Day</p>
            <p className="font-bold text-xs text-emerald-600">{(car.price_per_day/1000).toFixed(0)}k</p>
          </div>
        </div>

        {/* Secondary stats row — doors, fleet stock, rating, refund preset.
            Gives operators an at-a-glance view of inventory + reputation. */}
        <div className="grid grid-cols-4 gap-2 mb-3 text-[11px]">
          <div className="text-center p-1.5 bg-slate-50 rounded-md">
            <p className="text-slate-500">Doors</p>
            <p className="font-semibold text-slate-700">{car.doors || '—'}</p>
          </div>
          <div className="text-center p-1.5 bg-slate-50 rounded-md">
            <p className="text-slate-500">Units</p>
            <p className="font-semibold text-slate-700">{car.total_units ?? 1}</p>
          </div>
          <div className="text-center p-1.5 bg-amber-50 rounded-md">
            <p className="text-slate-500">Rating</p>
            <p className="font-semibold text-amber-700">
              {car.average_rating > 0 ? `★ ${Number(car.average_rating).toFixed(1)}` : '—'}
            </p>
          </div>
          <div className="text-center p-1.5 bg-indigo-50 rounded-md">
            <p className="text-slate-500">Refund</p>
            <p className="font-semibold text-indigo-700 capitalize">
              {car.refund_policy?.preset || 'default'}
            </p>
          </div>
        </div>

        {/* Policies summary — surfaces mileage + fuel + driver age at a glance */}
        {(car.mileage_policy || car.fuel_policy || car.minimum_driver_age) && (
          <div className="mb-3 text-[11px] text-slate-600 space-y-0.5 px-1">
            {car.mileage_policy && (
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3 h-3 text-slate-400" /> {car.mileage_policy}
              </div>
            )}
            {car.fuel_policy && (
              <div className="flex items-center gap-1.5">
                <Fuel className="w-3 h-3 text-slate-400" /> Fuel: {car.fuel_policy}
              </div>
            )}
            {car.minimum_driver_age && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-slate-400" /> Min age: {car.minimum_driver_age}+
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
          <MapPin className="w-4 h-4" />
          <span>{car.city || 'N/A'}</span>
          {car.plate_number && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{car.plate_number}</span>
            </>
          )}
        </div>
        
        {/* Operator Assignment */}
        {car.operator_name && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-800 truncate">{car.operator_name}</span>
          </div>
        )}

        {car.features?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {car.features.slice(0, 4).map(f => (
              <Badge key={f} variant="outline" className="text-xs capitalize">{f.replace('_', ' ')}</Badge>
            ))}
            {car.features.length > 4 && (
              <Badge variant="outline" className="text-xs">+{car.features.length - 4}</Badge>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => onView(car)} className="flex-1">
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          <PermissionGate permission="car_rental.edit">
            <Button size="sm" variant="outline" onClick={() => onReplace?.(car)} title="Replace on all active bookings" className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`replace-car-btn-${car.id}`}>
              <ReplaceIcon className="w-4 h-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="car_rental.edit">
            <Button size="sm" variant="outline" onClick={() => onEdit(car)}>
              <Edit className="w-4 h-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission="car_rental.delete">
            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(car)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
export default function CarRentalManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cars, setCars] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carSearch, setCarSearch] = useState('');
  const [isCarDialogOpen, setIsCarDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingCar, setViewingCar] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [carForm, setCarForm] = useState(DEFAULT_CAR_FORM);

  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [replaceCar, setReplaceCar] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [carPage, setCarPage] = useState(1);
  const dashboardData = useRealDashboardData('car_rental', '30days', scopeOperatorId);

  // Filtered cars
  const filteredCars = useMemo(() => {
    if (!carSearch) return cars;
    const s = carSearch.toLowerCase();
    return cars.filter(c => 
      c.brand?.toLowerCase().includes(s) || 
      c.model?.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s) ||
      c.plate_number?.toLowerCase().includes(s)
    );
  }, [cars, carSearch]);

  // Reset to page 1 when search changes (React-recommended pattern: adjust state during render)
  const [prevCarSearch, setPrevCarSearch] = useState(carSearch);
  if (carSearch !== prevCarSearch) {
    setPrevCarSearch(carSearch);
    setCarPage(1);
  }
  const carTotalPages = Math.max(1, Math.ceil(filteredCars.length / PAGE_SIZE));
  const pagedCars = useMemo(
    () => filteredCars.slice((carPage - 1) * PAGE_SIZE, carPage * PAGE_SIZE),
    [filteredCars, carPage]
  );

  // Bulk selection on the visible page.
  const carBulk = useBulkSelection(pagedCars, { idKey: 'id' });
  const _carBulkRun = async (action, ids) => {
    await api.post('/admin/bulk', { collection: 'vehicles', action, ids });
    if (typeof loadCars === 'function') await loadCars();
  };
  const bulkCarDelete     = (ids) => _carBulkRun('delete', ids);
  const bulkCarActivate   = (ids) => _carBulkRun('activate', ids);
  const bulkCarDeactivate = (ids) => _carBulkRun('deactivate', ids);

  const handleViewCar = (car) => {
    setViewingCar(car);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(car.id, `${car.brand} ${car.model}`);
  };

  const loadCars = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/car-rental/management/my-vehicles${params}`);
      // Backend stores `make` + `vehicle_type`; the UI consumes `brand` + `car_type`.
      // Normalise on read so existing cars render correctly.
      const raw = res.data.vehicles || res.data.cars || res.data || [];
      const normalised = (Array.isArray(raw) ? raw : []).map(c => ({
        ...c,
        brand: c.brand ?? c.make ?? '',
        car_type: c.car_type ?? c.vehicle_type ?? 'sedan',
      }));
      setCars(normalised);
      
      if (canListOperators(user)) {
        try {
          const opRes = await api.get('/operators/');
          setOperators(opRes.data.operators || opRes.data || []);
        } catch { /* silent */ }
      }
    } catch (error) {
      console.error('Failed to load cars:', error);
      setCars([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId, user]);

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
      const operator = operators.find(op => (op._id || op.id) === carForm.operator_id);
      // Backend Pydantic model expects `make` + `vehicle_type`; the UI uses the
      // friendlier `brand` + `car_type` names. Send both so legacy consumers
      // keep working but the validator is satisfied.
      const data = {
        ...carForm,
        make: carForm.brand,
        vehicle_type: carForm.car_type,
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
      toast.error(extractErrorMessage(error, 'Failed to save'));
    }
  };

  const handleDeleteCar = async (car) => {
    const carId = car._id || car.id;
    if (!confirm('Delete this car?')) return;
    try {
      await api.delete(`/car-rental/${carId}`);
      toast.success('Car deleted');
      loadCars();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <ManagementShell
        title="Car Rental Management Center"
        icon={Car}
        subtitle="Manage fleet, bookings, and communications"
        scopeFilter={<OperatorScopeFilter serviceType="car_rental" value={scopeOperatorId} onChange={setScopeOperatorId} />}
        onRefresh={loadCars}
        refreshing={loading}
        tabs={[
          { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { value: 'management', label: 'Fleet Management', icon: Car },
          { value: 'rentals', label: 'Active Rentals', icon: RotateCcw, testId: 'car-rentals-tab' },
          { value: 'communications', label: 'Communications', icon: MessageSquare },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        testIdPrefix="carrental-mgmt"
      >

          <TabsContent value="dashboard" className="mt-6">
            <ServiceExecutiveDashboard
              serviceType="Car Rental"
              serviceIcon={<Car className="h-8 w-8" />}
              primaryColor="green"
              stats={dashboardData.stats}
              bookingsByStatus={dashboardData.bookingsByStatus}
              dailyTrend={dashboardData.dailyTrend}
              distribution={dashboardData.distribution}
              itemLabel="Vehicles"
              secondaryLabel="Available"
              secondaryCount={dashboardData.secondaryCount}
              analyticsSection={<CarRentalAnalyticsSection cars={cars} />}
              recentBookingsSlot={
                <OperatorBookingsList serviceType="car_rental" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
              }
            />
          </TabsContent>

          <TabsContent value="management" className="mt-6 space-y-4">
            <SubpageCard title="Fleet" icon={Car} iconColorClass="text-emerald-600" count={filteredCars.length} testId="carrental-mgmt-subpage-card">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search by brand, model, city, or plate…"
                  value={carSearch}
                  onChange={(e) => setCarSearch(e.target.value)}
                  className="pl-9 h-8 bg-white text-sm"
                  data-testid="car-search-input"
                />
              </div>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <PermissionGate permission="car_rental.create">
                <Button onClick={() => openCarDialog()} size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" data-testid="add-car-btn">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Car
                </Button>
              </PermissionGate>
            </SubpageCard>

            {/* Cars Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : filteredCars.length === 0 ? (
              <Card className="p-12 text-center">
                <Car className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No cars found</h3>
                <p className="text-slate-500 mb-4">
                  {carSearch ? 'Try adjusting your search' : 'Add your first car to get started'}
                </p>
                <Button onClick={() => openCarDialog()} className="bg-emerald-600">
                  <Plus className="w-4 h-4 mr-2" /> Add Car
                </Button>
              </Card>
            ) : viewMode === 'list' ? (
              <Card className="overflow-hidden" data-testid="cars-list-view">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3 w-8">
                          <BulkSelectHeader
                            allSelected={carBulk.allSelected}
                            partiallySelected={carBulk.partiallySelected}
                            onToggleAll={carBulk.toggleAll}
                            testid="cars-bulk-select-all"
                          />
                        </th>
                        <th className="px-4 py-3">Vehicle</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Plate</th>
                        <th className="px-4 py-3">City</th>
                        <th className="px-4 py-3">Seats</th>
                        <th className="px-4 py-3">Price/Day</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCars.map(car => (
                        <tr key={car._id || car.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 w-8">
                            <BulkSelectCell
                              selected={carBulk.isSelected(car._id || car.id)}
                              onToggle={carBulk.toggle}
                              id={car._id || car.id}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{car.brand} {car.model} <span className="text-slate-400 text-xs">({car.year})</span></td>
                          <td className="px-4 py-3 capitalize text-slate-700">{car.car_type}</td>
                          <td className="px-4 py-3 font-mono text-xs">{car.plate_number || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{car.city || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{car.seats}</td>
                          <td className="px-4 py-3 font-bold text-emerald-700">{formatFCFA(car.price_per_day || 0)}</td>
                          <td className="px-4 py-3">
                            <Badge className={car.is_available ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                              {car.is_available ? 'Available' : 'Rented'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleViewCar(car)}>View</Button>
                              <PermissionGate permission="car_rental.edit">
                                <Button size="sm" variant="ghost" onClick={() => openCarDialog(car)}>Edit</Button>
                              </PermissionGate>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : viewMode === 'details' ? (
              <div className="space-y-4" data-testid="cars-details-view">
                {pagedCars.map(car => (
                  <CarCard
                    key={car._id || car.id}
                    car={car}
                    onView={handleViewCar}
                    onEdit={openCarDialog}
                    onDelete={handleDeleteCar}
                    onReplace={setReplaceCar}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="cars-grid-view">
                {pagedCars.map(car => (
                  <CarCard
                    key={car._id || car.id}
                    car={car}
                    onView={handleViewCar}
                    onEdit={openCarDialog}
                    onDelete={handleDeleteCar}
                    onReplace={setReplaceCar}
                  />
                ))}
              </div>
            )}

            <Pagination
              page={carPage}
              totalPages={carTotalPages}
              onChange={setCarPage}
              total={filteredCars.length}
              pageSize={PAGE_SIZE}
              itemLabel="car"
            />
          </TabsContent>

          <TabsContent value="rentals" className="mt-6">
            <CarRentalsLifecycleTab scopeOperatorId={scopeOperatorId} />
          </TabsContent>

          <TabsContent value="communications" className="mt-6">
            <ServiceCommunicationsHub
              serviceType="Car Rental"
              serviceTag="car_rental"
              operatorId={scopeOperatorId}
              serviceIcon={<Car className="h-5 w-5 text-emerald-600" />}
              primaryColor="green"
            />
          </TabsContent>
        </ManagementShell>

      {/* Car Dialog */}
      <ServiceFormShell
        open={isCarDialogOpen}
        onOpenChange={setIsCarDialogOpen}
        icon={Car}
        title={editingCar ? 'Edit Car' : 'Add New Car'}
        subtitle={editingCar
          ? 'Refresh photos, pricing, features. Renters see updates immediately.'
          : 'List a new vehicle with up to 3 photos to attract renters.'}
        editing={!!editingCar}
        accent="emerald"
        leftColumn={
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Photos</Label>
              <div className="mt-2">
                <MiniImageUploader
                  images={carForm.images || []}
                  onChange={(imgs) => setCarForm(p => ({ ...p, images: imgs }))}
                  max={3}
                  folder="car_rental"
                  accent="emerald"
                  helperText="Upload up to 3 photos. The first one is shown as cover."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Plate Number</Label>
                <Input value={carForm.plate_number} onChange={e => setCarForm(p => ({ ...p, plate_number: e.target.value }))} placeholder="LT 1234 AB" />
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
                <Label>Transmission</Label>
                <Select value={carForm.transmission} onValueChange={v => setCarForm(p => ({ ...p, transmission: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="automatic">Automatic</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
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
                <OperatorSelector
                  value={carForm.operator_id || ''}
                  onChange={(id, name) => setCarForm(p => ({ ...p, operator_id: id, operator_name: name }))}
                  operators={operators}
                  testId="car-operator-selector"
                />
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

              {/* Detailed Vehicle Information */}
              <div className="col-span-2 pt-3 border-t border-slate-200">
                <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Detailed Information</Label>
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={6}
                  value={carForm.description}
                  onChange={(e) => setCarForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={'Describe the vehicle — comfort, target use, recent service, etc.\n\nLeave a blank line between paragraphs to break them up on the details page (e.g. one paragraph for comfort, one for performance, one for what makes it stand out).'}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tip: use blank lines to split your description into paragraphs. Renters see the formatting you write here.
                </p>
              </div>
              <div>
                <Label>Doors</Label>
                <Input type="number" min={2} max={6} value={carForm.doors} onChange={e => setCarForm(p => ({ ...p, doors: parseInt(e.target.value) || 4 }))} />
              </div>
              <div>
                <Label>Trunk Capacity</Label>
                <Input value={carForm.trunk_capacity} onChange={e => setCarForm(p => ({ ...p, trunk_capacity: e.target.value }))} placeholder="450L" />
              </div>
              <div>
                <Label>Fuel Consumption</Label>
                <Input value={carForm.fuel_consumption} onChange={e => setCarForm(p => ({ ...p, fuel_consumption: e.target.value }))} placeholder="7.5L/100km" />
              </div>
              <div>
                <Label>Mileage Policy</Label>
                <Select value={carForm.mileage_policy} onValueChange={v => setCarForm(p => ({ ...p, mileage_policy: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Unlimited mileage">Unlimited mileage</SelectItem>
                    <SelectItem value="100 km/day included">100 km/day included</SelectItem>
                    <SelectItem value="200 km/day included">200 km/day included</SelectItem>
                    <SelectItem value="300 km/day included">300 km/day included</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuel Policy</Label>
                <Select value={carForm.fuel_policy} onValueChange={v => setCarForm(p => ({ ...p, fuel_policy: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Full to Full">Full to Full</SelectItem>
                    <SelectItem value="Same to Same">Same to Same</SelectItem>
                    <SelectItem value="Pre-purchase">Pre-purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Minimum Driver Age</Label>
                <Input type="number" min={18} max={80} value={carForm.minimum_driver_age} onChange={e => setCarForm(p => ({ ...p, minimum_driver_age: parseInt(e.target.value) || 21 }))} />
              </div>
              <div>
                <Label>Min Rental Days</Label>
                <Input type="number" min={1} value={carForm.min_rental_days} onChange={e => setCarForm(p => ({ ...p, min_rental_days: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Max Rental Days</Label>
                <Input type="number" min={1} value={carForm.max_rental_days} onChange={e => setCarForm(p => ({ ...p, max_rental_days: parseInt(e.target.value) || 30 }))} />
              </div>
              <div>
                <Label>Hourly Rate (FCFA)</Label>
                <Input type="number" value={carForm.price_per_hour} onChange={e => setCarForm(p => ({ ...p, price_per_hour: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label>Total Units in Fleet <span className="text-slate-400 font-normal text-xs">(stock)</span></Label>
                <Input
                  type="number"
                  min={1}
                  value={carForm.total_units || 1}
                  onChange={e => setCarForm(p => ({ ...p, total_units: parseInt(e.target.value) || 1 }))}
                  placeholder="1"
                  data-testid="car-form-total-units"
                />
              </div>
              <div className="col-span-2">
                <Label>Pickup Locations <span className="text-slate-400 font-normal text-xs">(comma separated)</span></Label>
                <Input
                  value={Array.isArray(carForm.pickup_locations) ? carForm.pickup_locations.join(', ') : ''}
                  onChange={e => setCarForm(p => ({
                    ...p,
                    pickup_locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder="Douala Airport, Douala Centre, Yaoundé Airport"
                />
              </div>
              <div className="col-span-2">
                <Label>Vehicle Policies <span className="text-slate-400 font-normal text-xs">(one per line — shown on the Policies tab in Vehicle Details)</span></Label>
                <Textarea
                  rows={4}
                  value={(carForm.policies || []).join('\n')}
                  onChange={e => setCarForm(p => ({
                    ...p,
                    policies: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder={'Driver must be 25+ years old with valid licence\nFuel must be returned at the same level as pickup\nNo smoking inside the vehicle\nSecurity deposit of XAF 100,000 (refundable)'}
                  data-testid="car-form-policies"
                />
              </div>
              <div className="col-span-2 flex items-center justify-between bg-emerald-50 rounded-lg border border-emerald-100 p-3">
                <div>
                  <Label className="cursor-pointer">Vehicle Available for Booking</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Renters can only book vehicles marked as available.</p>
                </div>
                <Switch
                  checked={!!carForm.is_available}
                  onCheckedChange={(v) => setCarForm(p => ({ ...p, is_available: v }))}
                />
              </div>

              {/* Listing-level refund policy override */}
              <div className="col-span-2 pt-3 border-t border-slate-200" data-testid="car-form-refund-policy">
                <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Refund Policy <span className="text-slate-400 font-normal normal-case">(overrides operator default for this vehicle)</span>
                </Label>
                <div className="mt-2">
                  <CancellationPolicyPicker
                    serviceType="car_rental"
                    scope="listing"
                    value={carForm.refund_policy}
                    onChange={(v) => setCarForm(p => ({ ...p, refund_policy: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
        }
        preview={
          <GenericPreviewCard
            cover={(carForm.images || [])[0]}
            thumbs={(carForm.images || []).slice(1, 3)}
            icon={Car}
            badgeText="Car Rental"
            badgeClass="bg-emerald-500 text-white"
            placeholderColor="from-emerald-700 via-emerald-600 to-teal-500"
            title={[carForm.brand, carForm.model].filter(Boolean).join(' ') || 'Brand Model'}
            subtitle={`${carForm.year || 'Year'} · ${(carForm.car_type || 'sedan').replace('_', ' ')}${carForm.transmission ? ` · ${carForm.transmission}` : ''}`}
            location={[carForm.city, carForm.plate_number].filter(Boolean).join(' · ') || 'City · Plate'}
            tags={carForm.features || []}
            tagsAccentClass="bg-emerald-50 text-emerald-700"
            priceLabel="Per day"
            priceValue={carForm.price_per_day ? `${Number(carForm.price_per_day).toLocaleString()} FCFA` : '—'}
            accentTextClass="text-emerald-700"
          />
        }
        submitting={false}
        submitLabel={editingCar ? 'Update Car' : 'Add Car'}
        onSubmit={handleSaveCar}
        submitDataTestId="save-car-btn"
      />

      {/* View Car Dialog - Enhanced with Image Carousel */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-emerald-600" />
              Car Details
            </DialogTitle>
          </DialogHeader>
          {viewingCar && (
            <div className="space-y-4 py-4">
              {/* Image Carousel */}
              <CarImageCarousel images={viewingCar.images} className="h-56" />

              {/* Thumbnails */}
              {viewingCar.images?.length > 1 && (
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2">
                    {viewingCar.images.map((img, idx) => {
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
                      const getImageUrl = (i) => i?.startsWith('/api') ? `${backendUrl}${i}` : i;
                      return (
                        <img 
                          key={idx}
                          src={getImageUrl(img)}
                          alt={`Thumbnail ${idx + 1}`}
                          className="h-16 w-24 object-cover rounded-lg border-2 border-white shadow-sm cursor-pointer hover:ring-2 hover:ring-emerald-500"
                        />
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}

              <div className="bg-emerald-50 rounded-lg p-4">
                <h3 className="font-bold text-xl text-emerald-900">{viewingCar.brand} {viewingCar.model}</h3>
                <p className="text-emerald-700">{viewingCar.year} • {viewingCar.transmission} • {viewingCar.car_type}</p>
              </div>
              
              {/* Operator Assignment - Prominent Display */}
              {viewingCar.operator_name && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 font-medium">Assigned Operator</p>
                      <p className="font-bold text-indigo-900 text-lg">{viewingCar.operator_name}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <Users className="h-5 w-5 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs text-slate-500">Seats</p>
                  <p className="font-bold">{viewingCar.seats}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <Fuel className="h-5 w-5 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs text-slate-500">Fuel</p>
                  <p className="font-bold capitalize">{viewingCar.fuel_type}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                  <p className="text-xs text-slate-500">Per Day</p>
                  <p className="font-bold text-emerald-600">{formatFCFA(viewingCar.price_per_day)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingCar.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Plate Number</p>
                  <p className="font-medium font-mono">{viewingCar.plate_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Operator</p>
                  <p className="font-medium">{viewingCar.operator_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={viewingCar.is_available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                    {viewingCar.is_available ? 'Available' : 'Rented'}
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
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-emerald-600">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <ReplaceResourceModal
        open={!!replaceCar}
        onClose={() => setReplaceCar(null)}
        serviceType="car_rental"
        oldResource={replaceCar ? { ...replaceCar, id: replaceCar._id || replaceCar.id } : null}
        allResources={cars.map(c => ({ ...c, id: c._id || c.id }))}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadCars?.();
        }}
      />

      <BulkActionsBar
        count={carBulk.count}
        entityLabel="vehicle"
        selectedIds={carBulk.selectedIds}
        selectedRows={carBulk.selectedRows}
        onClear={carBulk.clear}
        onDelete={bulkCarDelete}
        onActivate={bulkCarActivate}
        onDeactivate={bulkCarDeactivate}
        onExport={(rows) => rows.map(c => ({
          id: c._id || c.id, brand: c.brand, model: c.model, year: c.year,
          plate: c.plate_number, city: c.city, seats: c.seats,
          price_per_day: c.price_per_day, available: c.is_available,
        }))}
      />
    </div>
  );
}
