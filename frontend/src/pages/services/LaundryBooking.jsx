import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { format } from 'date-fns';
import { Shirt, MapPin, Star, Clock, Truck, ArrowLeft, Plus, Minus, CalendarIcon, CreditCard, Loader2 } from 'lucide-react';
import { pressingApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import CommissionBreakdown from '@/components/common/CommissionBreakdown';

const ITEM_TYPES = [
  { id: 'shirt', name: 'Shirt/Blouse', wash: 500, iron: 300, dry_clean: 1500 },
  { id: 'pants', name: 'Pants/Trousers', wash: 600, iron: 400, dry_clean: 1800 },
  { id: 'suit', name: 'Suit (2pc)', wash: 0, iron: 800, dry_clean: 5000 },
  { id: 'dress', name: 'Dress', wash: 800, iron: 500, dry_clean: 3000 },
  { id: 'bedsheet', name: 'Bed Sheet', wash: 1000, iron: 500, dry_clean: 0 },
  { id: 'blanket', name: 'Blanket', wash: 2000, iron: 0, dry_clean: 4000 },
  { id: 'curtain', name: 'Curtain (per meter)', wash: 1500, iron: 800, dry_clean: 3500 }
];

export default function LaundryBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState({});
  const [serviceType, setServiceType] = useState('wash_iron');
  const [booking, setBooking] = useState({
    pickup_date: null,
    pickup_time: '09:00',
    delivery_date: null,
    address: user?.address || '',
    phone: user?.phone || '',
    notes: '',
    express: false
  });
  const [isPickupDateOpen, setIsPickupDateOpen] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);

  useEffect(() => {
    loadService();
  }, [id]);

  const loadService = async () => {
    try {
      setLoading(true);
      const res = await pressingApi.get(id);
      setService(res.data);
    } catch (error) {
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

  const getItemPrice = (item) => {
    if (serviceType === 'wash_iron') return item.wash + item.iron;
    if (serviceType === 'wash') return item.wash;
    if (serviceType === 'iron') return item.iron;
    if (serviceType === 'dry_clean') return item.dry_clean;
    return 0;
  };

  const calculateTotal = () => {
    let total = 0;
    Object.entries(items).forEach(([itemId, count]) => {
      const item = ITEM_TYPES.find(i => i.id === itemId);
      if (item) total += getItemPrice(item) * count;
    });
    if (booking.express) total *= 1.5; // 50% express surcharge
    return total;
  };

  const getCommission = () => {
    return Math.round(calculateTotal() * 0.05);
  };

  const getTotalWithCommission = () => {
    return calculateTotal() + getCommission();
  };

  const getTotalItems = () => Object.values(items).reduce((sum, count) => sum + count, 0);

  const isFormValid = () => {
    return getTotalItems() > 0 && booking.pickup_date && booking.address && booking.phone;
  };

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setTriggerPayment(false);

    if (response.success || response.transactionRef) {
      toast.success('Order placed! We will pick up your items soon.');
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response.message || 'Unknown error'}`);
    }
  };

  const handlePayButtonClick = () => {
    if (!isFormValid()) {
      if (getTotalItems() === 0) {
        toast.error('Please add at least one item');
      } else {
        toast.error('Please fill in pickup details');
      }
      return;
    }
    setTriggerPayment(true);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (getTotalItems() === 0) {
      toast.error('Please add at least one item');
      return;
    }
    if (!booking.pickup_date || !booking.address) {
      toast.error('Please fill in pickup details');
      return;
    }
    
    setSubmitting(true);
    try {
      // Build items list for the API - must match backend schema
      const orderItems = Object.entries(items)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => {
          const itemType = ITEM_TYPES.find(t => t.id === itemId);
          return {
            service: serviceType, // wash_fold, dry_clean, etc.
            item_type: itemId,
            quantity
          };
        });
      
      // Call the pressing order API with query params
      const response = await pressingApi.createOrder(id, orderItems, {
        params: {
          delivery_requested: true,
          express_requested: booking.express || false,
          pickup_address: booking.address,
          delivery_address: booking.address,
          notes: booking.notes || ''
        }
      });
      
      toast.success(`Order placed! Order ID: ${response.data?.order_id || 'Confirmed'}`);
      navigate('/orders', {
        state: {
          orderId: response.data?.order_id,
          service: 'laundry',
          message: 'Laundry order confirmed!'
        }
      });
    } catch (error) {
      console.error('Order failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Service Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-[#082c59]">{service?.name}</h1>
                <div className="flex items-center text-gray-600 mt-1">
                  <MapPin className="w-4 h-4 mr-1" /> {service?.address}, {service?.city}
                </div>
                <div className="flex gap-2 mt-3">
                  {service?.delivery && <Badge className="bg-green-100 text-green-800"><Truck className="w-3 h-3 mr-1" /> Free Pickup & Delivery</Badge>}
                  {service?.express && <Badge className="bg-orange-100 text-orange-800"><Clock className="w-3 h-3 mr-1" /> Express Available</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold">{service?.rating}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Item Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Select Items</CardTitle>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="wash_iron">Wash & Iron</SelectItem>
                      <SelectItem value="wash">Wash Only</SelectItem>
                      <SelectItem value="iron">Iron Only</SelectItem>
                      <SelectItem value="dry_clean">Dry Clean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ITEM_TYPES.map(item => {
                    const price = getItemPrice(item);
                    if (price === 0) return null;
                    return (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-500">{formatFCFA(price)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateItemCount(item.id, -1)}><Minus className="w-4 h-4" /></Button>
                          <span className="w-8 text-center font-medium">{items[item.id] || 0}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateItemCount(item.id, 1)}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Pickup Details */}
            <Card>
              <CardHeader>
                <CardTitle>Pickup & Delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Pickup Date *</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full mt-1 justify-start text-left bg-white", !booking.pickup_date && "text-muted-foreground")}
                      onClick={() => setIsPickupDateOpen(true)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {booking.pickup_date ? format(booking.pickup_date, 'PPP') : 'Select date'}
                    </Button>
                    <DatePickerModal
                      isOpen={isPickupDateOpen}
                      onClose={() => setIsPickupDateOpen(false)}
                      onSelect={(d) => setBooking(p => ({ ...p, pickup_date: d }))}
                      selectedDate={booking.pickup_date}
                      title="Select Pickup Date"
                      minDate={new Date()}
                    />
                  </div>
                  <div>
                    <Label>Pickup Time</Label>
                    <Select value={booking.pickup_time} onValueChange={v => setBooking(p => ({ ...p, pickup_time: v }))}>
                      <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Pickup Address *</Label>
                  <Textarea value={booking.address} onChange={e => setBooking(p => ({ ...p, address: e.target.value }))} placeholder="Enter your full address..." className="mt-1" rows={2} />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input value={booking.phone} onChange={e => setBooking(p => ({ ...p, phone: e.target.value }))} placeholder="+237 6XX XXX XXX" className="mt-1" />
                </div>
                <div>
                  <Label>Special Instructions</Label>
                  <Textarea value={booking.notes} onChange={e => setBooking(p => ({ ...p, notes: e.target.value }))} placeholder="Any special care instructions..." className="mt-1" rows={2} />
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <input type="checkbox" id="express" checked={booking.express} onChange={e => setBooking(p => ({ ...p, express: e.target.checked }))} className="rounded" />
                  <div>
                    <Label htmlFor="express" className="font-medium cursor-pointer">Express Service (+50%)</Label>
                    <p className="text-sm text-gray-600">Same day delivery if ordered before 10 AM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getTotalItems() === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items selected</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(items).map(([itemId, count]) => {
                      const item = ITEM_TYPES.find(i => i.id === itemId);
                      if (!item) return null;
                      return (
                        <div key={itemId} className="flex justify-between text-sm">
                          <span>{item.name} x {count}</span>
                          <span>{formatFCFA(getItemPrice(item) * count)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {booking.express && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Express Surcharge</span>
                    <span>+50%</span>
                  </div>
                )}

                <CommissionBreakdown
                  basePrice={calculateTotal()}
                  commissionRate={5}
                  commissionAmount={getCommission()}
                  totalAmount={getTotalWithCommission()}
                  showDetails={getTotalItems() > 0}
                />

                {/* Payment Methods */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-[#082c59]" />
                    <h3 className="font-semibold text-slate-800">Payment Method</h3>
                  </div>
                  
                  <PaymentMethodsSelection
                    amount={getTotalWithCommission()}
                    customerPhone={booking.phone}
                    customerEmail={user?.email}
                    serviceDetails={{
                      service_category: 'laundry',
                      service_title: `${service?.name} - ${getTotalItems()} items`,
                      operator_id: service?.operator_id,
                      operator_name: service?.name,
                      booking_details: {
                        service,
                        serviceType,
                        items,
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
                    className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 mt-4" 
                    disabled={getTotalItems() === 0 || paymentInProgress}
                  >
                    {paymentInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {paymentInProgress ? 'Processing...' : `Pay ${formatFCFA(getTotalWithCommission())}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
