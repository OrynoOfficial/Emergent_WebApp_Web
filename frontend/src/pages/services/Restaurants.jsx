import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { restaurantsAPI } from '../../api/client';
import { Search, MapPin, Star, Clock, Users, ArrowRight, Filter, Utensils } from 'lucide-react';

const CUISINE_TYPES = [
  'All', 'Italian', 'French', 'Japanese', 'Chinese', 'Mexican', 'Indian', 'American', 'Mediterranean'
];

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    cuisine: 'All',
    priceRange: '',
    search: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const response = await restaurantsAPI.getAll(filters);
      setRestaurants(response.data?.restaurants || []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
      // Mock data for demo
      setRestaurants([
        {
          id: '1',
          name: 'La Bella Italia',
          cuisine: 'Italian',
          city: 'New York',
          description: 'Authentic Italian cuisine in a romantic setting',
          price_range: '$$$',
          rating: 4.7,
          reviews_count: 856,
          opening_hours: '11:00 AM - 10:00 PM',
          image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
        },
        {
          id: '2',
          name: 'Tokyo Garden',
          cuisine: 'Japanese',
          city: 'Los Angeles',
          description: 'Premium sushi and traditional Japanese dishes',
          price_range: '$$$$',
          rating: 4.9,
          reviews_count: 1240,
          opening_hours: '12:00 PM - 11:00 PM',
          image: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800'
        },
        {
          id: '3',
          name: 'Le Petit Bistro',
          cuisine: 'French',
          city: 'Chicago',
          description: 'Classic French bistro with modern touches',
          price_range: '$$$',
          rating: 4.6,
          reviews_count: 432,
          opening_hours: '5:00 PM - 11:00 PM',
          image: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRestaurants();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Restaurants & Dining</h1>
        <p className="text-slate-600">Discover and reserve at the best restaurants</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search restaurants..."
                className="input pl-10 w-full"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="City"
                className="input pl-10 w-full"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>
            <select
              className="input w-full"
              value={filters.cuisine}
              onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })}
            >
              {CUISINE_TYPES.map(cuisine => (
                <option key={cuisine} value={cuisine}>{cuisine}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">
              <Search className="h-4 w-4 mr-2" />
              Search
            </button>
          </div>
        </form>

        {/* Cuisine Quick Filters */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          {CUISINE_TYPES.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => setFilters({ ...filters, cuisine })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filters.cuisine === cuisine
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cuisine}
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
      ) : restaurants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Utensils className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No restaurants found</h3>
          <p className="text-slate-600">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => navigate(`/services/restaurants/${restaurant.id}`)}
            >
              <div className="h-48 relative overflow-hidden">
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <span className="font-bold text-orange-600">{restaurant.price_range}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                      {restaurant.cuisine}
                    </span>
                    <h3 className="font-bold text-lg text-slate-900 mt-1 group-hover:text-orange-600 transition-colors">
                      {restaurant.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold">{restaurant.rating}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sm text-slate-500 mt-2">
                  <MapPin className="h-4 w-4" />
                  {restaurant.city}
                </div>

                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{restaurant.description}</p>

                <div className="flex items-center gap-1 text-sm text-slate-500 mt-3">
                  <Clock className="h-4 w-4" />
                  {restaurant.opening_hours}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <span className="text-sm text-slate-500">{restaurant.reviews_count} reviews</span>
                  <button className="btn btn-primary btn-sm flex items-center gap-1">
                    Reserve <ArrowRight className="h-4 w-4" />
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
