import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Film, Clock, MapPin, ArrowLeft, Calendar, Armchair, Plus, Minus, Loader2,
  CreditCard, User, Phone, Mail, CheckCircle2, Popcorn, Star
} from 'lucide-react';
import { cinemaApi } from '@/api/management';
import api from '@/api/client';
import { BookerInfoSection } from '@/components/booking/BookerInfoSection';
import { formatCurrency } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import PaymentProcessingOverlay from '@/components/common/PaymentProcessingOverlay';
import { format } from 'date-fns';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 12;

const TICKET_TYPES = [
  { id: 'adult', name: 'Adult', multiplier: 1, icon: User },
  { id: 'child', name: 'Child', multiplier: 0.5, description: '50% off' },
  { id: 'senior', name: 'Senior', multiplier: 0.7, description: '30% off' }
];

// Step Indicator Component
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Seats' },
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
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${
              currentStep >= step.num ? 'text-indigo-600' : 'text-slate-400'
            }`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${
              currentStep > step.num ? 'bg-indigo-600' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function CinemaBooking() {
  const { showtimeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [showtime, setShowtime] = useState(null);
  const [film, setFilm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState(['A3', 'A4', 'B5', 'B6', 'C7', 'D8', 'D9', 'E10']);
  const [ticketCounts, setTicketCounts] = useState({ adult: 1, child: 0, senior: 0 });
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  
  const [isSelf, setIsSelf] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    loadData();
  }, [showtimeId]);

  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }));
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Mock data
      setShowtime({
        id: showtimeId,
        cinema_name: 'CanalOlympia Yaoundé',
        city: 'Yaoundé',
        screen_name: 'Screen 1',
        screen_type: '3d',
        show_date: searchParams.get('date') || '2025-01-15',
        show_time: '14:00',
        price: 5000,
        total_seats: 96
      });
      setFilm({
        id: searchParams.get('film'),
        title: 'Black Panther: Wakanda Forever',
        duration_minutes: 161,
        rating: 'PG-13'
      });
    } catch (error) {
      console.error('Failed to load showtime:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfChange = async (checked) => {
    setIsSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        setFormData(prev => ({ ...prev, firstName: profile.first_name || nameParts[0] || '', lastName: profile.last_name || nameParts.slice(1).join(' ') || '', email: profile.email || prev.email, phone: profile.phone || prev.phone || '' }));
      } catch {
        if (user) { const fullName = user.full_name || ''; const nameParts = fullName.trim().split(/\s+/); setFormData(prev => ({ ...prev, firstName: user.first_name || nameParts[0] || '', lastName: user.last_name || nameParts.slice(1).join(' ') || '', email: user.email || prev.email, phone: user.phone || prev.phone || '' })); }
      }
    } else { setFormData(prev => ({ ...prev, firstName: '', lastName: '', phone: '' })); }
  };

  const toggleSeat = (seatId) => {
    if (bookedSeats.includes(seatId)) return;
    setSelectedSeats(prev => 
      prev.includes(seatId) 
        ? prev.filter(s => s !== seatId)
        : prev.length < getTotalTickets() ? [...prev, seatId] : prev
    );
  };

  const getTotalTickets = () => ticketCounts.adult + ticketCounts.child + ticketCounts.senior;

  const calculatePricing = () => {
    const basePrice = showtime?.price || 0;
    const subtotal = (ticketCounts.adult * basePrice) + 
           (ticketCounts.child * basePrice * 0.5) + 
           (ticketCounts.senior * basePrice * 0.7);
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    
    return {
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
      toast.success(`Booking confirmed! Enjoy your movie!`);
      navigate('/orders');
    }
  };

  const handlePaymentError = (error) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    toast.error(error.message || 'Payment failed');
  };

  const handleSubmit = async () => {
    if (selectedSeats.length !== getTotalTickets()) {
      toast.error(`Please select ${getTotalTickets()} seats`);
      return;
    }

    if (!formData.firstName || !formData.email || !formData.phone) {
      toast.error('Please fill in all contact details');
      return;
    }
    
    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);

    try {
      const pricing = calculatePricing();
      const orderPayload = {
        service_type: 'cinema',
        service_id: showtimeId,
        service_name: `${film?.title} - ${showtime?.cinema_name}`,
        total_amount: pricing.total,
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...formData,
          film_title: film?.title,
          cinema: showtime?.cinema_name,
          screen: showtime?.screen_name,
          show_date: showtime?.show_date,
          show_time: showtime?.show_time,
          seats: selectedSeats,
          ticket_counts: ticketCounts
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-500/30 rounded-full animate-pulse"></div>
            <Film className="h-10 w-10 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-slate-300 mt-4 font-medium">Loading showtime...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-900">
      <PaymentProcessingOverlay 
        isVisible={showPaymentOverlay} 
        message="Processing your booking..."
      />
      
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Book Your Seats</h1>
              <p className="text-sm text-slate-400">{film?.title}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Movie Info Card */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Film className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-2xl font-bold text-white">{film?.title}</h2>
                </div>
                <div className="flex flex-wrap gap-4 text-slate-300">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-indigo-400" /> {showtime?.cinema_name}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-indigo-400" /> {showtime?.show_date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-indigo-400" /> {showtime?.show_time}</span>
                  <Badge className="bg-indigo-600 uppercase">{showtime?.screen_type}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{formatCurrency(showtime?.price)}</div>
                <div className="text-slate-400 text-sm">per ticket</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Seat Selection & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seat Selection */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Armchair className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Select Your Seats</h3>
                    <p className="text-sm text-white/70">Choose {getTotalTickets()} seat{getTotalTickets() > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                {/* Screen */}
                <div className="relative mb-8">
                  <div className="h-3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full mb-2 shadow-lg shadow-indigo-500/50"></div>
                  <p className="text-center text-slate-500 text-sm">SCREEN</p>
                </div>

                {/* Seats Grid */}
                <div className="flex flex-col items-center gap-2 mb-6 overflow-x-auto pb-4">
                  {ROWS.map(row => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="w-6 text-slate-500 text-sm font-medium">{row}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: SEATS_PER_ROW }, (_, i) => {
                          const seatId = `${row}${i + 1}`;
                          const isBooked = bookedSeats.includes(seatId);
                          const isSelected = selectedSeats.includes(seatId);
                          return (
                            <button
                              key={seatId}
                              onClick={() => toggleSeat(seatId)}
                              disabled={isBooked}
                              className={`w-8 h-8 rounded-t-lg text-xs font-medium transition-all transform hover:scale-105 ${
                                isBooked ? 'bg-slate-700 text-slate-600 cursor-not-allowed' :
                                isSelected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' :
                                'bg-slate-600 text-slate-300 hover:bg-slate-500'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-6 text-slate-500 text-sm font-medium">{row}</span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-600 rounded-t-lg"></div>
                    <span className="text-slate-400">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-500 rounded-t-lg shadow-lg shadow-indigo-500/50"></div>
                    <span className="text-slate-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-700 rounded-t-lg"></div>
                    <span className="text-slate-400">Booked</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Types */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Popcorn className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Ticket Types</h3>
                    <p className="text-sm text-white/70">Select your ticket categories</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6 space-y-4">
                {/* Adult */}
                <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="text-white font-medium">Adult</div>
                    <div className="text-slate-400 text-sm">{formatCurrency(showtime?.price)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, adult: Math.max(0, p.adult - 1) }))}><Minus className="w-4 h-4" /></Button>
                    <span className="w-8 text-center text-white text-lg font-bold">{ticketCounts.adult}</span>
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, adult: p.adult + 1 }))}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                
                {/* Child */}
                <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="text-white font-medium">Child <Badge className="ml-2 bg-green-600 text-xs">50% off</Badge></div>
                    <div className="text-slate-400 text-sm">{formatCurrency((showtime?.price || 0) * 0.5)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, child: Math.max(0, p.child - 1) }))}><Minus className="w-4 h-4" /></Button>
                    <span className="w-8 text-center text-white text-lg font-bold">{ticketCounts.child}</span>
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, child: p.child + 1 }))}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                
                {/* Senior */}
                <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-xl">
                  <div>
                    <div className="text-white font-medium">Senior <Badge className="ml-2 bg-amber-600 text-xs">30% off</Badge></div>
                    <div className="text-slate-400 text-sm">{formatCurrency((showtime?.price || 0) * 0.7)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, senior: Math.max(0, p.senior - 1) }))}><Minus className="w-4 h-4" /></Button>
                    <span className="w-8 text-center text-white text-lg font-bold">{ticketCounts.senior}</span>
                    <Button size="icon" variant="outline" className="h-10 w-10 border-slate-600 text-white hover:bg-slate-700" onClick={() => setTicketCounts(p => ({ ...p, senior: p.senior + 1 }))}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <BookerInfoSection
              title="Contact Information"
              subtitle="Where should we send your tickets?"
              toggleLabel="Use my account details"
              firstName={formData.firstName}
              lastName={formData.lastName}
              email={formData.email}
              phone={formData.phone}
              onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
              user={user}
              isSelf={isSelf}
              onSelfChange={handleSelfChange}
            />

            {/* Payment Section */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
              <div className="bg-slate-400 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Payment Method</h3>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <PaymentMethodsSelection
                  amount={pricing.total}
                  orderId={orderId}
                  serviceName={film?.title || 'Cinema'}
                  onPaymentInitiated={handlePaymentInitiated}
                  onPaymentError={handlePaymentError}
                  triggerPayment={triggerPayment}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
                {/* Movie Preview */}
                <div className="relative h-48 bg-gradient-to-br from-indigo-600 to-purple-700">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-20 h-20 text-white/20" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <Badge className="absolute top-4 left-4 bg-indigo-600 uppercase">{showtime?.screen_type}</Badge>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg line-clamp-2">{film?.title}</h3>
                    <p className="text-slate-300 text-sm">{showtime?.screen_name}</p>
                  </div>
                </div>

                <CardContent className="p-5">
                  {/* Showtime Details */}
                  <div className="mb-4 pb-4 border-b border-slate-700">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        <span>{showtime?.cinema_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span>{showtime?.show_date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>{showtime?.show_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Selected Seats */}
                  <div className="mb-4 pb-4 border-b border-slate-700">
                    <h4 className="font-semibold text-white mb-3">Selected Seats ({selectedSeats.length}/{getTotalTickets()})</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSeats.length > 0 ? selectedSeats.map(seat => (
                        <Badge key={seat} className="bg-indigo-600">{seat}</Badge>
                      )) : <span className="text-slate-500 text-sm">No seats selected</span>}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-slate-900/50 -mx-5 -mb-5 p-5 rounded-b-xl">
                    <h4 className="font-semibold text-white mb-3">Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      {ticketCounts.adult > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Adult × {ticketCounts.adult}</span>
                          <span>{formatCurrency(ticketCounts.adult * (showtime?.price || 0))}</span>
                        </div>
                      )}
                      {ticketCounts.child > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Child × {ticketCounts.child}</span>
                          <span>{formatCurrency(ticketCounts.child * (showtime?.price || 0) * 0.5)}</span>
                        </div>
                      )}
                      {ticketCounts.senior > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Senior × {ticketCounts.senior}</span>
                          <span>{formatCurrency(ticketCounts.senior * (showtime?.price || 0) * 0.7)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>Service Fee</span>
                        <span>+{formatCurrency(pricing.commission)}</span>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold">Total</span>
                          <span className="text-2xl font-bold text-emerald-400">{formatCurrency(pricing.total)}</span>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleSubmit}
                      disabled={paymentInProgress || getTotalTickets() === 0 || selectedSeats.length !== getTotalTickets()}
                      className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white h-12 font-semibold rounded-xl"
                    >
                      {paymentInProgress ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      ) : selectedSeats.length !== getTotalTickets() 
                        ? `Select ${getTotalTickets() - selectedSeats.length} more seat(s)`
                        : 'Confirm Booking'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
