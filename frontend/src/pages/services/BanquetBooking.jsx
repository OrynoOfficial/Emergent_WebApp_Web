import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Star, Phone, Mail, Clock, ArrowLeft, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { banquetApi } from '@/api/management';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import CommissionBreakdown from '@/components/common/CommissionBreakdown';

const ADDON_SERVICES = [
  { id: 'catering', name: 'Catering Service', price: 150000 },
  { id: 'decoration', name: 'Event Decoration', price: 100000 },
  { id: 'sound', name: 'Sound System & DJ', price: 75000 },
  { id: 'photography', name: 'Photography Package', price: 50000 },
  { id: 'videography', name: 'Videography Package', price: 80000 }
];

export default function BanquetBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
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
      const res = await banquetApi.get(id);
      setVenue(res.data);
    } catch (error) {
      // Mock data
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
        description: 'A magnificent hall perfect for weddings, corporate events, and grand celebrations. Features elegant decor, state-of-the-art sound system, and professional staff.',
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

  const getCommission = () => {
    return Math.round(calculateTotal() * 0.05);
  };

  const getTotalWithCommission = () => {
    return calculateTotal() + getCommission();
  };

  const isFormValid = () => {
    return booking.event_date && booking.contact_name && booking.contact_phone && booking.contact_email;
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      try {
        // Create the banquet booking in the backend using query parameters as per the API
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

        // Add additional services as repeated params
        booking.addons.forEach(addon => {
          queryParams.append('additional_services', addon);
        });

        const bookingResponse = await api.post(`/banquets/${id}/book?${queryParams.toString()}`);
        
        toast.success(`Booking confirmed! Total: ${formatFCFA(bookingResponse.data.total_price)}`);
        navigate('/orders');
      } catch (error) {
        console.error('Booking creation failed:', error);
        toast.error(error.response?.data?.detail || 'Booking failed. Please try again.');
      }
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handlePayButtonClick = () => {
    if (!isFormValid()) {
      if (!booking.event_date) {
        toast.error('Please select an event date');
      } else {
        toast.error('Please fill in all contact details');
      }
      return;
    }
    setTriggerPayment(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!booking.event_date) {
      toast.error('Please select an event date');
      return;
    }
    // This form submission is handled via payment flow
    // The handlePayButtonClick will trigger the payment and then handlePaymentInitiated will create the booking
    handlePayButtonClick();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!venue) return <div className="min-h-screen flex items-center justify-center">Venue not found</div>;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Venue Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="h-64 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <div className="text-center">
                  <Users className="w-16 h-16 text-purple-600 mx-auto mb-2" />
                  <Badge className="capitalize text-lg">{venue.venue_type}</Badge>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#082c59]">{venue.name}</h1>
                    <div className="flex items-center text-gray-600 mt-1">
                      <MapPin className="w-4 h-4 mr-1" /> {venue.address || venue.city}
                    </div>
                  </div>
                  {venue.rating && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{venue.rating}</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-600 mb-4">{venue.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {venue.amenities?.map(amenity => (
                    <Badge key={amenity} variant="outline" className="capitalize">
                      <CheckCircle className="w-3 h-3 mr-1" /> {amenity.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span>{venue.capacity_min} - {venue.capacity_max} guests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{venue.phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Form */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Event Date *</Label>
                      <Button 
                        variant="outline" 
                        className={cn("w-full mt-1 justify-start text-left bg-white", !booking.event_date && "text-muted-foreground")}
                        onClick={() => setIsDatePickerOpen(true)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {booking.event_date ? format(booking.event_date, 'PPP') : 'Select date'}
                      </Button>
                      <DatePickerModal
                        isOpen={isDatePickerOpen}
                        onClose={() => setIsDatePickerOpen(false)}
                        onSelect={(d) => setBooking(p => ({ ...p, event_date: d }))}
                        selectedDate={booking.event_date}
                        title="Select Event Date"
                        minDate={new Date()}
                      />
                    </div>
                    <div>
                      <Label>Number of Guests *</Label>
                      <Input type="number" min={venue.capacity_min} max={venue.capacity_max} value={booking.guests} onChange={e => setBooking(p => ({ ...p, guests: parseInt(e.target.value) }))} className="mt-1" />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={booking.start_time} onChange={e => setBooking(p => ({ ...p, start_time: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input type="time" value={booking.end_time} onChange={e => setBooking(p => ({ ...p, end_time: e.target.value }))} className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">Add-on Services</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ADDON_SERVICES.map(addon => (
                        <div key={addon.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${booking.addons.includes(addon.id) ? 'border-[#082c59] bg-blue-50' : 'hover:border-gray-300'}`} onClick={() => toggleAddon(addon.id)}>
                          <div className="flex items-center gap-3">
                            <Checkbox checked={booking.addons.includes(addon.id)} />
                            <span>{addon.name}</span>
                          </div>
                          <span className="font-medium">{formatFCFA(addon.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Special Requests</Label>
                    <Textarea value={booking.special_requests} onChange={e => setBooking(p => ({ ...p, special_requests: e.target.value }))} placeholder="Any special requirements or requests..." className="mt-1" rows={3} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Contact Name *</Label>
                      <Input value={booking.contact_name} onChange={e => setBooking(p => ({ ...p, contact_name: e.target.value }))} className="mt-1" required />
                    </div>
                    <div>
                      <Label>Phone *</Label>
                      <Input value={booking.contact_phone} onChange={e => setBooking(p => ({ ...p, contact_phone: e.target.value }))} className="mt-1" required />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input type="email" value={booking.contact_email} onChange={e => setBooking(p => ({ ...p, contact_email: e.target.value }))} className="mt-1" required />
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Price Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Price Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Venue Rental</span>
                  <span className="font-medium">{formatFCFA(venue.price_per_day)}</span>
                </div>
                {booking.addons.map(addonId => {
                  const addon = ADDON_SERVICES.find(a => a.id === addonId);
                  return addon ? (
                    <div key={addonId} className="flex justify-between text-sm">
                      <span>{addon.name}</span>
                      <span>{formatFCFA(addon.price)}</span>
                    </div>
                  ) : null;
                })}

                <CommissionBreakdown
                  basePrice={calculateTotal()}
                  commissionRate={5}
                  commissionAmount={getCommission()}
                  totalAmount={getTotalWithCommission()}
                  showDetails={true}
                />

                {/* Payment Methods */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-[#082c59]" />
                    <h3 className="font-semibold text-slate-800">Payment Method</h3>
                  </div>
                  
                  <PaymentMethodsSelection
                    amount={getTotalWithCommission()}
                    customerPhone={booking.contact_phone}
                    customerEmail={booking.contact_email}
                    serviceDetails={{
                      service_category: 'banquet',
                      service_title: `${venue.name} - ${booking.event_type || 'Event'}`,
                      operator_id: venue.operator_id,
                      operator_name: venue.name,
                      booking_details: {
                        venue,
                        booking
                      }
                    }}
                    onPaymentInitiated={handlePaymentInitiated}
                    disabled={!isFormValid() || paymentInProgress}
                    triggerPayment={triggerPayment}
                    onTrigger={() => setPaymentInProgress(true)}
                  />
                  
                  <Button 
                    onClick={handlePayButtonClick} 
                    className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 mt-4"
                    disabled={paymentInProgress}
                  >
                    {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {paymentInProgress ? 'Processing...' : `Pay ${formatFCFA(getTotalWithCommission())}`}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 text-center">Secure payment. The venue will confirm availability.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
