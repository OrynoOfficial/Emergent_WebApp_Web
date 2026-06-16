// Persistent event-cart hook.
//
// State shape:
//   {
//     event_date: 'YYYY-MM-DD' | null,
//     expected_guests: number,
//     event_type: string | null,
//     city: string | null,
//     items:   [{ service_id, quantity, hours? , snapshot:{ name, category, base_price, pricing_model, unit_label, operator_id, operator_name } }],
//     packages:[{ package_id, snapshot:{ name, total_price, discount_percent, services } }],
//     last_active_at: number | null  // ms epoch — sliding 10-minute expiry from last interaction
//   }
//
// Persists to localStorage under `oryno:event-cart`. The cart auto-expires
// after 10 minutes of inactivity to release hold on the venue/services.
// Every mutation refreshes `last_active_at`; a window timer fires `clear()`
// once the deadline passes (and on mount if the stored cart is already stale).
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'oryno:event-cart';
const CART_TTL_MS = 10 * 60 * 1000; // 10 minutes

const empty = () => ({
  event_date: null,
  expected_guests: 0,
  event_type: null,
  city: null,
  items: [],
  packages: [],
  last_active_at: null,
});

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

const isStale = (c) => {
  if (!c || (c.items.length === 0 && c.packages.length === 0)) return false;
  if (!c.last_active_at) return false; // legacy entries — treat as fresh
  return Date.now() - c.last_active_at > CART_TTL_MS;
};

export function useEventCart() {
  const [cart, setCart] = useState(() => {
    const initial = read();
    return isStale(initial) ? empty() : initial;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* quota */ }
  }, [cart]);

  // Auto-clear once the sliding 10-min window elapses
  useEffect(() => {
    if (!cart.last_active_at) return undefined;
    if (cart.items.length === 0 && cart.packages.length === 0) return undefined;
    const elapsed = Date.now() - cart.last_active_at;
    const remaining = CART_TTL_MS - elapsed;
    // If already past TTL, fire the clear on the next microtask so the rule
    // doesn't flag a synchronous set-state-in-effect. Functionally identical.
    const t = setTimeout(() => {
      setCart(empty());
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }, Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [cart.last_active_at, cart.items.length, cart.packages.length]);

  // Helper — every mutation also stamps last_active_at so the window slides
  const touch = (next) => ({ ...next, last_active_at: Date.now() });

  const setMeta = useCallback((partial) => {
    setCart(c => touch({ ...c, ...partial }));
  }, []);

  const addItem = useCallback((service, quantity = 1) => {
    setCart(c => {
      const existing = c.items.find(i => i.service_id === service.id);
      if (existing) {
        return touch({
          ...c,
          items: c.items.map(i => i.service_id === service.id
            ? { ...i, quantity: (i.quantity || 0) + quantity }
            : i),
        });
      }
      return touch({
        ...c,
        items: [...c.items, {
          service_id: service.id,
          quantity,
          hours: service.duration_hours || null,
          snapshot: {
            name: service.name,
            category: service.category || 'hall',
            base_price: service.base_price,
            pricing_model: service.pricing_model || service.price_type || 'per_event',
            unit_label: service.unit_label || null,
            operator_id: service.operator_id || null,
            operator_name: service.operator_name || '',
            image: service.images?.[0] || null,
            // `kind: 'item'` flags this line as a rentable banquet_item so the
            // backend cart checkout creates an inventory hold instead of looking
            // it up in the `banquets` collection.
            kind: service._kind || 'service',
          },
        }],
      });
    });
  }, []);

  const updateQty = useCallback((serviceId, quantity) => {
    setCart(c => touch({
      ...c,
      items: c.items.map(i => i.service_id === serviceId ? { ...i, quantity } : i),
    }));
  }, []);

  const removeItem = useCallback((serviceId) => {
    setCart(c => touch({ ...c, items: c.items.filter(i => i.service_id !== serviceId) }));
  }, []);

  const addPackage = useCallback((pkg) => {
    setCart(c => {
      if (c.packages.find(p => p.package_id === pkg.id)) return c;
      return touch({
        ...c,
        packages: [...c.packages, {
          package_id: pkg.id,
          snapshot: {
            name: pkg.name,
            total_price: pkg.total_price,
            discount_percent: pkg.discount_percent,
            services: pkg.services || [],
          },
        }],
      });
    });
  }, []);

  const removePackage = useCallback((packageId) => {
    setCart(c => touch({ ...c, packages: c.packages.filter(p => p.package_id !== packageId) }));
  }, []);

  const clear = useCallback(() => {
    setCart(empty());
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  // Live total — server re-computes authoritatively at checkout but we
  // show this in the drawer so users see the cost as they shop.
  const totals = useMemo(() => {
    let items = 0;
    for (const it of cart.items) {
      const base = Number(it.snapshot?.base_price) || 0;
      const model = it.snapshot?.pricing_model || 'per_event';
      if (model === 'per_hour') {
        items += base * (Number(it.hours) || 1) * (Number(it.quantity) || 1);
      } else {
        items += base * (Number(it.quantity) || 1);
      }
    }
    const bundles = cart.packages.reduce((s, p) => s + (Number(p.snapshot?.total_price) || 0), 0);
    return { items: Math.round(items), bundles: Math.round(bundles), total: Math.round(items + bundles) };
  }, [cart.items, cart.packages]);

  const count = (cart.items?.length || 0) + (cart.packages?.length || 0);

  // Live countdown — sliding 10-minute timer for the cart. Updates every second
  // so the UI can show "Cart expires in 4:32".
  const [expiresInSeconds, setExpiresInSeconds] = useState(null);
  useEffect(() => {
    if (!cart.last_active_at || count === 0) {
      return undefined;
    }
    const tick = () => {
      const left = CART_TTL_MS - (Date.now() - cart.last_active_at);
      setExpiresInSeconds(left > 0 ? Math.ceil(left / 1000) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cart.last_active_at, count]);
  // Reset countdown when cart empties — derived during render keeps the rule happy
  const [prevCount, setPrevCount] = useState(count);
  if (prevCount !== count) {
    setPrevCount(count);
    if (count === 0 && expiresInSeconds !== null) setExpiresInSeconds(null);
  }

  // Public action — manually bump last_active_at to extend the cart hold.
  // Also immediately syncs `expiresInSeconds` so the visible countdown jumps to
  // 10:00 on click (without waiting up to a full second for the next tick).
  const extendHold = useCallback(() => {
    setCart(c => ({ ...c, last_active_at: Date.now() }));
    setExpiresInSeconds(Math.ceil(CART_TTL_MS / 1000));
  }, []);

  return {
    cart, setMeta,
    addItem, updateQty, removeItem,
    addPackage, removePackage,
    clear, totals, count,
    expiresInSeconds,
    cartTtlMs: CART_TTL_MS,
    extendHold,
  };
}
