import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, Clock, Users, Ticket, Search, Star, Loader2 } from 'lucide-react';
import { eventsAPI } from '@/api/client';
import { formatFCFA } from '@/utils/currency';

const MOCK_EVENTS = [
  {
    id: '1',
    name: 'Afrobeats Music Festival 2025',
    type: 'Concert',
    venue: 'Stade Omnisports',
    city: 'Yaoundé',
    date: '2025-02-15',
    time: '18:00',
    priceFrom: 15000,
    ticketsLeft: 500,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    rating: 4.8
  },
  {
    id: '2',
    name: 'Cameroon vs Nigeria Football Match',
    type: 'Sports',
    venue: 'Stade Ahmadou Ahidjo',
    city: 'Yaoundé',
    date: '2025-02-20',
    time: '16:00',
    priceFrom: 5000,
    ticketsLeft: 2000,
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    rating: 4.9
  },
  {
    id: '3',
    name: 'Comedy Night with Top Comedians',
    type: 'Comedy',
    venue: 'Palais des Congrès',
    city: 'Douala',
    date: '2025-02-22',
    time: '20:00',
    priceFrom: 10000,
    ticketsLeft: 150,
    image: 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800',
    rating: 4.6
  },
  {
    id: '4',
    name: 'Tech Conference Cameroon 2025',
    type: 'Conference',
    venue: 'Hotel Hilton',
    city: 'Yaoundé',
    date: '2025-03-10',
    time: '09:00',
    priceFrom: 25000,
    ticketsLeft: 200,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
    rating: 4.7
  },
  {
    id: '5',
    name: 'Makossa Dance Party',
    type: 'Party',
    venue: 'Club Premium',
    city: 'Douala',
    date: '2025-02-28',
    time: '22:00',
    priceFrom: 8000,
    ticketsLeft: 300,
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    rating: 4.5
  }
];

const EventCard = ({ event, tickets, onBook }) => {
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white">
      <div className="md:flex">
        {/* Image */}
        <div className="md:w-1/3 h-48 md:h-auto relative">
          <img 
            src={event.image} 
            alt={event.name} 
            className="w-full h-full object-cover"
          />
          <Badge className="absolute top-3 left-3 bg-pink-600">{event.type}</Badge>
        </div>
        
        {/* Details */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{event.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {event.venue}, {event.city}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> {event.rating}
                </span>
              </div>
            </div>
            {event.ticketsLeft < 100 && (
              <Badge variant="destructive">Only {event.ticketsLeft} left!</Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-4">
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
            <Button onClick={() => onBook(event)} className="bg-pink-600 hover:bg-pink-700">
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
  const [sortBy, setSortBy] = useState('date');
  
  const city = searchParams.get('city') || '';
  const type = searchParams.get('type') || '';
  const date = searchParams.get('date') || '';
  const tickets = parseInt(searchParams.get('tickets') || '1');

  useEffect(() => {
    loadEvents();
  }, [city, type, date]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.getAll({ city, type, date });
      if (res.data?.events?.length > 0) {
        setEvents(res.data.events);
      } else {
        // Use mock data filtered by city if provided
        let filtered = [...MOCK_EVENTS];
        if (city) {
          filtered = filtered.filter(e => e.city.toLowerCase().includes(city.toLowerCase()));
        }
        if (type && type !== 'All Events') {
          filtered = filtered.filter(e => e.type === type);
        }
        if (date) {
          filtered = filtered.filter(e => e.date >= date);
        }
        // If no matches, show all mock events with updated city
        if (filtered.length === 0) {
          filtered = MOCK_EVENTS.map(e => ({ ...e, city: city || e.city }));
        }
        setEvents(filtered);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents(MOCK_EVENTS);
    } finally {
      setLoading(false);
    }
  };

  const sortedEvents = [...events].sort((a, b) => {
    switch (sortBy) {
      case 'price': return a.priceFrom - b.priceFrom;
      case 'date': return new Date(a.date) - new Date(b.date);
      case 'popularity': return b.ticketsLeft - a.ticketsLeft;
      default: return 0;
    }
  });

  const handleBook = (event) => {
    sessionStorage.setItem('selectedEvent', JSON.stringify({
      ...event,
      requestedTickets: tickets
    }));
    navigate('/services/events/booking');
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/services/events')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Events Found</h1>
                <p className="text-sm text-gray-600">
                  {city && `${city}`}
                  {type && type !== 'All Events' && ` • ${type}`}
                  {date && ` • ${format(new Date(date), 'MMM dd, yyyy')}`}
                  {` • ${tickets} ticket${tickets > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="popularity">Popularity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-pink-600 mx-auto mb-4" />
            <p className="text-gray-600">Finding events...</p>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg">
            <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No events found</h2>
            <p className="text-gray-500 mb-4">Try adjusting your search criteria</p>
            <Button onClick={() => navigate('/services/events')} className="bg-pink-600">
              Search Again
            </Button>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">{sortedEvents.length} event{sortedEvents.length > 1 ? 's' : ''} found</p>
            <div className="space-y-6">
              {sortedEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  tickets={tickets}
                  onBook={handleBook}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
