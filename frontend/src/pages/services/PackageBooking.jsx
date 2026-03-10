import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { 
  Package, MapPin, Star, Clock, ArrowLeft, Calendar, 
  Building, Truck, Shield, CheckCircle2, AlertTriangle,
  Phone, Mail, User, CreditCard, Loader2
} from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/api/client';
import SubscribeButton from '@/components/shared/SubscribeButton';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '@/components/common/PaymentProcessingOverlay';

// Package sizes for reference
const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg', description: 'Small packages, documents' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg', description: 'Medium packages, books' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg', description: 'Large packages, electronics' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg', description: 'Extra large packages, furniture' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg', description: 'Oversized packages, appliances' }
};

const SERVICE_TYPE_COLORS = {
  express: 'bg-orange-500',
  standard: 'bg-blue-500',
  'same-day': 'bg-red-500',
  overnight: 'bg-purple-500'
};

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Sender' },
    { num: 2, label: 'Receiver' },
    { num: 3, label: 'Payment' }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num 
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-teal-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-teal-500' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function PackageBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [orderId, setOrderId] = useState(null);
  
  const [isSenderSelf, setIsSenderSelf] = useState(false);
  
  const [booking, setBooking] = useState({
    sender_name: '',
    sender_phone: '',
    sender_email: '',
    sender_address: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_email: '',
    receiver_address: '',
    package_description: '',
    declared_value: '',
    fragile: false,
    insurance: true,
    special_instructions: ''
  });

  useEffect(() => {
    const storedService = sessionStorage.getItem('selectedPackageService');
    const storedParams = sessionStorage.getItem('packageBookingParams');
    
    if (!storedService || !storedParams) {
      navigate('/services/packages');
      return;
    }
    
    const parsedService = JSON.parse(storedService);
    const parsedParams = JSON.parse(storedParams);
    setService(parsedService);
    setSearchParams(parsedParams);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.email && booking.sender_email !== user.email) {
      setBooking(prev => ({ ...prev, sender_email: user.email }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleSenderSelfChange = (checked) => {
    setIsSenderSelf(checked);
    if (checked && user) {
      setBooking(prev => ({
        ...prev,
        sender_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        sender_phone: user.phone || '',
        sender_email: user.email || ''
      }));
    } else {
      setBooking(prev => ({ ...prev, sender_name: '', sender_phone: '' }));
    }
  };

  const getPrice = () => {
    if (!service || !searchParams?.package_size) return 0;
    return service.prices_by_size?.[searchParams.package_size] || 0;
  };

  const getInsuranceFee = () => {
    return booking.insurance ? Math.round(getPrice() * 0.05) : 0;
  };

  const getCommission = () => {
    const subtotal = getPrice() + getInsuranceFee();
    return Math.round(subtotal * 0.05);
  };

  const getTotalPrice = () => {
    return getPrice() + getInsuranceFee() + getCommission();
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
      toast.success('Booking confirmed! Check your email for tracking details.');
      sessionStorage.removeItem('selectedPackageService');
      sessionStorage.removeItem('packageBookingParams');
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handlePaymentError = (error) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    toast.error(error.message || 'Payment failed');
  };

  const isFormValid = () => {
    return booking.sender_name && booking.sender_phone && booking.sender_address &&
           booking.receiver_name && booking.receiver_phone && booking.receiver_address &&
           booking.package_description;
  };

  const handleSubmit = async () => {
    // Validation
    if (!booking.sender_name || !booking.sender_phone || !booking.sender_address) {
      toast.error('Please fill in all sender details');
      return;
    }
    if (!booking.receiver_name || !booking.receiver_phone || !booking.receiver_address) {
      toast.error('Please fill in all receiver details');
      return;
    }
    if (!booking.package_description) {
      toast.error('Please describe the package contents');
      return;
    }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);

    try {
      const orderPayload = {
        service_type: 'package',
        service_id: service?.id,
        service_name: `${searchParams?.pickup_location} → ${searchParams?.delivery_location}`,
        total_amount: getTotalPrice(),
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...booking,
          service,
          searchParams,
          pickup_location: searchParams?.pickup_location,
          delivery_location: searchParams?.delivery_location,
          package_size: searchParams?.package_size,
          shipping_date: searchParams?.shipping_date
        }
      };

      const response = await api.post('/orders/create', orderPayload);
      
      if (response.data?.order_id || response.data?.id) {
        setOrderId(response.data.order_id || response.data.id);
        setTriggerPayment(true);
      }
    } catch (error) {
      toast.error('Failed to create booking');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-teal-500/20 rounded-full animate-pulse"></div>
            <Truck className="h-10 w-10 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  if (!service || !searchParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-teal-600" />
          </div>
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/packages')} className="bg-teal-500 hover:bg-teal-600">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing your delivery booking..."
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">Complete Your Delivery</h1>
              <p className="text-sm text-slate-500">{service.service_name}</p>
            </div>
            <SubscribeButton operatorId={service.operator_id} operatorName={service.operator_name} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Service Summary Card */}
        <Card className="shadow-lg mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-5">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-xl">
                <Truck className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{service.service_name}</h3>
                  <Badge className={SERVICE_TYPE_COLORS[service.service_type]}>{service.service_type}</Badge>
                </div>
                <p className="text-sm text-white/70">{service.operator_name}</p>
              </div>
              <div className="flex items-center gap-1 text-white">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{service.rating}</span>
              </div>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="font-medium">{searchParams.pickup_location}</span>
              </div>
              <div className="flex-1 mx-4 border-t-2 border-dashed border-slate-300"></div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{searchParams.delivery_location}</span>
                <MapPin className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <div className="flex justify-between mt-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-500" />
                <span>{format(new Date(searchParams.shipping_date), 'PPP')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-500" />
                <span>Est. {service.delivery_time}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sender Details */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Sender Details</h3>
                    <p className="text-sm text-white/70">Who is sending this package?</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-slate-700">I&apos;m the sender</span>
                    </div>
                    <Switch checked={isSenderSelf} onCheckedChange={handleSenderSelfChange} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.sender_name}
                        onChange={(e) => setBooking(p => ({ ...p, sender_name: e.target.value }))}
                        placeholder="John Doe"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={isSenderSelf}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.sender_phone}
                        onChange={(e) => setBooking(p => ({ ...p, sender_phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={isSenderSelf}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={booking.sender_email}
                        onChange={(e) => setBooking(p => ({ ...p, sender_email: e.target.value }))}
                        placeholder="john@example.com"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Pickup Address *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.sender_address}
                        onChange={(e) => setBooking(p => ({ ...p, sender_address: e.target.value }))}
                        placeholder="Full address for pickup"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receiver Details */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-rose-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Receiver Details</h3>
                    <p className="text-sm text-white/70">Who should receive this package?</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.receiver_name}
                        onChange={(e) => setBooking(p => ({ ...p, receiver_name: e.target.value }))}
                        placeholder="Jane Smith"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.receiver_phone}
                        onChange={(e) => setBooking(p => ({ ...p, receiver_phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={booking.receiver_email}
                        onChange={(e) => setBooking(p => ({ ...p, receiver_email: e.target.value }))}
                        placeholder="jane@example.com"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Delivery Address *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.receiver_address}
                        onChange={(e) => setBooking(p => ({ ...p, receiver_address: e.target.value }))}
                        placeholder="Full address for delivery"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Package Details */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Package Details</h3>
                    <p className="text-sm text-white/70">Tell us about your package</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Size {searchParams.package_size}</p>
                      <p className="text-sm text-blue-700">
                        {PACKAGE_SIZES[searchParams.package_size]?.dimensions} • Max weight: {PACKAGE_SIZES[searchParams.package_size]?.maxWeight}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Package Description *</Label>
                  <Textarea 
                    value={booking.package_description} 
                    onChange={(e) => setBooking(p => ({ ...p, package_description: e.target.value }))} 
                    placeholder="Describe the contents of your package (e.g., electronics, documents, clothing)"
                    className="bg-slate-50 border-slate-200"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Declared Value (FCFA)</Label>
                  <Input 
                    type="number"
                    value={booking.declared_value} 
                    onChange={(e) => setBooking(p => ({ ...p, declared_value: e.target.value }))} 
                    placeholder="0"
                    className="h-12 bg-slate-50 border-slate-200"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <Checkbox 
                      id="fragile" 
                      checked={booking.fragile}
                      onCheckedChange={(checked) => setBooking(p => ({ ...p, fragile: checked }))}
                    />
                    <label htmlFor="fragile" className="text-sm flex items-center gap-2 cursor-pointer">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      This package contains fragile items
                    </label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <Checkbox 
                      id="insurance" 
                      checked={booking.insurance}
                      onCheckedChange={(checked) => setBooking(p => ({ ...p, insurance: checked }))}
                    />
                    <label htmlFor="insurance" className="text-sm flex items-center gap-2 cursor-pointer">
                      <Shield className="w-4 h-4 text-green-600" />
                      Add insurance coverage (+5% of shipping cost)
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Special Instructions</Label>
                  <Textarea 
                    value={booking.special_instructions} 
                    onChange={(e) => setBooking(p => ({ ...p, special_instructions: e.target.value }))} 
                    placeholder="Any special handling instructions..."
                    className="bg-slate-50 border-slate-200"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Section */}
            <Card className="shadow-lg overflow-hidden">
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
              
              <CardContent className="p-6">
                <PaymentMethodsSelection
                  amount={getTotalPrice()}
                  orderId={orderId}
                  serviceName={service?.service_name || 'Package Delivery'}
                  onPaymentInitiated={handlePaymentInitiated}
                  onPaymentError={handlePaymentError}
                  triggerPayment={triggerPayment}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="shadow-lg overflow-hidden">
                {/* Service Preview */}
                <div className="relative h-40 bg-gradient-to-br from-teal-500 to-teal-600">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Truck className="w-20 h-20 text-white/20" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <Badge className={`absolute top-4 left-4 ${SERVICE_TYPE_COLORS[service.service_type]}`}>
                    {service.service_type}
                  </Badge>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg">{service.service_name}</h3>
                    <p className="text-white/80 text-sm">{service.operator_name}</p>
                  </div>
                </div>

                <CardContent className="p-5">
                  {/* Route Details */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Delivery Route</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span>From: {searchParams.pickup_location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span>To: {searchParams.delivery_location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-teal-500" />
                        <span>{format(new Date(searchParams.shipping_date), 'PPP')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-teal-500" />
                        <span>Est. {service.delivery_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Package Info */}
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 mb-3">Package Info</h4>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-teal-600" />
                        <span className="font-medium">Size {searchParams.package_size}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {PACKAGE_SIZES[searchParams.package_size]?.dimensions}
                      </p>
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-5 -mb-5 p-5 rounded-b-xl">
                    <h4 className="font-semibold text-white mb-3">Price Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Shipping (Size {searchParams.package_size})</span>
                        <span>{formatCurrency(getPrice())}</span>
                      </div>
                      {booking.insurance && (
                        <div className="flex justify-between text-slate-300">
                          <span>Insurance (5%)</span>
                          <span>+{formatCurrency(getInsuranceFee())}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>Service Fee</span>
                        <span>+{formatCurrency(getCommission())}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">Total</span>
                          <span className="text-2xl font-bold text-emerald-400">{formatCurrency(getTotalPrice())}</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSubmit}
                      disabled={!isFormValid() || paymentInProgress}
                      className="w-full mt-4 bg-teal-500 hover:bg-teal-600 text-white h-12 font-semibold rounded-xl"
                    >
                      {paymentInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4 mr-2" />
                          Confirm Booking
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
                      <Shield className="w-3 h-3" />
                      <span>Free tracking included</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
