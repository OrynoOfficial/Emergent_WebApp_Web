import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OperatorBookingBlock from '../../components/shared/OperatorBookingBlock';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Bus, MapPin, Clock, Users, CreditCard, Armchair, Plus, Minus, CheckCircle2, X, Loader2, Calendar, DollarSign, ShoppingBag, ChevronRight, FileText } from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import LiveSeatMap from '../../components/travel/LiveSeatMap';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';

// Step indicator for travel booking
const TravelStepIndicator = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Traveler Details', icon: Users },
    { number: 2, label: 'Seats & Extras', icon: Armchair },
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

// Styled Input component matching original design - improved disabled state visibility
const StyledInput = ({ id, label, icon: Icon, error, disabled, ...props }) => (
  <div className={`relative w-full h-14 flex items-center rounded-xl px-4 border transition-all duration-300 ${disabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300'} ${error ? 'border-red-500 animate-shake' : ''}`}>
    {Icon && <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${disabled ? 'text-slate-400' : 'text-slate-600'}`} />}
    <div className="flex-grow">
      <Label htmlFor={id} className={`absolute top-1.5 text-xs font-medium ${disabled ? 'text-slate-500' : 'text-slate-600'}`}>{label}</Label>
      <Input 
        id={id} 
        {...props} 
        disabled={disabled} 
        className={`w-full bg-transparent border-none p-0 h-auto font-semibold text-sm pt-4 focus-visible:ring-0 ${
          disabled 
            ? 'text-slate-900 cursor-not-allowed opacity-100' 
            : 'text-slate-800'
        }`} 
        style={disabled ? { color: '#1e293b', opacity: 1 } : {}}
      />
    </div>
    {disabled && (
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Auto-filled</Badge>
      </div>
    )}
  </div>
);

// Passenger Form Component
const PassengerForm = ({ passenger, onChange, onRemove, isPrimary = false, user, onAutoFill }) => {
  const [isTraveler, setIsTraveler] = useState(false);

  const handleIsTravelerChange = async (checked) => {
    setIsTraveler(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        onChange({
          ...passenger,
          firstName: profile.first_name || nameParts[0] || '',
          lastName: profile.last_name || nameParts.slice(1).join(' ') || '',
          idNumber: profile.id_document_number || profile.national_id || profile.passport_number || '',
          phoneNumber: profile.phone || ''
        });
      } catch {
        if (user) {
          const fullName = user.full_name || '';
          const nameParts = fullName.trim().split(/\s+/);
          onChange({
            ...passenger,
            firstName: user.first_name || nameParts[0] || '',
            lastName: user.last_name || nameParts.slice(1).join(' ') || '',
            idNumber: user.id_document_number || user.national_id || user.passport_number || '',
            phoneNumber: user.phone || ''
          });
        }
      }
    } else {
      onChange({ ...passenger, firstName: '', lastName: '', idNumber: '', phoneNumber: '' });
    }
  };

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-slate-800">
          {isPrimary ? 'Primary Traveler' : `Passenger ${passenger.id}`}
        </h4>
        {!isPrimary && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700">
            Remove
          </Button>
        )}
      </div>
      
      {isPrimary && user && (
        <div className="flex items-center space-x-2 mb-4 bg-white p-3 rounded-lg border border-slate-200">
          <Checkbox
            id={`is-traveler-${passenger.id}`}
            checked={isTraveler}
            onCheckedChange={handleIsTravelerChange}
            className="border-slate-500"
          />
          <label htmlFor={`is-traveler-${passenger.id}`} className="text-sm font-medium text-slate-800">
            I am the traveler
          </label>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StyledInput
          id={`firstName-${passenger.id}`}
          label="First Name"
          icon={Users}
          value={passenger.firstName}
          onChange={(e) => onChange({ ...passenger, firstName: e.target.value })}
          required
        />
        <StyledInput
          id={`lastName-${passenger.id}`}
          label="Last Name"
          icon={Users}
          value={passenger.lastName}
          onChange={(e) => onChange({ ...passenger, lastName: e.target.value })}
          required
        />
        <StyledInput
          id={`idNumber-${passenger.id}`}
          label="ID/Passport Number"
          icon={CreditCard}
          value={passenger.idNumber}
          onChange={(e) => onChange({ ...passenger, idNumber: e.target.value })}
          required
        />
        <StyledInput
          id={`phoneNumber-${passenger.id}`}
          label="Phone Number"
          icon={Users}
          value={passenger.phoneNumber}
          onChange={(e) => onChange({ ...passenger, phoneNumber: e.target.value })}
          required
        />
      </div>
    </div>
  );
};

export default function TravelBooking() {
  const { user, isOperatorUser } = useAuth();
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [travelCurrentStep, setTravelCurrentStep] = useState(1);

  // Abandon any pending unpaid order when the user closes the
  // payment modal, navigates away, or closes the tab.
  const { abandon: abandonOrder } = useOrderAbandonment(orderId, () => {
    setOrderId(null);
    setTriggerPayment(false);
    setPaymentInProgress(false);
    if (typeof setShowPaymentOverlay === 'function') setShowPaymentOverlay(false);
  });
  const handleCheckoutAbandoned = ({ orderId: id } = {}) => abandonOrder(id);
  
  // Passengers
  const [passengers, setPassengers] = useState([]);
  
  // Seat selection
  const [showSeatSelection, setShowSeatSelection] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [returnSelectedSeats, setReturnSelectedSeats] = useState([]);
  const [seatBookingIds, setSeatBookingIds] = useState([]);
  const [returnSeatBookingIds, setReturnSeatBookingIds] = useState([]);
  
  // Extras
  const [extraLuggage, setExtraLuggage] = useState(0);
  const EXTRA_LUGGAGE_PRICE = 3000;
  
  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('selectedTrip') || 'null');
        if (!stored) {
          navigate('/services/travel');
          return;
        }
        setBookingData(stored);
        
        // Initialize passenger forms
        const passengerCount = stored.passengers || 1;
        const initialPassengers = Array.from({ length: passengerCount }, (_, i) => ({
          id: i + 1,
          firstName: '',
          lastName: '',
          idNumber: '',
          phoneNumber: ''
        }));
        setPassengers(initialPassengers);
        
      } catch (error) {
        console.error('Error loading booking data:', error);
        navigate('/services/travel');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [navigate]);

  const updatePassenger = (index, data) => {
    setPassengers(prev => prev.map((p, i) => i === index ? data : p));
  };

  const handleSeatsChange = useCallback((seats) => {
    setSelectedSeats(seats);
  }, []);

  const handleReturnSeatsChange = useCallback((seats) => {
    setReturnSelectedSeats(seats);
  }, []);

  const calculatePricing = () => {
    if (!bookingData?.outbound) return { base: 0, extras: 0, commission: 0, total: 0 };
    
    const outboundPrice = bookingData.outbound.price * (bookingData.passengers || 1);
    const returnPrice = bookingData.return ? bookingData.return.price * (bookingData.passengers || 1) : 0;
    const base = outboundPrice + returnPrice;
    const extras = extraLuggage * EXTRA_LUGGAGE_PRICE;
    const commissionRate = 5;
    // Commission only on trip price, NOT on luggage
    const commission = base * (commissionRate / 100);
    
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discount_percent) {
        discount = (base + commission) * (appliedPromo.discount_percent / 100);
      } else if (appliedPromo.fixed_discount) {
        discount = appliedPromo.fixed_discount;
      } else if (appliedPromo.discount_amount) {
        discount = appliedPromo.discount_amount;
      }
    }
    
    return {
      base,
      outboundPrice,
      returnPrice,
      extras,
      subtotal: base + extras,
      commissionRate,
      commission,
      discount,
      total: base + extras + commission - discount
    };
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    
    try {
      const response = await api.post('/promo-codes/validate', {
        code: promoCode.toUpperCase(),
        service_type: 'travel',
        order_amount: pricing.subtotal + pricing.commission,
        operator_id: bookingData?.outbound?.operator_id || null
      });
      
      const promo = response.data;
      // Normalize the promo response for pricing calculation
      setAppliedPromo({
        ...promo,
        discount_percent: promo.discount_type === 'percentage' ? promo.discount_value : null,
        fixed_discount: promo.discount_type === 'fixed' ? promo.discount_value : null,
      });
      setPromoError('');
      toast.success(`Promo code applied: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : formatCurrency(promo.discount_value)} off`);
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
    } else if (response.success || response.transactionRef) {
      // Payment successful - navigate after handling seats
      try {
        // Reserve seats if seat selection was enabled
        if (showSeatSelection && selectedSeats.length > 0) {
          const outboundDate = bookingData.outbound.tripDate 
            ? format(new Date(bookingData.outbound.tripDate), 'yyyy-MM-dd') 
            : bookingData.departureDate || bookingData.travelDate;
          
          try {
            // Confirm the booking — locks reserved seats as BOOKED permanently
            await api.post('/seat-bookings/confirm', {
              route_id: bookingData.outbound.id,
              travel_date: outboundDate,
              seat_numbers: selectedSeats,
              order_id: response.booking_id || response.transactionRef || orderId,
              passengers: passengers.map((p, idx) => ({
                seat_number: selectedSeats[idx],
                name: `${p.firstName} ${p.lastName}`,
                id_number: p.idNumber,
                phone: p.phoneNumber
              }))
            });

            // Handle return trip if exists
            if (bookingData.return && returnSelectedSeats.length > 0) {
              await api.post('/seat-bookings/confirm', {
                route_id: bookingData.return.id,
                travel_date: bookingData.returnDate,
                seat_numbers: returnSelectedSeats,
                order_id: response.booking_id || response.transactionRef || orderId,
                passengers: passengers.map((p, idx) => ({
                  seat_number: returnSelectedSeats[idx],
                  name: `${p.firstName} ${p.lastName}`,
                  id_number: p.idNumber,
                  phone: p.phoneNumber
                }))
              });
            }
          } catch (seatError) {
            console.error('Seat booking error:', seatError);
            // Continue with navigation even if seat booking fails
          }
        }

        // Record promo code usage if applied
        if (appliedPromo?.code) {
          try {
            await api.post(`/promo-codes/use?code=${encodeURIComponent(appliedPromo.code)}&order_id=${response.booking_id || response.transactionRef || orderId}&discount_amount=${pricing.discount}`);
          } catch { /* promo usage recording is non-blocking */ }
        }

        toast.success('Travel booking confirmed!');
        sessionStorage.removeItem('selectedTrip');
        navigate('/orders');
      } catch (error) {
        console.error('Booking confirmation failed:', error);
        // Still navigate since payment was successful
        toast.success('Payment successful! Booking may need manual seat assignment.');
        sessionStorage.removeItem('selectedTrip');
        navigate('/services/travel');
      }
    } else {
      toast.error(`Booking Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handlePayButtonClick = async () => {
    // Validate passengers
    const isValid = passengers.every(p => p.firstName && p.lastName && p.idNumber);
    if (!isValid) {
      toast.error('Please fill in all traveler details');
      return;
    }

    // Validate seat selection if enabled
    if (showSeatSelection) {
      if (selectedSeats.length < passengers.length) {
        toast.error('Please select a seat for each passenger');
        return;
      }
      if (bookingData?.return && returnSelectedSeats.length < passengers.length) {
        toast.error('Please select return seats for each passenger');
        return;
      }
    }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setTravelCurrentStep(3);

    try {
      // Create order if not already created
      if (!orderId) {
        // Get departure and destination from various possible field names
        const departureCity = bookingData.outbound.from_city || bookingData.outbound.origin || bookingData.outbound.departure_city || 'Unknown';
        const destinationCity = bookingData.outbound.to_city || bookingData.outbound.destination || bookingData.outbound.arrival_city || 'Unknown';
        
        const orderPayload = {
          service_type: 'travel',
          service_id: bookingData.outbound.id,
          service_name: `Bus: ${departureCity} → ${destinationCity}`,
          total_amount: pricing.total,
          currency: 'XAF',
          status: 'pending',
          payment_status: 'pending',
          booking_details: {
            departure_city: departureCity,
            destination_city: destinationCity,
            departure_time: bookingData.outbound.departure_time,
            arrival_time: bookingData.outbound.arrival_time,
            service_time: bookingData.outbound.departure_time,
            travel_time: bookingData.outbound.departure_time,
            operator_id: bookingData.outbound.operator_id,
            operator_name: bookingData.outbound.operator_name,
            vehicle_type: bookingData.outbound.vehicle_type,
            travel_date: bookingData.outbound?.tripDate || bookingData.date || bookingData.departureDate || bookingData.travelDate,
            service_date: bookingData.outbound?.tripDate || bookingData.date || bookingData.departureDate || bookingData.travelDate,
            return_date: bookingData.returnDate,
            is_round_trip: bookingData.isRoundTrip,
            outbound_price: pricing.outboundPrice + (pricing.extras / (bookingData.isRoundTrip ? 2 : 1)) + (pricing.commission / (bookingData.isRoundTrip ? 2 : 1)),
            passengers: passengers.map(p => ({
              first_name: p.firstName,
              last_name: p.lastName,
              id_number: p.idNumber,
              phone: p.phoneNumber
            })),
            selected_seats: selectedSeats,
            return_seats: returnSelectedSeats,
            extra_luggage: extraLuggage,
            promo_code: appliedPromo?.code,
            promo_discount: pricing.discount
          }
        };

        const response = await api.post('/orders/create', orderPayload);
        
        if (response.data && (response.data.order_id || response.data._id || response.data.id)) {
          const newOrderId = response.data.order_id || response.data._id || response.data.id;
          setOrderId(newOrderId);
          setTriggerPayment(true);
        } else {
          throw new Error('Failed to create order');
        }
      } else {
        setTriggerPayment(true);
      }
    } catch (error) {
      console.error('Order creation failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to create order. Please try again.');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  };
  
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

  const pricing = calculatePricing();
  const isFormValid = passengers.every(p => p.firstName && p.lastName && p.idNumber);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg flex items-center gap-3 shadow">
          <Loader2 className="h-6 w-6 animate-spin text-[#082c59]" />
          <span className="text-lg font-semibold text-slate-800">Loading trip details...</span>
        </div>
      </div>
    );
  }

  if (!bookingData?.outbound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow">
          <p className="text-xl text-slate-600 mb-4">No trip selected</p>
          <Button onClick={() => navigate('/services/travel')} className="bg-[#082c59]">
            Search Trips
          </Button>
        </div>
      </div>
    );
  }

  const { outbound, return: returnTrip, isRoundTrip } = bookingData;
  const outboundDate = outbound.tripDate ? new Date(outbound.tripDate) : new Date();


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Payment Processing Overlay */}
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing payment, please do not refresh page"
      />
      
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1344px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">Complete Your Booking</h1>
              <p className="text-sm text-slate-500">{outbound.from_city} → {outbound.to_city}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-[1344px] mx-auto px-4 py-8">
          {/* Step Indicator */}
          <TravelStepIndicator currentStep={travelCurrentStep} />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Traveler Details */}
              <div className="rounded-2xl shadow-lg bg-white overflow-hidden">
                <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Traveler Details</h3>
                      <p className="text-sm text-white/70">{passengers.length} passenger{passengers.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {passengers.map((passenger, index) => (
                    <PassengerForm
                      key={passenger.id}
                      passenger={passenger}
                      onChange={(data) => updatePassenger(index, data)}
                      isPrimary={index === 0}
                      user={user}
                    />
                  ))}
                </div>
              </div>

              {/* Seat Selection */}
              <div className="rounded-2xl shadow-lg bg-white overflow-hidden">
                <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Armchair className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Choose Your Seats</h3>
                      <p className="text-sm text-white/70">Select your preferred seats for a better experience</p>
                    </div>
                  </div>
                </div>
                
                {/* Enable toggle - prominent, outside the dark header */}
                <div className="px-6 pt-5 pb-2">
                  <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${showSeatSelection ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                    onClick={() => setShowSeatSelection(!showSeatSelection)}
                    data-testid="seat-selection-toggle"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showSeatSelection ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                        <Armchair className={`w-5 h-5 ${showSeatSelection ? 'text-emerald-600' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{showSeatSelection ? 'Seat Selection Enabled' : 'Enable Seat Selection'}</p>
                        <p className="text-xs text-slate-500">{showSeatSelection ? 'Choose your preferred seats below' : 'Seats will be auto-assigned at check-in'}</p>
                      </div>
                    </div>
                    <Switch
                      checked={showSeatSelection}
                      onCheckedChange={setShowSeatSelection}
                      data-testid="seat-selection-switch"
                    />
                  </div>
                </div>
                <div className="px-6 pb-6">
                  {showSeatSelection ? (
                    <div className="space-y-6">
                      <p className="text-sm text-slate-600">
                        Select your preferred seats. Reserved seats are held for 3 minutes.
                      </p>
                      
                      {/* Outbound Seat Map */}
                      <div>
                        <h4 className="font-semibold text-slate-800 mb-3">
                          Outbound: {outbound.from_city} → {outbound.to_city}
                          <span className="text-sm font-normal text-slate-600 ml-2">
                            ({selectedSeats.length}/{passengers.length} selected)
                          </span>
                        </h4>
                        <LiveSeatMap
                          routeId={outbound.id}
                          departureDate={format(outboundDate, 'yyyy-MM-dd')}
                          maxSeats={passengers.length}
                          selectedSeats={selectedSeats}
                          onSeatsChange={handleSeatsChange}
                          allowSeatSwapping={true}
                        />
                      </div>

                      {/* Return Seat Map */}
                      {isRoundTrip && returnTrip && (
                        <div>
                          <h4 className="font-semibold text-slate-800 mb-3">
                            Return: {returnTrip.from_city} → {returnTrip.to_city}
                            <span className="text-sm font-normal text-slate-600 ml-2">
                              ({returnSelectedSeats.length}/{passengers.length} selected)
                            </span>
                          </h4>
                          <LiveSeatMap
                            routeId={returnTrip.id}
                            departureDate={bookingData.returnDate}
                            maxSeats={passengers.length}
                            selectedSeats={returnSelectedSeats}
                            onSeatsChange={handleReturnSeatsChange}
                            allowSeatSwapping={true}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 rounded-xl mt-2">
                      <Armchair className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">Seats will be auto-assigned at check-in</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Baggage & Extras */}
              <div className="rounded-2xl shadow-lg bg-white overflow-hidden">
                <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Baggage & Extras</h3>
                      <p className="text-sm text-white/70">Add additional luggage</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                  <h4 className="font-medium text-green-800 mb-1">✓ Included per person</h4>
                  <p className="text-sm text-green-700">
                    1 hand luggage (7 kg) + 1 checked bag (20 kg)
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div>
                    <h4 className="font-medium text-slate-800">Extra Luggage (20 kg)</h4>
                    <p className="text-sm text-slate-600">{formatCurrency(EXTRA_LUGGAGE_PRICE)} per piece</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExtraLuggage(Math.max(0, extraLuggage - 1))}
                      disabled={extraLuggage === 0}
                      className="bg-white hover:bg-slate-100 border-slate-300 h-10 w-10 rounded-full"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-bold text-lg text-slate-800">{extraLuggage}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExtraLuggage(extraLuggage + 1)}
                      className="bg-white hover:bg-slate-100 border-slate-300 h-10 w-10 rounded-full"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-5">
                {/* Trip Summary Card */}
                <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                  <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                    <div className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-white/15 rounded-xl">
                        <Bus className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Trip Summary</h3>
                        <p className="text-sm text-white/70">{passengers.length} passenger{passengers.length > 1 ? 's' : ''}{isRoundTrip ? ' · Round Trip' : ''}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-b from-slate-50 to-white p-5 space-y-4">
                    {/* Outbound Trip */}
                    <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-sm" data-testid="travel-booking-outbound-summary">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                            <Bus className="w-3.5 h-3.5 text-white" />
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">Outbound</h4>
                        </div>
                        <span className="text-[#082c59] font-bold text-sm">{formatCurrency(pricing.outboundPrice)}</span>
                      </div>

                      {/* Bus thumbnail + operator card */}
                      <div className="flex items-center gap-3 mb-3 p-2 bg-blue-50/40 rounded-lg border border-blue-100/60">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-blue-100 shrink-0">
                          {outbound.vehicle_images?.[0] || outbound.images?.[0] ? (
                            <img src={outbound.vehicle_images?.[0] || outbound.images?.[0]} alt={outbound.vehicle_name || outbound.operator_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Bus className="w-6 h-6 text-blue-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{outbound.operator_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{outbound.vehicle_name || outbound.vehicle_type || 'Bus'}{outbound.plate_number ? ` · ${outbound.plate_number}` : ''}</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-3 p-2.5 bg-blue-50/50 rounded-lg">
                          <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-slate-800">{outbound.from_city} → {outbound.to_city}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-xs">{format(outboundDate, 'EEE, MMM d')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-xs">{outbound.departure_time} – {outbound.arrival_time}</span>
                          </div>
                        </div>
                        {showSeatSelection && selectedSeats.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Armchair className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="font-medium text-slate-700">Seats: {selectedSeats.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Return Trip */}
                    {isRoundTrip && returnTrip && (
                      <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Bus className="w-3.5 h-3.5 text-white" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">Return</h4>
                          </div>
                          <span className="text-emerald-700 font-bold text-sm">{formatCurrency(pricing.returnPrice)}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-3 p-2.5 bg-emerald-50/50 rounded-lg">
                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-semibold text-slate-800">{returnTrip.from_city} → {returnTrip.to_city}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-xs">{bookingData.returnDate ? format(new Date(bookingData.returnDate), 'EEE, MMM d') : 'TBD'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-xs">{returnTrip.departure_time} – {returnTrip.arrival_time}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <Bus className="w-3 h-3 shrink-0" />
                            <span>{returnTrip.operator_name}{returnTrip.vehicle_type ? ` · ${returnTrip.vehicle_type}` : ''}</span>
                          </div>
                          {showSeatSelection && returnSelectedSeats.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <Armchair className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="font-medium text-slate-700">Seats: {returnSelectedSeats.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Extras */}
                    {extraLuggage > 0 && (
                      <div className="flex justify-between items-center text-sm px-2 py-2 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                          Extra Luggage x {extraLuggage}
                        </span>
                        <span className="font-semibold text-slate-800">{formatCurrency(pricing.extras)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Breakdown Card */}
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
                        <span>Trip Fare ({passengers.length} passenger{passengers.length > 1 ? 's' : ''})</span>
                        <span className="font-medium text-slate-800">{formatCurrency(pricing.base)}</span>
                      </div>
                      {passengers.length > 1 && (
                        <div className="flex justify-between text-xs text-slate-400 pl-3">
                          <span>{formatCurrency(Math.round(pricing.base / passengers.length))} per passenger</span>
                        </div>
                      )}
                      {pricing.extras > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Extra Luggage</span>
                          <span className="font-medium text-slate-800">{formatCurrency(pricing.extras)}</span>
                        </div>
                      )}
                      
                      <CommissionBreakdown
                        basePrice={pricing.base}
                        commissionRate={pricing.commissionRate}
                        commissionAmount={pricing.commission}
                        totalAmount={pricing.base + pricing.commission}
                        showDetails={true}
                      />

                      {/* Promo Code */}
                      <div className="pt-2">
                        {!appliedPromo ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              className="flex-1 bg-slate-50 border-slate-200 text-sm"
                              data-testid="promo-code-input"
                            />
                            <Button
                              onClick={validatePromoCode}
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              Apply
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm text-emerald-700 font-medium">{appliedPromo.code}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                              className="text-red-500 hover:text-red-600 h-7 px-2"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                        {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                      </div>

                      {pricing.discount > 0 && appliedPromo && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount ({appliedPromo.code})</span>
                          <span>-{formatCurrency(pricing.discount)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-2xl font-bold text-[#082c59]">{formatCurrency(pricing.total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#082c59] border-t border-slate-200 p-4">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Select Payment Method
                    </h4>
                  </div>
                  <div className="bg-slate-50 p-5">
                    {!isFormValid && (
                      <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2" data-testid="travel-payment-gated">
                        <Users className="w-3.5 h-3.5" />
                        Complete every passenger's First name, Last name and ID/Passport number to choose a payment method.
                      </div>
                    )}
                    <div className={!isFormValid ? 'opacity-50 pointer-events-none' : ''} aria-disabled={!isFormValid}>
                      <PaymentMethodsSelection
                    onCheckoutAbandoned={handleCheckoutAbandoned}
                      amount={pricing.total}
                      customerPhone={passengers[0]?.phoneNumber}
                      customerEmail={user?.email}
                      serviceDetails={{
                        service_category: 'travel',
                        service_title: `${outbound.from_city || outbound.origin || outbound.departure_city} to ${outbound.to_city || outbound.destination || outbound.arrival_city}${isRoundTrip ? ' (Round Trip)' : ''}`,
                        operator_id: outbound.operator_id,
                        operator_name: outbound.operator_name,
                        booking_details: {
                          outbound,
                          return: returnTrip,
                          passengers,
                          extraLuggage,
                          selectedSeats: showSeatSelection ? selectedSeats : [],
                          returnSelectedSeats: showSeatSelection ? returnSelectedSeats : [],
                          seat_booking_ids: showSeatSelection ? seatBookingIds : [],
                          return_seat_booking_ids: showSeatSelection ? returnSeatBookingIds : []
                        }
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
                      onClick={handlePayButtonClick}
                      disabled={!isFormValid || paymentInProgress || !selectedPaymentMethod}
                      className="w-full h-12 text-base bg-[#082c59] hover:bg-[#0a3a75] text-white mt-4 rounded-xl shadow-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      data-testid="book-trip-btn"
                    >
                      {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bus className="mr-2 h-4 w-4" />}
                      {paymentInProgress ? 'Processing...' : !isFormValid ? 'Complete passenger details' : !selectedPaymentMethod ? 'Select a payment method above' : `Book Trip · ${formatCurrency(pricing.total)}`}
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
