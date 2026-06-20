import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';

/**
 * Applies the user's accessibility preferences to the document root.
 * Listens for the authenticated user object and fetches the full
 * preferences payload from /users/me/preferences on mount + when the
 * user id changes. Sets data attributes on <html> that downstream CSS
 * rules read.
 *
 * Mount once near the top of the React tree (inside AuthProvider).
 */
export default function AccessibilityBridge() {
  const { user } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    // Defaults (logged-out)
    root.removeAttribute('data-reduce-motion');
    root.removeAttribute('data-high-contrast');
    root.setAttribute('data-font-scale', 'normal');

    if (!user) return;

    let cancelled = false;
    const apply = (p) => {
      if (cancelled || !p) return;
      if (p.reduce_motion) root.setAttribute('data-reduce-motion', 'true');
      else root.removeAttribute('data-reduce-motion');
      if (p.high_contrast) root.setAttribute('data-high-contrast', 'true');
      else root.removeAttribute('data-high-contrast');
      root.setAttribute('data-font-scale', p.font_scale || 'normal');
    };

    // Apply user's basic fields immediately for first paint
    apply({
      reduce_motion: user.reduce_motion,
      high_contrast: user.high_contrast,
      font_scale: user.font_scale || 'normal',
    });

    // Then load the full preferences payload (includes overrides not in /auth/me)
    (async () => {
      try {
        const { data } = await api.get('/users/me/preferences');
        apply(data);
      } catch {
        /* ignore — defaults already applied above */
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return null;
}
