import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, Shield, Building2, RefreshCw, Settings, 
  Crown, UserCog, AlertCircle
} from 'lucide-react';
import OperatorTeamManagement from '@/components/management/OperatorTeamManagement';
import OperatorRolesManagement from '@/components/management/OperatorRolesManagement';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';
import { toast } from 'sonner';

/**
 * TeamRolesManagement - Dedicated page for operators to manage their team members and roles
 * Accessible to operator owners and local admins
 */
export default function TeamRolesManagement() {
  const { user } = useAuth();
  const [operatorInfo, setOperatorInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team');

  // Check if user is an operator user
  const isOperatorUser = user?.operator_id && ['owner', 'local_admin', 'local_user'].includes(user?.operator_role);
  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const canManageTeam = user?.operator_role === 'owner' || user?.operator_role === 'local_admin';
  const canManageRoles = user?.operator_role === 'owner';

  useEffect(() => {
    if (user?.operator_id) {
      loadOperatorInfo();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.operator_id]);

  const loadOperatorInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/operators/${user.operator_id}`);
      setOperatorInfo(response.data.operator || response.data);
    } catch (error) {
      console.error('Failed to load operator info:', error);
      toast.error('Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  // Not an operator user - show different message for admins vs regular users
  if (!loading && !isOperatorUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-lg mx-auto mt-20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {isPlatformAdmin ? 'Admin Access' : 'Access Restricted'}
            </h3>
            <p className="text-slate-500 max-w-sm">
              {isPlatformAdmin ? (
                <>
                  As a platform administrator, you can manage operator teams through the 
                  <a href="/admin/operators" className="text-blue-600 hover:underline mx-1">Operator Management</a>
                  page. Click on any operator and navigate to the Team or Roles tab.
                </>
              ) : (
                'This page is only accessible to operator team members. If you believe you should have access, please contact your administrator.'
              )}
            </p>
            {isPlatformAdmin && (
              <Button 
                onClick={() => window.location.href = '/admin/operators'}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Go to Operators Management
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading organization...</p>
        </div>
      </div>
    );
  }

  const getRoleBadge = () => {
    const roleConfig = {
      owner: { label: 'Owner', icon: Crown, className: 'bg-amber-100 text-amber-800 border-amber-200' },
      local_admin: { label: 'Admin', icon: Shield, className: 'bg-blue-100 text-blue-800 border-blue-200' },
      local_user: { label: 'User', icon: UserCog, className: 'bg-slate-100 text-slate-800 border-slate-200' }
    };
    const config = roleConfig[user?.operator_role] || roleConfig.local_user;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.className} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {operatorInfo?.name || user?.operator_name || 'My Organization'}
                  </h1>
                  {getRoleBadge()}
                </div>
                <p className="text-slate-500 mt-0.5">
                  Manage your team members and access permissions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadOperatorInfo} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm p-1 rounded-xl">
            <TabsTrigger 
              value="team" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all"
            >
              <Users className="w-4 h-4 mr-2" />
              Team Members
            </TabsTrigger>
            <TabsTrigger 
              value="roles"
              disabled={!canManageRoles && user?.role !== 'super_admin' && user?.role !== 'admin'}
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all disabled:opacity-50"
            >
              <Shield className="w-4 h-4 mr-2" />
              Roles & Permissions
              {!canManageRoles && user?.role !== 'super_admin' && user?.role !== 'admin' && (
                <Badge variant="outline" className="ml-2 text-xs">Owner Only</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Team Members</CardTitle>
                    <CardDescription className="text-blue-100">
                      {canManageTeam 
                        ? 'Manage your team members, roles, and permissions'
                        : 'View team members in your organization'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <OperatorTeamManagement 
                  operatorId={user?.operator_id} 
                  operatorName={operatorInfo?.name || user?.operator_name}
                  embedded={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="mt-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Roles & Permissions</CardTitle>
                    <CardDescription className="text-purple-100">
                      Create custom roles and manage permission delegation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {canManageRoles || user?.role === 'super_admin' || user?.role === 'admin' ? (
                  <OperatorRolesManagement 
                    operatorId={user?.operator_id} 
                    operatorName={operatorInfo?.name || user?.operator_name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Shield className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Owner Access Required</h3>
                    <p className="text-slate-500 max-w-sm">
                      Only organization owners can create and manage custom roles.
                      Contact your owner if you need role changes.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Help Card */}
        <Card className="mt-8 bg-gradient-to-r from-slate-800 to-slate-900 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl">
                <Settings className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Understanding Roles & Permissions</h3>
                <p className="text-slate-300 text-sm mb-4">
                  Your organization has three built-in roles: Owner (full control), Local Admin (can manage team), 
                  and Local User (limited access). Owners can also create custom roles with specific permissions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/10 rounded-lg p-3">
                    <Crown className="w-4 h-4 text-amber-400 mb-1" />
                    <span className="font-medium text-amber-200">Owner</span>
                    <p className="text-slate-400 text-xs mt-1">Full control over all settings, team, and roles</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <Shield className="w-4 h-4 text-blue-400 mb-1" />
                    <span className="font-medium text-blue-200">Local Admin</span>
                    <p className="text-slate-400 text-xs mt-1">Can manage team members and view reports</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <UserCog className="w-4 h-4 text-slate-400 mb-1" />
                    <span className="font-medium text-slate-200">Local User</span>
                    <p className="text-slate-400 text-xs mt-1">Basic access to assigned features only</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
