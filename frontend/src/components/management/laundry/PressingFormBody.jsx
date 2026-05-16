import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Shirt, Droplets, Trash2, Plus, X, Sparkles, Truck, Clock, Banknote, CreditCard, Wallet,
} from 'lucide-react';
import api from '@/api/client';

const SHOP_TYPES = [
  { value: 'laundry',  label: 'Laundry',  hint: 'Bulk wash priced per kilo',          icon: Droplets },
  { value: 'pressing', label: 'Pressing', hint: 'Per-item pricing (shirt, suit, …)', icon: Sparkles },
  { value: 'both',     label: 'Both',     hint: 'Laundry by kilo + per-item pressing', icon: Shirt },
];

const SERVICE_TAGS = ['washing', 'dry_cleaning', 'ironing', 'folding', 'express', 'pickup_delivery'];

/**
 * The form body rendered inside the Add/Edit Pressing Shop modal.
 *
 * Owns no fetching of its own EXCEPT loading the preset item-catalog from
 * `/api/pressing/item-presets` — used purely as quick-add suggestions when the
 * shop type is "pressing" or "both".
 *
 * Props:
 *   form          — the controlled form state
 *   setForm       — the React setter for the form state
 *   OperatorSelector — JSX element (we receive it from the parent so this
 *                     component doesn't need to know about its imports)
 */
export default function PressingFormBody({ form, setForm, operatorSelector }) {
  const [presets, setPresets] = useState([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Lazy-load presets only when the shop_type uses per-item pricing.
  useEffect(() => {
    if (presets.length > 0) return;
    if (form.shop_type === 'laundry') return;
    api.get('/pressing/item-presets')
      .then((res) => setPresets(res.data?.presets || []))
      .catch(() => setPresets([]));
  }, [form.shop_type, presets.length]);

  const togglePreset = (label) => {
    const exists = (form.item_prices || []).some((i) => i.item === label);
    if (exists) {
      setForm((p) => ({ ...p, item_prices: (p.item_prices || []).filter((i) => i.item !== label) }));
    } else {
      setForm((p) => ({ ...p, item_prices: [...(p.item_prices || []), { item: label, price: 0 }] }));
    }
  };

  const updateItemPrice = (idx, value) => {
    setForm((p) => ({
      ...p,
      item_prices: (p.item_prices || []).map((i, k) => (k === idx ? { ...i, price: value } : i)),
    }));
  };

  const removeItem = (idx) => setForm((p) => ({
    ...p,
    item_prices: (p.item_prices || []).filter((_, k) => k !== idx),
  }));

  const addCustomItem = () => {
    const label = newItemLabel.trim();
    const price = Number(newItemPrice);
    if (!label || !(price > 0)) return;
    if ((form.item_prices || []).some((i) => i.item.toLowerCase() === label.toLowerCase())) {
      setNewItemLabel('');
      setNewItemPrice('');
      return;
    }
    setForm((p) => ({ ...p, item_prices: [...(p.item_prices || []), { item: label, price }] }));
    setNewItemLabel('');
    setNewItemPrice('');
  };

  const showPerKg = form.shop_type === 'laundry' || form.shop_type === 'both';
  const showPerItem = form.shop_type === 'pressing' || form.shop_type === 'both';

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Shop type ─────────────────────────────────────────── */}
      <section data-testid="shop-type-section">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Shop type</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SHOP_TYPES.map((opt) => {
            const Icon = opt.icon;
            const active = form.shop_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({
                  ...p,
                  shop_type: opt.value,
                  // Clean up the now-irrelevant slot to keep the preview honest.
                  price_per_kg: opt.value === 'pressing' ? '' : p.price_per_kg,
                  item_prices: opt.value === 'laundry' ? [] : p.item_prices,
                }))}
                data-testid={`shop-type-${opt.value}`}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? 'border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
                  <span className={`text-sm font-semibold ${active ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 2: Pricing ───────────────────────────────────────────── */}
      <section data-testid="pricing-section">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Pricing</Label>

        {showPerKg && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3" data-testid="per-kg-block">
            <Label className="text-xs">Price per Kilo (FCFA) *</Label>
            <Input
              type="number"
              min={0}
              value={form.price_per_kg}
              onChange={(e) => setForm((p) => ({ ...p, price_per_kg: e.target.value }))}
              placeholder="e.g. 1500"
              data-testid="price-per-kg-input"
            />
            <p className="text-[11px] text-slate-500 mt-1">Charged on the total weight of clothes dropped off.</p>
          </div>
        )}

        {showPerItem && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-3" data-testid="per-item-block">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Per-item prices (FCFA) *</Label>
              <span className="text-[11px] text-slate-400">{(form.item_prices || []).length} item{(form.item_prices || []).length === 1 ? '' : 's'}</span>
            </div>

            {/* Preset chips */}
            {presets.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 mb-1.5">Quick add — tick what you offer, then set the price below:</p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((label) => {
                    const selected = (form.item_prices || []).some((i) => i.item === label);
                    return (
                      <Badge
                        key={label}
                        variant={selected ? 'default' : 'outline'}
                        onClick={() => togglePreset(label)}
                        className={`cursor-pointer ${selected ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        data-testid={`preset-chip-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                      >
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-item rows */}
            {(form.item_prices || []).length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                No items yet — pick from the chips above or add your own below.
              </div>
            ) : (
              <div className="space-y-1.5" data-testid="item-price-rows">
                {(form.item_prices || []).map((row, idx) => (
                  <div key={`${row.item}-${idx}`} className="flex items-center gap-2" data-testid={`item-price-row-${idx}`}>
                    <span className="flex-1 text-sm text-slate-800 truncate" title={row.item}>{row.item}</span>
                    <div className="relative w-32">
                      <Input
                        type="number"
                        min={0}
                        value={row.price}
                        onChange={(e) => updateItemPrice(idx, e.target.value)}
                        placeholder="0"
                        className="pr-12 h-8 text-sm"
                        data-testid={`item-price-input-${idx}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">FCFA</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1 hover:bg-red-50 rounded text-red-600"
                      title="Remove"
                      data-testid={`remove-item-${idx}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom add row */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Custom item (e.g. Wedding Dress)"
                className="flex-1 h-8 text-sm"
                data-testid="new-item-label-input"
              />
              <Input
                type="number"
                min={0}
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                className="w-24 h-8 text-sm"
                data-testid="new-item-price-input"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCustomItem}
                disabled={!newItemLabel.trim() || !(Number(newItemPrice) > 0)}
                data-testid="add-custom-item-btn"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 3: Identity ─────────────────────────────────────────── */}
      <section>
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Shop identity</Label>
        <div className="mt-2 space-y-3">
          <div>
            <Label className="text-xs">Shop name *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Royal Pressing" data-testid="shop-name-input" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="A short pitch — what you specialise in, why customers love you…"
              className="min-h-[68px]"
              data-testid="shop-description-input"
            />
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Contact & location ───────────────────────────────── */}
      <section>
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Location & contact</Label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Address *</Label>
            <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Street, neighbourhood, landmark" data-testid="shop-address-input" />
          </div>
          <div>
            <Label className="text-xs">City *</Label>
            <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Douala" data-testid="shop-city-input" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+237 6XX XX XX XX" data-testid="shop-phone-input" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@shop.cm" data-testid="shop-email-input" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="+237…" data-testid="shop-whatsapp-input" />
          </div>
          <div>
            <Label className="text-xs">Instagram handle</Label>
            <Input value={form.instagram} onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))} placeholder="@yourshop" data-testid="shop-instagram-input" />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://" data-testid="shop-website-input" />
          </div>
        </div>
      </section>

      {/* ── SECTION 5: Service tags ──────────────────────────────────────── */}
      <section>
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Services offered</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_TAGS.map((service) => {
            const selected = (form.services || []).includes(service);
            return (
              <Badge
                key={service}
                variant={selected ? 'default' : 'outline'}
                className={`cursor-pointer capitalize ${selected ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    services: selected
                      ? (p.services || []).filter((s) => s !== service)
                      : [...(p.services || []), service],
                  }))
                }
                data-testid={`service-tag-${service}`}
              >
                {service.replace(/_/g, ' ')}
              </Badge>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 6: Logistics ─────────────────────────────────────────── */}
      <section>
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Logistics & turnaround</Label>
        <div className="mt-2 space-y-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-800">Standard turnaround</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={form.turnaround_hours}
                onChange={(e) => setForm((p) => ({ ...p, turnaround_hours: e.target.value }))}
                className="w-20 h-8 text-sm"
                data-testid="turnaround-hours-input"
              />
              <span className="text-xs text-slate-500">hours</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-800">Pickup & delivery</span>
              </div>
              <Switch
                checked={!!form.delivery_available}
                onCheckedChange={(v) => setForm((p) => ({ ...p, delivery_available: v }))}
                data-testid="delivery-available-switch"
              />
            </div>
            {form.delivery_available && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Delivery fee (FCFA)</Label>
                  <Input type="number" min={0} value={form.delivery_fee} onChange={(e) => setForm((p) => ({ ...p, delivery_fee: e.target.value }))} className="h-8 text-sm" data-testid="delivery-fee-input" />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Pickup radius (km)</Label>
                  <Input type="number" min={0} value={form.pickup_radius_km} onChange={(e) => setForm((p) => ({ ...p, pickup_radius_km: e.target.value }))} className="h-8 text-sm" data-testid="pickup-radius-input" />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-800">Express service</span>
              </div>
              <Switch
                checked={!!form.express_available}
                onCheckedChange={(v) => setForm((p) => ({ ...p, express_available: v }))}
                data-testid="express-available-switch"
              />
            </div>
            {form.express_available && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Express surcharge (%)</Label>
                  <Input type="number" min={0} value={form.express_surcharge} onChange={(e) => setForm((p) => ({ ...p, express_surcharge: e.target.value }))} className="h-8 text-sm" data-testid="express-surcharge-input" />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Min. order (FCFA)</Label>
                  <Input type="number" min={0} value={form.min_order_amount} onChange={(e) => setForm((p) => ({ ...p, min_order_amount: e.target.value }))} className="h-8 text-sm" data-testid="min-order-input" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: Accepted payments ────────────────────────────────── */}
      <section>
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Accepted payments</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { key: 'accepts_momo', label: 'Mobile money', icon: Wallet },
            { key: 'accepts_card', label: 'Card',          icon: CreditCard },
            { key: 'accepts_cash', label: 'Cash',          icon: Banknote },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = !!form[opt.key];
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => setForm((p) => ({ ...p, [opt.key]: !p[opt.key] }))}
                data-testid={`payment-${opt.key}`}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2 flex items-center gap-2 text-sm transition ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 8: Operator selector ────────────────────────────────── */}
      {operatorSelector && (
        <section>
          <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Operator</Label>
          <div className="mt-2">{operatorSelector}</div>
        </section>
      )}
    </div>
  );
}
