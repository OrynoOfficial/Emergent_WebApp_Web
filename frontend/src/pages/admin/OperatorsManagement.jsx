import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building, Plus, Search, Edit, Trash2, Eye, Ban, CheckCircle,
  Phone, Mail, MapPin, Clock, Star, TrendingUp, Users, Calendar, DollarSign, UserCog, Shield
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate } from '@/utils/dateUtils';
import api from '@/api/client';
import { toast } from 'sonner';
import OperatorTeamManagement from '@/components/management/OperatorTeamManagement';
import OperatorRolesManagement from '@/components/management/OperatorRolesManagement';

const OPERATOR_STATUS = ['all', 'active', 'pending', 'suspended', 'inactive'];
const SERVICE_TYPES = ['all', 'hotels', 'travel', 'car_rental', 'restaurants', 'events', 'cinema', 'laundry', 'banquet'];

export default function OperatorsManagement() {
  const { user: currentUser } = useAuth();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    operator_type: 'travel',
    service_types: ['travel'],
    country: 'CM',
    region: '',
    market_segment: 'sme'
  });
  
  // Geography data
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [editRegions, setEditRegions] = useState([]);

  const currentUserRole = currentUser?.role || 'customer';
  const canManageOperators = ['admin', 'super_admin'].includes(currentUserRole);

  useEffect(() => {
    loadOperators();
    loadGeography();
  }, []);

  const loadOperators = async () => {
    try {
      setLoading(true);
      const res = await api.get('/operators/');
      const data = res.data.operators || res.data || [];
      setOperators(data);
    } catch (error) {
      console.error('Failed to load operators:', error);
      setOperators([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGeography = async () => {
    try {
      const res = await api.get('/geography/countries');
      setCountries(res.data.countries || []);
      // Load default regions for CM
      const regRes = await api.get('/geography/regions', { params: { country_code: 'CM' } });
      setRegions(regRes.data.regions || []);
    } catch { /* geography is optional */ }
  };

  const loadRegionsForCountry = async (countryCode, target = 'create') => {
    try {
      const res = await api.get('/geography/regions', { params: { country_code: countryCode } });
      const data = res.data.regions || [];
      if (target === 'edit') setEditRegions(data);
      else setRegions(data);
    } catch {
      if (target === 'edit') setEditRegions([]);
      else setRegions([]);
    }
  };

  const getCountryName = (code) => countries.find(c => c.code === code)?.name || code || '-';
  const getRegionName = (code) => {
    const all = [...regions, ...editRegions];
    return all.find(r => r.code === code)?.name || code || '-';
  };

  const filteredOperators = operators.filter(op => {
    const matchesSearch = op.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || op.status === statusFilter;
    const matchesService = serviceFilter === 'all' || op.service_types?.includes(serviceFilter);
    return matchesSearch && matchesStatus && matchesService;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={styles[status] || styles.inactive}>{status}</Badge>;
  };

  const handleView = (operator) => {
    setSelectedOperator(operator);
    setIsDetailOpen(true);
  };

  const handleEdit = (operator) => {
    setSelectedOperator(operator);
    // Normalize country to code (operators may have full name "Cameroon" instead of "CM")
    // Map common country names to codes
    const countryNameToCode = {
      'Cameroon': 'CM',
      'Nigeria': 'NG',
      'Gabon': 'GA',
      'Chad': 'TD',
      'Central African Republic': 'CF',
      'Equatorial Guinea': 'GQ'
    };
    let normalizedCountry = operator.country;
    // If it's a full name, convert to code
    if (countryNameToCode[operator.country]) {
      normalizedCountry = countryNameToCode[operator.country];
    }
    // If still no match but countries loaded, try to find it
    if (countries.length > 0) {
      const found = countries.find(c => c.code === operator.country || c.name === operator.country);
      if (found) normalizedCountry = found.code;
    }
    setEditForm({ ...operator, country: normalizedCountry || 'CM' });
    if (normalizedCountry) loadRegionsForCountry(normalizedCountry, 'edit');
    setIsEditOpen(true);
  };

  const handleDelete = (operator) => {
    setSelectedOperator(operator);
    setIsDeleteOpen(true);
  };

  const handleSuspend = (operator) => {
    setSelectedOperator(operator);
    setIsSuspendOpen(true);
  };

  const confirmSuspend = async () => {
    if (!selectedOperator) return;
    
    const operatorId = selectedOperator._id || selectedOperator.id;
    const newStatus = selectedOperator.status === 'suspended' ? 'active' : 'suspended';
    
    try {
      if (newStatus === 'suspended') {
        await api.post(`/operators/${operatorId}/suspend`);
      } else {
        // Use reactivate endpoint for suspended operators
        await api.post(`/operators/${operatorId}/reactivate`);
      }
      // Reload operators to get fresh data from server
      await loadOperators();
      toast.success(`Operator ${newStatus === 'suspended' ? 'suspended' : 'reactivated'} successfully`);
    } catch (error) {
      console.error('Failed to update operator status:', error);
      toast.error(error.response?.data?.detail || 'Failed to update operator status');
    }
    
    setIsSuspendOpen(false);
    setSelectedOperator(null);
  };

  const confirmDelete = async () => {
    if (!selectedOperator) return;
    
    const operatorId = selectedOperator._id || selectedOperator.id;
    
    try {
      await api.delete(`/operators/${operatorId}`);
      // Reload operators to get fresh data from server
      await loadOperators();
      toast.success('Operator deleted successfully');
    } catch (error) {
      console.error('Failed to delete operator:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete operator');
    }
    setIsDeleteOpen(false);
    setSelectedOperator(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedOperator) return;
    
    const operatorId = selectedOperator._id || selectedOperator.id;
    
    try {
      await api.put(`/operators/${operatorId}`, editForm);
      // Reload operators to get fresh data from server
      await loadOperators();
      toast.success('Operator updated successfully');
    } catch (error) {
      console.error('Failed to update operator:', error);
      toast.error(error.response?.data?.detail || 'Failed to update operator');
    }
    setIsEditOpen(false);
    setSelectedOperator(null);
  };

  const handleCreate = async () => {
    try {
      const res = await api.post('/operators/', createForm);
      const newOperator = {
        id: res.data?.operator_id || String(Date.now()),
        ...createForm,
        status: 'pending',
        rating: 0,
        total_bookings: 0,
        revenue: 0,
        joined_date: new Date().toISOString().split('T')[0]
      };
      setOperators(prev => [newOperator, ...prev]);
      toast.success('Operator created successfully');
    } catch (error) {
      console.error('Failed to create operator:', error);
      toast.error('Failed to create operator');
    }
    setIsCreateOpen(false);
    setCreateForm({ name: '', email: '', phone: '', city: '', operator_type: 'travel', service_types: ['travel'], country: 'CM', region: '', market_segment: 'sme' });
  };

  // Stats
  const stats = {
    total: operators.length,
    active: operators.filter(o => o.status === 'active').length,
    pending: operators.filter(o => o.status === 'pending').length,
    suspended: operators.filter(o => o.status === 'suspended').length,
    totalRevenue: operators.reduce((sum, o) => sum + (o.revenue || 0), 0)
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building className="h-6 w-6 text-[#082c59]" />
            Operator Management
          </h1>
          <p className="text-slate-500 mt-1">Manage service providers and operators</p>
        </div>
        {canManageOperators && (
          <Button className="bg-[#082c59] hover:bg-[#0a3a75]" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Operator
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-sm text-slate-500">Total Operators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                <p className="text-sm text-slate-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-sm text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
                <p className="text-sm text-slate-500">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{formatFCFA(stats.totalRevenue)}</p>
                <p className="text-sm text-slate-500">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search operators..."
            className="pl-10 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {OPERATOR_STATUS.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {SERVICE_TYPES.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Services' : s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operators Table */}
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading operators...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Operator</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Services</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Location</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Owner</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Date Joined</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Revenue</th>
                <th className="py-4 px-6 text-right text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOperators.map((operator) => (
                <tr key={operator.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#082c59]/10 rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-[#082c59]" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{operator.name}</p>
                        <p className="text-sm text-slate-500">{operator.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {operator.service_types?.slice(0, 2).map(s => (
                        <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace('_', ' ')}</Badge>
                      ))}
                      {operator.service_types?.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{operator.service_types.length - 2}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <p className="font-medium text-slate-700">{getCountryName(operator.country)}</p>
                      {operator.region && <p className="text-xs text-slate-500">{getRegionName(operator.region)}</p>}
                      {operator.market_segment && <Badge variant="outline" className="text-[10px] mt-1 capitalize">{operator.market_segment}</Badge>}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <p className="font-medium text-slate-700">{operator.owner_name || '-'}</p>
                      <p className="text-slate-500 text-xs">{operator.owner_email || ''}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1 text-slate-600 text-sm">
                      <Calendar className="h-4 w-4" />
                      {operator.created_at ? formatDate(operator.created_at) : operator.joined_date || '-'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {getStatusBadge(operator.status)}
                  </td>
                  <td className="py-4 px-6 font-medium text-slate-900">
                    {formatFCFA(operator.revenue || 0)}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleView(operator)}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4 text-blue-600" />
                      </button>
                      {canManageOperators && (
                        <>
                          <button
                            onClick={() => handleEdit(operator)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleSuspend(operator)}
                            className={`p-2 rounded-lg transition-colors ${
                              operator.status === 'suspended' 
                                ? 'hover:bg-green-100' 
                                : 'hover:bg-red-100'
                            }`}
                            title={operator.status === 'suspended' ? 'Activate' : 'Suspend'}
                          >
                            {operator.status === 'suspended' ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Ban className="h-4 w-4 text-red-600" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(operator)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOperators.length === 0 && (
            <div className="text-center py-10 text-slate-500">No operators found</div>
          )}
        </div>
      )}

      {/* View Operator Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {selectedOperator?.name || 'Operator Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedOperator && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                <TabsTrigger 
                  value="details" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-2"
                >
                  <Building className="h-4 w-4 mr-2" /> Details
                </TabsTrigger>
                <TabsTrigger 
                  value="team"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-2"
                >
                  <Users className="h-4 w-4 mr-2" /> Team
                </TabsTrigger>
                <TabsTrigger 
                  value="roles"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-2"
                >
                  <Shield className="h-4 w-4 mr-2" /> Roles
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedOperator.name}</h3>
                      {getStatusBadge(selectedOperator.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /><span>{selectedOperator.email}</span></div>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{selectedOperator.phone}</span></div>
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{selectedOperator.city}{selectedOperator.country ? `, ${getCountryName(selectedOperator.country)}` : ''}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>Joined {selectedOperator.joined_date}</span></div>
                    {selectedOperator.region && (
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><span>Region: {getRegionName(selectedOperator.region)}</span></div>
                    )}
                    {selectedOperator.market_segment && (
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-400" /><span className="capitalize">Segment: {selectedOperator.market_segment}</span></div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-[#082c59]">{selectedOperator.total_bookings?.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Total Bookings</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-[#082c59]">{formatFCFA(selectedOperator.revenue || 0)}</p>
                      <p className="text-sm text-gray-500">Revenue</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-[#082c59]">{selectedOperator.rating || '-'}</p>
                      <p className="text-sm text-gray-500">Rating</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="team" className="mt-4 max-h-[50vh] overflow-y-auto">
                <OperatorTeamManagement 
                  operatorId={selectedOperator._id || selectedOperator.id} 
                  operatorName={selectedOperator.name}
                  embedded={true}
                />
              </TabsContent>
              
              <TabsContent value="roles" className="mt-4 max-h-[50vh] overflow-y-auto">
                <OperatorRolesManagement 
                  operatorId={selectedOperator._id || selectedOperator.id} 
                  operatorName={selectedOperator.name}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Operator Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Operator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Company Name</Label>
              <Input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input value={editForm.city || ''} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {OPERATOR_STATUS.filter(s => s !== 'all').map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Geography & Segment */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Country</Label>
                <Select value={editForm.country || undefined} onValueChange={v => { setEditForm(p => ({ ...p, country: v, region: '' })); loadRegionsForCountry(v, 'edit'); }}>
                  <SelectTrigger data-testid="edit-country-select"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Region</Label>
                <Select value={editForm.region || undefined} onValueChange={v => setEditForm(p => ({ ...p, region: v }))}>
                  <SelectTrigger data-testid="edit-region-select"><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {editRegions.map(r => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                    {editRegions.length === 0 && <SelectItem value="__none__" disabled>No regions</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Market Segment</Label>
                <Select value={editForm.market_segment || 'sme'} onValueChange={v => setEditForm(p => ({ ...p, market_segment: v }))}>
                  <SelectTrigger data-testid="edit-segment-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="sme">SME</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Service Types Assignment */}
            <div>
              <Label className="text-sm font-medium">Assigned Services</Label>
              <p className="text-xs text-slate-500 mb-2">Select which services this operator can provide</p>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg">
                {SERVICE_TYPES.filter(s => s !== 'all').map(service => (
                  <label key={service} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={editForm.service_types?.includes(service) || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditForm(p => ({
                          ...p,
                          service_types: checked
                            ? [...(p.service_types || []), service]
                            : (p.service_types || []).filter(s => s !== service)
                        }));
                      }}
                      className="rounded text-[#082c59] focus:ring-[#082c59]"
                    />
                    <span className="text-sm capitalize">{service.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Primary Service Type */}
            <div>
              <Label>Primary Service Type</Label>
              <Select 
                value={editForm.operator_type || ''} 
                onValueChange={v => setEditForm(p => ({ ...p, operator_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select primary type" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {(editForm.service_types || []).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button className="bg-[#082c59]" onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Operator Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#082c59]" />
              Add New Operator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Company Name</Label>
              <Input 
                value={createForm.name} 
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} 
                placeholder="Company Name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                value={createForm.email} 
                onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} 
                placeholder="contact@company.cm"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input 
                value={createForm.phone} 
                onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} 
                placeholder="+237 600 000 000"
              />
            </div>
            <div>
              <Label>City</Label>
              <Input 
                value={createForm.city} 
                onChange={e => setCreateForm(p => ({ ...p, city: e.target.value }))} 
                placeholder="Douala"
              />
            </div>
            
            {/* Geography & Segment */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Country</Label>
                <Select value={createForm.country} onValueChange={v => { setCreateForm(p => ({ ...p, country: v, region: '' })); loadRegionsForCountry(v, 'create'); }}>
                  <SelectTrigger data-testid="create-country-select"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Region</Label>
                <Select value={createForm.region || undefined} onValueChange={v => setCreateForm(p => ({ ...p, region: v }))}>
                  <SelectTrigger data-testid="create-region-select"><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {regions.map(r => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                    {regions.length === 0 && <SelectItem value="__none__" disabled>No regions</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Market Segment</Label>
                <Select value={createForm.market_segment} onValueChange={v => setCreateForm(p => ({ ...p, market_segment: v }))}>
                  <SelectTrigger data-testid="create-segment-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="sme">SME</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Primary Service Type</Label>
              <Select 
                value={createForm.operator_type} 
                onValueChange={v => setCreateForm(p => ({ ...p, operator_type: v, service_types: [v] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {SERVICE_TYPES.filter(s => s !== 'all').map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button className="bg-[#082c59]" onClick={handleCreate}>Create Operator</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedOperator?.status === 'suspended' ? 'Activate Operator' : 'Suspend Operator'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedOperator?.status === 'suspended' ? (
              <p className="text-gray-600">
                Are you sure you want to activate <strong>{selectedOperator?.name}</strong>? 
                They will regain access to the platform.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600">
                  Are you sure you want to suspend <strong>{selectedOperator?.name}</strong>?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Warning:</strong> This will:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Disable all their services from being booked</li>
                    <li>Hide their listings from customers</li>
                    <li>Prevent them from logging in</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsSuspendOpen(false)}>Cancel</Button>
            <Button 
              className={selectedOperator?.status === 'suspended' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              onClick={confirmSuspend}
            >
              {selectedOperator?.status === 'suspended' ? 'Activate' : 'Suspend'} Operator
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{selectedOperator?.name}</strong>? 
              This action cannot be undone and will remove all associated data.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Operator</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
