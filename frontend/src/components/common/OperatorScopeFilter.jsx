import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Search, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';

/**
 * OperatorScopeFilter — Admin/SuperAdmin operator scope selector.
 * Loads operators relevant to the given serviceType and calls onChange(operatorId).
 * Hidden for non-admin users. Default is "all" (cumulative view).
 *
 * @param {string} serviceType - e.g. 'travel', 'restaurant', 'cinema', 'hotel', 'pressing', 'banquet', 'packages', 'car_rental', 'events'
 * @param {function} onChange - called with operator_id string or '' for all
 * @param {string} value - current selected operator_id
 */
export default function OperatorScopeFilter({ serviceType, onChange, value = '' }) {
  const { user } = useAuth();
  const [operators, setOperators] = useState([]);
  const [search, setSearch] = useState('');
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

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="operator-scope-filter">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Building2 className="w-3.5 h-3.5" />
        <span>Operator:</span>
      </div>
      <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-56 bg-white h-8 text-sm" data-testid="operator-scope-select">
          <SelectValue placeholder="All Operators" />
        </SelectTrigger>
        <SelectContent className="bg-white max-h-64">
          <div className="px-2 pb-2 pt-1 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search operators..."
                className="h-7 pl-7 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <SelectItem value="all">All Operators ({operators.length})</SelectItem>
          {filtered.map(op => (
            <SelectItem key={op.id} value={op.id}>
              <div className="flex items-center gap-2">
                <span>{op.name}</span>
                {op.operator_type && <Badge variant="outline" className="text-[9px] py-0 px-1">{op.operator_type}</Badge>}
              </div>
            </SelectItem>
          ))}
          {filtered.length === 0 && search && (
            <div className="px-3 py-2 text-xs text-slate-400">No operators found</div>
          )}
        </SelectContent>
      </Select>
      {selectedName && (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1">
          {selectedName}
          <button onClick={() => onChange('')} className="ml-0.5 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
