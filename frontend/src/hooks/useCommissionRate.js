// Resolve the effective commission rate for a booking flow.
// Calls /api/commission-config/resolve which returns the rate applied via the
// platform hierarchy: operator > category > global > 5% hardcoded fallback.
//
// Cached per (service_type, operator_id) for the lifetime of the page so a
// flicker between the default and the resolved value never reaches the UI.

import { useEffect, useState } from 'react';
import api from '@/api/client';

const _cache = new Map(); // key → { rate, source, ts }
const TTL_MS = 5 * 60 * 1000;

export function useCommissionRate(serviceType, operatorId, { fallback = 5 } = {}) {
  const key = `${serviceType || ''}::${operatorId || ''}`;
  const cached = _cache.get(key);
  const fresh = cached && Date.now() - cached.ts < TTL_MS;

  const [state, setState] = useState(() => (
    fresh
      ? { rate: cached.rate, source: cached.source, loading: false }
      : { rate: fallback, source: 'fallback', loading: true }
  ));

  useEffect(() => {
    if (!serviceType) return;
    const cached2 = _cache.get(key);
    if (cached2 && Date.now() - cached2.ts < TTL_MS) {
      setState({ rate: cached2.rate, source: cached2.source, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    api.get('/commission-config/resolve', { params: { service_type: serviceType, operator_id: operatorId || undefined } })
      .then((res) => {
        if (cancelled) return;
        const rate = Number(res.data?.rate ?? fallback);
        const source = res.data?.source || 'fallback';
        _cache.set(key, { rate, source, ts: Date.now() });
        setState({ rate, source, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ rate: fallback, source: 'fallback', loading: false });
      });
    return () => { cancelled = true; };
  }, [key, serviceType, operatorId, fallback]);

  return state;
}

export function getCachedCommissionRate(serviceType, operatorId) {
  const key = `${serviceType || ''}::${operatorId || ''}`;
  const c = _cache.get(key);
  if (!c || Date.now() - c.ts > TTL_MS) return null;
  return c.rate;
}
