/**
 * Tri-mode view toggle: list | grid | details.
 *   - list: compact rows (default for tables)
 *   - grid: card grid
 *   - details: rich stacked cards with expanded metadata
 *
 * Icon-only layout with Radix tooltips (iter 254) — text labels eat too much
 * room in dense management headers. Labels are still accessible via
 * `aria-pressed` + tooltip + screen-reader-friendly aria-label.
 *
 * Props: { value, onChange }
 */
import React from 'react';
import { LayoutGrid, List, Rows3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const MODES = [
  { value: 'list',    label: 'List view',    icon: List },
  { value: 'grid',    label: 'Grid view',    icon: LayoutGrid },
  { value: 'details', label: 'Details view', icon: Rows3 },
];

export default function ViewModeToggle({ value = 'list', onChange }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="inline-flex items-center rounded-md border border-slate-200 bg-white overflow-hidden"
        role="group"
        aria-label="View mode"
        data-testid="view-mode-toggle"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = value === m.value;
          return (
            <Tooltip key={m.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(m.value)}
                  aria-label={m.label}
                  aria-pressed={active}
                  data-testid={`view-mode-${m.value}`}
                  className={`h-9 w-9 inline-flex items-center justify-center border-r last:border-r-0 border-slate-200 transition-colors ${
                    active
                      ? 'bg-[#082c59] text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="text-xs font-medium">
                {m.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
