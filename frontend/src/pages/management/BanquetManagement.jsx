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
  UtensilsCrossed, Plus, Edit, Trash2, MapPin, Clock, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Calendar, PartyPopper, Sparkles, Eye
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

const BANQUET_TYPES = ['wedding', 'corporate', 'birthday', 'anniversary', 'graduation', 'conference', 'gala'];
const SERVICES_INCLUDED = ['catering', 'decoration', 'entertainment', 'photography', 'sound_system', 'lighting', 'valet_parking'];

const DEFAULT_BANQUET_FORM = {
  name: '',
  description: '',
  venue_type: 'hall',
  address: '',
  city: '',
  capacity_min: 50,
  capacity_max: 200,
  base_price: '',
  price_type: 'per_event',
  amenities: [],
  images: [],
  phone: '',
  email: '',
  operator_id: '',
  operator_name: ''
};

const ExecutiveDashboard = ({ banquets }) => {
  const dashboardData = useMemo(() => {
    const totalBanquets = banquets.length;
    const totalCapacity = banquets.reduce((sum, b) => sum + (b.capacity || 0), 0);
    const avgPrice = banquets.length > 0
      ? Math.round(banquets.reduce((sum, b) => sum + (b.price_per_person || 0), 0) / banquets.length)
      : 0;

    const typeDistribution = {};
    banquets.forEach(b => {
      const type = b.type || 'other';
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    const typeData = Object.entries(typeDistribution).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'][i % 6]
    }));

    const weeklyBookings = Array.from({ length: 7 }, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      bookings: Math.floor(Math.random() * 8) + 2,
      revenue: Math.floor(Math.random() * 1500000) + 300000
    }));

    return { totalBanquets, totalCapacity, avgPrice, typeData, weeklyBookings };
  }, [banquets]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-600 mb-1">Total Halls</p>
                <p className="text-2xl font-bold text-pink-900">{dashboardData.totalBanquets}</p>
              </div>
              <div className="bg-pink-200 rounded-full p-3">
                <UtensilsCrossed className="h-6 w-6 text-pink-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Total Capacity</p>
                <p className="text-2xl font-bold text-purple-900">{dashboardData.totalCapacity.toLocaleString()}</p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <Users className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 mb-1">Avg. Price/Person</p>
                <p className="text-2xl font-bold text-yellow-900">{formatFCFA(dashboardData.avgPrice)}</p>
              </div>
              <div className="bg-yellow-200 rounded-full p-3">
                <DollarSign className="h-6 w-6 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">This Month</p>
                <p className="text-2xl font-bold text-green-900">12 Events</p>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <PartyPopper className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-pink-600" />
              Weekly Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.weeklyBookings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="#EC4899" radius={[4, 4, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Events by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {dashboardData.typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardData.typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {dashboardData.typeData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
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
    { id: 1, from: 'Client', subject: 'Wedding reception inquiry - 200 guests', time: '1 hour ago', unread: true },
    { id: 2, from: 'Vendor', subject: 'Catering quote submitted', time: '3 hours ago', unread: true },
    { id: 3, from: 'Staff', subject: 'Setup complete for Saturday event', time: '1 day ago', unread: false }
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
              <div key={msg.id} className={`p-3 rounded-lg border ${msg.unread ? 'bg-pink-50 border-pink-200' : 'bg-white'}`}>
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
            <Button variant="outline" className="w-full justify-start"><Bell className="mr-2 h-4 w-4" /> Create Package Deal</Button>
            <Button variant="outline" className="w-full justify-start"><Calendar className="mr-2 h-4 w-4" /> View Calendar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const BusinessAnalytics = ({ banquets }) => {
  const analyticsData = useMemo(() => {
    const monthlyTrend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
      month,
      events: Math.floor(Math.random() * 15) + 5,
      revenue: Math.floor(Math.random() * 5000000) + 1000000
    }));

    return { monthlyTrend };
  }, [banquets]);

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
                <Line yAxisId="left" type="monotone" dataKey="events" stroke="#EC4899" strokeWidth={2} name="Events" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function BanquetManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [banquets, setBanquets] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBanquetDialogOpen, setIsBanquetDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingBanquet, setViewingBanquet] = useState(null);
  const [editingBanquet, setEditingBanquet] = useState(null);
  const [banquetForm, setBanquetForm] = useState(DEFAULT_BANQUET_FORM);

  const handleViewBanquet = (banquet) => {
    setViewingBanquet(banquet);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(banquet.id, banquet.name);
  };

  const loadBanquets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/banquets/');
      setBanquets(res.data.banquets || res.data || []);
      
      // Load operators
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setBanquets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanquets();
  }, [loadBanquets]);

  const openBanquetDialog = (banquet = null) => {
    setEditingBanquet(banquet);
    setBanquetForm(banquet ? { 
      ...banquet, 
      price_per_person: banquet.price_per_person?.toString() || '',
      operator_id: banquet.operator_id || '',
      operator_name: banquet.operator_name || ''
    } : DEFAULT_BANQUET_FORM);
    setIsBanquetDialogOpen(true);
  };

  const handleSaveBanquet = async () => {
    try {
      const operator = operators.find(op => (op._id || op.id) === banquetForm.operator_id);
      const data = { 
        ...banquetForm, 
        base_price: parseFloat(banquetForm.base_price) || 0,
        capacity_min: parseInt(banquetForm.capacity_min) || 10,
        capacity_max: parseInt(banquetForm.capacity_max) || 100,
        operator_name: operator?.name || banquetForm.operator_name || ''
      };
      if (editingBanquet) {
        await api.put(`/banquets/${editingBanquet.id}`, data);
        toast.success('Updated');
      } else {
        await api.post('/banquets/', data);
        toast.success('Created');
      }
      setIsBanquetDialogOpen(false);
      loadBanquets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteBanquet = async (id) => {
    if (!confirm('Delete?')) return;
    try {
      await api.delete(`/banquets/${id}`);
      toast.success('Deleted');
      loadBanquets();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Banquet Hall Management</h1>
          <p className="text-gray-600">Manage halls, events, analytics, and communications</p>
        </div>
        <Button onClick={loadBanquets} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><UtensilsCrossed className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ExecutiveDashboard banquets={banquets} />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Banquet Halls</CardTitle>
              <PermissionGate permission="banquets.create">
                <Button onClick={() => openBanquetDialog()} className="bg-[#082c59]">
                  <Plus className="w-4 h-4 mr-2" /> Add Hall
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : banquets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No halls found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banquets.map(banquet => (
                    <Card key={banquet.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">{banquet.name}</h3>
                          <Badge variant="outline" className="capitalize">{banquet.type}</Badge>
                        </div>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{banquet.venue}, {banquet.city}</div>
                          <div className="flex items-center gap-2"><Users className="w-4 h-4" />{banquet.capacity} guests max</div>
                        </div>
                        {banquet.services_included?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {banquet.services_included.slice(0, 3).map(s => (
                              <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 font-bold text-green-600">{formatFCFA(banquet.price_per_person)}/person</div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewBanquet(banquet)} title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <PermissionGate permission="banquets.edit">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openBanquetDialog(banquet)}>
                              <Edit className="w-4 h-4 mr-1" /> Edit
                            </Button>
                          </PermissionGate>
                          <PermissionGate permission="banquets.delete">
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteBanquet(banquet.id)}>
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
          <BusinessAnalytics banquets={banquets} />
        </TabsContent>
      </Tabs>

      <Dialog open={isBanquetDialogOpen} onOpenChange={setIsBanquetDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanquet ? 'Edit Hall' : 'Add Hall'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Hall Name</Label>
              <Input value={banquetForm.name} onChange={e => setBanquetForm(p => ({ ...p, name: e.target.value }))} placeholder="Hall name" />
            </div>
            <div>
              <Label>Event Type</Label>
              <select
                value={banquetForm.type}
                onChange={e => setBanquetForm(p => ({ ...p, type: e.target.value }))}
                className="w-full h-10 border rounded-md px-3 bg-white"
              >
                {BANQUET_TYPES.map(type => (<option key={type} value={type} className="capitalize">{type}</option>))}
              </select>
            </div>
            <div>
              <Label>Venue</Label>
              <Input value={banquetForm.venue} onChange={e => setBanquetForm(p => ({ ...p, venue: e.target.value }))} placeholder="Venue name" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={banquetForm.city} onChange={e => setBanquetForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
            </div>
            <div>
              <Label>Capacity</Label>
              <Input type="number" value={banquetForm.capacity} onChange={e => setBanquetForm(p => ({ ...p, capacity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Price/Person (FCFA)</Label>
              <Input type="number" value={banquetForm.price_per_person} onChange={e => setBanquetForm(p => ({ ...p, price_per_person: e.target.value }))} placeholder="15000" />
            </div>
            <div>
              <Label>Min. Guests</Label>
              <Input type="number" value={banquetForm.minimum_guests} onChange={e => setBanquetForm(p => ({ ...p, minimum_guests: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="col-span-2">
              <Label>Services Included</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SERVICES_INCLUDED.map(service => (
                  <Badge
                    key={service}
                    variant={banquetForm.services_included?.includes(service) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => {
                      setBanquetForm(p => ({
                        ...p,
                        services_included: p.services_included?.includes(service)
                          ? p.services_included.filter(s => s !== service)
                          : [...(p.services_included || []), service]
                      }));
                    }}
                  >
                    {service.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Operator</Label>
              <Select 
                value={banquetForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setBanquetForm(p => ({ 
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
              <Textarea value={banquetForm.description} onChange={e => setBanquetForm(p => ({ ...p, description: e.target.value }))} placeholder="Description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBanquetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBanquet} className="bg-[#082c59]">{editingBanquet ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Banquet Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-pink-600" />
              Banquet Hall Details
            </DialogTitle>
          </DialogHeader>
          {viewingBanquet && (
            <div className="space-y-4 py-4">
              <div className="bg-pink-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-pink-900">{viewingBanquet.name}</h3>
                <Badge className="mt-1 capitalize">{viewingBanquet.venue_type}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingBanquet.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">{viewingBanquet.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Capacity</p>
                  <p className="font-medium">{viewingBanquet.capacity} guests</p>
                </div>
                <div>
                  <p className="text-slate-500">Price/Person</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingBanquet.price_per_person)}</p>
                </div>
              </div>
              {viewingBanquet.services_included?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Services Included</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingBanquet.services_included.map(s => (
                      <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingBanquet.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingBanquet.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { openBanquetDialog(viewingBanquet); setIsViewDialogOpen(false); }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
