import React, { useState, useEffect } from 'react';
import SetupWizard from '@/components/shared/SetupWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Crown, UserCircle2 } from 'lucide-react';
import api from '@/api/client';

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

const ROLE_PRESETS = {
  local_admin: {
    label: 'Local Admin',
    description: "Co-manages this operator's data — same access as you, except they can't promote other admins.",
    icon: Crown,
    perms: SCOPED_PERMISSIONS.map((p) => p.id),
  },
  local_user: {
    label: 'Local User',
    description: 'Day-to-day staff — limited to the permissions you grant below.',
    icon: UserCircle2,
    perms: ['bookings.view', 'services.view'],
  },
};

const DEFAULT_DATA = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  send_invite: true,
  operator_role: 'local_user',
  scoped_permissions: ROLE_PRESETS.local_user.perms,
};

/**
 * OperatorTeamMemberWizard — 3-step modal (Basics → Role → Permissions)
 * used by operator-owners on /management/team-roles to add a team member.
 * Reuses <SetupWizard>. Permissions are inherently capped by what the owner holds.
 */
export default function OperatorTeamMemberWizard({ open, onOpenChange, operatorId, onCreated }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [ownerPerms, setOwnerPerms] = useState([]);

  useEffect(() => {
    if (!open) return;
    setData(DEFAULT_DATA);
    if (operatorId) {
      api.get(`/operators/${operatorId}/owner-permissions`)
        .then((r) => setOwnerPerms(r.data?.permissions || []))
        .catch(() => setOwnerPerms([]));
    }
  }, [open, operatorId]);

  const filterByOwner = (perms) => perms.filter((p) => ownerPerms.includes(p));

  const renderBasics = ({ data, setData }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="text-xs">Full name *</Label>
          <Input value={data.full_name} onChange={(e) => setData({ full_name: e.target.value })} placeholder="Alice Doe" data-testid="opwiz-name" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Email *</Label>
          <Input type="email" value={data.email} onChange={(e) => setData({ email: e.target.value })} placeholder="alice@yourcompany.com" data-testid="opwiz-email" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Phone</Label>
          <Input value={data.phone} onChange={(e) => setData({ phone: e.target.value })} placeholder="+237 6XX XX XX XX" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-slate-800">Send confirmation email</p>
          <p className="text-xs text-slate-500">They'll receive a link to confirm and set their own password.</p>
        </div>
        <Switch checked={data.send_invite} onCheckedChange={(v) => setData({ send_invite: v })} data-testid="opwiz-invite-toggle" />
      </div>
      <div>
        <Label className="text-xs">{data.send_invite ? 'Starting password (optional)' : 'Password *'}</Label>
        <Input
          type="password"
          value={data.password}
          onChange={(e) => setData({ password: e.target.value })}
          placeholder={data.send_invite ? 'Leave blank — invitee sets their own' : 'At least 8 characters'}
          data-testid="opwiz-password"
        />
      </div>
    </div>
  );

  const renderRole = ({ data, setData }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="opwiz-roles">
      {Object.entries(ROLE_PRESETS).map(([key, preset]) => {
        const Icon = preset.icon;
        const selected = data.operator_role === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setData({
              operator_role: key,
              scoped_permissions: filterByOwner(preset.perms),
            })}
            data-testid={`opwiz-role-${key}`}
            className={`text-left rounded-lg border p-4 transition ${
              selected
                ? 'border-[#082c59] bg-[#082c59]/5 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${selected ? 'text-[#082c59]' : 'text-slate-500'}`} />
              <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{preset.description}</p>
          </button>
        );
      })}
    </div>
  );

  const renderPermissions = ({ data, setData }) => {
    const togglePerm = (id) => {
      if (!ownerPerms.includes(id)) return; // safety belt
      setData((p) => ({
        ...p,
        scoped_permissions: p.scoped_permissions.includes(id)
          ? p.scoped_permissions.filter((x) => x !== id)
          : [...p.scoped_permissions, id],
      }));
    };
    const cats = ['Bookings', 'Services', 'Reports', 'Settings'];
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
          Team members can only inherit permissions you already hold. Permissions you don't have are locked.
        </div>
        <div className="text-[11px] text-slate-500">
          Granted <strong className="text-[#082c59]">{data.scoped_permissions.length}</strong> of <strong>{ownerPerms.length}</strong> available permissions.
        </div>
        {cats.map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{cat}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SCOPED_PERMISSIONS.filter((p) => p.category === cat).map((p) => {
                const ownerHas = ownerPerms.includes(p.id);
                const checked = data.scoped_permissions.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                      !ownerHas
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : checked
                        ? 'border-[#082c59] bg-[#082c59]/5 text-slate-900 cursor-pointer'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#082c59]/40 cursor-pointer'
                    }`}
                    data-testid={`opwiz-perm-${p.id}`}
                  >
                    <input
                      type="checkbox"
                      disabled={!ownerHas}
                      checked={checked}
                      onChange={() => togglePerm(p.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="flex-1">{p.label}</span>
                    {!ownerHas && <span className="text-[9px]">locked</span>}
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

  const steps = [
    { id: 'basics',      title: 'Member basics', description: 'Name, email, invite',  validate: validateBasics, render: renderBasics },
    { id: 'role',        title: 'Role',          description: 'Local admin or staff', render: renderRole },
    { id: 'permissions', title: 'Permissions',   description: 'Inherited from your own', render: renderPermissions },
  ];

  return (
    <SetupWizard
      open={open}
      onOpenChange={onOpenChange}
      title="Add Team Member"
      subtitle="Invite a team member and pre-set their role and permissions in one flow."
      accentColor="#082c59"
      steps={steps}
      data={data}
      setData={setData}
      finishLabel={data.send_invite ? 'Create & send invite' : 'Create member'}
      onFinish={async (payload) => {
        await onCreated({
          email: payload.email,
          full_name: payload.full_name,
          phone: payload.phone,
          password: payload.password,
          operator_role: payload.operator_role,
          scoped_permissions: payload.scoped_permissions,
          send_invite: payload.send_invite,
        });
      }}
    />
  );
}
