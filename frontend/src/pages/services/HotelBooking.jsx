import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import OperatorBookingBlock from '../../components/shared/OperatorBookingBlock';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { 
  ArrowLeft, Hotel, MapPin, Calendar, Users, CreditCard, Star, Wifi, Car, Coffee, 
  Check, CheckCircle2, X, Loader2, Shield, Clock, Bed, Maximize, Phone, Mail, User,
  FileText, Gift, Tag, ChevronRight
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';

const translations = {
  en: {
    title: 'Complete Your Booking',
    backToResults: 'Back to Results',
    hotelDetails: 'Hotel Details',
    guestInfo: 'Guest Information',
    specialRequests: 'Special Requests',
    paymentInfo: 'Payment Summary',
    confirmBooking: 'Proceed to Payment',
    processing: 'Processing...',
    bookingSuccess: 'Booking Successful!',
    bookingFailed: 'Booking Failed',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    phone: 'Phone Number',
    address: 'Address',
    city: 'City',
    country: 'Country',
    specialRequest: 'Special Requests (optional)',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Guests',
    nights: 'nights',
    totalAmount: 'Total Amount',
    taxesAndFees: 'Taxes & Fees',
    perNight: 'per night',
    adults: 'Adults',
    children: 'Children',
    freeCancellation: 'Free Cancellation',
    breakfastIncluded: 'Breakfast Included',
    wifiIncluded: 'Wi-Fi Included',
    parkingIncluded: 'Parking Included',
    imSender: "I'm the Guest",
    subtotal: 'Subtotal',
    discount: 'Discount ({code})',
    total: 'Total',
    promoCodePlaceholder: 'Enter promo code',
    applyButton: 'Apply',
    promoInvalid: 'Invalid promo code',
    promoExpired: 'Promo code has expired',
    promoError: 'Error validating promo code',
    redirecting: 'Redirecting to payment gateway...'
  },
  fr: {
    title: 'Finaliser votre Réservation',
    backToResults: 'Retour aux Résultats',
    hotelDetails: 'Détails de l\'Hôtel',
    guestInfo: 'Informations Client',
    specialRequests: 'Demandes Spéciales',
    paymentInfo: 'Résumé du Paiement',
    confirmBooking: 'Procéder au paiement',
    processing: 'Traitement...',
    bookingSuccess: 'Réservation Réussie !',
    bookingFailed: 'Échec de la Réservation',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Adresse Email',
    phone: 'Numéro de Téléphone',
    address: 'Adresse',
    city: 'Ville',
    country: 'Pays',
    specialRequest: 'Demandes Spéciales (optionnel)',
    checkIn: 'Arrivée',
    checkOut: 'Départ',
    guests: 'Invités',
    nights: 'nuits',
    totalAmount: 'Montant Total',
    taxesAndFees: 'Taxes et Frais',
    perNight: 'par nuit',
    adults: 'Adultes',
    children: 'Enfants',
    freeCancellation: 'Annulation Gratuite',
    breakfastIncluded: 'Petit Déjeuner Inclus',
    wifiIncluded: 'Wi-Fi Inclus',
    parkingIncluded: 'Parking Inclus',
    imSender: "Je suis l'invité",
    subtotal: 'Sous-total',
    discount: 'Réduction ({code})',
    total: 'Total',
    promoCodePlaceholder: 'Entrez le code promo',
    applyButton: 'Appliquer',
    promoInvalid: 'Code promo invalide',
    promoExpired: 'Le code promo a expiré',
    promoError: 'Erreur lors de la validation du code promo',
    redirecting: 'Redirection vers la passerelle de paiement...'
  }
};

// Step indicator component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { number: 1, label: 'Guest Details', icon: User },
    { number: 2, label: 'Review', icon: FileText },
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

export default function HotelBooking() {
  const { user, isOperatorUser } = useAuth();
  const navigate = useNavigate();
  
  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);
  
  const [language, setLanguage] = useState('en');
  const [hotel, setHotel] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

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
    address: '',
    city: '',
    country: 'Cameroon',
    specialRequests: ''
  });
  
  const [isSender, setIsSender] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [commissionData, setCommissionData] = useState({
    basePrice: 0,
    commissionRate: 5,
    commissionAmount: 0,
    totalAmount: 0
  });
  const [bookingAmenitiesExpanded, setBookingAmenitiesExpanded] = useState(false);

  const t = useCallback((key, params = {}) => {
    let translation = translations[language][key] || key;
    Object.keys(params).forEach((pKey) => {
      translation = translation.replace(`{${pKey}}`, params[pKey]);
    });
    return translation;
  }, [language]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedHotel = JSON.parse(sessionStorage.getItem('selectedHotel') || 'null');
        const storedParams = JSON.parse(sessionStorage.getItem('hotelSearchParams') || 'null');

        if (!storedHotel || !storedParams) {
          navigate('/services/hotels');
          return;
        }

        setHotel(storedHotel);
        setSearchParams(storedParams);

        if (user?.email) {
          setFormData(prev => ({ ...prev, email: user.email }));
        }

      } catch (error) {
        console.error('Error loading booking data:', error);
        navigate('/services/hotels');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [navigate, user]);

  useEffect(() => {
    if (hotel && searchParams) {
      const nights = calculateNights();
      const baseAmount = hotel.price_per_night * nights;
      const taxes = baseAmount * 0.1;
      const subtotal = baseAmount + taxes;
      const commissionRate = 5;
      const commissionAmount = subtotal * (commissionRate / 100);
      const total = subtotal + commissionAmount;

      setCommissionData({
        basePrice: subtotal,
        commissionRate,
        commissionAmount,
        totalAmount: total
      });
    }
  }, [hotel, searchParams]);

  const calculateNights = () => {
    if (!searchParams?.checkIn || !searchParams?.checkOut) return 1;
    const checkIn = new Date(searchParams.checkIn);
    const checkOut = new Date(searchParams.checkOut);
    return Math.max(1, differenceInDays(checkOut, checkIn));
  };

  const calculateTotalAmount = () => {
    if (!hotel) return { baseAmount: 0, taxes: 0, discount: 0, subtotal: 0, total: 0 };
    const nights = calculateNights();
    const baseAmount = hotel.price_per_night * nights;
    const taxes = baseAmount * 0.1;
    const subtotal = baseAmount + taxes;
    const totalWithCommission = commissionData.totalAmount || subtotal;

    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discount_percent) {
        discount = totalWithCommission * (appliedPromo.discount_percent / 100);
      } else if (appliedPromo.discount_amount) {
        discount = Math.min(appliedPromo.discount_amount, totalWithCommission);
      }
    }

    return {
      baseAmount,
      taxes,
      subtotal,
      discount,
      total: Math.max(0, totalWithCommission - discount)
    };
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleIsSenderChange = async (checked) => {
    setIsSender(checked);
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

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError('');
      setAppliedPromo(null);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/promo-codes/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code: promoCode.toUpperCase(), service_type: 'hotel', operator_id: hotel?.operator_id || null })
      });

      if (response.ok) {
        const promo = await response.json();
        setAppliedPromo(promo);
        setPromoError('');
      } else {
        setPromoError(t('promoInvalid'));
        setAppliedPromo(null);
      }
    } catch (error) {
      console.error('Promo code validation error:', error);
      setPromoError(t('promoError'));
      setAppliedPromo(null);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setAppliedPromo(null);
    setPromoError('');
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);

    // Stripe modal opened — not a payment outcome.
    if (response.opening_modal) return;

    if (response.redirectUrl) {
      toast.info(response.message || t('redirecting'));
      window.location.href = response.redirectUrl;
      return;
    }

    if (response.success || response.transactionRef) {
      try {
        const reservationPayload = {
          hotel_id: hotel.hotel_id || hotel.id,
          room_id: hotel.room_id || hotel.id,
          check_in_date: searchParams.checkIn,
          check_out_date: searchParams.checkOut,
          guests: (searchParams.adults || 1) + (searchParams.children || 0),
          guest_name: `${formData.firstName} ${formData.lastName}`,
          guest_email: formData.email,
          guest_phone: formData.phone,
          special_requests: formData.specialRequests || ''
        };

        const reservationResponse = await api.post('/rooms/bookings/reserve', reservationPayload);
        
        toast.success(`${t('bookingSuccess')} Booking #${reservationResponse.data.booking_id}`);
        sessionStorage.removeItem('selectedHotel');
        sessionStorage.removeItem('hotelSearchParams');
        navigate('/services/hotels');
      } catch (error) {
        console.error('Reservation creation failed:', error);
        toast.error(error.response?.data?.detail || 'Reservation failed. Please try again.');
      }
    } else {
      toast.error(`${t('bookingFailed')}: ${response.message || 'Unknown error'}`);
    }
  };

  const nights = calculateNights();
  const pricing = calculateTotalAmount();
  const isFormValid = formData.firstName && formData.lastName && formData.email && formData.phone;
  const isBookingDataComplete = isFormValid && pricing.total > 0;

  const serviceDetailsForPayment = {
    service_id: hotel?.id,
    service_title: hotel?.name,
    service_category: 'hotel',
    booking_date: searchParams?.checkIn,
    booking_details: {
      ...formData,
      checkIn: searchParams?.checkIn,
      checkOut: searchParams?.checkOut,
      adults: searchParams?.adults,
      children: searchParams?.children,
      nights: calculateNights(),
      hotelDetails: {
        city: hotel?.city,
        starRating: hotel?.star_rating,
        amenities: hotel?.amenities
      }
    }
  };

  const handlePayButtonClick = async () => {
    if (!isBookingDataComplete || paymentInProgress) {
      alert('Please fill all required booking details.');
      return;
    }
    
    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);
    
    try {
      if (!orderId) {
        const orderPayload = {
          service_type: 'hotel',
          service_id: hotel.id,
          service_name: hotel.name,
          total_amount: pricing.total,
          currency: 'XAF',
          status: 'pending',
          payment_status: 'pending',
          booking_details: {
            ...formData,
            hotel_id: hotel.id,
            hotel_name: hotel.name,
            check_in: searchParams?.checkIn,
            check_out: searchParams?.checkOut,
            adults: searchParams?.adults,
            children: searchParams?.children,
            nights: calculateNights(),
            room_type: hotel.room_type || 'Standard',
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
  
  const handleMoMoDialogOpen = () => {
    setShowPaymentOverlay(false);
    setPaymentInProgress(false);
  };
  
  const handleProcessingChange = (isProcessing) => {
    setShowPaymentOverlay(isProcessing);
    if (!isProcessing) {
      setPaymentInProgress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#082c59]/20 rounded-full animate-pulse"></div>
            <Hotel className="h-10 w-10 text-[#082c59] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!hotel || !searchParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-slate-600 mb-4">Booking session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/hotels')} className="bg-[#082c59]">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing payment, please do not refresh page"
      />
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1344px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
              <p className="text-sm text-slate-500">{hotel.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1344px] mx-auto px-4 py-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t('guestInfo')}</h3>
                    <p className="text-sm text-white/70">Who will be staying?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* I'm the Guest toggle */}
                <div className={`mb-6 p-4 rounded-xl border-2 transition-all ${
                  isSender 
                    ? 'bg-[#082c59]/10 border-[#082c59]/30' 
                    : 'bg-slate-100 border-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${isSender ? 'text-[#082c59]' : 'text-slate-500'}`} />
                      <span className="font-semibold text-slate-800">{t('imSender')}</span>
                    </div>
                    <Switch
                      checked={isSender}
                      onCheckedChange={handleIsSenderChange}
                      className="data-[state=checked]:bg-[#082c59] data-[state=unchecked]:bg-slate-400"
                    />
                  </div>
                  <p className="text-sm text-slate-500 mt-2 ml-8">Auto-fill with your profile information</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">
                      {t('firstName')} <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        disabled={isSender}
                        className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                        placeholder="Enter first name"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">
                      {t('lastName')} <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        disabled={isSender}
                        className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                      {t('email')} <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                      {t('phone')} <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={isSender}
                        className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-2 focus:ring-[#082c59]/20"
                        placeholder="+237 xxx xxx xxx"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{t('specialRequests')}</h3>
                    <p className="text-sm text-white/70">Let us know your preferences</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <Textarea
                  placeholder="E.g., Early check-in, high floor preference, extra pillows..."
                  value={formData.specialRequests}
                  onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  rows={4}
                  className="rounded-xl border-slate-200 focus:ring-2 focus:ring-amber-500/20"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Special requests are subject to availability and cannot be guaranteed.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Hotel Details Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative h-48">
                <img
                  src={hotel.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070'}
                  alt={hotel.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: hotel.star_rating || 3 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <h3 className="font-bold text-lg">{hotel.name}</h3>
                  <div className="flex items-center text-sm text-white/80">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{hotel.city}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                {/* Check-in / Check-out Policy */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      <p className="text-xs font-semibold text-emerald-700">Check-in</p>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">From 14:00</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-xs font-semibold text-amber-700">Check-out</p>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Before 12:00</p>
                  </div>
                </div>
                
                {/* Expandable Amenities */}
                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {hotel.amenities.slice(0, bookingAmenitiesExpanded ? hotel.amenities.length : 4).map((amenity, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-xs capitalize">
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-slate-600">{amenity.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                    {hotel.amenities.length > 4 && (
                      <button
                        onClick={() => setBookingAmenitiesExpanded(!bookingAmenitiesExpanded)}
                        className="mt-2 text-xs text-[#082c59] font-medium hover:underline"
                      >
                        {bookingAmenitiesExpanded ? 'Show less' : `+${hotel.amenities.length - 4} more amenities`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Booking Summary Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[#082c59] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Booking Summary</h3>
                    <p className="text-sm text-white/70">Your stay details</p>
                  </div>
                </div>
              </div>
              
              <div className="p-5 space-y-3">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">{t('checkIn')}</p>
                    <p className="font-bold text-slate-900">{format(new Date(searchParams.checkIn), 'MMM dd')}</p>
                    <p className="text-xs text-slate-500">{format(new Date(searchParams.checkIn), 'yyyy')}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">{t('checkOut')}</p>
                    <p className="font-bold text-slate-900">{format(new Date(searchParams.checkOut), 'MMM dd')}</p>
                    <p className="text-xs text-slate-500">{format(new Date(searchParams.checkOut), 'yyyy')}</p>
                  </div>
                </div>

                {/* Guests - Mini card */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-slate-500">Guests</p>
                    <p className="font-bold text-slate-900 text-sm">{searchParams.adults} {t('adults')}{searchParams.children > 0 ? ` + ${searchParams.children} ${t('children')}` : ''}</p>
                  </div>
                </div>

                {/* Nights - Mini card */}
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="font-bold text-slate-900 text-sm">{nights} {t('nights')}</p>
                  </div>
                </div>

                {/* Room Selected — Enhanced card with thumbnail, capacity, bed type + policies */}
                {hotel.room_type && (
                  <div className="rounded-xl border border-[#082c59]/20 overflow-hidden" data-testid="hotel-booking-room-summary">
                    {hotel.room_image && (
                      <div className="h-28 w-full overflow-hidden bg-slate-100">
                        <img src={hotel.room_image} alt={hotel.room_type} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3 bg-[#082c59]/5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-[#082c59]" />
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Your Selected Room</p>
                      </div>
                      <p className="font-bold text-[#082c59] text-sm leading-tight">{hotel.room_type}</p>
                      {(hotel.room_bed_type || hotel.room_capacity || hotel.room_size_sqm) && (
                        <div className="flex flex-wrap gap-1.5">
                          {hotel.room_bed_type && (
                            <Badge variant="outline" className="bg-white text-[10px]">{hotel.room_bed_type}</Badge>
                          )}
                          {hotel.room_capacity && (
                            <Badge variant="outline" className="bg-white text-[10px]">{hotel.room_capacity} guests</Badge>
                          )}
                          {hotel.room_size_sqm && (
                            <Badge variant="outline" className="bg-white text-[10px]">{hotel.room_size_sqm} m²</Badge>
                          )}
                        </div>
                      )}
                      {Array.isArray(hotel.room_policies) && hotel.room_policies.length > 0 && (
                        <div className="pt-2 border-t border-[#082c59]/10">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Room Policies</p>
                          <ul className="space-y-0.5">
                            {hotel.room_policies.slice(0, 3).map((p, i) => (
                              <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                <span className="mt-1 w-1 h-1 rounded-full bg-[#082c59] shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                            {hotel.room_policies.length > 3 && (
                              <li className="text-[10px] text-slate-400">+{hotel.room_policies.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Pricing Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Room ({nights} nights)</span>
                    <span className="font-medium">{formatCurrency(pricing.baseAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Taxes & Fees</span>
                    <span className="font-medium">{formatCurrency(pricing.taxes)}</span>
                  </div>

                  <CommissionBreakdown
                    basePrice={commissionData.basePrice}
                    commissionRate={commissionData.commissionRate}
                    commissionAmount={commissionData.commissionAmount}
                    totalAmount={commissionData.totalAmount}
                    showDetails={true}
                  />

                  {/* Promo Code */}
                  <div className="pt-2">
                    {!appliedPromo ? (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder={t('promoCodePlaceholder')}
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            className="pl-10 h-10 rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={validatePromoCode}
                          variant="outline"
                          className="rounded-xl"
                        >
                          {t('applyButton')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm text-emerald-800 font-medium">{appliedPromo.code}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {promoError && <p className="text-red-600 text-xs mt-1">{promoError}</p>}
                  </div>

                  {pricing.discount > 0 && appliedPromo && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>{t('discount', { code: appliedPromo.code })}</span>
                      <span>-{formatCurrency(pricing.discount)}</span>
                    </div>
                  )}

                  <Separator />

                  {/* Total */}
                  <div className="p-4 bg-gradient-to-r from-[#082c59] to-[#0a4a8f] rounded-xl text-white">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t('totalAmount')}</span>
                      <span className="text-2xl font-bold">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                </div>

                {hotel.free_cancellation && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <Shield className="h-5 w-5" />
                    <span className="text-sm font-medium">{t('freeCancellation')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Card */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
              <div className="bg-[#082c59] p-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t('paymentInfo')}
                </h3>
              </div>
              <div className="p-5">
                {!isFormValid && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2" data-testid="hotel-payment-gated">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete the guest information (name, email and phone) above to choose a payment method.
                  </div>
                )}
                <div className={!isFormValid ? 'opacity-50 pointer-events-none' : ''} aria-disabled={!isFormValid}>
                  <PaymentMethodsSelection
                    onCheckoutAbandoned={handleCheckoutAbandoned}
                  amount={pricing.total}
                  customerPhone={formData.phone}
                  customerEmail={formData.email}
                  serviceDetails={serviceDetailsForPayment}
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
                  disabled={!isBookingDataComplete || paymentInProgress || !selectedPaymentMethod}
                  className="w-full bg-[#082c59] hover:bg-[#0a3a75] text-white h-12 text-base rounded-xl shadow-lg mt-4"
                >
                  {paymentInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-5 w-5" />
                      Pay {formatCurrency(pricing.total)}
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" />
                  Your payment is secured with SSL encryption
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
