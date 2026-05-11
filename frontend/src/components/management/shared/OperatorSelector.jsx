import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Lock, Search, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Searchable operator selector with role-based locking.
 *
 * - Admin / super_admin: full searchable picker across all operators.
 * - Operator (or one of their team users): the field is **pre-filled** with
 *   the current user's operator and rendered locked (read-only).
 *
 * Props:
 *   value      - operator_id (string)
 *   onChange   - (operator_id, operator_name) => void
 *   operators  - [] array fetched by the parent
 *   label      - field label (default "Operator")
 *   required   - shows "*"
 *   helperText - hint shown under the field
 *   testId     - data-testid for the trigger
 */
export default function OperatorSelector({
  value,
  onChange,
  operators = [],
  label = 'Operator',
  required = true,
  helperText,
  testId = 'operator-selector',
}) {
  const { user, isOperatorUser, operatorContext } = useAuth();
  const role = user?.role;
  const isAdminLike = role === 'admin' || role === 'super_admin';
  // The user's effective operator_id can live on the user object OR on the
  // separate operator_context. Read both.
  const userOperatorId = user?.operator_id || operatorContext?.operator_id;
  const userOperatorName = user?.operator_name || operatorContext?.operator_name;
  const isOperatorScoped = !isAdminLike && (role === 'operator' || isOperatorUser || !!userOperatorId);

  const [open, setOpen] = useState(false);

  // Auto-prefill for operator users on mount / when operator changes.
  // Use a ref to ensure we only fire onChange once per operator-id change
  // even if the parent recreates the onChange callback on every render.
  const prefilledForRef = useRef(null);
  useEffect(() => {
    if (
      isOperatorScoped &&
      userOperatorId &&
      value !== userOperatorId &&
      prefilledForRef.current !== userOperatorId
    ) {
      prefilledForRef.current = userOperatorId;
      onChange?.(userOperatorId, userOperatorName || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperatorScoped, userOperatorId, userOperatorName, value]);

  const selected = useMemo(() => {
    if (!value) return null;
    return operators.find((o) => (o._id || o.id) === value) || null;
  }, [value, operators]);

  // Locked, pre-filled view for operator users
  if (isOperatorScoped) {
    const displayName = selected?.name || userOperatorName || userOperatorId || '—';
    return (
      <div>
        {label && <Label className="flex items-center gap-1.5">{label}{required && '*'}<Lock className="h-3 w-3 text-slate-400" /></Label>}
        <div
          className="mt-1.5 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700"
          data-testid={`${testId}-locked`}
          title="Operators can only create services for their own organisation"
        >
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="font-medium">{displayName}</span>
          <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase">Auto-assigned</Badge>
        </div>
        {helperText && <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }

  // Searchable picker for admin / super_admin
  return (
    <div>
      {label && <Label className="flex items-center gap-1.5">{label}{required && <span className="text-rose-500">*</span>}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="mt-1.5 w-full justify-between bg-white font-normal"
            data-testid={testId}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className={cn('truncate', !selected && 'text-slate-400')}>
                {selected ? selected.name : `Select operator…`}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white" align="start">
          <Command>
            <CommandInput placeholder="Search operators…" data-testid={`${testId}-search-input`} />
            <CommandList className="max-h-72">
              <CommandEmpty>No operator found.</CommandEmpty>
              <CommandGroup>
                {operators.map((op) => {
                  const opId = op._id || op.id;
                  const opName = op.name || 'Unnamed';
                  const opCity = op.city || op.country || '';
                  return (
                    <CommandItem
                      key={opId}
                      value={`${opName} ${opCity} ${opId}`}
                      onSelect={() => {
                        onChange?.(opId, opName);
                        setOpen(false);
                      }}
                      data-testid={`${testId}-option-${opId}`}
                      className="cursor-pointer"
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === opId ? 'opacity-100 text-emerald-600' : 'opacity-0')} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{opName}</div>
                        {opCity && <div className="text-xs text-slate-500 truncate">{opCity}</div>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {helperText && <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>}
    </div>
  );
}
