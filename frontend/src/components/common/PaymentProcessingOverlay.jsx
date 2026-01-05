import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-page payment processing overlay
 * Blocks all interactions while payment is being processed
 */
const PaymentProcessingOverlay = ({ isVisible, message = "Processing payment, please do not refresh page" }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl text-center">
        {/* Animated Logo/Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#052c59] animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#052c59] animate-pulse" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-[#052c59] via-blue-500 to-[#052c59] rounded-full animate-progress-bar"></div>
        </div>

        {/* Message */}
        <h3 className="text-xl font-semibold text-slate-800 mb-2">
          Processing Payment
        </h3>
        <p className="text-slate-600 text-sm">
          {message}
        </p>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secure Payment Processing
        </div>
      </div>

      {/* CSS Animation for progress bar */}
      <style>{`
        @keyframes progress-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-progress-bar {
          animation: progress-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PaymentProcessingOverlay;
