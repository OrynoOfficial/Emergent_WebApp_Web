import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, Clock, Users, Ticket, Search, Star, Loader2, LayoutGrid, List, SlidersHorizontal, Music, Trophy, Laugh, Briefcase, PartyPopper, AlertCircle } from 'lucide-react';
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

// Grid View Event Card
const EventCardGrid = ({ event: rawEvent, onBook, isFav, toggleFav }) => {
  const event = {
    ...rawEvent,
    type: rawEvent.type || rawEvent.event_type,
    venue: rawEvent.venue || rawEvent.venue_name,
    date: rawEvent.date || rawEvent.start_date || rawEvent.event_date,
    time: rawEvent.time || rawEvent.doors_open || rawEvent.start_time,
    priceFrom: rawEvent.priceFrom || rawEvent.ticket_price || (rawEvent.ticket_types?.[0]?.price) || 0,
    ticketsLeft: rawEvent.ticketsLeft ?? (rawEvent.total_capacity != null ? Math.max(0, (rawEvent.total_capacity || 0) - (rawEvent.tickets_sold || 0)) : (rawEvent.available_seats ?? 999)),
    image: rawEvent.image || rawEvent.cover_image || rawEvent.images?.[0] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    rating: rawEvent.rating || 4.5,
    contact_email: rawEvent.contact_email,
    contact_phone: rawEvent.contact_phone,
  };
  // Favourites handled by parent via isFav/toggleFav props
  const EventIcon = getEventIcon(event.type);
  const isEventPast = isPast(event.date, event.time);
  
  return (
    <Card 
      className={`group overflow-hidden bg-white rounded-2xl border-0 shadow-md transition-all duration-300 ${
        isEventPast 
          ? 'cursor-not-allowed' 
          : 'hover:shadow-2xl transform hover:-translate-y-1'
      }`}
      style={isEventPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
    >
      {/* Image */}
      <div className="h-48 relative overflow-hidden">
        <img
          src={event.image}
          alt={event.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${!isEventPast && 'group-hover:scale-105'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Favorite & Subscribe buttons - only show for future events */}
        {!isEventPast && (
          <div className="absolute top-3 right-3 z-10 flex gap-1.5">
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
        
        {/* Type Badge & Past Event Badge */}
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
        
        {/* Rating */}
        <div className={`absolute bottom-3 left-3 flex items-center gap-1 text-white text-xs px-2 py-1 rounded-full ${isEventPast ? 'bg-slate-500/60' : 'bg-black/60'}`}>
          <Star className={`w-3 h-3 ${isEventPast ? 'text-slate-300' : 'text-yellow-400 fill-yellow-400'}`} />
          {event.rating}
        </div>
        
        {/* Urgency Badge — unified ≤11 FOMO sticker */}
        {!isEventPast && (
          <div className="absolute bottom-3 right-3" data-testid={`event-fomo-grid-${event._id || event.id}`}>
            <AlmostSoldOutBadge count={event.ticketsLeft} unit="tickets" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        <h3 className={`font-bold text-lg mb-2 line-clamp-2 ${isEventPast ? 'text-slate-400' : 'text-slate-900'}`}>{event.name}</h3>
        
        <div className="space-y-2 text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className={`w-4 h-4 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
            <span>{event.venue}, {event.city}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Calendar className={`w-4 h-4 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
              <span>{event.date ? format(new Date(event.date), 'MMM dd, yyyy') : 'TBD'}</span>
            </div>
            {event.time && (
              <div className="flex items-center gap-1">
                <Clock className={`w-4 h-4 ${isEventPast ? 'text-slate-400' : 'text-pink-500'}`} />
                <span>{event.time}</span>
              </div>
            )}
          </div>
          {(event.contact_email || event.contact_phone) && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {event.contact_phone && <span>{event.contact_phone}</span>}
              {event.contact_email && <span>{event.contact_email}</span>}
            </div>
          )}
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <div className={`text-2xl font-bold ${isEventPast ? 'text-slate-400' : 'text-pink-600'}`}>{formatFCFA(event.priceFrom)}</div>
          </div>
          {isEventPast ? (
            <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl">
              <AlertCircle className="w-4 h-4 mr-2" /> Ended
            </Button>
          ) : (
            <Button onClick={() => onBook(event)} className="bg-pink-600 hover:bg-pink-700 rounded-xl" data-testid={`view-details-grid-${event._id || event.id}`}>
              <Ticket className="w-4 h-4 mr-2" /> View Details
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
    image: rawEvent.image || rawEvent.cover_image || rawEvent.images?.[0] || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewEvent, setPreviewEvent] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || '';

  useEffect(() => {
    loadEvents();
  }, [searchParams]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Fetch both new-architecture Showtimes and legacy Events in parallel.
      const [legacyRes, showtimesRes] = await Promise.all([
        eventsApi.search({ city, date }).catch(() => ({ data: { events: [] } })),
        api.get('/event-showtimes/', { params: { upcoming_only: true, ...(city ? { city } : {}) } }).catch(() => ({ data: { showtimes: [] } })),
      ]);

      // Normalise showtimes into the same card shape EventsResults already renders,
      // while keeping a `_showtime: true` marker so click routes to /services/showtimes/:id.
      const normalisedShowtimes = (showtimesRes.data.showtimes || []).map(s => {
        const minPrice = (s.classes || []).reduce((m, c) => (c.price < m ? c.price : m), Infinity);
        const totalAvail = (s.classes || []).reduce((sum, c) => sum + (c.available_units || 0), 0);
        const totalCap = (s.classes || []).reduce((sum, c) => sum + (c.total_units || 0), 0);
        return {
          ...s,
          _showtime: true,
          id: s.id,
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
          image: (s.images || [])[0],
          operator_id: s.operator_id,
          operator_name: s.operator_name,
        };
      });

      setEvents([...normalisedShowtimes, ...(legacyRes.data.events || [])]);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    let filtered = [...events];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.name?.toLowerCase().includes(query) ||
        e.venue?.toLowerCase().includes(query)
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(e => e.type?.toLowerCase() === typeFilter.toLowerCase());
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
  }, [events, sortBy, searchQuery, typeFilter]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/events')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-pink-600">Events {city && `in ${city}`}</h1>
              <p className="text-sm text-slate-500">
                {filteredEvents.length} events found
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-white">
                <Ticket className="w-4 h-4 mr-2" />
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
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white shadow-sm' : ''}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white shadow-sm' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
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