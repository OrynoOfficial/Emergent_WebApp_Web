import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../api/client';
import { isPast } from '../../utils/dateUtils';
import { Search, MapPin, Calendar, Clock, Users, ArrowRight, Ticket, Filter, AlertCircle } from 'lucide-react';
import DatePickerField from '@/components/shared/DatePickerField';

const EVENT_CATEGORIES = ['All', 'Concerts', 'Sports', 'Theater', 'Comedy', 'Festivals', 'Conferences'];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    category: 'All',
    date: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getAll(filters);
      setEvents(response.data?.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      // Mock data
      setEvents([
        {
          id: '1',
          name: 'Summer Music Festival 2024',
          category: 'Festivals',
          venue: 'Central Park',
          city: 'New York',
          date: '2024-07-15',
          time: '4:00 PM',
          price_from: 75,
          available_tickets: 2500,
          image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800'
        },
        {
          id: '2',
          name: 'Lakers vs Bulls',
          category: 'Sports',
          venue: 'Staples Center',
          city: 'Los Angeles',
          date: '2024-06-20',
          time: '7:30 PM',
          price_from: 120,
          available_tickets: 500,
          image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800'
        },
        {
          id: '3',
          name: 'Broadway: The Phantom',
          category: 'Theater',
          venue: 'Broadway Theater',
          city: 'New York',
          date: '2024-06-25',
          time: '8:00 PM',
          price_from: 89,
          available_tickets: 150,
          image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEvents();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Events & Tickets</h1>
        <p className="text-slate-600">Discover and book tickets for amazing events</p>
      </div>

      {/* Search Form */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="Search events..."
                className="input pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="City"
                className="input pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>
            <DatePickerField
              value={filters.date}
              onChange={(v) => setFilters({ ...filters, date: v })}
              placeholder="Event date"
              title="Event Date"
              minDate={null}
            />
            <button type="submit" className="btn bg-white text-purple-600 hover:bg-purple-50">
              <Search className="h-4 w-4 mr-2" />
              Find Events
            </button>
          </div>
        </form>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilters({ ...filters, category: cat })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filters.category === cat
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-200"></div>
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Ticket className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No events found</h3>
          <p className="text-slate-600">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const isEventPast = isPast(event.date, event.time);
            
            return (
              <div
                key={event.id}
                style={isEventPast ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
                className={`bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all group ${
                  isEventPast 
                    ? 'cursor-not-allowed pointer-events-none' 
                    : 'hover:shadow-xl cursor-pointer'
                }`}
                onClick={() => !isEventPast && navigate(`/services/events/${event.id}`)}
              >
                <div className="h-48 relative overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.name}
                    className={`w-full h-full object-cover transition-transform duration-500 ${!isEventPast && 'group-hover:scale-110'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                  
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`px-3 py-1 text-white text-xs font-medium rounded-full ${
                      isEventPast ? 'bg-slate-500' : 'bg-purple-500'
                    }`}>
                      {event.category}
                    </span>
                    {isEventPast && (
                      <span className="px-3 py-1 bg-slate-700 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Past Event
                      </span>
                    )}
                  </div>
                  
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className={`backdrop-blur-sm rounded-lg p-2 flex items-center gap-3 ${
                      isEventPast ? 'bg-slate-200/90' : 'bg-white/90'
                    }`}>
                      <div className="text-center px-2 border-r border-slate-200">
                        <p className={`text-lg font-bold ${isEventPast ? 'text-slate-400' : 'text-purple-600'}`}>
                          {new Date(event.date).getDate()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                        </p>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isEventPast ? 'text-slate-400' : 'text-slate-900'}`}>{event.time}</p>
                        <p className="text-xs text-slate-500">{event.venue}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className={`font-bold text-lg transition-colors ${
                    isEventPast ? 'text-slate-400' : 'text-slate-900 group-hover:text-purple-600'
                  }`}>
                    {event.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                    <MapPin className="h-4 w-4" />
                    {event.city}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <span className="text-sm text-slate-500">From</span>
                      <span className={`text-xl font-bold ml-1 ${isEventPast ? 'text-slate-400' : 'text-slate-900'}`}>
                        ${event.price_from}
                      </span>
                    </div>
                    {isEventPast ? (
                      <button className="btn btn-sm bg-slate-200 text-slate-400 cursor-not-allowed" disabled>
                        Ended
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm flex items-center gap-1">
                        Get Tickets <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
