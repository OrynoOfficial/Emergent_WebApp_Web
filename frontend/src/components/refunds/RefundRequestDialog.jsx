// Customer-side "Request a refund" dialog opened from OrderDetailModal.
// Calls /api/refunds/orders/{id}/eligibility first to display the policy
// schedule + expected amount, then POST /request on submit.
//
// The dialog is intentionally rich: it explains the policy schedule so
// customers understand WHY they're getting 100% / 50% / 0% before they
// type a single character. This dramatically reduces support tickets.
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Loader2, RefreshCcw, AlertTriangle, CheckCircle2, Clock, Receipt,
  Calendar, ShieldCheck, Info,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const REASONS = [
  { value: 'change_of_plans',  label: 'Change of plans' },
  { value: 'event_cancelled',  label: 'Event/service was cancelled' },
  { value: 'service_issue',    label: 'Service quality issue' },
  { value: 'duplicate_booking', label: 'Duplicate booking' },
  { value: 'other',            label: 'Other' },
];

const SERVICE_LABEL = {
  event: 'Event', events: 'Event', cinema: 'Cinema', travel: 'Travel',
  transport: 'Travel', hotel: 'Hotel', restaurant: 'Restaurant',
  car_rental: 'Car rental', banquet: 'Banquet', laundry: 'Laundry',
  pressing: 'Laundry', package: 'Package',
};

function formatHours(hrs) {
  if (hrs == null) return '—';
  if (hrs < 0) return 'Already passed';
  if (hrs < 1) return `${Math.round(hrs * 60)} min`;
  if (hrs < 48) return `${Math.round(hrs)}h`;
  return `${Math.round(hrs / 24)} days`;
}

function formatServiceDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function RefundRequestDialog({ open, onOpenChange, order, onSubmitted }) {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('change_of_plans');
  const [customerNotes, setCustomerNotes] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');

  useEffect(() => {
    if (!open || !order) return;
    setLoading(true);
    setEligibility(null);
    api.get(`/refunds/orders/${order._id || order.id}/eligibility`)
      .then(r => {
        setEligibility(r.data);
        setRequestedAmount(String(r.data.eligible_amount || 0));
      })
      .catch(err => toast.error(err.response?.data?.detail || 'Could not check eligibility'))
      .finally(() => setLoading(false));
  }, [open, order]);

  const submit = async () => {
    if (!reason) { toast.error('Pick a reason'); return; }
    setSubmitting(true);
    try {
      const res = await api.post(`/refunds/orders/${order._id || order.id}/request`, {
        reason,
        customer_notes: customerNotes || null,
        requested_amount: requestedAmount ? Number(requestedAmount) : null,
      });
      toast.success(res.data.message || 'Refund request submitted — admin will review');
      onSubmitted?.(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit refund');
    } finally { setSubmitting(false); }
  };

  // Themed status colors based on refundable %.
  const status = useMemo(() => {
    if (!eligibility) return null;
    const pct = eligibility.refundable_pct ?? 0;
    if (eligibility.operator_initiated) {
      return { tone: 'emerald', label: 'Operator-cancelled — full refund' };
    }
    if (pct >= 100) return { tone: 'emerald', label: 'Fully refundable' };
    if (pct > 0) return { tone: 'amber', label: `${pct}% refundable` };
    return { tone: 'rose', label: 'Not auto-refundable' };
  }, [eligibility]);

  // "Custom policy" attribution — surfaced as a small badge below the
  // policy table when an operator or listing override is in effect.
  const policySourceBadge = useMemo(() => {
    const src = eligibility?.policy_source;
    if (!src || src === 'platform') return null;
    return src === 'listing'
      ? { label: 'Custom policy for this listing', tone: 'blue' }
      : { label: 'Custom operator policy', tone: 'purple' };
  }, [eligibility]);

  const toneClasses = {
    emerald: {
      ring: 'bg-emerald-50 border-emerald-200',
      icon: 'text-emerald-600', text: 'text-emerald-900', pill: 'bg-emerald-100 text-emerald-700',
    },
    amber: {
      ring: 'bg-amber-50 border-amber-200',
      icon: 'text-amber-600', text: 'text-amber-900', pill: 'bg-amber-100 text-amber-700',
    },
    rose: {
      ring: 'bg-rose-50 border-rose-200',
      icon: 'text-rose-600', text: 'text-rose-900', pill: 'bg-rose-100 text-rose-700',
    },
  };
  const T = status ? toneClasses[status.tone] : null;

  const serviceName = order?.service_name || order?.title || (SERVICE_LABEL[(eligibility?.service_type || '').toLowerCase()] || 'Booking');
  const totalPaid = eligibility?.total_paid ?? order?.total_amount ?? 0;
  const serviceDateFormatted = formatServiceDate(eligibility?.service_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-0 overflow-hidden" data-testid="refund-request-dialog">
        {/* Themed header — colour follows refundability */}
        <DialogHeader className={cn(
          'px-6 py-4 border-b',
          T ? T.ring : 'bg-slate-50 border-slate-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', T ? 'bg-white shadow-sm' : 'bg-white shadow-sm')}>
              <RefreshCcw className={cn('w-5 h-5', T ? T.icon : 'text-slate-600')} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className={cn('text-base font-semibold', T ? T.text : 'text-slate-900')}>
                Request a refund
              </DialogTitle>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                {serviceName} {order?.order_number ? `· #${order.order_number}` : ''}
              </p>
            </div>
            {status && (
              <Badge className={cn('text-[11px] font-semibold whitespace-nowrap', T.pill)}>
                {status.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p className="text-xs text-slate-500 mt-2">Checking eligibility…</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Money trail — what you paid → what you can recover */}
            {eligibility && (
              <div className="grid grid-cols-3 gap-2 text-center" data-testid="refund-money-trail">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    <Receipt className="w-3 h-3" /> Paid
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatFCFA(totalPaid)}</p>
                </div>
                <div className={cn(
                  'rounded-xl border p-3',
                  status?.tone === 'rose' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                )}>
                  <div className={cn(
                    'flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider mb-1',
                    status?.tone === 'rose' ? 'text-rose-600' : 'text-emerald-600'
                  )}>
                    <ShieldCheck className="w-3 h-3" /> Refundable
                  </div>
                  <p className={cn(
                    'text-sm font-bold',
                    status?.tone === 'rose' ? 'text-rose-700' : 'text-emerald-700'
                  )}>
                    {formatFCFA(eligibility.eligible_amount || 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    <Clock className="w-3 h-3" /> Until service
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatHours(eligibility.hours_until_service)}</p>
                </div>
              </div>
            )}

            {/* Service-date context line */}
            {serviceDateFormatted && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span><span className="font-medium text-slate-700">Service scheduled for</span> · {serviceDateFormatted}</span>
              </div>
            )}

            {/* Policy schedule — annotated with active tier highlighted */}
            {eligibility?.policy?.length > 0 && (
              <div data-testid="refund-policy-table">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Refund policy {eligibility.service_type ? `(${SERVICE_LABEL[eligibility.service_type] || eligibility.service_type})` : ''}
                  </p>
                  {policySourceBadge && (
                    <Badge className={cn(
                      'text-[10px] font-semibold ml-auto',
                      policySourceBadge.tone === 'purple' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                    )}>
                      {policySourceBadge.label}
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white">
                  {eligibility.policy.map((tier, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 text-xs transition-colors',
                        tier.active ? 'bg-slate-900 text-white font-semibold' : 'bg-white text-slate-600'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {tier.active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {tier.threshold}
                      </span>
                      <span className={cn(
                        'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold',
                        tier.active
                          ? 'bg-white text-slate-900'
                          : tier.refund_pct >= 100
                          ? 'bg-emerald-100 text-emerald-700'
                          : tier.refund_pct > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      )}>
                        {tier.refund_pct}%
                      </span>
                    </div>
                  ))}
                </div>
                {/* Heads-up for non-refundable case */}
                {eligibility && !eligibility.eligible && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <p>
                      You&apos;re outside the policy window — refund is <span className="font-semibold">not automatic</span>.
                      Submit anyway and an admin can still grant a goodwill refund based on your reason.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Reason + notes */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-700 font-medium">Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="mt-1.5" data-testid="refund-reason-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-700 font-medium">Notes <span className="text-slate-400 font-normal">(optional but recommended)</span></Label>
                <Textarea rows={3} value={customerNotes}
                  onChange={e => setCustomerNotes(e.target.value)}
                  placeholder="A short explanation helps speed up admin review…"
                  className="mt-1.5"
                  data-testid="refund-notes-input" />
              </div>
              {eligibility?.eligible && (
                <div>
                  <Label className="text-xs text-slate-700 font-medium">
                    Amount to request (FCFA)
                    <span className="text-slate-400 font-normal"> · max {formatFCFA(eligibility.eligible_amount)}</span>
                  </Label>
                  <Input type="number" min="0" max={eligibility.eligible_amount}
                    value={requestedAmount}
                    onChange={e => setRequestedAmount(e.target.value)}
                    className="mt-1.5"
                    data-testid="refund-amount-input" />
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 leading-snug">
              Refunds are reviewed by an admin (typically within 2 business days). Approved refunds are credited back
              to the original payment method.
            </p>
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="refund-cancel-btn">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
            data-testid="refund-submit-btn">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              <>Submit refund request</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
