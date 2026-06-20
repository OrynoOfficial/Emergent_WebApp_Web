import React from 'react';

/**
 * Compact, pill-shaped stat strip used across the platform's management pages.
 * Replaces the legacy "big card" stat grids with a single horizontal flex strip
 * of rounded chips. Each chip shows: icon + label + bold count.
 *
 * Usage:
 *   <StatChipStrip
 *     testid="users-stats-grid"
 *     stats={[
 *       { label: 'Total', value: 12, icon: Users, tone: 'slate' },
 *       { label: 'Active', value: 8, icon: CheckCircle, tone: 'green' },
 *     ]}
 *   />
 *
 * Tones available: slate, blue, green, emerald, amber, red, purple,
 * violet, orange, pink, sky, teal.
 *
 * A chip can also be made clickable by passing `onClick`. When `active` is
 * true the chip gets a soft ring to indicate selection (matches Ratings page).
 */

const TONE_CLASSES = {
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
  sky: 'bg-sky-50 border-sky-200 text-sky-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
};

function StatChip({ icon: Icon, label, value, tone = 'slate', active = false, onClick, testid }) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.slate;
  const interactive = !!onClick;
  const ringCls = active ? 'ring-2 ring-[#082c59]/30 shadow-sm' : interactive ? 'hover:shadow-sm' : '';
  const base = `flex items-center gap-2 px-2.5 py-1 rounded-full border ${cls} text-[11px] font-medium transition-all ${ringCls}`;

  const content = (
    <>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <span className="font-bold">{value}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={base} data-testid={testid}>
        {content}
      </button>
    );
  }
  return (
    <div className={base} data-testid={testid}>
      {content}
    </div>
  );
}

export default function StatChipStrip({ stats = [], testid, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-testid={testid}>
      {stats.map((s, idx) => (
        <StatChip
          key={s.key || s.label || idx}
          icon={s.icon}
          label={s.label}
          value={s.value}
          tone={s.tone}
          active={s.active}
          onClick={s.onClick}
          testid={s.testid}
        />
      ))}
    </div>
  );
}

export { StatChip };
