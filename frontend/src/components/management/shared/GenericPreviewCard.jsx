import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star } from 'lucide-react';

/**
 * Generic live customer-card preview used inside service form modals.
 * All sections accept overrides so each service type can stay on-brand.
 *
 * Props:
 *  - cover (URL or null)        — main image
 *  - thumbs (URL[])              — small images displayed top-right of cover
 *  - icon (lucide component)
 *  - badgeText (string)          — colored badge top-left (e.g. "Hotel")
 *  - badgeClass (string)         — bg/text class for badge
 *  - title (string)
 *  - subtitle (string)
 *  - location (string)
 *  - placeholderColor (string)   — tailwind gradient class for empty state
 *  - infoRow (ReactNode)         — small row showing key facts (rating, capacity, time)
 *  - tags (string[])
 *  - tagsAccentClass (string)
 *  - priceLabel (string)
 *  - priceValue (string)
 *  - accentTextClass (string)    — color class for price (e.g. text-red-700)
 */
export default function GenericPreviewCard({
  cover,
  thumbs = [],
  icon: Icon,
  badgeText,
  badgeClass = 'bg-yellow-400 text-slate-800',
  title,
  subtitle,
  location,
  placeholderColor = 'from-slate-700 to-slate-900',
  infoRow,
  tags = [],
  tagsAccentClass = 'bg-slate-100 text-slate-700',
  priceLabel = 'Starting at',
  priceValue,
  accentTextClass = 'text-slate-900',
  rating,
}) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImg = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);

  return (
    <div className="rounded-2xl border-0 shadow-md overflow-hidden bg-white">
      <div className="relative h-36 overflow-hidden">
        {cover ? (
          <>
            <img src={getImg(cover)} alt={title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${placeholderColor} flex items-center justify-center`}>
            {Icon ? <Icon className="w-12 h-12 text-white/30" /> : null}
          </div>
        )}
        {badgeText && (
          <Badge className={`absolute top-2 left-2 ${badgeClass} hover:${badgeClass} z-10 text-[10px]`}>
            {Icon ? <Icon className="w-2.5 h-2.5 mr-1" /> : null} {badgeText}
          </Badge>
        )}
        {thumbs.length > 0 && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {thumbs.map((t, i) => (
              <img key={i} src={getImg(t)} alt="" className="w-8 h-8 rounded-md object-cover border-2 border-white/70 shadow" />
            ))}
          </div>
        )}
        <div className="absolute bottom-2 left-3 right-3 z-10 text-white">
          <p className="font-bold text-sm line-clamp-1 flex items-center gap-1">
            {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
            {title || 'Untitled…'}
          </p>
          {subtitle && (
            <p className="text-white/70 text-[10px] truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="p-4">
        {location && (
          <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="truncate">{location}</span>
          </div>
        )}

        {rating != null && (
          <div className="flex items-center gap-1 text-xs text-amber-600 mb-2">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <strong>{Number(rating).toFixed(1)}</strong>
            <span className="text-slate-400">/ 5</span>
          </div>
        )}

        {infoRow}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className={`text-[9px] capitalize ${tagsAccentClass} hover:${tagsAccentClass} px-1.5 py-0`}>
                {String(t).replace(/_/g, ' ')}
              </Badge>
            ))}
            {tags.length > 4 && <span className="text-[9px] text-slate-400 self-center">+{tags.length - 4}</span>}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] text-slate-500">{priceLabel}</div>
          <div className={`text-xl font-bold ${accentTextClass}`}>{priceValue || '—'}</div>
        </div>
      </div>
    </div>
  );
}
