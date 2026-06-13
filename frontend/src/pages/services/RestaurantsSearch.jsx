import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Search, Utensils, Clock, Plus, Minus, Star, Award, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';

const CUISINE_TYPES = ['All Cuisines', 'African', 'French', 'Italian', 'Chinese', 'Lebanese', 'Seafood', 'Fast Food'];
const TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

export default function RestaurantsSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    cuisine: '',
    date: null,
    time: '',
    guests: 2
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
    if (searchParams.cuisine && searchParams.cuisine !== 'All Cuisines') params.set('cuisine', searchParams.cuisine);
    if (searchParams.date) params.set('date', format(searchParams.date, 'yyyy-MM-dd'));
    if (searchParams.time) params.set('time', searchParams.time);
    params.set('guests', searchParams.guests.toString());
    navigate(`/services/restaurants/results?${params.toString()}`);
  };

  const updateGuests = (delta) => {
    setSearchParams(prev => ({
      ...prev,
      guests: Math.max(1, Math.min(20, prev.guests + delta))
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="px-4 text-center">
          <Utensils className="w-16 h-16 mx-auto mb-4 text-orange-400" />
          <h1 className="text-4xl font-bold mb-4">Discover Great Restaurants</h1>
          <p className="text-lg text-slate-200">Reserve tables at the best restaurants in Cameroon</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="px-4 -mt-8">
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
                    serviceType="restaurant"
                    error={errors.city}
                    shake={shakeFields.city}
                    iconColor="text-orange-500"
                  />
                </div>

                {/* Cuisine Type */}
                <div>
                  <Label>Cuisine Type</Label>
                  <Select value={searchParams.cuisine} onValueChange={v => setSearchParams(p => ({ ...p, cuisine: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <SelectValue placeholder="Select cuisine" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {CUISINE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div>
                  <Label>Date</Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowDateModal(true)}
                    className={cn("w-full mt-1 justify-start text-left font-normal bg-white h-12", !searchParams.date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.date ? format(searchParams.date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.date}
                    onSelect={(d) => setSearchParams(p => ({ ...p, date: d }))}
                    minDate={new Date()}
                    title="Select Reservation Date"
                  />
                </div>

                {/* Time */}
                <div>
                  <Label>Time</Label>
                  <Select value={searchParams.time} onValueChange={v => setSearchParams(p => ({ ...p, time: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {TIME_SLOTS.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Guests */}
                <div className="md:col-span-2">
                  <Label>Number of Guests</Label>
                  <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white max-w-xs h-12">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{searchParams.guests} Guest{searchParams.guests > 1 ? 's' : ''}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGuests(-1)} disabled={searchParams.guests <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGuests(1)} disabled={searchParams.guests >= 20}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Restaurants
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">Why Book With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold mb-2">Top Rated</h3>
            <p className="text-gray-600 text-sm">Only the best restaurants with verified reviews</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Exclusive Offers</h3>
            <p className="text-gray-600 text-sm">Special deals and discounts for online bookings</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Easy Payment</h3>
            <p className="text-gray-600 text-sm">Pay online or at the restaurant</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
