import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, Clock, Users, Ticket, Search, Star, Loader2, Heart, LayoutGrid, List, SlidersHorizontal, Music, Trophy, Laugh, Briefcase, PartyPopper } from 'lucide-react';
import { eventsAPI } from '@/api/client';
import { formatFCFA } from '@/utils/currency';

const MOCK_EVENTS = [
  { id: '1', name: 'Afrobeats Music Festival 2025', type: 'Concert', venue: 'Stade Omnisports', city: 'Yaoundé', date: '2025-02-15', time: '18:00', priceFrom: 15000, ticketsLeft: 500, image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', rating: 4.8, description: 'The biggest Afrobeats festival featuring top African artists.' },
  { id: '2', name: 'Cameroon vs Nigeria Football Match', type: 'Sports', venue: 'Stade Ahmadou Ahidjo', city: 'Yaoundé', date: '2025-02-20', time: '16:00', priceFrom: 5000, ticketsLeft: 2000, image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', rating: 4.9, description: 'AFCON qualifier match between rival nations.' },
  { id: '3', name: 'Comedy Night with Top Comedians', type: 'Comedy', venue: 'Palais des Congrès', city: 'Douala', date: '2025-02-22', time: '20:00', priceFrom: 10000, ticketsLeft: 150, image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800', rating: 4.6, description: 'An evening of laughter with the best comedians in Africa.' },
  { id: '4', name: 'Tech Conference Cameroon 2025', type: 'Conference', venue: 'Hotel Hilton', city: 'Yaoundé', date: '2025-03-10', time: '09:00', priceFrom: 25000, ticketsLeft: 200, image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800', rating: 4.7, description: 'Annual tech conference featuring industry leaders.' },
  { id: '5', name: 'Makossa Dance Party', type: 'Party', venue: 'Club Premium', city: 'Douala', date: '2025-02-28', time: '22:00', priceFrom: 8000, ticketsLeft: 300, image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800', rating: 4.5, description: 'All-night party celebrating Makossa music culture.' }
];

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
const EventCardGrid = ({ event, onBook }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const EventIcon = getEventIcon(event.type);
  
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Image */}
      <div className="h-48 relative overflow-hidden">
        <img
          src={event.image}
          alt={event.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
        >
          <Heart className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </button>
        
        {/* Type Badge */}
        <Badge className={`absolute top-3 left-3 ${EVENT_TYPE_COLORS[event.type] || 'bg-pink-600'}`}>
          <EventIcon className="w-3 h-3 mr-1" />
          {event.type}
        </Badge>
        
        {/* Rating */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {event.rating}
        </div>
        
        {/* Urgency Badge */}
        {event.ticketsLeft < 200 && (
          <Badge className="absolute bottom-3 right-3 bg-red-500 text-white animate-pulse">
            Only {event.ticketsLeft} left!
          </Badge>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">{event.name}</h3>
        
        <div className="space-y-2 text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-pink-500" />
            <span>{event.venue}, {event.city}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-pink-500" />
              <span>{format(new Date(event.date), 'MMM dd')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-pink-500" />
              <span>{event.time}</span>
            </div>
          </div>
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <div className="text-2xl font-bold text-pink-600">{formatFCFA(event.priceFrom)}</div>
          </div>
          <Button onClick={() => onBook(event)} className="bg-pink-600 hover:bg-pink-700 rounded-xl">
            <Ticket className="w-4 h-4 mr-2" /> Get Tickets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Event Card
const EventCardList = ({ event, onBook }) => {
  const EventIcon = getEventIcon(event.type);
  
  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-1/3 h-48 md:h-auto relative">
          <img src={event.image} alt={event.name} className="w-full h-full object-cover" />
          <Badge className={`absolute top-3 left-3 ${EVENT_TYPE_COLORS[event.type] || 'bg-pink-600'}`}>
            <EventIcon className="w-3 h-3 mr-1" />
            {event.type}
          </Badge>
        </div>
        
        {/* Details */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{event.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" /> {event.venue}, {event.city}
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 ml-2" /> {event.rating}
              </div>
            </div>
            {event.ticketsLeft < 200 && (
              <Badge variant="destructive" className="animate-pulse">Only {event.ticketsLeft} left!</Badge>
            )}
          </div>
          
          <p className="text-slate-600 mb-4 line-clamp-2">{event.description}</p>
          
          <div className="grid grid-cols-3 gap-4 my-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-pink-500" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium">{format(new Date(event.date), 'MMM dd, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-pink-500" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="font-medium">{event.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-pink-500" />
              <div>
                <p className="text-xs text-gray-500">Available</p>
                <p className="font-medium">{event.ticketsLeft} tickets</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <span className="text-sm text-gray-500">From</span>
              <span className="text-2xl font-bold text-pink-600 ml-2">{formatFCFA(event.priceFrom)}</span>
            </div>
            <Button onClick={() => onBook(event)} className="bg-pink-600 hover:bg-pink-700 rounded-xl">
              <Ticket className="w-4 h-4 mr-2" /> Get Tickets
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function EventsResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || '';

  useEffect(() => {
    loadEvents();
  }, [searchParams]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.list({ city, date });
      if (res.data.events?.length > 0) {
        setEvents(res.data.events);
      } else {
        setEvents(MOCK_EVENTS);
      }
    } catch (error) {
      setEvents(MOCK_EVENTS);
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
    sessionStorage.setItem('selectedEvent', JSON.stringify(event));
    navigate(`/services/events/booking/${event.id}`);
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
        <div className="max-w-7xl mx-auto px-4 py-4">
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
      <div className="max-w-7xl mx-auto px-4 py-6">
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
              <EventCardGrid key={event.id} event={event} onBook={handleBook} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCardList key={event.id} event={event} onBook={handleBook} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}