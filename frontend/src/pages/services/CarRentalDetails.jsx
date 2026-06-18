import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import DatePickerModal from '@/components/shared/DatePickerModal';
import LocationMap from '@/components/shared/LocationMap';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, Car, MapPin, Users, Fuel, Settings,
  Star, CalendarIcon, Shield, CheckCircle, Phone,
  Snowflake, Radio, Navigation, Info, AlertTriangle, MessageSquare, ChevronDown,
  X as XIcon, ChevronLeft, ChevronRight
} from 'lucide-react';

// Hoisted out of the render tree to avoid React remounting on every parent
// re-render (react/no-unstable-nested-components).
const GalleryThumb = ({ src, alt, idx, hasImages, onOpen, extraClass = '' }) => (
  <button
    type="button"
    onClick={() => hasImages && onOpen(idx)}
    className={`group relative w-full h-full overflow-hidden ${extraClass}`}
    data-testid={`car-rental-image-${idx}`}
  >
    <img src={src} alt={alt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
    {hasImages && (
      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
    )}
  </button>
);
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

export default function CarRentalDetails({ vehicleId: idProp, open: openProp, onClose, embedded = false, pickupDate: pickupDateProp, returnDate: returnDateProp } = {}) {
  const params = useParams();
  const id = idProp || params.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ average: 0, total: 0 });
  const [activeTab, setActiveTab] = useState('features');
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [operator, setOperator] = useState(null);
  // Lightbox state for the image gallery — clicking any image expands it
  // full-screen with arrow navigation and ESC-to-close.
  const [lightboxIdx, setLightboxIdx] = useState(null);
  // Description "Read more" toggle — clamps long copy to roughly 15 lines
  // (320px @ leading-relaxed) before offering the expand control.
  const [descExpanded, setDescExpanded] = useState(false);
  // Pickup / return dates flow in from three places (in priority order):
  //   1. explicit props (when embedded from CarRentalResults — best)
  //   2. URL search params (deep-link via the dedicated route)
  //   3. sane defaults (today / +3 days)
  // Before iter 252 the modal only read the URL params, so when opened
  // inline from the results page it always fell back to today/+3 and the
  // right-rail price was computed for the wrong window.
  const _parseDate = (v) => (v ? new Date(v) : null);
  const [selectedDates, setSelectedDates] = useState({
    pickup: _parseDate(pickupDateProp)
      || _parseDate(searchParams.get('pickupDate'))
      || new Date(),
    return: _parseDate(returnDateProp)
      || _parseDate(searchParams.get('returnDate'))
      || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
  const [isPickupDateOpen, setIsPickupDateOpen] = useState(false);
  const [isReturnDateOpen, setIsReturnDateOpen] = useState(false);

  // Keep local dates in sync whenever the parent passes new ones (e.g. the
  // user reopens the modal after editing search dates on the results page).
  useEffect(() => {
    if (!embedded) return;
    setSelectedDates({
      pickup: _parseDate(pickupDateProp) || new Date(),
      return: _parseDate(returnDateProp) || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
  }, [embedded, pickupDateProp, returnDateProp]);

  // When used as a route (deep link), the modal is always "open" until the
  // user dismisses it via the X / back button. When embedded inline from
  // CarRentalResults, the parent controls open/close via props.
  const isOpen = embedded ? !!openProp : true;
  const closeModal = () => {
    if (embedded) onClose?.();
    else navigate(-1);
  };

  useEffect(() => {
    if (!id) return;
    loadVehicle();
    loadReviews();
    loadOperator();
  }, [id]);

  // Lightbox keyboard handling — ESC closes, arrows navigate.
  useEffect(() => {
    if (lightboxIdx === null) return;
    const imgs = vehicle?.images || [];
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i - 1 + imgs.length) % imgs.length);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i + 1) % imgs.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxIdx, vehicle]);

  const loadOperator = async () => {
    try {
      // Wait a tick for the vehicle to set so we know which operator
      const res = await api.get(`/car-rental/${id}`);
      const opId = res.data?.operator_id;
      if (!opId) return;
      const op = await api.get(`/operators/${opId}`);
      setOperator(op.data || null);
    } catch (_) { /* best-effort */ }
  };

  const loadVehicle = async () => {
    try {
      setLoading(true);
      // Primary: car-rental endpoint. Fallback: legacy /vehicles endpoint.
      let res;
      try {
        res = await api.get(`/car-rental/${id}`);
      } catch (_) {
        res = await api.get(`/vehicles/${id}`);
      }
      // Normalise the shape so the UI works for either backend.
      const raw = res.data || {};
      // Coalesce a location object from any of the schemas we've seen.
      const locFromRaw = raw.location
        || (raw.latitude && raw.longitude ? { lat: raw.latitude, lon: raw.longitude } : null)
        || (raw.lat && raw.lon ? { lat: raw.lat, lon: raw.lon } : null)
        || (raw.pickup_lat && raw.pickup_lon ? { lat: raw.pickup_lat, lon: raw.pickup_lon } : null);
      // City-centre fallback for the most common pickup cities — keeps the map
      // populated even when the operator hasn't supplied explicit coordinates.
      const CITY_FALLBACK = {
        douala: { lat: 4.0511, lon: 9.7679 },
        yaoundé: { lat: 3.848, lon: 11.5021 },
        yaounde: { lat: 3.848, lon: 11.5021 },
        bafoussam: { lat: 5.4781, lon: 10.4179 },
      };
      const cityKey = String(raw.city || raw.pickup_city || '').trim().toLowerCase();
      const finalLoc = locFromRaw || CITY_FALLBACK[cityKey] || null;

      const normalised = {
        ...raw,
        id: raw.id || raw._id || id,
        name: raw.name || `${raw.make || ''} ${raw.model || ''}`.trim() || raw.vehicle_name || 'Vehicle',
        brand: raw.brand || raw.make,
        model: raw.model,
        type: raw.type || raw.vehicle_type,
        rating: raw.rating ?? raw.average_rating ?? 0,
        reviews_count: raw.reviews_count ?? raw.total_ratings ?? 0,
        location: finalLoc ? { ...finalLoc, address: finalLoc.address || raw.address || raw.city || raw.pickup_locations?.[0] } : null,
        owner: raw.owner || {
          name: raw.operator_name,
          rating: raw.operator_rating,
          phone: raw.operator_phone,
          response_time: raw.operator_response_time || '< 1 hour',
        },
      };
      setVehicle(normalised);
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
        rating: 0,
        trips: 34,
        reviews_count: 0,
        description: 'Experience luxury and comfort with the Mercedes C-Class. Perfect for business trips or special occasions.',
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
        location: { lat: 3.848, lon: 11.5021, address: 'Yaoundé Centre' },
        owner: {
          name: 'Premium Auto Rentals',
          rating: 0,
          phone: '+237 699 123 456',
          response_time: '< 1 hour'
        },
        images: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const res = await api.get('/ratings', {
        params: { entity_type: 'car_rental', entity_id: id, limit: 20 },
      });
      const data = res.data || {};
      const list = data.ratings || [];
      setReviews(list);
      const total = data.total ?? list.length;
      const avg = list.length
        ? list.reduce((acc, r) => acc + (r.rating || 0), 0) / list.length
        : 0;
      setReviewStats({ average: Number(avg.toFixed(1)), total });
    } catch (error) {
      // Ratings are best-effort. Leave defaults (0/0).
      setReviews([]);
      setReviewStats({ average: 0, total: 0 });
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
      <Dialog open={isOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="max-w-5xl bg-white p-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59]"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!vehicle) {
    return (
      <Dialog open={isOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="max-w-md bg-white p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Vehicle not found</h2>
          <Button onClick={closeModal}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && closeModal()}>
      <DialogContent className="max-w-6xl bg-white p-0 max-h-[94vh] overflow-y-auto" data-testid="car-rental-details-modal">
      {/* Visually-hidden title — Radix requires a DialogTitle for screen readers
          even though our visual header carries the brand + close button. */}
      <DialogTitle className="sr-only">{vehicle.name} — Vehicle Details</DialogTitle>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center">
          <Button variant="ghost" onClick={closeModal} data-testid="car-rental-details-close">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Image Gallery — every tile is clickable; opens a full-screen
            lightbox with arrow navigation. */}
        {(() => {
          const imgs = (vehicle.images && vehicle.images.length > 0)
            ? vehicle.images
            : [];
          const fallback = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1600';
          const display = imgs.length ? imgs : [fallback];
          const main = display[0];
          const a = display[1] || display[0];
          const b = display[2] || display[1] || display[0];
          const hasImages = imgs.length > 0;
          return (
            <div className="grid grid-cols-3 gap-2 mb-6 h-64 rounded-xl overflow-hidden" data-testid="car-rental-images">
              <div className="col-span-2 bg-slate-100 relative">
                <GalleryThumb src={main} idx={0} alt={vehicle.name} hasImages={hasImages} onOpen={setLightboxIdx} />
              </div>
              <div className="grid grid-rows-2 gap-2">
                <div className="bg-slate-100 rounded-tr-xl overflow-hidden">
                  <GalleryThumb src={a} idx={Math.min(1, imgs.length - 1)} alt={`${vehicle.name} 2`} hasImages={hasImages} onOpen={setLightboxIdx} />
                </div>
                <div className="bg-slate-100 rounded-br-xl overflow-hidden">
                  <GalleryThumb src={b} idx={Math.min(2, imgs.length - 1)} alt={`${vehicle.name} 3`} hasImages={hasImages} onOpen={setLightboxIdx} />
                </div>
              </div>
            </div>
          );
        })()}

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
                      <Star className={`w-5 h-5 ${reviewStats.total > 0 ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                      <span className="text-lg font-bold">
                        {reviewStats.total > 0 ? reviewStats.average.toFixed(1) : '—'}
                      </span>
                      <span className="text-xs text-slate-500">({reviewStats.total})</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                {vehicle.description && (
                  <div className="mb-4" data-testid="car-rental-description">
                    {/* Render the description as paragraphs split on blank
                        lines. Long copy is clamped to ~15 lines until the
                        user expands it, so the modal never becomes a wall
                        of text on first view. */}
                    <div
                      className={cn(
                        'text-slate-700 text-sm space-y-3 leading-relaxed overflow-hidden transition-[max-height] duration-300',
                        descExpanded ? 'max-h-[2000px]' : 'max-h-[20rem]',
                      )}
                    >
                      {String(vehicle.description)
                        .split(/\n{2,}/)
                        .map((para, i) => (
                          <p key={i} className="whitespace-pre-line">{para.trim()}</p>
                        ))}
                    </div>
                    {/* Only render the toggle when there is something to
                        hide (rough heuristic: > 600 chars or 5+ paragraphs).
                        Avoids a misleading "Read more" on tiny blurbs. */}
                    {(vehicle.description.length > 600
                      || vehicle.description.split(/\n{2,}/).length > 4) && (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((v) => !v)}
                        className="mt-2 inline-flex items-center gap-1 text-[#082c59] font-semibold text-xs hover:underline"
                        data-testid="car-rental-description-toggle"
                      >
                        {descExpanded ? 'Read less' : 'Read more'}
                        <ChevronDown
                          className={cn(
                            'w-3.5 h-3.5 transition-transform',
                            descExpanded && 'rotate-180',
                          )}
                        />
                      </button>
                    )}
                  </div>
                )}
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
            <Tabs defaultValue="features" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-[#082c59]/5 border border-slate-200 rounded-xl">
                <TabsTrigger value="features" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Features</TabsTrigger>
                <TabsTrigger value="policies" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Policies</TabsTrigger>
                <TabsTrigger value="owner" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Owner</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFeaturesOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition-colors"
                    data-testid="car-features-toggle"
                    aria-expanded={featuresOpen}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#082c59]" />
                      <span className="text-sm font-bold text-slate-700">Vehicle features</span>
                      <span className="text-[11px] text-slate-500">· {(vehicle.features || []).length} included</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${featuresOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {featuresOpen && (
                    <div className="p-4 border-t border-slate-200 flex flex-wrap gap-2" data-testid="car-features-panel">
                      {(vehicle.features || []).length === 0 && (
                        <p className="text-xs text-slate-500">No features listed by the operator.</p>
                      )}
                      {vehicle.features?.map(feature => (
                        <span key={feature} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700 capitalize">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          {FEATURE_LABELS[feature] || feature.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="policies" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5" data-testid="car-policies-content">
                  {(vehicle.policies || []).length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No policies have been set by this operator yet.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {vehicle.policies.map((policy, i) => (
                        <li key={i} className="flex items-start gap-3 p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-sm text-slate-700">{policy}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="owner" className="mt-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5" data-testid="car-owner-content">
                  <div className="flex items-start gap-4">
                    {operator?.logo_url ? (
                      <img src={operator.logo_url} alt={operator.name} className="w-16 h-16 rounded-full object-cover border border-slate-200 bg-white shrink-0" />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-[#082c59]/10 to-blue-100 rounded-full flex items-center justify-center border border-slate-200 shrink-0">
                        <Car className="w-8 h-8 text-[#082c59]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900">{operator?.name || vehicle.operator_name || 'Operator'}</h3>
                      {operator?.tagline && <p className="text-xs text-slate-500 mt-0.5">{operator.tagline}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-2">
                        {operator?.created_at && (
                          <span className="inline-flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            Member since {(() => {
                              try { return format(new Date(operator.created_at), 'MMM yyyy'); } catch (_) { return ''; }
                            })()}
                          </span>
                        )}
                        {reviewStats.total > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {reviewStats.average.toFixed(1)} · {reviewStats.total} reviews
                          </span>
                        )}
                        {(operator?.phone || vehicle.owner?.phone) && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {operator?.phone || vehicle.owner?.phone}
                          </span>
                        )}
                      </div>
                      {operator?.address && (
                        <p className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {operator.address}
                        </p>
                      )}
                      {operator?.description && (
                        <p className="text-sm text-slate-600 mt-3 leading-relaxed">{operator.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Pickup Location Map — only on the Features tab */}
            {activeTab === 'features' && (
              <LocationMap
                lat={vehicle.location?.lat}
                lon={vehicle.location?.lon}
                title={vehicle.name}
                address={vehicle.location?.address || vehicle.pickup_locations?.[0] || vehicle.city}
                showHeader
                headerLabel="Pickup location"
                height="h-44"
                className=""
              />
            )}

            {/* Customer Reviews */}
            <div id="reviews" className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#082c59]" />
                    Customer reviews
                  </h3>
                  {reviewStats.total > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#082c59] text-white text-base px-3 py-1">
                        {reviewStats.average.toFixed(1)}
                      </Badge>
                      <span className="text-sm text-slate-500">{reviewStats.total} review{reviewStats.total !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {reviews.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Star className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No reviews yet. Be the first to rent and review this vehicle.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 6).map((review, idx) => (
                      <div key={review.id || idx} className="border-b border-slate-100 last:border-b-0 pb-4 last:pb-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-[#082c59]/10 flex items-center justify-center text-[#082c59] font-semibold text-sm">
                              {(review.user_name || review.reviewer_name || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {review.user_name || review.reviewer_name || 'Verified Customer'}
                              </p>
                              {review.created_at && (
                                <p className="text-[11px] text-slate-500">
                                  {(() => {
                                    try { return formatDistanceToNow(new Date(review.created_at), { addSuffix: true }); }
                                    catch (_) { return ''; }
                                  })()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star
                                key={n}
                                className={`w-3.5 h-3.5 ${n <= (review.rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`}
                              />
                            ))}
                          </div>
                        </div>
                        {(review.review || review.comment) && (
                          <p className="text-sm text-slate-600 leading-relaxed pl-11">
                            {review.review || review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                    {reviewStats.total > 6 && (
                      <p className="text-center text-sm text-slate-500 pt-2">
                        Showing 6 of {reviewStats.total} reviews
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
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

                {/* Pickup Location — prefilled with the operator's recorded pickup_address */}
                <div data-testid="car-rental-pickup-section">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pickup Location</label>
                  {vehicle.pickup_address ? (
                    <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-3 mt-1.5">
                      <p className="text-sm font-semibold text-blue-900 flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                        {vehicle.pickup_address}
                      </p>
                      {vehicle.pickup_locations?.length > 1 && (
                        <select className="mt-2 w-full border border-blue-200 rounded-lg p-2 bg-white text-xs">
                          <option value="">Or change pickup point...</option>
                          {vehicle.pickup_locations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : vehicle.pickup_locations?.length > 0 ? (
                    <select className="w-full border border-slate-200 rounded-xl p-2.5 mt-1.5 bg-white text-sm">
                      {vehicle.pickup_locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      Pickup details will be confirmed by the operator after booking.
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{formatFCFA(vehicle.price_per_day)} x {days} day{days > 1 ? 's' : ''}</span>
                    <span className="font-medium">{formatFCFA(totalPrice)}</span>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox — opens when any gallery tile is clicked */}
      {lightboxIdx !== null && vehicle.images?.length > 0 && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
          data-testid="car-rental-lightbox"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close"
          >
            <XIcon className="w-6 h-6" />
          </button>
          {vehicle.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i - 1 + vehicle.images.length) % vehicle.images.length);
                }}
                className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i + 1) % vehicle.images.length);
                }}
                className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={vehicle.images[lightboxIdx]}
            alt={`${vehicle.name} ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full">
            {lightboxIdx + 1} / {vehicle.images.length}
          </div>
        </div>
      )}
      </DialogContent>
    </Dialog>
  );
}
