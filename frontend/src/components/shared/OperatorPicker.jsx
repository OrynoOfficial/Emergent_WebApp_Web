import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building2, Check, MapPin, Loader2 } from 'lucide-react';
import api from '@/api/client';

const SERVICE_OPTIONS = [
  { value: 'all', label: 'All services' },
  { value: 'travel', label: 'Travel' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'car_rental', label: 'Car rental' },
  { value: 'cinema', label: 'Cinema' },
  { value: 'event', label: 'Event' },
  { value: 'package', label: 'Package' },
  { value: 'pressing', label: 'Laundry' },
  { value: 'banquet', label: 'Banquet' },
];

/**
 * OperatorPicker — a searchable list of operators for assigning users to.
 *
 * Props:
 *   value: selected operator_id (string) or '' when none
 *   onChange: (operator_id: string, operator: object) => void
 *   required: bool — shows a soft prompt when unset
 *
 * Shows inline search bar + service/region filters + a scrollable list of cards.
 */
export default function OperatorPicker({ value, onChange, required = false }) {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [service, setService] = useState('all');
  const [region, setRegion] = useState('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { limit: 100 };
        if (service !== 'all') params.operator_type = service;
        if (region !== 'all') params.region = region;
        const { data } = await api.get('/operators/', { params });
        const list = data?.operators || data?.data || data || [];
        if (!cancelled) setOperators(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setOperators([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [service, region]);

  // Build region list from the fetched operators for a lightweight region filter
  const regionOptions = useMemo(() => {
    const set = new Set();
    operators.forEach(o => { if (o.region) set.add(o.region); });
    return [{ value: 'all', label: 'All regions' }, ...[...set].sort().map(r => ({ value: r, label: r }))];
  }, [operators]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter(o =>
      (o.name || '').toLowerCase().includes(q) ||
      (o.city || '').toLowerCase().includes(q) ||
      (o.email || '').toLowerCase().includes(q) ||
      (o.operator_type || '').toLowerCase().includes(q)
    );
  }, [operators, search]);

  const selected = operators.find(o => (o._id || o.id) === value);

  return (
    <div className="space-y-2" data-testid="operator-picker">
      {selected && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#082c59]/5 border border-[#082c59]/20">
          <Check className="h-4 w-4 text-[#082c59]" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-[#082c59]">{selected.name}</p>
            <p className="text-xs text-slate-500 capitalize">{selected.operator_type} · {selected.city || selected.region || '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange('', null)}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search operator by name, city, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="operator-picker-search"
          />
        </div>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white" data-testid="operator-picker-service">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {SERVICE_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white" data-testid="operator-picker-region">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {regionOptions.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="border rounded-lg max-h-64 overflow-y-auto" data-testid="operator-picker-list">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading operators…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            {required ? 'No matching operators. Adjust filters or create an operator first.' : 'No operators match your filters.'}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map(op => {
              const id = op._id || op.id;
              const isSel = id === value;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onChange(id, op)}
                    className={`w-full flex items-center gap-3 p-2.5 text-left transition ${
                      isSel ? 'bg-[#082c59]/10' : 'hover:bg-slate-50'
                    }`}
                    data-testid={`operator-option-${id}`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-[#082c59]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{op.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                        <span className="capitalize">{op.operator_type || '—'}</span>
                        {(op.city || op.region) && <>
                          <span>·</span>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{op.city || op.region}</span>
                        </>}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{op.status || 'active'}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
