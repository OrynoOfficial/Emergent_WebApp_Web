// Shared checkout flow for all booking pages.
//
// Replaces the duplicated state + handlers that lived in every booking page:
//   - paymentInProgress / showPaymentOverlay / triggerPayment / selectedPaymentMethod
//   - orderId + useOrderAbandonment + handleCheckoutAbandoned
//   - handlePaymentInitiated / handlePaymentError
//   - api.post('/orders/create', orderPayload) + setOrderId + triggerPayment
//   - rePayExisting on a second submit
//   - promo-code apply / clear via /api/promo-codes/validate
//
// Each booking page now only describes the service-specific bits (service_type,
// payload shape, success message) and renders <CheckoutPaymentPanel checkout={…} />.
//
// Returns:
//   {
//     state: { orderId, paymentInProgress, showPaymentOverlay, triggerPayment, selectedPaymentMethod },
//     setSelectedPaymentMethod,
//     submit,                  // call from your Confirm button
//     handlePaymentInitiated,  // wired into PaymentMethodsSelection
//     handlePaymentError,
//     handleCheckoutAbandoned,
//     promo: { code, setCode, applied, applying, apply, clear, discount },
//   }

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/api/client';
import { rePayExisting } from '@/utils/paymentRetry';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';

export function useCheckout(serviceType, {
  // Operator scope — used only for promo-code validation (operator-scoped codes).
  operatorId = null,
  // Returns the service-specific order payload merged into the base shape.
  // Required. Must return an object with at least `total_amount` and either
  // `service_id` + `service_name` OR all the fields your /orders/create needs.
  buildPayload,
  // Optional sync validator. Return `false` (and toast the reason yourself)
  // to short-circuit the submit. Default: always pass.
  validate = () => true,
  // What to navigate to on a successful payment. Default '/orders'.
  successPath = '/orders',
  // Toast string shown after a successful payment.
  successMessage = 'Booking confirmed!',
  // Error toast on /orders/create failure. Default copy.
  createErrorMessage = 'Failed to create booking',
  // Hook called *after* a successful payment, before the navigate.
  // Useful for recording promo usage or clearing sessionStorage.
  onSuccess = null,
  // Optional callback fired after the order is abandoned (modal closed,
  // page unload, navigation). Lets pages reset their own service-specific
  // state (e.g. currentStep) that lives outside the hook.
  onAbandon = null,
  // ── Custom order-creation endpoint ────────────────────────────────────
  // Default is `POST /orders/create` with the standard wrapper shape.
  // Pages that already have a domain-specific reservation endpoint
  // (e.g. `/event-showtimes/book`, `/banquets/cart/checkout`) set this
  // to that path. When set, `buildPayload` returns the EXACT body the
  // endpoint expects (no service_type/currency wrapper is added), and
  // `extractOrderId(resData)` pulls the order id out of the response
  // (default: `resData.order_id || resData.id`).
  customOrderEndpoint = null,
  extractOrderId = (data) => data?.order_id || data?.id,
} = {}) {
  const navigate = useNavigate();

  const [orderId, setOrderId] = useState(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Promo-code state (centralised — same /api/promo-codes/validate flow on every page).
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoApplying, setPromoApplying] = useState(false);

  // Reset the local state when an order is abandoned (modal closed, navigation, etc.).
  const { abandon: abandonOrder } = useOrderAbandonment(orderId, () => {
    setOrderId(null);
    setTriggerPayment(false);
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    if (typeof onAbandon === 'function') {
      try { onAbandon(); } catch { /* non-fatal */ }
    }
  });

  const handleCheckoutAbandoned = useCallback(({ orderId: id } = {}) => {
    abandonOrder(id);
  }, [abandonOrder]);

  const handlePaymentInitiated = useCallback(async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

    // Stripe / MoMo modal opened — not a payment outcome yet.
    if (response?.opening_modal) return;

    if (response?.redirectUrl) {
      toast.info('Redirecting to payment...');
      window.location.href = response.redirectUrl;
      return;
    }

    if (response?.success || response?.transactionRef) {
      if (typeof onSuccess === 'function') {
        try { await onSuccess({ orderId, response }); } catch { /* non-blocking */ }
      }
      toast.success(successMessage);
      navigate(successPath);
    }
  }, [navigate, onSuccess, orderId, successMessage, successPath]);

  const handlePaymentError = useCallback((error) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    toast.error(error?.message || 'Payment failed');
  }, []);

  // The user-facing Confirm button calls this.
  const submit = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!validate()) return;

    // Retry an existing pending order (after the user cancelled the gateway modal).
    if (orderId) { rePayExisting(setTriggerPayment); return; }

    // Start the overlay BEFORE buildPayload runs, since pages with multi-step
    // prep (e.g. PackageBooking: create package -> create order) need the spinner
    // visible through the whole flow.
    setPaymentInProgress(true);
    setShowPaymentOverlay(true);

    let payload;
    try {
      payload = await buildPayload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Could not prepare booking');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
      return;
    }
    if (!payload) {
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
      return;
    }

    // Build the request body. Custom endpoints get the payload verbatim
    // (they have their own wire contract); the default /orders/create
    // path merges the payload into the standard wrapper.
    const orderPayload = customOrderEndpoint
      ? payload
      : {
          service_type: serviceType,
          currency: 'XAF',
          status: 'pending',
          payment_status: 'pending',
          ...payload,
        };

    try {
      const response = await api.post(customOrderEndpoint || '/orders/create', orderPayload);
      const newId = extractOrderId(response.data);
      if (newId) {
        setOrderId(newId);
        setTriggerPayment(true);
      } else {
        toast.error('Server did not return an order id');
        setPaymentInProgress(false);
        setShowPaymentOverlay(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || createErrorMessage);
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  }, [validate, orderId, buildPayload, serviceType, createErrorMessage]);

  // Promo-code helpers — used as `promo.apply(orderAmount)`.
  const applyPromo = useCallback(async (orderAmount) => {
    const code = (promoCode || '').trim();
    if (!code) return null;
    setPromoApplying(true);
    try {
      const res = await api.post('/promo-codes/validate', {
        code,
        service_type: serviceType,
        order_amount: orderAmount,
        operator_id: operatorId,
      });
      const data = res.data || {};
      if (data.valid === false) {
        toast.error(data.message || 'Promo code is not valid');
        setPromoApplied(null);
        return null;
      }
      const applied = {
        code: data.code || code,
        discount_percent: data.discount_type === 'percentage' ? data.discount_value : null,
        discount_amount: data.discount_amount ?? (data.discount_type === 'fixed' ? data.discount_value : null),
        message: data.name || `Promo "${code}" applied`,
      };
      setPromoApplied(applied);
      toast.success(applied.message);
      return applied;
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not validate promo code');
      setPromoApplied(null);
      return null;
    } finally {
      setPromoApplying(false);
    }
  }, [promoCode, serviceType, operatorId]);

  const clearPromo = useCallback(() => {
    setPromoApplied(null);
    setPromoCode('');
  }, []);

  // Compute promo discount for a given order amount.
  const promoDiscount = useCallback((subtotal) => {
    if (!promoApplied) return 0;
    if (promoApplied.discount_percent) {
      return Math.round(subtotal * (promoApplied.discount_percent / 100));
    }
    if (promoApplied.discount_amount) {
      return Math.min(subtotal, promoApplied.discount_amount);
    }
    return 0;
  }, [promoApplied]);

  return {
    // ── core checkout state ────────────────────────────────────────────
    state: {
      orderId,
      paymentInProgress,
      showPaymentOverlay,
      triggerPayment,
      selectedPaymentMethod,
    },
    setSelectedPaymentMethod,

    // ── actions ────────────────────────────────────────────────────────
    submit,
    handlePaymentInitiated,
    handlePaymentError,
    handleCheckoutAbandoned,

    // ── promo helpers ──────────────────────────────────────────────────
    promo: {
      code: promoCode,
      setCode: setPromoCode,
      applied: promoApplied,
      applying: promoApplying,
      apply: applyPromo,
      clear: clearPromo,
      discount: promoDiscount,
    },
  };
}
