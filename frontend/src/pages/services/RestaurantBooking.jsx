import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { 
  ArrowLeft, Utensils, MapPin, Clock, Users, Star, CreditCard, CheckCircle2, 
  User, Calendar, Phone, Mail, MessageSquare, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

const DEPOSIT_PERCENTAGE = 30;

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Guest Details' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Payment' }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-orange-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-orange-500' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function RestaurantBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [orderId, setOrderId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialRequests: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('selectedRestaurant') || 'null');
        if (!stored) {
          navigate('/services/restaurants');
          return;
        }
        setRestaurant(stored);
        
        if (user?.email) {
          setFormData(prev => ({ ...prev, email: user.email }));
        }
      } catch (error) {
        navigate('/services/restaurants');
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
    if (!restaurant) return { deposit: 0, commission: 0, total: 0 };
    
    const estimatedBill = (restaurant.avgPrice || restaurant.average_price || 15000) * (restaurant.guests || 2);
    const deposit = estimatedBill * (DEPOSIT_PERCENTAGE / 100);
    const commissionRate = 5;
    const commission = deposit * (commissionRate / 100);
    
    let discount = 0;
    if (appliedPromo?.discount_percent) {
      discount = (deposit + commission) * (appliedPromo.discount_percent / 100);
    }
    
    return {
      estimatedBill,
      deposit,
      commissionRate,
      commission,
      discount,
      total: deposit + commission - discount
    };
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

    if (response.redirectUrl) {
      toast.info('Redirecting to payment...');
      window.location.href = response.redirectUrl;
      return;
    }

    if (response.success || response.transactionRef) {
      toast.success('Reservation confirmed!');
      navigate('/orders');
    }
  };

  const handlePaymentError = (error) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    toast.error(error.message || 'Payment failed');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);

    try {
      const pricing = calculatePricing();
      const orderPayload = {
        service_type: 'restaurant',
        service_id: restaurant.id,
        service_name: restaurant.name,
        total_amount: pricing.total,
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...formData,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          date: restaurant.date,
          time: restaurant.time,
          guests: restaurant.guests
        }
      };

      const response = await api.post('/orders/create', orderPayload);
      
      if (response.data?.order_id || response.data?.id) {
        setOrderId(response.data.order_id || response.data.id);
        setTriggerPayment(true);
      }
    } catch (error) {
      toast.error('Failed to create reservation');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  };

  const pricing = calculatePricing();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-orange-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-orange-500/20 rounded-full animate-pulse"></div>
            <Utensils className="h-10 w-10 text-orange-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading reservation details...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-orange-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/restaurants')} className="bg-orange-500 hover:bg-orange-600">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing reservation..."
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Complete Your Reservation</h1>
              <p className="text-sm text-slate-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Guest Information</h3>
                    <p className="text-sm text-white/70">Who is making this reservation?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-slate-700">I'm the guest</span>
                    </div>
                    <Switch checked={isSelf} onCheckedChange={handleSelfChange} />
                  </div>
                  <p className="text-sm text-slate-500 mt-2 ml-8">Fill form with your account details</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white"
                        disabled={isSelf}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white"
                        disabled={isSelf}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Special Requests</h3>
                    <p className="text-sm text-white/70">Any preferences or dietary requirements?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <Textarea
                  value={formData.specialRequests}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
                  placeholder="E.g., Window seat, birthday celebration, vegetarian options..."
                  className="min-h-[120px] bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Payment Method</h3>
                    <p className="text-sm text-white/70">Secure payment options</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <PaymentMethodsSelection
                  amount={pricing.total}
                  orderId={orderId}
                  serviceName={restaurant?.name || 'Restaurant'}
                  onPaymentInitiated={handlePaymentInitiated}
                  onPaymentError={handlePaymentError}
                  triggerPayment={triggerPayment}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Restaurant Preview */}
                <div className="relative h-40 bg-gradient-to-br from-orange-400 to-orange-600">
                  {restaurant.images?.[0] ? (
                    <img src={restaurant.images[0]} alt={restaurant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Utensils className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-1 text-amber-400 mb-1">
                      {[...Array(Math.floor(restaurant.rating || 4))].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <h3 className="text-white font-bold text-lg">{restaurant.name}</h3>
                    <p className="text-white/80 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {restaurant.city || restaurant.address}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  {/* Reservation Details */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Reservation Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span>{restaurant.date ? format(new Date(restaurant.date), 'EEE, MMM d, yyyy') : 'Date TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span>{restaurant.time || '19:00'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4 text-orange-500" />
                        <span>{restaurant.guests || 2} guests</span>
                      </div>
                    </div>
                  </div>

                  {/* Booking Summary */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-5 -mb-5 p-5 rounded-b-2xl">
                    <h4 className="font-semibold text-white mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Estimated Bill</span>
                        <span>{formatCurrency(pricing.estimatedBill)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Deposit ({DEPOSIT_PERCENTAGE}%)</span>
                        <span>{formatCurrency(pricing.deposit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Service Fee</span>
                        <span>+{formatCurrency(pricing.commission)}</span>
                      </div>
                      {pricing.discount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Discount</span>
                          <span>-{formatCurrency(pricing.discount)}</span>
                        </div>
                      )}
                      <div className="pt-3 mt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">Total Deposit</span>
                          <span className="text-2xl font-bold text-emerald-400">{formatCurrency(pricing.total)}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Remaining balance paid at restaurant</p>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSubmit}
                      disabled={paymentInProgress}
                      className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white h-12 font-semibold rounded-xl"
                    >
                      {paymentInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Confirm Reservation'
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
