// Sliding cart drawer for the Banquet & Event Services flow.
//
// Mounted once on the Results page. The floating CTA badge ("Cart · N")
// opens the drawer; inside the user can change quantities, remove items
// or hit Checkout. Persists via `useEventCart` so a refresh / browser
// re-open keeps state.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, X, Trash2, Package as PackageIcon } from 'lucide-react';
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

  const goCheckout = () => {
    if (!cart.event_date) {
      alert('Please pick an event date first (on the search bar).');
      return;
    }
    setOpen(false);
    navigate('/services/banquet/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 z-50 rounded-full h-14 px-5 shadow-2xl bg-purple-600 hover:bg-purple-700"
          data-testid="event-cart-fab"
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Cart
          {count > 0 && (
            <Badge className="ml-2 bg-white text-purple-700 font-bold" data-testid="event-cart-count">{count}</Badge>
          )}
          {totals.total > 0 && (
            <span className="ml-3 hidden sm:inline font-semibold">{formatFCFA(totals.total)}</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md bg-white overflow-y-auto" data-testid="event-cart-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Your Event Cart
          </SheetTitle>
          <p className="text-sm text-slate-500">
            {cart.event_date ? `Event date: ${cart.event_date}` : 'No event date selected yet.'}
            {cart.expected_guests ? ` • ${cart.expected_guests} guests` : ''}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {count === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Your cart is empty. Add a hall, chairs, photographer or pick a bundle to start.</p>
            </div>
          ) : (
            <>
              {/* Packages */}
              {cart.packages.map(p => (
                <div key={p.package_id} className="rounded-lg border border-purple-200 bg-purple-50 p-3" data-testid={`cart-package-${p.package_id}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <PackageIcon className="w-4 h-4 text-purple-700" />
                        <span className="font-semibold text-purple-900">{p.snapshot?.name}</span>
                      </div>
                      <div className="text-xs text-purple-700 mt-1">
                        {p.snapshot?.services?.length || 0} services bundled
                        {p.snapshot?.discount_percent > 0 && ` · -${p.snapshot.discount_percent}%`}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removePackage(p.package_id)} className="h-7 w-7">
                      <X className="w-4 h-4 text-slate-500" />
                    </Button>
                  </div>
                  <div className="mt-2 font-bold text-purple-900">{formatFCFA(p.snapshot?.total_price || 0)}</div>
                </div>
              ))}

              {/* Individual items */}
              {cart.items.map(it => (
                <div key={it.service_id} className="rounded-lg border bg-white p-3 shadow-sm" data-testid={`cart-item-${it.service_id}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{it.snapshot?.name}</div>
                      <Badge variant="outline" className="text-xs mt-1">{CATEGORY_LABEL[it.snapshot?.category] || it.snapshot?.category}</Badge>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(it.service_id)} className="h-7 w-7">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <span>Qty</span>
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => updateQty(it.service_id, Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 h-8"
                        data-testid={`cart-qty-${it.service_id}`}
                      />
                      {it.snapshot?.unit_label && <span className="text-xs text-slate-500">{it.snapshot.unit_label}{it.quantity > 1 ? 's' : ''}</span>}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatFCFA((it.snapshot?.base_price || 0) * (it.quantity || 1) * (it.snapshot?.pricing_model === 'per_hour' ? (it.hours || 1) : 1))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals + Checkout */}
              <div className="border-t pt-4 mt-4 space-y-2">
                {totals.bundles > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Bundles</span><span>{formatFCFA(totals.bundles)}</span>
                  </div>
                )}
                {totals.items > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Individual services</span><span>{formatFCFA(totals.items)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-purple-700" data-testid="cart-total">{formatFCFA(totals.total)}</span>
                </div>
                <Button onClick={goCheckout} className="w-full bg-purple-600 hover:bg-purple-700 mt-2" data-testid="event-cart-checkout-btn">
                  Proceed to Checkout
                </Button>
                <Button variant="ghost" onClick={() => { if (confirm('Clear the cart?')) clear(); }} className="w-full text-rose-600">
                  Clear cart
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
