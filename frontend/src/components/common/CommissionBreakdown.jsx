import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Info, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Format currency with FCFA after the amount
const formatCurrency = (amount) => {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)} FCFA`;
};

export default function CommissionBreakdown({ 
  basePrice, 
  commissionAmount, 
  totalAmount,
  showDetails = true
}) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-700">Price Breakdown</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-blue-600 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    A service commission is added to support platform operations, 
                    secure payments, and continuous service improvements.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Price Details */}
          {showDetails && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-700">Subtotal</span>
                <span className="font-medium text-emerald-600">
                  {formatCurrency(basePrice)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-700">
                  Service Commission
                </span>
                <span className="font-medium text-emerald-600">
                  +{formatCurrency(commissionAmount)}
                </span>
              </div>

              <div className="border-t border-blue-300 pt-2"></div>
            </>
          )}

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-900">Total Amount</span>
            <span className="font-bold text-xl text-emerald-600">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Info Message */}
          <div className="bg-white rounded-lg p-3 mt-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-[#052c59]">Note:</strong> The commission helps us maintain 
              secure payment processing, 24/7 customer support, and platform improvements.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
