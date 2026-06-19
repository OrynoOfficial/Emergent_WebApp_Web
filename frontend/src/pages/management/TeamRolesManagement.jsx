/**
 * Team & Roles management — Ratings-page-style refresh.
 *
 * Visual targets (per iter 254 user feedback):
 *   • Compact slim-chip stat strip (mirrors `/Ratings` page header).
 *   • No gradient hero, no big colored bands, no oversized metric tiles.
 *   • Icon-only top-bar buttons with tooltips (Refresh, etc.).
 *   • Two-tone palette: slate + brand `#082c59`.
 *
 * Functional contract (unchanged):
 *   • Wraps `OperatorTeamManagement` (team CRUD) and `OperatorRolesManagement`
 *     (custom roles) inside two tabs.
 *   • Owner-only access to the Roles tab.
 *   • Platform admins are routed to `/admin/operators` where they can pick a
 *     specific operator and see the same content in the operator preview
 *     modal (eye-icon view).
 */
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Shield, Building2, RefreshCw, Crown, UserCog, AlertCircle, Sparkles,
} from 'lucide-react';
import OperatorTeamManagement from '@/components/management/OperatorTeamManagement';
import OperatorRolesManagement from '@/components/management/OperatorRolesManagement';
import IconButton from '@/components/shared/IconButton';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';
import { toast } from 'sonner';

export default function TeamRolesManagement() {
  const { user } = useAuth();
  const [operatorInfo, setOperatorInfo] = useState(null);
  const [stats, setStats] = useState({ team: 0, roles: 0, owner: '—' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team');

  const isOperatorUser =
    user?.operator_id && ['owner', 'local_admin', 'local_user'].includes(user?.operator_role);
  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const canManageTeam = user?.operator_role === 'owner' || user?.operator_role === 'local_admin';
  const canManageRoles = user?.operator_role === 'owner';

  useEffect(() => {
    if (user?.operator_id) {
      loadAll();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.operator_id]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [opRes, teamRes, rolesRes] = await Promise.all([
        api.get(`/operators/${user.operator_id}`).catch(() => null),
        api.get(`/operators/${user.operator_id}/users`).catch(() => null),
        api.get(`/operators/${user.operator_id}/roles`).catch(() => null),
      ]);
      const op = opRes?.data?.operator || opRes?.data || null;
      setOperatorInfo(op);
      const teamCount = teamRes?.data?.users?.length ?? teamRes?.data?.length ?? 0;
      const rolesCount = rolesRes?.data?.roles?.length ?? rolesRes?.data?.length ?? 0;
      const ownerName =
        op?.owner_name ||
        (teamRes?.data?.users || teamRes?.data || []).find?.(u => u.operator_role === 'owner')?.full_name ||
        op?.owner_email ||
        '—';
      setStats({ team: teamCount, roles: rolesCount, owner: ownerName });
    } catch (error) {
      console.error('Failed to load organisation:', error);
      toast.error('Failed to load organisation details');
    } finally {
      setLoading(false);
    }
  };

  // ── Empty / wrong-account states ──────────────────────────────────────────
  if (!loading && !isOperatorUser) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto mt-16 bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
            {isPlatformAdmin ? 'Admin Access' : 'Access Restricted'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {isPlatformAdmin ? (
              <>
                As a platform administrator, manage operator teams through the
                <a href="/admin/operators" className="text-[#082c59] font-medium hover:underline mx-1">
                  Operator Management
                </a>
                page (eye-icon preview opens the same Team &amp; Roles view).
              </>
            ) : (
              "This page is only accessible to operator team members. If you believe you should have access, please contact your administrator."
            )}
          </p>
          {isPlatformAdmin && (
            <Button
              onClick={() => (window.location.href = '/admin/operators')}
              className="mt-4 bg-[#082c59] hover:bg-[#0a3a75]"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Go to operators
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const roleConfig = {
    owner:       { label: 'Owner', icon: Crown,    cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    local_admin: { label: 'Admin', icon: Shield,   cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    local_user:  { label: 'User',  icon: UserCog,  cls: 'bg-slate-50 text-slate-600 border-slate-200' },
    // `manager` is the role assigned by the single-owner migration when extra
    // owners are demoted. Render it so demoted-but-still-active users see a
    // sensible badge instead of falling back to "User".
    manager:     { label: 'Manager', icon: UserCog, cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  };
  const myRole = roleConfig[user?.operator_role] || roleConfig.local_user;
  const MyRoleIcon = myRole.icon;

  return (
    <div className="space-y-6" data-testid="team-roles-page">
      {/* Header strip — slim, Ratings-style */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#082c59]" />
            {operatorInfo?.name || user?.operator_name || 'My organisation'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            Manage your team members and access permissions
            <Badge className={`${myRole.cls} border text-[10px] font-semibold`}>
              <MyRoleIcon className="w-3 h-3 mr-1" />{myRole.label}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={RefreshCw} label="Refresh" onClick={loadAll} data-testid="team-roles-refresh" />
        </div>
      </div>

      {/* Stat chip strip — mirrors the /Ratings page exactly */}
      <div className="flex flex-wrap items-center gap-2" data-testid="team-roles-stats">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#082c59]/5 border border-[#082c59]/20 text-[#082c59] text-xs font-medium">
          <Users className="h-3.5 w-3.5" /> Team Members <span className="font-bold">{stats.team}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
          <Shield className="h-3.5 w-3.5" /> Custom Roles <span className="font-bold">{stats.roles}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium max-w-xs">
          <Crown className="h-3.5 w-3.5 text-amber-500" /> Owner <span className="font-bold truncate">{stats.owner}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-lg h-auto">
          <TabsTrigger
            value="team"
            className="data-[state=active]:bg-[#082c59] data-[state=active]:text-white rounded-md px-4 py-1.5 text-sm transition-all"
            data-testid="tab-team"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />Team
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            disabled={!canManageRoles && !isPlatformAdmin}
            className="data-[state=active]:bg-[#082c59] data-[state=active]:text-white rounded-md px-4 py-1.5 text-sm transition-all disabled:opacity-40"
            data-testid="tab-roles"
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />Roles
            {!canManageRoles && !isPlatformAdmin && (
              <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">Owner</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-0 bg-white rounded-xl border border-slate-200 p-5">
          <OperatorTeamManagement
            operatorId={user?.operator_id}
            operatorName={operatorInfo?.name || user?.operator_name}
            embedded={true}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-0 bg-white rounded-xl border border-slate-200 p-5">
          {canManageRoles || isPlatformAdmin ? (
            <OperatorRolesManagement
              operatorId={user?.operator_id}
              operatorName={operatorInfo?.name || user?.operator_name}
            />
          ) : (
            <div className="text-center py-10">
              <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-700">Owner access required</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Only the operator owner can create and manage custom roles. Contact your owner if you need role changes.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Slim footer note — replaces the heavy "Understanding Roles" card */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#082c59]" />
        <span>
          <span className="font-semibold text-slate-700">Three built-in roles:</span>{' '}
          <strong>Owner</strong> (full control · only one per organisation),{' '}
          <strong>Local Admin</strong> (can manage team &amp; reports),{' '}
          <strong>Local User</strong> (basic access). Owners can also create custom roles in the Roles tab.
        </span>
      </div>
    </div>
  );
}
