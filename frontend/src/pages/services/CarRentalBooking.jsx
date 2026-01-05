import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Car, MapPin, Calendar, Users, Fuel, Settings, CreditCard, Check, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

const EXTRAS = [
  { id: 'driver', name: 'With Driver', price: 25000, description: 'Professional driver included' },
  { id: 'gps', name: 'GPS Navigation', price: 5000, description: 'Never get lost' },
  { id: 'child_seat', name: 'Child Seat', price: 3000, description: 'Safety for little ones' },
  { id: 'insurance', name: 'Full Insurance', price: 15000, description: 'Complete coverage' }
];

export default function CarRentalBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [orderId, setOrderId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    licenseNumber: '',
    address: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState([]);

  useEffect(() => {
    const loadData = () => {
      try {
        // Try both storage keys for backward compatibility
        const stored = JSON.parse(sessionStorage.getItem('carRentalBookingDetails') || sessionStorage.getItem('selectedCar') || 'null');
        if (!stored) {
          navigate('/services/car-rental');
          return;
        }
        // Handle data from CarRentalDetails (carRentalBookingDetails) format
        const carData = stored.vehicle ? {
          ...stored.vehicle,
          pickupDate: stored.pickupDate,
          returnDate: stored.returnDate,
          pricePerDay: stored.vehicle.price_per_day,
          image: stored.vehicle.image || '',
          transmission: stored.vehicle.transmission,
          fuel: stored.vehicle.fuel_type,
          type: stored.vehicle.type,
          pickupLocation: stored.vehicle.pickup_locations?.[0] || 'Selected Location'
        } : stored;
        setCar(carData);
        
        if (user?.email) {
          setFormData(prev => ({ ...prev, email: user.email }));
        }
      } catch (error) {
        navigate('/services/car-rental');
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

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => 
      prev.includes(extraId) 
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const calculatePricing = () => {
    if (!car) return { base: 0, extras: 0, commission: 0, total: 0 };
    
    const days = Math.max(1, differenceInDays(new Date(car.returnDate), new Date(car.pickupDate)));
    const base = car.pricePerDay * days;
    
    const extrasTotal = selectedExtras.reduce((sum, extraId) => {
      const extra = EXTRAS.find(e => e.id === extraId);
      return sum + (extra ? extra.price * days : 0);
    }, 0);
    
    const subtotal = base + extrasTotal;
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    
    return {
      days,
      base,
      extras: extrasTotal,
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
        // Create the booking in the backend
        const bookingPayload = {
          vehicle_id: car.id || car._id || 'temp-id',
          vehicle_name: car.name,
          pickup_date: car.pickupDate,
          return_date: car.returnDate,
          pickup_location: car.pickupLocation,
          driver_name: formData.name,
          driver_email: formData.email,
          driver_phone: formData.phone,
          driver_license: formData.licenseNumber,
          driver_address: formData.address,
          extras: selectedExtras,
          base_price: pricing.base,
          extras_price: pricing.extras,
          commission: pricing.commission,
          total_amount: pricing.total
        };

        const bookingResponse = await api.post('/car-rental/book', bookingPayload);
        
        toast.success(`Booking Confirmed! Booking #${bookingResponse.data.booking_number}`);
        sessionStorage.removeItem('selectedCar');
        sessionStorage.removeItem('carRentalBookingDetails');
        navigate('/orders');
      } catch (error) {
        console.error('Booking creation failed:', error);
        toast.error(error.response?.data?.detail || 'Booking failed. Please try again.');
      }
    } else {
      toast.error(`Booking Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const pricing = calculatePricing();
  const isFormValid = formData.name && formData.email && formData.phone && formData.licenseNumber;
  
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

  if (!car) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md mx-auto text-center p-8">
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/car-rental')} className="bg-[#052c59]">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 p-4 min-h-screen md:p-8">
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Complete Your Rental</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-[#052c59]" />
                  Driver Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 bg-slate-100 p-3 rounded-lg">
                  <Switch checked={isSelf} onCheckedChange={handleSelfChange} />
                  <Label>I am the driver</Label>
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
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Driver&apos;s License Number *</Label>
                    <Input
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                      placeholder="Enter license number"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Extras */}
            <Card>
              <CardHeader>
                <CardTitle>Add-Ons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {EXTRAS.map(extra => (
                  <div
                    key={extra.id}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedExtras.includes(extra.id) ? 'border-[#052c59] bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => toggleExtra(extra.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedExtras.includes(extra.id)} />
                      <div>
                        <h4 className="font-semibold">{extra.name}</h4>
                        <p className="text-sm text-slate-600">{extra.description}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[#052c59]">{formatCurrency(extra.price)}/day</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right - Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Car className="h-6 w-6 text-[#052c59]" />
                  Rental Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-32 rounded-lg overflow-hidden">
                  <img src={car.image} alt={car.name} className="w-full h-full object-cover" />
                </div>
                
                <div>
                  <h3 className="font-bold text-lg">{car.name}</h3>
                  <Badge>{car.type}</Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{car.seats} seats</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Settings className="h-4 w-4" />
                    <span>{car.transmission}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Fuel className="h-4 w-4" />
                    <span>{car.fuel}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{car.pickupLocation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>{format(new Date(car.pickupDate), 'MMM dd')} - {format(new Date(car.returnDate), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{pricing.days} day{pricing.days > 1 ? 's' : ''} × {formatCurrency(car.pricePerDay)}</span>
                    <span>{formatCurrency(pricing.base)}</span>
                  </div>
                  {pricing.extras > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Add-ons</span>
                      <span>{formatCurrency(pricing.extras)}</span>
                    </div>
                  )}
                  
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
                    service_category: 'car_rental',
                    service_title: car.name,
                    booking_details: { ...car, ...formData, selectedExtras }
                  }}
                  onPaymentInitiated={handlePaymentInitiated}
                  disabled={!isFormValid || paymentInProgress}
                  triggerPayment={triggerPayment}
                  onTrigger={() => setPaymentInProgress(true)}
                  orderId={orderId}
                  onMoMoDialogOpen={handleMoMoDialogOpen}
                  onProcessingChange={handleProcessingChange}
                />

                <Button
                  onClick={async () => { 
                    if (isFormValid && !paymentInProgress) {
                      setPaymentInProgress(true);
                      setShowPaymentOverlay(true);
                      try {
                        // Create order first
                        if (!orderId) {
                          const orderPayload = {
                            service_type: 'car_rental',
                            service_id: car.id || car._id,
                            service_name: `${car.make || car.brand} ${car.model}`,
                            total_amount: pricing.total,
                            currency: 'XAF',
                            status: 'pending',
                            payment_status: 'pending',
                            booking_details: {
                              ...formData,
                              car_id: car.id || car._id,
                              car_name: `${car.make || car.brand} ${car.model}`,
                              pickup_date: car.pickupDate,
                              return_date: car.returnDate,
                              extras: selectedExtras
                            }
                          };
                          const response = await api.post('/orders/create', orderPayload);
                          if (response.data?.order_id) {
                            setOrderId(response.data.order_id);
                            setTriggerPayment(true);
                          } else {
                            throw new Error('Failed to create order');
                          }
                        } else {
                          setTriggerPayment(true);
                        }
                      } catch (error) {
                        console.error('Order creation failed:', error);
                        toast.error('Failed to create order. Please try again.');
                        setPaymentInProgress(false);
                        setShowPaymentOverlay(false);
                      }
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
