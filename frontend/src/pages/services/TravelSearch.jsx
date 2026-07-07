import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Search, Bus, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import DatePickerModal from '@/components/shared/DatePickerModal';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';

export default function TravelSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    from_city: '',
    to_city: '',
    departure_date: null,
    return_date: null,
    passengers: 1
  });
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    const fieldsToShake = {};
    
    if (!searchParams.from_city) {
      newErrors.from_city = 'Departure city is required';
      fieldsToShake.from_city = true;
    }
    if (!searchParams.to_city) {
      newErrors.to_city = 'Destination city is required';
      fieldsToShake.to_city = true;
    }
    if (!searchParams.departure_date) {
      newErrors.departure_date = 'Departure date is required';
      fieldsToShake.departure_date = true;
    }
    if (isRoundTrip && !searchParams.return_date) {
      newErrors.return_date = 'Return date is required';
      fieldsToShake.return_date = true;
    }
    
    setErrors(newErrors);
    setShakeFields(fieldsToShake);
    
    if (Object.keys(fieldsToShake).length > 0) {
      setTimeout(() => setShakeFields({}), 500);
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const params = new URLSearchParams();
    params.set('from', searchParams.from_city);
    params.set('to', searchParams.to_city);
    params.set('date', format(searchParams.departure_date, 'yyyy-MM-dd'));
    params.set('passengers', searchParams.passengers.toString());
    if (isRoundTrip && searchParams.return_date) {
      params.set('return', format(searchParams.return_date, 'yyyy-MM-dd'));
    }
    navigate(`/services/travel/results?${params.toString()}`);
  };

  const swapCities = () => {
    setSearchParams(prev => ({
      ...prev,
      from_city: prev.to_city,
      to_city: prev.from_city
    }));
  };

  const updatePassengers = (delta) => {
    setSearchParams(prev => ({
      ...prev,
      passengers: Math.max(1, Math.min(10, prev.passengers + delta))
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white pt-14 pb-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Bus className="w-12 h-12 mx-auto mb-3 text-cyan-400" />
          <h1 className="text-3xl font-bold mb-2">{t('services.hero_travel')}</h1>
          <p className="text-sm text-slate-200 mb-5">Book bus tickets across all major cities in Cameroon</p>
          {/* Dual smart-search bars — From + To — with a swap arrow between
              them. Replaces the legacy single hero bar + secondary "To"
              LocationInput in the form below (iter 252). */}
          <div className="max-w-3xl mx-auto text-left">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-start">
              <LandingSmartSearch
                serviceType="travel"
                pageType="travel_from"
                resultsPath="/services/travel/results"
                cityParam="from"
                cityLabel="From"
                placeholder="Departure city — e.g. Douala"
                selectedCity={searchParams.from_city}
                onSelectCity={(city) => {
                  setSearchParams(p => ({ ...p, from_city: city }));
                  setErrors(e => ({ ...e, from_city: undefined }));
                }}
                onClearCity={() =>
                  setSearchParams(p => ({ ...p, from_city: '' }))
                }
                error={errors.from_city}
              />
              <button
                type="button"
                onClick={swapCities}
                aria-label="Swap from and to cities"
                title="Swap cities"
                className="self-start mt-2 md:mt-2 h-14 w-12 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white shrink-0"
                data-testid="travel-swap-cities"
              >
                <ArrowRightLeft className="w-5 h-5" />
              </button>
              <LandingSmartSearch
                serviceType="travel"
                pageType="travel_to"
                resultsPath="/services/travel/results"
                cityParam="to"
                cityLabel="To"
                placeholder="Destination city — e.g. Yaoundé"
                selectedCity={searchParams.to_city}
                onSelectCity={(city) => {
                  setSearchParams(p => ({ ...p, to_city: city }));
                  setErrors(e => ({ ...e, to_city: undefined }));
                }}
                onClearCity={() =>
                  setSearchParams(p => ({ ...p, to_city: '' }))
                }
                error={errors.to_city}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <Card className="shadow-xl">
          <CardContent className="p-5">
            {/* Trip Type Toggle */}
            <div className="flex items-center gap-3 mb-4">
              <Button
                type="button"
                variant={!isRoundTrip ? "default" : "outline"}
                onClick={() => setIsRoundTrip(false)}
                className={!isRoundTrip ? "bg-[#082c59]" : ""}
              >
                One Way
              </Button>
              <Button
                type="button"
                variant={isRoundTrip ? "default" : "outline"}
                onClick={() => setIsRoundTrip(true)}
                className={isRoundTrip ? "bg-[#082c59]" : ""}
              >
                Round Trip
              </Button>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From + To cities owned by the dual hero smart bars
                    (iter 252). Legacy LocationInput rows + swap button
                    removed from the form. */}

                {/* Departure Date */}
                <div>
                  <Label>Departure Date <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowDepartureModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.departure_date && "text-muted-foreground",
                      errors.departure_date && "border-red-500",
                      shakeFields.departure_date && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.departure_date ? format(searchParams.departure_date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showDepartureModal}
                    onClose={() => setShowDepartureModal(false)}
                    selectedDate={searchParams.departure_date}
                    onSelect={(d) => {
                      setSearchParams(p => ({ ...p, departure_date: d }));
                      setErrors(e => ({ ...e, departure_date: undefined }));
                    }}
                    minDate={new Date()}
                    title="Select Departure Date"
                  />
                  {errors.departure_date && <p className="text-xs text-red-500 mt-1">{errors.departure_date}</p>}
                </div>

                {/* Return Date or Passengers */}
                {isRoundTrip ? (
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
                      minDate={searchParams.departure_date || new Date()}
                      title="Select Return Date"
                    />
                    {errors.return_date && <p className="text-xs text-red-500 mt-1">{errors.return_date}</p>}
                  </div>
                ) : (
                  <div>
                    <Label>Passengers</Label>
                    <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white h-12">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="flex-1">{searchParams.passengers} Passenger{searchParams.passengers > 1 ? 's' : ''}</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePassengers(-1)} disabled={searchParams.passengers <= 1}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePassengers(1)} disabled={searchParams.passengers >= 10}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Passengers for Round Trip */}
              {isRoundTrip && (
                <div className="max-w-xs">
                  <Label>Passengers</Label>
                  <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white h-12">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{searchParams.passengers} Passenger{searchParams.passengers > 1 ? 's' : ''}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePassengers(-1)} disabled={searchParams.passengers <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updatePassengers(1)} disabled={searchParams.passengers >= 10}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Buses
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">{t('services.why_travel')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">All Major Routes</h3>
            <p className="text-gray-600 text-sm">Coverage across Cameroon with daily departures</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bus className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Modern Fleet</h3>
            <p className="text-gray-600 text-sm">Comfortable buses with AC and reclining seats</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Best Prices</h3>
            <p className="text-gray-600 text-sm">Compare agencies and get the best deals</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
