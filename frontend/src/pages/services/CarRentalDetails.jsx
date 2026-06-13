import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { format, differenceInDays } from 'date-fns';
import { 
  ArrowLeft, Car, MapPin, Users, Fuel, Settings, 
  Star, CalendarIcon, Shield, CheckCircle, Phone,
  Snowflake, Radio, Navigation, Info, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const FEATURE_LABELS = {
  ac: 'Air Conditioning',
  bluetooth: 'Bluetooth',
  gps: 'GPS Navigation',
  leather: 'Leather Seats',
  sunroof: 'Sunroof',
  '4wd': '4WD / AWD',
  cruise_control: 'Cruise Control',
  backup_camera: 'Backup Camera'
};

export default function CarRentalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState({
    pickup: searchParams.get('pickupDate') ? new Date(searchParams.get('pickupDate')) : new Date(),
    return: searchParams.get('returnDate') ? new Date(searchParams.get('returnDate')) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  });
  const [isPickupDateOpen, setIsPickupDateOpen] = useState(false);
  const [isReturnDateOpen, setIsReturnDateOpen] = useState(false);

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const loadVehicle = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/vehicles/${id}`);
      setVehicle(res.data);
    } catch (error) {
      console.error('Failed to load vehicle:', error);
      // Mock data
      setVehicle({
        id,
        name: 'Mercedes C-Class',
        brand: 'Mercedes-Benz',
        model: 'C-Class C200',
        year: 2023,
        type: 'luxury',
        price_per_day: 95000,
        seats: 5,
        doors: 4,
        transmission: 'automatic',
        fuel_type: 'petrol',
        fuel_consumption: '7.5L/100km',
        trunk_capacity: '450L',
        features: ['ac', 'bluetooth', 'gps', 'leather', 'sunroof', 'cruise_control', 'backup_camera'],
        rating: 4.9,
        trips: 34,
        reviews_count: 28,
        description: 'Experience luxury and comfort with the Mercedes C-Class. Perfect for business trips or special occasions. Features premium leather interior, advanced infotainment system, and smooth automatic transmission.',
        policies: [
          'Minimum rental: 1 day',
          'Maximum rental: 30 days',
          'Fuel policy: Full to Full',
          'Mileage: Unlimited',
          'Insurance included',
          'Driver must be 25+ years',
          'Valid license required'
        ],
        pickup_locations: ['Yaoundé Airport', 'Yaoundé Centre', 'Douala Airport', 'Douala Centre'],
        owner: {
          name: 'Premium Auto Rentals',
          rating: 4.8,
          phone: '+237 699 123 456',
          response_time: '< 1 hour'
        },
        images: []
      });
    } finally {
      setLoading(false);
    }
  };

  const days = differenceInDays(selectedDates.return, selectedDates.pickup) || 1;
  const totalPrice = (vehicle?.price_per_day || 0) * days;

  const handleBook = () => {
    const bookingData = {
      vehicle,
      pickupDate: selectedDates.pickup.toISOString(),
      returnDate: selectedDates.return.toISOString(),
      days,
      totalPrice
    };
    sessionStorage.setItem('carRentalBookingDetails', JSON.stringify(bookingData));
    navigate('/services/car-rental/booking');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59]"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Vehicle not found</h2>
          <Button onClick={() => navigate('/services/car-rental')}>Back to Car Rental</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Image Gallery */}
        <div className="grid grid-cols-3 gap-2 mb-6 h-64 rounded-xl overflow-hidden">
          <div className="col-span-2 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
            <Car className="w-28 h-28 text-slate-400" />
          </div>
          <div className="space-y-2">
            <div className="h-[calc(50%-4px)] bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center rounded-tr-xl">
              <Car className="w-10 h-10 text-slate-400" />
            </div>
            <div className="h-[calc(50%-4px)] bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center rounded-br-xl">
              <Car className="w-10 h-10 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle Info */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#082c59]/5 to-slate-100 p-5 border-b border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="capitalize mb-2 bg-[#082c59]">{vehicle.type}</Badge>
                    <h1 className="text-2xl font-bold text-[#082c59]">{vehicle.name}</h1>
                    <p className="text-slate-600 text-sm">{vehicle.brand} {vehicle.model} · {vehicle.year}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                      <span className="text-lg font-bold">{vehicle.rating}</span>
                      <span className="text-xs text-slate-500">({vehicle.reviews_count})</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <p className="text-slate-600 text-sm mb-4">{vehicle.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Users className="w-5 h-5 mx-auto text-[#082c59] mb-1" />
                    <div className="font-bold text-sm">{vehicle.seats}</div>
                    <div className="text-[10px] text-slate-500">Seats</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Settings className="w-5 h-5 mx-auto text-[#082c59] mb-1" />
                    <div className="font-bold text-sm capitalize">{vehicle.transmission}</div>
                    <div className="text-[10px] text-slate-500">Transmission</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Fuel className="w-5 h-5 mx-auto text-[#082c59] mb-1" />
                    <div className="font-bold text-sm capitalize">{vehicle.fuel_type}</div>
                    <div className="text-[10px] text-slate-500">{vehicle.fuel_consumption}</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Car className="w-5 h-5 mx-auto text-[#082c59] mb-1" />
                    <div className="font-bold text-sm">{vehicle.doors}</div>
                    <div className="text-[10px] text-slate-500">Doors</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="features" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-[#082c59]/5 border border-slate-200 rounded-xl">
                <TabsTrigger value="features" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Features</TabsTrigger>
                <TabsTrigger value="policies" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Policies</TabsTrigger>
                <TabsTrigger value="owner" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Owner</TabsTrigger>
              </TabsList>
              
              <TabsContent value="features" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {vehicle.features?.map(feature => (
                      <div key={feature} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-sm">{FEATURE_LABELS[feature] || feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="policies" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="space-y-3">
                    {vehicle.policies?.map((policy, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-lg">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{policy}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="owner" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-[#082c59]/5 rounded-full flex items-center justify-center border border-slate-200">
                      <Car className="w-7 h-7 text-[#082c59]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{vehicle.owner?.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{vehicle.owner?.rating} rating</span>
                        <span>·</span>
                        <span>Responds {vehicle.owner?.response_time}</span>
                      </div>
                      {vehicle.owner?.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                          <Phone className="w-3.5 h-3.5" /> {vehicle.owner.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#082c59] to-[#0a4a8f] p-5 text-center">
                <div className="text-3xl font-bold text-white">{formatFCFA(vehicle.price_per_day)}</div>
                <span className="text-white/70 text-sm">per day</span>
              </div>

              <div className="p-5 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {/* Pickup Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pickup Date</label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start mt-1.5 bg-white border-slate-200 rounded-xl hover:bg-[#082c59]/5"
                    onClick={() => setIsPickupDateOpen(true)}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2 text-[#082c59]" />
                    {format(selectedDates.pickup, 'PPP')}
                  </Button>
                  <DatePickerModal
                    isOpen={isPickupDateOpen}
                    onClose={() => setIsPickupDateOpen(false)}
                    onSelect={(d) => setSelectedDates(p => ({ ...p, pickup: d }))}
                    selectedDate={selectedDates.pickup}
                    title="Select Pickup Date"
                    minDate={new Date()}
                  />
                </div>

                {/* Return Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Return Date</label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start mt-1.5 bg-white border-slate-200 rounded-xl hover:bg-[#082c59]/5"
                    onClick={() => setIsReturnDateOpen(true)}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2 text-[#082c59]" />
                    {format(selectedDates.return, 'PPP')}
                  </Button>
                  <DatePickerModal
                    isOpen={isReturnDateOpen}
                    onClose={() => setIsReturnDateOpen(false)}
                    onSelect={(d) => setSelectedDates(p => ({ ...p, return: d }))}
                    selectedDate={selectedDates.return}
                    title="Select Return Date"
                    minDate={selectedDates.pickup}
                  />
                </div>

                {/* Pickup Location */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pickup Location</label>
                  <select className="w-full border border-slate-200 rounded-xl p-2.5 mt-1.5 bg-white text-sm">
                    {vehicle.pickup_locations?.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{formatFCFA(vehicle.price_per_day)} x {days} day{days > 1 ? 's' : ''}</span>
                    <span className="font-medium">{formatFCFA(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Insurance</span>
                    <span className="text-emerald-600 font-medium">Included</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span className="text-[#082c59]">{formatFCFA(totalPrice)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 rounded-xl font-bold text-base" onClick={handleBook}>
                    Final Step
                  </Button>
                  <p className="text-center text-xs text-slate-500">You will not be charged yet</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 justify-center pt-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Free cancellation up to 24h before</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
