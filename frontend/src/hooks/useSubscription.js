import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

/**
 * useSubscription — reusable hook for managing operator subscriptions.
 * 
 * Usage:
 *   const { isSubscribed, toggleSubscription } = useSubscription(operatorId, operatorName);
 *   <Button onClick={toggleSubscription}>{isSubscribed ? 'Subscribed' : 'Subscribe'}</Button>
 */
export function useSubscription(operatorId, operatorName) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!operatorId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.get(`/subscriptions/check?operator_id=${operatorId}`);
        if (!cancelled) {
          setSubscribed(res.data.subscribed);
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [operatorId]);

  const toggleSubscription = useCallback(async () => {
    if (!operatorId || loading) return;
    setLoading(true);
    try {
      if (subscribed) {
        await api.post('/subscriptions/unsubscribe', { operator_id: operatorId });
        setSubscribed(false);
      } else {
        await api.post('/subscriptions/subscribe', {
          operator_id: operatorId,
          operator_name: operatorName || null,
        });
        setSubscribed(true);
      }
    } catch {
      // Ignore error silently
    } finally {
      setLoading(false);
    }
  }, [operatorId, operatorName, subscribed, loading]);

  return { isSubscribed: subscribed, toggleSubscription, loading, checked };
}
