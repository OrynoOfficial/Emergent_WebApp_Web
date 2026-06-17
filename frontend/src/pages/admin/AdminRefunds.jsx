// Admin refund queue + history. Surfaces customer + service info so admins
// can make informed decisions without leaving the page.
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCcw, Check, X, Loader2, Search, Inbox, AlertCircle, ChevronRight,
  User2, Mail, Phone, MapPin, Calendar, Receipt, Package as PackageIcon,
  ShoppingBag, History, Eye,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending:    'bg-amber-100 text-amber-800 border-amber-200',
  approved:   'bg-blue-100 text-blue-800 border-blue-200',
  completed:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:   'bg-slate-200 text-slate-700 border-slate-300',
  failed:     'bg-rose-100 text-rose-800 border-rose-200',
  cancelled:  'bg-slate-100 text-slate-500 border-slate-200',
};

// Customer chip — clickable cell that on hover surfaces a richer popover
// (date joined, lifetime spent, refund history) so admins can spot
// suspicious patterns at a glance.
function CustomerHoverCard({ customer }) {
  if (!customer) {
    return <span className="text-slate-400 text-xs italic">No profile</span>;
  }
  const joined = customer.joined_at ? format(new Date(customer.joined_at), 'MMM yyyy') : '—';
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-left" data-testid={`customer-trigger-${customer.id}`}>
            <p className="font-medium text-slate-800 text-sm leading-tight flex items-center gap-1">
              {customer.name || '—'}
              {customer.risk_flag === 'suspicious' && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200" data-testid="risk-chip-suspicious">🚨</span>
              )}
              {customer.risk_flag === 'frequent_refunder' && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200" data-testid="risk-chip-frequent">⚠️</span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{customer.email}</p>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-white text-slate-900 border shadow-xl rounded-xl p-0 max-w-xs">
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <User2 className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{customer.name}</p>
                <p className="text-slate-500 truncate">{customer.email}</p>
              </div>
            </div>
            {customer.phone && <div className="flex items-center gap-1.5 text-slate-600"><Phone className="w-3 h-3" /> {customer.phone}</div>}
            {(customer.city || customer.country) && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="w-3 h-3" /> {[customer.city, customer.country].filter(Boolean).join(', ')}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="w-3 h-3" /> Joined {joined}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Renders the detail modal for a single refund row.
function RefundDetailModal({ refundId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!refundId) return;
    setLoading(true);
    api.get(`/refunds/${refundId}/details`)
      .then(res => setData(res.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load details'))
      .finally(() => setLoading(false));
  }, [refundId]);

  const refund = data?.refund;
  const order = data?.order;
  const customer = data?.customer;
  const booking = order?.booking_details || {};

  return (
    <Dialog open={!!refundId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-white max-h-[88vh] overflow-y-auto" data-testid="refund-detail-modal">
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-500" /> Refund details
            {refund && <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[refund.status] || ''}`}>{refund.status}</Badge>}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-slate-400" /></div>
        ) : !data ? (
          <p className="text-sm text-slate-500 p-6">Could not load this refund.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {/* Refund summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Requested</p>
                <p className="font-bold text-slate-900">{formatFCFA(refund.requested_amount)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Eligible (policy)</p>
                <p className="font-bold text-slate-900">{formatFCFA(refund.eligible_amount)}</p>
                <p className="text-[10px] text-slate-500">{refund.refundable_pct}%</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Order total</p>
                <p className="font-bold text-slate-900">{formatFCFA(refund.total_amount)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Approved</p>
                <p className="font-bold text-slate-900">{refund.approved_amount ? formatFCFA(refund.approved_amount) : '—'}</p>
              </div>
            </div>

            {/* Customer */}
            <Card className="border-slate-200 shadow-none">
              <div className="p-3 bg-slate-50 border-b">
                <p className="text-[10px] uppercase text-slate-500 font-semibold flex items-center gap-1.5">
                  <User2 className="w-3 h-3" /> Customer
                </p>
              </div>
              <CardContent className="p-4">
                {customer ? (
                  <>
                    {customer.risk_flag && (
                      <div
                        className={`mb-3 p-3 rounded-lg border-l-4 flex items-start gap-2 ${
                          customer.risk_flag === 'suspicious'
                            ? 'bg-rose-50 border-rose-500 text-rose-900'
                            : 'bg-amber-50 border-amber-500 text-amber-900'
                        }`}
                        data-testid={`risk-badge-${customer.risk_flag}`}
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1 text-xs">
                          <p className="font-bold uppercase tracking-wide">
                            {customer.risk_flag === 'suspicious' ? '🚨 Suspicious refund pattern' : '⚠️ Frequent refunder'}
                          </p>
                          <p className="text-[11px] mt-0.5">
                            {customer.total_refunds_count} refund{customer.total_refunds_count !== 1 ? 's' : ''} on {customer.total_orders} order{customer.total_orders !== 1 ? 's' : ''}
                            {' '}({Math.round((customer.refund_rate || 0) * 100)}% rate).
                            {customer.risk_flag === 'suspicious' ? ' Review carefully before approving.' : ' Worth a closer look.'}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Name</p>
                      <p className="font-semibold text-slate-900">{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Email</p>
                      <p className="font-mono text-slate-700">{customer.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Phone</p>
                      <p className="font-mono text-slate-700">{customer.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Joined</p>
                      <p className="text-slate-700">{customer.joined_at ? format(new Date(customer.joined_at), 'MMM d, yyyy') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Lifetime spent</p>
                      <p className="font-bold text-emerald-700">{formatFCFA(customer.lifetime_spent)}</p>
                      <p className="text-[10px] text-slate-500">{customer.total_orders} orders</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Past refunds</p>
                      <p className="font-bold text-rose-700">{formatFCFA(customer.total_refunded_amount)}</p>
                      <p className="text-[10px] text-slate-500">{customer.total_refunds_count} refunded</p>
                    </div>
                  </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 italic">Customer profile not available.</p>
                )}
              </CardContent>
            </Card>

            {/* Service / Order */}
            <Card className="border-slate-200 shadow-none">
              <div className="p-3 bg-slate-50 border-b">
                <p className="text-[10px] uppercase text-slate-500 font-semibold flex items-center gap-1.5">
                  <ShoppingBag className="w-3 h-3" /> Service & ticket
                </p>
              </div>
              <CardContent className="p-4 space-y-2 text-xs">
                {order ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Order #</p>
                        <p className="font-mono text-slate-800">{order.order_number || (order.id || '').slice(0, 12) + '…'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Service type</p>
                        <p className="capitalize font-semibold text-slate-800">{(order.service_type || refund.service_type || '—').replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Service name</p>
                        <p className="text-slate-800">{booking.service_name || booking.title || order.service_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Payment method</p>
                        <p className="capitalize text-slate-800">{order.payment_method || '—'}</p>
                      </div>
                    </div>
                    {/* Ticket / booking specifics */}
                    {(booking.class_name || booking.seat_ids?.length || booking.quantity) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                        {booking.class_name && (
                          <div>
                            <p className="text-[10px] uppercase text-slate-500">Class</p>
                            <p className="font-semibold text-slate-800">{booking.class_name}</p>
                          </div>
                        )}
                        {booking.quantity && (
                          <div>
                            <p className="text-[10px] uppercase text-slate-500">Quantity</p>
                            <p className="font-semibold text-slate-800">× {booking.quantity}</p>
                          </div>
                        )}
                        {booking.seat_ids?.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase text-slate-500">Seats</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {booking.seat_ids.map(s => (
                                <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 italic">Order record not found.</p>
                )}
              </CardContent>
            </Card>

            {/* Reason + notes */}
            <Card className="border-slate-200 shadow-none">
              <div className="p-3 bg-slate-50 border-b">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Refund context</p>
              </div>
              <CardContent className="p-4 space-y-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Reason</p>
                  <p className="capitalize text-slate-800">{(refund.reason || '').replace(/_/g, ' ') || '—'}</p>
                </div>
                {refund.customer_notes && (
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Customer note</p>
                    <p className="text-slate-800 italic">&ldquo;{refund.customer_notes}&rdquo;</p>
                  </div>
                )}
                {refund.admin_notes && (
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Admin note</p>
                    <p className="text-slate-800">{refund.admin_notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Requested at</p>
                    <p className="text-slate-700">{refund.created_at ? format(new Date(refund.created_at), 'MMM d, yyyy HH:mm') : '—'}</p>
                  </div>
                  {refund.decided_at && (
                    <div>
                      <p className="text-[10px] uppercase text-slate-500">Decided at</p>
                      <p className="text-slate-700">{format(new Date(refund.decided_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [view, setView] = useState('queue'); // 'queue' (pending/approved) | 'history' (completed/rejected/failed/cancelled)
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);   // {refund, action}
  const [detailId, setDetailId] = useState(null);
  const [adminAmount, setAdminAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? {} : { status_filter: statusFilter };
      const res = await api.get('/refunds', { params });
      setRefunds(res.data.refunds || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load refunds');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Whenever the parent view toggles, reset the inner status filter to a sane default.
  useEffect(() => {
    setStatusFilter(view === 'queue' ? 'pending' : 'completed');
  }, [view]);

  const filtered = refunds.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.id || '').toLowerCase().includes(q)
      || (r.order_id || '').toLowerCase().includes(q)
      || (r.reason || '').toLowerCase().includes(q)
      || (r.customer?.name || '').toLowerCase().includes(q)
      || (r.customer?.email || '').toLowerCase().includes(q);
  });

  const openAction = (refund, action) => {
    setActioning({ refund, action });
    setAdminAmount(String(refund.requested_amount || 0));
    setAdminNotes('');
  };
  const close = () => { setActioning(null); setAdminAmount(''); setAdminNotes(''); };

  const submit = async () => {
    if (!actioning) return;
    const { refund, action } = actioning;
    setSubmitting(true);
    try {
      const payload = {
        approved_amount: action === 'approve' ? Number(adminAmount) : null,
        admin_notes: adminNotes || null,
      };
      const res = await api.post(`/refunds/${refund.id}/${action}`, payload);
      toast.success(action === 'approve'
        ? `Approved · ${res.data.status} · gateway=${res.data.gateway_refund_id || 'manual'}`
        : 'Refund rejected');
      close();
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally { setSubmitting(false); }
  };

  const totals = {
    pending: refunds.filter(r => r.status === 'pending').length,
    completed_amount: refunds.filter(r => r.status === 'completed').reduce((s, r) => s + (r.approved_amount || 0), 0),
    approved_pending_manual: refunds.filter(r => r.status === 'approved').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header — neutral slate, no more rose gradient */}
        <Card className="bg-white border-slate-200" data-testid="admin-refunds-header">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <RefreshCcw className="w-6 h-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">Refund Queue</h1>
                <p className="text-sm text-slate-500">Review customer refund requests, approve gateway refunds or flag for manual processing.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="px-3 py-1 border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-500 tracking-wider">Pending</p>
                  <p className="text-2xl font-bold text-amber-700" data-testid="stat-pending">{totals.pending}</p>
                </div>
                <div className="px-3 py-1 border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-500 tracking-wider">Manual (MoMo/Orange)</p>
                  <p className="text-2xl font-bold text-blue-700" data-testid="stat-manual">{totals.approved_pending_manual}</p>
                </div>
                <div className="px-3 py-1 border-l border-slate-200">
                  <p className="text-[10px] uppercase text-slate-500 tracking-wider">Refunded total</p>
                  <p className="text-xl font-bold text-emerald-700" data-testid="stat-refunded-total">{formatFCFA(totals.completed_amount)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs — Active queue vs History */}
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="bg-white border border-slate-200 p-1 rounded-lg">
            <TabsTrigger value="queue" data-testid="tab-queue" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Inbox className="w-4 h-4 mr-2" /> Active queue
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <History className="w-4 h-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="mt-3 border-slate-200">
            <CardContent className="p-3 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search by refund/order id, reason, customer…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9" data-testid="admin-refunds-search" />
              </div>
              <div className="flex gap-1">
                {(view === 'queue'
                  ? ['pending', 'approved']
                  : ['completed', 'rejected', 'failed', 'cancelled', 'all']
                ).map(opt => (
                  <Button
                    key={opt}
                    variant={statusFilter === opt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(opt)}
                    className={`h-9 text-xs capitalize ${statusFilter === opt ? 'bg-slate-900 hover:bg-slate-800' : ''}`}
                    data-testid={`status-chip-${opt}`}
                  >
                    {opt === 'approved' ? 'Approved (manual)' : opt}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <TabsContent value={view} className="mt-3">
            {/* Refund table */}
            <Card data-testid="admin-refunds-table" className="border-slate-200">
              {loading ? (
                <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No refunds in this view.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5">Refund</th>
                        <th className="text-left px-4 py-2.5">Customer</th>
                        <th className="text-left px-4 py-2.5">Service / Order</th>
                        <th className="text-left px-4 py-2.5">Reason</th>
                        <th className="text-right px-4 py-2.5">Requested</th>
                        <th className="text-right px-4 py-2.5">Eligible</th>
                        <th className="text-center px-4 py-2.5">Status</th>
                        <th className="text-center px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <tr
                          key={r.id}
                          className="border-b hover:bg-slate-50 cursor-pointer"
                          onClick={(e) => { if (!e.target.closest('button')) setDetailId(r.id); }}
                          data-testid={`refund-row-${r.id}`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-mono text-[11px]">{r.id.slice(0, 8)}…</p>
                            <p className="text-[10px] text-slate-500">
                              {r.created_at ? format(new Date(r.created_at), 'MMM d, HH:mm') : '—'}
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            <CustomerHoverCard customer={r.customer} />
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-xs text-slate-700 capitalize">{(r.service_type || '—').replace(/_/g, ' ')}</p>
                            <p className="font-mono text-[10px] text-slate-400">{r.order_id?.slice(0, 8)}…</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs capitalize">{(r.reason || '').replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatFCFA(r.requested_amount)}</td>
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                            {formatFCFA(r.eligible_amount)}
                            <span className="block text-[10px] text-slate-400">{r.refundable_pct}% policy</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[r.status] || ''}`}>{r.status}</Badge>
                            {r.requires_manual_processing && (
                              <p className="text-[9px] text-amber-700 mt-0.5">manual payout</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {r.status === 'pending' ? (
                              <div className="flex gap-1 justify-center">
                                <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={(e) => { e.stopPropagation(); openAction(r, 'approve'); }}
                                  data-testid={`approve-refund-${r.id}`}>
                                  <Check className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600 border-rose-200"
                                  onClick={(e) => { e.stopPropagation(); openAction(r, 'reject'); }}
                                  data-testid={`reject-refund-${r.id}`}>
                                  <X className="w-3 h-3 mr-1" /> Reject
                                </Button>
                              </div>
                            ) : r.status === 'approved' && r.requires_manual_processing ? (
                              <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
                                <AlertCircle className="w-3 h-3 mr-1" /> Payout {formatFCFA(r.approved_amount)} owed
                              </Badge>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" data-testid={`view-refund-${r.id}`}>
                                <Eye className="w-3 h-3 mr-1" /> View
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve / Reject dialog */}
      <Dialog open={!!actioning} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md bg-white" data-testid="refund-action-dialog">
          <DialogHeader>
            <DialogTitle className="capitalize text-slate-900">{actioning?.action} refund</DialogTitle>
          </DialogHeader>
          {actioning && (
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
                <p><strong>Refund:</strong> {actioning.refund.id.slice(0, 12)}…</p>
                <p><strong>Order:</strong> {actioning.refund.order_id.slice(0, 12)}…</p>
                <p><strong>Customer:</strong> {actioning.refund.customer?.name || '—'}</p>
                <p><strong>Customer requested:</strong> {formatFCFA(actioning.refund.requested_amount)}</p>
                <p><strong>Eligible per policy:</strong> {formatFCFA(actioning.refund.eligible_amount)} ({actioning.refund.refundable_pct}%)</p>
                <p><strong>Order total:</strong> {formatFCFA(actioning.refund.total_amount)}</p>
              </div>
              {actioning.action === 'approve' && (
                <div>
                  <label className="text-xs">Approved amount (FCFA)</label>
                  <Input type="number" min="0" max={actioning.refund.total_amount}
                    value={adminAmount} onChange={e => setAdminAmount(e.target.value)}
                    className="mt-1" data-testid="admin-approved-amount" />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Can grant more or less than requested. Capped at order total.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs">Admin notes</label>
                <Textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder={actioning.action === 'approve' ? 'Optional — explanation for ops' : 'Required — reason for rejection'}
                  className="mt-1" data-testid="admin-notes" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}
              className={actioning?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
              data-testid="admin-confirm-action">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</> :
               (actioning?.action === 'approve' ? 'Approve & process' : 'Reject refund')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      {detailId && <RefundDetailModal refundId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
