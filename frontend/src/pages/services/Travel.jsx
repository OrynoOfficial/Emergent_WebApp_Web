import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { travelAPI } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { Search, MapPin, Clock, Users, ArrowRight, Calendar, Bus } from 'lucide-react';

export default function Travel() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    date: '',
    passengers: 1
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const response = await travelAPI.getRoutes(filters);
      setRoutes(response.data?.routes || []);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
      // Mock data
      setRoutes([
        {
          id: '1',
          from_city: 'Douala',
          to_city: 'Yaounde',
          departure_time: '06:00 AM',
          arrival_time: '10:30 AM',
          duration: '4h 30m',
          price: 5000,
          operator: 'Touristique Express',
          available_seats: 23,
          bus_type: 'VIP Coach',
          amenities: ['wifi', 'ac', 'usb']
        },
        {
          id: '2',
          from_city: 'Yaounde',
          to_city: 'Bafoussam',
          departure_time: '07:00 AM',
          arrival_time: '12:00 PM',
          duration: '5h',
          price: 4500,
          operator: 'General Express Voyages',
          available_seats: 15,
          bus_type: 'Standard',
          amenities: ['ac', 'usb']
        },
        {
          id: '3',
          from_city: 'Douala',
          to_city: 'Buea',
          departure_time: '08:30 AM',
          arrival_time: '10:30 AM',
          duration: '2h',
          price: 3000,
          operator: 'Amour Mezam',
          available_seats: 8,
          bus_type: 'Economy',
          amenities: ['ac']
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRoutes();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Travel & Bus Tickets</h1>
        <p className="text-slate-600">Book comfortable intercity travel</p>
      </div>

      {/* Search Form */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-4">Find Your Journey</h2>
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <label className="block text-sm text-blue-100 mb-1">From</label>
              <input
                type="text"
                placeholder="Departure city"
                className="input w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </div>
            <div className="relative">
              <label className="block text-sm text-blue-100 mb-1">To</label>
              <input
                type="text"
                placeholder="Arrival city"
                className="input w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-blue-100 mb-1">Date</label>
              <input
                type="date"
                className="input w-full bg-white/20 border-white/30 text-white"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-blue-100 mb-1">Passengers</label>
              <select
                className="input w-full bg-white/20 border-white/30 text-white"
                value={filters.passengers}
                onChange={(e) => setFilters({ ...filters, passengers: e.target.value })}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n} className="text-slate-900">{n} Passenger{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn bg-white text-blue-600 hover:bg-blue-50 w-full">
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-slate-200 rounded-xl"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Bus className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No routes found</h3>
          <p className="text-slate-600">Try different cities or dates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <div
              key={route.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => navigate(`/services/travel/${route.id}`)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Route Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">{route.departure_time}</p>
                      <p className="text-sm text-slate-500">{route.from_city}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 border-t-2 border-dashed border-slate-300"></div>
                      <div className="px-3 py-1 bg-slate-100 rounded-full">
                        <span className="text-xs font-medium text-slate-600">{route.duration}</span>
                      </div>
                      <div className="flex-1 border-t-2 border-dashed border-slate-300"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">{route.arrival_time}</p>
                      <p className="text-sm text-slate-500">{route.to_city}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Bus className="h-4 w-4" />
                      {route.operator}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded">{route.bus_type}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      route.available_seats < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {route.available_seats} seats left
                    </span>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="lg:text-right lg:border-l lg:border-slate-200 lg:pl-6">
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(route.price)}</p>
                  <p className="text-sm text-slate-500">per person</p>
                  <button className="btn btn-primary mt-3 w-full lg:w-auto">
                    Select <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
