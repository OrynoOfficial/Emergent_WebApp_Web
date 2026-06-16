// Customer-side "Request a refund" dialog opened from OrderDetailModal.
// Calls /api/refunds/orders/{id}/eligibility first to display the policy
// window + expected amount, then POST /request on submit.
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';

const REASONS = [
  { value: 'change_of_plans',  label: 'Change of plans' },
  { value: 'event_cancelled',  label: 'Event was cancelled' },
  { value: 'service_issue',    label: 'Service quality issue' },
  { value: 'duplicate_booking', label: 'Duplicate booking' },
  { value: 'other',            label: 'Other' },
];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" data-testid="refund-request-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <RefreshCcw className="w-5 h-5" /> Request a refund
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400" />
            <p className="text-xs text-slate-500 mt-2">Checking eligibility…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Eligibility badge */}
            {eligibility && (
              <div className={`rounded-lg p-3 border ${
                eligibility.eligible ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`} data-testid="refund-eligibility-banner">
                <div className="flex items-center gap-2 mb-1">
                  {eligibility.eligible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <p className="text-sm font-bold text-slate-900">
                    {eligibility.eligible ? `${eligibility.refundable_pct}% refundable` : 'Not auto-refundable'}
                  </p>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    Up to {formatFCFA(eligibility.eligible_amount)}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-600">{eligibility.window}</p>
                {!eligibility.eligible && (
                  <p className="text-[10px] text-rose-700 mt-1.5">
                    You can still submit — an admin may grant a refund at their discretion.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1" data-testid="refund-reason-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea rows={3} value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
                placeholder="Anything the admin should know…"
                className="mt-1"
                data-testid="refund-notes-input" />
            </div>
            {eligibility?.eligible && (
              <div>
                <Label className="text-xs">Amount to request (FCFA)</Label>
                <Input type="number" min="0" max={eligibility.eligible_amount}
                  value={requestedAmount}
                  onChange={e => setRequestedAmount(e.target.value)}
                  className="mt-1"
                  data-testid="refund-amount-input" />
                <p className="text-[10px] text-slate-500 mt-1">Max {formatFCFA(eligibility.eligible_amount)} per policy.</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
            data-testid="refund-submit-btn">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : 'Submit refund request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
