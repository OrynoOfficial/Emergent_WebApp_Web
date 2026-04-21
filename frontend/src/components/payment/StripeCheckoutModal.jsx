import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import StripeCheckoutPanel from './StripeCheckoutPanel';

/**
 * Foreground modal wrapper around StripeCheckoutPanel.
 * Opens on top of the current booking page so the user never leaves their flow.
 *
 * Props:
 *   open       — boolean
 *   onClose    — called when the user closes the modal or clicks
 *                "Choose a different payment method"
 *   orderId    — order to pay for
 */
export default function StripeCheckoutModal({ open, onClose, orderId }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent
        data-testid="stripe-checkout-modal"
        className="!max-w-none w-screen h-screen sm:h-auto sm:max-h-[80vh] sm:w-[64vw] sm:max-w-3xl p-0 border-0 sm:rounded-2xl overflow-hidden bg-gradient-to-br from-[#071d3c] via-[#0a2e5c] to-[#051530]"
      >
        {/* a11y — visually hidden but required by Radix Dialog */}
        <DialogTitle className="sr-only">Card Payment Checkout</DialogTitle>
        <DialogDescription className="sr-only">
          Review your booking summary and payment amount before continuing to Stripe's secure checkout.
        </DialogDescription>

        {/* Decorative overlays (match the standalone page) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        <div className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-[#c9a74a]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#082c59]/60 blur-3xl" />

        <div className="relative h-full overflow-y-auto">
          <StripeCheckoutPanel
            orderId={orderId}
            onBack={onClose}
            onChangeMethod={onClose}
            variant="modal"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
