import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePickerField from '@/components/shared/DatePickerField';
import IconButton from '@/components/shared/IconButton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building, Plus, Search, Edit, Trash2, Eye, Ban, CheckCircle,
  Phone, Mail, MapPin, Clock, Star, TrendingUp, Users, Calendar, DollarSign, UserCog, Shield,
  ChevronLeft, ChevronRight, Globe, Filter, X as XIcon, Sparkles, Layers
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate } from '@/utils/dateUtils';
import api from '@/api/client';
import { toast } from 'sonner';
import { AdminModal, FormField, StyledInput, StyledSelect } from '@/components/shared/AdminModal';
import AddOperatorWizard from '@/components/admin/AddOperatorWizard';
import OperatorCategoryAssign from '@/components/admin/OperatorCategoryAssign';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorSectionTabs from '@/components/admin/OperatorSectionTabs';
import OperatorTeamManagement from '@/components/management/OperatorTeamManagement';
import OperatorRolesManagement from '@/components/management/OperatorRolesManagement';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import OperatorCommissionCell from '@/components/admin/OperatorCommissionCell';
import BulkActionsBar, { BulkSelectHeader, BulkSelectCell } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';

const OPERATOR_STATUS = ['all', 'active', 'pending', 'suspended', 'inactive'];
const SERVICE_TYPES = ['all', 'hotel', 'travel', 'car_rental', 'restaurant', 'events', 'cinema', 'laundry', 'banquet', 'package'];

const SERVICE_COLORS = {
  hotel: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  hotels: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  travel: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  car_rental: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  restaurant: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  restaurants: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  events: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  event: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
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
  const [searchParams] = useSearchParams();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  // iter 247: pre-seed the search input from the ?search=<id_or_name> query
  // param so deep links from global search land pre-filtered.
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('list');  // 'list' | 'grid' | 'details'
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
    // iter 247: also match against the operator _id so global-search deep
    // links of the form ?search=<operator_id> land pre-filtered.
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || op.name?.toLowerCase().includes(q)
      || op.email?.toLowerCase().includes(q)
      || (op._id || op.id || '').toString().toLowerCase().includes(q);
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

  // Bulk selection — operates on the visible (paginated) rows.
  const bulk = useBulkSelection(paginatedOperators, { idKey: 'id' });
  const runBulk = async (action) => {
    await api.post('/admin/bulk', { collection: 'operators', action, ids: bulk.selectedIds });
    await fetchOperators();
  };
  const bulkDelete   = () => runBulk('delete');
  const bulkActivate = () => runBulk('activate');
  const bulkDeactivate = () => runBulk('deactivate');

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

  const [lastInviteResult, setLastInviteResult] = useState(null);

  const submitOperatorCreate = async (payload) => {
    try {
      const res = await api.post('/operators/', payload);
      await loadOperators();
      const data = res.data || {};
      let msg = 'Operator created successfully';
      if (data.owner_account_created) {
        msg += data.invite_email_status === 'sent'
          ? `. Invite email sent to ${data.owner_email}.`
          : `. Email could not be delivered — copy the invite link below.`;
      }
      toast.success(msg);
      if (data.owner_account_created && data.invite_link) {
        setIsCreateOpen(false);
        setLastInviteResult({
          email: data.owner_email,
          link: data.invite_link,
          emailStatus: data.invite_email_status,
          tempPassword: data.default_password || null,
        });
      } else {
        setIsCreateOpen(false);
      }
    } catch (error) {
      console.error('Failed to create operator:', error);
      toast.error(error.response?.data?.detail || 'Failed to create operator');
      throw error;
    }
  };

  // eslint-disable-next-line no-unused-vars -- legacy single-step create handler kept for back-compat with older modal triggers; AddOperatorWizard is the active flow.
  const handleCreate = async () => {
    await submitOperatorCreate(createForm);
    setCreateForm({ name: '', email: '', phone: '', city: '', operator_type: 'travel', service_types: ['travel'], country: 'CM', region: '', market_segment: 'sme', create_owner_account: false, owner_full_name: '', owner_email: '', owner_phone: '', owner_password: '' });
  };

  const closeInviteResult = () => {
    setLastInviteResult(null);
    setIsCreateOpen(false);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(lastInviteResult?.link || '');
      toast.success('Invite link copied to clipboard');
    } catch {
      toast.error('Could not copy — long-press to copy manually');
    }
  };

  // Stats (dynamic — reflects active filters)
  const stats = useMemo(() => ({
    total: filteredOperators.length,
    active: filteredOperators.filter(o => o.status === 'active').length,
    pending: filteredOperators.filter(o => o.status === 'pending').length,
    suspended: filteredOperators.filter(o => o.status === 'suspended').length,
    totalRevenue: filteredOperators.reduce((sum, o) => sum + (o.revenue || 0), 0)
  }), [filteredOperators]);

  return (
    <>
      <ManagementShell
        title="Operator Management"
        icon={Building}
        subtitle="Manage service providers and operators"
        scopeFilter={canManageOperators && (
          <IconButton
            icon={Plus}
            label="Add operator"
            variant="solid"
            size="md"
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-operator-btn"
          />
        )}
        testIdPrefix="operator-mgmt"
        activeTab="operators"
      >
      {/* OperatorSectionTabs handles its own routing (operators/geography/market-segments/categories) */}
      <Tabs value={location.pathname.includes('/geography') ? 'geography' : location.pathname.includes('/market-segments') ? 'market-segments' : location.pathname.includes('/categories') ? 'categories' : 'operators'} onValueChange={(v) => {
        if (v === 'operators') navigate('/admin/operators');
        else if (v === 'geography') navigate('/admin/operators/geography');
        else if (v === 'market-segments') navigate('/admin/operators/market-segments');
        else if (v === 'categories') navigate('/admin/operators/categories');
      }}>
        <TabsList className="hidden" /> {/* legacy stub — replaced by <OperatorSectionTabs/> below */}
      </Tabs>
      <OperatorSectionTabs />
      <TabsContent value="operators" className="mt-4 space-y-4" forceMount>

      {/* Stats moved below filters — see block after Filters SubpageCard */}

      {/* Filters */}
      <SubpageCard title="Filters" icon={Search} testId="operator-filters-card">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search operators..."
              className="pl-9 h-8 bg-white text-sm"
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
          <IconButton
            icon={Filter}
            label="More filters"
            variant={showFilters ? 'solid' : 'outline'}
            active={showFilters}
            size="sm"
            onClick={() => setShowFilters(p => !p)}
            data-testid="more-filters-btn"
          />
          {(ownerFilter || dateFrom || dateTo) && (
            <IconButton
              icon={XIcon}
              label="Clear filters"
              variant="ghost"
              size="sm"
              onClick={() => { setOwnerFilter(''); setDateFrom(''); setDateTo(''); }}
              data-testid="clear-filters-btn"
            />
          )}
          <div className="ml-auto">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 w-full mt-2" data-testid="expanded-filters">
            <div className="min-w-[180px]">
              <Label className="text-xs text-slate-500 mb-1 block">Owner</Label>
              <Input placeholder="Filter by owner..." value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="bg-white h-9 text-sm" data-testid="owner-filter" />
            </div>
            <div className="min-w-[150px]">
              <Label className="text-xs text-slate-500 mb-1 block">Joined From</Label>
              <DatePickerField value={dateFrom} onChange={setDateFrom} placeholder="From" title="Joined From" minDate={null} className="h-9 text-sm" data-testid="date-from-filter" />
            </div>
            <div className="min-w-[150px]">
              <Label className="text-xs text-slate-500 mb-1 block">Joined To</Label>
              <DatePickerField value={dateTo} onChange={setDateTo} placeholder="To" title="Joined To" minDate={dateFrom ? new Date(dateFrom) : null} className="h-9 text-sm" data-testid="date-to-filter" />
            </div>
          </div>
        )}
      </SubpageCard>

      {/* Stats (mirrors Users page compact style — keeps the layout
          inside 1366px viewports without horizontal overflow). */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="operators-stats-grid">
        {[
          { label: 'Total Operators', count: stats.total, color: 'bg-slate-100 text-slate-700' },
          { label: 'Active', count: stats.active, color: 'bg-green-100 text-green-700' },
          { label: 'Pending', count: stats.pending, color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Suspended', count: stats.suspended, color: 'bg-red-100 text-red-700' },
          { label: 'Total Revenue', count: formatFCFA(stats.totalRevenue), color: 'bg-purple-100 text-purple-700', isCurrency: true },
        ].map((stat) => (
          <div key={stat.label} className={`p-3 rounded-lg ${stat.color}`}>
            <p className={`${stat.isCurrency ? 'text-base' : 'text-2xl'} font-bold truncate`} title={String(stat.count)}>{stat.count}</p>
            <p className="text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Operators — list / grid / details */}
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading operators...</div>
      ) : filteredOperators.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-10 text-center text-slate-500" data-testid="operators-empty-state">
          No operators found
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto" data-testid="operators-list-view">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="py-4 px-4 w-10">
                      <BulkSelectHeader
                        allSelected={bulk.allSelected}
                        partiallySelected={bulk.partiallySelected}
                        onToggleAll={bulk.toggleAll}
                      />
                    </th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Operator</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Services</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Location</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Owner</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Date Joined</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Status</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Commission</th>
                    <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Revenue</th>
                    <th className="py-4 px-6 text-right text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedOperators.map((operator) => (
                    <tr key={operator.id} className="hover:bg-slate-50 transition-colors" data-testid={`operator-row-${operator.id}`}>
                      <td className="py-4 px-4">
                        <BulkSelectCell
                          selected={bulk.isSelected(operator.id)}
                          onToggle={bulk.toggle}
                          id={operator.id}
                        />
                      </td>
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
                      <td className="py-4 px-6" data-testid={`operator-owner-cell-${operator.id}`}>
                        <div className="text-sm">
                          <p className="font-medium text-slate-700">{operator.owner_name || <span className="italic text-slate-400">No owner assigned</span>}</p>
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
                      <td className="py-4 px-6">
                        <OperatorCommissionCell
                          operatorId={operator.id}
                          serviceTypes={operator.service_types || []}
                        />
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-900">
                        {formatFCFA(operator.revenue || 0)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleView(operator)} className="p-2 hover:bg-blue-100 rounded-lg transition-colors" title="View Details" data-testid={`view-operator-${operator.id}`}>
                            <Eye className="h-4 w-4 text-blue-600" />
                          </button>
                          {canManageOperators && (
                            <>
                              <button onClick={() => handleEdit(operator)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                                <Edit className="h-4 w-4 text-slate-600" />
                              </button>
                              <button onClick={() => handleSuspend(operator)} className={`p-2 rounded-lg transition-colors ${operator.status === 'suspended' ? 'hover:bg-green-100' : 'hover:bg-red-100'}`} title={operator.status === 'suspended' ? 'Activate' : 'Suspend'}>
                                {operator.status === 'suspended' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
                              </button>
                              <button onClick={() => handleDelete(operator)} className="p-2 hover:bg-red-100 rounded-lg transition-colors" title="Delete">
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
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="operators-grid-view">
              {paginatedOperators.map((operator) => (
                <Card
                  key={operator.id}
                  className="bg-white border-slate-200 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                  onClick={() => handleView(operator)}
                  data-testid={`operator-card-${operator.id}`}
                >
                  <div className="h-1.5 bg-gradient-to-r from-[#082c59] via-blue-500 to-indigo-500" />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-[#082c59]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building className="h-5 w-5 text-[#082c59]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate" title={operator.name}>{operator.name}</p>
                          <p className="text-xs text-slate-500 truncate" title={operator.email}>{operator.email}</p>
                        </div>
                      </div>
                      {getStatusBadge(operator.status)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {operator.service_types?.slice(0, 3).map((s) => getServiceBadge(s))}
                      {operator.service_types?.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{operator.service_types.length - 3}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{getCountryName(operator.country)}{operator.region ? ` · ${getRegionName(operator.region)}` : ''}</span>
                    </div>
                    <div
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                      data-testid={`operator-owner-card-${operator.id}`}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Owner</p>
                      <p className="text-sm font-medium text-slate-800 truncate" title={operator.owner_name}>
                        {operator.owner_name || <span className="italic text-slate-400">No owner assigned</span>}
                      </p>
                      {operator.owner_email && <p className="text-[11px] text-slate-500 truncate">{operator.owner_email}</p>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {operator.created_at ? formatDate(operator.created_at) : '-'}
                      </span>
                      <span className="text-sm font-bold text-[#082c59]">{formatFCFA(operator.revenue || 0)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 -mb-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleView(operator)} className="p-1.5 hover:bg-blue-100 rounded-md transition-colors" title="View"><Eye className="h-4 w-4 text-blue-600" /></button>
                      {canManageOperators && (
                        <>
                          <button onClick={() => handleEdit(operator)} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors" title="Edit"><Edit className="h-4 w-4 text-slate-600" /></button>
                          <button onClick={() => handleSuspend(operator)} className={`p-1.5 rounded-md transition-colors ${operator.status === 'suspended' ? 'hover:bg-green-100' : 'hover:bg-red-100'}`} title={operator.status === 'suspended' ? 'Activate' : 'Suspend'}>
                            {operator.status === 'suspended' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
                          </button>
                          <button onClick={() => handleDelete(operator)} className="p-1.5 hover:bg-red-100 rounded-md transition-colors" title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {viewMode === 'details' && (
            <div className="space-y-3" data-testid="operators-details-view">
              {paginatedOperators.map((operator) => (
                <Card
                  key={operator.id}
                  className="bg-white border-slate-200 hover:shadow-md transition-all overflow-hidden"
                  data-testid={`operator-detail-${operator.id}`}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 bg-gradient-to-br from-[#082c59] to-blue-700 p-5 text-white flex flex-col justify-between">
                        <div>
                          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-3">
                            <Building className="h-6 w-6 text-white" />
                          </div>
                          <p className="font-bold text-lg leading-tight" title={operator.name}>{operator.name}</p>
                          <p className="text-xs text-blue-100/80 truncate mt-0.5">{operator.email}</p>
                        </div>
                        <div className="mt-4">
                          {getStatusBadge(operator.status)}
                        </div>
                      </div>
                      <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Services</p>
                          <div className="flex flex-wrap gap-1">
                            {operator.service_types?.length > 0 ? operator.service_types.slice(0, 4).map((s) => getServiceBadge(s)) : <span className="text-xs text-slate-400 italic">No services</span>}
                            {operator.service_types?.length > 4 && <Badge variant="outline" className="text-xs">+{operator.service_types.length - 4}</Badge>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Location</p>
                          <p className="text-sm font-medium text-slate-700">{getCountryName(operator.country)}</p>
                          {operator.region && <p className="text-xs text-slate-500">{getRegionName(operator.region)}</p>}
                          {operator.market_segment && <div className="mt-1">{getSegmentBadge(operator.market_segment)}</div>}
                        </div>
                        <div data-testid={`operator-owner-detail-${operator.id}`}>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Owner</p>
                          <p className="text-sm font-medium text-slate-800 truncate" title={operator.owner_name}>
                            {operator.owner_name || <span className="italic text-slate-400">No owner assigned</span>}
                          </p>
                          {operator.owner_email && <p className="text-xs text-slate-500 truncate">{operator.owner_email}</p>}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Revenue</p>
                          <p className="text-lg font-bold text-[#082c59]">{formatFCFA(operator.revenue || 0)}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" /> joined {operator.created_at ? formatDate(operator.created_at) : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="md:w-auto p-5 md:border-l border-slate-100 flex flex-row md:flex-col items-center md:justify-center gap-1">
                        <button onClick={() => handleView(operator)} className="p-2 hover:bg-blue-100 rounded-lg transition-colors" title="View"><Eye className="h-4 w-4 text-blue-600" /></button>
                        {canManageOperators && (
                          <>
                            <button onClick={() => handleEdit(operator)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Edit"><Edit className="h-4 w-4 text-slate-600" /></button>
                            <button onClick={() => handleSuspend(operator)} className={`p-2 rounded-lg transition-colors ${operator.status === 'suspended' ? 'hover:bg-green-100' : 'hover:bg-red-100'}`} title={operator.status === 'suspended' ? 'Activate' : 'Suspend'}>
                              {operator.status === 'suspended' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-red-600" />}
                            </button>
                            <button onClick={() => handleDelete(operator)} className="p-2 hover:bg-red-100 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4 text-red-600" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Shared pagination footer (works across all 3 view modes) */}
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onChange={setCurrentPage}
            total={filteredOperators.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="operator"
          />
        </>
      )}

      {/* View Operator Dialog — two-tone aesthetic (slate + brand #082c59) */}
      <AdminModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        title={selectedOperator?.name || 'Operator Details'}
        subtitle={selectedOperator?.email}
        icon={<Building className="w-5 h-5 text-white" />}
        accentColor="slate"
        size="xl"
      >
        {selectedOperator && (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-4">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-[#082c59] data-[state=active]:text-[#082c59] rounded-none px-4 py-2.5 font-medium text-slate-600">
                <Building className="h-4 w-4 mr-2" /> Details
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:border-b-2 data-[state=active]:border-[#082c59] data-[state=active]:text-[#082c59] rounded-none px-4 py-2.5 font-medium text-slate-600">
                <Users className="h-4 w-4 mr-2" /> Team
              </TabsTrigger>
              <TabsTrigger value="roles" className="data-[state=active]:border-b-2 data-[state=active]:border-[#082c59] data-[state=active]:text-[#082c59] rounded-none px-4 py-2.5 font-medium text-slate-600">
                <Shield className="h-4 w-4 mr-2" /> Roles
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-2">
              <div className="space-y-5">
                {/* Hero — slate base with single brand accent */}
                <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-16 h-16 bg-[#082c59] rounded-xl flex items-center justify-center shadow-sm">
                    <Building className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 truncate">{selectedOperator.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {getStatusBadge(selectedOperator.status)}
                      {selectedOperator.market_segment && getSegmentBadge(selectedOperator.market_segment)}
                      {selectedOperator.operator_type && getServiceBadge(selectedOperator.operator_type)}
                    </div>
                  </div>
                  {selectedOperator.owner_name && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Owner</p>
                      <p className="text-sm font-semibold text-slate-700">{selectedOperator.owner_name}</p>
                    </div>
                  )}
                </div>

                {/* Info Grid — monochrome slate */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Email</p><p className="text-sm font-medium text-slate-700 truncate">{selectedOperator.email || '—'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Phone</p><p className="text-sm font-medium text-slate-700 truncate">{selectedOperator.phone || '—'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Location</p><p className="text-sm font-medium text-slate-700 truncate">{selectedOperator.city}{selectedOperator.country ? `, ${getCountryName(selectedOperator.country)}` : ''}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Region</p><p className="text-sm font-medium text-slate-700 truncate">{selectedOperator.region ? getRegionName(selectedOperator.region) : '—'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Joined</p><p className="text-sm font-medium text-slate-700 truncate">{selectedOperator.joined_date || '—'}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    <div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Segment</p>
                      <div className="mt-0.5">{selectedOperator.market_segment ? getSegmentBadge(selectedOperator.market_segment) : <span className="text-sm text-slate-500">—</span>}</div>
                    </div>
                  </div>
                </div>

                {/* Services */}
                {selectedOperator.service_types?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Assigned Services</p>
                    <div className="flex flex-wrap gap-1.5">{selectedOperator.service_types.map(s => getServiceBadge(s))}</div>
                  </div>
                )}

                {/* Stats — slim chips, two-tone */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100" data-testid="operator-preview-stats">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#082c59]/5 border border-[#082c59]/20 text-[#082c59] text-xs font-medium">
                    Total Bookings <strong className="font-bold">{selectedOperator.total_bookings?.toLocaleString() || '0'}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
                    Revenue <strong className="font-bold">{formatFCFA(selectedOperator.revenue || 0)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
                    Rating <strong className="font-bold">{selectedOperator.rating || '—'}</strong>
                  </span>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="team" className="mt-2 max-h-[55vh] overflow-y-auto">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="w-4 h-4 text-[#082c59]" />
                  <span className="font-semibold text-sm">Team Members</span>
                </div>
                <span className="text-[11px] text-slate-500">Owner-led organisation · roles inherited from this operator</span>
              </div>
              <OperatorTeamManagement 
                operatorId={selectedOperator._id || selectedOperator.id} 
                operatorName={selectedOperator.name}
                embedded={true}
              />
            </TabsContent>
            
            <TabsContent value="roles" className="mt-2 max-h-[55vh] overflow-y-auto">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Shield className="w-4 h-4 text-[#082c59]" />
                  <span className="font-semibold text-sm">Operator Roles</span>
                </div>
                <span className="text-[11px] text-slate-500">Custom roles defined by this operator&apos;s owner</span>
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

          <AdminModal.Section title="Brand Identity" icon={<Building className="w-4 h-4" />}>
            <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100">
              <div className="flex items-start gap-4">
                {editForm.logo_url ? (
                  <div className="w-20 h-20 rounded-xl bg-white border-2 border-amber-200 overflow-hidden shadow-sm flex-shrink-0">
                    <img src={editForm.logo_url} alt="logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-amber-300 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Building className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1">
                  <Label className="text-xs uppercase text-amber-700 font-semibold">Operator Logo</Label>
                  <p className="text-[11px] text-slate-500 mb-2">Shown on bookings, receipts, the customer-facing owner tab, and any place this operator appears.</p>
                  <MiniImageUploader
                    images={editForm.logo_url ? [editForm.logo_url] : []}
                    onChange={(imgs) => setEditForm(p => ({ ...p, logo_url: imgs[0] || '' }))}
                    max={1}
                    folder="operator-logos"
                    accent="amber"
                    helperText="PNG or JPG, square aspect ratio recommended."
                  />
                </div>
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
          <AdminModal.Section title="Service Categories" icon={<Sparkles className="w-4 h-4" />}>
            <div className="p-4 bg-purple-50/40 rounded-xl border border-purple-100">
              <p className="text-xs text-slate-500 mb-3">
                Tag this operator with the sub-categories they offer. They&apos;ll show up in
                category-scoped operator dropdowns (e.g. when admins add a new Photographer or
                Italian restaurant) even before they have their first service row.
              </p>
              <OperatorCategoryAssign
                value={editForm.service_types || []}
                onChange={(next) => setEditForm(p => ({ ...p, service_types: next }))}
              />
            </div>
          </AdminModal.Section>
        </div>
      </AdminModal>

      {/* Create Operator Wizard (multi-step) */}
      <AddOperatorWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={submitOperatorCreate}
      />

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

      {/* Invitation result dialog — shown after a new owner account is created */}
      <Dialog open={!!lastInviteResult} onOpenChange={(o) => { if (!o) closeInviteResult(); }}>
        <DialogContent className="bg-white max-w-md" data-testid="invite-result-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastInviteResult?.emailStatus === 'sent' ? '✉️ Invitation sent' : '🔗 Share invite link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {lastInviteResult?.emailStatus === 'sent'
                ? <>An email has been sent to <strong>{lastInviteResult?.email}</strong> asking them to confirm their account. You can also share the link below as a backup.</>
                : <>The invite email couldn't be delivered automatically. Copy the link below and share it with <strong>{lastInviteResult?.email}</strong> so they can confirm their account.</>}
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs break-all font-mono text-slate-700" data-testid="invite-link-text">
              {lastInviteResult?.link}
            </div>
            {lastInviteResult?.tempPassword && (
              <p className="text-xs text-slate-500">
                Starting password set by admin: <span className="font-mono text-slate-700">{lastInviteResult.tempPassword}</span> (the invitee will be asked to confirm before signing in).
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={copyInviteLink} data-testid="copy-invite-link-btn">Copy link</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={closeInviteResult} data-testid="invite-result-done-btn">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
      </TabsContent>
      </ManagementShell>

      <BulkActionsBar
        count={bulk.count}
        entityLabel="operator"
        selectedIds={bulk.selectedIds}
        selectedRows={bulk.selectedRows}
        onClear={bulk.clear}
        onDelete={bulkDelete}
        onActivate={bulkActivate}
        onDeactivate={bulkDeactivate}
        onExport={(rows) => rows.map(o => ({
          id: o.id, name: o.name, email: o.contact_email || o.email || '',
          status: o.status, service_types: (o.service_types || []).join('|'),
          created: o.created_at,
        }))}
      />
    </>
  );
}
