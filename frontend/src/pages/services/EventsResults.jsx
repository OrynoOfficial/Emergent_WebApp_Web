import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SmartSearchBar from '@/components/search/SmartSearchBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, Clock, Users, Ticket, Search, Star, Loader2, LayoutGrid, List, SlidersHorizontal, Music, Trophy, Laugh, Briefcase, PartyPopper, AlertCircle, Building2, Eye } from 'lucide-react';
import { eventsApi } from '@/api/services';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { isPast } from '@/utils/dateUtils';
import EventPreviewModal from './EventsResults/EventPreviewModal';

const EVENT_TYPE_COLORS = {
  'Concert': 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
  'Sports': 'bg-gradient-to-r from-green-500 to-green-600 text-white',
  'Comedy': 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
  'Conference': 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
  'Party': 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
};

const getEventIcon = (type) => {
  switch (type?.toLowerCase()) {
    case 'concert': return Music;
    case 'sports': return Trophy;
    case 'comedy': return Laugh;
    case 'conference': return Briefcase;
    case 'party': return PartyPopper;
    default: return Ticket;
  }
};

// Grid View Event Card — rich, info-dense card with venue, organiser, doors,
// availability chip and class price range. Click anywhere → opens the
// EventPreviewModal (the modal then pivots to the booking page).
const EventCardGrid = ({ event: rawEvent, onBook, isFav, toggleFav }) => {
  const event = {
    ...rawEvent,
    type: rawEvent.type || rawEvent.event_type,
    venue: rawEvent.venue || rawEvent.venue_name || rawEvent.location_name,
    date: rawEvent.date || rawEvent.start_date || rawEvent.event_date,
    time: rawEvent.time || rawEvent.doors_open || rawEvent.start_time,
    priceFrom: rawEvent.priceFrom || rawEvent.ticket_price || (rawEvent.ticket_types?.[0]?.price) || 0,
    ticketsLeft: rawEvent.ticketsLeft ?? (rawEvent.total_capacity != null ? Math.max(0, (rawEvent.total_capacity || 0) - (rawEvent.tickets_sold || 0)) : (rawEvent.available_seats ?? 999)),
    image: rawEvent.poster_url || rawEvent.image || rawEvent.cover_image || rawEvent.images?.[0] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    rating: rawEvent.rating || 4.5,
    contact_email: rawEvent.contact_email,
    contact_phone: rawEvent.contact_phone,
  };
  const EventIcon = getEventIcon(event.type);
  const isEventPast = isPast(event.date, event.time);
  const classCount = (rawEvent.classes || []).length;
  const totalCapacity = rawEvent.total_capacity ?? 0;
  const soldOutPct = totalCapacity > 0
    ? Math.min(100, Math.round(((totalCapacity - event.ticketsLeft) / totalCapacity) * 100))
    : 0;

  return (
    <Card
      className={`group overflow-hidden bg-white rounded-2xl border border-pink-100 shadow-md transition-all duration-300 ${
        isEventPast ? 'cursor-not-allowed' : 'hover:shadow-2xl hover:border-pink-300 hover:-translate-y-1 cursor-pointer'
      }`}
      style={isEventPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
      onClick={() => !isEventPast && onBook(event)}
      data-testid={`event-card-grid-${event._id || event.id}`}
    >
      {/* Image */}
      <div className="h-48 relative overflow-hidden">
        <img
          src={event.image}
          alt={event.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${!isEventPast && 'group-hover:scale-105'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {!isEventPast && (
          <div className="absolute top-3 right-3 z-10 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <SubscribeButton operatorId={event.operator_id} operatorName={event.operator_name} variant="icon" />
            <FavouriteButton
              isFavourite={!!(isFav && isFav(event._id || event.id))}
              onToggle={() => toggleFav && toggleFav(event)}
              testId={`favourite-${event._id || event.id}`}
              className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
              emptyClass="text-white"
            />
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          {event.type && (
            <Badge className={`${isEventPast ? 'bg-slate-500' : EVENT_TYPE_COLORS[event.type] || 'bg-pink-600'}`}>
              <EventIcon className="w-3 h-3 mr-1" />
              {event.type}
            </Badge>
          )}
          {isEventPast && (
            <Badge className="bg-slate-700 text-white">
              <AlertCircle className="w-3 h-3 mr-1" /> Past Event
            </Badge>
          )}
        </div>

        <div className={`absolute bottom-3 left-3 flex items-center gap-1 text-white text-xs px-2 py-1 rounded-full ${isEventPast ? 'bg-slate-500/60' : 'bg-black/60'}`}>
          <Star className={`w-3 h-3 ${isEventPast ? 'text-slate-300' : 'text-yellow-400 fill-yellow-400'}`} />
          {event.rating}
        </div>

        {!isEventPast && (
          <div className="absolute bottom-3 right-3" data-testid={`event-fomo-grid-${event._id || event.id}`}>
            <AlmostSoldOutBadge count={event.ticketsLeft} unit="tickets" />
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <h3 className={`font-bold text-base mb-2 line-clamp-2 ${isEventPast ? 'text-slate-400' : 'text-slate-900'}`}>{event.name}</h3>

        {/* Quick facts */}
        <div className="space-y-1.5 text-xs text-slate-600 mb-3">
          <div className="flex items-center gap-1.5">
            <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
            <span className="truncate">{event.venue}{event.city ? `, ${event.city}` : ''}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar className={`w-3.5 h-3.5 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
              <span className="font-medium">{event.date ? format(new Date(event.date), 'MMM dd, yyyy') : 'TBD'}</span>
            </div>
            {event.time && (
              <div className="flex items-center gap-1">
                <Clock className={`w-3.5 h-3.5 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
                <span>{event.time}</span>
              </div>
            )}
          </div>
          {rawEvent.operator_name && (
            <div className="flex items-center gap-1.5 text-slate-500 pt-0.5">
              {rawEvent.operator_logo_url ? (
                <img src={rawEvent.operator_logo_url} alt={rawEvent.operator_name} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-pink-400" />
              )}
              <span className="truncate text-[11px]">{rawEvent.operator_name}</span>
            </div>
          )}
        </div>

        {/* Class badges (showtime) */}
        {classCount > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {(rawEvent.classes || []).slice(0, 3).map((c) => (
              <Badge
                key={c.id}
                variant="outline"
                className="text-[10px] border bg-white"
                style={{ borderColor: c.color, color: c.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ background: c.color }} />
                {c.name}
              </Badge>
            ))}
            {classCount > 3 && <Badge variant="outline" className="text-[10px] bg-white text-slate-500">+{classCount - 3}</Badge>}
          </div>
        )}

        {/* Capacity bar */}
        {totalCapacity > 0 && !isEventPast && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
              <span>{event.ticketsLeft} of {totalCapacity} available</span>
              {soldOutPct >= 80 && <span className="text-orange-600 font-semibold">Filling fast</span>}
            </div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${soldOutPct >= 80 ? 'bg-orange-500' : soldOutPct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${soldOutPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">From</div>
            <div className={`text-xl font-bold ${isEventPast ? 'text-slate-400' : 'text-pink-600'}`}>{formatFCFA(event.priceFrom)}</div>
          </div>
          {isEventPast ? (
            <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl">
              <AlertCircle className="w-4 h-4 mr-2" /> Ended
            </Button>
          ) : (
            <Button onClick={(e) => { e.stopPropagation(); onBook(event); }} className="bg-pink-600 hover:bg-pink-700 rounded-xl shadow shadow-pink-500/30" data-testid={`view-details-grid-${event._id || event.id}`}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// List View Event Card
const EventCardList = ({ event: rawEvent, onBook, isFav, toggleFav }) => {
  const event = {
    ...rawEvent,
    type: rawEvent.type || rawEvent.event_type,
    venue: rawEvent.venue || rawEvent.venue_name,
    date: rawEvent.date || rawEvent.start_date || rawEvent.event_date,
    time: rawEvent.time || rawEvent.doors_open || rawEvent.start_time,
    priceFrom: rawEvent.priceFrom || rawEvent.ticket_price || (rawEvent.ticket_types?.[0]?.price) || 0,
    ticketsLeft: rawEvent.ticketsLeft ?? (rawEvent.total_capacity != null ? Math.max(0, (rawEvent.total_capacity || 0) - (rawEvent.tickets_sold || 0)) : (rawEvent.available_seats ?? 999)),
    image: rawEvent.poster_url || rawEvent.image || rawEvent.cover_image || rawEvent.images?.[0] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    rating: rawEvent.rating || 4.5,
  };
  const EventIcon = getEventIcon(event.type);
  const isEventPast = isPast(event.date, event.time);
  
  return (
    <Card 
      className={`overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all ${
        isEventPast ? 'cursor-not-allowed' : 'hover:shadow-xl'
      }`}
      style={isEventPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-1/3 h-48 md:h-auto relative">
          <img src={event.image} alt={event.name} className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className={`${isEventPast ? 'bg-slate-500' : EVENT_TYPE_COLORS[event.type] || 'bg-pink-600'}`}>
              <EventIcon className="w-3 h-3 mr-1" />
              {event.type}
            </Badge>
            {isEventPast && (
              <Badge className="bg-slate-700 text-white">
                <AlertCircle className="w-3 h-3 mr-1" /> Past Event
              </Badge>
            )}
          </div>
        </div>
        
        {/* Details */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className={`text-xl font-bold mb-1 ${isEventPast ? 'text-slate-400' : 'text-gray-900'}`}>{event.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" /> {event.venue}, {event.city}
                <Star className={`w-4 h-4 ml-2 ${isEventPast ? 'text-slate-300' : 'text-yellow-400 fill-yellow-400'}`} /> {event.rating}
              </div>
            </div>
            {!isEventPast && (
              <div data-testid={`event-fomo-list-${event._id || event.id}`}>
                <AlmostSoldOutBadge count={event.ticketsLeft} unit="tickets" />
              </div>
            )}
          </div>
          
          <p className="text-slate-600 mb-4 line-clamp-2">{event.description}</p>
          
          <div className="grid grid-cols-3 gap-4 my-4">
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium">{format(new Date(event.date), 'MMM dd, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="font-medium">{event.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className={`w-5 h-5 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
              <div>
                <p className="text-xs text-gray-500">Available</p>
                <p className="font-medium">{isEventPast ? 'Ended' : `${event.ticketsLeft} tickets`}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <span className="text-sm text-gray-500">From</span>
              <span className={`text-2xl font-bold ml-2 ${isEventPast ? 'text-slate-400' : 'text-pink-600'}`}>{formatFCFA(event.priceFrom)}</span>
            </div>
            {isEventPast ? (
              <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl">
                <AlertCircle className="w-4 h-4 mr-2" /> Ended
              </Button>
            ) : (
              <Button onClick={() => onBook(event)} className="bg-pink-600 hover:bg-pink-700 rounded-xl" data-testid={`view-details-list-${event._id || event.id}`}>
                <Ticket className="w-4 h-4 mr-2" /> View Details
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function EventsResults() {

  const { isFav, toggleFav } = useFavourites('events');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [smartFilters, setSmartFilters] = useState({ places: new Set(), operators: new Set(), listings: new Set() });
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewEvent, setPreviewEvent] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // iter 252: when the user supplies a date on the events landing page, the
  // results page defaults to "±3 days around your date" but offers a toggle
  // to widen the window to "all future dates". When no date is supplied
  // (legacy deep link) we treat everything as `future`.
  const [dateWindow, setDateWindow] = useState('around');

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || '';

  useEffect(() => {
    loadEvents();
  }, [searchParams]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Showtimes are now the *only* source for the customer-facing events
      // results page. The legacy `events` collection was retired alongside the
      // legacy management subpage; we no longer query it.
      // iter 246: explicitly pin `status=published` so admins/operators browsing
      // the customer search don't accidentally see cancelled/draft showtimes
      // (the backend only auto-restricts for anonymous + customer roles).
      const res = await api
        .get('/event-showtimes/', { params: { upcoming_only: true, status: 'published', ...(city ? { city } : {}) } })
        .catch(() => ({ data: { showtimes: [] } }));

      // Normalise showtimes into the same card shape EventsResults already
      // renders. `_showtime: true` flags routing to /services/showtimes/:id.
      const normalisedShowtimes = (res.data.showtimes || []).map(s => {
        const minPrice = (s.classes || []).reduce((m, c) => (c.price < m ? c.price : m), Infinity);
        const totalAvail = (s.classes || []).reduce((sum, c) => sum + (c.available_units || 0), 0);
        const totalCap = (s.classes || []).reduce((sum, c) => sum + (c.total_units || 0), 0);
        return {
          ...s,
          _showtime: true,
          id: s.id || s._id,
          name: s.title,
          venue: s.location_name,
          city: city || s.location_city || '',
          date: s.start_datetime ? s.start_datetime.split('T')[0] : '',
          time: s.start_datetime ? s.start_datetime.split('T')[1]?.slice(0, 5) : '',
          type: s.event_type,
          priceFrom: minPrice === Infinity ? 0 : minPrice,
          ticketsLeft: totalAvail,
          total_capacity: totalCap,
          tickets_sold: totalCap - totalAvail,
          // Use the showtime's poster first, fall back to gallery, then a default.
          image: s.poster_url || (s.images || [])[0],
          operator_id: s.operator_id,
          operator_name: s.operator_name,
        };
      });

      setEvents(normalisedShowtimes);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // iter 247: chip-style filters (place / operator / listing).
    const { places, operators, listings } = smartFilters;
    if (places.size) filtered = filtered.filter(e => places.has((e.city || '').trim()));
    if (operators.size) filtered = filtered.filter(e => operators.has((e.operator_name || '').trim()));
    if (listings.size) filtered = filtered.filter(e => listings.has((e.name || '').trim()));

    if (typeFilter !== 'all') {
      filtered = filtered.filter(e => e.type?.toLowerCase() === typeFilter.toLowerCase());
    }

    // iter 252: date window. `around` keeps only events that fall within
    // ±3 days of the user-picked date; `future` widens to anything from the
    // picked date onwards (so users can browse upcoming weeks even if their
    // first-pick day has nothing on).
    if (date) {
      const picked = new Date(date);
      picked.setHours(0, 0, 0, 0);
      filtered = filtered.filter(e => {
        if (!e.date) return false;
        const ed = new Date(e.date);
        ed.setHours(0, 0, 0, 0);
        if (dateWindow === 'future') return ed >= picked;
        const diffDays = Math.abs((ed - picked) / 86400000);
        return diffDays <= 3;
      });
    }

    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) => a.priceFrom - b.priceFrom);
      case 'price_high':
        return filtered.sort((a, b) => b.priceFrom - a.priceFrom);
      case 'rating':
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'date':
      default:
        return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  }, [events, sortBy, smartFilters, typeFilter, date, dateWindow]);

  const handleBook = (event) => {
    // ALL clicks open the rich preview modal first; the modal's "Book Now"
    // CTA pivots to the real booking page (showtime detail or legacy booking).
    if (isPast(event.date, event.time)) return;
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-pink-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding events for you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50/30 pb-12">
      {/* Sticky header — banquet-style hero with the pink/rose events palette */}
      <div className="bg-white border-b border-pink-100 shadow-sm sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/events')} className="gap-2 text-pink-700 hover:bg-pink-50" data-testid="events-back-btn">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>

          {/* Hero — pink/rose gradient (events color, mirrors banquet teal hero) */}
          <Card className="shadow-sm bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 text-white mb-4 border-transparent" data-testid="events-search-hero">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <PartyPopper className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold truncate">Events {city && `in ${city}`}</h2>
                    <div className="flex items-center gap-2 text-white/85 text-sm mt-0.5 flex-wrap">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} found</span>
                      {typeFilter !== 'all' && <Badge className="bg-white/20 text-white border-white/30 text-[10px] capitalize">{typeFilter}</Badge>}
                      {date && <Badge className="bg-white/20 text-white border-white/30 text-[10px]"><Calendar className="w-3 h-3 mr-1" />{date}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Date window toggle — only meaningful when the user
                      supplied a date on the landing search. */}
                  {date && (
                    <div className="flex items-center bg-white/15 rounded-lg p-0.5" data-testid="events-date-window-toggle">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setDateWindow('around')}
                        className={`text-white hover:bg-white/20 h-8 px-2.5 text-[11px] font-semibold ${dateWindow === 'around' ? 'bg-white/25' : ''}`}
                        data-testid="events-window-around"
                      >± 3 days</Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setDateWindow('future')}
                        className={`text-white hover:bg-white/20 h-8 px-2.5 text-[11px] font-semibold ${dateWindow === 'future' ? 'bg-white/25' : ''}`}
                        data-testid="events-window-future"
                      >Future</Button>
                    </div>
                  )}
                  <div className="flex items-center bg-white/15 rounded-lg p-0.5">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setViewMode('grid')}
                      className={`text-white hover:bg-white/20 h-8 px-2 ${viewMode === 'grid' ? 'bg-white/25' : ''}`}
                      data-testid="view-grid-btn"
                    ><LayoutGrid className="w-4 h-4" /></Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setViewMode('list')}
                      className={`text-white hover:bg-white/20 h-8 px-2 ${viewMode === 'list' ? 'bg-white/25' : ''}`}
                      data-testid="view-list-btn"
                    ><List className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters strip — chip omnibar replaces the misleading free-text + city dropdown */}
          <SmartSearchBar
            items={events}
            listingIcon={Ticket}
            listingLabel="Event"
            placeholder="Filter by city, operator, or event name…"
            getName={(e) => e.name}
            getCity={(e) => e.city}
            getOperator={(e) => e.operator_name}
            onFiltersChange={setSmartFilters}
          >
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-white border-pink-200" data-testid="events-type-filter">
                <Ticket className="w-4 h-4 mr-2 text-pink-600" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="concert">Concert</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="comedy">Comedy</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
                <SelectItem value="party">Party</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white border-pink-200" data-testid="events-sort-by">
                <SlidersHorizontal className="w-4 h-4 mr-2 text-pink-600" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </SmartSearchBar>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No events found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/events')} className="bg-pink-600">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCardGrid key={event.id} event={event} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCardList key={event.id} event={event} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        )}
      </div>

      <EventPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        event={previewEvent}
      />
    </div>
  );
}