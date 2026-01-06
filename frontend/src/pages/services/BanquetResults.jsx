import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Star, Utensils, Music, Camera, ArrowLeft, Search, LayoutGrid, List, SlidersHorizontal, Heart, Loader2, PartyPopper, Building, Sparkles } from 'lucide-react';
import { banquetApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';

const MOCK_VENUES = [
  { id: '1', name: 'Grand Palace Hall', city: 'Yaoundé', venue_type: 'wedding', capacity_min: 100, capacity_max: 500, price_per_day: 500000, rating: 4.8, amenities: ['catering', 'decoration', 'sound_system', 'parking'], images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'], description: 'Luxurious venue perfect for grand weddings and celebrations.' },
  { id: '2', name: 'Conference Center Elite', city: 'Douala', venue_type: 'conference', capacity_min: 50, capacity_max: 200, price_per_day: 300000, rating: 4.5, amenities: ['projector', 'wifi', 'catering', 'parking'], images: ['https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800'], description: 'Modern conference facilities with state-of-the-art technology.' },
  { id: '3', name: 'Garden Event Space', city: 'Yaoundé', venue_type: 'birthday', capacity_min: 30, capacity_max: 150, price_per_day: 200000, rating: 4.6, amenities: ['outdoor', 'catering', 'decoration'], images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800'], description: 'Beautiful outdoor venue surrounded by lush gardens.' },
  { id: '4', name: 'Royal Banquet Suite', city: 'Douala', venue_type: 'wedding', capacity_min: 200, capacity_max: 800, price_per_day: 750000, rating: 4.9, amenities: ['catering', 'decoration', 'sound_system', 'parking', 'valet'], images: ['https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800'], description: 'Premium venue for the most exclusive events.' },
  { id: '5', name: 'Cozy Meeting Room', city: 'Yaoundé', venue_type: 'meeting', capacity_min: 10, capacity_max: 40, price_per_day: 80000, rating: 4.4, amenities: ['projector', 'wifi', 'coffee'], images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'], description: 'Intimate space for corporate meetings and workshops.' }
];

const VENUE_TYPE_COLORS = {
  'wedding': 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
  'conference': 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
  'birthday': 'bg-gradient-to-r from-purple-500 to-violet-500 text-white',
  'meeting': 'bg-gradient-to-r from-slate-500 to-slate-600 text-white',
  'party': 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
};

const getVenueIcon = (type) => {
  switch (type?.toLowerCase()) {
    case 'wedding': return Sparkles;
    case 'conference': return Building;
    case 'birthday': case 'party': return PartyPopper;
    default: return Building;
  }
};

const getAmenityIcon = (amenity) => {
  switch (amenity?.toLowerCase()) {
    case 'catering': return Utensils;
    case 'sound_system': case 'music': return Music;
    case 'decoration': case 'photography': return Camera;
    default: return Star;
  }
};

// Grid View Venue Card
const VenueCardGrid = ({ venue, onBook }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const VenueIcon = getVenueIcon(venue.venue_type);
  const defaultImage = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800';
  const image = venue.images?.[0] || defaultImage;
  
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Image Section */}
      <div className="h-52 relative overflow-hidden">
        <img
          src={image}
          alt={venue.name}
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
        <Badge className={`absolute top-3 left-3 capitalize ${VENUE_TYPE_COLORS[venue.venue_type] || 'bg-purple-600'}`}>
          <VenueIcon className="w-3 h-3 mr-1" />
          {venue.venue_type}
        </Badge>
        
        {/* Rating */}
        {venue.rating && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            {venue.rating}
          </div>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        <h3 className="font-bold text-lg text-slate-900 mb-1 line-clamp-1">{venue.name}</h3>
        <div className="flex items-center text-slate-500 text-sm mb-3">
          <MapPin className="w-4 h-4 mr-1" /> {venue.city}
        </div>
        
        {/* Capacity */}
        <div className="flex items-center text-sm text-slate-600 mb-3 bg-slate-50 rounded-lg p-2">
          <Users className="w-4 h-4 mr-2 text-purple-600" />
          <span>{venue.capacity_min} - {venue.capacity_max} guests</span>
        </div>
        
        {/* Amenities */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {venue.amenities?.slice(0, 3).map((amenity, idx) => {
            const AmenityIcon = getAmenityIcon(amenity);
            return (
              <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full">
                <AmenityIcon className="h-3 w-3 text-slate-600" />
                <span className="text-xs text-slate-600 capitalize">{amenity.replace('_', ' ')}</span>
              </div>
            );
          })}
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-2xl font-bold text-purple-600">{formatFCFA(venue.price_per_day)}</div>
            <div className="text-xs text-slate-500">per day</div>
          </div>
          <Button onClick={() => onBook(venue)} className="bg-purple-600 hover:bg-purple-700 rounded-xl">
            Book Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Venue Card
const VenueCardList = ({ venue, onBook }) => {
  const VenueIcon = getVenueIcon(venue.venue_type);
  const defaultImage = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800';
  const image = venue.images?.[0] || defaultImage;
  
  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all">
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-1/3 h-48 md:h-auto relative">
          <img src={image} alt={venue.name} className="w-full h-full object-cover" />
          <Badge className={`absolute top-3 left-3 capitalize ${VENUE_TYPE_COLORS[venue.venue_type] || 'bg-purple-600'}`}>
            <VenueIcon className="w-3 h-3 mr-1" />
            {venue.venue_type}
          </Badge>
          {venue.rating && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {venue.rating}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="md:w-2/3 p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-xl text-slate-900">{venue.name}</h3>
              <div className="flex items-center text-gray-600 text-sm">
                <MapPin className="w-4 h-4 mr-1" /> {venue.city}
              </div>
            </div>
          </div>
          
          <p className="text-slate-600 mb-4 line-clamp-2">{venue.description}</p>
          
          <div className="flex items-center text-sm text-gray-600 mb-4">
            <Users className="w-4 h-4 mr-1 text-purple-600" /> {venue.capacity_min} - {venue.capacity_max} guests
          </div>
          
          {/* Amenities */}
          <div className="flex flex-wrap gap-2 mb-4">
            {venue.amenities?.map((amenity, idx) => {
              const AmenityIcon = getAmenityIcon(amenity);
              return (
                <Badge key={idx} variant="outline" className="bg-slate-50 capitalize">
                  <AmenityIcon className="w-3 h-3 mr-1" />
                  {amenity.replace('_', ' ')}
                </Badge>
              );
            })}
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <span className="text-2xl font-bold text-purple-600">{formatFCFA(venue.price_per_day)}</span>
              <span className="text-sm text-gray-500"> / day</span>
            </div>
            <Button onClick={() => onBook(venue)} className="bg-purple-600 hover:bg-purple-700 rounded-xl">
              Book Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function BanquetResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const city = searchParams.get('city') || '';
  const guests = parseInt(searchParams.get('guests')) || 0;

  useEffect(() => {
    loadVenues();
  }, [searchParams]);

  const loadVenues = async () => {
    try {
      setLoading(true);
      const params = {
        city,
        venue_type: searchParams.get('type') || '',
        capacity_min: guests
      };
      const res = await banquetApi.list(params);
      setVenues(res.data.banquets?.length > 0 ? res.data.banquets : MOCK_VENUES);
    } catch (error) {
      setVenues(MOCK_VENUES);
    } finally {
      setLoading(false);
    }
  };

  const filteredVenues = useMemo(() => {
    let filtered = [...venues];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.name?.toLowerCase().includes(query) ||
        v.city?.toLowerCase().includes(query)
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(v => v.venue_type === typeFilter);
    }
    
    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) => (a.price_per_day || 0) - (b.price_per_day || 0));
      case 'price_high':
        return filtered.sort((a, b) => (b.price_per_day || 0) - (a.price_per_day || 0));
      case 'capacity':
        return filtered.sort((a, b) => (b.capacity_max || 0) - (a.capacity_max || 0));
      case 'rating':
      default:
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
  }, [venues, sortBy, searchQuery, typeFilter]);

  const handleBook = (venue) => {
    sessionStorage.setItem('selectedVenue', JSON.stringify(venue));
    navigate(`/services/banquet/booking/${venue.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Finding venues for you...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/banquet')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-purple-600">Banquet Venues</h1>
              <p className="text-sm text-slate-500">{filteredVenues.length} venues found</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-white">
                <Building className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="capacity">Capacity</SelectItem>
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
        {filteredVenues.length === 0 ? (
          <div className="text-center py-16">
            <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No venues found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/banquet')} className="bg-purple-600">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredVenues.map((venue) => (
              <VenueCardGrid key={venue.id} venue={venue} onBook={handleBook} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVenues.map((venue) => (
              <VenueCardList key={venue.id} venue={venue} onBook={handleBook} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}