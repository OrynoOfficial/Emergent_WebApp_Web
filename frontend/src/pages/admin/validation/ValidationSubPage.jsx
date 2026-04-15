import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, LayoutGrid, List, CheckCircle, XCircle, X } from 'lucide-react';

const ITEMS_PER_PAGE = 8;

export function ValidationSubPage({ items, renderCard, renderListRow, emptyIcon, emptyText, onBulkApprove, onBulkReject, showBulk = true }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(item => {
      const text = [item.service_name, item.order_number, item.customer_name, item.user_email, item.name, item.title, item.operator_name, item.service_category, item.type, item.item_name, item.performed_by_name].filter(Boolean).join(' ').toLowerCase();
      return text.includes(s);
    });
  }, [items, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = (checked) => setSelected(checked ? new Set(paginated.map(i => i.id)) : new Set());
  useEffect(() => { setPage(1); }, [search]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        {emptyIcon || <CheckCircle className="h-14 w-14 mb-3 text-green-300" />}
        <p className="font-medium text-slate-600">{emptyText || 'No items'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-10 bg-white h-9" />
        </div>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('list')} className={`px-2 py-1.5 ${viewMode === 'list' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} data-testid="list-view-btn"><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('grid')} className={`px-2 py-1.5 ${viewMode === 'grid' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} data-testid="grid-view-btn"><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {showBulk && selected.size > 0 && (
        <Card className="bg-[#082c59] text-white border-0">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm">{selected.size} selected</span>
            <div className="flex gap-2">
              {onBulkApprove && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7" onClick={() => { onBulkApprove(Array.from(selected)); setSelected(new Set()); }}><CheckCircle className="h-3 w-3 mr-1" />Approve All</Button>}
              {onBulkReject && <Button size="sm" variant="destructive" className="h-7" onClick={() => { onBulkReject(Array.from(selected)); setSelected(new Set()); }}><XCircle className="h-3 w-3 mr-1" />Reject All</Button>}
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={() => setSelected(new Set())}><X className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showBulk && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox checked={paginated.length > 0 && selected.size >= paginated.length} onCheckedChange={selectAll} />
          <span className="text-xs text-slate-500">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        {paginated.map(item => (
          <div key={item.id || item._id || Math.random()} className="relative">
            {showBulk && (
              <div className="absolute top-3 left-3 z-10">
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
              </div>
            )}
            {viewMode === 'grid' ? renderCard(item) : (renderListRow ? renderListRow(item) : renderCard(item))}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">Page {page} of {totalPages} ({filtered.length} items)</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)} className={`w-7 h-7 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
