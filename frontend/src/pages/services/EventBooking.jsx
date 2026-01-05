import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowLeft, Ticket, MapPin, Calendar, Clock, CreditCard, Users, Minus, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

const TICKET_TYPES = [
  { id: 'standard', name: 'Standard', multiplier: 1 },
  { id: 'vip', name: 'VIP', multiplier: 2 },
  { id: 'vvip', name: 'VVIP', multiplier: 3 }
];

export default function EventBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [ticketType, setTicketType] = useState('standard');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('selectedEvent') || 'null');
        if (!stored) {
          navigate('/services/events');
          return;
        }
        setEvent(stored);
        
        if (user?.email) {
          setFormData(prev => ({ ...prev, email: user.email }));
        }
      } catch (error) {
        navigate('/services/events');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [navigate, user]);

  const handleSelfChange = (checked) => {
    setIsSelf(checked);
    if (checked && user) {
      setFormData(prev => ({
        ...prev,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: user.email || '',
        phone: user.phone || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, name: '', phone: '' }));
    }
  };

  const calculatePricing = () => {
    if (!event) return { base: 0, commission: 0, total: 0 };
    
    const selectedTicket = TICKET_TYPES.find(t => t.id === ticketType);
    const basePrice = event.priceFrom * (selectedTicket?.multiplier || 1);
    const subtotal = basePrice * quantity;
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    
    return {
      basePrice,
      quantity,
      subtotal,
      commissionRate,
      commission,
      total: subtotal + commission
    };
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      try {
        const selectedTicket = TICKET_TYPES.find(t => t.id === ticketType);
        const unitPrice = event.priceFrom * (selectedTicket?.multiplier || 1);
        
        // Create the booking in the backend
        const bookingPayload = {
          event_id: event.id || event._id,
          event_name: event.name,
          ticket_type: ticketType,
          quantity: quantity,
          contact_name: formData.name,
          contact_email: formData.email,
          contact_phone: formData.phone,
          unit_price: unitPrice,
          subtotal: pricing.subtotal,
          commission: pricing.commission,
          total_amount: pricing.total
        };

        const bookingResponse = await api.post(`/events/${event.id || event._id}/book`, bookingPayload);
        
        toast.success(`Tickets Purchased! Booking #${bookingResponse.data.booking_number}`);
        sessionStorage.removeItem('selectedEvent');
        navigate('/orders');
      } catch (error) {
        console.error('Booking creation failed:', error);
        toast.error(error.response?.data?.detail || 'Booking failed. Please try again.');
      }
    } else {
      toast.error(`Purchase Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const pricing = calculatePricing();
  const isFormValid = formData.name && formData.email && formData.phone;
  const maxTickets = Math.min(10, event?.ticketsLeft || 10);
  
  // Callback when MoMo dialog opens - hide the overlay since MoMo has its own UI
  const handleMoMoDialogOpen = () => {
    setShowPaymentOverlay(false);
    setPaymentInProgress(false);
  };
  
  // Callback when payment processing state changes
  const handleProcessingChange = (isProcessing) => {
    setShowPaymentOverlay(isProcessing);
    if (!isProcessing) {
      setPaymentInProgress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#052c59]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md mx-auto text-center p-8">
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/events')} className="bg-[#052c59]">
            Back to Events
          </Button>
        </Card>
      </div>
    );
  }

  const eventDate = new Date(event.date);

  return (
    <div className="bg-slate-100 p-4 min-h-screen md:p-8">
      {/* Payment Processing Overlay */}
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing payment, please do not refresh page"
      />
      
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-4" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Get Your Tickets</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Ticket className="h-6 w-6 text-[#052c59]" />
                  Select Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ticket Type</Label>
                    <Select value={ticketType} onValueChange={setTicketType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPES.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} - {formatCurrency(event.priceFrom * type.multiplier)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-semibold w-12 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.min(maxTickets, quantity + 1))}
                        disabled={quantity >= maxTickets}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">Max {maxTickets} tickets per order</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-[#052c59]" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 bg-slate-100 p-3 rounded-lg">
                  <Switch checked={isSelf} onCheckedChange={handleSelfChange} />
                  <Label>Use my account details</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={isSelf}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={isSelf}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">E-tickets will be sent to this email</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right - Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-32 rounded-lg overflow-hidden">
                  <img src={event.image} alt={event.name} className="w-full h-full object-cover" />
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">{event.name}</h3>
                  <Badge>{event.type}</Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{format(eventDate, 'EEEE, MMMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{event.venue}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{TICKET_TYPES.find(t => t.id === ticketType)?.name} × {quantity}</span>
                    <span>{formatCurrency(pricing.subtotal)}</span>
                  </div>
                  
                  <CommissionBreakdown
                    basePrice={pricing.subtotal}
                    commissionRate={pricing.commissionRate}
                    commissionAmount={pricing.commission}
                    totalAmount={pricing.total}
                    showDetails={true}
                  />
                  
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-emerald-600">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMethodsSelection
                  amount={pricing.total}
                  customerPhone={formData.phone}
                  customerEmail={formData.email}
                  serviceDetails={{
                    service_category: 'event',
                    service_title: event.name,
                    booking_details: { ...event, ...formData, ticketType, quantity }
                  }}
                  onPaymentInitiated={handlePaymentInitiated}
                  disabled={!isFormValid || paymentInProgress}
                  triggerPayment={triggerPayment}
                  onTrigger={() => setPaymentInProgress(true)}
                  onMoMoDialogOpen={handleMoMoDialogOpen}
                  onProcessingChange={handleProcessingChange}
                />

                <Button
                  onClick={() => { 
                    if (isFormValid && !paymentInProgress) {
                      setPaymentInProgress(true);
                      setShowPaymentOverlay(true);
                      setTriggerPayment(true); 
                    }
                  }}
                  disabled={!isFormValid || paymentInProgress}
                  className="w-full bg-[#052c59] hover:bg-[#052c59]/90 mt-4"
                >
                  {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {paymentInProgress ? 'Processing...' : `Pay ${formatCurrency(pricing.total)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
