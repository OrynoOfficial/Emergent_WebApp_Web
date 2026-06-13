import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Search, Ticket, Users, Music, Award, Clock, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';

const EVENT_TYPES = ['All Events', 'Concert', 'Festival', 'Sports', 'Conference', 'Party', 'Exhibition', 'Theater'];

export default function EventsSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    event_type: '',
    date: null,
    tickets: 1
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
    if (searchParams.event_type && searchParams.event_type !== 'All Events') params.set('type', searchParams.event_type);
    if (searchParams.date) params.set('date', format(searchParams.date, 'yyyy-MM-dd'));
    params.set('tickets', searchParams.tickets.toString());
    navigate(`/services/events/results?${params.toString()}`);
  };

  const updateTickets = (delta) => {
    setSearchParams(prev => ({
      ...prev,
      tickets: Math.max(1, Math.min(10, prev.tickets + delta))
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="px-4 text-center">
          <Ticket className="w-16 h-16 mx-auto mb-4 text-pink-400" />
          <h1 className="text-4xl font-bold mb-4">Discover Events</h1>
          <p className="text-lg text-slate-200">Find and book tickets for concerts, festivals, and more</p>
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
                    iconColor="text-pink-500"
                  />
                </div>

                {/* Event Type */}
                <div>
                  <Label>Event Type</Label>
                  <Select value={searchParams.event_type} onValueChange={v => setSearchParams(p => ({ ...p, event_type: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {EVENT_TYPES.map(type => (
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
                    {searchParams.date ? format(searchParams.date, 'PPP') : 'Any date'}
                  </Button>
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.date}
                    onSelect={(d) => setSearchParams(p => ({ ...p, date: d }))}
                    minDate={new Date()}
                    title="Select Event Date"
                  />
                </div>

                {/* Number of Tickets */}
                <div>
                  <Label>Number of Tickets</Label>
                  <div className="flex items-center gap-4 mt-1 p-3 border rounded-md bg-white h-12">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{searchParams.tickets} Ticket{searchParams.tickets > 1 ? 's' : ''}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateTickets(-1)} disabled={searchParams.tickets <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateTickets(1)} disabled={searchParams.tickets >= 10}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Events
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
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Music className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="font-semibold mb-2">Wide Selection</h3>
            <p className="text-gray-600 text-sm">Concerts, festivals, sports, and more</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Official Tickets</h3>
            <p className="text-gray-600 text-sm">Guaranteed authentic tickets</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Instant Delivery</h3>
            <p className="text-gray-600 text-sm">Get your tickets immediately via email</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
