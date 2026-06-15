import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { servicesAPI } from '../api/client';
import { Search, Filter, MapPin, Star, ArrowRight, X, SlidersHorizontal, Sparkles } from 'lucide-react';
import ManagementShell from '../components/management/shared/ManagementShell';

const SERVICE_CATEGORIES = [
  { key: 'all', label: 'All Services', icon: '🌟' },
  { key: 'hotel', label: 'Hotels', icon: '🏨' },
  { key: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { key: 'travel', label: 'Travel', icon: '🚌' },
  { key: 'car_rental', label: 'Car Rental', icon: '🚗' },
  { key: 'event', label: 'Events', icon: '🎫' },
  { key: 'package', label: 'Packages', icon: '📦' },
  { key: 'laundry', label: 'Laundry', icon: '🧹' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { key: 'banquet', label: 'Banquet', icon: '🎉' },
];

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ city: '', category: 'all', search: '' });
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchServices();
  }, [filters.category]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      if (filters.city) params.city = filters.city;
      if (filters.search) params.search = filters.search;
      
      const response = await servicesAPI.getAll(params);
      setServices(response.data?.services || []);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchServices();
  };

  const clearFilters = () => {
    setFilters({ city: '', category: 'all', search: '' });
  };

  const getCategoryIcon = (category) => {
    const cat = SERVICE_CATEGORIES.find(c => c.key === category);
    return cat?.icon || '📦';
  };

  const getCategoryColor = (category) => {
    const colors = {
      hotel: 'from-pink-500 to-rose-500',
      restaurant: 'from-orange-500 to-amber-500',
      travel: 'from-blue-500 to-cyan-500',
      car_rental: 'from-emerald-500 to-green-500',
      event: 'from-purple-500 to-violet-500',
      package: 'from-red-500 to-pink-500',
      laundry: 'from-fuchsia-500 to-pink-500',
      entertainment: 'from-cyan-500 to-blue-500',
      banquet: 'from-amber-500 to-yellow-500'
    };
    return colors[category] || 'from-slate-500 to-slate-600';
  };

  return (
    <ManagementShell
      title="Browse Services"
      icon={Sparkles}
      subtitle="Find and book the perfect service for your needs"
      scopeFilter={
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-slate-700 text-sm"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </button>
      }
      testIdPrefix="services-browse"
      activeTab="all"
    >
      <div className="mt-4 space-y-6">
      {/* Categories */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilters({ ...filters, category: cat.key })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                filters.category === cat.key
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-4 ${
        !showFilters && 'hidden sm:block'
      }`}>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search services..."
              className="input pl-10 w-full"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="relative w-48">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="City"
              className="input pl-10 w-full"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary px-6">
            Search
          </button>
        </form>

        {(filters.city || filters.search || filters.category !== 'all') && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Active filters:</span>
            {filters.category !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                {SERVICE_CATEGORIES.find(c => c.key === filters.category)?.label}
                <button onClick={() => setFilters({ ...filters, category: 'all' })}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.city && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                {filters.city}
                <button onClick={() => setFilters({ ...filters, city: '' })}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                "{filters.search}"
                <button onClick={() => setFilters({ ...filters, search: '' })}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-200"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-full"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No services found</h3>
          <p className="text-slate-600 mb-6">Try adjusting your filters or search criteria</p>
          <button onClick={clearFilters} className="btn btn-primary">
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id || service._id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(`/services/${service.id || service._id}`)}
            >
              <div className={`h-48 bg-gradient-to-br ${getCategoryColor(service.category)} relative overflow-hidden`}>
                {service.image ? (
                  <img
                    src={service.image}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl opacity-50">{getCategoryIcon(service.category)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                    {SERVICE_CATEGORIES.find(c => c.key === service.category)?.label || service.category}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {service.name}
                </h3>
                <p className="text-sm text-slate-600 line-clamp-2 mb-3">{service.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <span>{service.city || 'Location'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium">{service.rating || '4.5'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <span className="text-2xl font-bold text-slate-900">${service.base_price || service.price || 0}</span>
                    <span className="text-sm text-slate-500">/unit</span>
                  </div>
                  <button className="btn btn-primary btn-sm flex items-center gap-1">
                    Book Now <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </ManagementShell>
  );
}
