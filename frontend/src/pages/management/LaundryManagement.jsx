import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Shirt, Plus, Edit, Trash2, MapPin, Clock, DollarSign, Package,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Users, Droplets, Eye, Banknote, Receipt
} from 'lucide-react';
import WalkInBookingModal from '@/components/management/shared/WalkInBookingModal';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const CHART_COLORS = ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];
const SERVICES = ['washing', 'dry_cleaning', 'ironing', 'folding', 'express', 'pickup_delivery'];

const DEFAULT_PRESSING_FORM = {
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  services: [],
  operating_hours: {},
  delivery_available: false,
  delivery_fee: 0,
  express_available: false,
  express_surcharge: 50,
  min_order_amount: 0,
  images: [],
  operator_id: '',
  operator_name: ''
};

// Laundry specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

const BusinessAnalytics = ({ pressings }) => {
  const analyticsData = useMemo(() => {
    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', orders: 185, revenue: 420000 },
      { month: 'Feb', orders: 210, revenue: 485000 },
      { month: 'Mar', orders: 245, revenue: 580000 },
      { month: 'Apr', orders: 228, revenue: 520000 },
      { month: 'May', orders: 275, revenue: 680000 },
      { month: 'Jun', orders: 310, revenue: 820000 }
    ];

    return { monthlyTrend };
  }, [pressings]);

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
                <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#06B6D4" strokeWidth={2} name="Orders" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function LaundryManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pressings, setPressings] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPressingDialogOpen, setIsPressingDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPressing, setViewingPressing] = useState(null);
  const [editingPressing, setEditingPressing] = useState(null);
  const [pressingForm, setPressingForm] = useState(DEFAULT_PRESSING_FORM);

  // Use the laundry dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const dashboardData = useRealDashboardData('laundry', '30days', scopeOperatorId);

  const handleViewPressing = (pressing) => {
    setViewingPressing(pressing);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(pressing.id, pressing.name);
  };

  const loadPressings = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/pressing/${params}`);
      setPressings(res.data.pressings || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setPressings([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => {
    loadPressings();
  }, [loadPressings]);

  const openPressingDialog = (pressing = null) => {
    setEditingPressing(pressing);
    setPressingForm(pressing ? { 
      ...pressing, 
      price_per_kg: pressing.price_per_kg?.toString() || '',
      operator_id: pressing.operator_id || '',
      operator_name: pressing.operator_name || ''
    } : DEFAULT_PRESSING_FORM);
    setIsPressingDialogOpen(true);
  };

  const handleSavePressing = async () => {
    try {
      const operator = operators.find(op => (op._id || op.id) === pressingForm.operator_id);
      const data = { 
        ...pressingForm, 
        price_per_kg: parseFloat(pressingForm.price_per_kg) || 0,
        operator_name: operator?.name || pressingForm.operator_name || ''
      };
      if (editingPressing) {
        await api.put(`/pressing/${editingPressing.id}`, data);
        toast.success('Updated');
      } else {
        await api.post('/pressing/', data);
        toast.success('Created');
      }
      setIsPressingDialogOpen(false);
      loadPressings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeletePressing = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/pressing/${id}`);
      toast.success('Deleted');
      loadPressings();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Laundry & Pressing Management</h1>
          <p className="text-gray-600">Manage shops, orders, analytics, and communications</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OperatorScopeFilter serviceType="pressing" value={scopeOperatorId} onChange={setScopeOperatorId} />
          <Button
            onClick={() => setIsWalkInOpen(true)}
            className="bg-[#082c59] hover:bg-[#0a366d]"
            data-testid="open-walkin-booking-btn"
          >
            <Banknote className="h-4 w-4 mr-2" /> Walk-in Booking
          </Button>
          <Button onClick={loadPressings} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Shirt className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings"><Receipt className="h-4 w-4 mr-2" />Bookings</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Laundry"
            serviceIcon={<Shirt className="h-8 w-8" />}
            primaryColor="teal"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Shops"
            secondaryLabel="Services"
            secondaryCount={dashboardData.secondaryCount}
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Laundry Shops</CardTitle>
              <PermissionGate permission="pressing.create">
                <Button onClick={() => openPressingDialog()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> Add Shop
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : pressings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No shops found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pressings.map(pressing => (
                    <Card key={pressing.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <h3 className="font-semibold mb-2">{pressing.name}</h3>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{pressing.city}</div>
                          <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{pressing.phone}</div>
                        </div>
                        {pressing.services?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pressing.services.slice(0, 3).map((s, idx) => (
                              <Badge key={typeof s === 'string' ? s : s?.name || idx} variant="outline" className="text-xs capitalize">
                                {typeof s === 'string' ? s.replace('_', ' ') : s?.name || s?.type || 'Service'}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 font-bold text-green-600">{formatFCFA(pressing.price_per_kg)}/kg</div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewPressing(pressing)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <PermissionGate permission="pressing.edit">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openPressingDialog(pressing)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="pressing.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeletePressing(pressing.id)}>
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

        <TabsContent value="bookings" className="mt-6">
          <OperatorBookingsList serviceType="laundry" refreshKey={bookingsRefreshKey} />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Laundry"
            serviceTag="pressing"
            operatorId={scopeOperatorId}
            serviceIcon={<Shirt className="h-5 w-5 text-cyan-600" />}
            primaryColor="teal"
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics pressings={pressings} />
        </TabsContent>
      </Tabs>

      <Dialog open={isPressingDialogOpen} onOpenChange={setIsPressingDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{editingPressing ? 'Edit Shop' : 'Add Shop'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Shop Name</Label>
              <Input value={pressingForm.name} onChange={e => setPressingForm(p => ({ ...p, name: e.target.value }))} placeholder="Shop name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input value={pressingForm.city} onChange={e => setPressingForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={pressingForm.phone} onChange={e => setPressingForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237..." />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={pressingForm.address} onChange={e => setPressingForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
            </div>
            <div>
              <Label>Price per Kg (FCFA)</Label>
              <Input type="number" value={pressingForm.price_per_kg} onChange={e => setPressingForm(p => ({ ...p, price_per_kg: e.target.value }))} placeholder="1500" />
            </div>
            <div>
              <Label>Services</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SERVICES.map(service => {
                  const serviceTypes = (pressingForm.services || []).map(s => typeof s === 'string' ? s : s?.type || s?.name || '');
                  const isSelected = serviceTypes.includes(service);
                  return (
                    <Badge
                      key={service}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => {
                        setPressingForm(p => ({
                          ...p,
                          services: isSelected
                            ? (p.services || []).filter(s => (typeof s === 'string' ? s : s?.type || s?.name) !== service)
                            : [...(p.services || []), service]
                        }));
                      }}
                    >
                      {service.replace('_', ' ')}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Operator</Label>
              <Select 
                value={pressingForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setPressingForm(p => ({ 
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPressingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePressing} className="bg-[#082c59]">{editingPressing ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Laundry Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5 text-cyan-600" />
              Laundry Service Details
            </DialogTitle>
          </DialogHeader>
          {viewingPressing && (
            <div className="space-y-4 py-4">
              <div className="bg-cyan-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-cyan-900">{viewingPressing.name}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingPressing.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">{viewingPressing.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium">{viewingPressing.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Price/Kg</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingPressing.price_per_kg)}</p>
                </div>
              </div>
              {viewingPressing.services?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Services Offered</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingPressing.services.map((s, idx) => (
                      <Badge key={typeof s === 'string' ? s : s?.name || idx} variant="outline" className="text-xs capitalize">
                        {typeof s === 'string' ? s.replace('_', ' ') : s?.name || s?.type || 'Service'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingPressing.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingPressing.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openPressingDialog(viewingPressing); setIsViewDialogOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalkInBookingModal
        open={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        serviceType="laundry"
        services={pressings.map((p) => ({ id: p.id, name: p.name, price: p.starting_price }))}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          setActiveTab('bookings');
        }}
      />
    </div>
  );
}
