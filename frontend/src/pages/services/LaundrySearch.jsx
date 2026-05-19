import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Search, Shirt, Truck, Clock, Sparkles, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';

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
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Hero Section — purple accent */}
      <div className="bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Shirt className="w-16 h-16 mx-auto mb-4 text-purple-100" />
          <h1 className="text-4xl font-bold mb-4">Laundry &amp; Pressing</h1>
          <p className="text-lg text-purple-100">Professional cleaning services at your doorstep</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl border-purple-100">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* City */}
                <div>
                  <LocationInput
                    label="City"
                    value={searchParams.city}
                    onChange={(v) => {
                      setSearchParams((p) => ({ ...p, city: v }));
                      setErrors((e) => ({ ...e, city: undefined }));
                    }}
                    placeholder="Search city..."
                    required
                    error={errors.city}
                    shake={shakeFields.city}
                    iconColor="text-purple-600"
                  />
                </div>

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
                          ? 'border-purple-600 bg-purple-50 text-purple-800 shadow-md shadow-purple-200'
                          : 'border-slate-200 text-slate-600 hover:border-purple-300',
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
                          ? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-800 shadow-md shadow-fuchsia-200'
                          : 'border-slate-200 text-slate-600 hover:border-fuchsia-300',
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
                className="w-full bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-800 hover:to-purple-700 h-12 text-lg shadow-md shadow-purple-300/40"
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
        <h2 className="text-2xl font-bold text-center mb-8 text-purple-800">Why Choose Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6 border-purple-100">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="font-semibold mb-2">Expert Cleaning</h3>
            <p className="text-gray-600 text-sm">Professional care for all fabric types</p>
          </Card>
          <Card className="text-center p-6 border-purple-100">
            <div className="w-12 h-12 bg-fuchsia-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6 text-fuchsia-700" />
            </div>
            <h3 className="font-semibold mb-2">Free Pickup</h3>
            <p className="text-gray-600 text-sm">We come to you for pickup and delivery</p>
          </Card>
          <Card className="text-center p-6 border-purple-100">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-purple-700" />
            </div>
            <h3 className="font-semibold mb-2">Express Service</h3>
            <p className="text-gray-600 text-sm">Same day turnaround available</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
