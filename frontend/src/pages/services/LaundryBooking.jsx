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
  CreditCard, Loader2, CheckCircle2, User, Phone, Sparkles, Droplets
} from 'lucide-react';
import { pressingApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';

const ITEM_TYPES = [
  { id: 'shirt', name: 'Shirt/Blouse', wash: 500, iron: 300, dry_clean: 1500 },
  { id: 'pants', name: 'Pants/Trousers', wash: 600, iron: 400, dry_clean: 1800 },
  { id: 'suit', name: 'Suit (2pc)', wash: 0, iron: 800, dry_clean: 5000 },
  { id: 'dress', name: 'Dress', wash: 800, iron: 500, dry_clean: 3000 },
  { id: 'bedsheet', name: 'Bed Sheet', wash: 1000, iron: 500, dry_clean: 0 },
  { id: 'blanket', name: 'Blanket', wash: 2000, iron: 0, dry_clean: 4000 },
  { id: 'curtain', name: 'Curtain (per meter)', wash: 1500, iron: 800, dry_clean: 3500 }
];

const SERVICE_TYPES = [
  { id: 'wash_iron', name: 'Wash & Iron', icon: Droplets },
  { id: 'wash', name: 'Wash Only', icon: Droplets },
  { id: 'iron', name: 'Iron Only', icon: Sparkles },
  { id: 'dry_clean', name: 'Dry Clean', icon: Sparkles }
];

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Items' },
    { num: 2, label: 'Schedule' },
    { num: 3, label: 'Payment' }
  ];

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num 
                ? 'bg-[#0e7490] text-white shadow-lg shadow-blue-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-[#0e7490]' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-[#0e7490]' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function LaundryBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [items, setItems] = useState({});
  const [serviceType, setServiceType] = useState('wash_iron');
  const [booking, setBooking] = useState({
    pickup_date: null,
    pickup_time: '09:00',
    delivery_date: null,
    address: user?.address || '',
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: user?.phone || '',
    notes: '',
    express: false
  });
  const [isPickupDateOpen, setIsPickupDateOpen] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  useEffect(() => {
    loadService();
  }, [id]);

  const loadService = async () => {
    try {
      setLoading(true);
      // First try sessionStorage
      const storedService = sessionStorage.getItem('selectedLaundry');
      if (storedService) {
        const parsed = JSON.parse(storedService);
        if (parsed.id === id || !id) {
          setService(parsed);
          setLoading(false);
          return;
        }
      }
      // Then try API
      const res = await pressingApi.get(id);
      setService(res.data);
    } catch (error) {
      // Fallback to mock data
      setService({
        id: id,
        name: 'Express Clean',
        city: 'Yaoundé',
        address: 'Centre Ville, Near Total Station',
        rating: 4.8,
        phone: '+237 699 123 456',
        delivery: true,
        express: true,
        services: ['washing', 'ironing', 'dry_cleaning']
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItemCount = (itemId, delta) => {
    setItems(prev => {
      const current = prev[itemId] || 0;
      const newCount = Math.max(0, current + delta);
      if (newCount === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newCount };
    });
  };

  // Derive the active price catalog from the actual shop:
  //   • pressing-only or both → use the shop's `item_prices` directly
  //   • laundry-only          → fall back to the generic per-service item rates
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
      }));
    }
    return ITEM_TYPES;
  }, [isPressingShop, service]);

  const getItemPrice = (item) => {
    if (item.flatPrice != null) return item.flatPrice;
    if (serviceType === 'wash_iron') return item.wash + item.iron;
    if (serviceType === 'wash') return item.wash;
    if (serviceType === 'iron') return item.iron;
    if (serviceType === 'dry_clean') return item.dry_clean;
    return 0;
  };

  const calculateTotal = () => {
    let total = 0;
    Object.entries(items).forEach(([itemId, count]) => {
      const item = itemCatalog.find(i => i.id === itemId);
      if (item) {
        total += getItemPrice(item) * count;
      }
    });
    if (booking.express) total *= 1.5;
    return total;
  };

  const getCommission = () => Math.round(calculateTotal() * 0.05);
  const getTotalWithCommission = () => calculateTotal() + getCommission();
  const getTotalItems = () => Object.values(items).reduce((sum, count) => sum + count, 0);

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setTriggerPayment(false);

    // Stripe modal opened — not a payment outcome.
    if (response.opening_modal) return;

    if (response.success || response.transactionRef) {
      toast.success('Booking confirmed!');
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (getTotalItems() === 0) {
      toast.error('Please add at least one item');
      return;
    }
    if (!booking.pickup_date) {
      toast.error('Please select a pickup date');
      return;
    }
    if (!booking.address || !booking.phone) {
      toast.error('Please fill in pickup details');
      return;
    }
    setCurrentStep(3);
    setTriggerPayment(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#0e7490]/20 rounded-full animate-pulse"></div>
            <Shirt className="h-10 w-10 text-[#0e7490] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-600 mt-4 font-medium">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="max-w-md mx-auto text-center p-8 shadow-xl">
          <p className="text-slate-600 mb-4">Service not found.</p>
          <Button onClick={() => navigate('/services/laundry')} className="bg-[#0e7490]">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-cyan-50/40">
      <DatePickerModal
        isOpen={isPickupDateOpen}
        onClose={() => setIsPickupDateOpen(false)}
        onSelect={(date) => {
          setBooking(prev => ({
            ...prev,
            pickup_date: date,
            delivery_date: addDays(date, booking.express ? 1 : 3)
          }));
          setIsPickupDateOpen(false);
        }}
        selectedDate={booking.pickup_date}
        minDate={new Date()}
      />

      {/* Header */}
      <div className="bg-white border-b border-cyan-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-cyan-50">
              <ArrowLeft className="h-5 w-5 text-cyan-700" />
            </Button>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {(service.images && service.images[0]) && (
                <img src={service.images[0]} alt={service.name} className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow ring-2 ring-cyan-200" data-testid="booking-shop-thumb" />
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 truncate">{service.name}</h1>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <Badge className={`text-[10px] ${
                    service.shop_type === 'pressing' ? 'bg-violet-500 text-white border-transparent'
                      : service.shop_type === 'both' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-transparent'
                      : 'bg-cyan-500 text-white border-transparent'
                  }`}>
                    {service.shop_type === 'pressing' ? 'Pressing'
                      : service.shop_type === 'both' ? 'Laundry + Pressing'
                      : 'Laundry'}
                  </Badge>
                  {service.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {service.city}</span>}
                  {service.turnaround_hours && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {service.turnaround_hours}h turnaround</span>}
                  {service.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /> {service.rating}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Type Selection — hidden for pressing-only shops where
                the catalog already has per-item flat prices, so the wash/iron
                breakdown does not apply. */}
            {!isPressingShop && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e7490] to-[#0891b2] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Sparkles className="h-6 w-6" />
                  </div>
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
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isSelected 
                            ? 'border-[#0e7490] bg-cyan-50' 
                            : 'border-slate-200 hover:border-cyan-300'
                        }`}
                      >
                        <TypeIcon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-[#0e7490]' : 'text-slate-400'}`} />
                        <p className={`text-sm font-medium ${isSelected ? 'text-[#0e7490]' : 'text-slate-600'}`}>{type.name}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Express Toggle */}
                <div className="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-orange-500" />
                      <div>
                        <span className="font-medium text-slate-700">Express Service</span>
                        <p className="text-xs text-slate-500">24-hour turnaround (+50%)</p>
                      </div>
                    </div>
                    <Switch
                      checked={booking.express}
                      onCheckedChange={(checked) => setBooking(prev => ({ ...prev, express: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Item Selection */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e7490] to-[#0891b2] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Shirt className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Select Items</h3>
                    <p className="text-sm text-white/70">What needs cleaning?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {itemCatalog.map((item) => {
                    const price = getItemPrice(item);
                    const count = items[item.id] || 0;
                    if (price === 0) return null;
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-cyan-50/40 rounded-xl border border-cyan-100">
                        <div>
                          <h4 className="font-medium text-slate-800">{item.name}</h4>
                          <p className="text-sm text-cyan-700 font-semibold">{formatFCFA(price)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateItemCount(item.id, -1)}
                            disabled={count === 0}
                            className="h-9 w-9 rounded-full border-cyan-300 hover:bg-cyan-50"
                            data-testid={`item-dec-${item.id}`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-bold text-lg text-cyan-700" data-testid={`item-count-${item.id}`}>{count}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateItemCount(item.id, 1)}
                            className="h-9 w-9 rounded-full border-cyan-300 hover:bg-cyan-50"
                            data-testid={`item-inc-${item.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pickup Details */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#0e7490] to-[#0891b2] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Pickup Details</h3>
                    <p className="text-sm text-white/70">When and where?</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Pickup Date *</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full justify-start text-left h-12 bg-slate-50", !booking.pickup_date && "text-muted-foreground")}
                      onClick={() => setIsPickupDateOpen(true)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[#0e7490]" />
                      {booking.pickup_date ? format(booking.pickup_date, 'PPP') : 'Select date'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Pickup Time</Label>
                    <Select value={booking.pickup_time} onValueChange={(v) => setBooking(prev => ({ ...prev, pickup_time: v }))}>
                      <SelectTrigger className="h-12 bg-slate-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Pickup Address *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.address}
                        onChange={(e) => setBooking(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Your full address"
                        className="pl-10 h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={booking.phone}
                        onChange={(e) => setBooking(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+237 6XX XXX XXX"
                        className="pl-10 h-12 bg-slate-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Special Notes</Label>
                    <Textarea
                      value={booking.notes}
                      onChange={(e) => setBooking(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any special instructions..."
                      className="bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-[#0e7490] p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Payment Method</h3>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <PaymentMethodsSelection
                  amount={getTotalWithCommission()}
                  orderId={null}
                  serviceName={service?.name || 'Laundry'}
                  onPaymentInitiated={handlePaymentInitiated}
                  onPaymentError={(error) => toast.error(error.message)}
                  triggerPayment={triggerPayment}
                  onMethodSelected={setSelectedPaymentMethod}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Service Preview */}
                <div className="relative h-32 bg-gradient-to-br from-[#0e7490] to-[#0891b2] p-5">
                  <div className="flex items-center gap-1 text-amber-400 mb-2">
                    {[...Array(Math.floor(service.rating || 4))].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <h3 className="text-white font-bold text-lg">{service.name}</h3>
                  <p className="text-white/80 text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {service.city}
                  </p>
                  <div className="absolute top-4 right-4 flex gap-2">
                    {service.express && <Badge className="bg-orange-500">Express</Badge>}
                    {service.delivery && <Badge className="bg-emerald-500">Delivery</Badge>}
                  </div>
                </div>

                <div className="p-5">
                  {/* Schedule Summary */}
                  {booking.pickup_date && (
                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-3">Schedule</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <CalendarIcon className="w-4 h-4 text-[#0e7490]" />
                          <span>Pickup: {format(booking.pickup_date, 'MMM d')} at {booking.pickup_time}</span>
                        </div>
                        {booking.delivery_date && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Truck className="w-4 h-4 text-[#0e7490]" />
                            <span>Delivery: {format(booking.delivery_date, 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items Summary */}
                  {getTotalItems() > 0 && (
                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <h4 className="font-semibold text-slate-800 mb-3">Items ({getTotalItems()})</h4>
                      <div className="space-y-2 text-sm">
                        {Object.entries(items).map(([itemId, count]) => {
                          const item = ITEM_TYPES.find(i => i.id === itemId);
                          return item && (
                            <div key={itemId} className="flex justify-between text-slate-600">
                              <span>{item.name} × {count}</span>
                              <span>{formatFCFA(getItemPrice(item) * count)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pricing Summary */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-5 -mb-5 p-5 rounded-b-2xl">
                    <h4 className="font-semibold text-white mb-3">Price Breakdown</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Items Subtotal</span>
                        <span>{formatFCFA(calculateTotal() / (booking.express ? 1.5 : 1))}</span>
                      </div>
                      {booking.express && (
                        <div className="flex justify-between text-orange-400">
                          <span>Express (+50%)</span>
                          <span>+{formatFCFA(calculateTotal() / 3)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>Service Fee (5%)</span>
                        <span>+{formatFCFA(getCommission())}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">Total</span>
                          <span className="text-2xl font-bold text-emerald-400">{formatFCFA(getTotalWithCommission())}</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSubmit}
                      disabled={!selectedPaymentMethod || paymentInProgress || getTotalItems() === 0}
                      className="w-full mt-4 bg-[#0e7490] hover:bg-[#0891b2] text-white h-12 font-semibold rounded-xl"
                    >
                      {paymentInProgress ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shirt className="w-4 h-4 mr-2" />
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
    </div>
  );
}
