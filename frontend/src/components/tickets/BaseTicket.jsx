// BaseTicket — the shared visual paradigm for every service ticket.
// Mirrors the EventTicket layout (two-panel face + back-of-ticket dark rail,
// brand-color bands top/bottom, perforation dots on the divider) but accepts
// service-specific data via props/slots. Each service ticket is a thin wrapper
// over BaseTicket that maps its booking_details into these props.
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Image as ImageIcon } from 'lucide-react';

const ASPECTS = {
  portrait: 'w-16 h-24',
  square: 'w-16 h-16',
  landscape: 'w-24 h-16',
  wide: 'w-28 h-20',
};

export default function BaseTicket({
  accentColor = '#3b82f6',
  posterSrc,
  posterAlt,
  posterAspect = 'square',
  PosterFallbackIcon = ImageIcon,
  posterFallbackBg = 'bg-gradient-to-br from-indigo-100 to-purple-100',
  posterFallbackIconColor = 'text-indigo-300',
  badges = [],
  title,
  subtitle,
  metaItems = [],
  operatorLogo,
  operatorName,
  extraSections,
  rightPanelTitle = 'Important Info',
  rightPanelDescription,
  rulesTitle = 'Notes',
  rules = [],
  bottomNote,
  testId = 'service-ticket',
}) {
  const aspect = ASPECTS[posterAspect] || ASPECTS.square;
  return (
    <div
      className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 border-2 shadow-sm"
      style={{ borderColor: `${accentColor}40` }}
      data-testid={testId}
    >
      {/* Top accent band */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}66 50%, transparent 100%)` }}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* LEFT — main face of the ticket */}
        <div className="md:col-span-2 p-5 space-y-4 relative">
          {/* perforation dot for the ticket-stub feel on desktop */}
          <div
            className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2"
            style={{ borderColor: `${accentColor}80` }}
          />

          <div className="flex items-start gap-3">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={posterAlt || title}
                className={`${aspect} rounded-lg object-cover border-2 shadow-sm flex-shrink-0`}
                style={{ borderColor: `${accentColor}30` }}
              />
            ) : (
              <div
                className={`${aspect} rounded-lg ${posterFallbackBg} flex items-center justify-center flex-shrink-0`}
              >
                <PosterFallbackIcon className={`w-7 h-7 ${posterFallbackIconColor}`} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {badges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {badges.map((b, i) => {
                    if (b.style) {
                      return (
                        <Badge
                          key={i}
                          className="text-[10px] font-semibold border-0"
                          style={b.style}
                          data-testid={b.testId}
                        >
                          {b.dot && (
                            <span
                              className="w-2 h-2 rounded-full mr-1.5 inline-block"
                              style={{ background: b.dot }}
                            />
                          )}
                          {b.icon && <b.icon className="h-3 w-3 mr-1" />}
                          {b.label}
                        </Badge>
                      );
                    }
                    return (
                      <Badge
                        key={i}
                        variant={b.variant || 'outline'}
                        className={`text-[10px] capitalize ${b.className || 'text-slate-600'}`}
                        data-testid={b.testId}
                      >
                        {b.icon && <b.icon className="h-3 w-3 mr-1" />}
                        {b.label}
                      </Badge>
                    );
                  })}
                </div>
              )}
              {title && (
                <h3
                  className="font-bold text-base text-slate-900 leading-tight"
                  data-testid={`${testId}-title`}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{subtitle}</p>
              )}
            </div>
            {operatorLogo && (
              <img
                src={operatorLogo}
                alt={operatorName || 'Operator'}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow flex-shrink-0"
              />
            )}
          </div>

          {/* 2-column meta grid */}
          {metaItems.length > 0 && (
            <div
              className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed"
              style={{ borderColor: `${accentColor}40` }}
            >
              {metaItems.map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="flex items-start gap-2">
                    {Icon && (
                      <Icon
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        style={{ color: accentColor }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">
                        {m.label}
                      </p>
                      <p
                        className={`text-xs font-semibold ${m.valueClassName || 'text-slate-800'} truncate`}
                        style={m.valueStyle}
                        data-testid={m.testId}
                      >
                        {m.value || '—'}
                      </p>
                      {m.sublabel && (
                        <p className="text-[10px] text-slate-500 truncate">{m.sublabel}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Service-specific extra content */}
          {extraSections}

          {bottomNote && (
            <p className="text-[11px] text-slate-500 italic pt-1">{bottomNote}</p>
          )}
        </div>

        {/* RIGHT — "back of ticket" dark panel */}
        <div className="bg-slate-900 text-white p-5 space-y-3 md:rounded-l-2xl relative">
          <div
            className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2"
            style={{ borderColor: `${accentColor}80` }}
          />

          {rightPanelTitle && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                {rightPanelTitle}
              </p>
              {rightPanelDescription && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {rightPanelDescription}
                </p>
              )}
            </div>
          )}

          {rules.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1.5">
                {rulesTitle}
              </p>
              <ul
                className="text-xs text-slate-200 space-y-1.5"
                data-testid={`${testId}-rules`}
              >
                {rules.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rules.length === 0 && !rightPanelDescription && (
            <p className="text-[11px] text-slate-400 italic">No additional notes.</p>
          )}
        </div>
      </div>
      {/* Bottom accent band */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accentColor}66 50%, ${accentColor} 100%)` }}
      />
    </div>
  );
}
