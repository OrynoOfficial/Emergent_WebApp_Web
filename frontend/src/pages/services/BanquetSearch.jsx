import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Search, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';

const VENUE_TYPES = ['wedding', 'conference', 'birthday', 'corporate', 'graduation', 'other'];

export default function BanquetSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    venue_type: '',
    event_date: null,
    guests: 50
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
    if (!searchParams.event_date) {
      newErrors.event_date = 'Event date is required';
      fieldsToShake.event_date = true;
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
    if (searchParams.venue_type) params.set('type', searchParams.venue_type);
    params.set('date', format(searchParams.event_date, 'yyyy-MM-dd'));
    if (searchParams.guests) params.set('guests', searchParams.guests.toString());
    navigate(`/services/banquet/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="px-4 text-center">
          <PartyPopper className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Venue</h1>
          <p className="text-lg text-slate-200">Book banquet halls, conference rooms, and event spaces across Cameroon</p>
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
                    error={errors.city}
                    shake={shakeFields.city}
                    iconColor="text-yellow-500"
                  />
                </div>

                {/* Event Type */}
                <div>
                  <Label>Event Type</Label>
                  <Select value={searchParams.venue_type} onValueChange={v => setSearchParams(p => ({ ...p, venue_type: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {VENUE_TYPES.map(type => (
                        <SelectItem key={type} value={type} className="capitalize">{type.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Date */}
                <div>
                  <Label>Event Date <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => setShowDateModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.event_date && "text-muted-foreground",
                      errors.event_date && "border-red-500",
                      shakeFields.event_date && "animate-shake"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.event_date ? format(searchParams.event_date, 'PPP') : 'Select date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.event_date}
                    onSelect={(d) => {
                      setSearchParams(p => ({ ...p, event_date: d }));
                      setErrors(e => ({ ...e, event_date: undefined }));
                    }}
                    minDate={new Date()}
                    title="Select Event Date"
                  />
                  {errors.event_date && <p className="text-xs text-red-500 mt-1">{errors.event_date}</p>}
                </div>

                {/* Number of Guests */}
                <div>
                  <Label>Number of Guests</Label>
                  <div className="relative mt-1">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      type="number" 
                      min="10" 
                      max="1000" 
                      value={searchParams.guests} 
                      onChange={e => setSearchParams(p => ({ ...p, guests: parseInt(e.target.value) || 50 }))} 
                      className="pl-10 h-12" 
                      placeholder="Number of guests" 
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Venues
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
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Wide Selection</h3>
            <p className="text-gray-600 text-sm">Access to hundreds of venues across all major cities</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Any Event Size</h3>
            <p className="text-gray-600 text-sm">From intimate gatherings to grand celebrations</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Full Service</h3>
            <p className="text-gray-600 text-sm">Catering, decoration, and equipment included options</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
