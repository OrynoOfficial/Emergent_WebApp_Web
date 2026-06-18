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
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';

// Package sizes with dimensions and weight limits
const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg', description: 'Small packages, documents' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg', description: 'Medium packages, books' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg', description: 'Large packages, electronics' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg', description: 'Extra large packages, furniture' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg', description: 'Oversized packages, appliances' }
};

export default function PackagesSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    pickup_location: '',
    delivery_location: '',
    shipping_date: null,
    package_size: '',
    weight_kg: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
    package_type: 'parcel',
  });
  const [errors, setErrors] = useState({});
  const [showDateModal, setShowDateModal] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!searchParams.pickup_location) newErrors.pickup_location = 'Please select a pickup location';
    if (!searchParams.delivery_location) newErrors.delivery_location = 'Please select a delivery location';
    if (!searchParams.shipping_date) newErrors.shipping_date = 'Please select a shipping date';
    if (!searchParams.weight_kg || parseFloat(searchParams.weight_kg) <= 0) newErrors.weight_kg = 'Weight must be greater than 0';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      ...searchParams,
      shipping_date: searchParams.shipping_date.toISOString(),
    };
    sessionStorage.setItem('packageSearchParams', JSON.stringify(payload));

    const qs = new URLSearchParams({
      origin: searchParams.pickup_location,
      destination: searchParams.delivery_location,
      weight_kg: String(searchParams.weight_kg || ''),
      length_cm: String(searchParams.length_cm || ''),
      width_cm: String(searchParams.width_cm || ''),
      height_cm: String(searchParams.height_cm || ''),
      package_type: searchParams.package_type || 'parcel',
      shipping_date: searchParams.shipping_date.toISOString(),
    }).toString();
    navigate(`/services/packages/results?${qs}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white pt-14 pb-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Truck className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
          <h1 className="text-3xl font-bold mb-2">Package Delivery Services</h1>
          <p className="text-sm text-slate-200 mb-5">Fast and reliable package delivery across Cameroon</p>
          {/* Smart hero search owns pickup city; delivery city stays as a
              regular field below (we want both visible at once). */}
          <div className="max-w-2xl mx-auto text-left">
            <LandingSmartSearch
              serviceType="travel"
              resultsPath="/services/packages/results"
              cityParam="origin"
              selectedCity={searchParams.pickup_location}
              onSelectCity={(city) => {
                setSearchParams(p => ({ ...p, pickup_location: city }));
                setErrors(p => ({ ...p, pickup_location: null }));
              }}
              onClearCity={() =>
                setSearchParams(p => ({ ...p, pickup_location: '' }))
              }
              error={errors.pickup_location}
            />
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <Card className="shadow-xl">
          <CardContent className="p-5">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pickup owned by hero smart search (iter 251). */}

                {/* Delivery Location */}
                <LocationInput
                  value={searchParams.delivery_location}
                  onChange={(v) => {
                    setSearchParams(p => ({ ...p, delivery_location: v }));
                    setErrors(p => ({ ...p, delivery_location: null }));
                  }}
                  placeholder="Search delivery city..."
                  label="Delivery Location"
                  serviceType="packages"
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

                {/* Package Size shortcut */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Quick Size (optional)</Label>
                  <Select
                    value={searchParams.package_size}
                    onValueChange={(v) => {
                      const info = PACKAGE_SIZES[v];
                      const dims = info?.dimensions?.match(/(\d+)×(\d+)×(\d+)/);
                      const wt = info?.maxWeight?.match(/(\d+)/);
                      setSearchParams(p => ({
                        ...p,
                        package_size: v,
                        length_cm: dims?.[1] || p.length_cm,
                        width_cm: dims?.[2] || p.width_cm,
                        height_cm: dims?.[3] || p.height_cm,
                        weight_kg: wt?.[1] || p.weight_kg,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-12 mt-1 bg-white border-slate-200 hover:border-[#082c59]">
                      <Package className="w-4 h-4 mr-2 text-blue-600" />
                      <SelectValue placeholder="Pick a size to auto-fill" />
                    </SelectTrigger>
                    <SelectContent className="bg-white shadow-xl border-slate-200">
                      {Object.entries(PACKAGE_SIZES).map(([size, info]) => (
                        <SelectItem key={size} value={size} className="py-3 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#082c59]">{size}</span>
                            <span className="text-slate-500 text-sm">{info.dimensions} • max {info.maxWeight}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Weight + Dimensions */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Weight (kg) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={searchParams.weight_kg}
                    onChange={(e) => { setSearchParams(p => ({ ...p, weight_kg: e.target.value })); setErrors(p => ({ ...p, weight_kg: null })); }}
                    placeholder="e.g. 2.5"
                    data-testid="package-weight-input"
                    className={cn("h-12 mt-1 bg-white", errors.weight_kg && "border-red-500")}
                  />
                  {errors.weight_kg && <p className="text-xs text-red-500 mt-1">{errors.weight_kg}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Length (cm)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={searchParams.length_cm}
                    onChange={(e) => setSearchParams(p => ({ ...p, length_cm: e.target.value }))}
                    placeholder="40"
                    className="h-12 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Width (cm)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={searchParams.width_cm}
                    onChange={(e) => setSearchParams(p => ({ ...p, width_cm: e.target.value }))}
                    placeholder="30"
                    className="h-12 mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Height (cm)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={searchParams.height_cm}
                    onChange={(e) => setSearchParams(p => ({ ...p, height_cm: e.target.value }))}
                    placeholder="20"
                    className="h-12 mt-1 bg-white"
                  />
                </div>
              </div>

              {/* Package type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Package Type</Label>
                  <Select
                    value={searchParams.package_type}
                    onValueChange={(v) => setSearchParams(p => ({ ...p, package_type: v }))}
                  >
                    <SelectTrigger className="h-12 mt-1 bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="parcel">Parcel</SelectItem>
                      <SelectItem value="fragile">Fragile</SelectItem>
                      <SelectItem value="perishable">Perishable</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="heavy_goods">Heavy Goods</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {searchParams.package_size && (
                  <div className="bg-[#082c59]/5 rounded-lg p-3 border border-[#082c59]/20 text-xs text-slate-600 flex items-center">
                    <Package className="w-4 h-4 text-[#082c59] mr-2" />
                    Auto-filled from <strong className="mx-1">{searchParams.package_size}</strong> — adjust above if needed.
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full h-12 bg-[#082c59] hover:bg-[#0a3a75] text-lg" data-testid="package-search-submit">
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
