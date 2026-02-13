import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { 
  ArrowLeft, Car, MapPin, Calendar, Users, Fuel, Settings, CreditCard, Check, 
  Loader2, User, Phone, Mail, CheckCircle2, Clock, Star, Shield, Edit2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

const EXTRAS = [
  { id: 'none', name: 'No Extras', price: 0, icon: Check, description: 'Continue without extras' },
  { id: 'driver', name: 'Professional Driver', price: 25000, icon: User, description: 'Experienced driver included' },
  { id: 'gps', name: 'GPS Navigation', price: 5000, icon: MapPin, description: 'Never get lost' },
  { id: 'child_seat', name: 'Child Seat', price: 3000, icon: Users, description: 'Safety for little ones' },
  { id: 'insurance', name: 'Full Insurance', price: 15000, icon: Shield, description: 'Complete coverage' }
];

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Extras' },
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
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-emerald-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-emerald-500' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function CarRentalBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [car, setCar] = useState(null);
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
    licenseNumber: '',
    address: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [extrasConfirmed, setExtrasConfirmed] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Check if driver info is complete
  const isDriverInfoComplete = formData.name && formData.email && formData.phone && formData.licenseNumber;
  
  // Check if all mandatory sections are complete
  const canSelectPayment = extrasConfirmed && isDriverInfoComplete;
  const canConfirmBooking = canSelectPayment && selectedPaymentMethod;

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('carRentalBookingDetails') || sessionStorage.getItem('selectedVehicle') || 'null');
        if (!stored) {
          navigate('/services/car-rental');
          return;
        }
        // Handle both formats: {vehicle: {...}} or direct vehicle object
        const vehicleData = stored.vehicle || stored;
        const carData = {
          ...vehicleData,
          pickupDate: stored.pickupDate || vehicleData.pickupDate,
          returnDate: stored.returnDate || vehicleData.returnDate,
          pricePerDay: vehicleData.price_per_day || vehicleData.pricePerDay,
          image: vehicleData.image || vehicleData.images?.[0] || '',
          transmission: vehicleData.transmission,
          fuel: vehicleData.fuel_type || vehicleData.fuel,
          type: vehicleData.type,
          pickupLocation: vehicleData.pickup_locations?.[0] || stored.pickupLocation || vehicleData.pickupLocation || 'Selected Location'
        };
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
    if (extraId === 'none') {
      // If selecting "No Extras", clear all other selections and confirm
      setSelectedExtras(['none']);
      setExtrasConfirmed(true);
    } else {
      // If selecting any other extra, remove 'none' if it was selected
      setSelectedExtras(prev => {
        const withoutNone = prev.filter(id => id !== 'none');
        if (withoutNone.includes(extraId)) {
          const newExtras = withoutNone.filter(id => id !== extraId);
          // If no extras selected after removal, don't auto-confirm
          if (newExtras.length === 0) {
            setExtrasConfirmed(false);
          }
          return newExtras;
        }
        return [...withoutNone, extraId];
      });
    }
  };

  const confirmExtras = () => {
    if (selectedExtras.length > 0 || selectedExtras.includes('none')) {
      setExtrasConfirmed(true);
    }
  };

  const getDays = () => {
    if (!car?.pickupDate || !car?.returnDate) return car?.days || 1;
    return Math.max(1, differenceInDays(new Date(car.returnDate), new Date(car.pickupDate)));
  };

  const calculatePricing = () => {
    if (!car) return { base: 0, extras: 0, commission: 0, total: 0 };
    
    const days = getDays();
    const dailyRate = car.pricePerDay || car.price_per_day || 35000;
    const base = dailyRate * days;
    
    const extrasTotal = selectedExtras.reduce((sum, extraId) => {
      const extra = EXTRAS.find(e => e.id === extraId);
      return sum + (extra ? extra.price * days : 0);
    }, 0);
    
    const subtotal = base + extrasTotal;
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    
    return {
      dailyRate,
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

    if (response.redirectUrl) {
      toast.info('Redirecting to payment...');
      window.location.href = response.redirectUrl;
      return;
    }

    if (response.success || response.transactionRef) {
      toast.success('Booking confirmed!');
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
    
    if (!formData.name || !formData.email || !formData.phone || !formData.licenseNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);

    try {
      const pricing = calculatePricing();
      const orderPayload = {
        service_type: 'car_rental',
        service_id: car.id,
        service_name: car.name,
        total_amount: pricing.total,
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...formData,
          car_id: car.id,
          car_name: car.name,
          pickup_date: car.pickupDate,
          return_date: car.returnDate,
          pickup_location: car.pickupLocation,
          extras: selectedExtras,
          days: pricing.days
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

  const pricing = calculatePricing();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-emerald-500/20 rounded-full animate-pulse"></div>
            <Car className="h-10 w-10 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading vehicle details...</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/car-rental')} className="bg-emerald-500 hover:bg-emerald-600">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing your booking..."
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Complete Your Booking</h1>
              <p className="text-sm text-slate-500">{car.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Extras Selection */}
            <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${extrasConfirmed ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Star className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Add Extras <span className="text-white/80 text-sm font-normal">(Required)</span></h3>
                      <p className="text-sm text-white/70">Select extras or choose &quot;No Extras&quot;</p>
                    </div>
                  </div>
                  {extrasConfirmed && (
                    <Badge className="bg-white/20 text-white border-0">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmed
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {!extrasConfirmed && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    Please select at least one option or &quot;No Extras&quot; to continue
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {EXTRAS.map((extra) => {
                    const isSelected = selectedExtras.includes(extra.id);
                    const ExtraIcon = extra.icon;
                    const isNoExtras = extra.id === 'none';
                    return (
                      <div
                        key={extra.id}
                        data-testid={`extra-${extra.id}`}
                        onClick={() => !extrasConfirmed && toggleExtra(extra.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${extrasConfirmed ? 'cursor-default opacity-80' : 'cursor-pointer'} ${
                          isSelected 
                            ? isNoExtras ? 'border-slate-500 bg-slate-50' : 'border-emerald-500 bg-emerald-50' 
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isSelected ? (isNoExtras ? 'bg-slate-500 text-white' : 'bg-emerald-500 text-white') : 'bg-slate-100 text-slate-600'}`}>
                            <ExtraIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-800">{extra.name}</h4>
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                            </div>
                            <p className="text-sm text-slate-500 mt-1">{extra.description}</p>
                            {extra.price > 0 ? (
                              <p className="text-emerald-600 font-semibold mt-2">
                                +{formatCurrency(extra.price)}/day
                              </p>
                            ) : (
                              <p className="text-slate-500 font-medium mt-2">Free</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!extrasConfirmed && selectedExtras.length > 0 && (
                  <Button 
                    onClick={confirmExtras}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Check className="w-4 h-4 mr-2" /> Confirm Extras Selection
                  </Button>
                )}
                {extrasConfirmed && (
                  <Button 
                    variant="outline"
                    onClick={() => setExtrasConfirmed(false)}
                    className="w-full mt-4"
                  >
                    <Edit2 className="w-4 h-4 mr-2" /> Edit Extras
                  </Button>
                )}
              </div>
            </div>

            {/* Driver Information */}
            <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${!extrasConfirmed ? 'opacity-60' : isDriverInfoComplete ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Driver Information <span className="text-white/80 text-sm font-normal">(Required)</span></h3>
                      <p className="text-sm text-white/70">Who will be driving?</p>
                    </div>
                  </div>
                  {isDriverInfoComplete && extrasConfirmed && (
                    <Badge className="bg-white/20 text-white border-0">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {!extrasConfirmed && (
                  <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600">
                    Please confirm your extras selection first
                  </div>
                )}
                <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="font-medium text-slate-700">I&apos;m the driver</span>
                    </div>
                    <Switch checked={isSelf} onCheckedChange={handleSelfChange} disabled={!extrasConfirmed} />
                  </div>
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
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={isSelf || !extrasConfirmed}
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
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={!extrasConfirmed}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={isSelf || !extrasConfirmed}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">License Number *</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                        placeholder="DL123456789"
                        className="pl-10 h-12 bg-slate-50 border-slate-200"
                        disabled={!extrasConfirmed}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Vehicle Summary Card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                <div className="relative h-48 bg-gradient-to-br from-emerald-400 to-emerald-600">
                  {car.image || car.images?.[0] ? (
                    <img src={car.image || car.images?.[0]} alt={car.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-16 h-16 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <Badge className="absolute top-4 left-4 bg-emerald-500 capitalize">{car.type || car.vehicle_type || 'Car'}</Badge>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg">{car.name || car.vehicle_name || 'Vehicle'}</h3>
                    <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {car.seats || car.capacity || 5} seats</span>
                      <span className="flex items-center gap-1"><Settings className="w-3 h-3" /> {car.transmission || 'Automatic'}</span>
                      <span className="flex items-center gap-1"><Fuel className="w-3 h-3" /> {car.fuel || car.fuel_type || 'Petrol'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {/* Rental Details */}
                  <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h4 className="font-semibold text-slate-800 text-sm">Rental Details</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{car.pickupLocation || car.pickup_location || 'Selected Location'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>
                          {car.pickupDate ? format(new Date(car.pickupDate), 'EEE, MMM d') : 'Pickup'} 
                          {' → '}
                          {car.returnDate ? format(new Date(car.returnDate), 'EEE, MMM d, yyyy') : 'Return'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                          {pricing.days} day{pricing.days > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Selected Extras */}
                  {selectedExtras.length > 0 && selectedExtras[0] !== 'none' && (
                    <div className="mb-4 text-sm">
                      <p className="text-slate-500 mb-1">Selected Extras:</p>
                      {selectedExtras.filter(e => e !== 'none').map(eId => {
                        const ext = EXTRAS.find(e => e.id === eId);
                        return ext ? <div key={eId} className="flex justify-between"><span className="text-slate-600">{ext.name}</span><span className="font-medium">{formatCurrency(ext.price)}</span></div> : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Price Breakdown Card */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                <div className="bg-white p-5">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Price Breakdown
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>{formatCurrency(pricing.dailyRate)} x {pricing.days} days</span>
                      <span className="font-medium text-slate-800">{formatCurrency(pricing.base)}</span>
                    </div>
                    {pricing.extras > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Extras</span>
                        <span className="font-medium text-slate-800">+{formatCurrency(pricing.extras)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Service Fee</span>
                      <span className="font-medium text-slate-800">+{formatCurrency(pricing.commission)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-[#082c59]">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>

                  {/* Progress checklist */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-2 text-sm">
                    <div className={`flex items-center gap-2 ${extrasConfirmed ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {extrasConfirmed ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                      <span>Extras confirmed</span>
                    </div>
                      <div className={`flex items-center gap-2 ${isDriverInfoComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isDriverInfoComplete ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                        <span>Driver information complete</span>
                      </div>
                      <div className={`flex items-center gap-2 ${selectedPaymentMethod ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {selectedPaymentMethod ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                        <span>Payment method selected</span>
                      </div>
                    </div>
                </div>

                {/* Payment Section - Right Side */}
                <div className="bg-slate-400 border-t border-slate-200 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className={!canSelectPayment ? 'opacity-50 pointer-events-none' : ''}>
                    <PaymentMethodsSelection
                      amount={pricing.total}
                      orderId={orderId}
                      serviceName={car?.name || 'Car Rental'}
                      onPaymentInitiated={handlePaymentInitiated}
                      onPaymentError={handlePaymentError}
                      triggerPayment={triggerPayment}
                      onMethodSelected={(method) => setSelectedPaymentMethod(method)}
                    />
                  </div>
                </div>

                {/* Confirm Button */}
                <div className="bg-slate-50 border-t border-slate-200 p-5">
                    <Button 
                      onClick={handleSubmit}
                      disabled={paymentInProgress || !canConfirmBooking}
                      className={`w-full h-12 font-semibold rounded-xl ${
                        canConfirmBooking 
                          ? 'bg-[#082c59] hover:bg-[#0a3a75] text-white' 
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      }`}
                      data-testid="confirm-booking-btn"
                    >
                      {paymentInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : !canConfirmBooking ? (
                        <>
                          <Car className="w-4 h-4 mr-2" />
                          Complete all steps to book
                        </>
                      ) : (
                        <>
                          <Car className="w-4 h-4 mr-2" />
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
  );
}
