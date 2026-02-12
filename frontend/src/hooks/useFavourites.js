import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

/**
 * useFavourites — reusable hook for managing favourites in any results page.
 * 
 * Usage:
 *   const { isFav, toggleFav } = useFavourites('hotels');
 *   <Heart onClick={() => toggleFav(item)} className={isFav(item.id) ? 'fill-red-500' : ''} />
 */
export function useFavourites(serviceType) {
  const [favIds, setFavIds] = useState(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load favourite IDs for this service type on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get(`/favourites/ids?service_type=${serviceType}`);
        if (!cancelled) {
          setFavIds(new Set(res.data.ids || []));
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [serviceType]);

  const isFav = useCallback((itemId) => favIds.has(itemId), [favIds]);

  const toggleFav = useCallback(async (item) => {
    const itemId = item._id || item.id;
    if (!itemId) return;

    const wasActive = favIds.has(itemId);

    // Optimistic update
    setFavIds(prev => {
      const next = new Set(prev);
      wasActive ? next.delete(itemId) : next.add(itemId);
      return next;
    });

    try {
      if (wasActive) {
        await api.delete(`/favourites/${serviceType}/${itemId}`);
      } else {
        await api.post('/favourites/', {
          service_type: serviceType,
          item_id: itemId,
          item_name: item.name || item.title || item.operator_name || item.route_name || '',
          item_image: item.image || item.images?.[0] || item.poster_url || null,
          item_location: item.city || item.from_city || item.venue || null,
          item_price: item.price || item.ticket_price || item.base_fare || null,
          item_rating: item.rating || item.average_rating || null,
          extra: {
            to_city: item.to_city || null,
            cuisine_type: item.cuisine_type || null,
            vehicle_type: item.vehicle_type || null,
          }
        });
      }
    } catch {
      // Revert on error
      setFavIds(prev => {
        const next = new Set(prev);
        wasActive ? next.add(itemId) : next.delete(itemId);
        return next;
      });
    }
  }, [favIds, serviceType]);

  return { isFav, toggleFav, loaded };
}
