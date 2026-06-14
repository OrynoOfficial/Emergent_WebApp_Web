// Sliding cart drawer for the Banquet & Event Services flow.
//
// Rose-themed shopping summary mounted on the Results page. The floating
// CTA badge ("Cart · N · Total") opens the drawer; line items show photos
// and per-unit prices for clarity. Persists via `useEventCart`.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, X, Trash2, Package as PackageIcon, Sparkles, ArrowRight } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const CATEGORY_LABEL = {
  hall: 'Hall', rental_item: 'Rental', canopy: 'Canopy',
  photographer: 'Photographer', videographer: 'Videographer',
  catering: 'Catering', decoration: 'Decoration',
  sound_lighting: 'Sound & Lighting', other: 'Other',
};

export default function EventCartDrawer({ cart, updateQty, removeItem, removePackage, totals, count, clear }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // event_date is collected at checkout (mirrors the Laundry flow) — never block here.
  const goCheckout = () => {
    setOpen(false);
    navigate('/services/banquet/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 z-50 rounded-full h-14 px-5 shadow-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white"
          data-testid="event-cart-fab"
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Cart
          {count > 0 && (
            <Badge className="ml-2 bg-white text-rose-700 font-bold" data-testid="event-cart-count">{count}</Badge>
          )}
          {totals.total > 0 && (
            <span className="ml-3 hidden sm:inline font-semibold">{formatFCFA(totals.total)}</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md bg-rose-50/30 overflow-y-auto p-0" data-testid="event-cart-drawer">
        {/* Hero strip */}
        <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white px-6 py-5">
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
              <div className="w-16 h-16 rounded-full bg-rose-100 mx-auto mb-3 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-rose-500" />
              </div>
              <p className="font-medium text-slate-700 mb-1">Your cart is empty</p>
              <p className="text-xs text-slate-500 max-w-[260px] mx-auto">Add a hall, chairs, photographer or pick a bundle to start curating your event.</p>
            </div>
          ) : (
            <>
              {/* Packages */}
              {cart.packages.map(p => {
                const snap = p.snapshot || {};
                const cover = (snap.images && snap.images[0]) || snap.image_url;
                return (
                  <div
                    key={p.package_id}
                    className="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white p-3 shadow-sm"
                    data-testid={`cart-package-${p.package_id}`}
                  >
                    <div className="flex gap-3">
                      {cover ? (
                        <img src={cover} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                          <PackageIcon className="w-7 h-7 text-rose-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Badge className="bg-rose-600 text-white border-0 text-[10px] mb-1"><PackageIcon className="w-2.5 h-2.5 mr-0.5" /> Bundle</Badge>
                            <p className="font-semibold text-rose-900 leading-tight truncate">{snap.name}</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removePackage(p.package_id)} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0">
                            <X className="w-4 h-4 text-slate-500" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          {snap.services?.length || 0} services
                          {snap.discount_percent > 0 && ` · −${snap.discount_percent}% off`}
                        </p>
                        <div className="mt-1.5 text-base font-bold text-rose-700">{formatFCFA(snap.total_price || 0)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Items */}
              {cart.items.map(it => {
                const snap = it.snapshot || {};
                const cover = (snap.images && snap.images[0]) || null;
                const unitPrice = Number(snap.base_price || 0);
                const lineTotal = unitPrice * (it.quantity || 1) * (snap.pricing_model === 'per_hour' ? (it.hours || 1) : 1);
                return (
                  <div
                    key={it.service_id}
                    className="rounded-xl border border-rose-100 bg-white p-3 shadow-sm"
                    data-testid={`cart-item-${it.service_id}`}
                  >
                    <div className="flex gap-3">
                      {cover ? (
                        <img src={cover} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 leading-tight truncate">{snap.name}</p>
                            <Badge variant="outline" className="text-[10px] mt-1 bg-rose-50 border-rose-200 text-rose-700">
                              {CATEGORY_LABEL[snap.category] || snap.category}
                            </Badge>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(it.service_id)} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0">
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </Button>
                        </div>
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
                            <div className="font-bold text-rose-700">{formatFCFA(lineTotal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totals + Checkout */}
              <div className="bg-white rounded-xl border border-rose-200 p-4 mt-4 space-y-1.5 shadow-sm">
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
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-rose-100">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold text-rose-700" data-testid="cart-total">{formatFCFA(totals.total)}</span>
                </div>
              </div>

              <Button
                onClick={goCheckout}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-lg shadow-rose-500/20"
                size="lg"
                data-testid="event-cart-checkout-btn"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => { if (window.confirm('Clear the cart?')) clear(); }}
                className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
