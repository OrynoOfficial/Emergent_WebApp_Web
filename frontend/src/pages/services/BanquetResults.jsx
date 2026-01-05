import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Star, Utensils, Music, Camera, ArrowLeft, Filter } from 'lucide-react';
import { banquetApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';

export default function BanquetResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    loadVenues();
  }, [searchParams]);

  const loadVenues = async () => {
    try {
      setLoading(true);
      const params = {
        city: searchParams.get('city') || '',
        venue_type: searchParams.get('type') || '',
        capacity_min: parseInt(searchParams.get('guests')) || 0
      };
      const res = await banquetApi.list(params);
      setVenues(res.data.banquets || []);
    } catch (error) {
      console.log('Banquets not available');
      // Mock data for demo
      setVenues([
        { id: '1', name: 'Grand Palace Hall', city: 'Yaoundé', venue_type: 'wedding', capacity_min: 100, capacity_max: 500, price_per_day: 500000, rating: 4.8, amenities: ['catering', 'decoration', 'sound_system', 'parking'], images: [] },
        { id: '2', name: 'Conference Center Elite', city: 'Douala', venue_type: 'conference', capacity_min: 50, capacity_max: 200, price_per_day: 300000, rating: 4.5, amenities: ['projector', 'wifi', 'catering', 'parking'], images: [] },
        { id: '3', name: 'Garden Event Space', city: 'Yaoundé', venue_type: 'birthday', capacity_min: 30, capacity_max: 150, price_per_day: 200000, rating: 4.6, amenities: ['outdoor', 'catering', 'decoration'], images: [] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case 'catering': return <Utensils className="w-4 h-4" />;
      case 'sound_system': case 'music': return <Music className="w-4 h-4" />;
      case 'decoration': case 'photography': return <Camera className="w-4 h-4" />;
      default: return null;
    }
  };

  const sortedVenues = [...venues].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'price_low') return (a.price_per_day || 0) - (b.price_per_day || 0);
    if (sortBy === 'price_high') return (b.price_per_day || 0) - (a.price_per_day || 0);
    if (sortBy === 'capacity') return (b.capacity_max || 0) - (a.capacity_max || 0);
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/services/banquet')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">Banquet Venues</h1>
                <p className="text-sm text-gray-600">{venues.length} venues found</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">Loading venues...</div>
        ) : sortedVenues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No venues found matching your criteria.</p>
            <Button onClick={() => navigate('/services/banquet')} className="mt-4 bg-[#082c59]">Modify Search</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVenues.map(venue => (
              <Card key={venue.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/services/banquet/booking/${venue.id}`)}>
                <div className="h-48 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow">
                      <Users className="w-8 h-8 text-purple-600" />
                    </div>
                    <Badge className="capitalize">{venue.venue_type}</Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{venue.name}</h3>
                    {venue.rating && (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">{venue.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> {venue.city}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm mb-3">
                    <Users className="w-4 h-4 mr-1" /> {venue.capacity_min} - {venue.capacity_max} guests
                  </div>
                  {venue.amenities && venue.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {venue.amenities.slice(0, 4).map(amenity => (
                        <Badge key={amenity} variant="outline" className="text-xs capitalize">
                          {getAmenityIcon(amenity)} {amenity.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div>
                      <span className="text-lg font-bold text-[#082c59]">{formatFCFA(venue.price_per_day)}</span>
                      <span className="text-sm text-gray-500"> / day</span>
                    </div>
                    <Button size="sm" className="bg-[#082c59]">Book Now</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
