import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SubscribeButton — Icon-only subscribe/unsubscribe for result cards.
 * Renders beside the Favourite (Heart) button with a hover tooltip.
 *
 * Adds a short ring-pulse animation when the user toggles the state so that
 * the click is acknowledged even if the parent page doesn't mount <Toaster />.
 */
export default function SubscribeButton({ operatorId, operatorName, size = 'sm', className = '', variant = 'icon' }) {
  const { user } = useAuth();
  const { isSubscribed, toggleSubscription, loading, checked } = useSubscription(operatorId, operatorName);
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  // Clean the timeout if the component unmounts mid-pulse.
  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  if (!user || !operatorId || !checked) return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Kick off the visual pulse immediately so the click feels instant even
    // before the network round-trip resolves.
    setPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 700);
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
              className={`relative p-1.5 rounded-full transition-all shadow-sm ${
                isSubscribed
                  ? 'bg-[#082c59] text-white hover:bg-[#082c59]/80'
                  : 'bg-white/80 hover:bg-white text-[#082c59]'
              } ${className}`}
              data-testid={operatorId ? `subscribe-btn-${operatorId}` : 'subscribe-btn'}
            >
              {/* Pulse ring — short ping on toggle that fades out */}
              {pulse && (
                <span
                  aria-hidden="true"
                  data-testid="subscribe-pulse"
                  className={`pointer-events-none absolute inset-0 rounded-full animate-ping ${
                    isSubscribed ? 'bg-cyan-300/60' : 'bg-[#082c59]/40'
                  }`}
                />
              )}
              <span className={`relative inline-flex transition-transform duration-200 ${pulse ? 'scale-110' : 'scale-100'}`}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSubscribed ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </span>
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
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isSubscribed
                ? 'border border-[#082c59]/20 text-[#082c59] hover:bg-[#082c59]/5'
                : 'bg-[#082c59] hover:bg-[#082c59]/90 text-white'
            } ${className}`}
            data-testid={operatorId ? `subscribe-btn-${operatorId}` : 'subscribe-btn'}
          >
            {pulse && (
              <span
                aria-hidden="true"
                data-testid="subscribe-pulse"
                className={`pointer-events-none absolute inset-0 rounded-lg animate-ping ${
                  isSubscribed ? 'bg-[#082c59]/15' : 'bg-white/30'
                }`}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSubscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {isSubscribed ? 'Subscribed' : 'Subscribe'}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs bg-slate-900 text-white border-0">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
