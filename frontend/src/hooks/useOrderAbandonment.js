import { useEffect, useRef } from 'react';
import { abandonPendingOrder } from '@/utils/abandonPendingOrder';

/**
 * Tracks the latest pending orderId and guarantees the order is abandoned
 * (hard-deleted on the server) whenever the user walks away from the flow:
 *   - Tab close / refresh (`beforeunload`)
 *   - React unmount (e.g. router navigation to another page)
 *   - Explicit call to the returned `abandon(reset)` for "user closed the
 *     Stripe/MoMo modal without paying" cases
 *
 * Idempotent — already-paid orders are skipped server-side with a 409 and
 * become no-ops here.
 *
 * Usage:
 *   const { abandon } = useOrderAbandonment(orderId, () => {
 *     setOrderId(null);
 *     setTriggerPayment(false);
 *     ...
 *   });
 *   // In the PaymentMethodsSelection onCheckoutAbandoned callback:
 *   onCheckoutAbandoned={({ orderId }) => abandon(orderId)}
 */
export function useOrderAbandonment(orderId, resetState) {
  const ref = useRef(null);
  const resetRef = useRef(resetState);

  // Keep refs in sync with the latest values without re-binding effects.
  useEffect(() => { ref.current = orderId; }, [orderId]);
  useEffect(() => { resetRef.current = resetState; }, [resetState]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const id = ref.current;
      if (!id) return;
      try {
        const token = localStorage.getItem('access_token');
        const url = `${import.meta.env.VITE_API_URL || ''}/orders/${id}/abandon`;
        if (typeof fetch === 'function') {
          fetch(url, {
            method: 'DELETE',
            keepalive: true,
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      } catch { /* page is going away — swallow */ }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      const id = ref.current;
      if (id) abandonPendingOrder(id);
    };
  }, []);

  // Explicit abandon (e.g. user closed the payment modal). Resets local state
  // via the consumer-provided callback so the next confirm-click starts a
  // fresh order.
  const abandon = async (idOverride) => {
    const id = idOverride || ref.current;
    if (!id) return;
    await abandonPendingOrder(id);
    ref.current = null;
    try { resetRef.current && resetRef.current(); } catch { /* consumer error — non-fatal */ }
  };

  return { abandon };
}
