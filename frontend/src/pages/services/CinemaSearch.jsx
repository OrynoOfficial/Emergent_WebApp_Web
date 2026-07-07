import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Film, Play, Calendar, Clock, Star, Ticket } from 'lucide-react';
import LocationInput from '@/components/shared/LocationInput';
import LandingSmartSearch from '@/components/search/LandingSmartSearch';

const GENRES = ['All Genres', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Animation'];

export default function CinemaSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    city: '',
    genre: '',
    showing: 'all'
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
    if (searchParams.showing && searchParams.showing !== 'all') params.set('showing', searchParams.showing);
    navigate(`/services/cinema/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white pt-14 pb-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Film className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
          <h1 className="text-3xl font-bold mb-2">{t('services.hero_cinema')}</h1>
          <p className="text-sm text-slate-200 mb-5">Find movies and book tickets at cinemas near you</p>
          <div className="max-w-2xl mx-auto text-left">
            <LandingSmartSearch
              serviceType="cinema"
              resultsPath="/services/cinema/results"
              cityParam="city"
              cityLabel="Destination"
              selectedCity={searchParams.city}
              onSelectCity={(city) => {
                setSearchParams(p => ({ ...p, city }));
                setErrors(e => ({ ...e, city: undefined }));
              }}
              onClearCity={() => setSearchParams(p => ({ ...p, city: '' }))}
              error={errors.city}
            />
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <Card className="shadow-xl">
          <CardContent className="p-5">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* City owned by hero smart search (iter 251). */}

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

              {/* Subtle status refinement — default shows both Now Showing and Coming Soon */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="uppercase tracking-wider">Show:</span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5" data-testid="cinema-status-segment">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'now_showing', label: 'Now Showing' },
                    { value: 'coming_soon', label: 'Coming Soon' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSearchParams(p => ({ ...p, showing: opt.value }))}
                      data-testid={`cinema-status-${opt.value}`}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        searchParams.showing === opt.value
                          ? 'bg-[#082c59] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
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
        <h2 className="text-2xl font-bold text-center mb-8 text-[#082c59]">{t('services.why_book')}</h2>
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
