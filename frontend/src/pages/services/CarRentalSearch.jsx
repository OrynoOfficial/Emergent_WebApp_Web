import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format, addDays } from 'date-fns';
import { CalendarIcon, MapPin, Search, Car, Fuel, Settings, Shield, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CAR_TYPES = ['All Types', 'Sedan', 'SUV', 'Luxury', 'Van', 'Pickup', 'Economy'];

export default function CarRentalSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    pickup_location: '',
    dropoff_location: '',
    car_type: '',
    pickup_date: null,
    return_date: null,
    with_driver: false
  });
  const [differentDropoff, setDifferentDropoff] = useState(false);
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    const fieldsToShake = {};
    
    if (!searchParams.pickup_location) {
      newErrors.pickup_location = 'Pickup location is required';
      fieldsToShake.pickup_location = true;
    }
    if (!searchParams.pickup_date) {
      newErrors.pickup_date = 'Pickup date is required';
      fieldsToShake.pickup_date = true;
    }
    if (!searchParams.return_date) {
      newErrors.return_date = 'Return date is required';
      fieldsToShake.return_date = true;
    }
    if (differentDropoff && !searchParams.dropoff_location) {
      newErrors.dropoff_location = 'Drop-off location is required';
      fieldsToShake.dropoff_location = true;
    }
    
    setErrors(newErrors);
    setShakeFields(fieldsToShake);
    
    // Reset shake after animation
    if (Object.keys(fieldsToShake).length > 0) {
      setTimeout(() => setShakeFields({}), 500);
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const params = new URLSearchParams();
    params.set('pickup', searchParams.pickup_location);
    if (differentDropoff && searchParams.dropoff_location) {
      params.set('dropoff', searchParams.dropoff_location);
    }
    if (searchParams.car_type && searchParams.car_type !== 'All Types') params.set('type', searchParams.car_type);
    params.set('pickup_date', format(searchParams.pickup_date, 'yyyy-MM-dd'));
    params.set('return_date', format(searchParams.return_date, 'yyyy-MM-dd'));
    if (searchParams.with_driver) params.set('driver', 'true');
    navigate(`/services/car-rental/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Car className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-4xl font-bold mb-4">Rent a Car</h1>
          <p className="text-lg text-slate-200">Find the perfect vehicle for your journey across Cameroon</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pickup Location with trailing Filters popover */}
                <div className={cn(differentDropoff ? "" : "md:col-span-2")}>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <LocationInput
                        label="Pickup Location"
                        value={searchParams.pickup_location}
                        onChange={(v) => setSearchParams(p => ({ ...p, pickup_location: v }))}
                        placeholder="Search pickup city..."
                        required
                        error={errors.pickup_location}
                        shake={shakeFields.pickup_location}
                        iconColor="text-emerald-500"
                      />
                    </div>
                    {/* Compact filter trigger sitting at the tail of the input.
                        Opens a small popover so the search form stays short. */}
                    <Popover open={showFilters} onOpenChange={setShowFilters}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-slate-700 text-xs font-semibold whitespace-nowrap"
                          data-testid="car-rental-search-filters-toggle"
                          aria-label="Open filters"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-[#082c59]" />
                          Filters
                          {((searchParams.car_type && searchParams.car_type !== 'All Types') || searchParams.with_driver) && (
                            <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-[#082c59] text-white text-[9px]">
                              {(searchParams.car_type && searchParams.car_type !== 'All Types' ? 1 : 0) + (searchParams.with_driver ? 1 : 0)}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-72 p-3 bg-white border-slate-200 shadow-xl"
                        data-testid="car-rental-search-filters-panel"
                      >
                        <div className="space-y-3">
                          <div>
                            <Label className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Vehicle Type</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {CAR_TYPES.map(type => {
                                const active = (searchParams.car_type || 'All Types') === type;
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSearchParams(p => ({ ...p, car_type: type }))}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                      active ? 'bg-[#082c59] text-white border-[#082c59]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                    data-testid={`car-type-chip-${type.toLowerCase().replace(/ /g, '-')}`}
                                  >
                                    {type}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <Label className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Driver</Label>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSearchParams(p => ({ ...p, with_driver: false }))}
                                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                  !searchParams.with_driver ? 'bg-[#082c59] text-white border-[#082c59]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                                data-testid="driver-option-self"
                              >
                                Self Drive
                              </button>
                              <button
                                type="button"
                                onClick={() => setSearchParams(p => ({ ...p, with_driver: true }))}
                                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                  searchParams.with_driver ? 'bg-[#082c59] text-white border-[#082c59]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                                data-testid="driver-option-with"
                              >
                                With Driver
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setSearchParams(p => ({ ...p, car_type: '', with_driver: false }))}
                              className="text-[11px] text-slate-500 hover:text-slate-700"
                            >
                              Clear all
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowFilters(false)}
                              className="text-[11px] font-semibold text-[#082c59] hover:underline"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Drop-off Location (conditional) */}
                {differentDropoff && (
                  <div>
                    <LocationInput
                      label="Drop-off Location"
                      value={searchParams.dropoff_location}
                      onChange={(v) => setSearchParams(p => ({ ...p, dropoff_location: v }))}
                      placeholder="Search drop-off city..."
                      required
                      error={errors.dropoff_location}
                      shake={shakeFields.dropoff_location}
                      iconColor="text-red-500"
                    />
                  </div>
                )}

                {/* Different Drop-off Toggle */}
                <div className="md:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Switch
                    id="different-dropoff"
                    checked={differentDropoff}
                    onCheckedChange={(checked) => {
                      setDifferentDropoff(checked);
                      if (!checked) {
                        setSearchParams(p => ({ ...p, dropoff_location: '' }));
                        setErrors(e => ({ ...e, dropoff_location: undefined }));
                      }
                    }}
                  />
                  <Label htmlFor="different-dropoff" className="cursor-pointer text-sm">
                    Return car at a different location
                  </Label>
                </div>

                {/* Filters were moved to the trailing button on the Pickup
                    Location row (see Popover above). The inline expanding
                    filters panel here was removed in iter 234. */}

                {/* Pickup Date */}
                <div>
                  <Label>Pickup Date <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowPickupModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.pickup_date && "text-muted-foreground",
                      errors.pickup_date && "border-red-500",
                      shakeFields.pickup_date && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.pickup_date ? format(searchParams.pickup_date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showPickupModal}
                    onClose={() => setShowPickupModal(false)}
                    selectedDate={searchParams.pickup_date}
                    onSelect={(d) => {
                      setSearchParams(p => ({ 
                        ...p, 
                        pickup_date: d,
                        return_date: p.return_date && d && p.return_date <= d ? addDays(d, 1) : p.return_date
                      }));
                      setErrors(e => ({ ...e, pickup_date: undefined }));
                    }}
                    minDate={new Date()}
                    title="Select Pickup Date"
                  />
                  {errors.pickup_date && <p className="text-xs text-red-500 mt-1">{errors.pickup_date}</p>}
                </div>

                {/* Return Date */}
                <div>
                  <Label>Return Date <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowReturnModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.return_date && "text-muted-foreground",
                      errors.return_date && "border-red-500",
                      shakeFields.return_date && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.return_date ? format(searchParams.return_date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showReturnModal}
                    onClose={() => setShowReturnModal(false)}
                    selectedDate={searchParams.return_date}
                    onSelect={(d) => {
                      setSearchParams(p => ({ ...p, return_date: d }));
                      setErrors(e => ({ ...e, return_date: undefined }));
                    }}
                    minDate={searchParams.pickup_date || new Date()}
                    title="Select Return Date"
                  />
                  {errors.return_date && <p className="text-xs text-red-500 mt-1">{errors.return_date}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Cars
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">Why Rent With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Fuel className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold mb-2">Full Tank Policy</h3>
            <p className="text-gray-600 text-sm">Pick up with a full tank, return it full</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Well Maintained</h3>
            <p className="text-gray-600 text-sm">Regularly serviced and inspected vehicles</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Full Insurance</h3>
            <p className="text-gray-600 text-sm">Comprehensive coverage included</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
