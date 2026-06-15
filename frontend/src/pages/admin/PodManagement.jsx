import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, Plus, Edit2, Trash2, Search, RefreshCw, UserPlus, UserMinus,
  Building2, Crown, Briefcase, Headphones, Wrench, Loader2, ChevronRight, Network, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';
import { AdminModal, FormField, StyledInput } from '@/components/shared/AdminModal';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { TabsContent } from '@/components/ui/tabs';

const POD_ROLE_CONFIG = {
  team_lead: { label: 'Team Lead', icon: Crown, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: '#D97706' },
  bdr: { label: 'BDR', icon: Briefcase, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: '#2563EB' },
  csm: { label: 'CSM', icon: Users, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: '#059669' },
  technician: { label: 'Technician', icon: Wrench, bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', accent: '#7C3AED' },
  support_agent: { label: 'Support Agent', icon: Headphones, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: '#E11D48' }
};

export default function PodManagement() {
  const navigate = useNavigate();
  const [pods, setPods] = useState([]);
  const [users, setUsers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [scopeData, setScopeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showPodModal, setShowPodModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState(null);
  const [editingPod, setEditingPod] = useState(null);
  
  // Form states
  const [podForm, setPodForm] = useState({ name: '', description: '' });
  const [memberForm, setMemberForm] = useState({ user_id: '', pod_role: 'csm' });
  const [selectedOperatorIds, setSelectedOperatorIds] = useState([]);
  
  // Operator modal filter states
  const [opSearch, setOpSearch] = useState('');
  const [opStatusFilter, setOpStatusFilter] = useState('all');
  const [opTypeFilter, setOpTypeFilter] = useState('all');
  const [opCountryFilter, setOpCountryFilter] = useState('all');

  const [memberSearch, setMemberSearch] = useState('');
  const [memberDeptFilter, setMemberDeptFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [podsRes, employeesRes, usersRes, operatorsRes, scopesRes] = await Promise.all([
        api.get('/pods'),
        api.get('/employees/'),
        api.get('/users/'),
        api.get('/operators/'),
        api.get('/employee-scopes')
      ]);
      setPods(podsRes.data.pods || []);
      setOperators(operatorsRes.data.operators || []);
      // Store scopes for filtering operators by pod's assigned scope
      setScopeData(scopesRes.data.scopes || []);

      // Build combined employee list from both employees collection and admin users
      const employees = employeesRes.data.employees || employeesRes.data || [];
      const allUsers = usersRes.data.users || [];
      
      // Map employees, linking to user accounts by email
      const usedEmails = new Set();
      const usersByEmail = {};
      for (const u of allUsers) {
        if (u.email) usersByEmail[u.email.toLowerCase()] = u;
      }
      
      const combined = [];
      
      // First: employees from the employees collection
      for (const emp of employees) {
        const matchedUser = emp.email ? usersByEmail[emp.email.toLowerCase()] : null;
        combined.push({
          ...emp,
          _source: 'employee',
          _linked_user_id: matchedUser ? (matchedUser.id || matchedUser._id) : null,
          _display_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
        });
        if (emp.email) usedEmails.add(emp.email.toLowerCase());
      }
      
      // Second: platform users (admin/super_admin/employee) not already in the employees list
      for (const u of allUsers) {
        if (u.role === 'admin' || u.role === 'super_admin' || u.role === 'employee') {
          if (!u.email || !usedEmails.has(u.email.toLowerCase())) {
            combined.push({
              id: u.id || u._id,
              email: u.email,
              first_name: u.full_name?.split(' ')[0] || '',
              last_name: u.full_name?.split(' ').slice(1).join(' ') || '',
              department: 'platform',
              _source: 'user',
              _linked_user_id: u.id || u._id,
              _display_name: u.full_name || u.email || 'Unknown',
            });
          }
        }
      }
      
      setUsers(combined);
    } catch {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePod = async () => {
    try {
      if (editingPod) {
        await api.put(`/pods/${editingPod.id}`, podForm);
        toast.success('Pod updated');
      } else {
        await api.post('/pods', podForm);
        toast.success('Pod created');
      }
      setShowPodModal(false);
      setEditingPod(null);
      setPodForm({ name: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save pod');
    }
  };

  const handleDeletePod = async (id) => {
    if (!confirm('Deactivate this pod?')) return;
    try {
      await api.delete(`/pods/${id}`);
      toast.success('Pod deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleAddMember = async () => {
    if (!selectedPod) return;
    try {
      await api.post(`/pods/${selectedPod.id}/members`, memberForm);
      toast.success('Member added');
      setShowMemberModal(false);
      setMemberForm({ user_id: '', pod_role: 'csm' });
      fetchPodDetails(selectedPod.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedPod || !confirm('Remove this member?')) return;
    try {
      await api.delete(`/pods/${selectedPod.id}/members/${userId}`);
      toast.success('Member removed');
      fetchPodDetails(selectedPod.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove');
    }
  };

  const handleAssignOperators = async () => {
    if (!selectedPod) return;
    try {
      await api.post(`/pods/${selectedPod.id}/operators`, { operator_ids: selectedOperatorIds });
      toast.success('Operators assigned');
      setShowOperatorModal(false);
      setSelectedOperatorIds([]);
      fetchPodDetails(selectedPod.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign');
    }
  };

  const handleRemoveOperator = async (operatorId) => {
    if (!selectedPod || !confirm('Remove this operator?')) return;
    try {
      await api.delete(`/pods/${selectedPod.id}/operators/${operatorId}`);
      toast.success('Operator removed');
      fetchPodDetails(selectedPod.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove');
    }
  };

  const fetchPodDetails = async (podId) => {
    try {
      const res = await api.get(`/pods/${podId}`);
      setSelectedPod(res.data);
    } catch {
      toast.error('Failed to fetch pod details');
    }
  };

  const filteredPods = pods.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get employees/users not already in a pod (only those with linked user accounts)
  const availableUsers = users.filter(u => {
    if (!u._linked_user_id) return false;
    return !pods.some(p => p.member_ids?.includes(u._linked_user_id));
  });

  const getEmployeeLabel = (emp) => emp._display_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unknown';

  // Get operators filtered by scope(s) assigned to the selected pod
  const getScopeFilteredOperators = () => {
    if (!selectedPod) return operators;
    // Find scopes that have this pod assigned
    const podScopes = scopeData.filter(s => s.assigned_pod_ids?.includes(selectedPod.id));
    if (podScopes.length === 0) return operators; // No scope restriction → show all
    
    return operators.filter(op => {
      // Operator must match at least ONE scope (OR logic across scopes)
      return podScopes.some(scope => {
        // AND logic within a single scope
        if (scope.countries?.length > 0 && !scope.countries.includes(op.country?.toUpperCase())) return false;
        if (scope.regions?.length > 0 && !scope.regions.includes(op.region)) return false;
        if (scope.market_segments?.length > 0 && !scope.market_segments.includes(op.market_segment)) return false;
        if (scope.service_types?.length > 0) {
          const opServices = op.service_types || [op.operator_type];
          if (!scope.service_types.some(st => opServices.includes(st))) return false;
        }
        if (scope.specific_operator_ids?.length > 0 && !scope.specific_operator_ids.includes(op.id)) return false;
        return true;
      });
    });
  };

  return (
    <ManagementShell
      title="Employee Management"
      icon={Users}
      subtitle="Manage staff, pods, and access scopes"
      scopeFilter={
        <Button className="bg-[#082c59] h-8" size="sm" onClick={() => { setEditingPod(null); setPodForm({ name: '', description: '' }); setShowPodModal(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Pod
        </Button>
      }
      onRefresh={fetchData}
      refreshing={loading}
      tabs={[
        { value: 'employees', label: 'Employees', icon: Users, testId: 'tab-employees' },
        { value: 'pods', label: 'Pod Management', icon: Network, testId: 'tab-pod-management' },
        { value: 'access-scopes', label: 'Access Scopes', icon: ShieldCheck, testId: 'tab-access-scopes' },
      ]}
      activeTab="pods"
      onTabChange={(v) => {
        if (v === 'employees') navigate('/admin/employees');
        else if (v === 'pods') navigate('/admin/employees/pods');
        else if (v === 'access-scopes') navigate('/admin/employees/access-scopes');
      }}
      testIdPrefix="pods-mgmt"
    >
      <TabsContent value="pods" className="mt-4 space-y-4" forceMount>

      <SubpageCard title="Pods" icon={Network} count={pods.length} testId="pods-subpage">
        <p className="text-xs text-slate-500">Manage internal team pods and operator assignments</p>
      </SubpageCard>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="pods-stats-grid">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-xl shadow-sm">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{pods.length}</p>
                <p className="text-blue-700 text-sm">Total Pods</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-100/50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 rounded-xl shadow-sm">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{pods.filter(p => p.team_lead_id).length}</p>
                <p className="text-amber-700 text-sm">With Team Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-purple-100/50 border-violet-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500 rounded-xl shadow-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-900">{pods.reduce((sum, p) => sum + (p.total_operators || 0), 0)}</p>
                <p className="text-violet-700 text-sm">Assigned Operators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-100/50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500 rounded-xl shadow-sm">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-900">{pods.reduce((sum, p) => sum + (p.total_members || 0), 0)}</p>
                <p className="text-emerald-700 text-sm">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pods List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pods</CardTitle>
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
              ) : filteredPods.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No pods found</div>
              ) : (
                <div className="space-y-2">
                  {filteredPods.map(pod => (
                    <div
                      key={pod.id}
                      onClick={() => fetchPodDetails(pod.id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        selectedPod?.id === pod.id 
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md ring-1 ring-blue-200' 
                          : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{pod.name}</h3>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Users className="w-3 h-3" /> {pod.total_members || 0} members
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Building2 className="w-3 h-3" /> {pod.total_operators || 0} operators
                            </span>
                          </div>
                          {pod.team_lead_name && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><Crown className="w-3 h-3" /> {pod.team_lead_name}</p>
                          )}
                        </div>
                        <ChevronRight className={`w-5 h-5 transition-colors ${selectedPod?.id === pod.id ? 'text-blue-500' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pod Details */}
        <div className="lg:col-span-2">
          {selectedPod ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedPod.name}</CardTitle>
                    <p className="text-slate-500 mt-1">{selectedPod.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingPod(selectedPod); setPodForm({ name: selectedPod.name, description: selectedPod.description || '' }); setShowPodModal(true); }}>
                      <Edit2 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeletePod(selectedPod.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Lead */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Team Lead</h4>
                  </div>
                  {selectedPod.team_lead_id ? (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar className="border-2 border-amber-400 w-11 h-11">
                          <AvatarFallback className="bg-amber-500 text-white font-bold">{selectedPod.team_lead_name?.charAt(0) || 'T'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-900">{selectedPod.team_lead_name}</p>
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-300 mt-0.5">
                            <Crown className="w-3 h-3 mr-1" /> Team Lead
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveMember(selectedPod.team_lead_id)}
                        data-testid="remove-team-lead-btn"
                      >
                        <UserMinus className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No team lead assigned</p>
                  )}
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Members ({selectedPod.members?.length || 0})</h4>
                    <Button size="sm" onClick={() => setShowMemberModal(true)}>
                      <UserPlus className="w-4 h-4 mr-1" /> Add Member
                    </Button>
                  </div>
                  {selectedPod.members?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPod.members.map(member => {
                        const roleConfig = POD_ROLE_CONFIG[member.pod_role] || POD_ROLE_CONFIG.csm;
                        const RoleIcon = roleConfig.icon;
                        return (
                          <div key={member.id} className={`flex items-center justify-between p-3.5 rounded-xl border ${roleConfig.border} ${roleConfig.bg}`}>
                            <div className="flex items-center gap-3">
                              <Avatar className="border-2" style={{ borderColor: roleConfig.accent }}>
                                <AvatarFallback className="text-white text-sm font-bold" style={{ backgroundColor: roleConfig.accent }}>{member.user_name?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-slate-900">{member.user_name}</p>
                                <p className="text-xs text-slate-500">{member.user_email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${roleConfig.bg} ${roleConfig.text} border ${roleConfig.border}`}>
                                <RoleIcon className="w-3 h-3 mr-1" /> {roleConfig.label}
                              </Badge>
                              <Button variant="ghost" size="icon" className="hover:bg-red-50" onClick={() => handleRemoveMember(member.user_id)} data-testid={`remove-member-${member.user_id}`}>
                                <UserMinus className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No members yet</p>
                  )}
                </div>

                {/* Assigned Operators */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Assigned Operators ({selectedPod.assigned_operators?.length || 0})</h4>
                    <Button size="sm" onClick={() => setShowOperatorModal(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Assign Operators
                    </Button>
                  </div>
                  {selectedPod.assigned_operators?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPod.assigned_operators.map(op => (
                        <div key={op.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <p className="font-medium">{op.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{op.type}</Badge>
                              <Badge className={op.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>{op.status}</Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveOperator(op.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No operators assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a pod to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Pod Modal */}
      <AdminModal
        open={showPodModal}
        onOpenChange={setShowPodModal}
        title={editingPod ? 'Edit Pod' : 'Create New Pod'}
        subtitle={editingPod ? 'Update pod details' : 'Set up a new team pod'}
        icon={<Network className="w-5 h-5 text-white" />}
        accentColor="blue"
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setShowPodModal(false)}>Cancel</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSavePod}>Save</Button>
        </>}
      >
        <div className="space-y-4">
          <FormField label="Pod Name" required>
            <StyledInput value={podForm.name} onChange={(e) => setPodForm({...podForm, name: e.target.value})} placeholder="Alpha Team" />
          </FormField>
          <FormField label="Description">
            <Textarea value={podForm.description} onChange={(e) => setPodForm({...podForm, description: e.target.value})} placeholder="Handles Cameroon operations..." className="bg-slate-50/80 border-slate-200 focus:bg-white" />
          </FormField>
        </div>
      </AdminModal>

      {/* Add Member Modal */}
      <AdminModal
        open={showMemberModal}
        onOpenChange={(open) => { setShowMemberModal(open); if (!open) { setMemberSearch(''); setMemberDeptFilter('all'); } }}
        title={`Add Member to ${selectedPod?.name || 'Pod'}`}
        subtitle="Select an employee and assign a role"
        icon={<UserPlus className="w-5 h-5 text-white" />}
        accentColor="emerald"
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setShowMemberModal(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddMember} disabled={!memberForm.user_id}>Add Member</Button>
        </>}
      >
          <div className="space-y-4 pt-2">
            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9"
                  data-testid="member-search-input"
                />
              </div>
              <Select value={memberDeptFilter} onValueChange={setMemberDeptFilter}>
                <SelectTrigger className="w-[140px]" data-testid="member-dept-filter">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Depts</SelectItem>
                  {[...new Set(availableUsers.map(u => u.department).filter(Boolean))].map(d => (
                    <SelectItem key={d} value={d} className="capitalize">{d.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee List */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Select Employee</Label>
              <div className="max-h-56 overflow-y-auto space-y-1.5 border rounded-lg p-2" data-testid="member-employee-list">
                {(() => {
                  const filtered = availableUsers.filter(u => {
                    const label = getEmployeeLabel(u).toLowerCase();
                    const email = (u.email || '').toLowerCase();
                    const matchesSearch = !memberSearch || label.includes(memberSearch.toLowerCase()) || email.includes(memberSearch.toLowerCase());
                    const matchesDept = memberDeptFilter === 'all' || u.department === memberDeptFilter;
                    return matchesSearch && matchesDept;
                  });
                  if (filtered.length === 0) return <p className="text-sm text-slate-400 text-center py-4">No matching employees found</p>;
                  return filtered.map(u => {
                    const isSelected = memberForm.user_id === u._linked_user_id;
                    return (
                      <label
                        key={u._linked_user_id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                          isSelected ? 'bg-blue-50 border border-blue-300' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pod_member"
                          checked={isSelected}
                          onChange={() => setMemberForm({...memberForm, user_id: u._linked_user_id})}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{getEmployeeLabel(u)}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email}{u.department ? ` · ${u.department.replace('_', ' ')}` : ''}{u.city ? ` · ${u.city}` : ''}</p>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
              {availableUsers.length === 0 && (
                <p className="text-sm text-amber-600 mt-1.5 bg-amber-50 p-2 rounded">No available employees to add</p>
              )}
            </div>

            {/* Role Selector */}
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {Object.entries(POD_ROLE_CONFIG).map(([key, config]) => {
                  const RoleIcon = config.icon;
                  const isSelected = memberForm.pod_role === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMemberForm({...memberForm, pod_role: key})}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        isSelected ? `${config.bg} ${config.border} shadow-sm` : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <RoleIcon className="w-4 h-4" style={{ color: isSelected ? config.accent : '#94a3b8' }} />
                      <span className={`text-sm font-medium ${isSelected ? config.text : 'text-slate-600'}`}>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </AdminModal>

      {/* Assign Operators Modal */}
      <Dialog open={showOperatorModal} onOpenChange={(open) => { setShowOperatorModal(open); if (!open) { setOpSearch(''); setOpStatusFilter('all'); setOpTypeFilter('all'); setOpCountryFilter('all'); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Operators to {selectedPod?.name}</DialogTitle>
          </DialogHeader>

          {/* Search & Filters */}
          <div className="space-y-3" data-testid="operator-assign-filters">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search operators by name..."
                value={opSearch}
                onChange={(e) => setOpSearch(e.target.value)}
                className="pl-9"
                data-testid="operator-search-input"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={opStatusFilter} onValueChange={setOpStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="operator-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={opTypeFilter} onValueChange={setOpTypeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="operator-type-filter">
                  <SelectValue placeholder="Service Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {[...new Set(operators.map(o => o.operator_type).filter(Boolean))].sort().map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={opCountryFilter} onValueChange={setOpCountryFilter}>
                <SelectTrigger className="w-[140px]" data-testid="operator-country-filter">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {[...new Set(operators.map(o => o.country).filter(Boolean))].sort().map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope info banner */}
          {(() => {
            const podScopes = scopeData.filter(s => s.assigned_pod_ids?.includes(selectedPod?.id));
            if (podScopes.length > 0) {
              return (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                  <p className="text-indigo-700 font-medium">Filtered by scope: {podScopes.map(s => s.name).join(', ')}</p>
                  <p className="text-indigo-500 text-xs">Only operators matching the assigned scope criteria are shown.</p>
                </div>
              );
            }
            return null;
          })()}

          {/* Operator List */}
          <div className="max-h-72 overflow-y-auto space-y-2">
            {(() => {
              const scopeFiltered = getScopeFilteredOperators();
              const available = scopeFiltered
                .filter(op => !selectedPod?.assigned_operator_ids?.includes(op.id || op._id))
                .filter(op => opSearch === '' || (op.name || '').toLowerCase().includes(opSearch.toLowerCase()))
                .filter(op => opStatusFilter === 'all' || op.status === opStatusFilter)
                .filter(op => opTypeFilter === 'all' || op.operator_type === opTypeFilter)
                .filter(op => opCountryFilter === 'all' || op.country === opCountryFilter);
              if (available.length === 0) {
                return <p className="text-center py-8 text-slate-500">{opSearch || opStatusFilter !== 'all' || opTypeFilter !== 'all' || opCountryFilter !== 'all' ? 'No operators match filters' : 'All operators are already assigned'}</p>;
              }
              return available.map(op => (
                <label key={op.id || op._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100" data-testid={`operator-option-${op.id || op._id}`}>
                  <input
                    type="checkbox"
                    checked={selectedOperatorIds.includes(op.id || op._id)}
                    onChange={(e) => {
                      const id = op.id || op._id;
                      if (e.target.checked) setSelectedOperatorIds(prev => [...prev, id]);
                      else setSelectedOperatorIds(prev => prev.filter(i => i !== id));
                    }}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{op.name}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{op.operator_type}</Badge>
                      <Badge className="bg-slate-100 text-xs">{op.country || 'CM'}</Badge>
                      <Badge className={`text-xs ${op.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{op.status}</Badge>
                    </div>
                  </div>
                </label>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowOperatorModal(false); setSelectedOperatorIds([]); setOpSearch(''); setOpStatusFilter('all'); setOpTypeFilter('all'); setOpCountryFilter('all'); }}>Cancel</Button>
            <Button onClick={handleAssignOperators} disabled={selectedOperatorIds.length === 0}>
              Assign {selectedOperatorIds.length} Operator{selectedOperatorIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>
    </ManagementShell>
  );
}
