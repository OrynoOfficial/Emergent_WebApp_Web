import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Rows3 } from 'lucide-react';

/**
 * Tri-mode view toggle: list | grid | details.
 *   - list: compact rows (default for tables)
 *   - grid: card grid
 *   - details: rich stacked cards with expanded metadata
 *
 * Props: { value, onChange }
 */
const MODES = [
  { value: 'list', label: 'List', icon: List },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'details', label: 'Details', icon: Rows3 },
];

export default function ViewModeToggle({ value = 'list', onChange }) {
  return (
    <div
      className="inline-flex items-center gap-0 rounded-md border border-slate-200 bg-white overflow-hidden"
      role="group"
      data-testid="view-mode-toggle"
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = value === m.value;
        return (
          <Button
            key={m.value}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(m.value)}
            data-testid={`view-mode-${m.value}`}
            className={`h-9 rounded-none border-r last:border-r-0 border-slate-200 px-3 ${
              active
                ? 'bg-[#082c59] text-white hover:bg-[#082c59] hover:text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            aria-pressed={active}
            title={m.label}
          >
            <Icon className="h-4 w-4" />
            <span className="ml-1.5 hidden md:inline text-xs">{m.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
