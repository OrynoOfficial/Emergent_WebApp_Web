import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import {
  Package, MapPin, Clock, ArrowLeft, Calendar,
  Building, Truck, Shield, CheckCircle2, Camera,
  Phone, Mail, User, CreditCard, Loader2, DollarSign,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import api from '@/api/client';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '@/components/common/PaymentProcessingOverlay';
import MiniImageUploader from '@/components/shared/MiniImageUploader';

const formatHours = (h) => {
  if (!h && h !== 0) return '—';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
};

const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Sender & Receiver' },
    { num: 2, label: 'Package' },
    { num: 3, label: 'Payment' },
  ];
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${currentStep >= step.num ? 'text-red-700' : 'text-slate-400'}`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step.num ? 'bg-red-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function PackageBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImg = (img) => (img?.startsWith('/api') ? `${backendUrl}${img}` : img);

  const [service, setService] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState(null);

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
    notes: '',
    package_photos: [],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.email && booking.sender_email !== user.email) {
      setBooking((prev) => ({ ...prev, sender_email: user.email }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleSenderSelfChange = async (checked) => {
    setIsSenderSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const builtAddress =
          profile.address ||
          profile.full_address ||
          [profile.address_line, profile.city, profile.country].filter(Boolean).join(', ') ||
          [profile.city, profile.country].filter(Boolean).join(', ') ||
          searchParams?.origin_city ||
          '';
        setBooking((prev) => ({
          ...prev,
          sender_name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          sender_phone: profile.phone || '',
          sender_email: profile.email || prev.sender_email,
          sender_address: prev.sender_address || builtAddress,
        }));
      } catch {
        if (user) {
          const fallbackAddress =
            user.address ||
            [user.city, user.country].filter(Boolean).join(', ') ||
            searchParams?.origin_city ||
            '';
          setBooking((prev) => ({
            ...prev,
            sender_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            sender_phone: user.phone || '',
            sender_email: user.email || prev.sender_email,
            sender_address: prev.sender_address || fallbackAddress,
          }));
        }
      }
    } else {
      setBooking((prev) => ({ ...prev, sender_name: '', sender_phone: '', sender_address: '' }));
    }
  };

  const getPrice = () => Number(service?.calculated_price || 0);
  const getCommission = () => Math.round(getPrice() * 0.05);
  const getTotalPrice = () => getPrice() + getCommission();

  const handleMoMoDialogOpen = () => {
    // MoMo dialog is taking over the flow — hide our processing overlay
    setShowPaymentOverlay(false);
    setPaymentInProgress(false);
  };

  const handleProcessingChange = (isProcessing) => {
    setShowPaymentOverlay(isProcessing);
    if (!isProcessing) setPaymentInProgress(false);
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
      toast.success(`Booking confirmed! Tracking: ${trackingNumber || 'check your email'}`);
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

  const isFormValid = (
    booking.sender_name && booking.sender_phone && booking.sender_address &&
    booking.receiver_name && booking.receiver_phone && booking.receiver_address &&
    booking.package_description &&
    (booking.package_photos?.length || 0) >= 3
  );

  // Step indicator: 1=sender filling, 2=package filling, 3=payment ready
  const senderDone = booking.sender_name && booking.sender_phone && booking.sender_address &&
                      booking.receiver_name && booking.receiver_phone && booking.receiver_address;
  const packageDone = booking.package_description && (booking.package_photos?.length || 0) >= 3;
  const currentStep = paymentInProgress ? 3 : (packageDone ? 3 : (senderDone ? 2 : 1));

  const handleSubmit = async () => {
    if (!isFormValid) {
      const missing = [];
      if (!booking.sender_name || !booking.sender_phone || !booking.sender_address) missing.push('sender details');
      if (!booking.receiver_name || !booking.receiver_phone || !booking.receiver_address) missing.push('receiver details');
      if (!booking.package_description) missing.push('package description');
      if ((booking.package_photos?.length || 0) < 3) missing.push('3 package photos');
      toast.error(`Please complete: ${missing.join(', ')}`);
      return;
    }

    // Already created the package + order on a prior attempt that the user
    // closed without paying — just re-open the payment dialog with the
    // existing orderId. Prevents duplicate packages, duplicate orders, and
    // double charges.
    if (orderId) {
      setPaymentInProgress(true);
      setShowPaymentOverlay(true);
      setTriggerPayment(true);
      return;
    }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);

    try {
      const packagePayload = {
        package_service_id: service.id,
        sender: {
          name: booking.sender_name,
          phone: booking.sender_phone,
          email: booking.sender_email || null,
          address: booking.sender_address,
        },
        receiver: {
          name: booking.receiver_name,
          phone: booking.receiver_phone,
          email: booking.receiver_email || null,
          address: booking.receiver_address,
        },
        origin_city: searchParams.origin_city,
        destination_city: searchParams.destination_city,
        package_type: searchParams.package_type || 'parcel',
        weight_kg: Number(searchParams.weight_kg) || 0,
        dimensions: {
          length_cm: Number(searchParams.length_cm) || 0,
          width_cm: Number(searchParams.width_cm) || 0,
          height_cm: Number(searchParams.height_cm) || 0,
        },
        declared_value: Number(booking.declared_value) || 0,
        description: booking.package_description,
        notes: booking.notes || null,
        package_photos: booking.package_photos || [],
      };

      const pkgRes = await api.post('/packages/', packagePayload);
      const newTracking = pkgRes.data?.tracking_number;
      const packageId = pkgRes.data?.package_id;
      if (!packageId) throw new Error('Failed to register package');
      setTrackingNumber(newTracking);

      const orderPayload = {
        service_type: 'package',
        service_id: packageId,
        service_name: `${searchParams.origin_city} → ${searchParams.destination_city}`,
        total_amount: getTotalPrice(),
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...booking,
          package_id: packageId,
          tracking_number: newTracking,
          package_service_id: service.id,
          operator_id: service.operator_id,
          operator_name: service.operator_name,
          service_name: service.name,
          origin_city: searchParams.origin_city,
          destination_city: searchParams.destination_city,
          weight_kg: searchParams.weight_kg,
          dimensions: {
            length_cm: searchParams.length_cm,
            width_cm: searchParams.width_cm,
            height_cm: searchParams.height_cm,
          },
          package_type: searchParams.package_type,
          shipping_date: searchParams.shipping_date,
          delivery_time_hours: service.delivery_time_hours,
          package_photos: booking.package_photos,
        },
      };

      const orderRes = await api.post('/orders/create', orderPayload);
      const newOrderId = orderRes.data?.order_id || orderRes.data?.id;
      if (!newOrderId) throw new Error('Failed to create order');
      setOrderId(newOrderId);
      setTriggerPayment(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.detail || error.message || 'Failed to create booking');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  if (!service || !searchParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <Clock className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">Session expired. Please search again.</p>
          <Button onClick={() => navigate('/services/packages')} className="bg-red-600 hover:bg-red-700">Back to Search</Button>
        </Card>
      </div>
    );
  }

  const cover = service.images?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <PaymentProcessingOverlay isVisible={showPaymentOverlay} message="Processing your delivery booking..." />

      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100" data-testid="back-button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">Complete Your Delivery</h1>
              <p className="text-sm text-slate-500">{service.name} • {service.operator_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column — forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sender */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><User className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Sender Details</h3>
                    <p className="text-sm text-white/80">Who is sending this package?</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-medium text-slate-700">I'm the sender</span></div>
                  <Switch checked={isSenderSelf} onCheckedChange={handleSenderSelfChange} data-testid="sender-self-toggle" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name *</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.sender_name} onChange={(e) => setBooking((p) => ({ ...p, sender_name: e.target.value }))} placeholder="John Doe" className="pl-10 h-12 bg-slate-50" disabled={isSenderSelf} data-testid="sender-name-input" /></div></div>
                  <div className="space-y-2"><Label>Phone *</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.sender_phone} onChange={(e) => setBooking((p) => ({ ...p, sender_phone: e.target.value }))} placeholder="+237 6XX XXX XXX" className="pl-10 h-12 bg-slate-50" disabled={isSenderSelf} data-testid="sender-phone-input" /></div></div>
                  <div className="space-y-2"><Label>Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="email" value={booking.sender_email} onChange={(e) => setBooking((p) => ({ ...p, sender_email: e.target.value }))} placeholder="john@example.com" className="pl-10 h-12 bg-slate-50" /></div></div>
                  <div className="space-y-2 md:col-span-2"><Label>Pickup Address *</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.sender_address} onChange={(e) => setBooking((p) => ({ ...p, sender_address: e.target.value }))} placeholder="Full pickup address" className="pl-10 h-12 bg-slate-50" data-testid="sender-address-input" /></div></div>
                </div>
              </CardContent>
            </Card>

            {/* Receiver */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><User className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Receiver Details</h3>
                    <p className="text-sm text-white/80">Who should receive this package?</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name *</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.receiver_name} onChange={(e) => setBooking((p) => ({ ...p, receiver_name: e.target.value }))} placeholder="Jane Smith" className="pl-10 h-12 bg-slate-50" data-testid="receiver-name-input" /></div></div>
                  <div className="space-y-2"><Label>Phone *</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.receiver_phone} onChange={(e) => setBooking((p) => ({ ...p, receiver_phone: e.target.value }))} placeholder="+237 6XX XXX XXX" className="pl-10 h-12 bg-slate-50" data-testid="receiver-phone-input" /></div></div>
                  <div className="space-y-2"><Label>Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input type="email" value={booking.receiver_email} onChange={(e) => setBooking((p) => ({ ...p, receiver_email: e.target.value }))} placeholder="jane@example.com" className="pl-10 h-12 bg-slate-50" /></div></div>
                  <div className="space-y-2 md:col-span-2"><Label>Delivery Address *</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={booking.receiver_address} onChange={(e) => setBooking((p) => ({ ...p, receiver_address: e.target.value }))} placeholder="Full delivery address" className="pl-10 h-12 bg-slate-50" data-testid="receiver-address-input" /></div></div>
                </div>
              </CardContent>
            </Card>

            {/* Package Details */}
            <Card className="shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><Package className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Package Details</h3>
                    <p className="text-sm text-white/80">Tell us about your package and snap 3 photos</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-5">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-wrap gap-4 text-sm">
                  <div><span className="text-slate-500">Type:</span> <strong className="text-slate-800 capitalize">{searchParams.package_type}</strong></div>
                  <div><span className="text-slate-500">Weight:</span> <strong className="text-slate-800">{searchParams.weight_kg} kg</strong></div>
                  <div><span className="text-slate-500">Dimensions:</span> <strong className="text-slate-800">{searchParams.length_cm || '–'} × {searchParams.width_cm || '–'} × {searchParams.height_cm || '–'} cm</strong></div>
                </div>

                {/* 3 Photos */}
                <div className="rounded-xl border border-red-100 bg-red-50/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-4 w-4 text-red-600" />
                    <Label className="font-semibold text-slate-800">Package Photos <span className="text-red-500">*</span></Label>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">Upload <strong>exactly 3 photos</strong> of your package — front, side, and any visible damage / tags. These attach to your booking and protect you in case of dispute.</p>
                  <MiniImageUploader
                    images={booking.package_photos || []}
                    onChange={(imgs) => setBooking((p) => ({ ...p, package_photos: imgs }))}
                    max={3}
                    folder="package_bookings"
                    accent="red"
                  />
                  {(booking.package_photos?.length || 0) < 3 && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> {3 - (booking.package_photos?.length || 0)} more photo(s) required
                    </p>
                  )}
                </div>

                <div className="space-y-2"><Label>Package Description *</Label><Textarea value={booking.package_description} onChange={(e) => setBooking((p) => ({ ...p, package_description: e.target.value }))} placeholder="Describe the contents (e.g., laptop, documents, clothes)" className="bg-slate-50" rows={3} data-testid="package-description-input" /></div>
                <div className="space-y-2"><Label>Declared Value (FCFA)</Label><Input type="number" value={booking.declared_value} onChange={(e) => setBooking((p) => ({ ...p, declared_value: e.target.value }))} placeholder="0" className="h-12 bg-slate-50" /></div>
                <div className="space-y-2"><Label>Special Instructions</Label><Textarea value={booking.notes} onChange={(e) => setBooking((p) => ({ ...p, notes: e.target.value }))} placeholder="Any special handling instructions..." className="bg-slate-50" rows={2} /></div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — sticky summary + price + payment + confirm */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Service summary */}
              <div className="rounded-2xl shadow-lg bg-white overflow-hidden border border-slate-100">
                <div className="relative h-36">
                  {cover ? (
                    <img src={getImg(cover)} alt={service.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-rose-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-red-900/30 to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-yellow-400 text-red-800 hover:bg-yellow-400">Logistics</Badge>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h3 className="font-bold">{service.name}</h3>
                    <p className="text-white/80 text-xs flex items-center gap-1"><Building className="w-3 h-3" /> {service.operator_name}</p>
                  </div>
                </div>

                <div className="p-5">
                  {/* Route */}
                  <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <h4 className="font-semibold text-slate-800 text-sm">Shipment Route</h4>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span>From: <strong>{searchParams.origin_city}</strong></span></div>
                      <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" /><span>To: <strong>{searchParams.destination_city}</strong></span></div>
                      {searchParams.shipping_date && (
                        <div className="flex items-center gap-2 text-slate-600"><Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" /><span>{format(new Date(searchParams.shipping_date), 'EEE, MMM d')}</span></div>
                      )}
                      <div className="flex items-center gap-2 text-slate-600"><Clock className="w-3.5 h-3.5 text-red-500 shrink-0" /><span>Est. {formatHours(service.delivery_time_hours)}</span></div>
                    </div>
                  </div>

                  {/* Package summary */}
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-red-500" /> Package
                    </h4>
                    <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-slate-500">Type</span><strong className="capitalize">{searchParams.package_type}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Weight</span><strong>{searchParams.weight_kg} kg</strong></div>
                      <div className="flex justify-between"><span className="text-slate-500">Dimensions</span><strong>{searchParams.length_cm || '–'}×{searchParams.width_cm || '–'}×{searchParams.height_cm || '–'} cm</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price + payment + confirm */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping fee</span>
                      <span className="font-medium text-slate-800">{formatCurrency(getPrice())}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Service fee (5%)</span>
                      <span className="font-medium text-slate-800">+{formatCurrency(getCommission())}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-red-700">{formatCurrency(getTotalPrice())}</span>
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-gradient-to-r from-red-600 to-red-700 border-t border-slate-200 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Payment Method
                  </h4>
                </div>
                <div className="bg-slate-50 p-5">
                  {!isFormValid && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                      <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Complete sender, receiver, package details and upload <strong>3 photos</strong> to unlock payment.</span>
                    </div>
                  )}
                  <div className={!isFormValid ? 'pointer-events-none opacity-50' : ''}>
                    <PaymentMethodsSelection
                      amount={getTotalPrice()}
                      orderId={orderId}
                      serviceName={service?.name || 'Package Delivery'}
                      customerPhone={booking.sender_phone}
                      customerEmail={booking.sender_email}
                      serviceDetails={{ service_id: service?.id, service_name: service?.name, operator_id: service?.operator_id }}
                      onPaymentInitiated={handlePaymentInitiated}
                      onPaymentError={handlePaymentError}
                      onMoMoDialogOpen={handleMoMoDialogOpen}
                      onProcessingChange={handleProcessingChange}
                      onTrigger={() => { setPaymentInProgress(true); setTriggerPayment(false); }}
                      triggerPayment={triggerPayment}
                      onMethodSelected={setSelectedPaymentMethod}
                      disabled={!isFormValid || paymentInProgress}
                    />
                  </div>

                  {/* Confirm button — BELOW payment methods */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!isFormValid || paymentInProgress || !selectedPaymentMethod}
                    className="w-full h-12 text-base bg-red-600 hover:bg-red-700 text-white mt-4 rounded-xl shadow-lg font-semibold"
                    data-testid="confirm-booking-btn"
                  >
                    {paymentInProgress ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : (<><Truck className="w-4 h-4 mr-2" />Confirm Booking · {formatCurrency(getTotalPrice())}</>)}
                  </Button>
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-500"><Shield className="w-3 h-3" /><span>Free tracking included</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
