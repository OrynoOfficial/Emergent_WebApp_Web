import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// All available locations in Cameroon
const ALL_LOCATIONS = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua',
  'Maroua', 'Ngaoundéré', 'Bertoua', 'Kribi', 'Limbe',
  'Buea', 'Ebolowa', 'Edéa', 'Kumba', 'Nkongsamba'
];

// Popular locations (shown by default)
const POPULAR_LOCATIONS = ['Yaoundé', 'Douala', 'Bafoussam'];

// Reusable Location Input Component with popular options
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
  locations = ALL_LOCATIONS,
  popularLocations = POPULAR_LOCATIONS
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter locations based on search and exclude value
  const filteredLocations = searchTerm
    ? locations.filter(loc => 
        loc.toLowerCase().includes(searchTerm.toLowerCase()) && loc !== excludeValue
      )
    : popularLocations.filter(loc => loc !== excludeValue && locations.includes(loc));

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
        />
        <ChevronDown className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </div>
      
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto"
        >
          {!showAllLocations && filteredLocations.length > 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-b font-medium">
              Popular destinations
            </div>
          )}
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => handleSelect(location)}
                className={cn(
                  "w-full px-3 py-3 text-left hover:bg-[#082c59]/5 transition-colors flex items-center gap-2",
                  value === location && "bg-[#082c59]/10 font-medium text-[#082c59]"
                )}
              >
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{location}</span>
                {popularLocations.includes(location) && !showAllLocations && (
                  <span className="ml-auto text-xs text-[#082c59] bg-[#082c59]/10 px-2 py-0.5 rounded">Popular</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-slate-500 text-sm">
              No locations found
            </div>
          )}
          {!showAllLocations && filteredLocations.length > 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t">
              Type to search more locations...
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export { ALL_LOCATIONS, POPULAR_LOCATIONS };
export default LocationInput;
