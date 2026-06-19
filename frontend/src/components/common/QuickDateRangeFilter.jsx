import React, { useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns';

/**
 * Reusable quick date-range selector used across Receipts / Orders / Bills / Reports.
 *
 * Presets:
 *   all, today, yesterday, last_3_days, last_7_days, last_30_days,
 *   this_month, last_month, this_year, custom
 *
 * Value shape: { preset: string, from: Date|null, to: Date|null }
 *   - Parent should use `from`/`to` for filtering
 *   - `preset` controls button label
 */
export const PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_3_days', label: 'Last 3 Days' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function computeRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'last_3_days':
      return { from: startOfDay(subDays(now, 2)), to: endOfDay(now) };
    case 'last_7_days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last_30_days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case 'this_year':
      return { from: startOfYear(now), to: endOfDay(now) };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/**
 * Checks whether an ISO/date value falls inside { from, to } (inclusive, null-friendly).
 */
export function inRange(dateLike, from, to) {
  if (!from && !to) return true;
  if (!dateLike) return false;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export default function QuickDateRangeFilter({ value, onChange, className = '' }) {
  const preset = value?.preset || 'all';
  const from = value?.from || null;
  const to = value?.to || null;

  const label = useMemo(() => {
    if (preset === 'custom') {
      if (from && to) return `${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`;
      if (from) return `From ${format(from, 'MMM d, yyyy')}`;
      if (to) return `Until ${format(to, 'MMM d, yyyy')}`;
      return 'Custom';
    }
    return PRESETS.find((p) => p.value === preset)?.label || 'All Time';
  }, [preset, from, to]);

  const handlePreset = (p) => {
    if (p === 'custom') {
      onChange({ preset: 'custom', from: from || startOfDay(new Date()), to: to || endOfDay(new Date()) });
    } else {
      onChange({ preset: p, ...computeRange(p) });
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={preset === 'all' ? 'Date range' : `Date range: ${label}`}
                className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors text-xs font-medium shrink-0 ${
                  preset !== 'all'
                    ? 'bg-[#082c59] border-[#082c59] text-white h-8 px-2.5 hover:bg-[#0a3a75]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 h-8 w-8 px-0 justify-center'
                } ${className}`}
                data-testid="quick-date-range-trigger"
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                {preset !== 'all' && (
                  <span className="capitalize whitespace-nowrap max-w-[160px] truncate">{label}</span>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-xs">
            {preset === 'all' ? 'Date range' : `Date range: ${label}`}
          </TooltipContent>
        </Tooltip>
      <PopoverContent className="w-auto p-0 bg-white" align="start">
        <div className="flex">
          {/* Preset list */}
          <div className="w-40 border-r border-slate-100 p-2 space-y-0.5">
            {PRESETS.map((p) => {
              const active = preset === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => handlePreset(p.value)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    active ? 'bg-[#082c59] text-white font-medium' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  data-testid={`date-preset-${p.value}`}
                >
                  {p.label}
                </button>
              );
            })}
            {preset !== 'all' && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => onChange({ preset: 'all', from: null, to: null })}
                  className="w-full text-left px-3 py-1.5 rounded text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  data-testid="date-preset-clear"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              </>
            )}
          </div>

          {/* Calendar for custom */}
          {preset === 'custom' && (
            <div className="p-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">From</div>
                  <Calendar
                    mode="single"
                    selected={from}
                    onSelect={(d) => onChange({ preset: 'custom', from: d ? startOfDay(d) : null, to })}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">To</div>
                  <Calendar
                    mode="single"
                    selected={to}
                    onSelect={(d) => onChange({ preset: 'custom', from, to: d ? endOfDay(d) : null })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
    </TooltipProvider>
  );
}
