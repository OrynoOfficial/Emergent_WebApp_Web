import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Phone, Mail, MapPin, Clock, Star, TrendingUp, Users, Calendar, DollarSign, UserCog, Shield,
  ChevronLeft, ChevronRight, Globe, Filter, X as XIcon
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate } from '@/utils/dateUtils';
import api from '@/api/client';
import { toast } from 'sonner';
import { AdminModal, FormField, StyledInput, StyledSelect } from '@/components/shared/AdminModal';
import OperatorTeamManagement from '@/components/management/OperatorTeamManagement';
import OperatorRolesManagement from '@/components/management/OperatorRolesManagement';

const OPERATOR_STATUS = ['all', 'active', 'pending', 'suspended', 'inactive'];
const SERVICE_TYPES = ['all', 'hotels', 'travel', 'car_rental', 'restaurants', 'events', 'cinema', 'laundry', 'banquet'];

const SERVICE_COLORS = {
  hotels: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  travel: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  car_rental: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  restaurants: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  events: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  cinema: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  laundry: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  banquet: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  package: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

const SEGMENT_COLORS_FALLBACK = {
  sme: { bg: '#3B82F620', text: '#2563EB' },
  enterprise: { bg: '#8B5CF620', text: '#7C3AED' },
  strategic: { bg: '#F59E0B20', text: '#D97706' },
};

const ITEMS_PER_PAGE = 10;

export default function OperatorsManagement() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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
    market_segment: 'sme',
    create_owner_account: false,
    owner_full_name: '',
    owner_email: '',
    owner_phone: '',
    owner_password: '',
  });
  
  // Geography data
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [editRegions, setEditRegions] = useState([]);
  const [marketSegments, setMarketSegments] = useState([]);

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
      const [countryRes, regRes, segRes] = await Promise.all([
        api.get('/geography/countries'),
        api.get('/geography/regions', { params: { country_id: 'CM' } }),
        api.get('/geography/market-segments')
      ]);
      setCountries(countryRes.data.countries || []);
      setRegions(regRes.data.regions || []);
      setMarketSegments(segRes.data.market_segments || []);
    } catch { /* geography is optional */ }
  };

  const loadRegionsForCountry = async (countryCode, target = 'create') => {
    try {
      const res = await api.get('/geography/regions', { params: { country_id: countryCode } });
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
    const matchesSearch = op.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || op.status === statusFilter;
    const matchesService = serviceFilter === 'all' || op.service_types?.includes(serviceFilter);
    const matchesOwner = !ownerFilter || op.owner_name?.toLowerCase().includes(ownerFilter.toLowerCase()) || op.owner_email?.toLowerCase().includes(ownerFilter.toLowerCase());
    const opDate = op.created_at || op.joined_date || '';
    const matchesDateFrom = !dateFrom || opDate >= dateFrom;
    const matchesDateTo = !dateTo || opDate.slice(0, 10) <= dateTo;
    return matchesSearch && matchesStatus && matchesService && matchesOwner && matchesDateFrom && matchesDateTo;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOperators.length / ITEMS_PER_PAGE);
  const paginatedOperators = filteredOperators.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, serviceFilter, ownerFilter, dateFrom, dateTo]);

  const getServiceBadge = (service) => {
    const colors = SERVICE_COLORS[service] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    return <Badge key={service} className={`${colors.bg} ${colors.text} ${colors.border} border text-xs capitalize`}>{service.replace('_', ' ')}</Badge>;
  };

  const getSegmentBadge = (segment) => {
    const dynSeg = marketSegments.find(s => s.id === segment);
    if (dynSeg?.color) {
      return <Badge className="text-[10px] capitalize border" style={{ backgroundColor: dynSeg.color + '20', color: dynSeg.color, borderColor: dynSeg.color + '40' }}>{dynSeg.name || segment}</Badge>;
    }
    const fb = SEGMENT_COLORS_FALLBACK[segment];
    if (fb) {
      return <Badge className="text-[10px] capitalize border" style={{ backgroundColor: fb.bg, color: fb.text, borderColor: fb.text + '40' }}>{segment}</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-700 text-[10px] capitalize">{segment}</Badge>;
  };

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
      await loadOperators();
      let msg = 'Operator created successfully';
      if (res.data?.owner_account_created) {
        msg += `. Owner account created: ${res.data.owner_email} (password: ${res.data.default_password})`;
      }
      toast.success(msg);
    } catch (error) {
      console.error('Failed to create operator:', error);
      toast.error(error.response?.data?.detail || 'Failed to create operator');
    }
    setIsCreateOpen(false);
    setCreateForm({ name: '', email: '', phone: '', city: '', operator_type: 'travel', service_types: ['travel'], country: 'CM', region: '', market_segment: 'sme', create_owner_account: false, owner_full_name: '', owner_email: '', owner_phone: '', owner_password: '' });
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
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="operator-management-title">Operator Management</h1>
          <p className="text-slate-500 mt-1">Manage service providers and operators</p>
        </div>
        {canManageOperators && (
          <Button className="bg-[#082c59] hover:bg-[#0a3a75]" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Operator
          </Button>
        )}
      </div>

      {/* Sub-page tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1" data-testid="operator-management-tabs">
        <button onClick={() => navigate('/admin/operators')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname === '/admin/operators' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-operators">
          <Building className="w-4 h-4 inline mr-1.5 -mt-0.5" />Operators
        </button>
        <button onClick={() => navigate('/admin/operators/geography')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname.includes('/geography') ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-geography">
          <Globe className="w-4 h-4 inline mr-1.5 -mt-0.5" />Geography
        </button>
        <button onClick={() => navigate('/admin/operators/market-segments')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname.includes('/market-segments') ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-market-segments">
          <TrendingUp className="w-4 h-4 inline mr-1.5 -mt-0.5" />Market Segments
        </button>
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
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search operators..."
              className="pl-10 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="operator-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-white" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {OPERATOR_STATUS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-40 bg-white" data-testid="service-filter">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {SERVICE_TYPES.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Services' : s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={showFilters ? 'default' : 'outline'} size="sm" className={`gap-1.5 ${showFilters ? 'bg-[#082c59]' : ''}`} onClick={() => setShowFilters(p => !p)} data-testid="more-filters-btn">
            <Filter className="h-4 w-4" /> Filters
            {(ownerFilter || dateFrom || dateTo) && <Badge className="bg-white/20 text-xs ml-1 h-5 w-5 flex items-center justify-center rounded-full p-0">{[ownerFilter, dateFrom, dateTo].filter(Boolean).length}</Badge>}
          </Button>
          {(ownerFilter || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="text-slate-500 gap-1" onClick={() => { setOwnerFilter(''); setDateFrom(''); setDateTo(''); }} data-testid="clear-filters-btn">
              <XIcon className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200" data-testid="expanded-filters">
            <div className="min-w-[180px]">
              <Label className="text-xs text-slate-500 mb-1 block">Owner</Label>
              <Input placeholder="Filter by owner..." value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="bg-white h-9 text-sm" data-testid="owner-filter" />
            </div>
            <div className="min-w-[150px]">
              <Label className="text-xs text-slate-500 mb-1 block">Joined From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-white h-9 text-sm" data-testid="date-from-filter" />
            </div>
            <div className="min-w-[150px]">
              <Label className="text-xs text-slate-500 mb-1 block">Joined To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-white h-9 text-sm" data-testid="date-to-filter" />
            </div>
          </div>
        )}
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
              {paginatedOperators.map((operator) => (
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
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {operator.service_types?.slice(0, 2).map(s => getServiceBadge(s))}
                      {operator.service_types?.length > 2 && (
                        <div className="relative group">
                          <Badge variant="outline" className="text-xs cursor-pointer hover:bg-slate-100">+{operator.service_types.length - 2}</Badge>
                          <div className="absolute z-50 left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border rounded-lg shadow-lg min-w-[160px]">
                            {operator.service_types.slice(2).map(s => getServiceBadge(s))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm">
                      <p className="font-medium text-slate-700">{getCountryName(operator.country)}</p>
                      {operator.region && <p className="text-xs text-slate-500">{getRegionName(operator.region)}</p>}
                      {operator.market_segment && getSegmentBadge(operator.market_segment)}
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
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t" data-testid="pagination">
              <p className="text-sm text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredOperators.length)} of {filteredOperators.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="prev-page">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" className={page === currentPage ? 'bg-[#082c59]' : ''} onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="next-page">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Operator Dialog */}
      <AdminModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        title={selectedOperator?.name || 'Operator Details'}
        subtitle={selectedOperator?.email}
        icon={<Building className="w-5 h-5 text-white" />}
        accentColor="blue"
        size="xl"
      >
        {selectedOperator && (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-4">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 rounded-none px-4 py-2.5 font-medium">
                <Building className="h-4 w-4 mr-2" /> Details
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 rounded-none px-4 py-2.5 font-medium">
                <Users className="h-4 w-4 mr-2" /> Team
              </TabsTrigger>
              <TabsTrigger value="roles" className="data-[state=active]:border-b-2 data-[state=active]:border-violet-600 data-[state=active]:text-violet-700 rounded-none px-4 py-2.5 font-medium">
                <Shield className="h-4 w-4 mr-2" /> Roles
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-2">
              <div className="space-y-6">
                {/* Hero Card */}
                <div className="flex items-center gap-5 p-5 bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl border border-blue-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Building className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900">{selectedOperator.name}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      {getStatusBadge(selectedOperator.status)}
                      {selectedOperator.market_segment && getSegmentBadge(selectedOperator.market_segment)}
                      {selectedOperator.operator_type && getServiceBadge(selectedOperator.operator_type)}
                    </div>
                  </div>
                  {selectedOperator.owner_name && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Owner</p>
                      <p className="text-sm font-semibold text-slate-700">{selectedOperator.owner_name}</p>
                    </div>
                  )}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-500" />
                    <div><p className="text-xs text-slate-400">Email</p><p className="text-sm font-medium">{selectedOperator.email || '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <div><p className="text-xs text-slate-400">Phone</p><p className="text-sm font-medium">{selectedOperator.phone || '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <div><p className="text-xs text-slate-400">Location</p><p className="text-sm font-medium">{selectedOperator.city}{selectedOperator.country ? `, ${getCountryName(selectedOperator.country)}` : ''}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Globe className="w-4 h-4 text-amber-500" />
                    <div><p className="text-xs text-slate-400">Region</p><p className="text-sm font-medium">{selectedOperator.region ? getRegionName(selectedOperator.region) : '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-violet-500" />
                    <div><p className="text-xs text-slate-400">Joined</p><p className="text-sm font-medium">{selectedOperator.joined_date || '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-teal-500" />
                    <div><p className="text-xs text-slate-400">Segment</p>
                      <div className="mt-0.5">{selectedOperator.market_segment ? getSegmentBadge(selectedOperator.market_segment) : <span className="text-sm">-</span>}</div>
                    </div>
                  </div>
                </div>

                {/* Services */}
                {selectedOperator.service_types?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">Assigned Services</p>
                    <div className="flex flex-wrap gap-2">{selectedOperator.service_types.map(s => getServiceBadge(s))}</div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <p className="text-2xl font-bold text-blue-700">{selectedOperator.total_bookings?.toLocaleString() || '0'}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Total Bookings</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <p className="text-2xl font-bold text-emerald-700">{formatFCFA(selectedOperator.revenue || 0)}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Revenue</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                    <p className="text-2xl font-bold text-amber-700">{selectedOperator.rating || '-'}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Rating</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="team" className="mt-2 max-h-[55vh] overflow-y-auto">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 mb-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Users className="w-5 h-5" />
                  <span className="font-semibold">Team Members</span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">Manage team members and their roles within this operator</p>
              </div>
              <OperatorTeamManagement 
                operatorId={selectedOperator._id || selectedOperator.id} 
                operatorName={selectedOperator.name}
                embedded={true}
              />
            </TabsContent>
            
            <TabsContent value="roles" className="mt-2 max-h-[55vh] overflow-y-auto">
              <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100 mb-4">
                <div className="flex items-center gap-2 text-violet-700">
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">Operator Roles</span>
                </div>
                <p className="text-xs text-violet-600 mt-1">Define roles and permissions for team members</p>
              </div>
              <OperatorRolesManagement 
                operatorId={selectedOperator._id || selectedOperator.id} 
                operatorName={selectedOperator.name}
              />
            </TabsContent>
          </Tabs>
        )}
      </AdminModal>

      {/* Edit Operator Dialog */}
      <AdminModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Operator"
        subtitle="Update operator details and configuration"
        icon={<Edit className="w-5 h-5 text-white" />}
        accentColor="amber"
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSaveEdit}>Save Changes</Button>
        </>}
      >
        <div className="space-y-5">
          <AdminModal.Section title="Basic Information" icon={<Building className="w-4 h-4" />}>
            <div className="space-y-4 p-4 bg-slate-50/60 rounded-xl border border-slate-100">
              <FormField label="Company Name" required>
                <StyledInput value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email">
                  <StyledInput type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                </FormField>
                <FormField label="Phone">
                  <StyledInput value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="City">
                  <StyledInput value={editForm.city || ''} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} />
                </FormField>
                <FormField label="Status">
                  <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-slate-50/80 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {OPERATOR_STATUS.filter(s => s !== 'all').map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
          </AdminModal.Section>
            
          <AdminModal.Section title="Geography & Segment" icon={<Globe className="w-4 h-4" />}>
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
              <FormField label="Country">
                <Select value={editForm.country || undefined} onValueChange={v => { setEditForm(p => ({ ...p, country: v, region: '' })); loadRegionsForCountry(v, 'edit'); }}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="edit-country-select"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="bg-white">{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Region">
                <Select value={editForm.region || undefined} onValueChange={v => setEditForm(p => ({ ...p, region: v }))}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="edit-region-select"><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {editRegions.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}
                    {editRegions.length === 0 && <SelectItem value="__none__" disabled>No regions</SelectItem>}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Market Segment">
                <Select value={editForm.market_segment || 'sme'} onValueChange={v => setEditForm(p => ({ ...p, market_segment: v }))}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="edit-segment-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {marketSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    {marketSegments.length === 0 && <><SelectItem value="sme">SME</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="strategic">Strategic</SelectItem></>}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Services" icon={<Star className="w-4 h-4" />}>
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
              <p className="text-xs text-slate-500 mb-3">Select which services this operator can provide</p>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_TYPES.filter(s => s !== 'all').map(service => {
                  const colors = SERVICE_COLORS[service] || {};
                  const checked = editForm.service_types?.includes(service) || false;
                  return (
                    <label key={service} className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg transition-all border ${checked ? `${colors.bg || 'bg-blue-50'} ${colors.border || 'border-blue-200'}` : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={checked}
                        onChange={(e) => setEditForm(p => ({ ...p, service_types: e.target.checked ? [...(p.service_types || []), service] : (p.service_types || []).filter(s => s !== service) }))}
                        className="rounded text-[#082c59] focus:ring-[#082c59]" />
                      <span className={`text-sm capitalize font-medium ${checked ? (colors.text || 'text-blue-700') : 'text-slate-600'}`}>{service.replace('_', ' ')}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-4">
                <FormField label="Primary Service Type">
                  <Select value={editForm.operator_type || ''} onValueChange={v => setEditForm(p => ({ ...p, operator_type: v }))}>
                    <SelectTrigger className="bg-white border-emerald-200"><SelectValue placeholder="Select primary type" /></SelectTrigger>
                    <SelectContent className="bg-white">{(editForm.service_types || []).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
          </AdminModal.Section>
        </div>
      </AdminModal>

      {/* Create Operator Dialog */}
      <AdminModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Add New Operator"
        subtitle="Register a new service provider on the platform"
        icon={<Plus className="w-5 h-5 text-white" />}
        accentColor="emerald"
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate}>Create Operator</Button>
        </>}
      >
        <div className="space-y-5">
          <AdminModal.Section title="Company Details" icon={<Building className="w-4 h-4" />}>
            <div className="space-y-4 p-4 bg-slate-50/60 rounded-xl border border-slate-100">
              <FormField label="Company Name" required>
                <StyledInput value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Company Name" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" required>
                  <StyledInput type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@company.cm" />
                </FormField>
                <FormField label="Phone">
                  <StyledInput value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237 600 000 000" />
                </FormField>
              </div>
              <FormField label="City">
                <StyledInput value={createForm.city} onChange={e => setCreateForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
              </FormField>
            </div>
          </AdminModal.Section>
            
          <AdminModal.Section title="Geography & Segment" icon={<Globe className="w-4 h-4" />}>
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
              <FormField label="Country">
                <Select value={createForm.country} onValueChange={v => { setCreateForm(p => ({ ...p, country: v, region: '' })); loadRegionsForCountry(v, 'create'); }}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="create-country-select"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="bg-white">{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Region">
                <Select value={createForm.region || undefined} onValueChange={v => setCreateForm(p => ({ ...p, region: v }))}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="create-region-select"><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {regions.map(r => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}
                    {regions.length === 0 && <SelectItem value="__none__" disabled>No regions</SelectItem>}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Market Segment">
                <Select value={createForm.market_segment} onValueChange={v => setCreateForm(p => ({ ...p, market_segment: v }))}>
                  <SelectTrigger className="bg-white border-blue-200" data-testid="create-segment-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {marketSegments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    {marketSegments.length === 0 && <><SelectItem value="sme">SME</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="strategic">Strategic</SelectItem></>}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Service Type" icon={<Star className="w-4 h-4" />}>
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
              <FormField label="Primary Service Type" required>
                <Select value={createForm.operator_type} onValueChange={v => setCreateForm(p => ({ ...p, operator_type: v, service_types: [v] }))}>
                  <SelectTrigger className="bg-white border-emerald-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">{SERVICE_TYPES.filter(s => s !== 'all').map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Owner Account" icon={<UserCog className="w-4 h-4" />}>
            <div className="p-4 bg-violet-50/40 rounded-xl border border-violet-100">
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.create_owner_account}
                  onChange={e => setCreateForm(p => ({ ...p, create_owner_account: e.target.checked }))}
                  className="rounded text-violet-600 focus:ring-violet-500 h-4 w-4"
                  data-testid="create-owner-toggle"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Create owner user account</p>
                  <p className="text-xs text-slate-500">Create a login account for the operator owner</p>
                </div>
              </label>
              {createForm.create_owner_account && (
                <div className="space-y-4 pt-3 border-t border-violet-200/50">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Owner Full Name" required>
                      <StyledInput value={createForm.owner_full_name} onChange={e => setCreateForm(p => ({ ...p, owner_full_name: e.target.value }))} placeholder="John Doe" data-testid="owner-name-input" />
                    </FormField>
                    <FormField label="Owner Email" required>
                      <StyledInput type="email" value={createForm.owner_email} onChange={e => setCreateForm(p => ({ ...p, owner_email: e.target.value }))} placeholder="owner@company.cm" data-testid="owner-email-input" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Owner Phone">
                      <StyledInput value={createForm.owner_phone} onChange={e => setCreateForm(p => ({ ...p, owner_phone: e.target.value }))} placeholder="+237 600 000 000" />
                    </FormField>
                    <FormField label="Password" hint="Leave empty for default: Oryno@2024">
                      <StyledInput type="password" value={createForm.owner_password} onChange={e => setCreateForm(p => ({ ...p, owner_password: e.target.value }))} placeholder="Leave empty for default" />
                    </FormField>
                  </div>
                </div>
              )}
            </div>
          </AdminModal.Section>
        </div>
      </AdminModal>

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
