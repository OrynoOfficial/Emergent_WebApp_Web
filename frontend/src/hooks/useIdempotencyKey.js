import { useState, useCallback } from 'react';

/**
 * useIdempotencyKey — generates a stable UUID for one checkout attempt.
 *
 * Behaviour:
 *   • Returns the SAME UUID across re-renders, retries, and dialog re-opens.
 *   • Call `reset()` ONLY when starting a logically new payment (success,
 *     explicit "Start over", or component unmount).
 *
 * Why it matters:
 *   If the network drops the response after we've already charged the user,
 *   the client retries with the same key and the backend returns the original
 *   `payment_id` instead of double-charging. See `/api/v2/payments/intent`.
 *
 * @returns {{ key: string, reset: () => void }}
 */
export default function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());

  const reset = useCallback(() => {
    setKey(crypto.randomUUID());
  }, []);

  return { key, reset };
}
