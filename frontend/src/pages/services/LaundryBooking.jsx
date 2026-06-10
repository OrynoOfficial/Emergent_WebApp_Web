import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { format, addDays } from 'date-fns';
import {
  Shirt, MapPin, Star, Clock, Truck, ArrowLeft, Plus, Minus, CalendarIcon,
  CreditCard, Loader2, CheckCircle2, User, Phone, Sparkles, Droplets, Search,
  Building2, Mail, Wallet, Home, DollarSign, X, Tag, Package,
} from 'lucide-react';
import { pressingApi } from '@/api/management';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import OperatorBookingBlock from '@/components/shared/OperatorBookingBlock';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';
import { rePayExisting } from '@/utils/paymentRetry';

// Fallback catalog for laundry-only shops (per kg shops don't have items)
const ITEM_TYPES = [
  { id: 'shirt', name: 'Shirt/Blouse', wash: 500, iron: 300, dry_clean: 1500 },
  { id: 'pants', name: 'Pants/Trousers', wash: 600, iron: 400, dry_clean: 1800 },
  { id: 'suit', name: 'Suit (2pc)', wash: 0, iron: 800, dry_clean: 5000 },
  { id: 'dress', name: 'Dress', wash: 800, iron: 500, dry_clean: 3000 },
  { id: 'bedsheet', name: 'Bed Sheet', wash: 1000, iron: 500, dry_clean: 0 },
  { id: 'blanket', name: 'Blanket', wash: 2000, iron: 0, dry_clean: 4000 },
  { id: 'curtain', name: 'Curtain (per meter)', wash: 1500, iron: 800, dry_clean: 3500 },
];

const SERVICE_TYPES = [
  { id: 'wash_iron', name: 'Wash & Iron', icon: Droplets },
  { id: 'wash', name: 'Wash Only', icon: Droplets },
  { id: 'iron', name: 'Iron Only', icon: Sparkles },
  { id: 'dry_clean', name: 'Dry Clean', icon: Sparkles },
];

// Step Indicator
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Items' },
    { num: 2, label: 'Schedule' },
    { num: 3, label: 'Payment' },
  ];
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num
                ? 'bg-purple-700 text-white shadow-lg shadow-purple-200'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${currentStep >= step.num ? 'text-purple-700' : 'text-slate-400'}`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step.num ? 'bg-purple-700' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Compact item card with thumbnail + counter
const ItemCard = ({ item, count, price, onInc, onDec }) => {
  const isActive = count > 0;
  return (
    <div
      className={`relative rounded-xl border-2 transition-all p-3 bg-white ${
        isActive
          ? 'border-purple-500 shadow-md shadow-purple-200 ring-2 ring-purple-100'
          : 'border-slate-200 hover:border-purple-300'
      }`}
      data-testid={`item-card-${item.id}`}
    >
      {isActive && (
        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">
          {count}
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-100 to-fuchsia-100 border border-purple-200">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Shirt className="w-6 h-6 text-purple-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate" title={item.name}>{item.name}</p>
          <p className="text-xs text-purple-700 font-bold">{formatFCFA(price)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onDec}
          disabled={count === 0}
          className="h-7 w-7 rounded-full border-purple-300 hover:bg-purple-50 disabled:opacity-40"
          data-testid={`item-dec-${item.id}`}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-sm font-bold text-purple-700 tabular-nums" data-testid={`item-count-${item.id}`}>{count}</span>
        <Button
          variant="outline"
          size="icon"
          onClick={onInc}
          className="h-7 w-7 rounded-full border-purple-300 hover:bg-purple-50"
          data-testid={`item-inc-${item.id}`}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default function LaundryBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOperatorUser } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [items, setItems] = useState({});
  const [serviceType, setServiceType] = useState('wash_iron');
  const [itemSearch, setItemSearch] = useState('');
  const [booking, setBooking] = useState({
    pickup_date: null,
    pickup_time: '09:00',
    delivery_date: null,
    address: user?.address || '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    notes: '',
    express: false,
  });
  const [pickupMethod, setPickupMethod] = useState('pickup'); // 'pickup' = operator picks up, 'self' = customer drops off
  const [isPickupDateOpen, setIsPickupDateOpen] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);

  // Abandon any pending unpaid order on modal close / unmount / tab close
  const { abandon: abandonOrder } = useOrderAbandonment(orderId, () => {
    setOrderId(null);
    setTriggerPayment(false);
    setPaymentInProgress(false);
  });
  const handleCheckoutAbandoned = ({ orderId: id } = {}) => abandonOrder(id);

  // Promo code state (mirrors TravelBooking pattern)
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  useEffect(() => { loadService(); }, [id]);

  const loadService = async () => {
    try {
      setLoading(true);
      const stored = sessionStorage.getItem('selectedLaundry');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === id || !id) {
          setService(parsed);
          setLoading(false);
          return;
        }
      }
      const res = await pressingApi.get(id);
      setService(res.data);
    } catch {
      setService({
        id, name: 'Express Clean', city: 'Yaoundé',
        address: 'Centre Ville, Near Total Station',
        rating: 4.8, phone: '+237 699 123 456',
        delivery: true, express: true, delivery_fee: 1500,
        services: ['washing', 'ironing', 'dry_cleaning'],
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItemCount = (itemId, delta) => {
    setItems((prev) => {
      const newCount = Math.max(0, (prev[itemId] || 0) + delta);
      if (newCount === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newCount };
    });
  };

  // Derive active price catalog from the actual shop
  const isPressingShop = useMemo(
    () => (service?.shop_type === 'pressing' || service?.shop_type === 'both') && Array.isArray(service?.item_prices) && service.item_prices.length > 0,
    [service],
  );
  const itemCatalog = useMemo(() => {
    if (isPressingShop) {
      return service.item_prices.map((ip, idx) => ({
        id: `item-${idx}-${(ip.item || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: ip.item,
        flatPrice: Number(ip.price) || 0,
        image_url: ip.image_url || null,
      }));
    }
    return ITEM_TYPES;
  }, [isPressingShop, service]);

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return itemCatalog;
    return itemCatalog.filter((i) => (i.name || '').toLowerCase().includes(q));
  }, [itemCatalog, itemSearch]);

  const getItemPrice = (item) => {
    if (item.flatPrice != null) return item.flatPrice;
    if (serviceType === 'wash_iron') return item.wash + item.iron;
    if (serviceType === 'wash') return item.wash;
    if (serviceType === 'iron') return item.iron;
    if (serviceType === 'dry_clean') return item.dry_clean;
    return 0;
  };

  // ---- Pricing (mirrors Travel-style breakdown with promo + service-specific rows) ----
  const pickupFee = useMemo(() => {
    if (pickupMethod !== 'pickup') return 0;
    return Number(service?.delivery_fee) || 0;
  }, [pickupMethod, service]);

  const itemsSubtotal = useMemo(() => {
    let sub = 0;
    Object.entries(items).forEach(([itemId, count]) => {
      const item = itemCatalog.find((i) => i.id === itemId);
      if (item) sub += getItemPrice(item) * count;
    });
    return sub;
  }, [items, itemCatalog, serviceType]);

  const expressSurcharge = useMemo(
    () => (booking.express ? Math.round(itemsSubtotal * 0.5) : 0),
    [booking.express, itemsSubtotal],
  );

  const subtotalBeforeDiscount = itemsSubtotal + expressSurcharge + pickupFee;
  const serviceFee = Math.round(subtotalBeforeDiscount * 0.05);

  const discount = useMemo(() => {
    if (!appliedPromo) return 0;
    const base = subtotalBeforeDiscount + serviceFee;
    if (appliedPromo.discount_percent) return Math.round(base * (appliedPromo.discount_percent / 100));
    if (appliedPromo.fixed_discount) return Math.min(appliedPromo.fixed_discount, base);
    if (appliedPromo.discount_amount) return Math.min(appliedPromo.discount_amount, base);
    return 0;
  }, [appliedPromo, subtotalBeforeDiscount, serviceFee]);

  const total = Math.max(0, subtotalBeforeDiscount + serviceFee - discount);
  const totalItems = Object.values(items).reduce((sum, c) => sum + c, 0);

  // Promo handlers
  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    try {
      const response = await api.post('/promo-codes/validate', {
        code: promoCode.toUpperCase(),
        service_type: 'laundry',
        order_amount: subtotalBeforeDiscount + serviceFee,
        operator_id: service?.operator_id,
      });
      const promo = response.data;
      setAppliedPromo({
        ...promo,
        discount_percent: promo.discount_type === 'percentage' ? promo.discount_value : null,
        fixed_discount: promo.discount_type === 'fixed' ? promo.discount_value : null,
      });
      setPromoError('');
      toast.success(`Promo applied: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : formatFCFA(promo.discount_value)} off`);
    } catch (err) {
      setPromoError(err.response?.data?.detail || 'Invalid promo code');
      setAppliedPromo(null);
    }
  };

  // Payment outcome handler
  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setTriggerPayment(false);
    if (response.opening_modal) return;
    if (response.success || response.transactionRef) {
      // Record promo code usage (non-blocking)
      if (appliedPromo?.code && orderId && discount > 0) {
        try {
          await api.post(`/promo-codes/use?code=${encodeURIComponent(appliedPromo.code)}&order_id=${orderId}&discount_amount=${discount}`);
        } catch { /* non-blocking */ }
      }
      toast.success('Booking confirmed!');
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  // Extract reusable order-creation logic. Used by both Confirm Booking
  // and (defensively) by PaymentMethodsSelection's lazy-create fallback.
  const ensureOrderId = async () => {
    if (orderId) return orderId;
    if (totalItems === 0) throw new Error('Please add at least one item');
    if (!booking.pickup_date) throw new Error('Please select a date');
    if (!booking.firstName || !booking.lastName || !booking.phone) {
      throw new Error('Please fill in your information (name + phone)');
    }
    if (pickupMethod === 'pickup' && !booking.address) {
      throw new Error('Please enter a pickup address');
    }

    const itemsBreakdown = Object.entries(items)
      .map(([itemId, count]) => {
        const item = itemCatalog.find((i) => i.id === itemId);
        if (!item) return null;
        return { id: itemId, name: item.name, quantity: count, unit_price: getItemPrice(item) };
      })
      .filter(Boolean);

    const orderPayload = {
      service_type: 'laundry',
      service_id: service.id || service._id || id,
      service_name: service.name,
      total_amount: total,
      currency: 'XAF',
      status: 'pending',
      payment_status: 'pending',
      booking_details: {
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        address: pickupMethod === 'pickup' ? booking.address : '',
        notes: booking.notes,
        pickup_method: pickupMethod,
        pickup_surcharge: pickupFee,
        shop_id: service.id || service._id || id,
        shop_name: service.name,
        shop_type: service.shop_type || 'laundry',
        service_type_selected: serviceType,
        pickup_date: booking.pickup_date ? format(booking.pickup_date, 'yyyy-MM-dd') : null,
        pickup_time: booking.pickup_time,
        delivery_date: booking.delivery_date ? format(booking.delivery_date, 'yyyy-MM-dd') : null,
        express: booking.express,
        express_surcharge: expressSurcharge,
        items: itemsBreakdown,
        items_subtotal: itemsSubtotal,
        service_fee: serviceFee,
        promo_code: appliedPromo?.code,
        promo_discount: discount,
      },
    };

    const response = await api.post('/orders/create', orderPayload);
    const newId = response.data?.order_id || response.data?._id || response.data?.id;
    if (!newId) throw new Error('Failed to create order');
    setOrderId(newId);
    return newId;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (totalItems === 0) {
      toast.error('Please add at least one item');
      return;
    }
    if (!booking.pickup_date) {
      toast.error('Please select a date');
      return;
    }
    if (!booking.firstName || !booking.lastName || !booking.phone) {
      toast.error('Please fill in your information (name + phone)');
      return;
    }
    if (pickupMethod === 'pickup' && !booking.address) {
      toast.error('Please enter a pickup address');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Please choose a payment method');
      return;
    }

    // If we already have a pending order for this checkout, just re-trigger payment.
    if (orderId) {
      rePayExisting(setTriggerPayment);
      return;
    }

    setPaymentInProgress(true);
    setCurrentStep(3);

    try {
      await ensureOrderId();
      setTriggerPayment(true);
    } catch (error) {
      console.error('Order creation failed:', error);
      toast.error(error.response?.data?.detail || error.message || 'Failed to create order. Please try again.');
      setPaymentInProgress(false);
      setCurrentStep(2);
    }
  };

  // Lazy-create fallback for PaymentMethodsSelection — if user somehow
  // triggers MoMo/Stripe without orderId, create the order on demand.
  const handleRequestCreateOrder = async () => {
    try {
      return await ensureOrderId();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Failed to create order');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 rounded-full animate-pulse" />
            <Shirt className="h-10 w-10 text-purple-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <p className="text-slate-600 mb-4">Service not found.</p>
          <Button onClick={() => navigate('/services/laundry')} className="bg-purple-700 hover:bg-purple-800">Back to Search</Button>
        </Card>
      </div>
    );
  }

  const stLabel = service.shop_type === 'pressing' ? 'Pressing'
    : service.shop_type === 'both' ? 'Laundry + Pressing'
    : 'Laundry';
  const stBadge = service.shop_type === 'pressing' ? 'bg-fuchsia-500 text-white border-transparent'
    : service.shop_type === 'both' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent'
    : 'bg-purple-500 text-white border-transparent';


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50/40">
      <DatePickerModal
        isOpen={isPickupDateOpen}
        onClose={() => setIsPickupDateOpen(false)}
        onSelect={(date) => {
          setBooking((prev) => ({ ...prev, pickup_date: date, delivery_date: addDays(date, booking.express ? 1 : 3) }));
          setIsPickupDateOpen(false);
        }}
        selectedDate={booking.pickup_date}
        minDate={new Date()}
      />

      {/* Header */}
      <div className="bg-white border-b border-purple-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-purple-50">
              <ArrowLeft className="h-5 w-5 text-purple-700" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {(service.images && service.images[0]) && (
                <img src={service.images[0]} alt={service.name} className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow ring-2 ring-purple-200" data-testid="booking-shop-thumb" />
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 truncate">{service.name}</h1>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <Badge className={`text-[10px] ${stBadge}`}>{stLabel}</Badge>
                  {service.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {service.city}</span>}
                  {service.turnaround_hours && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {service.turnaround_hours}h turnaround</span>}
                  {service.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {service.rating}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT COLUMN ===== */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Type (hidden for pressing-only) */}
            {!isPressingShop && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-700 to-purple-500 p-5">
                  <div className="flex items-center gap-3 text-white">
                    <div className="p-2 bg-white/20 rounded-xl"><Sparkles className="h-6 w-6" /></div>
                    <div>
                      <h3 className="font-bold text-lg">Service Type</h3>
                      <p className="text-sm text-white/70">What do you need?</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {SERVICE_TYPES.map((type) => {
                      const isSelected = serviceType === type.id;
                      const TypeIcon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setServiceType(type.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-purple-700 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}
                        >
                          <TypeIcon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-purple-700' : 'text-slate-400'}`} />
                          <p className={`text-sm font-medium ${isSelected ? 'text-purple-700' : 'text-slate-600'}`}>{type.name}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-orange-500" />
                        <div>
                          <span className="font-medium text-slate-700">Express Service</span>
                          <p className="text-xs text-slate-500">24-hour turnaround (+50%)</p>
                        </div>
                      </div>
                      <Switch checked={booking.express} onCheckedChange={(checked) => setBooking((p) => ({ ...p, express: checked }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Select Items — Redesigned compact grid with thumbnails + search ===== */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="select-items-card">
              <div className="bg-gradient-to-r from-purple-700 to-fuchsia-600 p-5">
                <div className="flex items-center justify-between gap-3 text-white flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><Shirt className="h-6 w-6" /></div>
                    <div>
                      <h3 className="font-bold text-lg">Select Items</h3>
                      <p className="text-sm text-white/70">{itemCatalog.length} item{itemCatalog.length !== 1 ? 's' : ''} offered · {totalItems} selected</p>
                    </div>
                  </div>
                  {totalItems > 0 && (
                    <Badge className="bg-white text-purple-700 hover:bg-white" data-testid="items-total-badge">
                      {totalItems} item{totalItems > 1 ? 's' : ''} · {formatFCFA(itemsSubtotal)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="p-5">
                {/* Search bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
                  <Input
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="pl-10 h-10 bg-purple-50/40 border-purple-200 focus-visible:ring-purple-400"
                    data-testid="item-search-input"
                  />
                </div>

                {/* Item grid — 2 columns mobile / 3 cols desktop, max-height with scroll */}
                <div
                  className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 -mr-1"
                  data-testid="items-grid"
                >
                  {filteredCatalog.map((item) => {
                    const price = getItemPrice(item);
                    if (price === 0) return null;
                    const count = items[item.id] || 0;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        price={price}
                        count={count}
                        onInc={() => updateItemCount(item.id, 1)}
                        onDec={() => updateItemCount(item.id, -1)}
                      />
                    );
                  })}
                </div>

                {filteredCatalog.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">No items match "{itemSearch}"</div>
                )}
              </div>
            </div>

            {/* ===== Your Information (renamed from Pickup Details) ===== */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-700 to-purple-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><User className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Your Information</h3>
                    <p className="text-sm text-white/70">How can we reach you?</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Pickup vs Self-drop-off toggle */}
                <div data-testid="pickup-method-toggle">
                  <Label className="text-slate-700 font-medium mb-2 block">How will your items get to the shop?</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPickupMethod('pickup')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        pickupMethod === 'pickup'
                          ? 'border-purple-700 bg-purple-50 shadow-md shadow-purple-100'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                      data-testid="pickup-option-pickup"
                    >
                      <div className="flex items-start gap-3">
                        <Truck className={`w-5 h-5 mt-0.5 ${pickupMethod === 'pickup' ? 'text-purple-700' : 'text-slate-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className={`font-semibold ${pickupMethod === 'pickup' ? 'text-purple-800' : 'text-slate-700'}`}>Pickup from me</p>
                            {pickupFee > 0 && pickupMethod === 'pickup' && (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">+{formatFCFA(Number(service.delivery_fee) || 0)} surcharge</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">The shop sends a rider to collect your items{service.delivery_fee ? ` — surcharge of ${formatFCFA(service.delivery_fee)} applies.` : '.'}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickupMethod('self')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        pickupMethod === 'self'
                          ? 'border-purple-700 bg-purple-50 shadow-md shadow-purple-100'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                      data-testid="pickup-option-self"
                    >
                      <div className="flex items-start gap-3">
                        <Home className={`w-5 h-5 mt-0.5 ${pickupMethod === 'self' ? 'text-purple-700' : 'text-slate-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className={`font-semibold ${pickupMethod === 'self' ? 'text-purple-800' : 'text-slate-700'}`}>I'll drop them off</p>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">No fee</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">You'll bring your items directly to the shop at your selected date.</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Personal info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">First Name *</Label>
                    <Input
                      value={booking.firstName}
                      onChange={(e) => setBooking((p) => ({ ...p, firstName: e.target.value }))}
                      placeholder="Jane"
                      className="h-11 bg-slate-50"
                      data-testid="info-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Last Name *</Label>
                    <Input
                      value={booking.lastName}
                      onChange={(e) => setBooking((p) => ({ ...p, lastName: e.target.value }))}
                      placeholder="Doe"
                      className="h-11 bg-slate-50"
                      data-testid="info-last-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.email}
                        onChange={(e) => setBooking((p) => ({ ...p, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="pl-10 h-11 bg-slate-50"
                        data-testid="info-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.phone}
                        onChange={(e) => setBooking((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-11 bg-slate-50"
                        data-testid="info-phone"
                      />
                    </div>
                  </div>

                  {/* Address (only required for pickup) */}
                  {pickupMethod === 'pickup' && (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-700 font-medium">Pickup Address *</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={booking.address}
                          onChange={(e) => setBooking((p) => ({ ...p, address: e.target.value }))}
                          placeholder="Your full pickup address"
                          className="pl-10 h-11 bg-slate-50"
                          data-testid="info-address"
                        />
                      </div>
                    </div>
                  )}

                  {/* Date + Time */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">{pickupMethod === 'pickup' ? 'Pickup Date *' : 'Drop-off Date *'}</Label>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left h-11 bg-slate-50', !booking.pickup_date && 'text-muted-foreground')}
                      onClick={() => setIsPickupDateOpen(true)}
                      data-testid="info-date-btn"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-purple-700" />
                      {booking.pickup_date ? format(booking.pickup_date, 'PPP') : 'Select date'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">{pickupMethod === 'pickup' ? 'Pickup Time' : 'Drop-off Time'}</Label>
                    <Select value={booking.pickup_time} onValueChange={(v) => setBooking((p) => ({ ...p, pickup_time: v }))}>
                      <SelectTrigger className="h-11 bg-slate-50" data-testid="info-time-trigger"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Special Notes</Label>
                    <Textarea
                      value={booking.notes}
                      onChange={(e) => setBooking((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Any special instructions..."
                      className="bg-slate-50"
                      data-testid="info-notes"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT COLUMN — Enhanced Summary + Price Breakdown + Payment ===== */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* ===== Shop info card ===== */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="shop-info-card">
                <div className="relative h-32 bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-500 p-5">
                  {service.images?.[0] && (
                    <img src={service.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  )}
                  <div className="relative">
                    <div className="flex items-center gap-1 text-amber-300 mb-1">
                      {[...Array(Math.floor(service.rating || 4))].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                      {service.rating > 0 && <span className="text-xs text-white/90 ml-1">{Number(service.rating).toFixed(1)}</span>}
                    </div>
                    <h3 className="text-white font-bold text-lg leading-tight truncate">{service.name}</h3>
                    <Badge className={`${stBadge} mt-1 text-[10px]`}>{stLabel}</Badge>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-2">
                    {service.express_available && <Badge className="bg-orange-500 border-transparent">Express</Badge>}
                    {service.delivery_available && <Badge className="bg-emerald-500 border-transparent">Delivery</Badge>}
                  </div>
                </div>

                <div className="p-5 space-y-3 text-sm">
                  {service.operator_name && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building2 className="w-4 h-4 text-purple-700 flex-shrink-0" />
                      <span className="truncate" data-testid="shop-operator">{service.operator_name}</span>
                    </div>
                  )}
                  {(service.address || service.city) && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug" data-testid="shop-location">
                        {[service.address, service.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {service.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-purple-700 flex-shrink-0" />
                      <span>{service.phone}</span>
                    </div>
                  )}
                  {service.turnaround_hours && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-purple-700 flex-shrink-0" />
                      <span>{service.turnaround_hours}h turnaround</span>
                    </div>
                  )}

                  {/* Schedule */}
                  {booking.pickup_date && (
                    <div className="pt-3 mt-3 border-t border-purple-100 space-y-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4 text-purple-700" />
                        <span className="font-medium">
                          {pickupMethod === 'pickup' ? 'Pickup' : 'Drop-off'}: {format(booking.pickup_date, 'MMM d')} · {booking.pickup_time}
                        </span>
                      </div>
                      {booking.delivery_date && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Truck className="w-4 h-4 text-purple-700" />
                          <span className="font-medium">Delivery: {format(booking.delivery_date, 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items summary */}
                  {totalItems > 0 && (
                    <div className="pt-3 mt-3 border-t border-purple-100">
                      <h4 className="font-semibold text-slate-800 mb-2 text-xs uppercase tracking-wide">Items ({totalItems})</h4>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {Object.entries(items).map(([itemId, count]) => {
                          const item = itemCatalog.find((i) => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="flex justify-between text-xs text-slate-600">
                              <span className="truncate">{item.name} × {count}</span>
                              <span className="font-medium text-slate-800 ml-2">{formatFCFA(getItemPrice(item) * count)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== Travel-style Price Breakdown — purple accent ===== */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-purple-100" data-testid="laundry-price-breakdown">
                <div className="bg-purple-800 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Items Subtotal{totalItems > 0 ? ` (${totalItems})` : ''}</span>
                      <span className="font-medium text-slate-800">{formatFCFA(itemsSubtotal)}</span>
                    </div>
                    {expressSurcharge > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Express surcharge (+50%)</span>
                        <span className="font-medium">+{formatFCFA(expressSurcharge)}</span>
                      </div>
                    )}
                    {pickupFee > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>Pickup surcharge</span>
                        <span className="font-medium">+{formatFCFA(pickupFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Service fee (5%)</span>
                      <span className="font-medium">+{formatFCFA(serviceFee)}</span>
                    </div>

                    {/* Promo code input */}
                    <div className="pt-2">
                      {!appliedPromo ? (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
                            <Input
                              placeholder="Promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              className="pl-10 bg-purple-50/40 border-purple-200 text-sm"
                              data-testid="promo-code-input"
                            />
                          </div>
                          <Button
                            onClick={validatePromoCode}
                            variant="outline"
                            size="sm"
                            className="shrink-0 border-purple-300 text-purple-700 hover:bg-purple-50"
                            data-testid="promo-apply-btn"
                          >Apply</Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="promo-applied">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm text-emerald-700 font-medium">{appliedPromo.code}</span>
                          </div>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                            className="text-red-500 hover:text-red-600 h-7 px-2"
                            data-testid="promo-remove-btn"
                          ><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                      {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                    </div>

                    {discount > 0 && appliedPromo && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({appliedPromo.code})</span>
                        <span className="font-medium">-{formatFCFA(discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-purple-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-purple-700" data-testid="laundry-total">{formatFCFA(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment method — moved here, right column, below price breakdown */}
                <div className="bg-purple-800 border-t border-purple-200 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </h4>
                </div>
                <div className="bg-slate-50 p-5">
                  <PaymentMethodsSelection
                    amount={total}
                    orderId={orderId}
                    customerPhone={booking.phone}
                    customerEmail={booking.email}
                    serviceDetails={{
                      service_category: 'laundry',
                      service_title: service?.name || 'Laundry',
                      operator_id: service?.operator_id,
                    }}
                    serviceName={service?.name || 'Laundry'}
                    onPaymentInitiated={handlePaymentInitiated}
                    onPaymentError={(error) => toast.error(error.message)}
                    onCheckoutAbandoned={handleCheckoutAbandoned}
                    onRequestCreateOrder={handleRequestCreateOrder}
                    triggerPayment={triggerPayment}
                    onMethodSelected={setSelectedPaymentMethod}
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={paymentInProgress}
                    className="w-full mt-4 bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-800 hover:to-purple-700 text-white h-12 font-semibold rounded-xl shadow-md shadow-purple-300/40 disabled:opacity-60"
                    data-testid="confirm-booking-btn"
                  >
                    {paymentInProgress ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><Shirt className="w-4 h-4 mr-2" />Confirm Booking</>
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
