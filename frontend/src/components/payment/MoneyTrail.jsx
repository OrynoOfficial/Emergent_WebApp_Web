import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ArrowDownCircle,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatFCFA } from '@/utils/currency';
import { formatDateTime } from '@/utils/dateUtils';
import api from '@/api/client';

/**
 * Money Trail — the customer-trust + finance-triage view of a payment.
 *
 * Renders the immutable ledger from `/api/v2/payments/by-order/{order_id}/timeline`
 * as a vertical stepper. Each event is one row in the underlying append-only
 * `payment_events` collection — webhook deliveries, manual refunds, and
 * disputes all surface here in chronological order.
 *
 * Why a derived snapshot AND a timeline?
 *   - The snapshot (top card) is what business logic reads day-to-day.
 *   - The timeline (stepper) is what auditors / disputes / customer-success need.
 */

// Visual identity for each ledger event type. Kept small & high-contrast.
const EVENT_META = {
  intent_created: { Icon: Clock, color: 'text-slate-500 bg-slate-100', label: 'Payment initiated' },
  authorized: { Icon: ShieldCheck, color: 'text-blue-600 bg-blue-50', label: 'Authorized' },
  captured: { Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', label: 'Captured' },
  failed: { Icon: XCircle, color: 'text-rose-600 bg-rose-50', label: 'Failed' },
  voided: { Icon: AlertCircle, color: 'text-amber-600 bg-amber-50', label: 'Voided' },
  refunded: { Icon: ArrowDownCircle, color: 'text-purple-600 bg-purple-50', label: 'Refunded' },
  disputed: { Icon: ShieldAlert, color: 'text-orange-600 bg-orange-50', label: 'Disputed' },
  dispute_resolved: { Icon: ShieldCheck, color: 'text-teal-600 bg-teal-50', label: 'Dispute resolved' },
};

const STATE_COLOR = {
  pending: 'bg-slate-100 text-slate-700',
  authorized: 'bg-blue-100 text-blue-700',
  captured: 'bg-emerald-100 text-emerald-700',
  partially_refunded: 'bg-purple-100 text-purple-700',
  refunded: 'bg-purple-100 text-purple-700',
  failed: 'bg-rose-100 text-rose-700',
  voided: 'bg-amber-100 text-amber-700',
  disputed: 'bg-orange-100 text-orange-700',
  dispute_lost: 'bg-rose-100 text-rose-700',
};

function ProviderBadge({ provider }) {
  if (!provider) return null;
  const labels = {
    stripe: 'Stripe',
    mtn_momo: 'MTN MoMo',
    orange_money: 'Orange Money',
  };
  return (
    <Badge variant="outline" className="text-[10px] font-medium">
      <Wallet className="w-3 h-3 mr-1" /> {labels[provider] || provider}
    </Badge>
  );
}

export default function MoneyTrail({ orderId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ events: [], snapshot: null, payment_id: null });

  const load = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/v2/payments/by-order/${encodeURIComponent(orderId)}/timeline`);
      setData(res.data || { events: [], snapshot: null, payment_id: null });
    } catch (err) {
      // Non-fatal — a brand new order with no payment yet returns 404 from
      // the snapshot endpoint, which is expected.
      if (err?.response?.status === 404) {
        setData({ events: [], snapshot: null, payment_id: null });
      } else {
        setError(err?.response?.data?.detail || err.message || 'Could not load timeline');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-slate-500" data-testid="money-trail-loading">
        Loading payment timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3" data-testid="money-trail-error">
        {error}
        <Button variant="ghost" size="sm" className="ml-2" onClick={load}>
          <RotateCcw className="w-3 h-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (!data.payment_id || data.events.length === 0) {
    return (
      <div className="text-sm text-slate-500 bg-slate-50 rounded-md p-4 text-center" data-testid="money-trail-empty">
        <Wallet className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        No payment has been initiated yet for this order. Once the customer pays,
        every step (initiated → authorized → captured → refunded) will be recorded here.
      </div>
    );
  }

  const { snapshot, events } = data;
  return (
    <div className="space-y-4" data-testid="money-trail">
      {/* Snapshot card — the derived current state. Reads like a finance
          dashboard: hero state pill + three numbers (captured/refunded/net)
          on dedicated cards instead of a flat grid. */}
      {snapshot && (() => {
        const StateIcon = (EVENT_META[snapshot.state]?.Icon) ||
          (snapshot.state === 'captured' ? CheckCircle2 :
           snapshot.state === 'refunded' || snapshot.state === 'partially_refunded' ? ArrowDownCircle :
           snapshot.state === 'failed' ? XCircle :
           snapshot.state === 'authorized' ? ShieldCheck :
           snapshot.state === 'disputed' ? ShieldAlert : Clock);
        const stateColor = STATE_COLOR[snapshot.state] || 'bg-slate-100 text-slate-700';
        return (
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="money-trail-snapshot">
            {/* Header strip — large state, refresh button on the right */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${stateColor} ring-2 ring-white/40`}>
                  <StateIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/60 font-semibold">Current state</p>
                  <p className="text-sm font-bold text-white capitalize">{String(snapshot.state).replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <ProviderBadge provider={snapshot.provider} />
                  {snapshot.in_dispute && (
                    <Badge className="bg-orange-200 text-orange-800 border-0 text-[10px]">In dispute</Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={load} data-testid="money-trail-refresh" className="text-white/70 hover:text-white hover:bg-white/10">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {/* Three KPI cards */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
              <div className="px-4 py-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Captured</div>
                <div className="font-bold text-emerald-700 text-base mt-0.5">{formatFCFA(snapshot.captured_amount || 0)}</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Refunded</div>
                <div className="font-bold text-purple-700 text-base mt-0.5">{formatFCFA(snapshot.refunded_amount || 0)}</div>
              </div>
              <div className="px-4 py-3 text-center bg-slate-50">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">Net</div>
                <div className="font-bold text-slate-900 text-base mt-0.5">{formatFCFA(snapshot.net_amount || 0)}</div>
              </div>
            </div>
            {/* Payment id footer */}
            <div className="bg-slate-50 px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider">
              payment_id · <span className="font-mono normal-case text-slate-500">{data.payment_id}</span>
            </div>
          </div>
        );
      })()}

      {/* Vertical stepper — each event in chronological order */}
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-2 px-1">
          Timeline · {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
        {/* Connector line */}
        <div className="absolute left-[15px] top-7 bottom-2 w-[2px] bg-slate-200" aria-hidden />
        <ol className="space-y-3">
          {events.map((ev, idx) => {
            const meta = EVENT_META[ev.event_type] || { Icon: Clock, color: 'text-slate-500 bg-slate-100', label: ev.event_type };
            const Icon = meta.Icon;
            const isLast = idx === events.length - 1;
            return (
              <li key={ev.id || idx} className="relative flex gap-3" data-testid={`money-trail-event-${ev.event_type}`}>
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color} ring-2 ring-white`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`flex-1 ${isLast ? '' : 'pb-1'}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="font-medium text-sm text-slate-800">{meta.label}</div>
                    <div className="flex items-center gap-1.5">
                      {ev.amount != null && ev.amount !== 0 && (
                        <Badge variant="outline" className="text-[11px]">
                          {formatFCFA(ev.amount)} {ev.currency || ''}
                        </Badge>
                      )}
                      <ProviderBadge provider={ev.provider} />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ev.occurred_at ? formatDateTime(ev.occurred_at) : ''}
                  </div>
                  {/* Reason / source hints from payload */}
                  {ev.payload?.reason && (
                    <div className="text-[11px] text-slate-600 mt-0.5 italic">“{ev.payload.reason}”</div>
                  )}
                  {ev.payload?.initiated_by && (
                    <div className="text-[11px] text-slate-500 mt-0.5">by {ev.payload.initiated_by}</div>
                  )}
                  {ev.payload?.source && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      source: {String(ev.payload.source).replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
