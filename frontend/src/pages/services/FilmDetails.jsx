import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film, Clock, Star, Calendar, MapPin, ArrowLeft, Play, Users } from 'lucide-react';
import { cinemaApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';
import { format, addDays } from 'date-fns';

export default function FilmDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [film, setFilm] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCinema, setSelectedCinema] = useState('all');

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return { value: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE, MMM d') };
  });

  useEffect(() => {
    loadFilm();
  }, [id]);

  const loadFilm = async () => {
    try {
      setLoading(true);
      const res = await cinemaApi.getFilm(id);
      setFilm(res.data);
      // Load showtimes
      setShowtimes([
        { id: '1', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: '2d', show_time: '10:30', price: 3500, available_seats: 120 },
        { id: '2', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: '3d', show_time: '14:00', price: 5000, available_seats: 85 },
        { id: '3', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: 'imax', show_time: '17:30', price: 7500, available_seats: 45 },
        { id: '4', cinema_name: 'Cinéma Le Wouri', city: 'Douala', screen_type: '2d', show_time: '11:00', price: 3000, available_seats: 100 },
        { id: '5', cinema_name: 'Cinéma Le Wouri', city: 'Douala', screen_type: '3d', show_time: '15:30', price: 4500, available_seats: 60 },
        { id: '6', cinema_name: 'Cinéma Le Wouri', city: 'Douala', screen_type: '2d', show_time: '20:00', price: 3500, available_seats: 90 }
      ]);
    } catch (error) {
      // Mock data
      setFilm({
        id: id,
        title: 'Black Panther: Wakanda Forever',
        genre: ['Action', 'Sci-Fi', 'Adventure'],
        duration_minutes: 161,
        rating: 'PG-13',
        language: 'English',
        director: 'Ryan Coogler',
        cast: ['Letitia Wright', 'Lupita Nyong\'o', 'Danai Gurira', 'Winston Duke'],
        description: 'The people of Wakanda fight to protect their home from intervening world powers as they mourn the death of King T\'Challa.',
        release_date: '2022-11-11',
        imdb_rating: 7.3
      });
      setShowtimes([
        { id: '1', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: '2d', show_time: '10:30', price: 3500, available_seats: 120 },
        { id: '2', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: '3d', show_time: '14:00', price: 5000, available_seats: 85 },
        { id: '3', cinema_name: 'CanalOlympia Yaoundé', city: 'Yaoundé', screen_type: 'imax', show_time: '17:30', price: 7500, available_seats: 45 },
        { id: '4', cinema_name: 'Cinéma Le Wouri', city: 'Douala', screen_type: '2d', show_time: '11:00', price: 3000, available_seats: 100 },
        { id: '5', cinema_name: 'Cinéma Le Wouri', city: 'Douala', screen_type: '3d', show_time: '15:30', price: 4500, available_seats: 60 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredShowtimes = showtimes.filter(st => 
    selectedCinema === 'all' || st.cinema_name === selectedCinema
  );

  const groupedShowtimes = filteredShowtimes.reduce((acc, st) => {
    if (!acc[st.cinema_name]) acc[st.cinema_name] = [];
    acc[st.cinema_name].push(st);
    return acc;
  }, {});

  const cinemaNames = [...new Set(showtimes.map(st => st.cinema_name))];

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (!film) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Film not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-black/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10" onClick={() => navigate('/services/cinema')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Movies
          </Button>
        </div>
      </div>

      {/* Film Hero */}
      <div className="bg-gradient-to-r from-[#082c59] to-purple-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="aspect-[2/3] bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <Film className="w-20 h-20 text-white/50" />
              </div>
            </div>
            {/* Details */}
            <div className="flex-1 text-white">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{film.title}</h1>
              <div className="flex flex-wrap gap-3 mb-4">
                <Badge className="bg-yellow-500 text-black">{film.rating}</Badge>
                {film.genre?.map(g => <Badge key={g} variant="outline" className="border-white/30 text-white">{g}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-6 text-slate-300 mb-4">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m</div>
                <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> {film.imdb_rating}/10 IMDb</div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {film.release_date}</div>
              </div>
              <p className="text-slate-300 mb-4">{film.description}</p>
              <div className="text-sm text-slate-400">
                <p><strong className="text-white">Director:</strong> {film.director}</p>
                <p><strong className="text-white">Cast:</strong> {film.cast?.join(', ')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-white">Showtimes</CardTitle>
              <div className="flex gap-4">
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {dates.map(d => <SelectItem key={d.value} value={d.value} className="text-white hover:bg-gray-700">{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedCinema} onValueChange={setSelectedCinema}>
                  <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
                    <MapPin className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all" className="text-white hover:bg-gray-700">All Cinemas</SelectItem>
                    {cinemaNames.map(name => <SelectItem key={name} value={name} className="text-white hover:bg-gray-700">{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.entries(groupedShowtimes).length === 0 ? (
              <div className="text-center py-8 text-gray-400">No showtimes available for this date</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedShowtimes).map(([cinemaName, times]) => (
                  <div key={cinemaName} className="border-b border-gray-700 pb-6 last:border-0">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <h3 className="font-semibold text-white text-lg">{cinemaName}</h3>
                      <span className="text-gray-500 text-sm">({times[0]?.city})</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {times.map(st => (
                        <Button key={st.id} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-[#082c59] hover:border-[#082c59] flex-col h-auto py-3 px-4" onClick={() => navigate(`/services/cinema/booking/${st.id}?film=${film.id}&date=${selectedDate}`)}>
                          <span className="font-bold text-lg">{st.show_time}</span>
                          <Badge className="mt-1 uppercase text-xs" variant={st.screen_type === 'imax' ? 'default' : 'secondary'}>{st.screen_type}</Badge>
                          <span className="text-sm mt-1">{formatFCFA(st.price)}</span>
                          <span className="text-xs text-gray-400 mt-1"><Users className="w-3 h-3 inline mr-1" />{st.available_seats} seats</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
