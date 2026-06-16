import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OperatorBookingBlock from '../../components/shared/OperatorBookingBlock';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { 
  ArrowLeft, Utensils, MapPin, Clock, Users, Star, CreditCard, CheckCircle2, 
  User, Calendar, Phone, Mail, MessageSquare, Loader2, ShoppingBag, DollarSign, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import { rePayExisting } from '../../utils/paymentRetry';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { BookerInfoSection } from '../../components/booking/BookerInfoSection';
import { toast } from 'sonner';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';

// Step indicator for restaurant booking
const RestaurantStepIndicator = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Guest Details', icon: User },
    { number: 2, label: 'Review Order', icon: ShoppingBag },
    { number: 3, label: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.number}>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
            currentStep >= step.number 
              ? 'bg-[#082c59] text-white' 
              : 'bg-slate-100 text-slate-400'
          }`}>
            <step.icon className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            <span className="text-sm font-medium sm:hidden">{step.number}</span>
          </div>
          {idx < steps.length - 1 && (
            <ChevronRight className={`w-5 h-5 ${currentStep > step.number ? 'text-[#082c59]' : 'text-slate-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function RestaurantBooking() {
  const { user, isOperatorUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [restaurant, setRestaurant] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [restaurantCurrentStep, setRestaurantCurrentStep] = useState(1);

  // Abandon any pending unpaid order when the user closes the
  // payment modal, navigates away, or closes the tab.
  const { abandon: abandonOrder } = useOrderAbandonment(orderId, () => {
    setOrderId(null);
    setTriggerPayment(false);
    setPaymentInProgress(false);
    if (typeof setShowPaymentOverlay === 'function') setShowPaymentOverlay(false);
  });
  const handleCheckoutAbandoned = ({ orderId: id } = {}) => abandonOrder(id);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    try {
      // Load order details (items, prices) from restaurant menu page
      const storedOrder = JSON.parse(sessionStorage.getItem('restaurantOrder') || 'null');
      const storedRestaurant = JSON.parse(sessionStorage.getItem('selectedRestaurant') || 'null');
      
      if (!storedOrder && !storedRestaurant) {
        navigate('/services/restaurants');
        return;
      }
      
      setRestaurant(storedOrder?.restaurant || storedRestaurant);
      setOrderData(storedOrder);
      
      if (user?.email) {
        setFormData(prev => ({ ...prev, email: user.email }));
      }
    } catch {
      navigate('/services/restaurants');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, user]);

  const handleSelfChange = async (checked) => {
    setIsSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        setFormData(prev => ({
          ...prev,
          firstName: profile.first_name || nameParts[0] || '',
          lastName: profile.last_name || nameParts.slice(1).join(' ') || '',
          email: profile.email || prev.email,
          phone: profile.phone || prev.phone || ''
        }));
      } catch {
        if (user) {
          const fullName = user.full_name || '';
          const nameParts = fullName.trim().split(/\s+/);
          setFormData(prev => ({
            ...prev,
            firstName: user.first_name || nameParts[0] || '',
            lastName: user.last_name || nameParts.slice(1).join(' ') || '',
            email: user.email || prev.email,
            phone: user.phone || prev.phone || ''
          }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, firstName: '', lastName: '', phone: '' }));
    }
  };

  const calculatePricing = () => {
    if (!restaurant && !orderData) return { subtotal: 0, commission: 0, discount: 0, total: 0 };
    
    // Use order data from menu page (full price, no deposit)
    const itemsTotal = orderData?.subtotal || orderData?.total || 0;
    const commissionRate = 5;
    const commission = itemsTotal * (commissionRate / 100);
    
    let discount = orderData?.discount || 0;
    if (appliedPromo) {
      if (appliedPromo.discount_percent) {
        discount += (itemsTotal + commission) * (appliedPromo.discount_percent / 100);
      } else if (appliedPromo.fixed_discount) {
        discount += appliedPromo.fixed_discount;
      }
    }
    
    return {
      itemsTotal,
      commissionRate,
      commission,
      discount,
      total: Math.max(0, itemsTotal + commission - discount)
    };
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    try {
      const res = await api.post('/promo-codes/validate', {
        code: promoCode.toUpperCase(),
        service_type: 'restaurant',
        order_amount: calculatePricing().itemsTotal,
        operator_id: restaurant?.operator_id || null
      });
      setAppliedPromo({
        ...res.data,
        discount_percent: res.data.discount_type === 'percentage' ? res.data.discount_value : null,
        fixed_discount: res.data.discount_type === 'fixed' ? res.data.discount_value : null,
      });
      setPromoError('');
      toast.success('Promo code applied!');
    } catch (error) {
      setPromoError(error.response?.data?.detail || 'Invalid promo code');
      setAppliedPromo(null);
    }
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

    // Stripe modal opened — not a payment outcome.
    if (response.opening_modal) return;

    if (response.redirectUrl) {
      window.location.href = response.redirectUrl;
      return;
    }

    if (response.success || response.transactionRef) {
      // Record promo usage if applied
      if (appliedPromo?.code) {
        try {
          await api.post(`/promo-codes/use?code=${encodeURIComponent(appliedPromo.code)}&order_id=${orderId}&discount_amount=${pricing.discount}`);
        } catch { /* non-blocking */ }
      }
      toast.success('Reservation confirmed!');
      sessionStorage.removeItem('restaurantOrder');
      sessionStorage.removeItem('selectedRestaurant');
      navigate('/orders');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (orderId) { rePayExisting(setTriggerPayment); return; }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setRestaurantCurrentStep(3);

    try {
      const p = calculatePricing();
      const orderPayload = {
        service_type: 'restaurant',
        service_id: restaurant?.id || restaurant?._id,
        service_name: restaurant?.name,
        total_amount: p.total,
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...formData,
          restaurant_id: restaurant?.id || restaurant?._id,
          restaurant_name: restaurant?.name,
          date: orderData?.reservation_date,
          time: orderData?.reservation_time,
          guests: orderData?.guests,
          order_type: orderData?.order_type || 'dine-in',
          items: orderData?.items?.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
          promo_code: appliedPromo?.code,
          promo_discount: p.discount
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

  const handleMoMoDialogOpen = () => { setShowPaymentOverlay(false); setPaymentInProgress(false); };
  const handleProcessingChange = (isProcessing) => { setShowPaymentOverlay(isProcessing); if (!isProcessing) setPaymentInProgress(false); };

  const pricing = calculatePricing();
  const isFormValid = formData.firstName && formData.email && formData.phone;
  const items = orderData?.items || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md text-center p-8">
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/restaurants')} className="bg-orange-500 hover:bg-orange-600">Back to Restaurants</Button>
        </Card>
      </div>
    );
  }


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <PaymentProcessingOverlay isVisible={showPaymentOverlay} message="Processing reservation..." />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1344px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Complete Your Reservation</h1>
              <p className="text-sm text-slate-500">{restaurant.name}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-[1344px] mx-auto px-4 py-8">
        {/* Step Indicator */}
        <RestaurantStepIndicator currentStep={restaurantCurrentStep} />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Guest Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <BookerInfoSection
              title="Guest Details"
              subtitle="Who is making the reservation?"
              toggleLabel="I'm the Guest"
              firstName={formData.firstName}
              lastName={formData.lastName}
              email={formData.email}
              phone={formData.phone}
              onChange={(field, value) => setFormData(p => ({...p, [field]: value}))}
              user={user}
              isSelf={isSelf}
              onSelfChange={handleSelfChange}
            />
            {/* Special Requests */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><MessageSquare className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Special Requests</h3>
                    <p className="text-sm text-white/70">Let us know your preferences</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <Textarea value={formData.specialRequests} onChange={e => setFormData(p => ({...p, specialRequests: e.target.value}))} placeholder="Dietary requirements, seating preferences..." className="min-h-[80px] rounded-xl border-slate-200" />
              </div>
            </div>
          </div>

          {/* Right Column - Summary & Payment */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Restaurant & Reservation Summary */}
              <div className="rounded-2xl shadow-lg bg-white overflow-hidden border border-slate-100">
                <div className="relative h-36 bg-gradient-to-br from-orange-400 to-orange-600">
                  {restaurant.images?.[0] ? (
                    <img src={restaurant.images[0]} alt={restaurant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Utensils className="w-12 h-12 text-white/50" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold">{restaurant.name}</h3>
                    <p className="text-white/80 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> {restaurant.city || restaurant.address}</p>
                  </div>
                </div>

                <div className="p-5">
                  {/* Reservation Info */}
                  <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <h4 className="font-semibold text-slate-800 text-sm">Reservation</h4>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>{orderData?.reservation_date ? format(new Date(orderData.reservation_date), 'EEE, MMM d, yyyy') : restaurant.date || 'Date TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>{orderData?.reservation_time || restaurant.time || '19:00'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>{orderData?.guests || restaurant.guests || 2} guests</span>
                      </div>
                      {orderData?.order_type && (
                        <Badge variant="outline" className="text-xs capitalize mt-1">{orderData.order_type.replace('-', ' ')}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Selected Items */}
                  {items.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-orange-500" /> Selected Items
                      </h4>
                      <div className="space-y-1.5 text-sm max-h-40 overflow-y-auto">
                        {items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <span className="text-slate-600 truncate mr-2">{item.quantity || 1}x {item.name}</span>
                            <span className="font-medium text-slate-800 shrink-0">{formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Breakdown & Payment */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                <div className="bg-[#082c59] p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Items Total</span>
                      <span className="font-medium text-slate-800">{formatCurrency(pricing.itemsTotal)}</span>
                    </div>
                    
                    <CommissionBreakdown
                      basePrice={pricing.itemsTotal}
                      commissionRate={pricing.commissionRate}
                      commissionAmount={pricing.commission}
                      totalAmount={pricing.itemsTotal + pricing.commission}
                      showDetails={true}
                    />

                    {/* Promo Code */}
                    <div className="pt-2">
                      {!appliedPromo ? (
                        <div className="flex gap-2">
                          <Input placeholder="Promo code" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="flex-1 bg-slate-50 text-sm" />
                          <Button onClick={validatePromoCode} variant="outline" size="sm">Apply</Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm text-emerald-700 font-medium">{appliedPromo.code}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="text-red-500 h-7 px-2">Remove</Button>
                        </div>
                      )}
                      {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                    </div>

                    {pricing.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(pricing.discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-[#082c59]">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-[#082c59] border-t border-slate-200 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </h4>
                </div>
                <div className="bg-slate-50 p-5">
                  {!isFormValid && (
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2" data-testid="restaurant-payment-gated">
                      <CreditCard className="w-3.5 h-3.5" />
                      Add your contact details (name, email and phone) above to choose a payment method.
                    </div>
                  )}
                  <div className={!isFormValid ? 'opacity-50 pointer-events-none' : ''} aria-disabled={!isFormValid}>
                  <PaymentMethodsSelection
                    onCheckoutAbandoned={handleCheckoutAbandoned}
                    amount={pricing.total}
                    customerPhone={formData.phone}
                    customerEmail={formData.email}
                    serviceDetails={{
                      service_category: 'restaurant',
                      service_title: restaurant?.name,
                      operator_id: restaurant?.operator_id,
                      operator_name: restaurant?.operator_name,
                    }}
                    onPaymentInitiated={handlePaymentInitiated}
                    disabled={paymentInProgress}
                    triggerPayment={triggerPayment}
                    onTrigger={() => setPaymentInProgress(true)}
                    orderId={orderId}
                    onMoMoDialogOpen={handleMoMoDialogOpen}
                    onProcessingChange={handleProcessingChange}
                    onMethodSelected={setSelectedPaymentMethod}
                />
                  </div>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={!isFormValid || paymentInProgress || !selectedPaymentMethod}
                    className="w-full h-12 text-base bg-[#082c59] hover:bg-[#0a3a75] text-white mt-4 rounded-xl shadow-lg font-semibold"
                    data-testid="confirm-reservation-btn"
                  >
                    {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Utensils className="mr-2 h-4 w-4" />}
                    {paymentInProgress ? 'Processing...' : `Confirm Reservation · ${formatCurrency(pricing.total)}`}
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
