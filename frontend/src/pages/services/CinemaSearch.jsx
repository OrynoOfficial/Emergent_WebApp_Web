import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Film, Play, Calendar, Clock, Star, Ticket } from 'lucide-react';
import LocationInput from '@/components/shared/LocationInput';

const GENRES = ['All Genres', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Animation'];

export default function CinemaSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    genre: '',
    showing: 'now_showing'
  });
  const [errors, setErrors] = useState({});
  const [shakeFields, setShakeFields] = useState({});

  const validateForm = () => {
    const newErrors = {};
    const fieldsToShake = {};
    
    if (!searchParams.city) {
      newErrors.city = 'City is required';
      fieldsToShake.city = true;
    }
    
    setErrors(newErrors);
    setShakeFields(fieldsToShake);
    
    if (Object.keys(fieldsToShake).length > 0) {
      setTimeout(() => setShakeFields({}), 500);
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const params = new URLSearchParams();
    params.set('city', searchParams.city);
    if (searchParams.genre && searchParams.genre !== 'All Genres') params.set('genre', searchParams.genre);
    params.set('showing', searchParams.showing);
    navigate(`/services/cinema/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-4xl font-bold mb-4">Cinema & Movies</h1>
          <p className="text-lg text-slate-200">Find movies and book tickets at cinemas near you</p>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <Card className="shadow-xl">
          <CardContent className="p-6">
            {/* Showing Toggle */}
            <div className="flex items-center gap-4 mb-6">
              <Button
                type="button"
                variant={searchParams.showing === 'now_showing' ? "default" : "outline"}
                onClick={() => setSearchParams(p => ({ ...p, showing: 'now_showing' }))}
                className={searchParams.showing === 'now_showing' ? "bg-[#082c59]" : ""}
              >
                <Play className="w-4 h-4 mr-2" /> Now Showing
              </Button>
              <Button
                type="button"
                variant={searchParams.showing === 'coming_soon' ? "default" : "outline"}
                onClick={() => setSearchParams(p => ({ ...p, showing: 'coming_soon' }))}
                className={searchParams.showing === 'coming_soon' ? "bg-[#082c59]" : ""}
              >
                <Calendar className="w-4 h-4 mr-2" /> Coming Soon
              </Button>
            </div>

            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* City */}
                <div>
                  <LocationInput
                    label="City"
                    value={searchParams.city}
                    onChange={(v) => {
                      setSearchParams(p => ({ ...p, city: v }));
                      setErrors(e => ({ ...e, city: undefined }));
                    }}
                    placeholder="Search city..."
                    required
                    error={errors.city}
                    shake={shakeFields.city}
                    iconColor="text-yellow-500"
                  />
                </div>

                {/* Genre */}
                <div>
                  <Label>Genre</Label>
                  <Select value={searchParams.genre} onValueChange={v => setSearchParams(p => ({ ...p, genre: v }))}>
                    <SelectTrigger className="bg-white mt-1 h-12">
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {GENRES.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12 text-lg">
                <Search className="w-5 h-5 mr-2" /> Search Movies
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">Why Book With Us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="font-semibold mb-2">Latest Releases</h3>
            <p className="text-gray-600 text-sm">Watch the newest blockbusters</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-2">Easy Booking</h3>
            <p className="text-gray-600 text-sm">Choose your seats and pay online</p>
          </Card>
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Multiple Showtimes</h3>
            <p className="text-gray-600 text-sm">Flexible schedules throughout the day</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
