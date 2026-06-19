/**
 * OperatorScopeFilter — admin scope selector, now icon-first (iter 256).
 *
 * Renders as a compact 32-px building-icon chip when no operator is picked,
 * and expands to icon + operator-name pill when one is selected. Click opens
 * a searchable popover.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';

export default function OperatorScopeFilter({ serviceType, onChange, value = '' }) {
  const { user } = useAuth();
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (!isAdmin) return;
    const params = serviceType ? `?service_type=${serviceType}` : '';
    api.get(`/operators/by-service${params}`)
      .then(r => setOperators(r.data.operators || []))
      .catch(() => setOperators([]));
  }, [isAdmin, serviceType]);

  const filtered = useMemo(() => {
    if (!search) return operators;
    const q = search.toLowerCase();
    return operators.filter(op => op.name.toLowerCase().includes(q));
  }, [operators, search]);

  const selectedName = useMemo(() => {
    if (!value) return null;
    return operators.find(op => op.id === value)?.name;
  }, [value, operators]);

  if (!isAdmin || operators.length === 0) return null;
  const isActive = !!value;

  return (
    <TooltipProvider delayDuration={200}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={isActive ? `Operator scope: ${selectedName}` : 'Operator scope'}
                data-testid="operator-scope-trigger"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border transition-colors text-xs font-medium shrink-0',
                  isActive
                    ? 'bg-[#082c59] border-[#082c59] text-white h-8 px-2.5 hover:bg-[#0a3a75]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 h-8 w-8 px-0 justify-center',
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {isActive && <span className="capitalize whitespace-nowrap max-w-[160px] truncate">{selectedName}</span>}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-xs">
            {isActive ? `Operator scope: ${selectedName}` : 'Operator scope'}
          </TooltipContent>
        </Tooltip>

        <PopoverContent align="start" className="w-72 p-2 bg-white border-slate-200 shadow-lg">
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Operator scope
          </p>
          <div className="relative mb-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search operators…"
              className="h-7 pl-7 text-xs"
              data-testid="operator-scope-search"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                !value ? 'bg-[#082c59]/10 text-[#082c59] font-semibold' : 'text-slate-700 hover:bg-slate-50',
              )}
              data-testid="operator-scope-option-all"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">All operators ({operators.length})</span>
              {!value && <Check className="h-3.5 w-3.5 text-[#082c59]" />}
            </button>
            {filtered.map(op => {
              const selected = op.id === value;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => { onChange(op.id); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                    selected ? 'bg-[#082c59]/10 text-[#082c59] font-semibold' : 'text-slate-700 hover:bg-slate-50',
                  )}
                  data-testid={`operator-scope-option-${op.id}`}
                >
                  <span className="flex-1 truncate">{op.name}</span>
                  {op.operator_type && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">{op.operator_type}</Badge>
                  )}
                  {selected && <Check className="h-3.5 w-3.5 text-[#082c59]" />}
                </button>
              );
            })}
            {filtered.length === 0 && search && (
              <div className="px-2 py-2 text-xs text-slate-400">No operators found</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
