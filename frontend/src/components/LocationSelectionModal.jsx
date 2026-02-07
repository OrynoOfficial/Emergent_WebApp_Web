import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Globe, Loader2, Navigation, ChevronDown, Check } from 'lucide-react';
import api from '@/api/client';

const STORAGE_KEY = 'oryno_user_location';

export default function LocationSelectionModal({ isOpen, onClose, onLocationSet }) {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCountries();
      detectLocation();
    }
  }, [isOpen]);

  const fetchCountries = async () => {
    try {
      const res = await api.get('/geography/countries');
      const countriesList = res.data.countries || [];
      setCountries(countriesList);
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  };

  const detectLocation = async () => {
    setDetecting(true);
    try {
      // Try to get IP-based location
      const res = await api.get('/customer-location/ip-info');
      if (res.data.location?.country_code) {
        setDetectedLocation({
          country_code: res.data.location.country_code,
          country_name: res.data.location.country,
          city: res.data.location.city,
          is_in_africa: res.data.is_in_africa
        });
        setSelectedCountry(res.data.location.country_code);
      }
      }
    } catch (error) {
      console.error('Failed to detect location:', error);
    } finally {
      setDetecting(false);
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCountry) {
      const country = countries.find(c => c.code === selectedCountry);
      const locationData = {
        country_code: selectedCountry,
        country_name: country?.name || selectedCountry,
        is_in_africa: isAfricanCountry(selectedCountry),
        set_at: new Date().toISOString()
      };
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locationData));
      
      // Callback
      if (onLocationSet) {
        onLocationSet(locationData);
      }
      
      onClose();
    }
  };

  const isAfricanCountry = (code) => {
    const africanCodes = [
      "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD",
      "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "KE",
      "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
      "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
      "EH", "ZM", "ZW"
    ];
    return africanCodes.includes(code?.toUpperCase());
  };

  const handleUseDetected = () => {
    if (detectedLocation?.country_code) {
      setSelectedCountry(detectedLocation.country_code);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Select Your Location
          </DialogTitle>
          <DialogDescription>
            Choose your country to see services available in your area. 
            You can change this later in settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Auto-detected location */}
          {detecting ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-600">Detecting your location...</span>
            </div>
          ) : detectedLocation ? (
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Navigation className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Detected Location</p>
                    <p className="font-semibold text-slate-900">
                      {detectedLocation.country_name || detectedLocation.country_code}
                      {detectedLocation.city && `, ${detectedLocation.city}`}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUseDetected}
                  className="text-blue-600 border-blue-200"
                >
                  Use This
                </Button>
              </div>
              {detectedLocation.is_in_africa && (
                <Badge className="mt-2 bg-green-100 text-green-700">
                  <Globe className="w-3 h-3 mr-1" />
                  In Africa - Local services will be shown
                </Badge>
              )}
            </div>
          ) : null}

          {/* Manual selection - Custom dropdown to work inside Dialog */}
          <div className="relative">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Or select manually:
            </label>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white border rounded-lg text-left hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="country-select-trigger"
            >
              <span className={selectedCountry ? 'text-slate-900' : 'text-slate-500'}>
                {selectedCountry 
                  ? `${selectedCountry} - ${countries.find(c => c.code === selectedCountry)?.name || ''}`
                  : 'Choose your country'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto" data-testid="country-dropdown">
                {/* African countries */}
                <div className="px-3 py-1.5 text-xs text-slate-500 font-semibold bg-slate-50 sticky top-0">Africa</div>
                {countries.filter(c => isAfricanCountry(c.code)).map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => { setSelectedCountry(country.code); setDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 ${
                      selectedCountry === country.code ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                    }`}
                    data-testid={`country-option-${country.code}`}
                  >
                    <span>
                      <span className="font-medium mr-2">{country.code}</span>
                      {country.name}
                    </span>
                    {selectedCountry === country.code && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
                
                {/* Other countries */}
                {countries.filter(c => !isAfricanCountry(c.code)).length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs text-slate-500 font-semibold bg-slate-50 sticky top-0 mt-1">Other</div>
                    {countries.filter(c => !isAfricanCountry(c.code)).map(country => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => { setSelectedCountry(country.code); setDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 ${
                          selectedCountry === country.code ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                        }`}
                        data-testid={`country-option-${country.code}`}
                      >
                        <span>
                          <span className="font-medium mr-2">{country.code}</span>
                          {country.name}
                        </span>
                        {selectedCountry === country.code && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Visibility explanation */}
          {selectedCountry && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              {isAfricanCountry(selectedCountry) ? (
                <p className="text-slate-600">
                  <span className="font-medium text-slate-900">Local Mode:</span> You'll see services available in {countries.find(c => c.code === selectedCountry)?.name || selectedCountry}.
                </p>
              ) : (
                <p className="text-slate-600">
                  <span className="font-medium text-slate-900">Global Mode:</span> You'll see all services across Africa.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Skip for Now
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedCountry}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Confirm Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage location state
export function useUserLocation() {
  const [location, setLocation] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setLocation(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const checkAndPromptLocation = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setShowModal(true);
      return false;
    }
    return true;
  };

  const updateLocation = (newLocation) => {
    setLocation(newLocation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
  };

  const clearLocation = () => {
    setLocation(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    location,
    showModal,
    setShowModal,
    checkAndPromptLocation,
    updateLocation,
    clearLocation
  };
}

// Helper to get stored location
export function getStoredLocation() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
