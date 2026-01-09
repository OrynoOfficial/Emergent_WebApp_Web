import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Bus, MapPin, Clock, Users, CreditCard, Armchair, Plus, Minus, CheckCircle2, X, Loader2, Calendar, DollarSign, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import LiveSeatMap from '../../components/travel/LiveSeatMap';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

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

  const handleIsTravelerChange = (checked) => {
    setIsTraveler(checked);
    if (checked && user) {
      onChange({
        ...passenger,
        firstName: user.first_name || user.full_name?.split(' ')[0] || '',
        lastName: user.last_name || user.full_name?.split(' ').slice(1).join(' ') || '',
        phoneNumber: user.phone || ''
      });
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
          disabled={isTraveler}
          required
        />
        <StyledInput
          id={`lastName-${passenger.id}`}
          label="Last Name"
          icon={Users}
          value={passenger.lastName}
          onChange={(e) => onChange({ ...passenger, lastName: e.target.value })}
          disabled={isTraveler}
          required
        />
        <StyledInput
          id={`idNumber-${passenger.id}`}
          label="ID/Passport Number"
          icon={CreditCard}
          value={passenger.idNumber}
          onChange={(e) => onChange({ ...passenger, idNumber: e.target.value })}
          disabled={isTraveler}
          required
        />
        <StyledInput
          id={`phoneNumber-${passenger.id}`}
          label="Phone Number"
          icon={Users}
          value={passenger.phoneNumber}
          onChange={(e) => onChange({ ...passenger, phoneNumber: e.target.value })}
          disabled={isTraveler}
          required
        />
      </div>
    </div>
  );
};

export default function TravelBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [orderId, setOrderId] = useState(null);
  
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

  const handleSeatsChange = useCallback((seats, bookingIds) => {
    setSelectedSeats(seats);
    setSeatBookingIds(bookingIds);
  }, []);

  const handleReturnSeatsChange = useCallback((seats, bookingIds) => {
    setReturnSelectedSeats(seats);
    setReturnSeatBookingIds(bookingIds);
  }, []);

  const calculatePricing = () => {
    if (!bookingData?.outbound) return { base: 0, extras: 0, commission: 0, total: 0 };
    
    const outboundPrice = bookingData.outbound.price * (bookingData.passengers || 1);
    const returnPrice = bookingData.return ? bookingData.return.price * (bookingData.passengers || 1) : 0;
    const base = outboundPrice + returnPrice;
    const extras = extraLuggage * EXTRA_LUGGAGE_PRICE;
    const subtotal = base + extras;
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    
    let discount = 0;
    if (appliedPromo?.discount_percent) {
      discount = (subtotal + commission) * (appliedPromo.discount_percent / 100);
    }
    
    return {
      base,
      outboundPrice,
      returnPrice,
      extras,
      subtotal,
      commissionRate,
      commission,
      discount,
      total: subtotal + commission - discount
    };
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/promo-codes/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ code: promoCode.toUpperCase() })
      });
      
      if (response.ok) {
        const promo = await response.json();
        setAppliedPromo(promo);
        setPromoError('');
      } else {
        setPromoError('Invalid promo code');
        setAppliedPromo(null);
      }
    } catch (error) {
      setPromoError('Error validating promo code');
      setAppliedPromo(null);
    }
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

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
            await api.post('/seat-bookings/reserve', {
              route_id: bookingData.outbound.id,
              travel_date: outboundDate,
              seat_numbers: selectedSeats
            });

            // Confirm the booking
            await api.post('/seat-bookings/confirm', {
              route_id: bookingData.outbound.id,
              travel_date: outboundDate,
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
              await api.post('/seat-bookings/reserve', {
                route_id: bookingData.return.id,
                travel_date: bookingData.returnDate,
                seat_numbers: returnSelectedSeats
              });

              await api.post('/seat-bookings/confirm', {
                route_id: bookingData.return.id,
                travel_date: bookingData.returnDate,
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

        toast.success('Travel booking confirmed!');
        sessionStorage.removeItem('selectedTrip');
        // Navigate back to travel search page
        navigate('/services/travel');
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
            operator_name: bookingData.outbound.operator_name,
            vehicle_type: bookingData.outbound.vehicle_type,
            travel_date: bookingData.departureDate || bookingData.travelDate,
            return_date: bookingData.returnDate,
            is_round_trip: bookingData.isRoundTrip,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Payment Processing Overlay */}
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing payment, please do not refresh page"
      />
      
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Complete Your Booking</h1>
              <p className="text-sm text-slate-500">{outbound.from_city} → {outbound.to_city}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
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
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Armchair className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Choose Your Seats</h3>
                        <p className="text-sm text-white/70">Optional seat selection</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/70">Enable</span>
                      <Switch
                        checked={showSeatSelection}
                        onCheckedChange={setShowSeatSelection}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {showSeatSelection ? (
                    <div className="space-y-6">
                      <p className="text-sm text-slate-600">
                        Select your preferred seats. Reserved seats are held for 15 minutes.
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
                    <div className="text-center py-6 bg-slate-50 rounded-xl">
                      <Armchair className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                      <p className="text-slate-600">Seats will be auto-assigned at check-in</p>
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
              <div className="sticky top-24">
                <div className="rounded-2xl shadow-lg bg-white overflow-hidden">
                  <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                    <div className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Bus className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Trip Summary</h3>
                        <p className="text-sm text-white/70">{passengers.length} passenger{passengers.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    {/* Outbound Trip */}
                    <div className="space-y-3 mb-4">
                      <h4 className="font-semibold text-slate-800">Outbound Trip</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Bus className="w-4 h-4 text-blue-500" />
                          <span>{outbound.operator_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span>{outbound.from_city} → {outbound.to_city}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <span>{format(outboundDate, 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span>{outbound.departure_time} - {outbound.arrival_time}</span>
                        </div>
                        {showSeatSelection && selectedSeats.length > 0 && (
                          <div className="flex items-center gap-2 text-slate-700">
                            <Armchair className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">Seats: {selectedSeats.join(', ')}</span>
                          </div>
                        )}
                        <p className="text-emerald-600 font-semibold">{formatCurrency(pricing.outboundPrice)}</p>
                      </div>
                    </div>

                    {/* Return Trip */}
                    {isRoundTrip && returnTrip && (
                      <div className="space-y-3 mb-4 pt-4 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-800">Return Trip</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Bus className="w-4 h-4 text-blue-500" />
                            <span>{returnTrip.operator_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <span>{returnTrip.from_city} → {returnTrip.to_city}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span>{bookingData.returnDate ? format(new Date(bookingData.returnDate), 'MMM d, yyyy') : 'Date TBD'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span>{returnTrip.departure_time} - {returnTrip.arrival_time}</span>
                          </div>
                          {showSeatSelection && returnSelectedSeats.length > 0 && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Armchair className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">Seats: {returnSelectedSeats.join(', ')}</span>
                            </div>
                          )}
                          <p className="text-emerald-600 font-semibold">{formatCurrency(pricing.returnPrice)}</p>
                        </div>
                      </div>
                    )}

                    {/* Extras */}
                    {extraLuggage > 0 && (
                      <div className="pt-4 border-t border-slate-200 mb-4">
                        <div className="flex justify-between text-sm text-slate-700">
                          <span>Extra Luggage × {extraLuggage}</span>
                          <span className="text-emerald-600">{formatCurrency(pricing.extras)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-5 p-5 rounded-b-xl">
                    <h4 className="font-semibold text-white mb-3">Payment Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Subtotal</span>
                        <span>{formatCurrency(pricing.subtotal)}</span>
                      </div>
                      
                      <CommissionBreakdown
                        basePrice={pricing.subtotal}
                        commissionRate={pricing.commissionRate}
                        commissionAmount={pricing.commission}
                        totalAmount={pricing.subtotal + pricing.commission}
                        showDetails={true}
                      />

                      {/* Promo Code */}
                      <div className="space-y-2 pt-2">
                        {!appliedPromo ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              className="flex-1 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                            />
                            <Button
                              onClick={validatePromoCode}
                              variant="outline"
                              className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                            >
                              Apply
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-400 font-medium">{appliedPromo.code}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                              className="text-red-400 hover:text-red-300 h-7 px-2"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {promoError && <p className="text-red-400 text-sm">{promoError}</p>}
                      </div>

                      {pricing.discount > 0 && appliedPromo && (
                        <div className="flex justify-between text-green-400">
                          <span>Discount ({appliedPromo.code})</span>
                          <span>-{formatCurrency(pricing.discount)}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-700">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-2xl font-bold text-emerald-400">{formatCurrency(pricing.total)}</span>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="pt-4 mt-4 border-t border-slate-700">
                      <PaymentMethodsSelection
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
                        disabled={!isFormValid || paymentInProgress}
                        triggerPayment={triggerPayment}
                        onTrigger={() => setPaymentInProgress(true)}
                        orderId={orderId}
                        onMoMoDialogOpen={handleMoMoDialogOpen}
                        onProcessingChange={handleProcessingChange}
                      />
                      
                      <Button
                        onClick={handlePayButtonClick}
                        disabled={!isFormValid || paymentInProgress}
                        className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 text-white mt-4 rounded-xl shadow-lg font-semibold"
                      >
                        {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bus className="mr-2 h-4 w-4" />}
                        {paymentInProgress ? 'Processing...' : `Book Trip • ${formatCurrency(pricing.total)}`}
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
