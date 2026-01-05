import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { 
  MapPin, Search, Package, Calendar as CalendarIcon, 
  Truck, Clock, Shield, CheckCircle, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DatePickerModal from '@/components/shared/DatePickerModal';

// Package sizes with dimensions and weight limits
const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg', description: 'Small packages, documents' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg', description: 'Medium packages, books' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg', description: 'Large packages, electronics' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg', description: 'Extra large packages, furniture' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg', description: 'Oversized packages, appliances' }
};

// All available locations
const ALL_LOCATIONS = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua',
  'Maroua', 'Ngaoundéré', 'Bertoua', 'Kribi', 'Limbe',
  'Buea', 'Ebolowa', 'Edéa', 'Kumba', 'Nkongsamba'
];

// Popular locations (shown by default)
const POPULAR_LOCATIONS = ['Yaoundé', 'Douala', 'Bafoussam'];

// Searchable Location Input Component
const LocationInput = ({ 
  value, 
  onChange, 
  placeholder, 
  label, 
  icon: Icon,
  iconColor,
  excludeValue,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter locations based on search and exclude value
  const filteredLocations = searchTerm
    ? ALL_LOCATIONS.filter(loc => 
        loc.toLowerCase().includes(searchTerm.toLowerCase()) && loc !== excludeValue
      )
    : POPULAR_LOCATIONS.filter(loc => loc !== excludeValue);

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
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="relative mt-1">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${iconColor} pointer-events-none z-10`} />
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
            error && "border-red-500"
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
          {!showAllLocations && (
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-b">
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
                {POPULAR_LOCATIONS.includes(location) && !showAllLocations && (
                  <span className="ml-auto text-xs text-[#082c59] bg-[#082c59]/10 px-2 py-0.5 rounded">Popular</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-slate-500 text-sm">
              No locations found
            </div>
          )}
          {!showAllLocations && (
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t">
              Type to search more locations...
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default function PackagesSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    pickup_location: '',
    delivery_location: '',
    shipping_date: null,
    package_size: ''
  });
  const [errors, setErrors] = useState({});
  const [showDateModal, setShowDateModal] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!searchParams.pickup_location) newErrors.pickup_location = 'Please select a pickup location';
    if (!searchParams.delivery_location) newErrors.delivery_location = 'Please select a delivery location';
    if (!searchParams.shipping_date) newErrors.shipping_date = 'Please select a shipping date';
    if (!searchParams.package_size) newErrors.package_size = 'Please select a package size';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Store search params and navigate to results
    sessionStorage.setItem('packageSearchParams', JSON.stringify({
      ...searchParams,
      shipping_date: searchParams.shipping_date.toISOString()
    }));
    navigate('/services/packages/results');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Truck className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-4xl font-bold mb-4">Package Delivery Services</h1>
          <p className="text-lg text-slate-200">Fast and reliable package delivery across Cameroon</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pickup Location */}
                <LocationInput
                  value={searchParams.pickup_location}
                  onChange={(v) => {
                    setSearchParams(p => ({ ...p, pickup_location: v }));
                    setErrors(p => ({ ...p, pickup_location: null }));
                  }}
                  placeholder="Search pickup city..."
                  label="Pickup Location"
                  icon={MapPin}
                  iconColor="text-green-600"
                  excludeValue={searchParams.delivery_location}
                  error={errors.pickup_location}
                />

                {/* Delivery Location */}
                <LocationInput
                  value={searchParams.delivery_location}
                  onChange={(v) => {
                    setSearchParams(p => ({ ...p, delivery_location: v }));
                    setErrors(p => ({ ...p, delivery_location: null }));
                  }}
                  placeholder="Search delivery city..."
                  label="Delivery Location"
                  icon={MapPin}
                  iconColor="text-red-600"
                  excludeValue={searchParams.pickup_location}
                  error={errors.delivery_location}
                />

                {/* Shipping Date */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Shipping Date</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDateModal(true)}
                    className={cn(
                      "w-full justify-start text-left font-normal h-12 mt-1 bg-white border-slate-200 hover:bg-slate-50 hover:border-[#082c59]",
                      !searchParams.shipping_date && "text-muted-foreground",
                      searchParams.shipping_date && "font-medium text-slate-900",
                      errors.shipping_date && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                    {searchParams.shipping_date ? (
                      format(searchParams.shipping_date, 'PPP')
                    ) : (
                      <span>Select shipping date</span>
                    )}
                  </Button>
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.shipping_date}
                    onSelect={(date) => {
                      setSearchParams(p => ({ ...p, shipping_date: date }));
                      setErrors(p => ({ ...p, shipping_date: null }));
                    }}
                    minDate={new Date()}
                    title="Select Shipping Date"
                  />
                  {errors.shipping_date && (
                    <p className="text-xs text-red-500 mt-1">{errors.shipping_date}</p>
                  )}
                </div>

                {/* Package Size */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Package Size</Label>
                  <Select 
                    value={searchParams.package_size} 
                    onValueChange={(v) => {
                      setSearchParams(p => ({ ...p, package_size: v }));
                      setErrors(p => ({ ...p, package_size: null }));
                    }}
                  >
                    <SelectTrigger className={cn(
                      "h-12 mt-1 bg-white border-slate-200 hover:border-[#082c59]",
                      searchParams.package_size && "font-medium text-slate-900",
                      errors.package_size && "border-red-500"
                    )}>
                      <Package className="w-4 h-4 mr-2 text-blue-600" />
                      <SelectValue placeholder="Select package size" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-xl border-slate-200">
                      {Object.entries(PACKAGE_SIZES).map(([size, info]) => (
                        <SelectItem 
                          key={size} 
                          value={size}
                          className="py-3 hover:bg-[#082c59]/5 cursor-pointer transition-colors focus:bg-[#082c59]/10"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#082c59]">{size}</span>
                            <span className="text-slate-500 text-sm">
                              {info.dimensions} • max {info.maxWeight}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.package_size && <p className="text-xs text-red-500 mt-1">{errors.package_size}</p>}
                </div>
              </div>

              {/* Package Size Info */}
              {searchParams.package_size && (
                <div className="bg-[#082c59]/5 rounded-lg p-4 border border-[#082c59]/20">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-[#082c59] mt-0.5" />
                    <div>
                      <p className="font-medium text-[#082c59]">Size {searchParams.package_size}</p>
                      <p className="text-sm text-slate-600">
                        {PACKAGE_SIZES[searchParams.package_size].dimensions} • Max weight: {PACKAGE_SIZES[searchParams.package_size].maxWeight}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {PACKAGE_SIZES[searchParams.package_size].description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-lg">
                <Search className="w-5 h-5 mr-2" /> Find Delivery Services
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[#082c59]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-[#082c59]" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Fast Delivery</h3>
            <p className="text-sm text-slate-500">Same-day and express options available</p>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[#082c59]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-[#082c59]" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Secure Handling</h3>
            <p className="text-sm text-slate-500">Insurance coverage for all packages</p>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-[#082c59]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#082c59]" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Real-time Tracking</h3>
            <p className="text-sm text-slate-500">Track your package every step</p>
          </div>
        </div>
      </div>
    </div>
  );
}
