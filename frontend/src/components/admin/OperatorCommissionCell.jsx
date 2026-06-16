// Per-operator commission preview — shows the effective rate the platform
// will apply to bookings on this operator, resolved via the standard
// hierarchy (operator > category > global > 5% fallback).
//
// Hovering surfaces a per-service-type breakdown so admins can spot when an
// operator inherits the global default vs has an explicit override.
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Percent } from 'lucide-react';
import api from '@/api/client';

const SOURCE_TINT = {
  operator: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  category: 'bg-sky-100 text-sky-800 border-sky-200',
  global:   'bg-violet-100 text-violet-800 border-violet-200',
  fallback: 'bg-slate-100 text-slate-600 border-slate-300',
};

const SOURCE_LABEL = {
  operator: 'Operator override',
  category: 'Category default',
  global:   'Global default',
  fallback: 'Platform fallback',
};

export default function OperatorCommissionCell({ operatorId, serviceTypes = [] }) {
  const [rates, setRates] = useState([]); // { service_type, rate, source }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!operatorId || serviceTypes.length === 0) return;
    let cancelled = false;
    setLoading(true);
    // Fetch the effective rate for each service the operator offers — the
    // resolve endpoint caches operator-keyed configs so this is cheap.
    Promise.all(
      serviceTypes.map((st) =>
        api.get('/commission-config/resolve', { params: { service_type: st, operator_id: operatorId } })
          .then((r) => ({ service_type: st, rate: r.data?.rate ?? 5, source: r.data?.source ?? 'fallback' }))
          .catch(() => ({ service_type: st, rate: 5, source: 'fallback' })),
      ),
    ).then((res) => {
      if (cancelled) return;
      setRates(res);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [operatorId, JSON.stringify(serviceTypes)]);

  if (loading) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" data-testid={`commission-loading-${operatorId}`} />;
  }
  if (rates.length === 0) {
    return <span className="text-[10px] text-slate-400 italic">—</span>;
  }
  // Pick the most "specific" rate to surface — operator > category > global > fallback.
  const PRIORITY = ['operator', 'category', 'global', 'fallback'];
  const summary = [...rates].sort(
    (a, b) => PRIORITY.indexOf(a.source) - PRIORITY.indexOf(b.source),
  )[0];
  const range =
    rates.length > 1 && !rates.every((r) => r.rate === rates[0].rate)
      ? ` · ${Math.min(...rates.map(r => r.rate))}–${Math.max(...rates.map(r => r.rate))}%`
      : '';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5"
            data-testid={`commission-cell-${operatorId}`}
          >
            <Percent className="w-3 h-3 text-slate-500" />
            <span className="font-bold text-sm text-slate-900 tabular-nums">{summary.rate}%</span>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${SOURCE_TINT[summary.source] || ''}`}>
              {summary.source}
            </Badge>
            {range && <span className="text-[10px] text-slate-400">{range}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-white text-slate-900 border shadow-xl rounded-xl p-3 max-w-xs">
          <p className="text-[10px] uppercase font-semibold text-slate-500 mb-2 tracking-wide">Effective rates by service</p>
          <div className="space-y-1.5">
            {rates.map((r) => (
              <div key={r.service_type} className="flex items-center justify-between gap-3 text-xs">
                <span className="capitalize text-slate-700">{r.service_type.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{r.rate}%</span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${SOURCE_TINT[r.source] || ''}`}>
                    {SOURCE_LABEL[r.source] || r.source}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
            Resolution order: operator → category → global → 5% fallback.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
