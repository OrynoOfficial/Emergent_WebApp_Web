import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Search, Ticket, Users, Music, Award, Clock, Plus, Minus, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationInput from '@/components/shared/LocationInput';
import DatePickerModal from '@/components/shared/DatePickerModal';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

const EVENT_TYPES = ['All Events', 'Concert', 'Festival', 'Sports', 'Conference', 'Party', 'Exhibition', 'Theater'];

export default function EventsSearch() {
  const { t } = useTranslation();
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
    // iter 252: Date is now mandatory. The results page uses the chosen date
    // (± 3 days) to pull events, plus the option to extend into future weeks.
    if (!searchParams.date) {
      newErrors.date = 'Pick a date — events are filtered around it.';
      fieldsToShake.date = true;
      toast.error('Please pick a date to search events.');
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
      <div className="bg-[#082c59] text-white pt-14 pb-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Ticket className="w-12 h-12 mx-auto mb-3 text-pink-400" />
          <h1 className="text-3xl font-bold mb-2">{t('services.hero_events')}</h1>
          <p className="text-sm text-slate-200 mb-5">Find and book tickets for concerts, festivals, and more</p>
          <div className="max-w-2xl mx-auto text-left">
            <LandingSmartSearch
              serviceType="event"
              resultsPath="/services/events/results"
              cityParam="city"
              cityLabel="Destination"
              selectedCity={searchParams.city}
              onSelectCity={(city) => {
                setSearchParams(p => ({ ...p, city }));
                setErrors(e => ({ ...e, city: undefined }));
              }}
              onClearCity={() => setSearchParams(p => ({ ...p, city: '' }))}
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

                {/* Event Type moved into the Filters popover below
                    (iter 252). */}

                {/* Date — REQUIRED (iter 252). Used to filter events
                    ± 3 days on the results page. */}
                <div>
                  <Label>Date <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDateModal(true)}
                    className={cn(
                      "w-full mt-1 justify-start text-left font-normal bg-white h-12",
                      !searchParams.date && "text-muted-foreground",
                      shakeFields.date && "animate-shake",
                      errors.date && "border-red-500 ring-1 ring-red-500/30",
                    )}
                    data-testid="events-search-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {searchParams.date ? format(searchParams.date, 'PPP') : 'Select date'}
                  </Button>
                  {errors.date && (
                    <p className="text-xs text-red-600 mt-1">{errors.date}</p>
                  )}
                  <DatePickerModal
                    isOpen={showDateModal}
                    onClose={() => setShowDateModal(false)}
                    selectedDate={searchParams.date}
                    onSelect={(d) => {
                      setSearchParams(p => ({ ...p, date: d }));
                      setErrors(e => ({ ...e, date: undefined }));
                    }}
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

              <div className="flex items-center justify-between gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-12 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2 text-slate-700 text-sm font-semibold whitespace-nowrap"
                      data-testid="events-search-filters-toggle"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-[#082c59]" />
                      Filters
                      {(searchParams.event_type && searchParams.event_type !== 'All Events') && (
                        <span className="ml-0.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#082c59] text-white text-[10px]">1</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-3 bg-white border-slate-200 shadow-xl">
                    <div className="space-y-3">
                      <div>
                        <Label className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Event Type</Label>
                        <Select value={searchParams.event_type} onValueChange={v => setSearchParams(p => ({ ...p, event_type: v }))}>
                          <SelectTrigger className="bg-white h-9">
                            <SelectValue placeholder="Any type" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {EVENT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSearchParams(p => ({ ...p, event_type: '' }))}
                        className="text-[11px] text-slate-500 hover:text-slate-700"
                      >
                        Clear filters
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button type="submit" className="flex-1 bg-[#082c59] hover:bg-[#0a3a75] h-12 text-base">
                  <Search className="w-5 h-5 mr-2" /> Search Events
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">{t('services.why_book')}</h2>
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
