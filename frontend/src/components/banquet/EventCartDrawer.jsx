// Sliding cart drawer for the Banquet & Event Services flow.
//
// Teal-themed cart summary mounted on the Results page. Two trigger paths:
//  • Internal: the floating "Cart" badge at the bottom-right (only rendered
//    when `hideFab` is false — e.g. when the parent results page is using
//    the top-of-page sticky strip as the primary cart entry-point).
//  • External: parent passes `open` + `onOpenChange` to drive the drawer
//    from a different button (e.g. the sticky top cart strip).
//
// Each line item shows a swipeable thumbnail carousel, the per-unit price,
// unit label, category badge, and computed line total so customers can
// review what they added without leaving the cart.
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag, X, Trash2, Package as PackageIcon, Sparkles, ArrowRight,
  ChevronLeft, ChevronRight, MapPin, Users,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const CATEGORY_LABEL = {
  hall: 'Hall', rental_item: 'Rental', canopy: 'Canopy',
  photographer: 'Photographer', videographer: 'Videographer',
  catering: 'Catering', decoration: 'Decoration',
  sound_lighting: 'Sound & Lighting', other: 'Other',
};

// Compact swipeable carousel for cart line thumbnails.
function CartThumbCarousel({ images, name }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const safe = (images && images.length > 0) ? images : [];
  if (safe.length === 0) {
    return (
      <div className="w-20 h-20 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-6 h-6 text-teal-500" />
      </div>
    );
  }
  const scrollTo = (i, e) => {
    e?.stopPropagation();
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    ref.current.scrollTo({ left: w * i, behavior: 'smooth' });
    setIdx(i);
  };
  const onScroll = () => {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    setIdx(Math.round(ref.current.scrollLeft / w));
  };
  return (
    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden group">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {safe.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full snap-center">
            <img src={src} alt={`${name} ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {safe.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => scrollTo(Math.max(0, idx - 1), e)}
            className="absolute left-0.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white/90 shadow flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="w-3 h-3 text-teal-700" />
          </button>
          <button
            type="button"
            onClick={(e) => scrollTo(Math.min(safe.length - 1, idx + 1), e)}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white/90 shadow flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="w-3 h-3 text-teal-700" />
          </button>
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
            {safe.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === idx ? 'bg-white w-2.5' : 'bg-white/60 w-1'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function EventCartDrawer({
  cart, updateQty, removeItem, removePackage, totals, count, clear,
  open: openProp, onOpenChange, hideFab = false,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp != null ? openProp : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const navigate = useNavigate();

  // event_date is collected at checkout (mirrors the Laundry flow) — never block here.
  const goCheckout = () => {
    setOpen(false);
    navigate('/services/banquet/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideFab && (
        <SheetTrigger asChild>
          <Button
            className="fixed top-20 right-6 z-50 rounded-full h-12 px-5 shadow-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
            data-testid="event-cart-fab"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Cart
            {count > 0 && (
              <Badge className="ml-2 bg-white text-teal-700 font-bold" data-testid="event-cart-count">{count}</Badge>
            )}
            {totals.total > 0 && (
              <span className="ml-3 hidden sm:inline font-semibold">{formatFCFA(totals.total)}</span>
            )}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="right" className="w-full sm:max-w-md bg-teal-50/30 overflow-y-auto p-0" data-testid="event-cart-drawer">
        {/* Hero strip */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-5">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white text-xl">
              <ShoppingBag className="w-5 h-5" /> Your Event Cart
            </SheetTitle>
            <p className="text-sm text-white/85">
              {count === 0 ? 'Curate your perfect event from a hall, chairs, photographer & more.' : (
                <>
                  <span className="font-semibold">{count}</span> item{count === 1 ? '' : 's'} ready · pick your event date at checkout.
                </>
              )}
            </p>
          </SheetHeader>
        </div>

        <div className="px-5 py-4 space-y-3">
          {count === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-teal-100 mx-auto mb-3 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-teal-500" />
              </div>
              <p className="font-medium text-slate-700 mb-1">Your cart is empty</p>
              <p className="text-xs text-slate-500 max-w-[260px] mx-auto">Add a hall, chairs, photographer or pick a bundle to start curating your event.</p>
            </div>
          ) : (
            <>
              {/* Packages */}
              {cart.packages.map(p => {
                const snap = p.snapshot || {};
                const memberImages = (snap.services || []).flatMap(line => (line.service?.images || []).slice(0, 1)).filter(Boolean);
                const pkgImages = [...((snap.images && snap.images.length) ? snap.images : (snap.image_url ? [snap.image_url] : [])), ...memberImages].filter(Boolean).slice(0, 5);
                return (
                  <div
                    key={p.package_id}
                    className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3 shadow-sm"
                    data-testid={`cart-package-${p.package_id}`}
                  >
                    <div className="flex gap-3">
                      <CartThumbCarousel images={pkgImages} name={snap.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Badge className="bg-teal-600 text-white border-0 text-[10px] mb-1"><PackageIcon className="w-2.5 h-2.5 mr-0.5" /> Bundle</Badge>
                            <p className="font-semibold text-teal-900 leading-tight truncate">{snap.name}</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removePackage(p.package_id)} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0" data-testid={`cart-remove-package-${p.package_id}`}>
                            <X className="w-4 h-4 text-slate-500" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-teal-700 mt-0.5">
                          {snap.services?.length || 0} services
                          {snap.discount_percent > 0 && ` · −${snap.discount_percent}% off`}
                        </p>
                        {snap.subtotal && snap.discount_percent > 0 && (
                          <p className="text-[10px] text-slate-400 line-through">{formatFCFA(snap.subtotal)}</p>
                        )}
                        <div className="mt-1 text-base font-bold text-teal-700">{formatFCFA(snap.total_price || 0)}</div>
                      </div>
                    </div>
                    {/* Member services preview */}
                    {Array.isArray(snap.services) && snap.services.length > 0 && (
                      <ul className="mt-2 pt-2 border-t border-teal-100 space-y-0.5">
                        {snap.services.slice(0, 4).map((line, i) => {
                          const s = line.service || {};
                          const unitPrice = Number(s.base_price ?? line.base_price ?? 0);
                          const unit = s.unit_label || line.unit_label || 'unit';
                          return (
                            <li key={i} className="flex items-center justify-between text-[11px] text-slate-600 gap-2">
                              <span className="truncate flex-1">{s.name || line.service_name || line.service_id}</span>
                              <span className="text-[10px] text-slate-400">{formatFCFA(unitPrice)}/{unit}</span>
                              <span className="font-semibold text-teal-700">× {line.quantity}</span>
                            </li>
                          );
                        })}
                        {snap.services.length > 4 && (
                          <li className="text-[10px] italic text-teal-600">+ {snap.services.length - 4} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Items */}
              {cart.items.map(it => {
                const snap = it.snapshot || {};
                const imgs = snap.images || [];
                const unitPrice = Number(snap.base_price || 0);
                const hours = snap.pricing_model === 'per_hour' ? (it.hours || 1) : 1;
                const lineTotal = unitPrice * (it.quantity || 1) * hours;
                return (
                  <div
                    key={it.service_id}
                    className="rounded-xl border border-teal-100 bg-white p-3 shadow-sm"
                    data-testid={`cart-item-${it.service_id}`}
                  >
                    <div className="flex gap-3">
                      <CartThumbCarousel images={imgs} name={snap.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 leading-tight truncate">{snap.name}</p>
                            <Badge variant="outline" className="text-[10px] mt-1 bg-teal-50 border-teal-200 text-teal-700">
                              {CATEGORY_LABEL[snap.category] || snap.category}
                            </Badge>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(it.service_id)} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0" data-testid={`cart-remove-item-${it.service_id}`}>
                            <Trash2 className="w-4 h-4 text-teal-500" />
                          </Button>
                        </div>
                        {/* Service info: city + capacity (only when available) */}
                        {(snap.city || snap.capacity_max != null) && (
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-slate-500">
                            {snap.city && <span className="inline-flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{snap.city}</span>}
                            {snap.capacity_max != null && (
                              <span className="inline-flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{snap.capacity_min || 0}–{snap.capacity_max}</span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <span>Qty</span>
                            <Input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => updateQty(it.service_id, Math.max(1, Number(e.target.value) || 1))}
                              className="w-16 h-7 text-center"
                              data-testid={`cart-qty-${it.service_id}`}
                            />
                            {snap.unit_label && (
                              <span className="text-[10px] text-slate-500">{snap.unit_label}{it.quantity > 1 ? 's' : ''}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500">{formatFCFA(unitPrice)} / {snap.unit_label || 'unit'}</div>
                            <div className="font-bold text-teal-700">{formatFCFA(lineTotal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totals + Checkout */}
              <div className="bg-white rounded-xl border border-teal-200 p-4 mt-4 space-y-1.5 shadow-sm">
                {totals.bundles > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Bundles</span><span className="font-medium">{formatFCFA(totals.bundles)}</span>
                  </div>
                )}
                {totals.items > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Individual services</span><span className="font-medium">{formatFCFA(totals.items)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-teal-100">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold text-teal-700" data-testid="cart-total">{formatFCFA(totals.total)}</span>
                </div>
              </div>

              <Button
                onClick={goCheckout}
                className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg shadow-teal-500/20"
                size="lg"
                data-testid="event-cart-checkout-btn"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => { if (window.confirm('Clear the cart?')) clear(); }}
                className="w-full text-teal-600 hover:text-teal-700 hover:bg-teal-50"
              >
                Clear cart
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
