import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carRentalAPI } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { Search, MapPin, Calendar, Users, ArrowRight, Car, Fuel, Settings, Star } from 'lucide-react';

const CAR_TYPES = ['All', 'Sedan', 'SUV', 'Luxury', 'Sports', 'Electric', 'Van'];

export default function CarRental() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    location: '',
    pickupDate: '',
    returnDate: '',
    carType: 'All'
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCars();
  }, []);

  const fetchCars = async () => {
    setLoading(true);
    try {
      const response = await carRentalAPI.getAll(filters);
      setCars(response.data?.cars || []);
    } catch (error) {
      console.error('Failed to fetch cars:', error);
      // Mock data with FCFA prices
      setCars([
        {
          id: '1',
          name: 'Toyota Camry',
          type: 'Sedan',
          transmission: 'Automatic',
          fuel: 'Gasoline',
          seats: 5,
          price_per_day: 45000,
          rating: 4.8,
          reviews: 234,
          image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'
        },
        {
          id: '2',
          name: 'BMW X5',
          type: 'SUV',
          transmission: 'Automatic',
          fuel: 'Diesel',
          seats: 7,
          price_per_day: 85000,
          rating: 4.9,
          reviews: 156,
          image: 'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800'
        },
        {
          id: '3',
          name: 'Tesla Model 3',
          type: 'Electric',
          transmission: 'Automatic',
          fuel: 'Electric',
          seats: 5,
          price_per_day: 65000,
          rating: 4.7,
          reviews: 89,
          image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCars();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Car Rental</h1>
        <p className="text-slate-600">Find the perfect vehicle for your trip</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Pickup location"
                className="input pl-10 w-full"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              />
            </div>
            <div>
              <input
                type="date"
                className="input w-full"
                value={filters.pickupDate}
                onChange={(e) => setFilters({ ...filters, pickupDate: e.target.value })}
              />
            </div>
            <div>
              <input
                type="date"
                className="input w-full"
                value={filters.returnDate}
                onChange={(e) => setFilters({ ...filters, returnDate: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <Search className="h-4 w-4 mr-2" />
              Search
            </button>
          </div>
        </form>

        {/* Car Type Filters */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          {CAR_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilters({ ...filters, carType: type })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filters.carType === type
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type}
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
      ) : cars.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Car className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No cars available</h3>
          <p className="text-slate-600">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car) => (
            <div
              key={car.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => navigate(`/services/car-rental/${car.id}`)}
            >
              <div className="h-48 relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                <img
                  src={car.image}
                  alt={car.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                    {car.type}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {car.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold">{car.rating}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <Settings className="h-4 w-4" />
                    {car.transmission}
                  </span>
                  <span className="flex items-center gap-1">
                    <Fuel className="h-4 w-4" />
                    {car.fuel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {car.seats} seats
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <span className="text-2xl font-bold text-slate-900">{formatCurrency(car.price_per_day)}</span>
                    <span className="text-sm text-slate-500">/day</span>
                  </div>
                  <button className="btn btn-primary btn-sm flex items-center gap-1">
                    Rent <ArrowRight className="h-4 w-4" />
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
