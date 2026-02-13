import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { format } from 'date-fns';
import { 
  CalendarIcon, MapPin, Users, Star, Phone, Mail, Clock, ArrowLeft, 
  CheckCircle2, CreditCard, Loader2, User, Building, Sparkles, Music, Camera
} from 'lucide-react';
import { banquetApi } from '@/api/management';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import CommissionBreakdown from '@/components/common/CommissionBreakdown';

const ADDON_SERVICES = [
  { id: 'catering', name: 'Catering Service', price: 150000, icon: Users, description: 'Full catering for all guests' },
  { id: 'decoration', name: 'Event Decoration', price: 100000, icon: Sparkles, description: 'Professional venue decoration' },
  { id: 'sound', name: 'Sound System & DJ', price: 75000, icon: Music, description: 'Premium sound equipment' },
  { id: 'photography', name: 'Photography Package', price: 50000, icon: Camera, description: 'Professional photo coverage' },
  { id: 'videography', name: 'Videography Package', price: 80000, icon: Camera, description: 'Full video documentation' }
];

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Event Details' },
    { num: 2, label: 'Add-ons' },
    { num: 3, label: 'Payment' }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num 
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-purple-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-purple-500' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function BanquetBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [booking, setBooking] = useState({
    event_date: null,
    event_type: '',
    guests: 50,
    start_time: '10:00',
    end_time: '18:00',
    addons: [],
    special_requests: '',
    contact_name: user?.name || '',
    contact_phone: user?.phone || '',
    contact_email: user?.email || ''
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);

  useEffect(() => {
    loadVenue();
  }, [id]);

  const loadVenue = async () => {
    try {
      setLoading(true);
      // First try sessionStorage
      const storedVenue = sessionStorage.getItem('selectedVenue');
      if (storedVenue) {
        const parsed = JSON.parse(storedVenue);
        if (parsed.id === id || !id) {
          setVenue(parsed);
          setLoading(false);
          return;
        }
      }
      // Then try API
      const res = await banquetApi.get(id);
      setVenue(res.data);
    } catch (error) {
      // Fallback to mock data
      setVenue({
        id: id,
        name: 'Grand Palace Hall',
        city: 'Yaoundé',
        address: '123 Boulevard Central, Yaoundé',
        venue_type: 'wedding',
        capacity_min: 100,
        capacity_max: 500,
        price_per_day: 500000,
        rating: 4.8,
        description: 'A magnificent hall perfect for weddings, corporate events, and grand celebrations.',
        amenities: ['catering', 'decoration', 'sound_system', 'parking', 'wifi', 'air_conditioning'],
        phone: '+237 699 123 456',
        email: 'info@grandpalace.cm'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAddon = (addonId) => {
    setBooking(prev => ({
      ...prev,
      addons: prev.addons.includes(addonId)
        ? prev.addons.filter(a => a !== addonId)
        : [...prev.addons, addonId]
    }));
  };

  const calculateTotal = () => {
    let total = venue?.price_per_day || 0;
    booking.addons.forEach(addonId => {
      const addon = ADDON_SERVICES.find(a => a.id === addonId);
      if (addon) total += addon.price;
    });
    return total;
  };

  const getCommission = () => Math.round(calculateTotal() * 0.05);
  const getTotalWithCommission = () => calculateTotal() + getCommission();

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      try {
        const eventDate = booking.event_date ? format(booking.event_date, 'yyyy-MM-dd') : '';
        const queryParams = new URLSearchParams({
          event_date: eventDate,
          event_type: booking.event_type || 'private',
          expected_guests: booking.guests.toString(),
          contact_name: booking.contact_name,
          contact_phone: booking.contact_phone,
          contact_email: booking.contact_email,
          special_requests: booking.special_requests || ''
        });
        booking.addons.forEach(addon => queryParams.append('additional_services', addon));
        
        const bookingResponse = await api.post(`/banquets/${id}/book?${queryParams.toString()}`);
        toast.success(`Booking confirmed! Total: ${formatFCFA(bookingResponse.data.total_price)}`);
        navigate('/orders');
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Booking failed. Please try again.');
      }
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!booking.event_date) {
      toast.error('Please select an event date');
      return;
    }
    if (!booking.contact_name || !booking.contact_phone || !booking.contact_email) {
      toast.error('Please fill in all contact details');
      return;
    }
    setCurrentStep(3);
    setTriggerPayment(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-500/20 rounded-full animate-pulse"></div>
            <Building className="h-10 w-10 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading venue details...</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <p className="text-slate-600 mb-4">Venue not found.</p>
          <Button onClick={() => navigate('/services/banquet')} className="bg-purple-500 hover:bg-purple-600">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={(date) => { setBooking(prev => ({ ...prev, event_date: date })); setIsDatePickerOpen(false); }}
        selectedDate={booking.event_date}
        minDate={new Date()}
      />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Book Your Event</h1>
              <p className="text-sm text-slate-500">{venue.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Details */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CalendarIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Event Details</h3>
                    <p className="text-sm text-white/70">When is your event?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Event Date *</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full justify-start text-left h-12 bg-slate-50", !booking.event_date && "text-muted-foreground")}
                      onClick={() => setIsDatePickerOpen(true)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />
                      {booking.event_date ? format(booking.event_date, 'PPP') : 'Select date'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Event Type</Label>
                    <Input
                      value={booking.event_type}
                      onChange={(e) => setBooking(prev => ({ ...prev, event_type: e.target.value }))}
                      placeholder="Wedding, Birthday, Conference..."
                      className="h-12 bg-slate-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Expected Guests</Label>
                    <Input
                      type="number"
                      value={booking.guests}
                      onChange={(e) => setBooking(prev => ({ ...prev, guests: parseInt(e.target.value) || 0 }))}
                      min={venue.capacity_min}
                      max={venue.capacity_max}
                      className="h-12 bg-slate-50"
                    />
                    <p className="text-xs text-slate-500">Capacity: {venue.capacity_min} - {venue.capacity_max}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Time</Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={booking.start_time}
                        onChange={(e) => setBooking(prev => ({ ...prev, start_time: e.target.value }))}
                        className="h-12 bg-slate-50"
                      />
                      <span className="flex items-center text-slate-400">to</span>
                      <Input
                        type="time"
                        value={booking.end_time}
                        onChange={(e) => setBooking(prev => ({ ...prev, end_time: e.target.value }))}
                        className="h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Contact Information</h3>
                    <p className="text-sm text-white/70">How can we reach you?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.contact_name}
                        onChange={(e) => setBooking(prev => ({ ...prev, contact_name: e.target.value }))}
                        placeholder="John Doe"
                        className="pl-10 h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.contact_phone}
                        onChange={(e) => setBooking(prev => ({ ...prev, contact_phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={booking.contact_email}
                        onChange={(e) => setBooking(prev => ({ ...prev, contact_email: e.target.value }))}
                        placeholder="john@example.com"
                        className="pl-10 h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Add-on Services */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Add-on Services</h3>
                    <p className="text-sm text-white/70">Make your event special</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ADDON_SERVICES.map((addon) => {
                    const isSelected = booking.addons.includes(addon.id);
                    const AddonIcon = addon.icon;
                    return (
                      <div
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <AddonIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-800">{addon.name}</h4>
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{addon.description}</p>
                            <p className="text-purple-600 font-semibold mt-2">+{formatFCFA(addon.price)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Special Requests</h3>
                    <p className="text-sm text-white/70">Any specific requirements?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <Textarea
                  value={booking.special_requests}
                  onChange={(e) => setBooking(prev => ({ ...prev, special_requests: e.target.value }))}
                  placeholder="E.g., specific seating arrangements, dietary restrictions..."
                  className="min-h-[100px] bg-slate-50"
                />
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-slate-400 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Payment Method</h3>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <PaymentMethodsSelection
                  amount={getTotalWithCommission()}
                  orderId={null}
                  serviceName={venue?.name || 'Banquet'}
                  onPaymentInitiated={handlePaymentInitiated}
                  onPaymentError={(error) => toast.error(error.message)}
                  triggerPayment={triggerPayment}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Venue Preview */}
                <div className="relative h-40 bg-gradient-to-br from-purple-400 to-purple-600">
                  <div className="w-full h-full flex items-center justify-center">
                    <Building className="w-16 h-16 text-white/50" />
                  </div>
                  <Badge className="absolute top-4 left-4 bg-purple-500 capitalize">{venue.venue_type}</Badge>
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="font-bold text-lg">{venue.name}</h3>
                    <p className="text-white/80 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {venue.city}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  {/* Event Details */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Event Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <CalendarIcon className="w-4 h-4 text-purple-500" />
                        <span>{booking.event_date ? format(booking.event_date, 'EEE, MMM d, yyyy') : 'Select date'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span>{booking.start_time} - {booking.end_time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span>{booking.guests} guests</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-5 -mb-5 p-5 rounded-b-2xl">
                    <h4 className="font-semibold text-white mb-3">Price Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Venue Rental</span>
                        <span>{formatFCFA(venue.price_per_day)}</span>
                      </div>
                      {booking.addons.length > 0 && booking.addons.map(addonId => {
                        const addon = ADDON_SERVICES.find(a => a.id === addonId);
                        return addon && (
                          <div key={addonId} className="flex justify-between text-slate-300">
                            <span>{addon.name}</span>
                            <span>+{formatFCFA(addon.price)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-slate-300">
                        <span>Service Fee (5%)</span>
                        <span>+{formatFCFA(getCommission())}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">Total</span>
                          <span className="text-2xl font-bold text-emerald-400">{formatFCFA(getTotalWithCommission())}</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSubmit}
                      disabled={paymentInProgress}
                      className="w-full mt-4 bg-purple-500 hover:bg-purple-600 text-white h-12 font-semibold rounded-xl"
                    >
                      {paymentInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Building className="w-4 h-4 mr-2" />
                          Confirm Booking
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
