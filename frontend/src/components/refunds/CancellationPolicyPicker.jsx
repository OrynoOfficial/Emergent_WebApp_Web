// Reusable cancellation-policy picker.
//
// Renders 3 preset cards (Strict / Standard / Flexible) with a brief preview
// of each schedule + a "Use platform default" reset chip. Custom tier
// authoring is intentionally left out of this iteration — the 3 presets
// cover ~95% of real operator needs and the backend supports `custom` for
// programmatic API access by advanced ops on enterprise plans.
//
// Usage:
//   <CancellationPolicyPicker
//     serviceType="hotel"
//     value={policy}                        // {preset:"strict"} | null
//     onChange={setPolicy}
//     scope="listing"                       // "listing" or "operator"
//   />
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Sparkles, Zap, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/api/client';
import { cn } from '@/lib/utils';

const PRESET_META = {
  strict:   { icon: Shield,    accent: 'rose',    tagline: 'Lock-in for high-stakes services' },
  standard: { icon: Sparkles,  accent: 'blue',    tagline: 'Balanced — the platform default' },
  flexible: { icon: Zap,       accent: 'emerald', tagline: 'Customer-friendly, last-minute OK' },
};

const accentClasses = {
  rose:    'border-rose-200 bg-rose-50 hover:border-rose-300',
  blue:    'border-blue-200 bg-blue-50 hover:border-blue-300',
  emerald: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
};
const selectedAccent = {
  rose:    'ring-2 ring-rose-500 border-rose-500 bg-rose-100',
  blue:    'ring-2 ring-blue-500 border-blue-500 bg-blue-100',
  emerald: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-100',
};

export default function CancellationPolicyPicker({ serviceType, value, onChange, scope = 'listing', compact = false }) {
  const [presets, setPresets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/refunds/presets?service_type=${serviceType}`)
      .then(r => { if (alive) setPresets(r.data.presets || {}); })
      .catch(() => { if (alive) setPresets({}); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [serviceType]);

  const activePreset = value?.preset || null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading policies…
      </div>
    );
  }

  if (!presets || Object.keys(presets).length === 0) {
    return <p className="text-xs text-slate-500">No policy presets available for {serviceType}.</p>;
  }

  return (
    <div className="space-y-3" data-testid={`cancellation-policy-picker-${serviceType}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {scope === 'listing'
            ? 'Override the operator-level default for this specific listing.'
            : 'Default refund policy applied to all your listings (each listing can override).'}
        </p>
        {activePreset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="h-7 text-[11px] text-slate-500 hover:text-slate-900"
            data-testid="policy-reset-btn"
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Reset to {scope === 'listing' ? 'operator default' : 'platform default'}
          </Button>
        )}
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'sm:grid-cols-3 grid-cols-1')}>
        {['strict', 'standard', 'flexible'].map(key => {
          const preset = presets[key];
          if (!preset) return null;
          const meta = PRESET_META[key];
          const Icon = meta.icon;
          const isActive = activePreset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ preset: key })}
              data-testid={`policy-preset-${key}`}
              className={cn(
                'text-left p-3 rounded-xl border-2 transition-all',
                isActive ? selectedAccent[meta.accent] : `${accentClasses[meta.accent]} hover:shadow-sm`
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('w-4 h-4', `text-${meta.accent}-600`)} />
                  <span className="font-semibold text-sm text-slate-900">{preset.label}</span>
                </div>
                {isActive && <CheckCircle2 className={cn('w-4 h-4', `text-${meta.accent}-600`)} />}
              </div>
              <p className="text-[10px] text-slate-500 mb-2 leading-tight">{meta.tagline}</p>
              <div className="space-y-0.5">
                {preset.tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-600 truncate pr-1">{t.label}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-4 px-1.5 text-[9px] font-semibold shrink-0',
                        t.refund_pct >= 100 ? 'border-emerald-300 text-emerald-700' :
                        t.refund_pct > 0    ? 'border-amber-300 text-amber-700' :
                                              'border-rose-300 text-rose-700'
                      )}
                    >
                      {t.refund_pct}%
                    </Badge>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
