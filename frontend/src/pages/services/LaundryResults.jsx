import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Star, Clock, Truck, Shirt, Sparkles, Loader2, Search, LayoutGrid, List, SlidersHorizontal, Droplets, Wind, Scissors } from 'lucide-react';
import { pressingApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import FavouriteButton from '@/components/shared/FavouriteButton';
import AlmostSoldOutBadge from '@/components/shared/AlmostSoldOutBadge';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';

const getServiceIcon = (service) => {
  const s = service?.toLowerCase();
  if (s?.includes('wash')) return Droplets;
  if (s?.includes('iron')) return Wind;
  if (s?.includes('dry')) return Sparkles;
  if (s?.includes('alter')) return Scissors;
  return Shirt;
};

// Grid View Service Card
const ServiceCardGrid = ({ service, onBook, isFav, toggleFav }) => {
  // Favourites handled by parent via isFav/toggleFav props
  const ServiceIcon = getServiceIcon(service.services?.[0]);
  
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Image */}
      <div className="h-48 relative overflow-hidden">
        <img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Favorite & Subscribe buttons */}
        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <SubscribeButton operatorId={service.operator_id} operatorName={service.operator_name} variant="icon" />
          <FavouriteButton
            isFavourite={!!(isFav && isFav(service._id || service.id))}
            onToggle={() => toggleFav && toggleFav(service)}
            testId={`favourite-${service._id || service.id}`}
            className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
            emptyClass="text-white"
          />
        </div>
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {service.express && (
            <Badge className="bg-orange-500 text-white">
              <Sparkles className="w-3 h-3 mr-1" /> Express
            </Badge>
          )}
          {service.delivery && (
            <Badge className="bg-emerald-500 text-white">
              <Truck className="w-3 h-3 mr-1" /> Delivery
            </Badge>
          )}
        </div>
        
        {/* Rating */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {service.rating} ({service.reviews})
        </div>
        {service.slots_available != null && (
          <div className="absolute bottom-3 right-3 z-10" data-testid={`laundry-fomo-grid-${service._id || service.id}`}>
            <AlmostSoldOutBadge count={service.slots_available} unit="slots" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        <h3 className="font-bold text-lg text-slate-900 mb-1 line-clamp-1">{service.name}</h3>
        <div className="flex items-center text-slate-500 text-sm mb-3">
          <MapPin className="w-4 h-4 mr-1" /> {service.address}
        </div>
        
        {/* Services */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {service.services?.slice(0, 3).map((s, idx) => {
            const Icon = getServiceIcon(s);
            return (
              <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
                <Icon className="h-3 w-3 text-[#082c59]" />
                <span className="text-xs text-slate-600">{s}</span>
              </div>
            );
          })}
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">Starting from</div>
            <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(service.minPrice)}</div>
            <div className="text-xs text-slate-500">/item</div>
          </div>
          <Button onClick={() => onBook(service)} className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
            <Shirt className="w-4 h-4 mr-2" /> Book
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Service Card
const ServiceCardList = ({ service, onBook, isFav, toggleFav }) => {
  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-1/4 h-48 md:h-auto relative">
          <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {service.express && (
              <Badge className="bg-orange-500 text-white">
                <Sparkles className="w-3 h-3 mr-1" /> Express
              </Badge>
            )}
            {service.delivery && (
              <Badge className="bg-emerald-500 text-white">
                <Truck className="w-3 h-3 mr-1" /> Delivery
              </Badge>
            )}
          </div>
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
          
          <p className="text-slate-600 mb-4 line-clamp-2">{service.description}</p>
          
          {/* Services */}
          <div className="flex flex-wrap gap-2 mb-4">
            {service.services?.map((s, idx) => {
              const Icon = getServiceIcon(s);
              return (
                <Badge key={idx} variant="outline" className="bg-slate-50">
                  <Icon className="w-3 h-3 mr-1" />
                  {s}
                </Badge>
              );
            })}
          </div>
          
          {/* Price and Book */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <span className="text-sm text-gray-500">Starting from</span>
              <span className="text-2xl font-bold text-[#082c59] ml-2">{formatFCFA(service.minPrice)}</span>
              <span className="text-sm text-gray-500">/item</span>
            </div>
            <Button onClick={() => onBook(service)} className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
              <Shirt className="w-4 h-4 mr-2" /> Book Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function LaundryResults() {

  const { isFav, toggleFav } = useFavourites('laundry');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  const city = searchParams.get('city') || '';

  useEffect(() => {
    loadServices();
  }, [searchParams]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await pressingApi.list({ city });
      setServices(res.data.services || res.data.shops || res.data.pressings || []);
    } catch (error) {
      console.error('Failed to load laundry services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    let filtered = [...services];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }
    
    if (deliveryFilter === 'delivery') {
      filtered = filtered.filter(s => s.delivery);
    } else if (deliveryFilter === 'express') {
      filtered = filtered.filter(s => s.express);
    }
    
    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) => a.minPrice - b.minPrice);
      case 'price_high':
        return filtered.sort((a, b) => b.minPrice - a.minPrice);
      case 'reviews':
        return filtered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
      case 'rating':
      default:
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }, [services, sortBy, searchQuery, deliveryFilter]);

  const handleBook = (service) => {
    sessionStorage.setItem('selectedLaundry', JSON.stringify(service));
    navigate(`/services/laundry/booking/${service.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Finding laundry services...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/laundry')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">Laundry Services</h1>
              <p className="text-sm text-slate-500">{filteredServices.length} services found</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="w-40 bg-white">
                <Truck className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="delivery">With Delivery</SelectItem>
                <SelectItem value="express">Express Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="reviews">Most Reviews</SelectItem>
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
        {filteredServices.length === 0 ? (
          <div className="text-center py-16">
            <Shirt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No services found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/laundry')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <ServiceCardGrid key={service.id} service={service} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map((service) => (
              <ServiceCardList key={service.id} service={service} onBook={handleBook} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}