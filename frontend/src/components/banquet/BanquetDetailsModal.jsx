// Customer-facing detail modal for Banquet services and packages.
//
// Hero gallery is swipeable (touch + click + dots + arrows), info is
// richer than the card. Clicking a member service inside a Package
// modal opens a NESTED ServiceDetails dialog on top; the parent stays
// open until that nested dialog is dismissed.
import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  MapPin, Users, Phone, Mail, Building2, Box, Layers,
  ChevronLeft, ChevronRight, Plus, Minus, Package as PackageIcon, Sparkles,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

const PRICING_SUFFIX = {
  per_event: 'flat', per_person: '/ person', per_hour: '/ hour',
  per_unit: '', flat_fee: 'flat',
};

const PLACEHOLDER = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200';

// ── Swipeable gallery (touch + arrows + dots) ───────────────────────────────
function SwipeableGallery({ images, name, height = 'h-72' }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const safe = images && images.length > 0 ? images : [PLACEHOLDER];

  const scrollTo = (i) => {
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
    <div className={`relative ${height} bg-slate-100 overflow-hidden`} data-testid="banquet-modal-gallery">
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
          {/* Always-visible arrows so customers don't have to guess that the gallery is swipeable */}
          <button
            type="button"
            onClick={() => scrollTo(Math.max(0, idx - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-white shadow flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 text-pink-700" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(Math.min(safe.length - 1, idx + 1))}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-white shadow flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 text-pink-700" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {safe.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-6' : 'bg-white/60 w-1.5'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── SERVICE details — used standalone AND as the nested view ────────────────
function ServiceDetails({ svc, qtyInCart, onAdd, onSetQty, hideAddCta = false }) {
  const detailEntries = Object.entries(svc.category_details || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
  const inCart = qtyInCart > 0;

  return (
    <>
      <SwipeableGallery images={svc.images} name={svc.name} />
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{svc.name}</h2>
            {svc.description && (
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{svc.description}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right bg-pink-50 rounded-lg px-3 py-2 border border-pink-200">
            <div className="text-[10px] uppercase tracking-wider text-pink-700 font-semibold">From</div>
            <div className="text-2xl font-bold text-pink-700 leading-tight">{formatFCFA(svc.base_price || 0)}</div>
            <div className="text-[11px] text-pink-700/70">{svc.unit_label ? `/ ${svc.unit_label}` : PRICING_SUFFIX[svc.pricing_model] || ''}</div>
          </div>
        </div>

        {(svc.address || svc.city) && (
          <div className="flex items-start gap-2 rounded-lg bg-pink-50/70 px-3 py-2 border border-pink-100">
            <MapPin className="w-4 h-4 text-pink-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{svc.address || svc.city}</p>
              {svc.address && svc.city && <p className="text-xs text-pink-700 font-medium">{svc.city}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {(svc.capacity_min != null || svc.capacity_max != null) && (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Capacity</div>
              <div className="font-medium flex items-center gap-1.5 mt-0.5"><Users className="w-4 h-4 text-pink-600" />{svc.capacity_min || 0}–{svc.capacity_max || '∞'} guests</div>
            </div>
          )}
          {svc.duration_hours && (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Default duration</div>
              <div className="font-medium flex items-center gap-1.5 mt-0.5"><Layers className="w-4 h-4 text-pink-600" />{svc.duration_hours}h</div>
            </div>
          )}
          {svc.unit_label && (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Sold by</div>
              <div className="font-medium flex items-center gap-1.5 mt-0.5"><Box className="w-4 h-4 text-pink-600" />per {svc.unit_label}{svc.min_quantity ? ` (min ${svc.min_quantity})` : ''}</div>
            </div>
          )}
          {svc.operator_name && (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Operator</div>
              <div className="font-medium flex items-center gap-1.5 mt-0.5"><Building2 className="w-4 h-4 text-pink-600" />{svc.operator_name}</div>
            </div>
          )}
        </div>

        {(svc.phone || svc.email) && (
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            {svc.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-pink-600" />{svc.phone}</span>}
            {svc.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-pink-600" />{svc.email}</span>}
          </div>
        )}

        {detailEntries.length > 0 && (
          <div>
            <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-1.5">Details</p>
            <div className="grid grid-cols-2 gap-2">
              {detailEntries.map(([k, v]) => (
                <div key={k} className="bg-pink-50/50 rounded px-2.5 py-1.5 border border-pink-100">
                  <div className="text-[10px] text-pink-700 capitalize">{String(k).replace(/_/g, ' ')}</div>
                  <div className="text-xs font-medium text-slate-800 truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(svc.amenities) && svc.amenities.length > 0 && (
          <div>
            <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-1.5">Includes</p>
            <div className="flex flex-wrap gap-1.5">
              {svc.amenities.map(a => (
                <Badge key={a} variant="outline" className="bg-pink-50 text-pink-800 border-pink-200 capitalize">{String(a).replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
        )}

        {!hideAddCta && (
          <div className="flex items-center justify-between pt-3 border-t border-pink-100">
            {inCart ? (
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="outline" className="h-9 w-9 border-pink-300" onClick={() => onSetQty(Math.max(1, qtyInCart - 1))}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <Input
                  type="number" min="1" value={qtyInCart}
                  onChange={(e) => onSetQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 h-9 text-center"
                  data-testid="modal-qty-input"
                />
                <Button size="icon" variant="outline" className="h-9 w-9 border-pink-300" onClick={() => onSetQty(qtyInCart + 1)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Add to your event cart</span>
            )}
            <Button
              onClick={inCart ? null : onAdd}
              disabled={inCart}
              className="bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 text-white"
              data-testid="modal-add-to-cart"
            >
              {inCart ? <><Sparkles className="w-4 h-4 mr-1.5" /> In cart</> : <><Plus className="w-4 h-4 mr-1.5" /> Add to Cart</>}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ── PACKAGE details — uses enriched `line.service` for accurate prices ─────
function PackageDetails({ pkg, inCart, onAdd, onRemove, onPickService }) {
  // Each line.service is the FULL service doc (fields enriched by backend).
  // Falls back to legacy fields when older clients haven't been updated.
  const memberSvcs = (pkg.services || []).map(line => ({
    ...line,
    full: line.service || {
      id: line.service_id,
      name: line.service_name,
      category: line.category,
      base_price: line.base_price,
      unit_label: line.unit_label,
      pricing_model: line.pricing_model,
      images: [],
    },
  }));

  const galleryImages = [
    ...((pkg.images || []).length ? pkg.images : []),
    ...memberSvcs.flatMap(m => (m.full.images || []).slice(0, 1)),
  ].filter(Boolean).slice(0, 8);

  return (
    <>
      <SwipeableGallery images={galleryImages} name={pkg.name} />
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Badge className="bg-pink-100 text-pink-700 border-0 mb-1.5">
              <PackageIcon className="w-3 h-3 mr-1" /> Bundle
            </Badge>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{pkg.name}</h2>
            {pkg.description && (
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{pkg.description}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right bg-pink-50 rounded-lg px-3 py-2 border border-pink-200">
            <div className="text-[10px] uppercase tracking-wider text-pink-700 font-semibold">Bundle</div>
            <div className="text-2xl font-bold text-pink-700 leading-tight">{formatFCFA(pkg.total_price || 0)}</div>
            {pkg.discount_percent > 0 && pkg.subtotal && (
              <div className="text-[11px] text-slate-400 line-through">{formatFCFA(pkg.subtotal)}</div>
            )}
          </div>
        </div>

        {/* Member services — clickable cards open a nested ServiceDetails modal */}
        <div>
          <p className="text-[11px] uppercase text-slate-500 tracking-wide font-semibold mb-2">
            Includes {memberSvcs.length} services
          </p>
          <div className="space-y-2">
            {memberSvcs.map((m, i) => {
              const f = m.full || {};
              const cover = (f.images || [])[0];
              const unitPrice = Number(f.base_price || 0);
              const unitLabel = f.unit_label || PRICING_SUFFIX[f.pricing_model] || 'unit';
              const lineTotal = unitPrice * Number(m.quantity || 0);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => onPickService(f)}
                  className="w-full text-left flex items-center gap-3 p-2.5 bg-white border border-pink-100 hover:border-pink-300 hover:shadow-md rounded-lg shadow-sm transition group"
                  data-testid={`package-member-${m.service_id}`}
                >
                  {cover ? (
                    <img src={cover} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-pink-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-pink-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      {f.name || m.service_name || m.service_id}
                      <ChevronRight className="w-3.5 h-3.5 text-pink-400 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {unitPrice > 0 ? formatFCFA(unitPrice) : 'Price on request'} <span className="text-slate-400">/ {unitLabel}</span>
                    </div>
                    {f.city && (
                      <div className="text-[10px] text-pink-700 mt-0.5">{f.city}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-800">× {m.quantity}</div>
                    {lineTotal > 0 && (
                      <div className="text-[11px] text-pink-700 font-medium">{formatFCFA(lineTotal)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-pink-50 rounded-lg p-3 border border-pink-200 text-sm">
          {pkg.subtotal && (
            <div className="flex justify-between text-slate-700"><span>Subtotal</span><span>{formatFCFA(pkg.subtotal)}</span></div>
          )}
          {pkg.discount_percent > 0 && pkg.subtotal && (
            <div className="flex justify-between text-pink-700"><span>Discount ({pkg.discount_percent}%)</span><span>−{formatFCFA(pkg.subtotal - pkg.total_price)}</span></div>
          )}
          <div className="flex justify-between mt-1.5 pt-1.5 border-t border-pink-200">
            <span className="font-semibold">Bundle total</span>
            <span className="text-xl font-bold text-pink-700">{formatFCFA(pkg.total_price || 0)}</span>
          </div>
        </div>

        <div className="pt-2">
          {inCart ? (
            <Button onClick={onRemove} variant="outline" className="w-full border-pink-300 text-pink-700" data-testid="modal-remove-package">
              Remove from cart
            </Button>
          ) : (
            <Button onClick={onAdd} className="w-full bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 text-white" data-testid="modal-add-package">
              <Plus className="w-4 h-4 mr-1.5" /> Add Bundle to Cart
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Wrapper Dialog (handles parent + nested service modal) ─────────────────
export default function BanquetDetailsModal({
  open, onOpenChange, item, services = [],
  qtyInCart = 0, inCart = false,
  onAdd, onSetQty, onRemove,
}) {
  // Nested-service overlay state. When a customer taps a member service
  // inside a Package modal, we open a SECOND dialog on top — the parent
  // package dialog STAYS open until this overlay is dismissed.
  const [nestedSvc, setNestedSvc] = useState(null);

  // Reset overlay every time the parent dialog closes so re-opening starts clean.
  const handleOpenChange = (v) => {
    if (!v) setNestedSvc(null);
    onOpenChange(v);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl bg-white p-0 max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogTitle className="sr-only">{item?.name || 'Event service details'}</DialogTitle>
          <DialogDescription className="sr-only">Detailed information about this event service or bundle.</DialogDescription>
          {item?._type === 'package' ? (
            <PackageDetails
              pkg={item}
              inCart={inCart}
              onAdd={onAdd}
              onRemove={onRemove}
              onPickService={(svc) => setNestedSvc(svc)}
            />
          ) : item ? (
            <ServiceDetails svc={item} qtyInCart={qtyInCart} onAdd={onAdd} onSetQty={onSetQty} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Nested overlay — only mounts on top of an OPEN parent. The parent
          stays open because we don't change its `open` prop. */}
      <Dialog open={!!nestedSvc} onOpenChange={(v) => { if (!v) setNestedSvc(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogTitle className="sr-only">{nestedSvc?.name || 'Service details'}</DialogTitle>
          <DialogDescription className="sr-only">Detailed information for this bundled service.</DialogDescription>
          {nestedSvc && (
            <ServiceDetails svc={nestedSvc} qtyInCart={0} onAdd={() => {}} onSetQty={() => {}} hideAddCta />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
