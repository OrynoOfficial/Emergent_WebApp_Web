import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, ChevronDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/client';

// Fallback only if API fails
const FALLBACK_LOCATIONS = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua',
  'Maroua', 'Ngaoundéré', 'Bertoua', 'Kribi', 'Limbe',
  'Buea', 'Ebolowa', 'Edéa', 'Kumba', 'Nkongsamba'
];
const FALLBACK_POPULAR = ['Yaoundé', 'Douala', 'Bafoussam'];

// Cache per service type to avoid redundant API calls
const locationCache = {};

function LocationInput({
  value,
  onChange,
  placeholder = "Search city...",
  label,
  iconColor = "text-slate-400",
  excludeValue,
  error,
  required = false,
  shake = false,
  serviceType = null,
  locations: propLocations,
  popularLocations: propPopular,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allLocations, setAllLocations] = useState(propLocations || FALLBACK_LOCATIONS);
  const [popular, setPopular] = useState(propPopular || FALLBACK_POPULAR);
  const [counts, setCounts] = useState({});
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch dynamic locations from API
  useEffect(() => {
    if (propLocations) return; // skip if provided via props
    const cacheKey = serviceType || '__all__';
    if (locationCache[cacheKey]) {
      const c = locationCache[cacheKey];
      setAllLocations(c.all);
      setPopular(c.popular);
      setCounts(c.counts);
      return;
    }
    const params = serviceType ? `?service_type=${serviceType}` : '';
    api.get(`/suggestions/popular-locations${params}`)
      .then(res => {
        const data = res.data;
        const all = data.all_locations || FALLBACK_LOCATIONS;
        const pop = data.popular || FALLBACK_POPULAR;
        const cnt = data.counts || {};
        locationCache[cacheKey] = { all, popular: pop, counts: cnt };
        setAllLocations(all);
        setPopular(pop);
        setCounts(cnt);
      })
      .catch(() => {});
  }, [serviceType, propLocations]);

  const filteredLocations = searchTerm
    ? allLocations.filter(loc =>
        loc.toLowerCase().includes(searchTerm.toLowerCase()) && loc !== excludeValue
      )
    : popular.filter(loc => loc !== excludeValue && allLocations.includes(loc));

  const showAllLocations = searchTerm.length > 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (location) => {
    onChange(location);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Also show remaining locations after popular
  const remainingLocations = !showAllLocations
    ? allLocations.filter(loc => !popular.includes(loc) && loc !== excludeValue)
    : [];

  return (
    <div className="relative">
      {label && (
        <Label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <div className={cn("relative", label && "mt-1")}>
        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10", iconColor)} />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchTerm : value}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className={cn(
            "pl-10 pr-10 h-12 bg-white border-slate-200 focus:border-[#082c59] focus:ring-[#082c59] transition-all",
            value && !isOpen && "font-medium text-slate-900",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            shake && "animate-shake"
          )}
          data-testid="location-input"
        />
        <ChevronDown className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-auto"
          data-testid="location-dropdown"
        >
          {/* Popular section */}
          {!showAllLocations && filteredLocations.length > 0 && (
            <>
              <div className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50 border-b font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Popular destinations
              </div>
              {filteredLocations.map((location) => (
                <button
                  key={location}
                  type="button"
                  onClick={() => handleSelect(location)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left hover:bg-[#082c59]/5 transition-colors flex items-center gap-2",
                    value === location && "bg-[#082c59]/10 font-medium text-[#082c59]"
                  )}
                  data-testid={`location-option-${location}`}
                >
                  <MapPin className="w-4 h-4 text-[#082c59]/40" />
                  <span className="flex-1">{location}</span>
                  {counts[location] && (
                    <span className="text-[10px] text-[#082c59] bg-[#082c59]/10 px-1.5 py-0.5 rounded font-medium">
                      {counts[location]} listings
                    </span>
                  )}
                </button>
              ))}
              {/* Other locations */}
              {remainingLocations.length > 0 && (
                <>
                  <div className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50 border-t border-b font-bold uppercase tracking-wider">
                    Other locations
                  </div>
                  {remainingLocations.map((location) => (
                    <button
                      key={location}
                      type="button"
                      onClick={() => handleSelect(location)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left hover:bg-[#082c59]/5 transition-colors flex items-center gap-2 text-slate-600",
                        value === location && "bg-[#082c59]/10 font-medium text-[#082c59]"
                      )}
                    >
                      <MapPin className="w-4 h-4 text-slate-300" />
                      <span>{location}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {/* Search results */}
          {showAllLocations && filteredLocations.length > 0 && (
            filteredLocations.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => handleSelect(location)}
                className={cn(
                  "w-full px-3 py-2.5 text-left hover:bg-[#082c59]/5 transition-colors flex items-center gap-2",
                  value === location && "bg-[#082c59]/10 font-medium text-[#082c59]"
                )}
              >
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{location}</span>
                {counts[location] && (
                  <span className="text-[10px] text-slate-500 ml-auto">{counts[location]}</span>
                )}
              </button>
            ))
          )}

          {filteredLocations.length === 0 && (
            <div className="px-3 py-4 text-center text-slate-500 text-sm">
              No locations found
            </div>
          )}

          {!showAllLocations && (
            <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t text-center">
              Type to search more locations
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export { FALLBACK_LOCATIONS as ALL_LOCATIONS, FALLBACK_POPULAR as POPULAR_LOCATIONS };
export default LocationInput;
