// Super-Admin → Operators → Categories tab.
//
// Power-user view: every operator listed with their current sub-category
// chips inline. Click a chip to toggle. Filter by service area or by a
// specific sub-category to e.g. find every operator currently offering
// "photographer". Saves on blur so the admin never has to hunt for a
// Save button.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import OperatorCategoryAssign from '@/components/admin/OperatorCategoryAssign';
import OperatorSectionTabs from '@/components/admin/OperatorSectionTabs';
import { CATEGORY_CATALOG, parseOperatorTags } from '@/components/admin/operatorCategoryUtils';

const AREA_OPTIONS = ['all', ...Object.keys(CATEGORY_CATALOG)];

export default function OperatorCategoriesPage() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  // ─── Debounced PUT helper ──────────────────────────────────────────
  // A user clicking 4 chips in rapid succession used to fire 4 PUT
  // requests against /api/operators/{id}. We now buffer all toggles
  // per-operator and flush a single PUT 300 ms after the LAST chip
  // click. Pending writes are flushed eagerly on unmount so no toggle
  // is silently dropped if the admin navigates away.
  const pendingRef = useRef(new Map()); // operatorId -> { timeout, tags }

  const flushPending = useCallback(async (id) => {
    const entry = pendingRef.current.get(id);
    if (!entry) return;
    pendingRef.current.delete(id);
    clearTimeout(entry.timeout);
    setSavingId(id);
    try {
      await api.put(`/operators/${id}`, { service_types: entry.tags });
      toast.success('Categories saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSavingId(null);
    }
  }, []);

  const scheduleSave = useCallback((op, nextTags) => {
    const id = op._id || op.id;
    const existing = pendingRef.current.get(id);
    if (existing) clearTimeout(existing.timeout);
    const timeout = setTimeout(() => {
      // Hoist into a microtask to avoid setState-in-timer warnings
      // when the effect runs while the component is unmounting.
      flushPending(id);
    }, 300);
    pendingRef.current.set(id, { timeout, tags: nextTags });
  }, [flushPending]);

  // Eagerly flush any debounced writes if the user navigates away
  // before the 300 ms timer fires.
  useEffect(() => {
    // Snapshot the ref into a local so the cleanup closure refers to
    // the same Map instance even if React replaces the ref later.
    const map = pendingRef.current;
    return () => {
      for (const [id] of map) flushPending(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/operators/');
      setOperators(res.data.operators || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load operators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operators.filter(op => {
      if (q && !(op.name || '').toLowerCase().includes(q)) return false;
      if (areaFilter !== 'all') {
        const { areas } = parseOperatorTags(op.service_types || []);
        if (!areas.has(areaFilter)) return false;
        if (catFilter !== 'all') {
          const { cats } = parseOperatorTags(op.service_types || []);
          if (!(cats[areaFilter]?.has(catFilter))) return false;
        }
      }
      return true;
    });
  }, [operators, search, areaFilter, catFilter]);

  const saveOperator = (op, nextTags) => scheduleSave(op, nextTags);

  const catOptionsForFilter = areaFilter === 'all' ? [] : (CATEGORY_CATALOG[areaFilter] || []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#082c59] flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-purple-600" />
          Operator Categories
        </h1>
        <p className="text-slate-600 mt-1">
          Pre-tag operators with sub-categories so they appear in category-scoped dropdowns
          before they create their first service.
        </p>
      </div>

      {/* Sub-page tabs — shared with OperatorsManagement. */}
      <OperatorSectionTabs />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search operator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
            data-testid="categories-search-input"
          />
        </div>
        <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setCatFilter('all'); }}>
          <SelectTrigger className="w-44 bg-white" data-testid="categories-area-filter"><SelectValue placeholder="Service area" /></SelectTrigger>
          <SelectContent>
            {AREA_OPTIONS.map(a => (
              <SelectItem key={a} value={a} className="capitalize">{a === 'all' ? 'All service areas' : a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {catOptionsForFilter.length > 0 && (
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {catOptionsForFilter.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Operator list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No operators match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(op => {
            const id = op._id || op.id;
            const { areas } = parseOperatorTags(op.service_types || []);
            return (
              <Card key={id} className="bg-white" data-testid={`operator-row-${id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{op.name}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[...areas].map(a => (
                          <Badge key={a} variant="outline" className="text-[10px] uppercase tracking-wide">{a}</Badge>
                        ))}
                        {areas.size === 0 && (
                          <span className="text-xs text-slate-400 italic">No service areas enabled — edit the operator first.</span>
                        )}
                      </div>
                    </div>
                    {savingId === id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" title="Saved" />
                    )}
                  </div>
                  <OperatorCategoryAssign
                    value={op.service_types || []}
                    onChange={(next) => {
                      // Optimistic in-memory update for snappy chip feedback;
                      // we still persist via PUT.
                      setOperators(list => list.map(x => (x._id || x.id) === id ? { ...x, service_types: next } : x));
                      saveOperator(op, next);
                    }}
                    dense
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Re-export for App.jsx routing — empty trailer; helpers live in
// `components/admin/operatorCategoryUtils.js`.
