import React from 'react';
import { Zap } from 'lucide-react';

/**
 * AlmostSoldOutBadge — Tiny FOMO sticker that surfaces on result/inventory
 * cards when only a few seats/units are left. Renders nothing when:
 *   - `count` is null / undefined / non-numeric (we don't know inventory)
 *   - `count` is greater than `threshold` (default 11)
 *   - `count` is <= 0 (sold out → caller surfaces "Sold out" separately)
 *
 * Designed to slot inside an `absolute`-positioned corner of the card.
 *
 * Usage:
 *   <AlmostSoldOutBadge count={film.available_seats} unit="seats" />
 *   <AlmostSoldOutBadge count={trip.seats_available} unit="seats" />
 *   <AlmostSoldOutBadge count={hotel.rooms_left} unit="rooms" />
 */
export default function AlmostSoldOutBadge({
  count,
  threshold = 11,
  unit = 'left',
  className = '',
  testId,
}) {
  if (count === null || count === undefined) return null;
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0 || n > threshold) return null;

  // Slightly different copy when there's exactly 1 — small UX touch.
  const label = n === 1 ? `Last ${unit.replace(/s$/, '')} left!` : `Only ${n} ${unit} left!`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-wide shadow-lg ring-1 ring-amber-500/40 ${className}`}
      data-testid={testId || 'almost-sold-out-badge'}
      role="status"
      aria-label={`Almost sold out — ${label}`}
    >
      <Zap className="h-2.5 w-2.5 fill-amber-950" aria-hidden="true" />
      <span className="whitespace-nowrap">⚡ Almost sold out · {label}</span>
    </span>
  );
}
