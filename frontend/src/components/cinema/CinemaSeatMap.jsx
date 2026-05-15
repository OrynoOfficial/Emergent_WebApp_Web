import React from 'react';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';

/**
 * Build a default seat layout from rows + columns.
 * Format:
 * {
 *   rows: number,
 *   cols: number,
 *   aisle_after_col: [3, 9],   // empty gaps after these column indices (1-based)
 *   vip_rows: ['G', 'H'],       // letters of VIP rows
 *   blocked: ['A1', 'B5']       // permanently disabled seats
 * }
 */
export function buildDefaultLayout(rows = 8, cols = 12) {
  return {
    rows,
    cols,
    aisle_after_col: [Math.floor(cols / 2)],
    vip_rows: [],
    blocked: [],
  };
}

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function getSeatId(rowIdx, colIdx) {
  return `${ROW_LETTERS[rowIdx]}${colIdx + 1}`;
}

/**
 * CinemaSeatMap — visual seat picker used on the customer booking page and as
 * a read-only preview inside the management seat builder. Cyan accent is
 * hardcoded (cinema service colour) so Tailwind JIT can compile the classes.
 */
export default function CinemaSeatMap({
  layout = buildDefaultLayout(),
  bookedSeats = [],
  selectedSeats = [],
  onChange,
  maxSeats = 1,
  readOnly = false,
  hideLegend = false,
}) {
  const rows = layout?.rows || 8;
  const cols = layout?.cols || 12;
  const aisles = new Set(layout?.aisle_after_col || []);
  const vipRows = new Set(layout?.vip_rows || []);
  const blockedList = layout?.blocked || [];
  const selectedSet = new Set(selectedSeats);

  const toggleSeat = (seatId, isBlocked, isBooked) => {
    if (readOnly || isBlocked || isBooked || !onChange) return;
    if (selectedSet.has(seatId)) {
      onChange(selectedSeats.filter((s) => s !== seatId));
    } else if (selectedSeats.length < maxSeats) {
      onChange([...selectedSeats, seatId]);
    }
  };

  return (
    <div className="w-full" data-testid="cinema-seat-map">
      {/* Curved screen */}
      <div className="relative mb-10 mx-auto" style={{ maxWidth: `${Math.min(cols, 16) * 38}px` }}>
        <div
          className="h-2.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full shadow-[0_0_40px_rgba(34,211,238,0.65)]"
          style={{ transform: 'perspective(120px) rotateX(-22deg)' }}
        />
        <p className="text-center text-cyan-700/70 text-[11px] tracking-[0.4em] uppercase mt-3">Screen</p>
      </div>

      {/* Seats grid */}
      <div className="flex flex-col items-center gap-1.5 overflow-x-auto pb-4 px-2">
        {Array.from({ length: rows }, (_, rIdx) => {
          const rowLetter = ROW_LETTERS[rIdx];
          const isVipRow = vipRows.has(rowLetter);
          return (
            <div key={rowLetter} className="flex items-center gap-1.5 select-none">
              <span className={`w-5 text-center text-[11px] font-bold ${isVipRow ? 'text-amber-600' : 'text-slate-400'}`}>{rowLetter}</span>
              <div className="flex gap-1">
                {Array.from({ length: cols }, (_, cIdx) => {
                  const seatId = getSeatId(rIdx, cIdx);
                  const isBooked = bookedSeats.includes(seatId);
                  const isBlocked = blockedList.includes(seatId);
                  const isSelected = selectedSet.has(seatId);
                  const showAisle = aisles.has(cIdx + 1);

                  const seatBtn = (
                    <button
                      key={seatId}
                      type="button"
                      onClick={() => toggleSeat(seatId, isBlocked, isBooked)}
                      disabled={readOnly || isBlocked || isBooked}
                      data-testid={`seat-${seatId}`}
                      title={`${seatId}${isVipRow ? ' (VIP)' : ''}${isBooked ? ' — booked' : isBlocked ? ' — blocked' : ''}`}
                      className={cn(
                        'relative w-7 h-7 sm:w-8 sm:h-8 rounded-t-lg text-[10px] font-semibold transition-all duration-150',
                        'flex items-center justify-center border-b-2',
                        !readOnly && !isBlocked && !isBooked && 'hover:scale-110 hover:-translate-y-0.5 cursor-pointer',
                        isBooked && 'bg-slate-300 border-slate-400 text-slate-500 cursor-not-allowed',
                        isBlocked && !isBooked && 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed',
                        isSelected && 'bg-cyan-500 border-cyan-700 text-white shadow-[0_0_18px_rgba(34,211,238,0.55)] ring-2 ring-cyan-300',
                        !isSelected && !isBooked && !isBlocked && isVipRow && 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200',
                        !isSelected && !isBooked && !isBlocked && !isVipRow && 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-cyan-50 hover:border-cyan-400',
                      )}
                    >
                      {isVipRow && !isBlocked && !isBooked && (
                        <Crown className="absolute -top-1.5 -right-1 h-2.5 w-2.5 text-amber-500" />
                      )}
                      {cIdx + 1}
                    </button>
                  );

                  return showAisle ? (
                    <React.Fragment key={`f-${seatId}`}>
                      {seatBtn}
                      <div className="w-3" />
                    </React.Fragment>
                  ) : seatBtn;
                })}
              </div>
              <span className={`w-5 text-center text-[11px] font-bold ${isVipRow ? 'text-amber-600' : 'text-slate-400'}`}>{rowLetter}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!hideLegend && (
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6 text-[11px]">
          <LegendItem swatch="bg-slate-100 border-slate-300" label="Available" />
          <LegendItem swatch="bg-cyan-500 border-cyan-700 ring-2 ring-cyan-300" label="Selected" />
          <LegendItem swatch="bg-amber-100 border-amber-400" label="VIP" icon={<Crown className="h-3 w-3 text-amber-500" />} />
          <LegendItem swatch="bg-slate-300 border-slate-400" label="Booked" muted />
          <LegendItem swatch="bg-slate-200 border-slate-300" label="Blocked" muted />
        </div>
      )}
    </div>
  );
}

function LegendItem({ swatch, label, icon, muted = false }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('relative w-5 h-5 rounded-t-md border-b-2', swatch, muted && 'opacity-60')}>
        {icon && <span className="absolute -top-1 -right-1">{icon}</span>}
      </span>
      <span className={cn('text-slate-700', muted && 'text-slate-400')}>{label}</span>
    </div>
  );
}
