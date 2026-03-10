import React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * SubscribeButton — Shows a subscribe/unsubscribe button for an operator.
 * Only renders for logged-in customer users.
 */
export default function SubscribeButton({ operatorId, operatorName, size = 'sm', className = '' }) {
  const { user } = useAuth();
  const { isSubscribed, toggleSubscription, loading, checked } = useSubscription(operatorId, operatorName);

  if (!user || !operatorId) return null;
  if (!checked) return null;

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await toggleSubscription();
    toast.success(isSubscribed ? 'Unsubscribed' : 'Subscribed to updates');
  };

  return (
    <Button
      variant={isSubscribed ? 'outline' : 'default'}
      size={size}
      className={`gap-1.5 transition-all ${
        isSubscribed
          ? 'border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      } ${className}`}
      onClick={handleClick}
      disabled={loading}
      data-testid="subscribe-btn"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </Button>
  );
}
