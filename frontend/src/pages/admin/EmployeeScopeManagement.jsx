import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Shield, Plus, Edit2, Trash2, Search, RefreshCw, UserPlus, UserMinus,
  Globe, MapPin, Building2, Briefcase, Loader2, Eye, Check, X, Users, Network, ShieldCheck, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';
import { AdminModal, FormField, StyledInput } from '@/components/shared/AdminModal';

export default function EmployeeScopeManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scopes, setScopes] = useState([]);
  const [users, setUsers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedScope, setSelectedScope] = useState(null);
  const [editingScope, setEditingScope] = useState(null);
  
  // Form states
  const [scopeForm, setScopeForm] = useState({
    name: '', description: '', countries: [], regions: [], market_segments: [], service_types: [], assigned_pod_ids: []
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [marketSegments, setMarketSegments] = useState([]);
  const [pods, setPods] = useState([]);

  // Search states for modals
  const [assignSearch, setAssignSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [segmentSearch, setSegmentSearch] = useState('');

  const SERVICE_TYPES = [
    { value: 'travel', label: 'Travel' },
    { value: 'hotel', label: 'Hotels' },
    { value: 'restaurant', label: 'Restaurants' },
    { value: 'car_rental', label: 'Car Rental' },
    { value: 'event', label: 'Events' },
    { value: 'cinema', label: 'Cinema' },
    { value: 'laundry', label: 'Laundry' },
    { value: 'banquet', label: 'Banquet' }
  ];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scopesRes, usersRes, employeesRes, countriesRes, regionsRes, segRes, podsRes] = await Promise.all([
        api.get('/employee-scopes'),
        api.get('/users/'),
        api.get('/employees/'),
        api.get('/geography/countries'),
        api.get('/geography/regions'),
        api.get('/geography/market-segments'),
        api.get('/pods')
      ]);
      setScopes(scopesRes.data.scopes || []);
      
      // Build combined user list: admin/super_admin/employee users + employee records with user accounts
      const allUsers = usersRes.data.users || [];
      const employees = employeesRes.data.employees || [];
      
      const platformUsers = allUsers.filter(u => ['admin', 'super_admin', 'employee'].includes(u.role));
      const usedIds = new Set(platformUsers.map(u => u.id || u._id));
      
      // Add employee-linked users that might not be in the platform user list
      for (const emp of employees) {
        if (emp.user_id && !usedIds.has(emp.user_id)) {
          const linkedUser = allUsers.find(u => (u.id || u._id) === emp.user_id);
          if (linkedUser) {
            platformUsers.push(linkedUser);
            usedIds.add(emp.user_id);
          }
        }
      }
      
      setUsers(platformUsers);
      setCountries(countriesRes.data.countries || []);
      setRegions(regionsRes.data.regions || []);
      setMarketSegments(segRes.data.market_segments || []);
      setPods(podsRes.data.pods || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      const res = await api.post('/employee-scopes/create-defaults');
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initialize');
    }
  };

  const handleSaveScope = async () => {
    try {
      if (editingScope) {
        await api.put(`/employee-scopes/${editingScope.id}`, scopeForm);
        toast.success('Scope updated');
      } else {
        await api.post('/employee-scopes', scopeForm);
        toast.success('Scope created');
      }
      setShowScopeModal(false);
      setEditingScope(null);
      resetScopeForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save scope');
    }
  };

  const handleDeleteScope = async (id) => {
    if (!confirm('Deactivate this scope?')) return;
    try {
      await api.delete(`/employee-scopes/${id}`);
      toast.success('Scope deactivated');
      if (selectedScope?.id === id) setSelectedScope(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleAssignScope = async () => {
    if (!selectedScope || !selectedUserId) return;
    try {
      await api.post(`/employee-scopes/${selectedScope.id}/assign`, { user_id: selectedUserId });
      toast.success('Scope assigned to user');
      setShowAssignModal(false);
      setSelectedUserId('');
      setAssignSearch('');
      fetchScopeDetails(selectedScope.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign scope');
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!selectedScope || !confirm('Remove this user from scope?')) return;
    try {
      await api.delete(`/employee-scopes/${selectedScope.id}/users/${userId}`);
      toast.success('User removed from scope');
      fetchScopeDetails(selectedScope.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove user');
    }
  };

  const fetchScopeDetails = async (scopeId) => {
    try {
      const res = await api.get(`/employee-scopes/${scopeId}`);
      setSelectedScope(res.data);
    } catch (error) {
      toast.error('Failed to fetch scope details');
    }
  };

  const resetScopeForm = () => {
    setScopeForm({ name: '', description: '', countries: [], regions: [], market_segments: [], service_types: [], assigned_pod_ids: [] });
  };

  const toggleArrayItem = (array, item) =>
    array.includes(item) ? array.filter(i => i !== item) : [...array, item];

  const isGlobalScope = (scope) =>
    !scope.countries?.length && !scope.regions?.length && !scope.market_segments?.length && !scope.service_types?.length;

  const filteredScopes = scopes.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      {/* Sub-page Navigation */}
      <div>
        <h1 className="text-2xl font-bold text-[#082c59] mb-1" data-testid="employee-management-title">Employee Management</h1>
        <p className="text-gray-600 mb-4">Manage staff, pods, and access scopes</p>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1" data-testid="employee-management-tabs">
          <button onClick={() => navigate('/admin/employees')} className="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors text-slate-600 hover:bg-slate-100" data-testid="tab-employees">
            <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />Employees
          </button>
          <button onClick={() => navigate('/admin/employees/pods')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname.includes('/pods') ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-pod-management">
            <Network className="w-4 h-4 inline mr-1.5 -mt-0.5" />Pod Management
          </button>
          <button onClick={() => navigate('/admin/employees/access-scopes')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname.includes('/access-scopes') ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-access-scopes">
            <ShieldCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" />Access Scopes
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Access Scopes</h2>
          <p className="text-slate-600">Manage attribute-based access control for platform employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          {scopes.length === 0 && (
            <Button variant="outline" onClick={initializeDefaults}>Initialize Defaults</Button>
          )}
          <Button onClick={() => { setEditingScope(null); resetScopeForm(); setShowScopeModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Scope
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 bg-blue-100 rounded-xl"><Shield className="w-6 h-6 text-blue-600" /></div><div><p className="text-2xl font-bold">{scopes.length}</p><p className="text-slate-600">Total Scopes</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 rounded-xl"><Globe className="w-6 h-6 text-green-600" /></div><div><p className="text-2xl font-bold">{scopes.filter(isGlobalScope).length}</p><p className="text-slate-600">Global Scopes</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 bg-purple-100 rounded-xl"><MapPin className="w-6 h-6 text-purple-600" /></div><div><p className="text-2xl font-bold">{scopes.filter(s => s.countries?.length).length}</p><p className="text-slate-600">Country Scopes</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 bg-orange-100 rounded-xl"><Briefcase className="w-6 h-6 text-orange-600" /></div><div><p className="text-2xl font-bold">{scopes.reduce((sum, s) => sum + (s.assigned_users || 0), 0)}</p><p className="text-slate-600">Assignments</p></div></div></CardContent></Card>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scopes List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scopes</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-40" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
              ) : filteredScopes.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No scopes found</div>
              ) : (
                <div className="space-y-2">
                  {filteredScopes.map(scope => (
                    <div key={scope.id} onClick={() => fetchScopeDetails(scope.id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${selectedScope?.id === scope.id ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 hover:bg-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{scope.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {isGlobalScope(scope) ? (
                              <Badge className="bg-green-100 text-green-700">Global</Badge>
                            ) : (
                              <>
                                {scope.countries?.length > 0 && <Badge variant="outline">{scope.countries.length} countries</Badge>}
                                {scope.service_types?.length > 0 && <Badge variant="outline">{scope.service_types.length} services</Badge>}
                              </>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-slate-100">{scope.assigned_users || 0}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scope Details */}
        <div className="lg:col-span-2">
          {selectedScope ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedScope.name}</CardTitle>
                    <p className="text-slate-500 mt-1">{selectedScope.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { 
                      setEditingScope(selectedScope); 
                      setScopeForm({
                        name: selectedScope.name, description: selectedScope.description || '',
                        countries: selectedScope.countries || [], regions: selectedScope.regions || [],
                        market_segments: selectedScope.market_segments || [], service_types: selectedScope.service_types || [],
                        assigned_pod_ids: selectedScope.assigned_pod_ids || []
                      }); 
                      setShowScopeModal(true); 
                    }}>
                      <Edit2 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeleteScope(selectedScope.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scope Type */}
                <div className="p-4 bg-slate-50 rounded-xl">
                  {isGlobalScope(selectedScope) ? (
                    <div className="flex items-center gap-3">
                      <Globe className="w-8 h-8 text-green-600" />
                      <div><p className="font-semibold text-green-700">Global Access</p><p className="text-sm text-slate-600">Access to all operators worldwide</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="font-semibold">Access Filters (AND logic)</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-slate-500">Countries</p><p className="font-medium">{selectedScope.countries?.length ? selectedScope.countries.join(', ') : 'All'}</p></div>
                        <div><p className="text-slate-500">Regions</p><p className="font-medium">{selectedScope.regions?.length ? selectedScope.regions.join(', ') : 'All'}</p></div>
                        <div><p className="text-slate-500">Market Segments</p><p className="font-medium">{selectedScope.market_segments?.length ? selectedScope.market_segments.join(', ') : 'All'}</p></div>
                        <div><p className="text-slate-500">Service Types</p><p className="font-medium">{selectedScope.service_types?.length ? selectedScope.service_types.join(', ') : 'All'}</p></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned Users */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Assigned Employees ({selectedScope.assignments?.length || 0})</h4>
                    <Button size="sm" onClick={() => { setShowAssignModal(true); setAssignSearch(''); setSelectedUserId(''); }}>
                      <UserPlus className="w-4 h-4 mr-1" /> Assign Employee
                    </Button>
                  </div>
                  {selectedScope.assignments?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedScope.assignments.map(assignment => (
                        <div key={assignment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Avatar><AvatarFallback>{assignment.user_email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{assignment.user_email}</p>
                              <p className="text-sm text-slate-500">Assigned {new Date(assignment.assigned_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(assignment.user_id)}>
                            <UserMinus className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No employees assigned to this scope</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a scope to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Scope Modal */}
      <AdminModal
        open={showScopeModal}
        onOpenChange={(open) => { setShowScopeModal(open); if (!open) { setCountrySearch(''); setSegmentSearch(''); } }}
        title={editingScope ? 'Edit Scope' : 'Create Access Scope'}
        subtitle={editingScope ? 'Update scope filters and assignments' : 'Define attribute-based access rules'}
        icon={<Shield className="w-5 h-5 text-white" />}
        accentColor="violet"
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setShowScopeModal(false)}>Cancel</Button>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSaveScope} data-testid="save-scope-btn">Save</Button>
        </>}
      >
        <div className="space-y-5">
          <AdminModal.Section title="Scope Identity" icon={<Shield className="w-4 h-4" />}>
            <div className="space-y-4 p-4 bg-slate-50/60 rounded-xl border border-slate-100">
              <FormField label="Scope Name" required>
                <StyledInput value={scopeForm.name} onChange={(e) => setScopeForm({...scopeForm, name: e.target.value})} placeholder="Cameroon SME Manager" data-testid="scope-name-input" />
              </FormField>
              <FormField label="Description">
                <Textarea value={scopeForm.description} onChange={(e) => setScopeForm({...scopeForm, description: e.target.value})} placeholder="Access to SME operators in Cameroon" className="bg-slate-50/80 border-slate-200 focus:bg-white" />
              </FormField>
            </div>
          </AdminModal.Section>

          <div className="p-3 bg-violet-50 rounded-xl border border-violet-100 text-sm text-violet-700">
            Leave all filters empty for global access. Multiple selections within a category = OR logic. Across categories = AND logic.
          </div>

          {/* Countries with Search */}
          <AdminModal.Section title="Countries (empty = all)" icon={<Globe className="w-4 h-4" />}>
            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search countries..." value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} className="pl-9 bg-white" data-testid="scope-country-search" />
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {countries.filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                  <label key={c.code} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.countries.includes(c.code) ? 'bg-blue-100 border-blue-300 shadow-sm' : 'bg-white hover:bg-slate-50'} border`}>
                    <Checkbox checked={scopeForm.countries.includes(c.code)} onCheckedChange={() => setScopeForm({...scopeForm, countries: toggleArrayItem(scopeForm.countries, c.code)})} />
                    <span className="text-sm">{c.name} ({c.code})</span>
                  </label>
                ))}
                {countries.filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                  <p className="text-sm text-slate-400 py-2">No countries match</p>
                )}
              </div>
            </div>
          </AdminModal.Section>

          {/* Market Segments with Search */}
          <AdminModal.Section title="Market Segments (empty = all)" icon={<TrendingUp className="w-4 h-4" />}>
            <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search segments..." value={segmentSearch} onChange={(e) => setSegmentSearch(e.target.value)} className="pl-9 bg-white" data-testid="scope-segment-search" />
              </div>
              <div className="flex flex-wrap gap-2">
                {marketSegments.filter(s => !segmentSearch || s.name.toLowerCase().includes(segmentSearch.toLowerCase())).map(s => (
                  <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.market_segments.includes(s.id) ? 'border-2 shadow-sm' : 'bg-white hover:bg-slate-50 border'}`} style={scopeForm.market_segments.includes(s.id) ? { backgroundColor: s.color + '20', borderColor: s.color } : {}}>
                    <Checkbox checked={scopeForm.market_segments.includes(s.id)} onCheckedChange={() => setScopeForm({...scopeForm, market_segments: toggleArrayItem(scopeForm.market_segments, s.id)})} />
                    <span className="text-sm font-medium" style={scopeForm.market_segments.includes(s.id) ? { color: s.color } : {}}>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </AdminModal.Section>

          {/* Service Types */}
          <AdminModal.Section title="Service Types (empty = all)" icon={<Briefcase className="w-4 h-4" />}>
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map(s => (
                  <label key={s.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.service_types.includes(s.value) ? 'bg-emerald-100 border-emerald-300 shadow-sm' : 'bg-white hover:bg-slate-50'} border`}>
                    <Checkbox checked={scopeForm.service_types.includes(s.value)} onCheckedChange={() => setScopeForm({...scopeForm, service_types: toggleArrayItem(scopeForm.service_types, s.value)})} />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </AdminModal.Section>

          {/* Assigned Pods */}
          <AdminModal.Section title="Assigned Pods" icon={<Network className="w-4 h-4" />}>
            <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100">
              <p className="text-xs text-slate-500 mb-3">Pods assigned to this scope. Operators available to these pods will be filtered by this scope's criteria.</p>
              <div className="flex flex-wrap gap-2">
                {pods.map(p => (
                  <label key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                    (scopeForm.assigned_pod_ids || []).includes(p.id) ? 'bg-indigo-100 border-indigo-300 text-indigo-700 shadow-sm' : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}>
                    <Checkbox checked={(scopeForm.assigned_pod_ids || []).includes(p.id)} onCheckedChange={() => setScopeForm({...scopeForm, assigned_pod_ids: toggleArrayItem(scopeForm.assigned_pod_ids || [], p.id)})} />
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-slate-400">({p.total_members || 0})</span>
                  </label>
                ))}
                {pods.length === 0 && <p className="text-sm text-slate-400">No pods available</p>}
              </div>
            </div>
          </AdminModal.Section>
        </div>
      </AdminModal>

      {/* Assign Employee Modal */}
      <AdminModal
        open={showAssignModal}
        onOpenChange={(open) => { setShowAssignModal(open); if (!open) { setAssignSearch(''); setSelectedUserId(''); } }}
        title={`Assign Employee to "${selectedScope?.name || ''}"`}
        subtitle="Select an employee to grant this access scope"
        icon={<UserPlus className="w-5 h-5 text-white" />}
        accentColor="emerald"
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => { setShowAssignModal(false); setSelectedUserId(''); }}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAssignScope} disabled={!selectedUserId} data-testid="assign-btn">Assign</Button>
        </>}
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by name or email..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} className="pl-9 bg-slate-50/80" data-testid="assign-search-input" />
          </div>

          {/* Employee List */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 border rounded-xl p-2 bg-slate-50/30" data-testid="assign-employee-list">
            {(() => {
              const filtered = users.filter(u => {
                const name = (u.full_name || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                return !assignSearch || name.includes(assignSearch.toLowerCase()) || email.includes(assignSearch.toLowerCase());
              });
              if (filtered.length === 0) return <p className="text-sm text-slate-400 text-center py-4">No matching employees</p>;
              return filtered.map(u => {
                const uid = u.id || u._id;
                const isAssigned = selectedScope?.assignments?.some(a => a.user_id === uid);
                const isSelected = selectedUserId === uid;
                return (
                  <label key={uid} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                    isAssigned ? 'bg-slate-50 opacity-50 cursor-not-allowed' : isSelected ? 'bg-emerald-50 border border-emerald-300 shadow-sm' : 'hover:bg-white border border-transparent'
                  }`}>
                    <input type="radio" name="assign_user" value={uid} checked={isSelected} onChange={() => !isAssigned && setSelectedUserId(uid)} disabled={isAssigned} className="w-4 h-4 accent-emerald-600" />
                    <Avatar className="w-8 h-8"><AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">{(u.full_name || u.email)?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{u.full_name || 'No name'}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}{u.role ? ` \u00B7 ${u.role}` : ''}</p>
                    </div>
                    {isAssigned && <Badge className="ml-auto bg-green-100 text-green-700 text-xs shrink-0">Assigned</Badge>}
                  </label>
                );
              });
            })()}
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
