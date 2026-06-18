import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Shirt, Truck, Clock, Sparkles, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';

export default function LaundrySearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    shop_type: '', // 'laundry' | 'pressing' — filters the results page
  });
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});

  const validateForm = () => {
    const newErrors = {};
    const fieldsToShake = {};
    if (!searchParams.city) {
      newErrors.city = 'City is required';
      fieldsToShake.city = true;
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
    params.set('city', searchParams.city);
    if (searchParams.shop_type) params.set('shop_type', searchParams.shop_type);
    navigate(`/services/laundry/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section — original Oryno blue */}
      <div className="bg-[#082c59] text-white pt-14 pb-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Shirt className="w-12 h-12 mx-auto mb-3 text-cyan-400" />
          <h1 className="text-3xl font-bold mb-2">Laundry &amp; Pressing</h1>
          <p className="text-sm text-cyan-100 mb-5">Professional cleaning services at your doorstep</p>
          <div className="max-w-2xl mx-auto text-left">
            <LandingSmartSearch
              serviceType="laundry"
              resultsPath="/services/laundry/results"
              cityParam="city"
              cityLabel="Destination"
              selectedCity={searchParams.city}
              onSelectCity={(city) => {
                setSearchParams((p) => ({ ...p, city }));
                setErrors((e) => ({ ...e, city: undefined }));
              }}
              onClearCity={() => setSearchParams((p) => ({ ...p, city: '' }))}
              error={errors.city}
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
                {/* City owned by hero smart search (iter 251). */}

                {/* Service Type — binary toggle: Laundry vs Pressing */}
                <div>
                  <Label className="mb-2 block">Service Type</Label>
                  <div className="grid grid-cols-2 gap-3" data-testid="service-type-toggle">
                    <button
                      type="button"
                      onClick={() => setSearchParams((p) => ({ ...p, shop_type: p.shop_type === 'laundry' ? '' : 'laundry' }))}
                      className={cn(
                        'h-12 rounded-lg border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                        searchParams.shop_type === 'laundry'
                          ? 'border-[#082c59] bg-[#082c59] text-white shadow-md'
                          : 'border-slate-200 text-slate-600 hover:border-[#082c59]/60',
                      )}
                      data-testid="service-type-laundry"
                    >
                      <Droplets className="w-4 h-4" /> Laundry
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchParams((p) => ({ ...p, shop_type: p.shop_type === 'pressing' ? '' : 'pressing' }))}
                      className={cn(
                        'h-12 rounded-lg border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                        searchParams.shop_type === 'pressing'
                          ? 'border-[#082c59] bg-[#082c59] text-white shadow-md'
                          : 'border-slate-200 text-slate-600 hover:border-[#082c59]/60',
                      )}
                      data-testid="service-type-pressing"
                    >
                      <Sparkles className="w-4 h-4" /> Pressing
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Tap to filter — leave both unselected for all shops.</p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg"
                data-testid="laundry-search-submit"
              >
                <Search className="w-5 h-5 mr-2" /> Search Services
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">Why Choose Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-cyan-600" />
            </div>
            <h3 className="font-semibold mb-2">Expert Cleaning</h3>
            <p className="text-gray-600 text-sm">Professional care for all fabric types</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Free Pickup</h3>
            <p className="text-gray-600 text-sm">We come to you for pickup and delivery</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold mb-2">Express Service</h3>
            <p className="text-gray-600 text-sm">Same day turnaround available</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
