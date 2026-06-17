// Thin wrapper around <PaymentMethodsSelection> that takes the output of
// `useCheckout(...)` and a few page-supplied bits (amount + service name).
//
// Replaces the ~8-line JSX block + ~25 lines of state-handling that lived in
// every booking page.

import React from 'react';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';

/**
 * @param {object}  props
 * @param {object}  props.checkout       - return value of useCheckout(...)
 * @param {number}  props.amount         - total amount the user will be charged
 * @param {string}  props.serviceName    - human-readable service label
 * @param {string}  [props.testId]
 */
export default function CheckoutPaymentPanel({ checkout, amount, serviceName, testId, ...extraProps }) {
  const { state, setSelectedPaymentMethod, handlePaymentInitiated, handlePaymentError, handleCheckoutAbandoned } = checkout;

  return (
    <PaymentMethodsSelection
      data-testid={testId}
      amount={amount}
      orderId={state.orderId}
      serviceName={serviceName}
      onPaymentInitiated={handlePaymentInitiated}
      onPaymentError={handlePaymentError}
      onCheckoutAbandoned={handleCheckoutAbandoned}
      triggerPayment={state.triggerPayment}
      onMethodSelected={setSelectedPaymentMethod}
      {...extraProps}
    />
  );
}
