import React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SubscribeButton — Icon-only subscribe/unsubscribe for result cards.
 * Renders beside the Favourite (Heart) button with a hover tooltip.
 */
export default function SubscribeButton({ operatorId, operatorName, size = 'sm', className = '', variant = 'icon' }) {
  const { user } = useAuth();
  const { isSubscribed, toggleSubscription, loading, checked } = useSubscription(operatorId, operatorName);

  if (!user || !operatorId || !checked) return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await toggleSubscription();
    toast.success(isSubscribed ? `Unsubscribed from ${operatorName || 'operator'}` : `Subscribed to ${operatorName || 'operator'}`);
  };

  const tooltipText = isSubscribed
    ? `You're subscribed to ${operatorName || 'this operator'}. Click to unsubscribe.`
    : `Subscribe to ${operatorName || 'this operator'} to receive targeted notifications and exclusive offers.`;

  if (variant === 'icon') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              disabled={loading}
              className={`p-1.5 rounded-full transition-all shadow-sm ${
                isSubscribed
                  ? 'bg-[#082c59] text-white hover:bg-[#082c59]/80'
                  : 'bg-white/80 hover:bg-white text-[#082c59]'
              } ${className}`}
              data-testid={operatorId ? `subscribe-btn-${operatorId}` : 'subscribe-btn'}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs bg-slate-900 text-white border-0">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full button variant (legacy)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isSubscribed
                ? 'border border-[#082c59]/20 text-[#082c59] hover:bg-[#082c59]/5'
                : 'bg-[#082c59] hover:bg-[#082c59]/90 text-white'
            } ${className}`}
            data-testid={operatorId ? `subscribe-btn-${operatorId}` : 'subscribe-btn'}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSubscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs bg-slate-900 text-white border-0">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
