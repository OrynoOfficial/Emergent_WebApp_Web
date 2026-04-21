import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StripeCheckoutPanel from '../../components/payment/StripeCheckoutPanel';

/**
 * Stand-alone /payment/checkout page (fallback for deep-linked access, e.g.
 * from email receipts). The in-app booking flow uses StripeCheckoutModal
 * which is the preferred entry point — see PaymentMethodsSelection.
 */
export default function StripeCheckoutConfirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071d3c] via-[#0a2e5c] to-[#051530] relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
      />
      <div className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-[#c9a74a]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#082c59]/60 blur-3xl" />

      <div className="relative">
        <StripeCheckoutPanel
          orderId={orderId}
          onBack={() => navigate(-1)}
          onChangeMethod={() => navigate(-1)}
          variant="page"
        />
      </div>
    </div>
  );
}
