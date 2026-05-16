import api from '@/api/client';

/**
 * Hard-deletes a pending unpaid order so it doesn't linger when the user
 * abandons the payment flow. Idempotent — safe to call even if the order is
 * already gone, but logs (not toasts) failures because this fires on UX exits
 * where surfacing an error would be noisy.
 *
 * Returns true if the order was abandoned (or was already gone), false if
 * the server refused (e.g. already paid).
 */
export async function abandonPendingOrder(orderId) {
  if (!orderId) return true;
  try {
    await api.delete(`/orders/${orderId}/abandon`);
    return true;
  } catch (err) {
    // 409 = order is already paid / processed — don't delete, don't shout
    if (err?.response?.status === 409) return false;
    // Network or other error — log but don't block the user's exit path
    console.warn('[abandonPendingOrder] failed for', orderId, err?.response?.data || err?.message);
    return false;
  }
}
