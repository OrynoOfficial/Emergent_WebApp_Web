/**
 * FilterChipSelect — icon-first compact select for filter pills like
 * "All Status", "All Services", "All Categories", "All Time".
 *
 * Why: full-width <Select> dropdowns eat 160-200 px each. On dense
 * management pages with 4-5 of them, half the row is filters. This chip
 * shrinks to a single icon button (32 px) when nothing is selected, and
 * expands to icon + short label when a non-default value is active.
 *
 * Props
 *   icon: lucide icon component (e.g. Tag, Clock, ListFilter)
 *   label: human label for the *category* — used in tooltip and popover title
 *   value: current value (use 'all' or '' for "no filter")
 *   onChange: (newValue) => void
 *   options: [{value, label, icon?}]  — `value === 'all'` is the reset row
 *   placeholder: short text when no filter is set (default: 'All')
 *   allValue: which value represents "no filter" (default: 'all')
 */
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FilterChipSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
  placeholder = 'All',
  allValue = 'all',
  align = 'start',
  'data-testid': testId,
  className,
}) {
  const isActive = value && value !== allValue;
  const activeOption = options.find(o => o.value === value);

  return (
    <TooltipProvider delayDuration={200}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={label}
                data-testid={testId || `filter-${label.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 rounded-lg border transition-colors text-xs font-medium shrink-0',
                  isActive
                    ? 'bg-[#082c59] border-[#082c59] text-white px-2.5 hover:bg-[#0a3a75]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 w-8 px-0 justify-center',
                  className,
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                {isActive && (
                  <>
                    <span className="capitalize whitespace-nowrap max-w-[120px] truncate">
                      {activeOption?.label || String(value)}
                    </span>
                  </>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-xs">
            {isActive ? `${label}: ${activeOption?.label || value}` : label}
          </TooltipContent>
        </Tooltip>

        <PopoverContent align={align} className="w-56 p-1.5 bg-white border-slate-200 shadow-lg">
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <div className="max-h-80 overflow-y-auto">
            {options.map(opt => {
              const OptIcon = opt.icon;
              const selected = opt.value === value || (opt.value === allValue && (!value || value === allValue));
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                    selected
                      ? 'bg-[#082c59]/10 text-[#082c59] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                  data-testid={`filter-option-${opt.value}`}
                >
                  {OptIcon && <OptIcon className="h-3.5 w-3.5 shrink-0" />}
                  <span className="flex-1 capitalize">{opt.label}</span>
                  {selected && <Check className="h-3.5 w-3.5 text-[#082c59]" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
