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
  Package, Plus, Edit, Trash2, MapPin, Clock, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Calendar, Plane, Hotel, Camera, Eye
} from 'lucide-react';
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

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PACKAGE_TYPES = ['tour', 'honeymoon', 'adventure', 'cultural', 'business', 'family', 'luxury', 'budget'];
const INCLUSIONS = ['flights', 'hotel', 'meals', 'transport', 'guide', 'activities', 'insurance', 'visa_assistance'];

const DEFAULT_PACKAGE_FORM = {
  name: '',
  package_type: 'tour',
  description: '',
  destination: '',
  origin: '',
  duration_days: 3,
  duration_nights: 2,
  base_price: '',
  price_per_person: true,
  min_travelers: 1,
  max_travelers: 20,
  inclusions: [],
  exclusions: [],
  itinerary: [],
  departure_dates: [],
  images: [],
  tags: [],
  operator_id: '',
  operator_name: ''
};

// Package specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

const BusinessAnalytics = ({ packages }) => {
  const analyticsData = useMemo(() => {
    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', bookings: 22, revenue: 4500000 },
      { month: 'Feb', bookings: 35, revenue: 7200000 },
      { month: 'Mar', bookings: 42, revenue: 8850000 },
      { month: 'Apr', bookings: 38, revenue: 7800000 },
      { month: 'May', bookings: 55, revenue: 11200000 },
      { month: 'Jun', bookings: 68, revenue: 14500000 }
    ];

    return { monthlyTrend };
  }, [packages]);

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
                <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} name="Bookings" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function PackageManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [packages, setPackages] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPackage, setViewingPackage] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState(DEFAULT_PACKAGE_FORM);

  // Use the package dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const dashboardData = useRealDashboardData('packages');

  const handleViewPackage = (pkg) => {
    setViewingPackage(pkg);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(pkg.id, pkg.name);
  };

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/packages/${params}`);
      setPackages(res.data.packages || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const openPackageDialog = (pkg = null) => {
    setEditingPackage(pkg);
    setPackageForm(pkg ? { 
      ...pkg, 
      price: pkg.price?.toString() || '',
      operator_id: pkg.operator_id || '',
      operator_name: pkg.operator_name || ''
    } : DEFAULT_PACKAGE_FORM);
    setIsPackageDialogOpen(true);
  };

  const handleSavePackage = async () => {
    try {
      const operator = operators.find(op => (op._id || op.id) === packageForm.operator_id);
      const data = { 
        ...packageForm, 
        base_price: parseFloat(packageForm.base_price) || 0,
        duration_days: parseInt(packageForm.duration_days) || 1,
        duration_nights: parseInt(packageForm.duration_nights) || 0,
        min_travelers: parseInt(packageForm.min_travelers) || 1,
        max_travelers: packageForm.max_travelers ? parseInt(packageForm.max_travelers) : null,
        operator_name: operator?.name || packageForm.operator_name || ''
      };
      if (editingPackage) {
        await api.put(`/packages/${editingPackage.id}`, data);
        toast.success('Updated');
      } else {
        await api.post('/packages/', data);
        toast.success('Created');
      }
      setIsPackageDialogOpen(false);
      loadPackages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeletePackage = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/packages/${id}`);
      toast.success('Deleted');
      loadPackages();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Travel Package Management</h1>
          <p className="text-gray-600">Manage packages, bookings, analytics, and communications</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OperatorScopeFilter serviceType="packages" value={scopeOperatorId} onChange={setScopeOperatorId} />
          <Button onClick={loadPackages} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Package className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Packages"
            serviceIcon={<Package className="h-8 w-8" />}
            primaryColor="blue"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Packages"
            secondaryLabel="Avg. Duration (days)"
            secondaryCount={dashboardData.secondaryCount}
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Travel Packages</CardTitle>
              <PermissionGate permission="packages.create">
                <Button onClick={() => openPackageDialog()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> Add Package
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : packages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No packages found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map(pkg => (
                    <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">{pkg.name}</h3>
                          <Badge variant="outline" className="capitalize">{pkg.type}</Badge>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{pkg.destination}</div>
                          <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />{pkg.duration_days} days</div>
                          <div className="flex items-center gap-2"><Users className="w-4 h-4" />Max {pkg.max_participants}</div>
                        </div>
                        {pkg.inclusions?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pkg.inclusions.slice(0, 3).map(i => (
                              <Badge key={i} variant="outline" className="text-xs capitalize">{i}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 font-bold text-green-600">{formatFCFA(pkg.price)}</div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewPackage(pkg)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <PermissionGate permission="packages.edit">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openPackageDialog(pkg)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="packages.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeletePackage(pkg.id)}>
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
          <ServiceCommunicationsHub
            serviceType="Packages"
            serviceTag="packages"
            operatorId={scopeOperatorId}
            serviceIcon={<Package className="h-5 w-5 text-blue-600" />}
            primaryColor="blue"
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics packages={packages} />
        </TabsContent>
      </Tabs>

      <Dialog open={isPackageDialogOpen} onOpenChange={setIsPackageDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Package Name</Label>
              <Input value={packageForm.name} onChange={e => setPackageForm(p => ({ ...p, name: e.target.value }))} placeholder="Package name" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={packageForm.type} onValueChange={v => setPackageForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {PACKAGE_TYPES.map(type => (<SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destination</Label>
              <Input value={packageForm.destination} onChange={e => setPackageForm(p => ({ ...p, destination: e.target.value }))} placeholder="Paris, France" />
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" value={packageForm.duration_days} onChange={e => setPackageForm(p => ({ ...p, duration_days: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Price (FCFA)</Label>
              <Input type="number" value={packageForm.price} onChange={e => setPackageForm(p => ({ ...p, price: e.target.value }))} placeholder="500000" />
            </div>
            <div className="col-span-2">
              <Label>Inclusions</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INCLUSIONS.map(inclusion => (
                  <Badge
                    key={inclusion}
                    variant={packageForm.inclusions?.includes(inclusion) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setPackageForm(p => ({
                        ...p,
                        inclusions: p.inclusions?.includes(inclusion)
                          ? p.inclusions.filter(i => i !== inclusion)
                          : [...(p.inclusions || []), inclusion]
                      }));
                    }}
                  >
                    {inclusion.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={packageForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setPackageForm(p => ({ 
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
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={packageForm.description} onChange={e => setPackageForm(p => ({ ...p, description: e.target.value }))} placeholder="Package description..." />
            </div>
            <div className="col-span-2">
              <Label>Highlights</Label>
              <Textarea value={packageForm.highlights} onChange={e => setPackageForm(p => ({ ...p, highlights: e.target.value }))} placeholder="Key highlights..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPackageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePackage} className="bg-[#082c59]">{editingPackage ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Package Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              Package Details
            </DialogTitle>
          </DialogHeader>
          {viewingPackage && (
            <div className="space-y-4 py-4">
              <div className="bg-indigo-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-indigo-900">{viewingPackage.name}</h3>
                <Badge className="mt-1 capitalize">{viewingPackage.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Destination</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingPackage.destination || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Duration</p>
                  <p className="font-medium">{viewingPackage.duration || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Group Size</p>
                  <p className="font-medium">{viewingPackage.max_participants || 'N/A'} max</p>
                </div>
                <div>
                  <p className="text-slate-500">Price</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingPackage.price)}</p>
                </div>
              </div>
              {viewingPackage.inclusions?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">What&apos;s Included</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingPackage.inclusions.map(i => (
                      <Badge key={i} variant="outline" className="text-xs capitalize">{i}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingPackage.highlights && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Highlights</p>
                  <p className="text-sm bg-amber-50 p-3 rounded text-amber-800">{viewingPackage.highlights}</p>
                </div>
              )}
              {viewingPackage.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingPackage.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openPackageDialog(viewingPackage); setIsViewDialogOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
