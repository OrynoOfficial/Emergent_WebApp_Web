import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Film, Clock, Star, Calendar, Play, 
  MapPin, Ticket, Loader2, Users, Monitor 
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import SubscribeButton from '@/components/shared/SubscribeButton';

const MOCK_FILM = {
  id: '1',
  title: 'Black Panther: Wakanda Forever',
  genre: ['Action', 'Sci-Fi', 'Adventure'],
  duration_minutes: 161,
  rating: 'PG-13',
  imdb_rating: 7.3,
  director: 'Ryan Coogler',
  cast: ['Letitia Wright', 'Lupita Nyongo', 'Danai Gurira', 'Winston Duke'],
  language: 'English',
  subtitles: ['French', 'Spanish'],
  description: 'The people of Wakanda fight to protect their home from intervening world powers as they mourn the death of King T\'Challa. Queen Ramonda, Shuri, M\'Baku, Okoye and the Dora Milaje fight to protect their nation.',
  release_date: '2024-11-11',
  status: 'now_showing',
  poster_url: ''
};

const MOCK_CINEMAS = [
  {
    id: 'c1',
    name: 'CanalOlympia Yaoundé',
    city: 'Yaoundé',
    address: 'Quartier Hippodrome',
    showtimes: [
      { id: 's1', show_time: '10:00', screen_type: '2d', price: 3500, available_seats: 45 },
      { id: 's2', show_time: '14:00', screen_type: '3d', price: 5000, available_seats: 32 },
      { id: 's3', show_time: '18:00', screen_type: '2d', price: 4000, available_seats: 60 },
      { id: 's4', show_time: '21:00', screen_type: 'imax', price: 7500, available_seats: 28 }
    ]
  },
  {
    id: 'c2',
    name: 'CanalOlympia Douala',
    city: 'Douala',
    address: 'Akwa, Boulevard de la Liberté',
    showtimes: [
      { id: 's5', show_time: '11:00', screen_type: '2d', price: 3500, available_seats: 50 },
      { id: 's6', show_time: '15:00', screen_type: '3d', price: 5000, available_seats: 40 },
      { id: 's7', show_time: '19:00', screen_type: '2d', price: 4000, available_seats: 55 },
      { id: 's8', show_time: '22:00', screen_type: 'vip', price: 10000, available_seats: 15 }
    ]
  }
];

const GENRE_COLORS = {
  'Action': 'bg-red-100 text-red-700',
  'Comedy': 'bg-yellow-100 text-yellow-700',
  'Drama': 'bg-blue-100 text-blue-700',
  'Horror': 'bg-purple-100 text-purple-700',
  'Sci-Fi': 'bg-cyan-100 text-cyan-700',
  'Romance': 'bg-pink-100 text-pink-700',
  'Animation': 'bg-green-100 text-green-700',
  'Adventure': 'bg-orange-100 text-orange-700',
  'Crime': 'bg-slate-100 text-slate-700'
};

const SCREEN_TYPE_LABELS = {
  '2d': { label: '2D', color: 'bg-gray-100 text-gray-700' },
  '3d': { label: '3D', color: 'bg-blue-100 text-blue-700' },
  'imax': { label: 'IMAX', color: 'bg-purple-100 text-purple-700' },
  'vip': { label: 'VIP', color: 'bg-amber-100 text-amber-700' }
};

export default function CinemaFilmDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [film, setFilm] = useState(null);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  
  // Generate next 7 days for date selection
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE, MMM d')
    };
  });

  useEffect(() => {
    loadFilmData();
  }, [id, selectedDate, selectedCity]);

  const loadFilmData = async () => {
    try {
      setLoading(true);
      // Try to load real data
      const [filmRes, cinemasRes] = await Promise.all([
        api.get(`/cinema/films/${id}`).catch(() => null),
        api.get('/cinema', { params: { city: selectedCity } }).catch(() => null)
      ]);
      
      if (filmRes?.data) {
        setFilm(filmRes.data);
      } else {
        setFilm(MOCK_FILM);
      }
      
      if (cinemasRes?.data?.cinemas?.length > 0) {
        // Load showtimes for each cinema
        const cinemasWithShowtimes = await Promise.all(
          cinemasRes.data.cinemas.map(async (cinema) => {
            const showtimesRes = await api.get(`/cinema/${cinema.id}/showtimes`, {
              params: { date: selectedDate, film_id: id }
            }).catch(() => null);
            return {
              ...cinema,
              showtimes: showtimesRes?.data?.showtimes || []
            };
          })
        );
        setCinemas(cinemasWithShowtimes);
      } else {
        setCinemas(MOCK_CINEMAS);
      }
    } catch (error) {
      console.error('Failed to load film data:', error);
      setFilm(MOCK_FILM);
      setCinemas(MOCK_CINEMAS);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShowtime = (cinema, showtime) => {
    // Store film and showtime data for booking
    sessionStorage.setItem('cinemaBookingData', JSON.stringify({
      film,
      cinema,
      showtime,
      date: selectedDate
    }));
    navigate(`/services/cinema/booking/${showtime.id}?film=${film.id}&date=${selectedDate}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  if (!film) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h2 className="text-xl font-semibold mb-2">Film not found</h2>
          <Button onClick={() => navigate('/services/cinema')} className="bg-[#082c59]">
            Back to Cinema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-black/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      {/* Film Hero */}
      <div className="relative">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="w-full md:w-80 flex-shrink-0">
              <div className="aspect-[2/3] bg-gradient-to-br from-[#082c59] to-purple-900 rounded-xl overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="w-24 h-24 text-white/30" />
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/60 px-3 py-1.5 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-white font-bold">{film.imdb_rating}</span>
                </div>
              </div>
            </div>

            {/* Film Info */}
            <div className="flex-1 text-white">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl md:text-4xl font-bold">{film.title}</h1>
              </div>
              
              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-4">
                {film.genre?.map(g => (
                  <Badge key={g} className={GENRE_COLORS[g] || 'bg-slate-100 text-slate-700'}>
                    {g}
                  </Badge>
                ))}
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 text-gray-300 mb-6">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m
                </span>
                <Badge variant="outline" className="border-gray-600 text-gray-300">
                  {film.rating}
                </Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {film.release_date}
                </span>
              </div>

              {/* Description */}
              <p className="text-gray-300 mb-6 leading-relaxed">{film.description}</p>

              {/* Cast & Crew */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {film.director && (
                  <div>
                    <span className="text-gray-500">Director:</span>
                    <span className="ml-2 text-white">{film.director}</span>
                  </div>
                )}
                {film.cast?.length > 0 && (
                  <div>
                    <span className="text-gray-500">Cast:</span>
                    <span className="ml-2 text-white">{film.cast.slice(0, 3).join(', ')}</span>
                  </div>
                )}
                {film.language && (
                  <div>
                    <span className="text-gray-500">Language:</span>
                    <span className="ml-2 text-white">{film.language}</span>
                  </div>
                )}
                {film.subtitles?.length > 0 && (
                  <div>
                    <span className="text-gray-500">Subtitles:</span>
                    <span className="ml-2 text-white">{film.subtitles.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5" /> Select Showtime
              </h2>
              
              <div className="flex flex-wrap gap-3">
                {/* Date Selection */}
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-44 bg-gray-700 border-gray-600 text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {dates.map(date => (
                      <SelectItem key={date.value} value={date.value} className="text-white hover:bg-gray-700">
                        {date.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* City Filter */}
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                    <MapPin className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="" className="text-white hover:bg-gray-700">All Cities</SelectItem>
                    <SelectItem value="Yaoundé" className="text-white hover:bg-gray-700">Yaoundé</SelectItem>
                    <SelectItem value="Douala" className="text-white hover:bg-gray-700">Douala</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cinemas List */}
            <div className="space-y-6">
              {cinemas.filter(c => !selectedCity || c.city === selectedCity).map(cinema => (
                <div key={cinema.id} className="bg-gray-700/50 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{cinema.name}</h3>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {cinema.address}, {cinema.city}
                      </p>
                    </div>
                  </div>

                  {/* Showtimes Grid */}
                  {cinema.showtimes?.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {cinema.showtimes.map(showtime => {
                        const screenType = SCREEN_TYPE_LABELS[showtime.screen_type] || SCREEN_TYPE_LABELS['2d'];
                        return (
                          <button
                            key={showtime.id}
                            onClick={() => handleSelectShowtime(cinema, showtime)}
                            className="bg-gray-600 hover:bg-[#082c59] transition-colors rounded-lg p-3 text-left group"
                          >
                            <div className="text-lg font-bold text-white">{showtime.show_time}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`text-xs ${screenType.color}`}>
                                {screenType.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-300 mt-2">
                              {formatFCFA(showtime.price)}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {showtime.available_seats} seats
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-4">No showtimes available for this date</p>
                  )}
                </div>
              ))}

              {cinemas.filter(c => !selectedCity || c.city === selectedCity).length === 0 && (
                <div className="text-center py-12">
                  <Monitor className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No cinemas found in this location</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
