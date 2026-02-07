import React, { useState, useEffect } from 'react';
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
  Building2, Crown, Briefcase, Headphones, Wrench, Loader2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

const POD_ROLE_CONFIG = {
  team_lead: { label: 'Team Lead', icon: Crown, color: 'bg-yellow-100 text-yellow-700' },
  bdr: { label: 'BDR', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  csm: { label: 'CSM', icon: Users, color: 'bg-green-100 text-green-700' },
  technician: { label: 'Technician', icon: Wrench, color: 'bg-purple-100 text-purple-700' },
  support_agent: { label: 'Support Agent', icon: Headphones, color: 'bg-orange-100 text-orange-700' }
};

export default function PodManagement() {
  const [pods, setPods] = useState([]);
  const [users, setUsers] = useState([]);
  const [operators, setOperators] = useState([]);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [podsRes, usersRes, operatorsRes] = await Promise.all([
        api.get('/pods'),
        api.get('/users?role=admin'),
        api.get('/operators')
      ]);
      setPods(podsRes.data.pods || []);
      setUsers(usersRes.data.users || []);
      setOperators(operatorsRes.data.operators || []);
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to fetch pod details');
    }
  };

  const filteredPods = pods.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get users not already in a pod
  const availableUsers = users.filter(u => {
    // Check if user is already in any pod
    const isInPod = pods.some(p => p.member_ids?.includes(u.id || u._id));
    return !isInPod;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pod Management</h1>
          <p className="text-slate-600">Manage internal team pods and operator assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setEditingPod(null); setPodForm({ name: '', description: '' }); setShowPodModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Pod
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pods.length}</p>
                <p className="text-slate-600">Total Pods</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Crown className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pods.filter(p => p.team_lead_id).length}</p>
                <p className="text-slate-600">With Team Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pods.reduce((sum, p) => sum + (p.total_operators || 0), 0)}</p>
                <p className="text-slate-600">Assigned Operators</p>
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
                <p className="text-2xl font-bold">{pods.reduce((sum, p) => sum + (p.total_members || 0), 0)}</p>
                <p className="text-slate-600">Total Members</p>
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
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        selectedPod?.id === pod.id ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{pod.name}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <Users className="w-3 h-3" /> {pod.total_members || 0}
                            <Building2 className="w-3 h-3 ml-2" /> {pod.total_operators || 0}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
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
                    <h4 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-600" /> Team Lead</h4>
                  </div>
                  {selectedPod.team_lead_id ? (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
                      <Avatar><AvatarFallback>{selectedPod.team_lead_name?.charAt(0) || 'T'}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{selectedPod.team_lead_name}</p>
                        <Badge className="bg-yellow-100 text-yellow-700">Team Lead</Badge>
                      </div>
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
                          <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <Avatar><AvatarFallback>{member.user_name?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                              <div>
                                <p className="font-medium">{member.user_name}</p>
                                <p className="text-sm text-slate-500">{member.user_email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={roleConfig.color}>
                                <RoleIcon className="w-3 h-3 mr-1" /> {roleConfig.label}
                              </Badge>
                              {member.pod_role !== 'team_lead' && (
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.user_id)}>
                                  <UserMinus className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
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
      <Dialog open={showPodModal} onOpenChange={setShowPodModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPod ? 'Edit Pod' : 'Create Pod'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pod Name</Label>
              <Input value={podForm.name} onChange={(e) => setPodForm({...podForm, name: e.target.value})} placeholder="Alpha Team" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={podForm.description} onChange={(e) => setPodForm({...podForm, description: e.target.value})} placeholder="Handles Cameroon operations..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPodModal(false)}>Cancel</Button>
            <Button onClick={handleSavePod}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to {selectedPod?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <Select value={memberForm.user_id} onValueChange={(v) => setMemberForm({...memberForm, user_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(u => (
                    <SelectItem key={u.id || u._id} value={u.id || u._id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableUsers.length === 0 && <p className="text-sm text-slate-500 mt-1">All employees are already assigned to pods</p>}
            </div>
            <div>
              <Label>Role</Label>
              <Select value={memberForm.pod_role} onValueChange={(v) => setMemberForm({...memberForm, pod_role: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(POD_ROLE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberModal(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!memberForm.user_id}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Operators Modal */}
      <Dialog open={showOperatorModal} onOpenChange={setShowOperatorModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Operators to {selectedPod?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {operators.filter(op => !selectedPod?.assigned_operator_ids?.includes(op.id || op._id)).map(op => (
              <label key={op.id || op._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={selectedOperatorIds.includes(op.id || op._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOperatorIds([...selectedOperatorIds, op.id || op._id]);
                    } else {
                      setSelectedOperatorIds(selectedOperatorIds.filter(id => id !== (op.id || op._id)));
                    }
                  }}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium">{op.name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{op.operator_type}</Badge>
                    <Badge className="bg-slate-100">{op.country || 'CM'}</Badge>
                  </div>
                </div>
              </label>
            ))}
            {operators.filter(op => !selectedPod?.assigned_operator_ids?.includes(op.id || op._id)).length === 0 && (
              <p className="text-center py-8 text-slate-500">All operators are already assigned</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowOperatorModal(false); setSelectedOperatorIds([]); }}>Cancel</Button>
            <Button onClick={handleAssignOperators} disabled={selectedOperatorIds.length === 0}>
              Assign {selectedOperatorIds.length} Operator{selectedOperatorIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
