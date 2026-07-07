// useIdleTimeout — auto-logout when the user is idle for `timeoutMinutes` minutes.
// Shows a warning modal `warningSeconds` before logout so the user can stay signed in.
// Idle = no mouse/keyboard/touch/scroll activity in the tab.
import { useEffect, useRef, useState, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'visibilitychange'];

export function useIdleTimeout({ timeoutMinutes, warningSeconds = 60, onIdle, enabled = true }) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(warningSeconds);
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const cleanup = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const reset = useCallback(() => {
    if (!enabled || !timeoutMinutes) return;
    cleanup();
    setShowWarning(false);
    setSecondsLeft(warningSeconds);

    const totalMs = timeoutMinutes * 60 * 1000;
    const warnAt = Math.max(0, totalMs - warningSeconds * 1000);

    // Show warning modal `warningSeconds` before logout
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // Countdown ticker
      let remaining = warningSeconds;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0 && countdownRef.current) clearInterval(countdownRef.current);
      }, 1000);
    }, warnAt);

    // Auto-logout
    idleTimerRef.current = setTimeout(() => {
      cleanup();
      setShowWarning(false);
      if (onIdle) onIdle();
    }, totalMs);
  }, [enabled, timeoutMinutes, warningSeconds, onIdle, cleanup]);

  useEffect(() => {
    if (!enabled || !timeoutMinutes) {
      cleanup();
      return undefined;
    }
    reset();
    const handleActivity = () => reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      cleanup();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, timeoutMinutes, reset, cleanup]);

  const stayActive = useCallback(() => {
    reset();
  }, [reset]);

  return { showWarning, secondsLeft, stayActive };
}
