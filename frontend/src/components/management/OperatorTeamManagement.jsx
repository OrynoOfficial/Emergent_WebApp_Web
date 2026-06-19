import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Users, Plus, Search, MoreVertical, Shield, UserCog, User, Mail,
  Phone, Calendar, Crown, Settings, Trash2, RefreshCw, UserPlus,
  CheckCircle, XCircle, AlertTriangle, Key
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import OperatorTeamMemberWizard from '@/components/management/OperatorTeamMemberWizard';

// Role configuration
const OPERATOR_ROLES = {
  owner: { label: 'Owner', icon: Crown, color: 'bg-amber-100 text-amber-800', description: 'Full control, cannot be removed' },
  local_admin: { label: 'Local Admin', icon: Shield, color: 'bg-blue-100 text-blue-800', description: 'Can manage users and data' },
  local_user: { label: 'Local User', icon: User, color: 'bg-slate-100 text-slate-800', description: 'Limited access to data' }
};

// Default scoped permissions
const SCOPED_PERMISSIONS = [
  { id: 'bookings.view', label: 'View Bookings', category: 'Bookings' },
  { id: 'bookings.manage', label: 'Manage Bookings', category: 'Bookings' },
  { id: 'services.view', label: 'View Services', category: 'Services' },
  { id: 'services.manage', label: 'Manage Services', category: 'Services' },
  { id: 'reports.view', label: 'View Reports', category: 'Reports' },
  { id: 'reports.export', label: 'Export Reports', category: 'Reports' },
  { id: 'settings.view', label: 'View Settings', category: 'Settings' },
  { id: 'settings.manage', label: 'Manage Settings', category: 'Settings' }
];

/**
 * OperatorTeamManagement - Manage users within an operator
 * 
 * @param {string} operatorId - The operator ID
 * @param {string} operatorName - The operator name
 * @param {boolean} embedded - If true, renders without outer card wrapper
 */
export default function OperatorTeamManagement({ operatorId, operatorName, embedded = false }) {
  const { user: currentUser } = useAuth();
  
  // State
  const [users, setUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    operator_role: 'local_user',
    scoped_permissions: [],
    send_invite: true,
  });

  // Owner's available permissions — used as the cap for what we can grant
  const [ownerPermissions, setOwnerPermissions] = useState([]);
  const [lastInvite, setLastInvite] = useState(null);  // { email, link, emailStatus, tempPassword }
  
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    operator_role: 'local_user',
    scoped_permissions: []
  });
  
  const [editForm, setEditForm] = useState({
    operator_role: '',
    scoped_permissions: [],
    status: ''
  });
  
  // Determine user's management capabilities
  const canManageUsers = currentUser?.role === 'super_admin' || 
                         currentUser?.role === 'admin' || 
                         currentUser?.operator_role === 'owner' || 
                         currentUser?.operator_role === 'local_admin';
  
  const canCreateAdmins = currentUser?.role === 'super_admin' || 
                          currentUser?.role === 'admin' || 
                          currentUser?.operator_role === 'owner';
  
  const canAssignExistingUsers = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  
  // Load operator users
  const loadUsers = useCallback(async () => {
    if (!operatorId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter && roleFilter !== 'all') params.append('operator_role', roleFilter);
      
      const response = await api.get(`/operators/${operatorId}/users?${params.toString()}`);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [operatorId, searchTerm, roleFilter]);
  
  // Load stats
  const loadStats = useCallback(async () => {
    if (!operatorId) return;
    
    try {
      const response = await api.get(`/operators/${operatorId}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [operatorId]);
  
  // Load available users for assignment
  const loadAvailableUsers = useCallback(async () => {
    if (!operatorId || !canAssignExistingUsers) return;
    
    try {
      const response = await api.get(`/operators/${operatorId}/users/available`);
      setAvailableUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load available users:', error);
    }
  }, [operatorId, canAssignExistingUsers]);
  
  // Load owner permissions (the cap for what we can grant to a new member)
  const loadOwnerPermissions = useCallback(async () => {
    if (!operatorId) return;
    try {
      const res = await api.get(`/operators/${operatorId}/owner-permissions`);
      setOwnerPermissions(res.data?.permissions || []);
    } catch {
      setOwnerPermissions([]);
    }
  }, [operatorId]);

  useEffect(() => {
    loadUsers();
    loadStats();
    loadOwnerPermissions();
  }, [loadUsers, loadStats, loadOwnerPermissions]);
  
  useEffect(() => {
    if (showAssignDialog) {
      loadAvailableUsers();
    }
  }, [showAssignDialog, loadAvailableUsers]);
  
  // Create new user
  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.full_name) {
      toast.error('Full name and email are required');
      return;
    }
    if (!createForm.send_invite && !createForm.password) {
      toast.error('Pick a password or enable the invite toggle');
      return;
    }
    if (createForm.password && createForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/operators/${operatorId}/users`, createForm);
      const data = res.data || {};
      setShowCreateDialog(false);
      setCreateForm({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        operator_role: 'local_user',
        scoped_permissions: [],
        send_invite: true,
      });
      if (data.send_invite && data.invite_link) {
        setLastInvite({
          email: data.email,
          link: data.invite_link,
          emailStatus: data.invite_email_status,
          tempPassword: data.default_password,
        });
        toast.success(
          data.invite_email_status === 'sent'
            ? `Invite email sent to ${data.email}`
            : 'User created — copy the invite link below'
        );
      } else {
        toast.success('User created');
      }
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Assign existing user
  const handleAssignUser = async () => {
    if (!assignForm.user_id) {
      toast.error('Please select a user');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post(`/operators/${operatorId}/users/assign`, assignForm);
      toast.success('User assigned successfully');
      setShowAssignDialog(false);
      setAssignForm({
        user_id: '',
        operator_role: 'local_user',
        scoped_permissions: []
      });
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Update user
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    setSubmitting(true);
    try {
      await api.put(`/operators/${operatorId}/users/${selectedUser.id}`, editForm);
      toast.success('User updated successfully');
      setShowEditDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Remove user
  const handleRemoveUser = async () => {
    if (!selectedUser) return;
    
    setSubmitting(true);
    try {
      await api.delete(`/operators/${operatorId}/users/${selectedUser.id}`);
      toast.success('User removed from operator');
      setShowRemoveDialog(false);
      setSelectedUser(null);
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Open edit dialog
  const openEditDialog = (user) => {
    setSelectedUser(user);
    setEditForm({
      operator_role: user.operator_role,
      scoped_permissions: user.scoped_permissions || [],
      status: user.status
    });
    setShowEditDialog(true);
  };
  
  // Open remove dialog
  const openRemoveDialog = (user) => {
    setSelectedUser(user);
    setShowRemoveDialog(true);
  };
  
  // Check if user can be edited/removed
  const canManageUser = (targetUser) => {
    // Can't manage yourself
    if (targetUser.id === currentUser?.id) return false;
    
    // Owner can't be managed by anyone except super_admin
    if (targetUser.operator_role === 'owner' && currentUser?.role !== 'super_admin') return false;
    
    // Local admins can't manage other local_admins
    if (currentUser?.operator_role === 'local_admin' && targetUser.operator_role === 'local_admin') return false;
    
    return canManageUsers;
  };
  
  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  // Render content
  const content = (
    <div className="space-y-6">
      {/* Stats — slim chip strip (matches /Ratings + parent Team & Roles).
          Hidden when embedded since the parent page already shows the
          same numbers in its own chip strip. */}
      {stats && !embedded && (
        <div className="flex flex-wrap items-center gap-2" data-testid="team-stats-chips">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#082c59]/5 border border-[#082c59]/20 text-[#082c59] text-xs font-medium">
            <Users className="h-3.5 w-3.5" /> Total <strong className="font-bold">{stats.total_users}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
            <Crown className="h-3.5 w-3.5 text-amber-500" /> Owners <strong className="font-bold">{stats.by_role?.owner || 0}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
            <Shield className="h-3.5 w-3.5" /> Admins <strong className="font-bold">{stats.by_role?.local_admin || 0}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <CheckCircle className="h-3.5 w-3.5" /> Active <strong className="font-bold">{stats.active_users}</strong>
          </span>
        </div>
      )}
      
      {/* Actions & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
              <SelectItem value="local_admin">Local Admins</SelectItem>
              <SelectItem value="local_user">Local Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {canManageUsers && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Create User
            </Button>
            {canAssignExistingUsers && (
              <Button variant="outline" onClick={() => setShowAssignDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Assign Existing
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Users List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p>No team members found</p>
              {canManageUsers && (
                <Button variant="link" onClick={() => setShowCreateDialog(true)}>
                  Add the first member
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {users.map(user => {
                const roleConfig = OPERATOR_ROLES[user.operator_role] || OPERATOR_ROLES.local_user;
                const RoleIcon = roleConfig.icon;
                const isCurrentUser = user.id === currentUser?.id;
                
                return (
                  <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.profile_picture} />
                        <AvatarFallback className="bg-slate-200 text-slate-600">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {user.full_name || user.email}
                            {isCurrentUser && <span className="text-slate-400 ml-1">(You)</span>}
                          </p>
                          <Badge className={`${roleConfig.color} text-xs`}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                          {user.status !== 'active' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              {user.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {user.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {canManageUser(user) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Settings className="h-4 w-4 mr-2" /> Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openRemoveDialog(user)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create Team Member Wizard (3-step) */}
      <OperatorTeamMemberWizard
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        operatorId={operatorId}
        onCreated={async (payload) => {
          const res = await api.post(`/operators/${operatorId}/users`, payload);
          const data = res.data || {};
          setShowCreateDialog(false);
          if (data.send_invite && data.invite_link) {
            setLastInvite({
              email: data.email,
              link: data.invite_link,
              emailStatus: data.invite_email_status,
              tempPassword: data.default_password,
            });
            toast.success(
              data.invite_email_status === 'sent'
                ? `Invite email sent to ${data.email}`
                : 'Team member created — copy the invite link below'
            );
          } else {
            toast.success('Team member created');
          }
          loadUsers();
          loadStats();
        }}
      />
      
      {/* Assign Existing User Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Assign Existing User
            </DialogTitle>
            <DialogDescription>
              Assign an existing platform user to {operatorName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Select User *</Label>
              <Select
                value={assignForm.user_id}
                onValueChange={(v) => setAssignForm(f => ({ ...f, user_id: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  <ScrollArea className="max-h-[200px]">
                    {availableUsers.length === 0 ? (
                      <div className="p-3 text-center text-slate-500 text-sm">
                        No available users to assign
                      </div>
                    ) : (
                      availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span>{user.full_name || user.email}</span>
                            <span className="text-xs text-slate-500">{user.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Role</Label>
              <Select
                value={assignForm.operator_role}
                onValueChange={(v) => setAssignForm(f => ({ ...f, operator_role: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="local_user">Local User</SelectItem>
                  <SelectItem value="local_admin">Local Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignUser} disabled={submitting}>
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-600" />
              Edit Team Member
            </DialogTitle>
            <DialogDescription>
              Update role and permissions for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Role</Label>
              <Select
                value={editForm.operator_role}
                onValueChange={(v) => setEditForm(f => ({ ...f, operator_role: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="local_user">Local User</SelectItem>
                  {canCreateAdmins && (
                    <>
                      <SelectItem value="local_admin">Local Admin</SelectItem>
                      {currentUser?.role === 'super_admin' && (
                        <SelectItem value="owner">Owner</SelectItem>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={submitting}>
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove User Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Remove Team Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{selectedUser?.full_name || selectedUser?.email}</strong> from {operatorName}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This will unassign the user from this operator. 
                The user account will not be deleted - they will be reverted to a regular customer account.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRemoveUser} 
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation result dialog — shown after a team member is created with send_invite */}
      <Dialog open={!!lastInvite} onOpenChange={(o) => { if (!o) setLastInvite(null); }}>
        <DialogContent className="bg-white max-w-md" data-testid="op-team-invite-result">
          <DialogHeader>
            <DialogTitle>
              {lastInvite?.emailStatus === 'sent' ? '✉️ Invitation sent' : '🔗 Share invite link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {lastInvite?.emailStatus === 'sent'
                ? <>An email has been sent to <strong>{lastInvite?.email}</strong>. They'll need to confirm before signing in.</>
                : <>Copy this link and share it with <strong>{lastInvite?.email}</strong> to confirm their account.</>}
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs break-all font-mono text-slate-700">
              {lastInvite?.link}
            </div>
            {lastInvite?.tempPassword && (
              <p className="text-xs text-slate-500">Starting password: <span className="font-mono text-slate-700">{lastInvite.tempPassword}</span></p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={async () => {
                try { await navigator.clipboard.writeText(lastInvite?.link || ''); toast.success('Invite link copied'); }
                catch { toast.error('Could not copy — long-press manually'); }
              }}
            >Copy link</Button>
            <Button className="bg-[#082c59] text-white" onClick={() => setLastInvite(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
  
  if (embedded) {
    return content;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Team Management
        </CardTitle>
        <CardDescription>
          Manage team members for {operatorName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
