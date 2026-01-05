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
import { ArrowLeft, Hotel, MapPin, Calendar, Users, CreditCard, Star, Wifi, Car, Coffee, Check, CheckCircle2, X, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import PaymentMethodsSelection from '../../components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '../../components/common/PaymentProcessingOverlay';
import CommissionBreakdown from '../../components/common/CommissionBreakdown';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';
import { toast } from 'sonner';

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

export default function HotelBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState('en');
  const [hotel, setHotel] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [orderId, setOrderId] = useState(null);
  
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

        // Pre-fill email from user
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

  // Calculate nights and pricing
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

  const handleIsSenderChange = (checked) => {
    setIsSender(checked);
    if (checked && user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        phone: ''
      }));
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
        body: JSON.stringify({ code: promoCode.toUpperCase() })
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

    if (response.redirectUrl) {
      toast.info(response.message || t('redirecting'));
      window.location.href = response.redirectUrl;
      return;
    }

    if (response.success || response.transactionRef) {
      try {
        // Create the room reservation in the backend
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
        // Navigate back to hotel search page after successful booking
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
    
    try {
      // Create order first if not already created
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
        <div className="text-center">
          <Hotel className="h-12 w-12 mx-auto mb-4 text-[#052c59] animate-pulse" />
          <p className="text-slate-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!hotel || !searchParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md mx-auto text-center p-8">
          <p className="text-slate-600 mb-4">Booking session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/hotels')} className="bg-[#052c59]">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 min-h-screen md:p-8">
      {/* Payment Processing Overlay */}
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing payment, please do not refresh page"
      />
      
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            className="mr-4"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{t('title')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-[#052c59]" />
                  {t('guestInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* I'm the Guest toggle */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2 bg-slate-100 p-3 rounded-lg">
                    <Switch
                      id="imSender"
                      checked={isSender}
                      onCheckedChange={handleIsSenderChange}
                    />
                    <Label htmlFor="imSender">{t('imSender')}</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('firstName')} *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={isSender}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('lastName')} *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={isSender}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('phone')} *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={isSender}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">{t('address')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('city')}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">{t('country')}</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Special Requests */}
            <Card>
              <CardHeader>
                <CardTitle>{t('specialRequests')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={t('specialRequest')}
                  value={formData.specialRequests}
                  onChange={(e) => handleInputChange('specialRequests', e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1 space-y-6">
            {/* Hotel Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Hotel className="h-6 w-6 text-[#052c59]" />
                  {t('hotelDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-48 rounded-lg overflow-hidden">
                  <img
                    src={hotel.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070'}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{hotel.name}</h3>
                    <div className="flex items-center">
                      {Array.from({ length: hotel.star_rating || 3 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center text-slate-600 text-sm mb-3">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{hotel.city}</span>
                  </div>

                  {/* Amenities */}
                  <div className="space-y-2">
                    {hotel.amenities?.includes('wifi') && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <Wifi className="h-4 w-4" />
                        <span>{t('wifiIncluded')}</span>
                      </div>
                    )}
                    {hotel.amenities?.includes('breakfast') && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <Coffee className="h-4 w-4" />
                        <span>{t('breakfastIncluded')}</span>
                      </div>
                    )}
                    {hotel.amenities?.includes('parking') && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <Car className="h-4 w-4" />
                        <span>{t('parkingIncluded')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-green-600" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">{t('checkIn')}</div>
                    <div className="font-medium">{format(new Date(searchParams.checkIn), 'MMM dd, yyyy')}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{t('checkOut')}</div>
                    <div className="font-medium">{format(new Date(searchParams.checkOut), 'MMM dd, yyyy')}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span>{t('guests')}:</span>
                  <span>{searchParams.adults} {t('adults')}{searchParams.children > 0 && `, ${searchParams.children} ${t('children')}`}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span>Duration:</span>
                  <span>{nights} {t('nights')}</span>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>{t('subtotal')}</span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(pricing.subtotal)}</span>
                  </div>

                  {/* Commission Breakdown */}
                  <CommissionBreakdown
                    basePrice={commissionData.basePrice}
                    commissionRate={commissionData.commissionRate}
                    commissionAmount={commissionData.commissionAmount}
                    totalAmount={commissionData.totalAmount}
                    showDetails={true}
                  />

                  {/* Promo Code */}
                  <div className="space-y-2 pt-2">
                    {!appliedPromo ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('promoCodePlaceholder')}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={validatePromoCode}
                          variant="outline"
                        >
                          {t('applyButton')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-800 font-medium">
                            {appliedPromo.code}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {promoError && <p className="text-red-600 text-sm">{promoError}</p>}
                  </div>

                  {pricing.discount > 0 && appliedPromo && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('discount', { code: appliedPromo.code })}</span>
                      <span className="font-semibold">-{formatCurrency(pricing.discount)}</span>
                    </div>
                  )}

                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>{t('totalAmount')}</span>
                      <span className="text-emerald-600">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                </div>

                {hotel.free_cancellation && (
                  <Badge variant="outline" className="w-full justify-center text-green-600 border-green-200">
                    {t('freeCancellation')}
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Payment Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                  {t('paymentInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMethodsSelection
                  amount={pricing.total}
                  customerPhone={formData.phone}
                  customerEmail={formData.email}
                  serviceDetails={serviceDetailsForPayment}
                  onPaymentInitiated={handlePaymentInitiated}
                  disabled={!isBookingDataComplete || paymentInProgress}
                  triggerPayment={triggerPayment}
                  onTrigger={() => setPaymentInProgress(true)}
                  orderId={orderId}
                  onMoMoDialogOpen={handleMoMoDialogOpen}
                  onProcessingChange={handleProcessingChange}
                />

                <Button
                  onClick={handlePayButtonClick}
                  disabled={!isBookingDataComplete || paymentInProgress}
                  className="w-full bg-[#052c59] hover:bg-[#052c59]/90 text-white py-3 h-12 text-base rounded-xl shadow-lg mt-4"
                >
                  {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {paymentInProgress ? 'Processing Payment...' : `Pay ${formatCurrency(pricing.total)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
