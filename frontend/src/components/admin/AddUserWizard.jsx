import React, { useEffect, useState } from 'react';
import SetupWizard from '@/components/shared/SetupWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import api from '@/api/client';

// Operator-scoped permissions (same set as AddOperatorWizard for symmetry)
const SCOPED_PERMISSIONS = [
  { id: 'bookings.view',   label: 'View Bookings',   category: 'Bookings' },
  { id: 'bookings.manage', label: 'Manage Bookings', category: 'Bookings' },
  { id: 'services.view',   label: 'View Services',   category: 'Services' },
  { id: 'services.manage', label: 'Manage Services', category: 'Services' },
  { id: 'reports.view',    label: 'View Reports',    category: 'Reports'  },
  { id: 'reports.export',  label: 'Export Reports',  category: 'Reports'  },
  { id: 'settings.view',   label: 'View Settings',   category: 'Settings' },
  { id: 'settings.manage', label: 'Manage Settings', category: 'Settings' },
];

// Admin-scoped permissions (for non-operator roles)
const ADMIN_PERMISSIONS = [
  { id: 'users.view',    label: 'View Users',    category: 'Users'    },
  { id: 'users.create',  label: 'Create Users',  category: 'Users'    },
  { id: 'users.update',  label: 'Update Users',  category: 'Users'    },
  { id: 'operators.view',   label: 'View Operators',   category: 'Operators' },
  { id: 'operators.manage', label: 'Manage Operators', category: 'Operators' },
  { id: 'reports.view',     label: 'View Reports',     category: 'Reports'   },
  { id: 'reports.export',   label: 'Export Reports',   category: 'Reports'   },
  { id: 'settings.view',    label: 'View Settings',    category: 'Settings'  },
];

const ROLE_PRESETS = {
  // Operator-scoped roles
  owner:   { label: 'Owner',   description: 'Full access to the operator workspace.', requires: 'operator', perms: SCOPED_PERMISSIONS.map((p) => p.id) },
  manager: { label: 'Manager', description: 'Operational lead — manage bookings & services.', requires: 'operator', perms: ['bookings.view','bookings.manage','services.view','services.manage','reports.view','settings.view'] },
  staff:   { label: 'Staff',   description: 'Day-to-day — view-only across services.', requires: 'operator', perms: ['bookings.view','services.view'] },
  // Admin-scoped roles
  admin:        { label: 'Admin',        description: 'Platform admin with elevated cross-operator access.', requires: 'admin', perms: ADMIN_PERMISSIONS.map((p) => p.id) },
  customer:     { label: 'Customer',     description: 'End-user customer account.',                 requires: 'customer', perms: [] },
};

const DEFAULT_DATA = {
  // Step 1
  email: '',
  full_name: '',
  phone: '',
  password: '',
  send_invite: true,
  // Step 2
  role: 'customer',         // customer | operator | admin | super_admin
  operator_id: '',
  operator_role: 'staff',    // owner | manager | staff
  // Step 3
  permissions: [],
  role_preset: 'customer',
};

export default function AddUserWizard({ open, onOpenChange, onCreate, currentUserRole = 'admin' }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [operators, setOperators] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);

  useEffect(() => { if (open) setData(DEFAULT_DATA); }, [open]);

  // Fetch operators when the user picks the operator role
  useEffect(() => {
    if (!open) return;
    if (data.role !== 'operator') return;
    if (operators.length > 0) return;
    setOperatorsLoading(true);
    api.get('/operators/').then((res) => {
      setOperators(res.data?.operators || res.data || []);
    }).catch(() => setOperators([])).finally(() => setOperatorsLoading(false));
  }, [open, data.role, operators.length]);

  // Step renderers ───────────────────────────────────────────────────────────
  const renderBasics = ({ data, setData }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="text-xs">Full name *</Label>
          <Input value={data.full_name} onChange={(e) => setData({ full_name: e.target.value })} placeholder="Alice Doe" data-testid="wiz-user-name" />
        </div>
        <div>
          <Label className="text-xs">Email *</Label>
          <Input type="email" value={data.email} onChange={(e) => setData({ email: e.target.value })} placeholder="alice@example.com" data-testid="wiz-user-email" />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={data.phone} onChange={(e) => setData({ phone: e.target.value })} placeholder="+237 6XX XX XX XX" data-testid="wiz-user-phone" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm text-slate-800 font-medium">Send confirmation email</p>
          <p className="text-xs text-slate-500">The user will receive a link to confirm their account before they can sign in.</p>
        </div>
        <Switch checked={data.send_invite} onCheckedChange={(v) => setData({ send_invite: v })} data-testid="wiz-user-invite-toggle" />
      </div>
      <div>
        <Label className="text-xs">{data.send_invite ? 'Starting password (optional)' : 'Password *'}</Label>
        <Input
          type="password"
          value={data.password}
          onChange={(e) => setData({ password: e.target.value })}
          placeholder={data.send_invite ? 'Leave blank — user sets their own' : 'At least 8 characters'}
          data-testid="wiz-user-password"
        />
        {data.send_invite && (
          <p className="text-[11px] text-slate-500 mt-1">If blank, the invitee will set their own password from the email link.</p>
        )}
      </div>
    </div>
  );

  const renderRoleAndOperator = ({ data, setData }) => {
    const canPickAdminRoles = currentUserRole === 'super_admin';
    return (
      <div className="space-y-5">
        <div>
          <Label className="text-xs mb-1.5 block">Account role *</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(ROLE_PRESETS)
              .filter(([key]) => {
                // Hide super_admin everywhere — handled separately by super admin tooling
                if (key === 'super_admin') return false;
                // Hide admin unless current user is super_admin
                if (key === 'admin' && !canPickAdminRoles) return false;
                return true;
              })
              .map(([key, preset]) => {
                const targetRole = preset.requires;  // 'operator' | 'admin' | 'customer'
                const selected = (data.role === targetRole) && (preset.requires === 'operator' ? data.operator_role === key : true);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setData({
                      role: targetRole,
                      operator_role: preset.requires === 'operator' ? key : data.operator_role,
                      role_preset: key,
                      permissions: preset.perms,
                    })}
                    data-testid={`wiz-user-role-${key}`}
                    className={`text-left rounded-lg border p-3 transition ${
                      selected
                        ? 'border-[#082c59] bg-[#082c59]/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{preset.description}</p>
                  </button>
                );
              })}
          </div>
        </div>

        {data.role === 'operator' && (
          <div data-testid="wiz-operator-picker">
            <Label className="text-xs mb-1.5 block">Assign to operator *</Label>
            <Select value={data.operator_id} onValueChange={(v) => setData({ operator_id: v })}>
              <SelectTrigger data-testid="wiz-user-operator"><SelectValue placeholder={operatorsLoading ? 'Loading operators…' : 'Pick an operator'} /></SelectTrigger>
              <SelectContent className="bg-white max-h-72">
                {operators.map((o) => (
                  <SelectItem key={o._id || o.id} value={o._id || o.id}>{o.name}</SelectItem>
                ))}
                {!operatorsLoading && operators.length === 0 && (
                  <SelectItem value="__none" disabled>No operators yet — create one first</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  const renderPermissions = ({ data, setData }) => {
    const permList = data.role === 'operator' ? SCOPED_PERMISSIONS
                   : data.role === 'admin'    ? ADMIN_PERMISSIONS
                   : [];
    if (data.role === 'customer') {
      return (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
          Customer accounts don't require explicit permissions — they only access the public customer flows.
        </div>
      );
    }
    const togglePerm = (id) => setData((p) => ({
      ...p,
      permissions: p.permissions.includes(id) ? p.permissions.filter((x) => x !== id) : [...p.permissions, id],
    }));
    const cats = Array.from(new Set(permList.map((p) => p.category)));
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Granted via the <strong>{ROLE_PRESETS[data.role_preset]?.label}</strong> preset — you can fine-tune below.</p>
        {cats.map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{cat}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {permList.filter((p) => p.category === cat).map((p) => {
                const checked = data.permissions.includes(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer transition ${
                    checked ? 'border-[#082c59] bg-[#082c59]/5 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                    <Checkbox checked={checked} onCheckedChange={() => togglePerm(p.id)} data-testid={`wiz-user-perm-${p.id}`} />
                    {p.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const validateBasics = (d) => {
    const errs = [];
    if (!d.full_name) errs.push('Full name is required');
    if (!d.email) errs.push('Email is required');
    if (!d.send_invite && (!d.password || d.password.length < 8)) errs.push('Password must be at least 8 characters when not sending an invite');
    if (d.send_invite && d.password && d.password.length < 8) errs.push('Starting password must be at least 8 characters');
    return errs.length ? errs : null;
  };

  const validateRole = (d) => {
    const errs = [];
    if (!d.role) errs.push('Pick an account role');
    if (d.role === 'operator' && !d.operator_id) errs.push('Pick an operator to assign this user to');
    return errs.length ? errs : null;
  };

  const steps = [
    { id: 'basics',      title: 'User basics',          description: 'Name, email, invite',     validate: validateBasics, render: renderBasics },
    { id: 'role',        title: 'Role & operator',     description: 'What can they access?',    validate: validateRole,   render: renderRoleAndOperator },
    { id: 'permissions', title: 'Permissions',         description: 'Fine-tune access',         render: renderPermissions },
  ];

  return (
    <SetupWizard
      open={open}
      onOpenChange={onOpenChange}
      title="Add New User"
      subtitle="Onboard a user, assign an operator, and pre-set permissions."
      accentColor="#082c59"
      steps={steps}
      data={data}
      setData={setData}
      finishLabel={data.send_invite ? 'Create & send invite' : 'Create user'}
      onFinish={async (payload) => {
        const apiPayload = {
          email: payload.email,
          full_name: payload.full_name,
          phone: payload.phone,
          password: payload.password,
          role: payload.role,
          send_invite: payload.send_invite,
          permissions: payload.permissions,
        };
        if (payload.role === 'operator') {
          apiPayload.operator_id = payload.operator_id;
          apiPayload.operator_role = payload.operator_role;
        }
        await onCreate(apiPayload);
      }}
    />
  );
}
