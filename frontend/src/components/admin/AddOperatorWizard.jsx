import React, { useState } from 'react';
import SetupWizard from '@/components/shared/SetupWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Building2, UserCircle2, ShieldCheck, ClipboardCheck } from 'lucide-react';

// Operator-scoped permissions (mirrors OperatorTeamManagement.SCOPED_PERMISSIONS)
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
  owner: {
    label: 'Owner',
    description: 'Full access — can manage team, services, finances.',
    permissions: SCOPED_PERMISSIONS.map((p) => p.id),
  },
  manager: {
    label: 'Manager',
    description: 'Operational lead — manage bookings, services, view reports.',
    permissions: ['bookings.view', 'bookings.manage', 'services.view', 'services.manage', 'reports.view', 'settings.view'],
  },
  staff: {
    label: 'Staff',
    description: 'Day-to-day — view services and bookings only.',
    permissions: ['bookings.view', 'services.view'],
  },
};

const OPERATOR_TYPES = [
  { value: 'travel', label: 'Travel / Bus' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'car_rental', label: 'Car Rental' },
  { value: 'event', label: 'Events' },
  { value: 'laundry', label: 'Pressing / Laundry' },
  { value: 'banquet', label: 'Banquet' },
  { value: 'cinema', label: 'Cinema' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'multi', label: 'Multi-service' },
];

const DEFAULT_DATA = {
  // Step 1
  name: '',
  email: '',
  phone: '',
  city: '',
  region: '',
  country: 'CM',
  operator_type: 'travel',
  service_types: ['travel'],
  market_segment: 'sme',
  // Step 2
  create_owner_account: true,
  owner_full_name: '',
  owner_email: '',
  owner_phone: '',
  owner_password: '',  // optional — leave blank to force invitee to set their own
  // Step 3
  role_preset: 'owner',
  permissions: ROLE_PRESETS.owner.permissions,
};

/**
 * AddOperatorWizard — 4-step modal for creating an operator + (optionally)
 * inviting the owner and pre-assigning permissions in one flow.
 *
 * onCreate(payload) must POST /api/operators and return the response data
 * (so the parent can show the invite-link dialog).
 */
export default function AddOperatorWizard({ open, onOpenChange, onCreate }) {
  const [data, setData] = useState(DEFAULT_DATA);

  // Reset state every time the wizard opens
  React.useEffect(() => { if (open) setData(DEFAULT_DATA); }, [open]);

  // Step renderers ───────────────────────────────────────────────────────────
  const renderBasics = ({ data, setData }) => (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label className="text-xs">Company Name *</Label>
        <Input value={data.name} onChange={(e) => setData({ name: e.target.value })} placeholder="Acme Logistics" data-testid="wizard-op-name" />
      </div>
      <div>
        <Label className="text-xs">Business Email *</Label>
        <Input type="email" value={data.email} onChange={(e) => setData({ email: e.target.value })} placeholder="info@acme.com" data-testid="wizard-op-email" />
      </div>
      <div>
        <Label className="text-xs">Phone *</Label>
        <Input value={data.phone} onChange={(e) => setData({ phone: e.target.value })} placeholder="+237 6XX XX XX XX" data-testid="wizard-op-phone" />
      </div>
      <div>
        <Label className="text-xs">City *</Label>
        <Input value={data.city} onChange={(e) => setData({ city: e.target.value })} placeholder="Yaoundé" data-testid="wizard-op-city" />
      </div>
      <div>
        <Label className="text-xs">Region</Label>
        <Input value={data.region} onChange={(e) => setData({ region: e.target.value })} placeholder="Centre" />
      </div>
      <div>
        <Label className="text-xs">Operator Type *</Label>
        <Select value={data.operator_type} onValueChange={(v) => setData({ operator_type: v, service_types: [v === 'multi' ? 'travel' : v] })}>
          <SelectTrigger data-testid="wizard-op-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {OPERATOR_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Market Segment</Label>
        <Select value={data.market_segment} onValueChange={(v) => setData({ market_segment: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sme">SME</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
            <SelectItem value="independent">Independent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderOwner = ({ data, setData }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm text-slate-800 font-medium">Create an owner account</p>
          <p className="text-xs text-slate-500">An invite email will be sent so the owner can confirm their account.</p>
        </div>
        <Switch checked={data.create_owner_account} onCheckedChange={(v) => setData({ create_owner_account: v })} data-testid="wizard-toggle-owner" />
      </div>
      {data.create_owner_account && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-xs">Full name *</Label>
            <Input value={data.owner_full_name} onChange={(e) => setData({ owner_full_name: e.target.value })} placeholder="Alice Operator" data-testid="wizard-owner-name" />
          </div>
          <div>
            <Label className="text-xs">Owner email *</Label>
            <Input type="email" value={data.owner_email} onChange={(e) => setData({ owner_email: e.target.value })} placeholder="alice@acme.com" data-testid="wizard-owner-email" />
          </div>
          <div>
            <Label className="text-xs">Owner phone</Label>
            <Input value={data.owner_phone} onChange={(e) => setData({ owner_phone: e.target.value })} placeholder="+237 6XX XX XX XX" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Starting password <span className="text-slate-400">(optional)</span></Label>
            <Input type="password" value={data.owner_password} onChange={(e) => setData({ owner_password: e.target.value })} placeholder="Leave blank — invitee sets their own" data-testid="wizard-owner-password" />
            <p className="text-[11px] text-slate-500 mt-1">If left blank, the invitee will be asked to set their own password from the email link. Otherwise this becomes the starting password and they'll be asked to confirm before signing in.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderRoleAndPermissions = ({ data, setData }) => {
    const togglePerm = (id) => setData((p) => ({
      ...p,
      permissions: p.permissions.includes(id) ? p.permissions.filter((x) => x !== id) : [...p.permissions, id],
    }));
    const applyPreset = (preset) => setData({ role_preset: preset, permissions: ROLE_PRESETS[preset].permissions });
    return (
      <div className="space-y-5">
        <div>
          <Label className="text-xs mb-1.5 block">Role preset</Label>
          <div className="grid grid-cols-3 gap-2" data-testid="wizard-role-presets">
            {Object.entries(ROLE_PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                data-testid={`wizard-role-${key}`}
                className={`text-left rounded-lg border p-3 transition ${
                  data.role_preset === key
                    ? 'border-[#082c59] bg-[#082c59]/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1.5 block">Fine-tune permissions ({data.permissions.length})</Label>
          {['Bookings', 'Services', 'Reports', 'Settings'].map((cat) => (
            <div key={cat} className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{cat}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SCOPED_PERMISSIONS.filter((p) => p.category === cat).map((p) => {
                  const checked = data.permissions.includes(p.id);
                  return (
                    <label key={p.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer transition ${
                      checked ? 'border-[#082c59] bg-[#082c59]/5 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                      <Checkbox checked={checked} onCheckedChange={() => togglePerm(p.id)} data-testid={`wizard-perm-${p.id}`} />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReview = ({ data }) => (
    <div className="space-y-3 text-sm">
      <Row label="Company" value={data.name} />
      <Row label="Business email" value={data.email} />
      <Row label="Phone" value={data.phone} />
      <Row label="City" value={data.city} />
      <Row label="Type" value={OPERATOR_TYPES.find((o) => o.value === data.operator_type)?.label} />
      <Row label="Market" value={data.market_segment} />
      {data.create_owner_account ? (
        <>
          <div className="border-t border-slate-100 pt-3" />
          <Row label="Owner" value={`${data.owner_full_name} · ${data.owner_email}`} />
          <Row label="Owner phone" value={data.owner_phone || '—'} />
          <Row label="Starting password" value={data.owner_password ? '(set by you)' : 'Invitee will set their own'} />
          <Row label="Role" value={ROLE_PRESETS[data.role_preset]?.label} />
          <Row label="Permissions" value={`${data.permissions.length} of ${SCOPED_PERMISSIONS.length}`} />
        </>
      ) : (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
          No owner account will be created. You can invite someone later from the Operators page.
        </div>
      )}
    </div>
  );

  const validateBasics = (d) => {
    const errs = [];
    if (!d.name) errs.push('Company name is required');
    if (!d.email) errs.push('Business email is required');
    if (!d.phone) errs.push('Phone is required');
    if (!d.city) errs.push('City is required');
    return errs.length ? errs : null;
  };
  const validateOwner = (d) => {
    if (!d.create_owner_account) return null;
    const errs = [];
    if (!d.owner_full_name) errs.push("Owner's full name is required");
    if (!d.owner_email) errs.push("Owner's email is required");
    if (d.owner_password && d.owner_password.length < 8) errs.push('Starting password must be at least 8 characters');
    return errs.length ? errs : null;
  };

  const steps = [
    { id: 'basics', title: 'Company basics', description: 'Where + what they do', validate: validateBasics, render: renderBasics },
    { id: 'owner',  title: 'Owner account',  description: 'Invite & access',     validate: validateOwner,  render: renderOwner },
    { id: 'role',   title: 'Role & permissions', description: 'Pre-assign access', render: renderRoleAndPermissions },
    { id: 'review', title: 'Review & send',  description: 'Confirm before invite', render: renderReview },
  ];

  return (
    <SetupWizard
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Operator"
      subtitle="Bundle the operator, owner invite and permissions in one flow."
      accentColor="#082c59"
      steps={steps}
      data={data}
      setData={setData}
      finishLabel={data.create_owner_account ? 'Create & send invite' : 'Create operator'}
      onFinish={async (payload) => {
        // The role/permissions are stored on the operator record for now;
        // they'll be applied when the owner activates (handled server-side later).
        const apiPayload = { ...payload };
        delete apiPayload.role_preset;
        // permissions are kept under "owner_permissions" so we don't conflict with the operator schema
        apiPayload.owner_permissions = payload.permissions;
        delete apiPayload.permissions;
        await onCreate(apiPayload);
      }}
    />
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-slate-800 text-sm text-right max-w-[60%] break-words">{value || '—'}</span>
    </div>
  );
}
