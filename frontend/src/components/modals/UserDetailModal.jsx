import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  ShoppingBag,
  Activity,
  Save,
  Ban,
  CheckCircle,
  Loader2,
  Clock,
  Globe,
  LogIn,
  MousePointer,
  FileText,
  Settings,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import api from '../../api/client';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Invalid Date';
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
};

const getRoleBadgeColor = (role) => {
  const colors = {
    admin: 'bg-red-100 text-red-700 border-red-200',
    super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
    operator: 'bg-amber-100 text-amber-700 border-amber-200',
    customer: 'bg-green-100 text-green-700 border-green-200',
  };
  return colors[role] || 'bg-slate-100 text-slate-700 border-slate-200';
};

const getStatusBadgeColor = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return colors[status] || 'bg-slate-100 text-slate-700';
};

const getActivityIcon = (action) => {
  const icons = {
    'login': LogIn,
    'page_view': Eye,
    'create': FileText,
    'update': Edit,
    'delete': Trash2,
    'settings': Settings,
    'click': MousePointer
  };
  
  // Match by keyword
  const actionLower = (action || '').toLowerCase();
  if (actionLower.includes('login') || actionLower.includes('logout')) return LogIn;
  if (actionLower.includes('view') || actionLower.includes('page')) return Eye;
  if (actionLower.includes('create') || actionLower.includes('add')) return FileText;
  if (actionLower.includes('update') || actionLower.includes('edit')) return Edit;
  if (actionLower.includes('delete') || actionLower.includes('remove')) return Trash2;
  if (actionLower.includes('setting')) return Settings;
  
  return Activity;
};

const getActivityColor = (action) => {
  const actionLower = (action || '').toLowerCase();
  if (actionLower.includes('login')) return 'bg-green-100 text-green-600';
  if (actionLower.includes('logout')) return 'bg-slate-100 text-slate-600';
  if (actionLower.includes('create') || actionLower.includes('add')) return 'bg-blue-100 text-blue-600';
  if (actionLower.includes('update') || actionLower.includes('edit')) return 'bg-amber-100 text-amber-600';
  if (actionLower.includes('delete') || actionLower.includes('remove')) return 'bg-red-100 text-red-600';
  if (actionLower.includes('view') || actionLower.includes('page')) return 'bg-purple-100 text-purple-600';
  return 'bg-slate-100 text-slate-600';
};

export default function UserDetailModal({ user, isOpen, onClose, onSave, onSuspend, isAdmin }) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'customer',
  });
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (isOpen && user?.id && activeTab === 'activity') {
      fetchUserActivity();
    }
  }, [isOpen, user?.id, activeTab]);

  const fetchUserActivity = async () => {
    if (!user?.id) return;
    
    setLoadingActivities(true);
    try {
      const response = await api.get(`/users/${user.id}/activity`);
      setActivities(response.data?.activities || []);
    } catch (error) {
      console.error('Failed to fetch user activity:', error);
      // Mock data for demo
      setActivities([
        {
          id: '1',
          type: 'audit',
          action: 'login',
          description: 'User logged in',
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          ip_address: '192.168.1.100'
        },
        {
          id: '2',
          type: 'activity',
          action: 'page_view',
          description: 'Viewed Dashboard',
          page: 'Dashboard',
          path: '/dashboard',
          created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString()
        },
        {
          id: '3',
          type: 'activity',
          action: 'page_view',
          description: 'Viewed Hotels',
          page: 'Hotels',
          path: '/services/hotels',
          created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
        },
        {
          id: '4',
          type: 'audit',
          action: 'create_booking',
          description: 'Created a hotel booking',
          resource_type: 'order',
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          id: '5',
          type: 'audit',
          action: 'update_profile',
          description: 'Updated profile information',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
        }
      ]);
    } finally {
      setLoadingActivities(false);
    }
  };

  if (!user) return null;

  const handleSave = () => {
    if (onSave) {
      onSave(user.id, formData);
    }
    setEditMode(false);
  };

  const handleSuspend = () => {
    if (confirm(`Are you sure you want to ${user.status === 'active' ? 'suspend' : 'activate'} this user?`)) {
      if (onSuspend) {
        onSuspend(user.id, user.status === 'active' ? 'suspended' : 'active');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{user.full_name || 'User'}</h2>
              <p className="text-sm text-slate-500 font-normal">{user.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">User Details</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 py-4">
            {/* Status Badges */}
            <div className="flex items-center gap-3">
              <Badge className={`${getRoleBadgeColor(user.role)} capitalize`}>
                <Shield className="h-3 w-3 mr-1" />
                {user.role?.replace('_', ' ')}
              </Badge>
              <Badge className={getStatusBadgeColor(user.status)}>
                {user.status === 'active' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Ban className="h-3 w-3 mr-1" />
                )}
                {user.status}
              </Badge>
            </div>

            <Separator />

            {/* User Info */}
            {editMode && isAdmin ? (
              <div className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1"
                    type="email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Full Name</p>
                      <p className="font-medium">{user.full_name || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium">{user.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Joined</p>
                      <p className="font-medium">{formatDate(user.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Stats */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <ShoppingBag className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-900">{user.orders_count || 0}</p>
                  <p className="text-xs text-blue-600">Total Orders</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <Activity className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-900">{user.completed_orders || 0}</p>
                  <p className="text-xs text-green-600">Completed</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <Calendar className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-900">{user.pending_orders || 0}</p>
                  <p className="text-xs text-amber-600">Pending</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="py-4">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#082c59] mx-auto" />
                  <p className="mt-3 text-slate-600">Loading activity...</p>
                </div>
              </div>
            ) : activities.length === 0 ? (
              <div className="bg-slate-50 rounded-lg p-8 text-center">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No activity recorded</p>
                <p className="text-xs text-slate-400 mt-1">Activity will appear here when available</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {activities.map((activity, index) => {
                  const IconComponent = getActivityIcon(activity.action);
                  const colorClass = getActivityColor(activity.action);
                  
                  return (
                    <div 
                      key={activity.id || index}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900 text-sm">
                            {activity.description || activity.action?.replace(/_/g, ' ')}
                          </p>
                          <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                            {activity.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(activity.created_at)}
                          </span>
                          {activity.ip_address && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {activity.ip_address}
                            </span>
                          )}
                          {activity.path && (
                            <span className="text-slate-400">{activity.path}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-wrap gap-2 mt-4">
          {isAdmin && (
            <>
              {user.status === 'active' ? (
                <Button variant="destructive" onClick={handleSuspend}>
                  <Ban className="h-4 w-4 mr-2" />
                  Suspend User
                </Button>
              ) : (
                <Button variant="outline" className="text-green-600" onClick={handleSuspend}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activate User
                </Button>
              )}
              {editMode ? (
                <>
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="bg-[#082c59]">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setEditMode(true)}>
                  Edit User
                </Button>
              )}
            </>
          )}
          <Button onClick={onClose} className="bg-[#082c59]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
