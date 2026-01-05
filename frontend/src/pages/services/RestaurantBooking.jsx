import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { ArrowLeft, Utensils, MapPin, Clock, Users, Star, CreditCard, CheckCircle2, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

const DEPOSIT_PERCENTAGE = 30;

export default function RestaurantBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  
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
    
    const estimatedBill = restaurant.avgPrice * restaurant.guests;
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
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      try {
        // Create the restaurant reservation in the backend
        const orderPayload = {
          items: restaurant.orderItems || [],
          order_type: 'reservation',
          subtotal: pricing.deposit,
          discount: pricing.discount,
          total: pricing.total,
          promo_code: appliedPromo?.code || null,
          reservation_date: restaurant.date,
          reservation_time: restaurant.time,
          guests: restaurant.guests,
          special_requests: formData.specialRequests
        };

        const restaurantId = restaurant.id || restaurant._id;
        const orderResponse = await api.post(`/restaurants/${restaurantId}/orders`, orderPayload);
        
        toast.success(`Reservation Confirmed! Order #${orderResponse.data.order_number}`);
        sessionStorage.removeItem('selectedRestaurant');
        navigate('/orders');
      } catch (error) {
        console.error('Reservation creation failed:', error);
        toast.error(error.response?.data?.detail || 'Reservation failed. Please try again.');
      }
    } else {
      toast.error(`Reservation Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const pricing = calculatePricing();
  const isFormValid = formData.name && formData.email && formData.phone;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#052c59]" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md mx-auto text-center p-8">
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/restaurants')} className="bg-[#052c59]">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 p-4 min-h-screen md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-4" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Complete Your Reservation</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Form */}
          <div className="lg:col-span-2 space-y-6">
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
                  <Label>This reservation is for me</Label>
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
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Special Requests</Label>
                  <Textarea
                    placeholder="Dietary requirements, seating preferences, celebrations..."
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right - Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Utensils className="h-6 w-6 text-[#052c59]" />
                  Reservation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-32 rounded-lg overflow-hidden">
                  <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{restaurant.name}</h3>
                    <Badge>{restaurant.cuisine}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span>{restaurant.rating}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{restaurant.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>{format(new Date(restaurant.reservationDate), 'MMM dd, yyyy')} at {restaurant.reservationTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{restaurant.guests} Guest{restaurant.guests > 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Estimated bill</span>
                    <span>{formatCurrency(pricing.estimatedBill)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Deposit ({DEPOSIT_PERCENTAGE}%)</span>
                    <span>{formatCurrency(pricing.deposit)}</span>
                  </div>
                  
                  <CommissionBreakdown
                    basePrice={pricing.deposit}
                    commissionRate={pricing.commissionRate}
                    commissionAmount={pricing.commission}
                    totalAmount={pricing.total + pricing.discount}
                    showDetails={true}
                  />
                  
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Deposit to Pay</span>
                      <span className="text-emerald-600">{formatCurrency(pricing.total)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pay the remaining {formatCurrency(pricing.estimatedBill - pricing.deposit)} at the restaurant
                    </p>
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
                    service_category: 'restaurant',
                    service_title: restaurant.name,
                    booking_details: { ...restaurant, ...formData }
                  }}
                  onPaymentInitiated={handlePaymentInitiated}
                  disabled={!isFormValid || paymentInProgress}
                  triggerPayment={triggerPayment}
                  onTrigger={() => setPaymentInProgress(true)}
                />

                <Button
                  onClick={() => { if (isFormValid && !paymentInProgress) setTriggerPayment(true); }}
                  disabled={!isFormValid || paymentInProgress}
                  className="w-full bg-[#052c59] hover:bg-[#052c59]/90 mt-4"
                >
                  {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {paymentInProgress ? 'Processing...' : `Pay Deposit ${formatCurrency(pricing.total)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
