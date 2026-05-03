import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  UtensilsCrossed, Plus, Edit, Trash2, MapPin, Clock, Users, DollarSign,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Calendar, PartyPopper, Sparkles, Eye, Banknote, Receipt,
  Replace as ReplaceIcon,
} from 'lucide-react';
import WalkInBookingModal from '@/components/management/shared/WalkInBookingModal';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
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
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import { Search } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const PAGE_SIZE = 12;

const CHART_COLORS = ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
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

// Banquet specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

// Business Analytics Component
const BusinessAnalytics = ({ banquets }) => {
  const analyticsData = useMemo(() => {
    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', events: 8, revenue: 2500000 },
      { month: 'Feb', events: 12, revenue: 3800000 },
      { month: 'Mar', events: 15, revenue: 4850000 },
      { month: 'Apr', events: 11, revenue: 3550000 },
      { month: 'May', events: 18, revenue: 6200000 },
      { month: 'Jun', events: 22, revenue: 7800000 }
    ];

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
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [replaceBanquet, setReplaceBanquet] = useState(null);

  // Use the banquet dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [banquetSearch, setBanquetSearch] = useState('');
  const [banquetPage, setBanquetPage] = useState(1);
  const dashboardData = useRealDashboardData('banquets', '30days', scopeOperatorId);

  const filteredBanquets = useMemo(() => {
    if (!banquetSearch) return banquets;
    const s = banquetSearch.toLowerCase();
    return banquets.filter(b =>
      (b.name || '').toLowerCase().includes(s) ||
      (b.city || '').toLowerCase().includes(s) ||
      (b.address || b.venue || '').toLowerCase().includes(s)
    );
  }, [banquets, banquetSearch]);
  useEffect(() => { setBanquetPage(1); }, [banquetSearch]);
  const banquetTotalPages = Math.max(1, Math.ceil(filteredBanquets.length / PAGE_SIZE));
  const pagedBanquets = useMemo(
    () => filteredBanquets.slice((banquetPage - 1) * PAGE_SIZE, banquetPage * PAGE_SIZE),
    [filteredBanquets, banquetPage]
  );

  const handleViewBanquet = (banquet) => {
    setViewingBanquet(banquet);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(banquet.id, banquet.name);
  };

  const loadBanquets = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/banquets/${params}`);
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
  }, [scopeOperatorId]);

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
        <div className="flex items-center gap-2 flex-wrap">
          <OperatorScopeFilter serviceType="banquet" value={scopeOperatorId} onChange={setScopeOperatorId} />
          <Button
            onClick={() => setIsWalkInOpen(true)}
            className="bg-[#082c59] hover:bg-[#0a366d]"
            data-testid="open-walkin-booking-btn"
          >
            <Banknote className="h-4 w-4 mr-2" /> Walk-in Booking
          </Button>
          <Button onClick={loadBanquets} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><UtensilsCrossed className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings"><Receipt className="h-4 w-4 mr-2" />Bookings</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Banquet"
            serviceIcon={<UtensilsCrossed className="h-8 w-8" />}
            primaryColor="pink"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Halls"
            secondaryLabel="Total Capacity"
            secondaryCount={dashboardData.secondaryCount}
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search halls by name, city, address..."
                value={banquetSearch}
                onChange={(e) => setBanquetSearch(e.target.value)}
                className="pl-10 bg-white"
                data-testid="banquets-search-input"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <PermissionGate permission="banquets.create">
                <Button onClick={() => openBanquetDialog()} className="bg-[#082c59]" data-testid="add-banquet-btn">
                  <Plus className="w-4 h-4 mr-2" /> Add Hall
                </Button>
              </PermissionGate>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredBanquets.length === 0 ? (
            <Card className="p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">{banquetSearch ? 'No halls match your search' : 'No halls found.'}</p>
            </Card>
          ) : viewMode === 'list' ? (
            <Card className="overflow-hidden" data-testid="banquets-list-view">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Hall</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBanquets.map(banquet => (
                      <tr key={banquet.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{banquet.name}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{banquet.type || banquet.venue_type || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{(banquet.address || banquet.venue || '—')}{banquet.city ? `, ${banquet.city}` : ''}</td>
                        <td className="px-4 py-3 text-slate-700">{banquet.capacity_min || 0}–{banquet.capacity_max || banquet.capacity || 0}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{formatFCFA(banquet.price_per_person || banquet.base_price || 0)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleViewBanquet(banquet)}>View</Button>
                            <PermissionGate permission="banquets.edit">
                              <Button size="sm" variant="ghost" onClick={() => openBanquetDialog(banquet)}>Edit</Button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className={viewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`banquets-${viewMode}-view`}>
              {pagedBanquets.map(banquet => (
                <Card key={banquet.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">{banquet.name}</h3>
                      <Badge variant="outline" className="capitalize">{banquet.type || banquet.venue_type}</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{banquet.address || banquet.venue}{banquet.city ? `, ${banquet.city}` : ''}</div>
                      <div className="flex items-center gap-2"><Users className="w-4 h-4" />{banquet.capacity_max || banquet.capacity || 0} guests max</div>
                      {viewMode === 'details' && banquet.description && (
                        <p className="text-slate-600 text-sm pt-2 border-t border-slate-100">{banquet.description}</p>
                      )}
                    </div>
                    {banquet.services_included?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {banquet.services_included.slice(0, viewMode === 'details' ? 8 : 3).map(s => (
                          <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 font-bold text-green-600">{formatFCFA(banquet.price_per_person || banquet.base_price || 0)}{banquet.price_per_person ? '/person' : ''}</div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => handleViewBanquet(banquet)} title="View Details">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <PermissionGate permission="banquets.edit">
                        <Button size="sm" variant="outline" onClick={() => setReplaceBanquet(banquet)} title="Migrate bookings" className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`replace-banquet-btn-${banquet.id}`}>
                          <ReplaceIcon className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
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

          <Pagination
            page={banquetPage}
            totalPages={banquetTotalPages}
            onChange={setBanquetPage}
            total={filteredBanquets.length}
            pageSize={PAGE_SIZE}
            itemLabel="hall"
          />
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <OperatorBookingsList serviceType="banquet" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Banquet"
            serviceTag="banquets"
            operatorId={scopeOperatorId}
            serviceIcon={<UtensilsCrossed className="h-5 w-5 text-pink-600" />}
            primaryColor="pink"
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics banquets={banquets} />
        </TabsContent>
      </Tabs>

      <ServiceFormShell
        open={isBanquetDialogOpen}
        onOpenChange={setIsBanquetDialogOpen}
        icon={PartyPopper}
        title={editingBanquet ? 'Edit Hall' : 'Add Banquet Hall'}
        subtitle={editingBanquet
          ? 'Refresh capacity, pricing, services and gallery photos.'
          : 'List a new banquet venue — photos, capacity, pricing and bundled services.'}
        editing={!!editingBanquet}
        accent="pink"
        leftColumn={
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Hall photos</Label>
              <div className="mt-2">
                <MiniImageUploader
                  images={banquetForm.images || []}
                  onChange={(imgs) => setBanquetForm(p => ({ ...p, images: imgs }))}
                  max={3}
                  folder="banquets"
                  accent="pink"
                  helperText="Up to 3 photos. The first is the cover."
                />
              </div>
            </div>
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
        }
        preview={
          <GenericPreviewCard
            cover={(banquetForm.images || [])[0]}
            thumbs={(banquetForm.images || []).slice(1, 3)}
            icon={PartyPopper}
            badgeText={(banquetForm.type || 'banquet').replace('_', ' ')}
            badgeClass="bg-pink-500 text-white"
            placeholderColor="from-pink-600 via-rose-500 to-fuchsia-500"
            title={banquetForm.name || 'Hall name'}
            subtitle={banquetForm.venue || 'Venue'}
            location={[banquetForm.city, banquetForm.capacity ? `Up to ${banquetForm.capacity} guests` : null].filter(Boolean).join(' · ') || 'City · Capacity'}
            tags={banquetForm.services_included || []}
            tagsAccentClass="bg-pink-50 text-pink-700"
            priceLabel="Per guest"
            priceValue={banquetForm.price_per_person ? `${Number(banquetForm.price_per_person).toLocaleString()} FCFA` : '—'}
            accentTextClass="text-pink-700"
          />
        }
        submitting={false}
        submitLabel={editingBanquet ? 'Update Hall' : 'Add Hall'}
        onSubmit={handleSaveBanquet}
        submitDataTestId="save-banquet-btn"
      />

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

      <WalkInBookingModal
        open={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        serviceType="banquet"
        services={banquets.map((b) => ({ id: b.id, name: b.name, price: b.price_per_person }))}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          setActiveTab('bookings');
        }}
      />

      <ReplaceResourceModal
        open={!!replaceBanquet}
        onClose={() => setReplaceBanquet(null)}
        serviceType="banquet"
        oldResource={replaceBanquet}
        allResources={banquets}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadBanquets?.();
        }}
      />
    </div>
  );
}
