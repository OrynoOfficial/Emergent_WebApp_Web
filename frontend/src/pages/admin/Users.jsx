import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';
import { Search, Users, Shield, User, Mail, Edit, Ban, Eye, Crown, Plus, ShieldCheck, UserCog, Trash2, UserPlus, ChevronDown, Send, LayoutGrid, List, FileText, Building2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import UserDetailModal from '../../components/modals/UserDetailModal';
import InvitationsManagement from './InvitationsManagement';
import OperatorPicker from '../../components/shared/OperatorPicker';
import AddUserWizard from '../../components/admin/AddUserWizard';
import { activityLogger } from '../../utils/activityLogger';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';
import ManagementShell from '../../components/management/shared/ManagementShell';
import SubpageCard from '../../components/management/shared/SubpageCard';

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
  customer: 0,
  employee: 1,
  service_provider: 2,
  operator: 3,
  admin: 4,
  super_admin: 5
};

const canManageRole = (managerRole, targetRole) => {
  const managerLevel = ROLE_HIERARCHY[managerRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return managerLevel > targetLevel;
};

// Chip tags for `user.assigned_roles` (role IDs) resolved via rolesMap.
// Defined at module scope so React doesn't remount on every parent render.
function RoleChips({ ids, rolesMap, size = 'sm' }) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const px = size === 'xs' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <div className="flex flex-wrap gap-1" data-testid="user-role-chips">
      {ids.map(rid => {
        const meta = rolesMap[rid] || { name: rid.length > 10 ? `${rid.slice(0, 8)}…` : rid, color: 'bg-slate-100 text-slate-700 border-slate-200' };
        return (
          <span
            key={rid}
            className={`inline-flex items-center gap-0.5 rounded-full border ${meta.color} ${px} font-medium`}
            title={meta.name}
            data-testid={`role-chip-${rid}`}
          >
            <Shield className="h-2.5 w-2.5" />
            <span className="truncate max-w-[120px]">{meta.name}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [rolesMap, setRolesMap] = useState({}); // id -> { name, color }
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    status: 'all',
    operator_id: 'all',
    joined_from: '',
    joined_to: '',
  });
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid' | 'details'
  const [page, setPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 12 : 20;
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeView, setActiveView] = useState('users'); // 'users' or 'invitations'
  const [createForm, setCreateForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
    role: 'customer',
    operator_id: '',
  });

  const currentUserRole = currentUser?.role || 'customer';

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    activityLogger.pageView('User Management', '/admin/users');
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/access/roles');
      const map = {};
      (res.data?.roles || []).forEach(r => { map[r.id] = { name: r.name, color: r.color || 'bg-slate-100 text-slate-700 border-slate-200' }; });
      setRolesMap(map);
    } catch (err) {
      console.warn('Failed to fetch roles', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/');
      setUsers(response.data?.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      // Show error instead of mock data
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const targetUser = users.find(u => u.id === userId);
    
    // Permission check
    if (!canManageRole(currentUserRole, targetUser?.role)) {
      toast.error('You cannot modify users with equal or higher role');
      return;
    }
    
    // Only super_admin can create admins or super_admins
    if ((newRole === 'admin' || newRole === 'super_admin') && currentUserRole !== 'super_admin') {
      toast.error('Only super admins can assign admin or super admin roles');
      return;
    }

    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      try {
        await activityLogger.logActivity('user.role_change', 'user', {
          entityId: userId,
          entityName: targetUser?.email,
          details: `Changed role to ${newRole}`,
          metadata: { newRole }
        });
      } catch (logError) {
        console.warn('Activity logging failed:', logError);
      }
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
    activityLogger.logActivity('user.profile_view', 'user', {
      entityId: user.id,
      entityName: user.email,
      details: `Viewed user profile: ${user.full_name}`
    });
  };

  const handleSaveUser = async (userId, data) => {
    try {
      await api.put(`/users/${userId}`, data);
      activityLogger.profileUpdate(userId);
      fetchUsers();
      setIsDetailModalOpen(false);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleSuspendUser = async (userId, newStatus) => {
    const targetUser = users.find(u => u.id === userId);
    
    // Permission check
    if (!canManageRole(currentUserRole, targetUser?.role)) {
      toast.error('You cannot suspend users with equal or higher role');
      return;
    }

    try {
      await api.put(`/users/${userId}/status`, { status: newStatus });
      try {
        await activityLogger.logActivity(newStatus === 'suspended' ? 'security.user_suspend' : 'security.user_activate', 'user', {
          entityId: userId,
          entityName: targetUser?.email,
          details: `User ${newStatus === 'suspended' ? 'suspended' : 'activated'}: ${targetUser?.full_name}`
        });
      } catch (logError) {
        console.warn('Activity logging failed:', logError);
      }
      toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully`);
      fetchUsers();
      setIsDetailModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    }
  };

  const [lastUserInvite, setLastUserInvite] = useState(null);

  const submitUserCreate = async (payload) => {
    try {
      const res = await api.post('/users/create', payload);
      try {
        await activityLogger.logActivity('user.create', 'user', {
          entityName: payload.email,
          details: `Created new user: ${payload.full_name}`,
          metadata: { role: payload.role, operator_id: payload.operator_id || null }
        });
      } catch (logError) {
        console.warn('Activity logging failed:', logError);
      }
      const data = res.data || {};
      let msg = `User "${payload.full_name}" created`;
      if (data.send_invite) {
        msg += data.invite_email_status === 'sent'
          ? `. Invite email sent.`
          : `. Email could not be delivered — copy the invite link below.`;
      }
      toast.success(msg);
      fetchUsers();
      setIsCreateModalOpen(false);
      if (data.send_invite && data.invite_link) {
        setLastUserInvite({
          email: payload.email,
          link: data.invite_link,
          emailStatus: data.invite_email_status,
          tempPassword: data.default_password || null,
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
      throw error;
    }
  };

  const closeUserInvite = () => setLastUserInvite(null);
  const copyUserInviteLink = async () => {
    try { await navigator.clipboard.writeText(lastUserInvite?.link || ''); toast.success('Invite link copied'); }
    catch { toast.error('Could not copy — long-press to copy manually'); }
  };

  // Kept for backwards-compat in case any external caller still uses createForm; the wizard is the primary path now.
  // eslint-disable-next-line no-unused-vars
  const handleCreateUser = async () => {
    if ((createForm.role === 'admin' || createForm.role === 'super_admin') && currentUserRole !== 'super_admin') {
      toast.error('Only super admins can create admin or super admin accounts');
      return;
    }
    if (createForm.role === 'operator' && !createForm.operator_id) {
      toast.error('Pick an operator to assign this user to');
      return;
    }
    const payload = { ...createForm };
    if (payload.role !== 'operator') delete payload.operator_id;
    await submitUserCreate(payload);
    setCreateForm({ email: '', full_name: '', phone: '', password: '', role: 'customer', operator_id: '' });
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setIsDetailModalOpen(false);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      // Log activity after successful API call
      try {
        await activityLogger.logActivity('user.delete', 'user', {
          entityId: userToDelete.id,
          entityName: userToDelete.email,
          details: `Deleted user: ${userToDelete.full_name}`
        });
      } catch (logError) {
        console.warn('Activity logging failed:', logError);
      }
      toast.success(`User "${userToDelete.full_name}" deleted successfully`);
      fetchUsers();
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      super_admin: 'bg-purple-100 text-purple-700',
      admin: 'bg-blue-100 text-blue-700',
      operator: 'bg-green-100 text-green-700',
      customer: 'bg-slate-100 text-slate-700',
      employee: 'bg-amber-100 text-amber-700',
      service_provider: 'bg-cyan-100 text-cyan-700'
    };
    return styles[role] || styles.customer;
  };

  // Renders chip tags for `user.assigned_roles` (role IDs) resolved via rolesMap.
  // Module-level RoleChips component imported above; helper here just binds rolesMap.

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super_admin': return <Crown className="h-4 w-4" />;
      case 'admin': return <ShieldCheck className="h-4 w-4" />;
      case 'operator': return <UserCog className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !filters.search ||
      user.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.operator_name?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesRole = filters.role === 'all' || user.role === filters.role;
    const matchesStatus = filters.status === 'all' || user.status === filters.status;
    const matchesOperator = filters.operator_id === 'all' || user.operator_id === filters.operator_id;
    const created = user.created_at ? new Date(user.created_at) : null;
    const matchesJoinedFrom = !filters.joined_from || (created && created >= new Date(filters.joined_from));
    const matchesJoinedTo = !filters.joined_to || (created && created <= new Date(filters.joined_to + 'T23:59:59'));
    return matchesSearch && matchesRole && matchesStatus && matchesOperator && matchesJoinedFrom && matchesJoinedTo;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    // Reset to page 1 when filters change meaningfully
    setPage(1);
  }, [filters.search, filters.role, filters.status, filters.operator_id, filters.joined_from, filters.joined_to, viewMode]);

  const operatorOptions = useMemo(() => {
    const map = new Map();
    users.forEach(u => { if (u.operator_id && !map.has(u.operator_id)) map.set(u.operator_id, u.operator_name || u.operator_id.slice(0, 8)); });
    return [...map.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  }, [users]);

  // Get available roles for the dropdown based on current user's role
  const getAvailableRoles = () => {
    const roles = ['customer', 'employee', 'operator'];
    if (currentUserRole === 'super_admin') {
      roles.push('admin', 'super_admin');
    }
    return roles;
  };

  return (
    <>
      <ManagementShell
        title="User Management"
        icon={Users}
        iconColorClass="text-[#082c59]"
        subtitle="Manage system users, roles, and permissions"
        scopeFilter={
          <Button
            className="bg-[#082c59] hover:bg-[#0a3a75] h-8"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="add-user-btn"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add User
          </Button>
        }
        tabs={[
          { value: 'users', label: 'Users', icon: Users, testId: 'tab-users' },
          { value: 'permissions', label: 'Permissions', icon: ShieldCheck, testId: 'tab-permissions' },
          { value: 'invitations', label: 'Invitations', icon: Send, testId: 'tab-invitations' },
        ]}
        activeTab={location.pathname.includes('/permissions') ? 'permissions' : activeView === 'invitations' ? 'invitations' : 'users'}
        onTabChange={(v) => {
          if (v === 'users') { navigate('/admin/users'); setActiveView('users'); }
          else if (v === 'permissions') navigate('/admin/users/permissions');
          else if (v === 'invitations') setActiveView('invitations');
        }}
        testIdPrefix="user-mgmt"
      >

      {/* Show Invitations view or Users list */}
      <TabsContent value="invitations" className="mt-4">
        <InvitationsManagement />
      </TabsContent>
      <TabsContent value="users" className="mt-4 space-y-4">

      {/* Role Permission Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
          <Shield className="h-4 w-4" />
          Role Hierarchy & Permissions
        </div>
        <div className="text-blue-700 space-y-1">
          <p><strong>Super Admin:</strong> Can manage all users including other admins</p>
          <p><strong>Admin:</strong> Can manage operators, employees, and customers only</p>
          <p className="text-blue-600 text-xs mt-2">
            Your role: <span className="font-semibold capitalize">{currentUserRole.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <SubpageCard title="Filters" icon={Search} count={filteredUsers.length} testId="user-filters-card">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, operator…"
              className="pl-10"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              data-testid="user-search-input"
            />
          </div>
          <Select value={filters.role} onValueChange={(v) => setFilters(f => ({ ...f, role: v }))}>
            <SelectTrigger className="w-36 bg-white" data-testid="user-role-filter"><SelectValue placeholder="All Roles" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
            <SelectTrigger className="w-36 bg-white" data-testid="user-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.operator_id} onValueChange={(v) => setFilters(f => ({ ...f, operator_id: v }))}>
            <SelectTrigger className="w-48 bg-white" data-testid="user-operator-filter"><SelectValue placeholder="Operator" /></SelectTrigger>
            <SelectContent className="bg-white max-h-64">
              <SelectItem value="all">All operators</SelectItem>
              {operatorOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border bg-white overflow-hidden" data-testid="user-view-mode">
            <button onClick={() => setViewMode('list')} title="List" className={`px-3 ${viewMode === 'list' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-50'}`} data-testid="view-list">
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('grid')} title="Grid" className={`px-3 border-l ${viewMode === 'grid' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-50'}`} data-testid="view-grid">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('details')} title="Details" className={`px-3 border-l ${viewMode === 'details' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-50'}`} data-testid="view-details">
              <FileText className="h-4 w-4" />
            </button>
          </div>
        {/* Date-joined range */}
        <div className="flex flex-wrap gap-3 items-center text-sm w-full mt-2 pt-2 border-t border-slate-100">
          <Label className="text-slate-500 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Joined</Label>
          <Input
            type="date"
            value={filters.joined_from}
            onChange={(e) => setFilters(f => ({ ...f, joined_from: e.target.value }))}
            className="w-40"
            data-testid="joined-from"
          />
          <span className="text-slate-400">→</span>
          <Input
            type="date"
            value={filters.joined_to}
            onChange={(e) => setFilters(f => ({ ...f, joined_to: e.target.value }))}
            className="w-40"
            data-testid="joined-to"
          />
          {(filters.joined_from || filters.joined_to) && (
            <button onClick={() => setFilters(f => ({ ...f, joined_from: '', joined_to: '' }))} className="text-xs text-slate-500 hover:text-red-600 underline">
              Clear dates
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            Showing {pagedUsers.length} of {filteredUsers.length} user(s)
          </span>
        </div>
      </SubpageCard>

      {/* Stats (dynamic — updates with active filters) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4" data-testid="users-stats-grid">
        {[
          { label: 'Total', count: filteredUsers.length, color: 'bg-slate-100 text-slate-700' },
          { label: 'Super Admins', count: filteredUsers.filter(u => u.role === 'super_admin').length, color: 'bg-purple-100 text-purple-700' },
          { label: 'Admins', count: filteredUsers.filter(u => u.role === 'admin').length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Operators', count: filteredUsers.filter(u => u.role === 'operator').length, color: 'bg-green-100 text-green-700' },
          { label: 'Customers', count: filteredUsers.filter(u => u.role === 'customer').length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Suspended', count: filteredUsers.filter(u => u.status === 'suspended').length, color: 'bg-red-100 text-red-700' }
        ].map((stat) => (
          <div key={stat.label} className={`p-3 rounded-lg ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Users Table / Grid / Details */}
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-500" data-testid="user-empty-state">
          No users match your filters.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="user-grid">
          {pagedUsers.map((user) => {
            const canManage = canManageRole(currentUserRole, user.role);
            const isSelf = user.email === currentUser?.email;
            return (
              <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition" data-testid={`user-grid-card-${user.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                    {getRoleIcon(user.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${getRoleBadge(user.role)}`}>
                    <span className="capitalize">{user.role.replace('_', ' ')}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.status}
                  </span>
                </div>
                {Array.isArray(user.assigned_roles) && user.assigned_roles.length > 0 && (
                  <div className="mt-2">
                    <RoleChips ids={user.assigned_roles} rolesMap={rolesMap} size="xs" />
                  </div>
                )}
                {user.operator_id && (
                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                    <Building2 className="h-3 w-3 text-[#082c59]" />
                    <span className="truncate">{user.operator_name || user.operator_id.slice(0, 8)}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-500">
                  <span>Joined {formatDate(user.created_at)}</span>
                  <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-blue-100 rounded" onClick={() => handleViewUser(user)}>
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                    </button>
                    {canManage && !isSelf && (
                      <button className="p-1.5 hover:bg-red-100 rounded" onClick={() => handleDeleteClick(user)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'details' ? (
        <div className="space-y-3" data-testid="user-details">
          {pagedUsers.map((user) => {
            const canManage = canManageRole(currentUserRole, user.role);
            const isSelf = user.email === currentUser?.email;
            return (
              <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-5 items-center" data-testid={`user-details-row-${user.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#082c59]/10 flex items-center justify-center">{getRoleIcon(user.role)}</div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Role</p>
                    <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs capitalize ${getRoleBadge(user.role)}`}>{user.role.replace('_', ' ')}</span>
                    {Array.isArray(user.assigned_roles) && user.assigned_roles.length > 0 && (
                      <div className="mt-1.5"><RoleChips ids={user.assigned_roles} rolesMap={rolesMap} size="xs" /></div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.status}</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Operator</p>
                    <p className="mt-0.5 text-sm truncate flex items-center gap-1">
                      {user.operator_id ? (<><Building2 className="h-3 w-3 text-[#082c59]" />{user.operator_name || user.operator_id.slice(0, 8)}</>) : <span className="text-slate-400">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Joined</p>
                    <p className="mt-0.5 text-sm">{formatDate(user.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <button className="p-2 hover:bg-blue-100 rounded-lg" onClick={() => handleViewUser(user)}><Eye className="h-4 w-4 text-blue-600" /></button>
                  {canManage && !isSelf && (
                    <>
                      <button className="p-2 hover:bg-slate-100 rounded-lg" onClick={() => handleViewUser(user)}><Edit className="h-4 w-4 text-slate-600" /></button>
                      <button className="p-2 hover:bg-red-100 rounded-lg" onClick={() => handleDeleteClick(user)}><Trash2 className="h-4 w-4 text-red-600" /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">User</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">Role</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">Operator</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">Joined</th>
                <th className="py-4 px-4 text-left text-sm font-semibold text-slate-600">Orders</th>
                <th className="py-4 px-4 text-right text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedUsers.map((user) => {
                const canManage = canManageRole(currentUserRole, user.role);
                const isSelf = user.email === currentUser?.email;

                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors" data-testid={`user-row-${user.id}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#082c59]/10 flex items-center justify-center">
                          {getRoleIcon(user.role)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {canManage && !isSelf ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getRoleBadge(user.role)}`}
                        >
                          {getAvailableRoles().map(role => (
                            <option key={role} value={role}>{role.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1 ${getRoleBadge(user.role)}`}>
                          {getRoleIcon(user.role)}
                          <span className="capitalize">{user.role.replace('_', ' ')}</span>
                          {isSelf && <span className="text-xs">(You)</span>}
                        </span>
                      )}
                      {Array.isArray(user.assigned_roles) && user.assigned_roles.length > 0 && (
                        <div className="mt-1.5"><RoleChips ids={user.assigned_roles} rolesMap={rolesMap} size="xs" /></div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm" data-testid={`user-operator-cell-${user.id}`}>
                      {user.operator_id ? (
                        <span className="inline-flex items-center gap-1.5 bg-[#082c59]/5 border border-[#082c59]/15 text-[#082c59] rounded-full px-2.5 py-1 text-xs font-medium">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate max-w-[160px]">{user.operator_name || user.operator_id.slice(0, 8)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      {user.orders_count || 0}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 hover:bg-blue-100 rounded-lg"
                          title="View Details"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </button>
                        {canManage && !isSelf && (
                          <>
                            <button
                              className="p-2 hover:bg-slate-100 rounded-lg"
                              title="Edit"
                              onClick={() => handleViewUser(user)}
                            >
                              <Edit className="h-4 w-4 text-slate-600" />
                            </button>
                            <button
                              className={`p-2 rounded-lg ${user.status === 'active' ? 'hover:bg-red-100' : 'hover:bg-green-100'}`}
                              title={user.status === 'active' ? 'Suspend' : 'Activate'}
                              onClick={() => handleSuspendUser(user.id, user.status === 'active' ? 'suspended' : 'active')}
                            >
                              <Ban className={`h-4 w-4 ${user.status === 'active' ? 'text-red-600' : 'text-green-600'}`} />
                            </button>
                            <button
                              className="p-2 hover:bg-red-100 rounded-lg"
                              title="Delete User"
                              onClick={() => handleDeleteClick(user)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </button>
                          </>
                        )}
                        {!canManage && !isSelf && (
                          <span className="text-xs text-slate-400 px-2">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredUsers.length > pageSize && (
        <div className="flex items-center justify-between pt-2" data-testid="user-pagination">
          <span className="text-sm text-slate-500">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} data-testid="page-prev">
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} data-testid="page-next">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
      </TabsContent>
      </ManagementShell>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUser}
        onSuspend={handleSuspendUser}
        isAdmin={true}
        canManage={selectedUser ? canManageRole(currentUserRole, selectedUser.role) : false}
      />

      {/* Create User Wizard (3-step) */}
      <AddUserWizard
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreate={submitUserCreate}
        currentUserRole={currentUserRole}
      />

      {/* Invitation result dialog — shown after a user is created with send_invite */}
      <Dialog open={!!lastUserInvite} onOpenChange={(o) => { if (!o) closeUserInvite(); }}>
        <DialogContent className="bg-white max-w-md" data-testid="user-invite-result-dialog">
          <DialogHeader>
            <DialogTitle>
              {lastUserInvite?.emailStatus === 'sent' ? '✉️ Invitation sent' : '🔗 Share invite link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {lastUserInvite?.emailStatus === 'sent'
                ? <>An email has been sent to <strong>{lastUserInvite?.email}</strong> asking them to confirm their account. You can also share the link below as a backup.</>
                : <>The invite email couldn't be delivered automatically. Copy the link below and share it with <strong>{lastUserInvite?.email}</strong> so they can confirm their account.</>}
            </p>
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs break-all font-mono text-slate-700" data-testid="user-invite-link-text">
              {lastUserInvite?.link}
            </div>
            {lastUserInvite?.tempPassword && (
              <p className="text-xs text-slate-500">Starting password set by admin: <span className="font-mono text-slate-700">{lastUserInvite.tempPassword}</span></p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={copyUserInviteLink} data-testid="copy-user-invite-link-btn">Copy link</Button>
            <Button className="bg-[#082c59] hover:bg-[#0a3a75] text-white" onClick={closeUserInvite} data-testid="user-invite-result-done-btn">Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user account.
            </DialogDescription>
          </DialogHeader>
          {userToDelete && (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-medium text-slate-900">{userToDelete.full_name}</p>
                <p className="text-sm text-slate-600">{userToDelete.email}</p>
                <p className="text-sm text-slate-500 mt-1 capitalize">Role: {userToDelete.role?.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
