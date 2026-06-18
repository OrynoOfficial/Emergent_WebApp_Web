import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Building2, Star, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/api/client';

/**
 * Hero search bar used on the per-service landing pages.
 *
 * Pattern mirrors the global top-nav search (rich thumbnails, grouped sections)
 * but is scoped to a single service category via the `service_type` prop.
 *
 * Behaviour:
 *  - As the user types we debounce and call /api/search/?q=…&service_type=…
 *  - Results are grouped into Cities, Operators and Listings.
 *  - Picking a result deep-links to a pre-filtered context:
 *      • city  → `resultsPath?city=...`
 *      • operator → `resultsPath?operator_id=...`
 *      • listing  → its native `deep_link`
 *  - Pressing Enter with a raw query routes to results filtered on that query.
 */
const PLACEHOLDER_BY_SERVICE = {
  hotel: 'Find a hotel — try "Douala" or "Hilton"',
  car_rental: 'Where to? Try "Yaoundé" or "Tata Nexon"',
  restaurant: 'Hungry? Try "Le Bistrot" or "Yaoundé"',
  travel: 'From / to — try "Douala to Yaoundé"',
  event: 'Find an event — try "concert" or "Cysoul"',
  cinema: 'Search a film or city',
  banquet: 'Find a venue — try "wedding hall Yaoundé"',
  laundry: 'Find a laundry near you',
};

const TYPE_META = {
  location:    { label: 'City',     icon: MapPin,    accent: 'text-emerald-600' },
  operator:    { label: 'Operator', icon: Building2, accent: 'text-indigo-600' },
  hotel:       { label: 'Hotel',    icon: Star,      accent: 'text-amber-600' },
  car_rental:  { label: 'Vehicle',  icon: Star,      accent: 'text-amber-600' },
  restaurant:  { label: 'Place',    icon: Star,      accent: 'text-amber-600' },
  travel_route:{ label: 'Route',    icon: Star,      accent: 'text-amber-600' },
  event:       { label: 'Event',    icon: Star,      accent: 'text-amber-600' },
  film:        { label: 'Film',     icon: Star,      accent: 'text-amber-600' },
  showtime:    { label: 'Showtime', icon: Star,      accent: 'text-amber-600' },
  banquet:     { label: 'Venue',    icon: Star,      accent: 'text-amber-600' },
  pressing:    { label: 'Laundry',  icon: Star,      accent: 'text-amber-600' },
};

export default function LandingSmartSearch({
  serviceType,
  resultsPath,
  cityParam = 'city',
  onSelectCity,
  className,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  // Debounced fetch — 200 ms is snappy without thrashing the API.
  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/search/', {
          params: { q: query.trim(), service_type: serviceType, limit: 24 },
        });
        setItems(data?.results || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, serviceType]);

  // Click outside closes the dropdown.
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goTo = (path) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const handleSelect = (row) => {
    if (row.type === 'location') {
      // Cities are not in the DB so a `path` may not be set; build the deep
      // link from the parent-provided resultsPath instead.
      if (onSelectCity) {
        onSelectCity(row.label);
        setOpen(false);
        setQuery('');
        return;
      }
      goTo(`${resultsPath}?${cityParam}=${encodeURIComponent(row.label)}`);
      return;
    }
    if (row.type === 'operator' && row.meta?.operator_id) {
      goTo(`${resultsPath}?operator_id=${row.meta.operator_id}`);
      return;
    }
    if (row.deep_link) {
      goTo(row.deep_link);
      return;
    }
    goTo(`${resultsPath}?${cityParam}=${encodeURIComponent(row.label)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    // Prefer the first match if there is one (best UX), otherwise plain text.
    if (items.length > 0) handleSelect(items[0]);
    else goTo(`${resultsPath}?${cityParam}=${encodeURIComponent(value)}`);
  };

  // Group results into the three sections we render in the dropdown.
  const grouped = items.reduce((acc, row) => {
    let bucket = 'listings';
    if (row.type === 'location') bucket = 'cities';
    else if (row.type === 'operator') bucket = 'operators';
    (acc[bucket] ||= []).push(row);
    return acc;
  }, {});
  const sections = [
    ['cities', 'Destinations', grouped.cities],
    ['operators', 'Operators', grouped.operators],
    ['listings', 'Listings', grouped.listings],
  ].filter(([, , rows]) => rows && rows.length > 0);

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)} data-testid={`landing-smart-search-${serviceType}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={PLACEHOLDER_BY_SERVICE[serviceType] || 'Search…'}
            className="h-14 pl-12 pr-12 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-2 focus-visible:ring-[#082c59]/30 text-base"
            data-testid="landing-smart-search-input"
            aria-label="Service search"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setItems([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100"
              aria-label="Clear"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>
      </form>

      {open && query.trim() && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-[420px] overflow-y-auto" data-testid="landing-smart-search-dropdown">
          {loading && items.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : sections.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No matches. Press Enter to search anyway.
            </div>
          ) : (
            sections.map(([key, title, rows]) => (
              <div key={key}>
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                  {title}
                </div>
                {rows.map((row) => {
                  const meta = TYPE_META[row.type] || TYPE_META.location;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={`${row.type}-${row.path || row.label}`}
                      type="button"
                      onClick={() => handleSelect(row)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3"
                      data-testid={`landing-search-item-${row.type}`}
                    >
                      {row.thumbnail ? (
                        <img src={row.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                      ) : (
                        <div className={cn('w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center', meta.accent)}>
                          <Icon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{row.label}</p>
                        {row.subtitle && (
                          <p className="text-xs text-slate-500 truncate">{row.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
