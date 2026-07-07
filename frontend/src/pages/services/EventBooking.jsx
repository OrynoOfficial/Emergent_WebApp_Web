import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OperatorBookingBlock from '../../components/shared/OperatorBookingBlock';
import { useCommissionRate } from '../../hooks/useCommissionRate';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  ArrowLeft, Ticket, MapPin, Calendar, Clock, CreditCard, Users, Minus, Plus, 
  Loader2, User, Phone, Mail, CheckCircle2, Star, Music, Trophy, Laugh
} from 'lucide-react';
import { format } from 'date-fns';
import CheckoutPaymentPanel from '../../components/common/CheckoutPaymentPanel';
import { useCheckout } from '../../hooks/useCheckout';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { BookerInfoSection } from '../../components/booking/BookerInfoSection';
import { toast } from 'sonner';

const TICKET_TYPES = [
  { id: 'standard', name: 'Standard', multiplier: 1, color: 'bg-slate-500' },
  { id: 'vip', name: 'VIP', multiplier: 2, color: 'bg-purple-500' },
  { id: 'vvip', name: 'VVIP', multiplier: 3, color: 'bg-amber-500' }
];

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Tickets' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Payment' }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num 
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-pink-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-pink-500' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function EventBooking() {
  const { t } = useTranslation();
  const { user, isOperatorUser } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const { rate: effectiveCommissionRate } = useCommissionRate('events', event?.operator_id, { fallback: 5 });
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [ticketType, setTicketType] = useState('standard');
  const [quantity, setQuantity] = useState(1);

  // Centralised checkout flow (state + handlers + abandon-tracking + promo helpers).
  const checkout = useCheckout('event', {
    operatorId: event?.operator_id,
    successMessage: 'Tickets booked successfully!',
    createErrorMessage: 'Failed to create booking',
    validate: () => {
      if (!formData.firstName || !formData.email || !formData.phone) {
        toast.error('Please fill in all required fields');
        return false;
      }
      return true;
    },
    buildPayload: () => {
      const p = calculatePricing();
      setCurrentStep(3);
      return {
        service_id: event.id,
        service_name: event.name,
        total_amount: p.total,
        booking_details: {
          ...formData,
          event_id: event.id,
          event_name: event.name,
          event_date: event.date,
          event_time: event.time,
          ticket_type: ticketType,
          quantity,
        },
      };
    },
  });
  const { paymentInProgress, selectedPaymentMethod, showPaymentOverlay } = checkout.state;

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

  const handleSelfChange = async (checked) => {
    setIsSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        setFormData(prev => ({ ...prev, firstName: profile.first_name || nameParts[0] || '', lastName: profile.last_name || nameParts.slice(1).join(' ') || '', email: profile.email || prev.email, phone: profile.phone || prev.phone || '' }));
      } catch {
        if (user) { const fullName = user.full_name || ''; const nameParts = fullName.trim().split(/\s+/); setFormData(prev => ({ ...prev, firstName: user.first_name || nameParts[0] || '', lastName: user.last_name || nameParts.slice(1).join(' ') || '', email: user.email || prev.email, phone: user.phone || prev.phone || '' })); }
      }
    } else { setFormData(prev => ({ ...prev, firstName: '', lastName: '', phone: '' })); }
  };

  const calculatePricing = () => {
    if (!event) return { base: 0, commission: 0, total: 0 };
    
    const selectedTicket = TICKET_TYPES.find(t => t.id === ticketType);
    const basePrice = (event.priceFrom || event.price || 5000) * (selectedTicket?.multiplier || 1);
    const subtotal = basePrice * quantity;
    const commissionRate = effectiveCommissionRate;
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

  const handleSubmit = checkout.submit;

  const pricing = calculatePricing();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-pink-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-pink-500/20 rounded-full animate-pulse"></div>
            <Ticket className="h-10 w-10 text-pink-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-pink-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-pink-600" />
          </div>
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/events')} className="bg-pink-500 hover:bg-pink-600">
            Back to Events
          </Button>
        </Card>
      </div>
    );
  }


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing your tickets..."
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1344px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Get Your Tickets</h1>
              <p className="text-sm text-slate-500">{event.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1344px] mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Selection */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 to-pink-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Select Your Tickets</h3>
                    <p className="text-sm text-white/70">Choose ticket type and quantity</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* Ticket Type */}
                <div className="mb-6">
                  <Label className="text-slate-700 font-medium mb-3 block">Ticket Type</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {TICKET_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setTicketType(type.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          ticketType === type.id 
                            ? 'border-pink-500 bg-pink-50' 
                            : 'border-slate-200 hover:border-pink-300'
                        }`}
                      >
                        <Badge className={`${type.color} text-white mb-2`}>{type.name}</Badge>
                        <p className="text-lg font-bold text-slate-800">
                          {formatCurrency((event.priceFrom || 5000) * type.multiplier)}
                        </p>
                        <p className="text-xs text-slate-500">per ticket</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-slate-700 font-medium mb-3 block">Number of Tickets</Label>
                  <div className="flex items-center justify-center gap-6 p-4 bg-slate-50 rounded-xl">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="h-12 w-12 rounded-full"
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <span className="text-4xl font-bold text-pink-600 w-16 text-center">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      disabled={quantity >= 10}
                      className="h-12 w-12 rounded-full"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <BookerInfoSection
              title={t('booking.contact_information')}
              subtitle="Where should we send your tickets?"
              toggleLabel="Use my account details"
              firstName={formData.firstName}
              lastName={formData.lastName}
              email={formData.email}
              phone={formData.phone}
              onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
              user={user}
              isSelf={isSelf}
              onSelfChange={handleSelfChange}
            />
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Event Preview */}
                <div className="relative h-48 bg-gradient-to-br from-pink-400 to-pink-600">
                  {event.image ? (
                    <img src={event.image} alt={event.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-16 h-16 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <Badge className="absolute top-4 left-4 bg-pink-500">{event.type || 'Event'}</Badge>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg line-clamp-2">{event.name}</h3>
                  </div>
                </div>

                <div className="p-5">
                  {/* Event Details */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-pink-500" />
                        <span>{event.venue}, {event.city}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-pink-500" />
                        <span>{event.date ? format(new Date(event.date), 'EEE, MMM d, yyyy') : 'Date TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-pink-500" />
                        <span>{event.time || '18:00'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Summary */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Your Tickets</h4>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <Badge className={TICKET_TYPES.find(t => t.id === ticketType)?.color}>
                          {TICKET_TYPES.find(t => t.id === ticketType)?.name}
                        </Badge>
                        <p className="text-sm text-slate-600 mt-1">x {quantity} ticket{quantity > 1 ? 's' : ''}</p>
                      </div>
                      <p className="font-bold text-lg text-pink-600">{formatCurrency(pricing.subtotal)}</p>
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal ({quantity} tickets)</span>
                        <span>{formatCurrency(pricing.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Service Fee</span>
                        <span>+{formatCurrency(pricing.commission)}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">Total</span>
                          <span className="text-2xl font-bold text-pink-600">{formatCurrency(pricing.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method — right under Order Summary */}
                  <div>
                    <div className="bg-[#082c59] -mx-5 px-5 py-3 mb-4">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Select Payment Method
                      </h4>
                    </div>
                    <CheckoutPaymentPanel
                      checkout={checkout}
                      amount={pricing.total}
                      serviceName={event?.name || 'Event'}
                    />
                  </div>

                  <Button 
                    onClick={handleSubmit}
                    disabled={!selectedPaymentMethod || paymentInProgress}
                    className="w-full mt-4 bg-pink-500 hover:bg-pink-600 text-white h-12 font-semibold rounded-xl"
                  >
                    {paymentInProgress ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Ticket className="w-4 h-4 mr-2" />
                        Get Tickets
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
  );
}
