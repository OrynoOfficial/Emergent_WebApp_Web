import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, MapPin, Building2, Sparkles } from 'lucide-react';

/**
 * SmartSearchBar — chip-style omnibar for service results pages.
 *
 * iter 247 — replaces the misleading "free-text input + unrelated location
 * dropdown" combo. Users type into ONE field; suggestions surface colour-coded
 * chips of distinct categories (Place / Operator / Listing). Clicking a chip
 * locks it as an active filter; multiple chips compose AND-style. No more
 * ambiguity between "is this a city or a hotel name?".
 *
 * Props:
 *   items                  — array of source records (already loaded by parent).
 *   placeholder            — input placeholder.
 *   listingIcon            — lucide icon for "listing" chips (Hotel / Calendar / Film …).
 *   listingLabel           — singular noun for listings (e.g. "Hotel", "Event", "Film").
 *   getName(item)          — return the listing's name.
 *   getCity(item)          — return the listing's city.
 *   getOperator(item)      — return the operator name (nullable).
 *   onFiltersChange(active)— callback fired whenever active chips change;
 *                            receives { places: Set, operators: Set, listings: Set }.
 *   children               — optional trailing slot (e.g. sort dropdown).
 */
export default function SmartSearchBar({
  items = [],
  placeholder = 'Search by place, operator, or name…',
  listingIcon: ListingIcon = Sparkles,
  listingLabel = 'Listing',
  getName = (i) => i.name,
  getCity = (i) => i.city,
  getOperator = (i) => i.operator_name,
  onFiltersChange,
  children,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activePlaces, setActivePlaces] = useState(new Set());
  const [activeOperators, setActiveOperators] = useState(new Set());
  const [activeListings, setActiveListings] = useState(new Set());
  const wrapperRef = useRef(null);

  // Derive unique facets from the source items (case-folded).
  const facets = useMemo(() => {
    const places = new Map();
    const operators = new Map();
    const listings = new Map();
    items.forEach((it) => {
      const c = getCity(it);
      if (c) places.set(c.trim(), (places.get(c.trim()) || 0) + 1);
      const op = getOperator(it);
      if (op) operators.set(op.trim(), (operators.get(op.trim()) || 0) + 1);
      const n = getName(it);
      if (n) listings.set(n.trim(), (listings.get(n.trim()) || 0) + 1);
    });
    return { places, operators, listings };
  }, [items, getCity, getOperator, getName]);

  // Build suggestions matching the typed query (capped per group).
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query → show 3 popular options from each group.
      return {
        places: [...facets.places.entries()].slice(0, 3),
        operators: [...facets.operators.entries()].slice(0, 3),
        listings: [...facets.listings.entries()].slice(0, 3),
      };
    }
    const match = (str) => str.toLowerCase().includes(q);
    return {
      places: [...facets.places.entries()].filter(([s]) => match(s)).slice(0, 5),
      operators: [...facets.operators.entries()].filter(([s]) => match(s)).slice(0, 5),
      listings: [...facets.listings.entries()].filter(([s]) => match(s)).slice(0, 5),
    };
  }, [query, facets]);

  // Propagate filter changes.
  useEffect(() => {
    onFiltersChange?.({
      places: activePlaces,
      operators: activeOperators,
      listings: activeListings,
    });
  }, [activePlaces, activeOperators, activeListings]); // eslint-disable-line

  // Close dropdown on outside click.
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const addChip = (kind, value) => {
    const setters = {
      place: setActivePlaces,
      operator: setActiveOperators,
      listing: setActiveListings,
    };
    setters[kind]((prev) => new Set(prev).add(value));
    setQuery('');
    setOpen(false);
  };

  const removeChip = (kind, value) => {
    const setters = {
      place: setActivePlaces,
      operator: setActiveOperators,
      listing: setActiveListings,
    };
    setters[kind]((prev) => {
      const next = new Set(prev);
      next.delete(value);
      return next;
    });
  };

  const clearAll = () => {
    setActivePlaces(new Set());
    setActiveOperators(new Set());
    setActiveListings(new Set());
    setQuery('');
  };

  const totalSuggestions =
    suggestions.places.length + suggestions.operators.length + suggestions.listings.length;
  const totalActive = activePlaces.size + activeOperators.size + activeListings.size;

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 mb-5" ref={wrapperRef} data-testid="smart-search-bar">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Omnibar with chips */}
        <div className="relative flex-1">
          <div
            className="flex items-center flex-wrap gap-1.5 min-h-[36px] px-2 py-1 rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-[#082c59]/20"
            onClick={() => setOpen(true)}
          >
            <Search className="h-4 w-4 text-slate-400 ml-1 shrink-0" />

            {/* Active chips */}
            {[...activePlaces].map((v) => (
              <Chip key={`p-${v}`} kind="place" value={v} onRemove={() => removeChip('place', v)} />
            ))}
            {[...activeOperators].map((v) => (
              <Chip key={`o-${v}`} kind="operator" value={v} onRemove={() => removeChip('operator', v)} />
            ))}
            {[...activeListings].map((v) => (
              <Chip key={`l-${v}`} kind="listing" listingIcon={ListingIcon} value={v} onRemove={() => removeChip('listing', v)} />
            ))}

            {/* Free-text input */}
            <input
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              placeholder={totalActive ? 'Add another filter…' : placeholder}
              className="flex-1 min-w-[140px] bg-transparent outline-none text-sm py-1"
              data-testid="smart-search-input"
            />

            {totalActive > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] uppercase font-semibold text-slate-400 hover:text-slate-700 px-2 shrink-0"
                data-testid="smart-search-clear"
              >
                Clear
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {open && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
              {totalSuggestions === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No matches in this list.
                </div>
              ) : (
                <>
                  <SuggestionGroup
                    title="Places"
                    icon={MapPin}
                    color="#EF4444"
                    items={suggestions.places}
                    active={activePlaces}
                    onPick={(v) => addChip('place', v)}
                  />
                  <SuggestionGroup
                    title="Operators"
                    icon={Building2}
                    color="#8B5CF6"
                    items={suggestions.operators}
                    active={activeOperators}
                    onPick={(v) => addChip('operator', v)}
                  />
                  <SuggestionGroup
                    title={`${listingLabel}s`}
                    icon={ListingIcon}
                    color="#082c59"
                    items={suggestions.listings}
                    active={activeListings}
                    onPick={(v) => addChip('listing', v)}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────
const CHIP_STYLE = {
  place: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', Icon: MapPin },
  operator: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', Icon: Building2 },
  listing: { bg: 'bg-[#082c59]/10', text: 'text-[#082c59]', ring: 'ring-[#082c59]/30', Icon: Sparkles },
};

function Chip({ kind, value, onRemove, listingIcon }) {
  const style = CHIP_STYLE[kind];
  const Icon = kind === 'listing' && listingIcon ? listingIcon : style.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 ${style.bg} ${style.text} ring-1 ${style.ring} text-[11px] font-medium px-2 py-0.5 rounded-full`}
      data-testid={`smart-search-chip-${kind}`}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[140px] truncate">{value}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="hover:bg-black/10 rounded-full p-0.5"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ── Suggestion group ───────────────────────────────────────────────────────
function SuggestionGroup({ title, icon: Icon, color, items, active, onPick }) {
  if (!items.length) return null;
  return (
    <div className="py-1.5">
      <div className="px-3 py-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{title}</span>
      </div>
      {items.map(([value, count]) => {
        const isActive = active.has(value);
        return (
          <button
            key={value}
            disabled={isActive}
            onClick={() => onPick(value)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${isActive ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:bg-slate-50'}`}
          >
            <span className="truncate">{value}</span>
            {isActive && (
              <span className="text-[10px] text-slate-400 tabular-nums shrink-0">added</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Helper exported for parents — applies the active chips to an item list.
export function applySmartFilters(items, filters, { getName, getCity, getOperator }) {
  const { places, operators, listings } = filters;
  return items.filter((it) => {
    if (places.size) {
      const c = (getCity(it) || '').trim();
      if (!places.has(c)) return false;
    }
    if (operators.size) {
      const op = (getOperator(it) || '').trim();
      if (!operators.has(op)) return false;
    }
    if (listings.size) {
      const n = (getName(it) || '').trim();
      if (!listings.has(n)) return false;
    }
    return true;
  });
}
