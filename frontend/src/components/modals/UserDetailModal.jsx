import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Mail, Phone, User as UserIcon, Calendar, Shield, Package, CheckCircle, XCircle,
  CreditCard, MapPin, Activity, Save, Edit2, Search, Building2, UserX, Loader2,
  ChevronLeft, ChevronRight, FileText, ShieldCheck, ExternalLink, Hash, Users as UsersIcon,
} from 'lucide-react';
import api from '../../api/client';
import OperatorPicker from '../shared/OperatorPicker';
import DatePickerField from '../shared/DatePickerField';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

const roleTone = (r) => ({
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  operator: 'bg-amber-100 text-amber-700 border-amber-200',
  employee: 'bg-teal-100 text-teal-700 border-teal-200',
  customer: 'bg-blue-100 text-blue-700 border-blue-200',
}[r] || 'bg-slate-100 text-slate-700 border-slate-200');

const fmtFCFA = (n) => `${Number(n || 0).toLocaleString()} FCFA`;

export default function UserDetailModal({ isOpen, onClose, user, onUpdate }) {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const PAGE_SIZE = 15;

  // Prefill whenever the user prop changes
  useEffect(() => {
    if (!user) return;
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      date_of_birth: user.date_of_birth || '',
      id_document_number: user.id_document_number || '',
      gender: user.gender || '',
      address: user.address || '',
      city: user.city || '',
      region: user.region || '',
      postal_code: user.postal_code || '',
      country: user.country || '',
      operator_id: user.operator_id || '',
      status: user.status || 'active',
    });
    setEditMode(false);
    setStats(null);
    setActivity([]);
    setActivityPage(1);
    setActivitySearch('');
    setActivityDateFrom('');
    setActivityDateTo('');
  }, [user]);

  // Load real stats when opened
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/users/${user.id}/stats`);
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user?.id]);

  // Debounced activity fetch
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setActivityLoading(true);
      try {
        const params = { skip: (activityPage - 1) * PAGE_SIZE, limit: PAGE_SIZE };
        if (activitySearch.trim().length >= 2) params.search = activitySearch.trim();
        if (activityDateFrom) params.date_from = activityDateFrom;
        if (activityDateTo) params.date_to = activityDateTo;
        const { data } = await api.get(`/users/${user.id}/activity`, { params });
        if (cancelled) return;
        // Backend returns combined `activities` array + `total`.
        const logs = data.activities || [...(data.audit_logs || []), ...(data.activity_logs || [])]
          .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));
        setActivity(logs);
        setActivityTotal(data.total || data.totals?.total || logs.length);
      } catch {
        if (!cancelled) { setActivity([]); setActivityTotal(0); }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, user?.id, activitySearch, activityDateFrom, activityDateTo, activityPage]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        date_of_birth: form.date_of_birth,
        id_document_number: form.id_document_number,
        gender: form.gender,
        address: form.address,
        city: form.city,
        region: form.region,
        postal_code: form.postal_code,
        country: form.country,
        status: form.status,
      };
      // Only include operator_id if the user is currently an operator (or being kept as one).
      if (user.role === 'operator') {
        payload.operator_id = form.operator_id || null;
      }
      await api.put(`/users/${user.id}`, payload);
      toast.success('User updated');
      setEditMode(false);
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOperator = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, { operator_id: null });
      toast.success('Operator assignment removed');
      setForm(f => ({ ...f, operator_id: '' }));
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(activityTotal / PAGE_SIZE));

  const statCards = useMemo(() => ([
    { label: 'Total Orders', value: stats?.total_orders ?? (user?.orders_count ?? 0), icon: Package, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Total Spent', value: fmtFCFA(stats?.total_spent ?? user?.total_spent ?? 0), icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Completed', value: stats?.completed_orders ?? 0, icon: CheckCircle, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Cancelled', value: stats?.cancelled_orders ?? 0, icon: XCircle, tone: 'bg-red-50 text-red-700' },
  ]), [stats, user]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden flex flex-col max-h-[92vh]"
        data-testid="user-detail-modal"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-[#082c59] to-[#0a3a73] text-white flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl font-bold">
              {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold truncate">{user.full_name || 'Unnamed User'}</DialogTitle>
              <p className="text-sm text-white/80 truncate">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge className={`border ${roleTone(user.role)}`}>
                  <Shield className="h-3 w-3 mr-1" />
                  <span className="capitalize">{String(user.role || '').replace('_', ' ')}</span>
                </Badge>
                <Badge className={user.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 border'
                  : 'bg-red-100 text-red-800 border-red-200 border'}>
                  {user.status || 'active'}
                </Badge>
                {user.operator_name && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 border">
                    <Building2 className="h-3 w-3 mr-1" /> {user.operator_name}
                  </Badge>
                )}
              </div>
            </div>
            {!editMode ? (
              <Button variant="secondary" size="sm" onClick={() => setEditMode(true)} className="gap-2" data-testid="user-edit-btn">
                <Edit2 className="h-4 w-4" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 bg-white text-[#082c59] hover:bg-white/90" data-testid="user-save-btn">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pt-5 pb-2 flex-shrink-0">
          {statCards.map((s) => (
            <div key={s.label} className={`rounded-xl p-3 ${s.tone}`} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-semibold opacity-75">{s.label}</span>
                <s.icon className="h-3.5 w-3.5 opacity-80" />
              </div>
              <p className="mt-1 text-lg font-bold truncate">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + scrollable body */}
        <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 flex-shrink-0">
            <TabsTrigger value="profile" data-testid="tab-profile"><UserIcon className="h-4 w-4 mr-2" />Profile</TabsTrigger>
            <TabsTrigger value="address" data-testid="tab-address"><MapPin className="h-4 w-4 mr-2" />Address</TabsTrigger>
            <TabsTrigger value="permissions" data-testid="tab-permissions"><ShieldCheck className="h-4 w-4 mr-2" />Permissions</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity"><Activity className="h-4 w-4 mr-2" />Activity</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3">
            {/* Profile tab */}
            <TabsContent value="profile" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field icon={UserIcon} label="Full name" editMode={editMode}
                  value={form.full_name}
                  onChange={(v) => setForm(f => ({ ...f, full_name: v }))}
                  fallback={user.full_name} />
                <Field icon={Mail} label="Email" editMode={editMode}
                  value={form.email}
                  onChange={(v) => setForm(f => ({ ...f, email: v }))}
                  fallback={user.email} testid="field-email" />
                <Field icon={Phone} label="Phone" editMode={editMode}
                  value={form.phone}
                  onChange={(v) => setForm(f => ({ ...f, phone: v }))}
                  fallback={user.phone || '—'} testid="field-phone" />
                {/* Date of birth — special date picker */}
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Date of Birth
                  </Label>
                  {editMode ? (
                    <DatePickerField
                      value={form.date_of_birth}
                      onChange={(v) => setForm(f => ({ ...f, date_of_birth: v }))}
                      placeholder="Date of birth"
                      title="Date of Birth"
                      minDate={null}
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {user.date_of_birth ? formatDate(user.date_of_birth) : '—'}
                    </p>
                  )}
                </div>
                {/* Gender — special select */}
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                    <UsersIcon className="h-3 w-3" /> Gender
                  </Label>
                  {editMode ? (
                    <select
                      value={form.gender || ''}
                      onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                      className="mt-1 w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#082c59]/20"
                      data-testid="field-gender"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-slate-800 capitalize">{user.gender?.replace(/_/g, ' ') || '—'}</p>
                  )}
                </div>
                <Field icon={Hash} label="ID / Passport #" editMode={editMode}
                  value={form.id_document_number}
                  onChange={(v) => setForm(f => ({ ...f, id_document_number: v }))}
                  fallback={user.id_document_number || '—'} testid="field-id-doc" />
                <Field icon={Calendar} label="Joined"
                  fallback={formatDate(user.created_at) || '—'} />
              </div>

              {/* Operator assignment (only for operator role) */}
              {user.role === 'operator' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4" data-testid="operator-assignment-section">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" /> Operator assignment
                      </h3>
                      <p className="text-xs text-amber-700/80 mt-0.5">
                        This user is a member of the assigned operator&apos;s team.
                      </p>
                    </div>
                    {user.operator_id && !editMode && (
                      <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50 gap-1" onClick={handleRemoveOperator} disabled={saving} data-testid="remove-operator-btn">
                        <UserX className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                  {editMode ? (
                    <OperatorPicker
                      value={form.operator_id}
                      onChange={(id) => setForm(f => ({ ...f, operator_id: id }))}
                    />
                  ) : user.operator_id ? (
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                      <Building2 className="h-4 w-4 text-[#082c59]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{user.operator_name || 'Assigned operator'}</p>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{user.operator_id}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-800/80 italic">Not assigned — click Edit to pick an operator.</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Address tab */}
            <TabsContent value="address" className="space-y-4 mt-0" data-testid="address-panel">
              <p className="text-xs text-slate-500">Update this user&apos;s mailing address. These fields are always editable by administrators.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field icon={MapPin} label="Street address" editMode={editMode}
                    value={form.address}
                    onChange={(v) => setForm(f => ({ ...f, address: v }))}
                    fallback={user.address || '—'} testid="field-address" />
                </div>
                <Field icon={MapPin} label="City" editMode={editMode}
                  value={form.city}
                  onChange={(v) => setForm(f => ({ ...f, city: v }))}
                  fallback={user.city || '—'} testid="field-city" />
                <Field icon={MapPin} label="Region / State" editMode={editMode}
                  value={form.region}
                  onChange={(v) => setForm(f => ({ ...f, region: v }))}
                  fallback={user.region || '—'} testid="field-region" />
                <Field icon={Hash} label="Postal code" editMode={editMode}
                  value={form.postal_code}
                  onChange={(v) => setForm(f => ({ ...f, postal_code: v }))}
                  fallback={user.postal_code || '—'} testid="field-postal" />
                <Field icon={MapPin} label="Country" editMode={editMode}
                  value={form.country}
                  onChange={(v) => setForm(f => ({ ...f, country: v }))}
                  fallback={user.country || '—'} testid="field-country" />
              </div>
            </TabsContent>

            {/* Permissions tab — shortcut to dedicated Permissions Manager */}
            <TabsContent value="permissions" className="space-y-3 mt-0" data-testid="permissions-panel">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-[#082c59] text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">Role &amp; permissions</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Current role: <span className="font-semibold capitalize">{user.role || 'customer'}</span>
                      {user.custom_permissions?.length > 0 && (
                        <> · {user.custom_permissions.length} custom permission(s)</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => { onClose(); navigate(`/admin/users/permissions?user=${user.id}#user-permissions`); }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#082c59]/40 hover:shadow-sm transition"
                  data-testid="goto-user-permissions">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">User Permissions</p>
                    <p className="text-[11px] text-slate-500">Override role defaults for this user</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </button>
                <button type="button"
                  onClick={() => { onClose(); navigate('/admin/users/permissions#roles'); }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#082c59]/40 hover:shadow-sm transition"
                  data-testid="goto-roles">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Roles</p>
                    <p className="text-[11px] text-slate-500">Review &amp; configure roles</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </button>
                <button type="button"
                  onClick={() => { onClose(); navigate('/admin/users/permissions#matrix'); }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#082c59]/40 hover:shadow-sm transition"
                  data-testid="goto-matrix">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Permission Matrix</p>
                    <p className="text-[11px] text-slate-500">See what every role can do</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </button>
                <button type="button"
                  onClick={() => { onClose(); navigate(`/admin/users/permissions?user=${user.id}#audit-trail`); }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#082c59]/40 hover:shadow-sm transition"
                  data-testid="goto-audit-trail">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Audit Trail</p>
                    <p className="text-[11px] text-slate-500">Denied actions &amp; access events</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </TabsContent>

            {/* Activity tab */}
            <TabsContent value="activity" className="mt-0 space-y-3" data-testid="activity-panel">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search activity…"
                    className="pl-8 h-9"
                    value={activitySearch}
                    onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(1); }}
                    data-testid="activity-search"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase text-slate-500">From</Label>
                  <Input type="date" className="h-9 w-36" value={activityDateFrom} onChange={(e) => { setActivityDateFrom(e.target.value); setActivityPage(1); }} data-testid="activity-date-from" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase text-slate-500">To</Label>
                  <Input type="date" className="h-9 w-36" value={activityDateTo} onChange={(e) => { setActivityDateTo(e.target.value); setActivityPage(1); }} data-testid="activity-date-to" />
                </div>
                {(activitySearch || activityDateFrom || activityDateTo) && (
                  <Button variant="outline" size="sm" onClick={() => { setActivitySearch(''); setActivityDateFrom(''); setActivityDateTo(''); setActivityPage(1); }}>
                    Clear
                  </Button>
                )}
              </div>

              {/* List */}
              <div className="rounded-xl border">
                {activityLoading ? (
                  <div className="py-10 text-center text-slate-500 text-sm flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading activity…
                  </div>
                ) : activity.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm">No activity found.</div>
                ) : (
                  <ul className="divide-y max-h-[45vh] overflow-y-auto">
                    {activity.map((log, i) => (
                      <li key={log._id || log.id || i} className="p-3 hover:bg-slate-50 flex gap-3" data-testid={`activity-item-${i}`}>
                        <div className="w-8 h-8 rounded-full bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                          <Activity className="h-4 w-4 text-[#082c59]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{log.action || log.description || 'Activity'}</p>
                          {log.description && log.description !== log.action && (
                            <p className="text-xs text-slate-600 mt-0.5">{log.description}</p>
                          )}
                          {log.resource_type && (
                            <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 inline-block mt-1">
                              {log.resource_type}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                          {formatDate(log.created_at || log.timestamp, true)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pagination */}
              {activityTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm pt-1" data-testid="activity-pagination">
                  <span className="text-slate-500">Page {activityPage} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage === 1}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActivityPage(p => Math.min(totalPages, p + 1))} disabled={activityPage >= totalPages}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Small reusable field row — editable or read-only based on editMode. */
function Field({ icon: Icon, label, value, onChange, fallback, editMode, testid }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {editMode && onChange ? (
        <Input className="mt-1 h-9" value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
      ) : (
        <p className="mt-1 text-sm text-slate-900 truncate" data-testid={testid}>{value || fallback || '—'}</p>
      )}
    </div>
  );
}
