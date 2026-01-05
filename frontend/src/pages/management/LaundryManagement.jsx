import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Shirt, Plus, Edit, Trash2, MapPin, Clock, DollarSign, Package,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Users, Droplets, Eye
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
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

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

const ExecutiveDashboard = ({ pressings }) => {
  const dashboardData = useMemo(() => {
    const totalShops = pressings.length;
    const avgPrice = pressings.length > 0
      ? Math.round(pressings.reduce((sum, p) => sum + (p.price_per_kg || 0), 0) / pressings.length)
      : 0;

    const serviceDistribution = {};
    pressings.forEach(p => {
      (p.services || []).forEach(s => {
        serviceDistribution[s] = (serviceDistribution[s] || 0) + 1;
      });
    });

    const serviceData = Object.entries(serviceDistribution).map(([name, value], i) => ({
      name: name.replace('_', ' ').charAt(0).toUpperCase() + name.replace('_', ' ').slice(1),
      value,
      color: ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'][i % 6]
    }));

    const weeklyOrders = Array.from({ length: 7 }, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      orders: Math.floor(Math.random() * 50) + 20,
      revenue: Math.floor(Math.random() * 150000) + 30000
    }));

    return { totalShops, avgPrice, serviceData, weeklyOrders };
  }, [pressings]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-600 mb-1">Total Shops</p>
                <p className="text-2xl font-bold text-cyan-900">{dashboardData.totalShops}</p>
              </div>
              <div className="bg-cyan-200 rounded-full p-3">
                <Shirt className="h-6 w-6 text-cyan-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Avg. Price/kg</p>
                <p className="text-2xl font-bold text-blue-900">{formatFCFA(dashboardData.avgPrice)}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <DollarSign className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Today's Orders</p>
                <p className="text-2xl font-bold text-purple-900">47</p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <Package className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Completion Rate</p>
                <p className="text-2xl font-bold text-green-900">94%</p>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <TrendingUp className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-cyan-600" />
              Weekly Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.weeklyOrders}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-purple-600" />
              Services Offered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {dashboardData.serviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardData.serviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {dashboardData.serviceData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CommunicationsHub = ({ user }) => {
  const [messages] = useState([
    { id: 1, from: 'Customer', subject: 'Express order request', time: '30 min ago', unread: true },
    { id: 2, from: 'System', subject: 'Low inventory alert - detergent', time: '2 hours ago', unread: true },
    { id: 3, from: 'Staff', subject: 'Machine maintenance required', time: '1 day ago', unread: false }
  ]);

  const [announcementText, setAnnouncementText] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-lg border ${msg.unread ? 'bg-cyan-50 border-cyan-200' : 'bg-white'}`}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-sm">{msg.from}</p>
                    <p className="text-xs text-slate-600">{msg.subject}</p>
                  </div>
                  <span className="text-xs text-slate-500">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Send Announcement</Label>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Type announcement..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} />
              <Button className="bg-[#082c59]" onClick={() => { toast.success('Sent!'); setAnnouncementText(''); }}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="pt-4 space-y-2">
            <Button variant="outline" className="w-full justify-start"><Bell className="mr-2 h-4 w-4" /> Create Promotion</Button>
            <Button variant="outline" className="w-full justify-start"><Package className="mr-2 h-4 w-4" /> Track Orders</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const BusinessAnalytics = ({ pressings }) => {
  const analyticsData = useMemo(() => {
    const monthlyTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
      month,
      orders: Math.floor(Math.random() * 300) + 100,
      revenue: Math.floor(Math.random() * 800000) + 200000
    }));

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

  const handleViewPressing = (pressing) => {
    setViewingPressing(pressing);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(pressing.id, pressing.name);
  };

  const loadPressings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/pressing/');
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
  }, []);

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
        <Button onClick={loadPressings} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Shirt className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard pressings={pressings} />
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
                            {pressing.services.slice(0, 3).map(s => (
                              <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
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

        <TabsContent value="communications" className="mt-6">
          <CommunicationsHub user={user} />
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
                {SERVICES.map(service => (
                  <Badge
                    key={service}
                    variant={pressingForm.services?.includes(service) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setPressingForm(p => ({
                        ...p,
                        services: p.services?.includes(service)
                          ? p.services.filter(s => s !== service)
                          : [...(p.services || []), service]
                      }));
                    }}
                  >
                    {service.replace('_', ' ')}
                  </Badge>
                ))}
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
                    {viewingPressing.services.map(s => (
                      <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
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
    </div>
  );
}
