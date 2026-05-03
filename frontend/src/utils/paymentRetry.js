/**
 * Re-trigger an already-created payment without recreating the order.
 *
 * Usage inside each booking page's handleSubmit, BEFORE any order/booking
 * creation:
 *
 *     if (orderId) { rePayExisting(setTriggerPayment); return; }
 *
 * This prevents the "cancel modal then re-click Pay" duplicate-order /
 * double-charge bug. PaymentMethodsSelection only fires on a false→true
 * transition of triggerPayment, so we explicitly toggle false then back to
 * true on the next microtask to guarantee the child effect re-runs.
 *
 * @param {(v: boolean) => void} setTriggerPayment
 */
export function rePayExisting(setTriggerPayment) {
  setTriggerPayment(false);
  // Defer to next microtask so React commits the false state before flipping
  // back to true; otherwise the boolean stays true and useEffect won't refire.
  Promise.resolve().then(() => setTriggerPayment(true));
}
