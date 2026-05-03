/**
 * Re-trigger an already-created payment without recreating the order.
 *
 * Usage inside each booking page's handleSubmit, BEFORE any order/booking
 * creation:
 *
 *     if (orderId) { rePayExisting(setTriggerPayment, setPaymentInProgress); return; }
 *
 * This prevents the "cancel modal then re-click Pay" duplicate-order /
 * double-charge bug. The trick is that React won't fire a useEffect on the
 * same true→true state. We toggle to false and re-set to true in a microtask
 * so the child component's effect re-runs and reopens the payment dialog.
 *
 * @param {(v: boolean) => void} setTriggerPayment
 * @param {(v: boolean) => void} [setPaymentInProgress]
 */
export function rePayExisting(setTriggerPayment, setPaymentInProgress) {
  if (setPaymentInProgress) setPaymentInProgress(true);
  setTriggerPayment(false);
  // Defer to next microtask so React commits the false state before flipping
  // back to true; otherwise the boolean stays true and useEffect won't refire.
  Promise.resolve().then(() => setTriggerPayment(true));
}
