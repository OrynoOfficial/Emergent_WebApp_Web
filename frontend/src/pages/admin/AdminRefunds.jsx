// Admin refund queue — listed under /admin/refunds. Lets admins approve or
// reject pending refunds. Approval triggers Stripe refund (if card payment)
// or marks for manual processing (MoMo / Orange / cash), then restores the
// booking stock.
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCcw, Check, X, Loader2, Search, Inbox, AlertCircle } from 'lucide-react';
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

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);   // {refund, action}
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

  const filtered = refunds.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.id || '').toLowerCase().includes(q)
      || (r.order_id || '').toLowerCase().includes(q)
      || (r.reason || '').toLowerCase().includes(q);
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
        {/* Header */}
        <Card className="bg-gradient-to-r from-rose-600 to-pink-600 text-white border-transparent" data-testid="admin-refunds-header">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 rounded-lg flex items-center justify-center">
                <RefreshCcw className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold">Refund Queue</h1>
                <p className="text-sm text-white/85">Review customer refund requests, approve gateway refunds or flag for manual processing.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] uppercase opacity-80">Pending</p>
                  <p className="text-2xl font-bold" data-testid="stat-pending">{totals.pending}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-80">Manual (MoMo/Orange)</p>
                  <p className="text-2xl font-bold" data-testid="stat-manual">{totals.approved_pending_manual}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-80">Refunded total</p>
                  <p className="text-xl font-bold" data-testid="stat-refunded-total">{formatFCFA(totals.completed_amount)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search by refund/order id or reason…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9" data-testid="admin-refunds-search" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9" data-testid="admin-refunds-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved (manual)</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Refund table */}
        <Card data-testid="admin-refunds-table">
          {loading ? (
            <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400" /></div>
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
                    <th className="text-left px-4 py-2.5">Order</th>
                    <th className="text-left px-4 py-2.5">Reason</th>
                    <th className="text-right px-4 py-2.5">Requested</th>
                    <th className="text-right px-4 py-2.5">Eligible</th>
                    <th className="text-center px-4 py-2.5">Status</th>
                    <th className="text-center px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-slate-50" data-testid={`refund-row-${r.id}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-[11px]">{r.id.slice(0, 8)}…</p>
                        <p className="text-[10px] text-slate-500">
                          {r.created_at ? format(new Date(r.created_at), 'MMM d, HH:mm') : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-[11px]">{r.order_id.slice(0, 8)}…</p>
                        <p className="text-[10px] text-slate-500 capitalize">{r.service_type || '—'}</p>
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
                              onClick={() => openAction(r, 'approve')}
                              data-testid={`approve-refund-${r.id}`}>
                              <Check className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600 border-rose-200"
                              onClick={() => openAction(r, 'reject')}
                              data-testid={`reject-refund-${r.id}`}>
                              <X className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : r.status === 'approved' && r.requires_manual_processing ? (
                          <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
                            <AlertCircle className="w-3 h-3 mr-1" /> Payout {formatFCFA(r.approved_amount)} owed
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Approve / Reject dialog */}
      <Dialog open={!!actioning} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md bg-white" data-testid="refund-action-dialog">
          <DialogHeader>
            <DialogTitle className="capitalize">{actioning?.action} refund</DialogTitle>
          </DialogHeader>
          {actioning && (
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
                <p><strong>Refund:</strong> {actioning.refund.id.slice(0, 12)}…</p>
                <p><strong>Order:</strong> {actioning.refund.order_id.slice(0, 12)}…</p>
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
    </div>
  );
}
