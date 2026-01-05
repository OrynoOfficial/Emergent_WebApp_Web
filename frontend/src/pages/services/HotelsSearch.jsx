import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format, addDays } from 'date-fns';
import { CalendarIcon, MapPin, Users, Search, Hotel, Plus, Minus, Star, Wifi, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';

export default function HotelsSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    destination: '',
    check_in: null,
    check_out: null,
    rooms: 1,
    guests: 2
  });
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    const fieldsToShake = {};
    
    if (!searchParams.destination) {
      newErrors.destination = 'Destination is required';
      fieldsToShake.destination = true;
    }
    if (!searchParams.check_in) {
      newErrors.check_in = 'Check-in date is required';
      fieldsToShake.check_in = true;
    }
    if (!searchParams.check_out) {
      newErrors.check_out = 'Check-out date is required';
      fieldsToShake.check_out = true;
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
    params.set('destination', searchParams.destination);
    params.set('checkIn', format(searchParams.check_in, 'yyyy-MM-dd'));
    params.set('checkOut', format(searchParams.check_out, 'yyyy-MM-dd'));
    params.set('rooms', searchParams.rooms.toString());
    params.set('adults', searchParams.guests.toString());
    navigate(`/services/hotels/results?${params.toString()}`);
  };

  const updateRooms = (delta) => {
    setSearchParams(prev => ({
      ...prev,
      rooms: Math.max(1, Math.min(5, prev.rooms + delta))
    }));
  };

  const updateGuests = (delta) => {
    setSearchParams(prev => ({
      ...prev,
      guests: Math.max(1, Math.min(10, prev.guests + delta))
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Hotel className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Stay</h1>
          <p className="text-lg text-slate-200">Book hotels, guesthouses, and apartments across Cameroon</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Destination */}
                <div className="md:col-span-2">
                  <LocationInput
                    label="Destination"
                    value={searchParams.destination}
                    onChange={(v) => {
                      setSearchParams(p => ({ ...p, destination: v }));
                      setErrors(e => ({ ...e, destination: undefined }));
                    }}
                    placeholder="Where do you want to stay?"
                    required
                    error={errors.destination}
                    shake={shakeFields.destination}
                    iconColor="text-amber-500"
                  />
                </div>

                {/* Check-in Date */}
                <div>
                  <Label>Check-in <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowCheckInModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.check_in && "text-muted-foreground",
                      errors.check_in && "border-red-500",
                      shakeFields.check_in && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.check_in ? format(searchParams.check_in, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showCheckInModal}
                    onClose={() => setShowCheckInModal(false)}
                    selectedDate={searchParams.check_in}
                    onSelect={(d) => {
                      setSearchParams(p => ({ 
                        ...p, 
                        check_in: d,
                        check_out: p.check_out && d && p.check_out <= d ? addDays(d, 1) : p.check_out
                      }));
                      setErrors(e => ({ ...e, check_in: undefined }));
                    }}
                    minDate={new Date()}
                    title="Select Check-in Date"
                  />
                  {errors.check_in && <p className="text-xs text-red-500 mt-1">{errors.check_in}</p>}
                </div>

                {/* Check-out Date */}
                <div>
                  <Label>Check-out <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowCheckOutModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.check_out && "text-muted-foreground",
                      errors.check_out && "border-red-500",
                      shakeFields.check_out && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.check_out ? format(searchParams.check_out, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showCheckOutModal}
                    onClose={() => setShowCheckOutModal(false)}
                    selectedDate={searchParams.check_out}
                    onSelect={(d) => {
                      setSearchParams(p => ({ ...p, check_out: d }));
                      setErrors(e => ({ ...e, check_out: undefined }));
                    }}
                    minDate={searchParams.check_in || new Date()}
                    title="Select Check-out Date"
                  />
                  {errors.check_out && <p className="text-xs text-red-500 mt-1">{errors.check_out}</p>}
                </div>

                {/* Rooms */}
                <div>
                  <Label>Rooms</Label>
                  <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white h-12">
                    <Hotel className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{searchParams.rooms} Room{searchParams.rooms > 1 ? 's' : ''}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateRooms(-1)} disabled={searchParams.rooms <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateRooms(1)} disabled={searchParams.rooms >= 5}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Guests */}
                <div>
                  <Label>Guests</Label>
                  <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white h-12">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{searchParams.guests} Guest{searchParams.guests > 1 ? 's' : ''}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGuests(-1)} disabled={searchParams.guests <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateGuests(1)} disabled={searchParams.guests >= 10}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Hotels
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">Why Book With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-semibold mb-2">Verified Reviews</h3>
            <p className="text-gray-600 text-sm">Real reviews from verified guests</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wifi className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Modern Amenities</h3>
            <p className="text-gray-600 text-sm">WiFi, AC, and essential amenities included</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Free Cancellation</h3>
            <p className="text-gray-600 text-sm">Flexible booking with free cancellation options</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
