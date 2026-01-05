import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { 
  Package, MapPin, Star, Clock, ArrowLeft, Calendar, 
  Building, Truck, Shield, CheckCircle, AlertTriangle,
  Phone, Mail, User, CreditCard, Loader2
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/api/client';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import CommissionBreakdown from '@/components/common/CommissionBreakdown';

// Package sizes for reference
const PACKAGE_SIZES = {
  S: { dimensions: '30×20×10 cm', maxWeight: '2 kg', description: 'Small packages, documents' },
  M: { dimensions: '40×30×20 cm', maxWeight: '5 kg', description: 'Medium packages, books' },
  L: { dimensions: '60×40×30 cm', maxWeight: '10 kg', description: 'Large packages, electronics' },
  XL: { dimensions: '80×60×40 cm', maxWeight: '20 kg', description: 'Extra large packages, furniture' },
  XXL: { dimensions: '100×80×60 cm', maxWeight: '50 kg', description: 'Oversized packages, appliances' }
};

const SERVICE_TYPE_COLORS = {
  express: 'bg-orange-100 text-orange-700',
  standard: 'bg-blue-100 text-blue-700',
  'same-day': 'bg-red-100 text-red-700',
  overnight: 'bg-purple-100 text-purple-700'
};

const SERVICE_TYPE_LABELS = {
  express: 'Express',
  standard: 'Standard',
  'same-day': 'Same Day',
  overnight: 'Overnight'
};

export default function PackageBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  
  const [booking, setBooking] = useState({
    sender_name: user?.full_name || user?.name || '',
    sender_phone: user?.phone || '',
    sender_email: user?.email || '',
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
    
    setService(JSON.parse(storedService));
    setSearchParams(JSON.parse(storedParams));
    setLoading(false);
  }, [navigate]);

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
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      toast.success('Booking confirmed! Check your email for tracking details.');
      sessionStorage.removeItem('selectedPackageService');
      sessionStorage.removeItem('packageBookingParams');
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handlePayButtonClick = () => {
    if (!isFormValid()) return;
    setTriggerPayment(true);
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

    setSubmitting(true);
    try {
      // Build traveler details for the API
      const travelerDetails = [{
        name: booking.sender_name,
        phone: booking.sender_phone,
        email: user?.email || '',
        notes: booking.package_description
      }];
      
      // Call the packages booking API with query params and body
      const response = await api.post(
        `/packages/${service?.id}/book`,
        travelerDetails,
        {
          params: {
            departure_date: searchParams?.pickup_date || format(new Date(), 'yyyy-MM-dd'),
            travelers: 1,
            special_requests: `Sender: ${booking.sender_name}, ${booking.sender_phone}, ${booking.sender_address}. Receiver: ${booking.receiver_name}, ${booking.receiver_phone}, ${booking.receiver_address}. Package: ${booking.package_description}. ${booking.fragile ? 'FRAGILE. ' : ''}${booking.insurance ? 'Insured.' : ''}`
          }
        }
      );
      
      toast.success(`Booking confirmed! Tracking ID: ${response.data.booking_id}`);
      sessionStorage.removeItem('selectedPackageService');
      sessionStorage.removeItem('packageBookingParams');
      navigate('/orders', {
        state: {
          bookingId: response.data.booking_id,
          service: 'package',
          message: 'Package booking confirmed!'
        }
      });
    } catch (error) {
      toast.error('Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59]"></div>
      </div>
    );
  }

  if (!service || !searchParams) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Service not found</h2>
          <Button onClick={() => navigate('/services/packages')}>Back to Search</Button>
        </div>
      </div>
    );
  }

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
          {/* Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-[#082c59] rounded-lg">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  {service.service_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>{service.operator_name}</span>
                  </div>
                  <Badge className={SERVICE_TYPE_COLORS[service.service_type]}>
                    {SERVICE_TYPE_LABELS[service.service_type]}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{service.rating}</span>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
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
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(searchParams.shipping_date), 'PPP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Est. {service.delivery_time}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sender Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  Sender Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input 
                    value={booking.sender_name} 
                    onChange={e => setBooking(p => ({ ...p, sender_name: e.target.value }))} 
                    placeholder="John Doe"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input 
                    value={booking.sender_phone} 
                    onChange={e => setBooking(p => ({ ...p, sender_phone: e.target.value }))} 
                    placeholder="+237 6XX XXX XXX"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={booking.sender_email} 
                    onChange={e => setBooking(p => ({ ...p, sender_email: e.target.value }))} 
                    placeholder="john@example.com"
                    className="mt-1 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Pickup Address *</Label>
                  <Input 
                    value={booking.sender_address} 
                    onChange={e => setBooking(p => ({ ...p, sender_address: e.target.value }))} 
                    placeholder="Full address for pickup"
                    className="mt-1 bg-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Receiver Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-red-600" />
                  Receiver Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input 
                    value={booking.receiver_name} 
                    onChange={e => setBooking(p => ({ ...p, receiver_name: e.target.value }))} 
                    placeholder="Jane Smith"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input 
                    value={booking.receiver_phone} 
                    onChange={e => setBooking(p => ({ ...p, receiver_phone: e.target.value }))} 
                    placeholder="+237 6XX XXX XXX"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={booking.receiver_email} 
                    onChange={e => setBooking(p => ({ ...p, receiver_email: e.target.value }))} 
                    placeholder="jane@example.com"
                    className="mt-1 bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Delivery Address *</Label>
                  <Input 
                    value={booking.receiver_address} 
                    onChange={e => setBooking(p => ({ ...p, receiver_address: e.target.value }))} 
                    placeholder="Full address for delivery"
                    className="mt-1 bg-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Package Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Package Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
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

                <div>
                  <Label>Package Description *</Label>
                  <Textarea 
                    value={booking.package_description} 
                    onChange={e => setBooking(p => ({ ...p, package_description: e.target.value }))} 
                    placeholder="Describe the contents of your package (e.g., electronics, documents, clothing)"
                    className="mt-1 bg-white"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Declared Value (FCFA)</Label>
                    <Input 
                      type="number"
                      value={booking.declared_value} 
                      onChange={e => setBooking(p => ({ ...p, declared_value: e.target.value }))} 
                      placeholder="0"
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="fragile" 
                      checked={booking.fragile}
                      onCheckedChange={(checked) => setBooking(p => ({ ...p, fragile: checked }))}
                    />
                    <label htmlFor="fragile" className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      This package contains fragile items
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="insurance" 
                      checked={booking.insurance}
                      onCheckedChange={(checked) => setBooking(p => ({ ...p, insurance: checked }))}
                    />
                    <label htmlFor="insurance" className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      Add insurance coverage (+5% of shipping cost)
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Special Instructions</Label>
                  <Textarea 
                    value={booking.special_instructions} 
                    onChange={e => setBooking(p => ({ ...p, special_instructions: e.target.value }))} 
                    placeholder="Any special handling instructions..."
                    className="mt-1 bg-white"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Price Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Shipping (Size {searchParams.package_size})</span>
                    <span>{formatFCFA(getPrice())}</span>
                  </div>
                  {booking.insurance && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Insurance (5%)</span>
                      <span>{formatFCFA(getInsuranceFee())}</span>
                    </div>
                  )}
                </div>

                <CommissionBreakdown
                  basePrice={getPrice() + getInsuranceFee()}
                  commissionRate={5}
                  commissionAmount={getCommission()}
                  totalAmount={getTotalPrice()}
                  showDetails={true}
                />

                {/* Payment Methods */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-[#082c59]" />
                    <h3 className="font-semibold text-slate-800">Payment Method</h3>
                  </div>
                  
                  <PaymentMethodsSelection
                    amount={getTotalPrice()}
                    customerPhone={booking.sender_phone}
                    customerEmail={booking.sender_email || user?.email}
                    serviceDetails={{
                      service_category: 'package',
                      service_title: `${searchParams.pickup_location} to ${searchParams.delivery_location} Delivery`,
                      operator_id: service.operator_id,
                      operator_name: service.operator_name,
                      booking_details: {
                        service,
                        searchParams,
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
                    disabled={!isFormValid() || paymentInProgress}
                    className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 mt-4"
                  >
                    {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {paymentInProgress ? 'Processing...' : `Pay ${formatFCFA(getTotalPrice())}`}
                  </Button>
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Shield className="w-4 h-4" />
                    <span>Secure payment</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <CheckCircle className="w-4 h-4" />
                    <span>Free tracking included</span>
                  </div>
                </div>

                {/* Service Info */}
                <div className="pt-4 border-t text-sm text-slate-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Dispatch: {service.dispatch_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span>Est. delivery: {service.delivery_time}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
