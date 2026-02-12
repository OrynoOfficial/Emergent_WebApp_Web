import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/client';
import { Search, Users, Shield, User, Mail, Edit, Ban, Eye, Crown, Plus, ShieldCheck, UserCog, Trash2, UserPlus, ChevronDown, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import UserDetailModal from '../../components/modals/UserDetailModal';
import InvitationsManagement from './InvitationsManagement';
import { activityLogger } from '../../utils/activityLogger';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';

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

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    role: 'all'
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
    role: 'customer'
  });

  const currentUserRole = currentUser?.role || 'customer';

  useEffect(() => {
    fetchUsers();
    activityLogger.pageView('User Management', '/admin/users');
  }, []);

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

  const handleCreateUser = async () => {
    // Validate role assignment
    if ((createForm.role === 'admin' || createForm.role === 'super_admin') && currentUserRole !== 'super_admin') {
      toast.error('Only super admins can create admin or super admin accounts');
      return;
    }

    try {
      const response = await api.post('/users/create', createForm);
      // Log activity after successful API call
      try {
        await activityLogger.logActivity('user.create', 'user', {
          entityName: createForm.email,
          details: `Created new user: ${createForm.full_name}`,
          metadata: { role: createForm.role }
        });
      } catch (logError) {
        console.warn('Activity logging failed:', logError);
      }
      toast.success(`User "${createForm.full_name}" created successfully`);
      fetchUsers();
      setIsCreateModalOpen(false);
      setCreateForm({ email: '', full_name: '', phone: '', password: '', role: 'customer' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
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
      user.email?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesRole = filters.role === 'all' || user.role === filters.role;
    return matchesSearch && matchesRole;
  });

  // Get available roles for the dropdown based on current user's role
  const getAvailableRoles = () => {
    const roles = ['customer', 'employee', 'operator'];
    if (currentUserRole === 'super_admin') {
      roles.push('admin', 'super_admin');
    }
    return roles;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="user-management-title">User Management</h1>
          <p className="text-slate-500 mt-1">Manage system users, roles, and permissions</p>
        </div>
        <Button 
          className="bg-[#082c59] hover:bg-[#0a3a75]"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Sub-page tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1" data-testid="user-management-tabs">
        <button onClick={() => navigate('/admin/users')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname === '/admin/users' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-users">
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />Users
        </button>
        <button onClick={() => navigate('/admin/users/permissions')} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${location.pathname.includes('/permissions') ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="tab-permissions">
          <ShieldCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" />Permissions
        </button>
      </div>

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
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select value={filters.role} onValueChange={(v) => setFilters(f => ({ ...f, role: v }))}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total', count: users.length, color: 'bg-slate-100 text-slate-700' },
          { label: 'Super Admins', count: users.filter(u => u.role === 'super_admin').length, color: 'bg-purple-100 text-purple-700' },
          { label: 'Admins', count: users.filter(u => u.role === 'admin').length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Operators', count: users.filter(u => u.role === 'operator').length, color: 'bg-green-100 text-green-700' },
          { label: 'Customers', count: users.filter(u => u.role === 'customer').length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Suspended', count: users.filter(u => u.status === 'suspended').length, color: 'bg-red-100 text-red-700' }
        ].map((stat) => (
          <div key={stat.label} className={`p-3 rounded-lg ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading users...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">User</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Role</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Status</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Joined</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-slate-600">Orders</th>
                <th className="py-4 px-6 text-right text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const canManage = canManageRole(currentUserRole, user.role);
                const isSelf = user.email === currentUser?.email;
                
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6">
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
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {user.orders_count || 0}
                    </td>
                    <td className="py-4 px-6">
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

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#082c59]" />
              Create New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name</Label>
              <Input 
                value={createForm.full_name} 
                onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email"
                value={createForm.email} 
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input 
                value={createForm.phone} 
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+237 600 000 000"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input 
                type="password"
                value={createForm.password} 
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {getAvailableRoles().map(role => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(createForm.role === 'admin' || createForm.role === 'super_admin') && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Admin roles have elevated privileges
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button className="bg-[#082c59]" onClick={handleCreateUser}>Create User</Button>
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
    </div>
  );
}
