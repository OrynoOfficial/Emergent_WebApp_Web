import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Shield, Plus, Edit2, Trash2, RefreshCw, Lock, Unlock,
  ChevronRight, Users, Settings, FileText, Calendar,
  DollarSign, MessageSquare, Eye, Save, X, AlertTriangle
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Permission categories with icons
const PERMISSION_CATEGORIES = {
  services: { label: 'Services', icon: Settings, color: 'text-blue-600' },
  bookings: { label: 'Bookings', icon: Calendar, color: 'text-green-600' },
  team: { label: 'Team Management', icon: Users, color: 'text-purple-600' },
  reports: { label: 'Reports & Analytics', icon: FileText, color: 'text-amber-600' },
  settings: { label: 'Settings', icon: Settings, color: 'text-slate-600' },
  communications: { label: 'Communications', icon: MessageSquare, color: 'text-cyan-600' },
  customers: { label: 'Customers', icon: Users, color: 'text-pink-600' },
  roles: { label: 'Roles & Permissions', icon: Shield, color: 'text-red-600' },
};

/**
 * OperatorRolesManagement - Manage custom roles and permissions for an operator
 * 
 * @param {string} operatorId - The operator ID
 * @param {string} operatorName - The operator name
 */
export default function OperatorRolesManagement({ operatorId, operatorName }) {
  const { user: currentUser } = useAuth();
  
  // State
  const [systemRoles, setSystemRoles] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState({});
  const [delegatablePermissions, setDelegatablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: []
  });
  
  // Check if user can manage roles
  const canManageRoles = currentUser?.role === 'super_admin' || 
                         currentUser?.role === 'admin' || 
                         currentUser?.operator_role === 'owner';
  
  // Load roles data
  const loadRoles = useCallback(async () => {
    if (!operatorId) return;
    
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get(`/operator-roles/operators/${operatorId}/roles`),
        api.get(`/operator-roles/operators/${operatorId}/delegatable-permissions`)
      ]);
      
      setSystemRoles(rolesRes.data.system_roles || []);
      setCustomRoles(rolesRes.data.custom_roles || []);
      setDelegatablePermissions(permsRes.data.permissions || []);
      
      // Group permissions by category
      const grouped = {};
      (permsRes.data.permissions || []).forEach(perm => {
        const category = perm.split('.')[1] || 'other';
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(perm);
      });
      setAllPermissions(grouped);
    } catch (error) {
      console.error('Failed to load roles:', error);
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);
  
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);
  
  // Create custom role
  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    
    if (roleForm.permissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post(`/operator-roles/operators/${operatorId}/roles`, roleForm);
      toast.success('Custom role created successfully');
      setShowCreateDialog(false);
      setRoleForm({ name: '', description: '', permissions: [] });
      loadRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Update custom role
  const handleUpdateRole = async () => {
    if (!selectedRole || !roleForm.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.put(`/operator-roles/operators/${operatorId}/roles/${selectedRole.id}`, roleForm);
      toast.success('Role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Delete custom role
  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    
    setSubmitting(true);
    try {
      await api.delete(`/operator-roles/operators/${operatorId}/roles/${selectedRole.id}`);
      toast.success('Role deleted successfully');
      setShowDeleteDialog(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Open edit dialog
  const openEditDialog = (role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowEditDialog(true);
  };
  
  // Open delete dialog
  const openDeleteDialog = (role) => {
    setSelectedRole(role);
    setShowDeleteDialog(true);
  };
  
  // Toggle permission in form
  const togglePermission = (permission) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };
  
  // Toggle all permissions in a category
  const toggleCategory = (category, permissions) => {
    const allSelected = permissions.every(p => roleForm.permissions.includes(p));
    
    setRoleForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !permissions.includes(p))
        : [...new Set([...prev.permissions, ...permissions])]
    }));
  };
  
  // Get permission label (format: operator.services.view -> View Services)
  const getPermissionLabel = (permission) => {
    const parts = permission.split('.');
    const action = parts[parts.length - 1];
    const resource = parts.length > 2 ? parts[parts.length - 2] : parts[1];
    
    const actionLabels = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      manage: 'Manage',
      export: 'Export',
      send: 'Send',
      confirm: 'Confirm',
      cancel: 'Cancel',
      checkin: 'Check-in',
      pricing: 'Pricing',
      availability: 'Availability',
      roles: 'Manage Roles',
      assign: 'Assign',
      remove: 'Remove',
      contact: 'Contact',
      notes: 'Notes',
      alerts: 'Alerts',
      analytics: 'Analytics'
    };
    
    const resourceLabels = {
      services: 'Services',
      bookings: 'Bookings',
      team: 'Team',
      reports: 'Reports',
      settings: 'Settings',
      communications: 'Communications',
      customers: 'Customers',
      roles: 'Roles'
    };
    
    return `${actionLabels[action] || action} ${resourceLabels[resource] || resource}`;
  };
  
  // Render role card
  const renderRoleCard = (role, isSystem = false) => (
    <Card key={role.id} className={`${isSystem ? 'border-slate-200' : 'border-blue-200'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isSystem ? 'bg-slate-100' : 'bg-blue-100'}`}>
              {isSystem ? (
                <Lock className={`h-5 w-5 ${isSystem ? 'text-slate-600' : 'text-blue-600'}`} />
              ) : (
                <Shield className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900">{role.name}</h4>
                {isSystem && (
                  <Badge variant="outline" className="text-xs">System</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="outline" className="text-xs bg-slate-50">
                  {role.permissions?.length || 0} permissions
                </Badge>
              </div>
            </div>
          </div>
          
          {!isSystem && canManageRoles && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openEditDialog(role)}
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openDeleteDialog(role)}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Show permissions preview */}
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-slate-500 mb-2">Permissions:</p>
          <div className="flex flex-wrap gap-1">
            {(role.permissions || []).slice(0, 5).map(perm => (
              <Badge key={perm} variant="outline" className="text-xs font-normal">
                {getPermissionLabel(perm)}
              </Badge>
            ))}
            {(role.permissions?.length || 0) > 5 && (
              <Badge variant="outline" className="text-xs font-normal text-slate-400">
                +{role.permissions.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  // Render permissions selector
  const renderPermissionsSelector = () => (
    <ScrollArea className="h-[300px] border rounded-lg p-4">
      <Accordion type="multiple" className="space-y-2">
        {Object.entries(allPermissions).map(([category, permissions]) => {
          const categoryConfig = PERMISSION_CATEGORIES[category] || { 
            label: category.charAt(0).toUpperCase() + category.slice(1), 
            icon: Settings,
            color: 'text-slate-600'
          };
          const CategoryIcon = categoryConfig.icon;
          const allSelected = permissions.every(p => roleForm.permissions.includes(p));
          const someSelected = permissions.some(p => roleForm.permissions.includes(p));
          
          return (
            <AccordionItem key={category} value={category} className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    checked={allSelected}
                    className={someSelected && !allSelected ? 'data-[state=checked]:bg-blue-300' : ''}
                    onCheckedChange={() => toggleCategory(category, permissions)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <CategoryIcon className={`h-4 w-4 ${categoryConfig.color}`} />
                  <span className="font-medium">{categoryConfig.label}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {permissions.filter(p => roleForm.permissions.includes(p)).length}/{permissions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="grid grid-cols-1 gap-2 ml-7">
                  {permissions.map(perm => (
                    <label 
                      key={perm} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded"
                    >
                      <Checkbox
                        checked={roleForm.permissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      <span className="text-sm">{getPermissionLabel(perm)}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ScrollArea>
  );
  
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Roles & Permissions
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Manage custom roles for {operatorName}
          </p>
        </div>
        
        {canManageRoles && delegatablePermissions.length > 0 && (
          <Button 
            onClick={() => {
              setRoleForm({ name: '', description: '', permissions: [] });
              setShowCreateDialog(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        )}
      </div>
      
      {/* System Roles */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          System Roles
        </h4>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {systemRoles.map(role => renderRoleCard(role, true))}
        </div>
      </div>
      
      {/* Custom Roles */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
          <Unlock className="h-4 w-4" />
          Custom Roles
        </h4>
        {customRoles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Shield className="h-10 w-10 text-slate-300 mb-3" />
              <p>No custom roles created yet</p>
              {canManageRoles && delegatablePermissions.length > 0 && (
                <Button 
                  variant="link" 
                  onClick={() => {
                    setRoleForm({ name: '', description: '', permissions: [] });
                    setShowCreateDialog(true);
                  }}
                >
                  Create your first custom role
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customRoles.map(role => renderRoleCard(role, false))}
          </div>
        )}
      </div>
      
      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Create Custom Role
            </DialogTitle>
            <DialogDescription>
              Create a new role with specific permissions for {operatorName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Role Name *</Label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Booking Manager"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this role"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="mb-2 block">
                Permissions ({roleForm.permissions.length} selected)
              </Label>
              {renderPermissionsSelector()}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-600" />
              Edit Role
            </DialogTitle>
            <DialogDescription>
              Update permissions for {selectedRole?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Role Name *</Label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Booking Manager"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this role"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="mb-2 block">
                Permissions ({roleForm.permissions.length} selected)
              </Label>
              {renderPermissionsSelector()}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Role Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role &ldquo;{selectedRole?.name}&rdquo;?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> Users assigned to this role will lose these permissions.
                This action cannot be undone.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteRole} 
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
