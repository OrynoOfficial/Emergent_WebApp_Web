import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shirt, MapPin, Phone, Clock, Star, Truck, Sparkles, X, ArrowRight,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

/**
 * Pre-booking modal — opens when a customer clicks "Book" on a card on the
 * /services/laundry/results page. Mirrors the Packages flow: shows the full
 * shop info (hero gallery + items menu + logistics) inside a modal and
 * routes to the booking page only via the explicit CTA.
 *
 * Props:
 *   open, onOpenChange — Dialog controls
 *   shop               — the full shop document
 *   onContinue         — callback invoked on the bottom CTA, parent navigates
 */
export default function LaundryShopDetailsModal({ open, onOpenChange, shop, onContinue }) {
  if (!shop) return null;

  const st = shop.shop_type || 'laundry';
  const items = Array.isArray(shop.item_prices) ? shop.item_prices : [];
  const imgs = (shop.images || []).slice(0, 4);
  const stBadge = st === 'pressing' ? 'bg-fuchsia-500 text-white border-transparent'
    : st === 'both' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent'
    : 'bg-purple-500 text-white border-transparent';
  const stLabel = st === 'both' ? 'Laundry + Pressing' : st;
  const headlinePrice = st === 'pressing'
    ? (items.filter((i) => Number(i.price) > 0).length
        ? formatFCFA(Math.min(...items.map((i) => Number(i.price)).filter((n) => n > 0)))
        : '—')
    : formatFCFA(shop.price_per_kg || 0);
  const headlineUnit = st === 'pressing' ? 'per item' : 'per kg';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] bg-white p-0 sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        data-testid="laundry-prebooking-modal"
      >
        {/* Hero gallery — wider modal */}
        <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-500">
          {imgs.length > 0 ? (
            <div className={`grid gap-1 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
              <div className={`${imgs.length >= 3 ? 'col-span-2 row-span-2' : ''} h-56 relative`}>
                <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
              </div>
              {imgs.slice(1, 3).map((src, idx) => (
                <div key={idx} className="h-[110px] hidden sm:block">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <Shirt className="h-16 w-16 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent pointer-events-none" />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition"
            aria-label="Close"
            data-testid="laundry-prebooking-close"
          >
            <X className="text-white h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <Badge className={`capitalize text-[10px] mb-1.5 ${stBadge}`}>{stLabel}</Badge>
                <h2 className="text-xl font-bold drop-shadow truncate" title={shop.name}>{shop.name}</h2>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-white/85 flex-wrap">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[shop.address, shop.city].filter(Boolean).join(' · ') || 'Unknown'}</span>
                  {shop.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {shop.phone}</span>}
                  {shop.turnaround_hours && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {shop.turnaround_hours}h</span>}
                  {shop.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-300 fill-amber-300" /> {shop.rating}</span>}
                </div>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{st === 'pressing' ? 'Starts at' : 'Per kg'}</p>
                <p className="text-2xl font-bold leading-tight">{headlinePrice}</p>
                <p className="text-[10px] text-white/70">{headlineUnit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Body — wider modal, looser spacing */}
        <div className="p-6 space-y-5">
          {shop.description && (
            <p className="text-slate-700 text-xs leading-relaxed">{shop.description}</p>
          )}

          {shop.services?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Services offered</p>
              <div className="flex flex-wrap gap-1">
                {shop.services.map((s, idx) => (
                  <Badge key={typeof s === 'string' ? s : s?.name || idx} variant="outline" className="text-[10px] capitalize bg-purple-50 text-purple-700 border-purple-200 px-1.5 py-0.5">
                    {typeof s === 'string' ? s.replace(/_/g, ' ') : s?.name || s?.type || 'Service'}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Items gallery — compact: smaller thumbs, 4 cols desktop, dense text */}
          {st !== 'laundry' && items.length > 0 && (
            <div data-testid="laundry-prebooking-items">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Pressing menu &amp; prices</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {items.map((i, idx) => (
                  <div key={`${i.item}-${idx}`} className="rounded-lg border border-purple-100 bg-white overflow-hidden hover:shadow-sm hover:border-purple-300 transition">
                    <div className="aspect-square bg-gradient-to-br from-purple-100 via-purple-50 to-fuchsia-100 relative">
                      {i.image_url ? (
                        <img src={i.image_url} alt={i.item} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Shirt className="h-5 w-5 text-purple-400/50" /></div>
                      )}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className="text-[11px] font-semibold text-slate-900 truncate leading-tight" title={i.item}>{i.item}</p>
                      <p className="text-[11px] font-bold text-purple-700 leading-tight">{formatFCFA(Number(i.price))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(st === 'laundry' || st === 'both') && (
            <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-purple-700/80 font-semibold">Laundry — pay per kilo</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Drop off — billed by total weight.</p>
              </div>
              <p className="text-xl font-bold text-purple-700">{formatFCFA(shop.price_per_kg || 0)}<span className="text-[10px] text-slate-500 font-normal ml-1">/kg</span></p>
            </div>
          )}

          {/* Logistics — wider modal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-md border border-slate-200 p-2 flex items-center gap-2">
              <Truck className={`h-4 w-4 flex-shrink-0 ${shop.delivery_available ? 'text-emerald-600' : 'text-slate-300'}`} />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500">Pickup &amp; delivery</p>
                <p className="font-medium text-slate-900 text-[11px] truncate">{shop.delivery_available ? `Yes — ${formatFCFA(shop.delivery_fee || 0)}` : 'No delivery'}</p>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-2 flex items-center gap-2">
              <Sparkles className={`h-4 w-4 flex-shrink-0 ${shop.express_available ? 'text-orange-500' : 'text-slate-300'}`} />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500">Express service</p>
                <p className="font-medium text-slate-900 text-[11px] truncate">{shop.express_available ? `+${shop.express_surcharge || 0}%` : 'Standard only'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-purple-100/60 bg-purple-50/30 flex items-center justify-between sm:rounded-b-2xl gap-3">
          <div className="text-xs text-slate-500 hidden sm:block">
            Review the menu &amp; logistics before booking.
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-purple-200 text-purple-700 hover:bg-purple-50" data-testid="laundry-prebooking-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => onContinue && onContinue(shop)}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-md shadow-purple-500/20"
              data-testid="laundry-prebooking-continue"
            >
              Continue to booking <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
