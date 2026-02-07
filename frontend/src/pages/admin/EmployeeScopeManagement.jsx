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
  Globe, MapPin, Building2, Briefcase, Loader2, Eye, Check, X, Users, Network, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

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
    name: '',
    description: '',
    countries: [],
    regions: [],
    market_segments: [],
    service_types: []
  });
  const [selectedUserId, setSelectedUserId] = useState('');

  const MARKET_SEGMENTS = [
    { value: 'sme', label: 'SME' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'strategic', label: 'Strategic' }
  ];

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scopesRes, usersRes, countriesRes, regionsRes] = await Promise.all([
        api.get('/employee-scopes'),
        api.get('/users/', { params: { role: 'admin' } }),
        api.get('/geography/countries'),
        api.get('/geography/regions')
      ]);
      setScopes(scopesRes.data.scopes || []);
      setUsers(usersRes.data.users || []);
      setCountries(countriesRes.data.countries || []);
      setRegions(regionsRes.data.regions || []);
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
    setScopeForm({ name: '', description: '', countries: [], regions: [], market_segments: [], service_types: [] });
  };

  const toggleArrayItem = (array, item) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
  };

  const isGlobalScope = (scope) => {
    return !scope.countries?.length && !scope.regions?.length && 
           !scope.market_segments?.length && !scope.service_types?.length;
  };

  const filteredScopes = scopes.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {scopes.length === 0 && (
            <Button variant="outline" onClick={initializeDefaults}>
              Initialize Defaults
            </Button>
          )}
          <Button onClick={() => { setEditingScope(null); resetScopeForm(); setShowScopeModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Scope
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scopes.length}</p>
                <p className="text-slate-600">Total Scopes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Globe className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scopes.filter(isGlobalScope).length}</p>
                <p className="text-slate-600">Global Scopes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scopes.filter(s => s.countries?.length).length}</p>
                <p className="text-slate-600">Country Scopes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Briefcase className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scopes.reduce((sum, s) => sum + (s.assigned_users || 0), 0)}</p>
                <p className="text-slate-600">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-40"
                  />
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
                    <div
                      key={scope.id}
                      onClick={() => fetchScopeDetails(scope.id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        selectedScope?.id === scope.id ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
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
                        name: selectedScope.name,
                        description: selectedScope.description || '',
                        countries: selectedScope.countries || [],
                        regions: selectedScope.regions || [],
                        market_segments: selectedScope.market_segments || [],
                        service_types: selectedScope.service_types || []
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
                      <div>
                        <p className="font-semibold text-green-700">Global Access</p>
                        <p className="text-sm text-slate-600">Access to all operators worldwide</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="font-semibold">Access Filters (AND logic)</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Countries</p>
                          <p className="font-medium">{selectedScope.countries?.length ? selectedScope.countries.join(', ') : 'All'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Regions</p>
                          <p className="font-medium">{selectedScope.regions?.length ? selectedScope.regions.join(', ') : 'All'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Market Segments</p>
                          <p className="font-medium">{selectedScope.market_segments?.length ? selectedScope.market_segments.join(', ') : 'All'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Service Types</p>
                          <p className="font-medium">{selectedScope.service_types?.length ? selectedScope.service_types.join(', ') : 'All'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assigned Users */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Assigned Users ({selectedScope.assignments?.length || 0})</h4>
                    <Button size="sm" onClick={() => setShowAssignModal(true)}>
                      <UserPlus className="w-4 h-4 mr-1" /> Assign User
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
                    <p className="text-slate-500 text-sm">No users assigned to this scope</p>
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
      <Dialog open={showScopeModal} onOpenChange={setShowScopeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingScope ? 'Edit Scope' : 'Create Access Scope'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Scope Name</Label>
              <Input value={scopeForm.name} onChange={(e) => setScopeForm({...scopeForm, name: e.target.value})} placeholder="Cameroon SME Manager" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={scopeForm.description} onChange={(e) => setScopeForm({...scopeForm, description: e.target.value})} placeholder="Access to SME operators in Cameroon" />
            </div>

            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-4">Leave all filters empty for global access. Multiple selections within a category = OR logic. Across categories = AND logic.</p>
            </div>

            {/* Countries */}
            <div>
              <Label className="mb-2 block">Countries (empty = all)</Label>
              <div className="flex flex-wrap gap-2">
                {countries.map(c => (
                  <label key={c.code} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.countries.includes(c.code) ? 'bg-blue-100 border-blue-300' : 'bg-slate-100 hover:bg-slate-200'} border`}>
                    <Checkbox 
                      checked={scopeForm.countries.includes(c.code)} 
                      onCheckedChange={() => setScopeForm({...scopeForm, countries: toggleArrayItem(scopeForm.countries, c.code)})}
                    />
                    <span className="text-sm">{c.name} ({c.code})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Market Segments */}
            <div>
              <Label className="mb-2 block">Market Segments (empty = all)</Label>
              <div className="flex flex-wrap gap-2">
                {MARKET_SEGMENTS.map(s => (
                  <label key={s.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.market_segments.includes(s.value) ? 'bg-green-100 border-green-300' : 'bg-slate-100 hover:bg-slate-200'} border`}>
                    <Checkbox 
                      checked={scopeForm.market_segments.includes(s.value)} 
                      onCheckedChange={() => setScopeForm({...scopeForm, market_segments: toggleArrayItem(scopeForm.market_segments, s.value)})}
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Service Types */}
            <div>
              <Label className="mb-2 block">Service Types (empty = all)</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map(s => (
                  <label key={s.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${scopeForm.service_types.includes(s.value) ? 'bg-purple-100 border-purple-300' : 'bg-slate-100 hover:bg-slate-200'} border`}>
                    <Checkbox 
                      checked={scopeForm.service_types.includes(s.value)} 
                      onCheckedChange={() => setScopeForm({...scopeForm, service_types: toggleArrayItem(scopeForm.service_types, s.value)})}
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScopeModal(false)}>Cancel</Button>
            <Button onClick={handleSaveScope}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to "{selectedScope?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                {users.map(u => {
                  const isAssigned = selectedScope?.assignments?.some(a => a.user_id === (u.id || u._id));
                  return (
                    <label 
                      key={u.id || u._id} 
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isAssigned ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 
                        selectedUserId === (u.id || u._id) ? 'bg-blue-100 border-blue-300 border' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="user"
                        value={u.id || u._id}
                        checked={selectedUserId === (u.id || u._id)}
                        onChange={() => !isAssigned && setSelectedUserId(u.id || u._id)}
                        disabled={isAssigned}
                        className="w-4 h-4"
                      />
                      <Avatar><AvatarFallback>{(u.full_name || u.email)?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{u.full_name || 'No name'}</p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                      </div>
                      {isAssigned && <Badge className="ml-auto bg-green-100 text-green-700">Assigned</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setSelectedUserId(''); }}>Cancel</Button>
            <Button onClick={handleAssignScope} disabled={!selectedUserId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
