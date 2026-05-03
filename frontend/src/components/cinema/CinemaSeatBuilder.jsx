import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Crown, Ban, Armchair, Trash2, RefreshCw, Info } from 'lucide-react';
import { buildDefaultLayout } from './CinemaSeatMap';

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const seatId = (r, c) => `${ROW_LETTERS[r]}${c + 1}`;

const TOOLS = [
  { id: 'regular', label: 'Regular', color: 'bg-slate-200 border-slate-400 text-slate-700', icon: Armchair },
  { id: 'vip', label: 'VIP', color: 'bg-amber-100 border-amber-400 text-amber-700', icon: Crown },
  { id: 'blocked', label: 'Block', color: 'bg-rose-100 border-rose-400 text-rose-700', icon: Ban },
  { id: 'aisle', label: 'Aisle', color: 'bg-sky-100 border-sky-400 text-sky-700', icon: null, hint: 'Click between two columns to add a vertical aisle' },
];

/**
 * CinemaSeatBuilder — interactive editor that lets operators design a seat
 * layout for a screen. Light theme (lives inside the cinema dialog).
 *
 * @param {object}   value     current layout
 * @param {function} onChange  (newLayout) => void
 */
export default function CinemaSeatBuilder({ value, onChange }) {
  const layout = value && typeof value === 'object' && value.rows ? value : buildDefaultLayout(8, 12);
  const [tool, setTool] = useState('vip');

  const blockedSet = useMemo(() => new Set(layout.blocked || []), [layout.blocked]);
  const vipSet = useMemo(() => new Set(layout.vip_rows || []), [layout.vip_rows]);
  const aisleSet = useMemo(() => new Set(layout.aisle_after_col || []), [layout.aisle_after_col]);

  const totalSeats = useMemo(() => {
    return (layout.rows || 0) * (layout.cols || 0) - (layout.blocked || []).length;
  }, [layout]);

  const update = (patch) => onChange({ ...layout, ...patch });
  const setRows = (n) => update({ rows: Math.max(1, Math.min(26, parseInt(n) || 1)) });
  const setCols = (n) => update({ cols: Math.max(1, Math.min(30, parseInt(n) || 1)) });

  const handleSeatClick = (rIdx, cIdx) => {
    const id = seatId(rIdx, cIdx);
    const rowLetter = ROW_LETTERS[rIdx];
    if (tool === 'blocked') {
      const next = new Set(blockedSet);
      if (next.has(id)) next.delete(id); else next.add(id);
      update({ blocked: [...next] });
    } else if (tool === 'vip') {
      const next = new Set(vipSet);
      if (next.has(rowLetter)) next.delete(rowLetter); else next.add(rowLetter);
      update({ vip_rows: [...next] });
    } else if (tool === 'regular') {
      // Regular = remove from blocked + remove row's vip flag
      const nextBlocked = new Set(blockedSet); nextBlocked.delete(id);
      const nextVip = new Set(vipSet); nextVip.delete(rowLetter);
      update({ blocked: [...nextBlocked], vip_rows: [...nextVip] });
    }
  };

  const handleAisleToggle = (afterCol) => {
    const next = new Set(aisleSet);
    if (next.has(afterCol)) next.delete(afterCol); else next.add(afterCol);
    update({ aisle_after_col: [...next].sort((a, b) => a - b) });
  };

  const reset = () => onChange(buildDefaultLayout(layout.rows || 8, layout.cols || 12));
  const clearAll = () => onChange({ ...layout, blocked: [], vip_rows: [], aisle_after_col: [] });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4" data-testid="seat-builder">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-[11px] text-slate-500">Rows</Label>
            <Input type="number" min={1} max={26} value={layout.rows || 1} onChange={(e) => setRows(e.target.value)} className="w-20 h-9 mt-1" data-testid="seat-builder-rows" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-500">Seats / row</Label>
            <Input type="number" min={1} max={30} value={layout.cols || 1} onChange={(e) => setCols(e.target.value)} className="w-20 h-9 mt-1" data-testid="seat-builder-cols" />
          </div>
        </div>
        <div className="flex-1 min-w-[160px] flex flex-wrap items-end gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              data-testid={`seat-builder-tool-${t.id}`}
              className={cn(
                'px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all flex items-center gap-1.5',
                tool === t.id ? `${t.color} ring-2 ring-offset-1 ring-[#0891b2]` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              {t.icon ? <t.icon className="h-3.5 w-3.5" /> : <span className="inline-block w-3 h-4 bg-sky-300 rounded-sm" />}
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={clearAll} className="h-9 gap-1.5" data-testid="seat-builder-clear">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={reset} className="h-9 gap-1.5" data-testid="seat-builder-reset">
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Hint for current tool */}
      <div className="flex items-start gap-2 mb-3 text-[11px] text-slate-500 bg-white rounded-md p-2 border border-slate-200">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[#0891b2]" />
        <span>
          {tool === 'regular' && 'Click a seat to clear its VIP/Block flag.'}
          {tool === 'vip' && 'Click any seat in a row to mark the entire row as VIP — VIP rows can be priced separately on each showtime.'}
          {tool === 'blocked' && 'Click a seat to permanently block it (e.g. broken or reserved for staff).'}
          {tool === 'aisle' && 'Click on a column header to insert a vertical aisle gap right after that column.'}
        </span>
      </div>

      {/* Builder canvas */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 overflow-x-auto">
        {/* Screen */}
        <div className="relative mb-6 mx-auto" style={{ maxWidth: `${Math.min(layout.cols, 16) * 32}px` }}>
          <div className="h-1.5 bg-gradient-to-r from-transparent via-[#0891b2] to-transparent rounded-full shadow-sm" style={{ transform: 'perspective(80px) rotateX(-20deg)' }} />
          <p className="text-center text-slate-400 text-[10px] tracking-[0.3em] uppercase mt-2">Screen</p>
        </div>

        {/* Column header (clickable to add aisle when tool=aisle) */}
        <div className="flex items-center gap-1 mb-1 select-none ml-7 mr-7">
          {Array.from({ length: layout.cols }, (_, c) => (
            <React.Fragment key={`h-${c}`}>
              <button
                type="button"
                onClick={() => tool === 'aisle' && handleAisleToggle(c + 1)}
                disabled={tool !== 'aisle'}
                data-testid={`seat-builder-col-${c + 1}`}
                className={cn(
                  'w-6 h-5 text-[10px] rounded',
                  tool === 'aisle' ? 'bg-sky-50 hover:bg-sky-200 cursor-pointer text-sky-700 font-semibold' : 'text-slate-400',
                )}
                title={tool === 'aisle' ? `Toggle aisle after column ${c + 1}` : `Column ${c + 1}`}
              >
                {c + 1}
              </button>
              {aisleSet.has(c + 1) && <div className="w-3 flex justify-center"><div className="w-px h-5 bg-sky-400" /></div>}
            </React.Fragment>
          ))}
        </div>

        {/* Rows */}
        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: layout.rows }, (_, r) => {
            const rowLetter = ROW_LETTERS[r];
            const isVipRow = vipSet.has(rowLetter);
            return (
              <div key={r} className="flex items-center gap-1">
                <span className={cn('w-5 text-center text-[11px] font-bold', isVipRow ? 'text-amber-600' : 'text-slate-400')}>{rowLetter}</span>
                <div className="flex gap-1">
                  {Array.from({ length: layout.cols }, (_, c) => {
                    const id = seatId(r, c);
                    const isBlocked = blockedSet.has(id);
                    const showAisle = aisleSet.has(c + 1);
                    const seat = (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSeatClick(r, c)}
                        data-testid={`seat-builder-cell-${id}`}
                        className={cn(
                          'w-6 h-6 rounded-t-md text-[9px] font-semibold border-b-2 transition',
                          isBlocked && 'bg-rose-100 border-rose-400 text-rose-600',
                          !isBlocked && isVipRow && 'bg-amber-100 border-amber-400 text-amber-700',
                          !isBlocked && !isVipRow && 'bg-slate-200 border-slate-400 text-slate-600 hover:bg-slate-300',
                        )}
                        title={`${id}${isVipRow ? ' • VIP' : ''}${isBlocked ? ' • Blocked' : ''}`}
                      >
                        {c + 1}
                      </button>
                    );
                    return showAisle ? (
                      <React.Fragment key={`f-${id}`}>{seat}<div className="w-3" /></React.Fragment>
                    ) : seat;
                  })}
                </div>
                <span className={cn('w-5 text-center text-[11px] font-bold', isVipRow ? 'text-amber-600' : 'text-slate-400')}>{rowLetter}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
        <Badge className="bg-[#0891b2] text-white" data-testid="seat-builder-stat-total">{totalSeats} seats</Badge>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">{(layout.vip_rows || []).length} VIP rows</Badge>
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300">{(layout.blocked || []).length} blocked</Badge>
        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300">{(layout.aisle_after_col || []).length} aisles</Badge>
      </div>
    </div>
  );
}
