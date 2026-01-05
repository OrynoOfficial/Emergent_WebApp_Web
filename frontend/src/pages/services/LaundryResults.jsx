import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Star, Clock, Truck, Shirt, Sparkles, Loader2 } from 'lucide-react';
import { pressingApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';

const MOCK_SERVICES = [
  {
    id: '1',
    name: 'Clean & Fresh Laundry',
    address: 'Avenue Kennedy, Yaoundé',
    city: 'Yaoundé',
    rating: 4.8,
    reviews: 234,
    services: ['Washing', 'Ironing', 'Dry Cleaning'],
    delivery: true,
    express: true,
    minPrice: 500,
    image: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400'
  },
  {
    id: '2',
    name: 'Premium Pressing',
    address: 'Rue de la Joie, Yaoundé',
    city: 'Yaoundé',
    rating: 4.6,
    reviews: 189,
    services: ['Ironing', 'Dry Cleaning', 'Leather Care'],
    delivery: true,
    express: false,
    minPrice: 300,
    image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400'
  },
  {
    id: '3',
    name: 'Express Clean',
    address: 'Boulevard Central, Yaoundé',
    city: 'Yaoundé',
    rating: 4.9,
    reviews: 312,
    services: ['Washing', 'Ironing', 'Express Service'],
    delivery: true,
    express: true,
    minPrice: 600,
    image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400'
  },
  {
    id: '4',
    name: 'Family Laundromat',
    address: 'Quartier Bastos, Yaoundé',
    city: 'Yaoundé',
    rating: 4.5,
    reviews: 156,
    services: ['Washing', 'Ironing'],
    delivery: false,
    express: false,
    minPrice: 400,
    image: 'https://images.unsplash.com/photo-1469504512102-900f29606341?w=400'
  },
  {
    id: '5',
    name: 'Deluxe Dry Cleaners',
    address: 'Avenue Foch, Yaoundé',
    city: 'Yaoundé',
    rating: 4.7,
    reviews: 278,
    services: ['Dry Cleaning', 'Leather Care', 'Alterations'],
    delivery: true,
    express: true,
    minPrice: 1500,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'
  }
];

const ServiceCard = ({ service, onBook }) => {
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white">
      <div className="md:flex">
        {/* Image */}
        <div className="md:w-1/4 h-48 md:h-auto relative">
          <img 
            src={service.image} 
            alt={service.name} 
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Details */}
        <div className="md:w-3/4 p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{service.name}</h3>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-1" /> {service.address}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold">{service.rating}</span>
              <span className="text-xs text-gray-500">({service.reviews})</span>
            </div>
          </div>
          
          {/* Services */}
          <div className="flex flex-wrap gap-2 mb-4">
            {service.services.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
          
          {/* Features */}
          <div className="flex flex-wrap gap-4 mb-4">
            {service.delivery && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Truck className="w-4 h-4" /> Free Pickup & Delivery
              </div>
            )}
            {service.express && (
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <Sparkles className="w-4 h-4" /> Express Available
              </div>
            )}
          </div>
          
          {/* Price and Book */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <span className="text-sm text-gray-500">Starting from</span>
              <span className="text-2xl font-bold text-[#082c59] ml-2">{formatFCFA(service.minPrice)}</span>
              <span className="text-sm text-gray-500">/item</span>
            </div>
            <Button onClick={() => onBook(service)} className="bg-[#082c59] hover:bg-[#0a3a75]">
              <Shirt className="w-4 h-4 mr-2" /> Book Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function LaundryResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating');
  
  const city = searchParams.get('city') || '';
  const serviceType = searchParams.get('service') || '';
  const date = searchParams.get('date') || '';
  const wantDelivery = searchParams.get('delivery') === 'true';
  const wantExpress = searchParams.get('express') === 'true';

  useEffect(() => {
    loadServices();
  }, [city, serviceType]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await pressingApi.list({ city, service_type: serviceType });
      if (res.data?.services?.length > 0) {
        setServices(res.data.services);
      } else {
        // Filter mock data
        let filtered = [...MOCK_SERVICES];
        if (city) {
          filtered = filtered.filter(s => s.city.toLowerCase().includes(city.toLowerCase()));
        }
        if (serviceType) {
          filtered = filtered.filter(s => s.services.some(srv => srv.toLowerCase().includes(serviceType.toLowerCase())));
        }
        if (wantDelivery) {
          filtered = filtered.filter(s => s.delivery);
        }
        if (wantExpress) {
          filtered = filtered.filter(s => s.express);
        }
        // If no match, show all with updated city
        if (filtered.length === 0) {
          filtered = MOCK_SERVICES.map(s => ({ ...s, city: city || s.city }));
        }
        setServices(filtered);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
      setServices(MOCK_SERVICES);
    } finally {
      setLoading(false);
    }
  };

  const sortedServices = [...services].sort((a, b) => {
    switch (sortBy) {
      case 'price': return a.minPrice - b.minPrice;
      case 'rating': return b.rating - a.rating;
      case 'reviews': return b.reviews - a.reviews;
      default: return 0;
    }
  });

  const handleBook = (service) => {
    sessionStorage.setItem('selectedLaundryService', JSON.stringify(service));
    navigate(`/services/laundry/booking/${service.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/services/laundry')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Laundry Services</h1>
                <p className="text-sm text-gray-600">
                  {city && `${city}`}
                  {serviceType && ` • ${serviceType}`}
                  {date && ` • ${format(new Date(date), 'MMM dd, yyyy')}`}
                </p>
              </div>
            </div>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price">Price: Low to High</SelectItem>
                <SelectItem value="reviews">Most Reviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#082c59] mx-auto mb-4" />
            <p className="text-gray-600">Finding laundry services...</p>
          </div>
        ) : sortedServices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg">
            <Shirt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No services found</h2>
            <p className="text-gray-500 mb-4">Try adjusting your search criteria</p>
            <Button onClick={() => navigate('/services/laundry')} className="bg-[#082c59] hover:bg-[#0a3a75]">
              Search Again
            </Button>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">{sortedServices.length} service{sortedServices.length > 1 ? 's' : ''} found</p>
            <div className="space-y-6">
              {sortedServices.map(service => (
                <ServiceCard 
                  key={service.id} 
                  service={service}
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
