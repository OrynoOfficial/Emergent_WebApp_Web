import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Search, Shirt, Truck, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';

const SERVICE_TYPES = ['All Services', 'Washing', 'Ironing', 'Dry Cleaning', 'Leather Care', 'Alterations'];

export default function LaundrySearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    service_type: '',
    pickup_date: null,
    delivery: false,
    express: false
  });
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});
  const [showDateModal, setShowDateModal] = useState(false);

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
    if (searchParams.service_type && searchParams.service_type !== 'All Services') params.set('service', searchParams.service_type);
    if (searchParams.pickup_date) params.set('date', format(searchParams.pickup_date, 'yyyy-MM-dd'));
    if (searchParams.delivery) params.set('delivery', 'true');
    if (searchParams.express) params.set('express', 'true');
    navigate(`/services/laundry/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Shirt className="w-16 h-16 mx-auto mb-4 text-cyan-400" />
          <h1 className="text-4xl font-bold mb-4">Laundry & Pressing</h1>
          <p className="text-lg text-slate-200">Professional cleaning services at your doorstep</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* City */}
                <div>
                  <LocationInput
                    label="City"
                    value={searchParams.city}
                    onChange={(v) => {
                      setSearchParams(p => ({ ...p, city: v }));
                      setErrors(e => ({ ...e, city: undefined }));
                    }}
                    placeholder="Search city..."
                    required
                    error={errors.city}
                    shake={shakeFields.city}
                    iconColor="text-cyan-500"
                  />
                </div>

                {/* Service Type */}
                <div>
                  <Label>Service Type</Label>
                  <Select value={searchParams.service_type} onValueChange={v => setSearchParams(p => ({ ...p, service_type: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {SERVICE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pickup Date */}
                <div>
                  <Label>Pickup Date</Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowDateModal(true)}
                    className={cn("w-full mt-1 justify-start text-left font-normal bg-white h-12", !searchParams.pickup_date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.pickup_date ? format(searchParams.pickup_date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.pickup_date}
                    onSelect={(d) => setSearchParams(p => ({ ...p, pickup_date: d }))}
                    minDate={new Date()}
                    title="Select Pickup Date"
                  />
                </div>

                {/* Options */}
                <div>
                  <Label className="mb-2 block">Options</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <Button
                      type="button"
                      variant={searchParams.delivery ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSearchParams(p => ({ ...p, delivery: !p.delivery }))}
                      className={cn("h-12", searchParams.delivery ? "bg-[#082c59]" : "")}
                    >
                      <Truck className="w-4 h-4 mr-2" /> Delivery
                    </Button>
                    <Button
                      type="button"
                      variant={searchParams.express ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSearchParams(p => ({ ...p, express: !p.express }))}
                      className={cn("h-12", searchParams.express ? "bg-[#082c59]" : "")}
                    >
                      <Clock className="w-4 h-4 mr-2" /> Express
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
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
