import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hotelsAPI } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { Search, MapPin, Star, Users, Calendar, Wifi, Car, Coffee, ArrowRight, Filter, X, SlidersHorizontal } from 'lucide-react';
import DatePickerField from '@/components/shared/DatePickerField';

export default function Hotels() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
    minPrice: '',
    maxPrice: '',
    rating: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const response = await hotelsAPI.getAll(filters);
      setHotels(response.data?.hotels || []);
    } catch (error) {
      console.error('Failed to fetch hotels:', error);
      // Mock data for demo with FCFA prices
      setHotels([
        {
          id: '1',
          name: 'Hilton Yaounde',
          city: 'Yaounde',
          country: 'Cameroon',
          description: 'Luxury hotel in the heart of Yaounde with stunning city views',
          price_per_night: 125000,
          rating: 4.8,
          reviews_count: 1250,
          amenities: ['wifi', 'parking', 'breakfast', 'pool', 'gym'],
          image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'
        },
        {
          id: '2',
          name: 'La Falaise Hotel Douala',
          city: 'Douala',
          country: 'Cameroon',
          description: 'Premium hotel with world-class amenities and dining',
          price_per_night: 95000,
          rating: 4.9,
          reviews_count: 890,
          amenities: ['wifi', 'parking', 'breakfast', 'pool', 'spa'],
          image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800'
        },
        {
          id: '3',
          name: 'Mont Febe Hotel',
          city: 'Yaounde',
          country: 'Cameroon',
          description: 'Scenic mountain retreat with spectacular views',
          price_per_night: 75000,
          rating: 4.6,
          reviews_count: 456,
          amenities: ['wifi', 'parking', 'breakfast', 'pool'],
          image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHotels();
  };

  const getAmenityIcon = (amenity) => {
    const icons = {
      wifi: <Wifi className="h-4 w-4" />,
      parking: <Car className="h-4 w-4" />,
      breakfast: <Coffee className="h-4 w-4" />,
    };
    return icons[amenity] || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hotels & Accommodations</h1>
        <p className="text-slate-600">Find the perfect place to stay</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Where are you going?"
                className="input pl-10 w-full"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>
            <div>
              <DatePickerField
                value={filters.checkIn}
                onChange={(v) => setFilters({ ...filters, checkIn: v })}
                placeholder="Check-in"
                title="Check-in Date"
              />
            </div>
            <div>
              <DatePickerField
                value={filters.checkOut}
                onChange={(v) => setFilters({ ...filters, checkOut: v })}
                placeholder="Check-out"
                title="Check-out Date"
                minDate={filters.checkIn ? new Date(filters.checkIn) : new Date()}
              />
            </div>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <select
                className="input pl-10 w-full"
                value={filters.guests}
                onChange={(e) => setFilters({ ...filters, guests: e.target.value })}
              >
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="3">3 Guests</option>
                <option value="4">4+ Guests</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary flex-1 sm:flex-none">
              <Search className="h-4 w-4 mr-2" />
              Search Hotels
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Price (FCFA)</label>
                <input
                  type="number"
                  className="input w-full bg-white"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Price (FCFA)</label>
                <input
                  type="number"
                  className="input w-full bg-white"
                  placeholder="500000"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Rating</label>
                <select
                  className="input w-full bg-white"
                  value={filters.rating}
                  onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
                >
                  <option value="">Any</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3.5">3.5+ Stars</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-200"></div>
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : hotels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">🏨</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No hotels found</h3>
          <p className="text-slate-600">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hotels.map((hotel) => (
            <div
              key={hotel.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => navigate(`/services/hotels/${hotel.id}`)}
            >
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-64 h-48 sm:h-auto relative overflow-hidden">
                  <img
                    src={hotel.image}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                        {hotel.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                        <MapPin className="h-4 w-4" />
                        {hotel.city}, {hotel.country}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded-lg">
                      <Star className="h-4 w-4 text-green-600 fill-green-600" />
                      <span className="font-bold text-green-700">{hotel.rating}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">{hotel.description}</p>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hotel.amenities?.slice(0, 4).map((amenity) => (
                      <span key={amenity} className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {getAmenityIcon(amenity)}
                        {amenity}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <span className="text-2xl font-bold text-slate-900">{formatCurrency(hotel.price_per_night)}</span>
                      <span className="text-sm text-slate-500">/night</span>
                    </div>
                    <button className="btn btn-primary btn-sm flex items-center gap-1">
                      View Details <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
