import React, { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';

/**
 * FavouriteButton — Heart toggle with the same pulse animation as the
 * adjacent SubscribeButton, so the pair feels like one cohesive control
 * surface across result cards.
 *
 * Props:
 *   isFavourite  boolean   filled state
 *   onToggle     fn(e)     called on click (parent owns the actual toggle)
 *   testId       string    data-testid value (already prefixed by parent)
 *   className    string    optional override for the outer button
 *   filledClass  string    icon classes when filled  (default rose)
 *   emptyClass   string    icon classes when empty   (default dark slate)
 */
export default function FavouriteButton({
  isFavourite = false,
  onToggle,
  testId,
  className = 'p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition border border-white/10 shadow-sm',
  filledClass = 'fill-rose-500 text-rose-500',
  emptyClass = 'text-slate-900',
}) {
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Fire the pulse before the parent state flips so the *next* state's
    // color drives the ring (heart we're about to become).
    setPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 700);
    onToggle?.(e);
  };

  // Ring tint: we want to celebrate "just favourited" with rose, and a more
  // neutral tone when removing. `isFavourite` here is the state *before* the
  // click, so invert it for the upcoming colour.
  const willBeFavourite = !isFavourite;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative ${className}`}
      data-testid={testId}
      aria-pressed={isFavourite}
      aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
    >
      {pulse && (
        <span
          aria-hidden="true"
          data-testid="favourite-pulse"
          className={`pointer-events-none absolute inset-0 rounded-full animate-ping ${
            willBeFavourite ? 'bg-rose-400/50' : 'bg-slate-400/40'
          }`}
        />
      )}
      <span className={`relative inline-flex transition-transform duration-200 ${pulse ? 'scale-125' : 'scale-100'}`}>
        <Heart className={`h-4 w-4 transition-colors ${isFavourite ? filledClass : emptyClass}`} />
      </span>
    </button>
  );
}
