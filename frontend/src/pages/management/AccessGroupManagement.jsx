import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Plus, Edit, Trash2, Users, Unlock } from 'lucide-react';
import { toast } from 'sonner';

const PERMISSIONS = [
  { key: 'users.view', label: 'View Users', category: 'Users' },
  { key: 'users.create', label: 'Create Users', category: 'Users' },
  { key: 'users.edit', label: 'Edit Users', category: 'Users' },
  { key: 'users.delete', label: 'Delete Users', category: 'Users' },
  { key: 'bookings.view', label: 'View Bookings', category: 'Bookings' },
  { key: 'bookings.create', label: 'Create Bookings', category: 'Bookings' },
  { key: 'bookings.edit', label: 'Edit Bookings', category: 'Bookings' },
  { key: 'bookings.cancel', label: 'Cancel Bookings', category: 'Bookings' },
  { key: 'routes.view', label: 'View Routes', category: 'Travel' },
  { key: 'routes.manage', label: 'Manage Routes', category: 'Travel' },
  { key: 'vehicles.view', label: 'View Vehicles', category: 'Travel' },
  { key: 'vehicles.manage', label: 'Manage Vehicles', category: 'Travel' },
  { key: 'hotels.view', label: 'View Hotels', category: 'Hotels' },
  { key: 'hotels.manage', label: 'Manage Hotels', category: 'Hotels' },
  { key: 'rooms.manage', label: 'Manage Rooms', category: 'Hotels' },
  { key: 'reports.view', label: 'View Reports', category: 'Reports' },
  { key: 'reports.export', label: 'Export Reports', category: 'Reports' },
  { key: 'settings.view', label: 'View Settings', category: 'Settings' },
  { key: 'settings.edit', label: 'Edit Settings', category: 'Settings' },
  { key: 'commission.view', label: 'View Commission', category: 'Finance' },
  { key: 'commission.manage', label: 'Manage Commission', category: 'Finance' },
  { key: 'payments.view', label: 'View Payments', category: 'Finance' },
  { key: 'payments.refund', label: 'Process Refunds', category: 'Finance' }
];

const DEFAULT_GROUP_FORM = {
  name: '',
  description: '',
  permissions: [],
  status: 'active'
};

export default function AccessGroupManagement() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState(DEFAULT_GROUP_FORM);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      setGroups([
        {
          id: '1',
          name: 'Super Admin',
          description: 'Full system access',
          permissions: PERMISSIONS.map(p => p.key),
          status: 'active',
          user_count: 2
        },
        {
          id: '2',
          name: 'Operator Manager',
          description: 'Manage travel operations',
          permissions: ['routes.view', 'routes.manage', 'vehicles.view', 'vehicles.manage', 'bookings.view', 'bookings.edit'],
          status: 'active',
          user_count: 5
        },
        {
          id: '3',
          name: 'Hotel Manager',
          description: 'Manage hotel operations',
          permissions: ['hotels.view', 'hotels.manage', 'rooms.manage', 'bookings.view'],
          status: 'active',
          user_count: 8
        },
        {
          id: '4',
          name: 'Finance Team',
          description: 'View financial reports and manage commissions',
          permissions: ['commission.view', 'commission.manage', 'payments.view', 'reports.view', 'reports.export'],
          status: 'active',
          user_count: 3
        }
      ]);
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast.error('Failed to load access groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openDialog = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({ ...group });
    } else {
      setEditingGroup(null);
      setGroupForm(DEFAULT_GROUP_FORM);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    try {
      if (editingGroup) {
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, ...groupForm } : g));
        toast.success('Access group updated');
      } else {
        setGroups(prev => [...prev, { ...groupForm, id: Date.now().toString(), user_count: 0 }]);
        toast.success('Access group created');
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save access group');
    }
  };

  const handleDelete = async (groupId) => {
    if (!confirm('Are you sure you want to delete this access group?')) return;
    try {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast.success('Access group deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete access group');
    }
  };

  const togglePermission = (permKey) => {
    setGroupForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const toggleCategory = (category) => {
    const categoryPerms = PERMISSIONS.filter(p => p.category === category).map(p => p.key);
    const allSelected = categoryPerms.every(p => groupForm.permissions.includes(p));
    setGroupForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.permissions, ...categoryPerms])]
    }));
  };

  const groupedPermissions = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const stats = {
    total: groups.length,
    active: groups.filter(g => g.status === 'active').length,
    total_users: groups.reduce((sum, g) => sum + (g.user_count || 0), 0)
  };

  return (
    <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#082c59]">Access Control</h1>
            <p className="text-gray-600">Manage access groups and permissions</p>
          </div>
          <Button onClick={() => openDialog()} className="bg-[#082c59]">
            <Plus className="w-4 h-4 mr-2" /> Create Group
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg"><ShieldCheck className="text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-gray-600 text-sm">Access Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg"><Unlock className="text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-gray-600 text-sm">Active Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg"><Users className="text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                  <p className="text-gray-600 text-sm">Users Assigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Groups List */}
        <Card>
          <CardHeader>
            <CardTitle>Access Groups</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No access groups found. Create your first group!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(group => (
                  <Card key={group.id} className="border">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{group.name}</h3>
                            <p className="text-sm text-gray-500">{group.user_count} users</p>
                          </div>
                        </div>
                        <Badge className={group.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}>
                          {group.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {group.permissions.slice(0, 3).map(p => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {PERMISSIONS.find(perm => perm.key === p)?.label || p}
                          </Badge>
                        ))}
                        {group.permissions.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{group.permissions.length - 3} more</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => openDialog(group)}>
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(group.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Access Group' : 'Create Access Group'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Group Name</Label>
                <Input value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Finance Team" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe this group's purpose..." rows={2} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={groupForm.status} onValueChange={v => setGroupForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-3 block">Permissions</Label>
                <div className="space-y-4 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {Object.entries(groupedPermissions).map(([category, perms]) => {
                    const allSelected = perms.every(p => groupForm.permissions.includes(p.key));
                    const someSelected = perms.some(p => groupForm.permissions.includes(p.key));
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleCategory(category)}
                            className={someSelected && !allSelected ? 'opacity-50' : ''}
                          />
                          <span className="font-medium text-sm">{category}</span>
                        </div>
                        <div className="ml-6 grid grid-cols-2 gap-2">
                          {perms.map(perm => (
                            <div key={perm.key} className="flex items-center gap-2">
                              <Checkbox
                                checked={groupForm.permissions.includes(perm.key)}
                                onCheckedChange={() => togglePermission(perm.key)}
                              />
                              <span className="text-sm text-gray-600">{perm.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-[#082c59]">{editingGroup ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
