import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Film, Clock, Star, Calendar, Play, Ticket, Loader2, MapPin } from 'lucide-react';
import { cinemaApi } from '@/api/management';
import { formatFCFA } from '@/utils/currency';

const MOCK_FILMS = [
  {
    id: '1',
    title: 'Black Panther: Wakanda Forever',
    genre: ['Action', 'Sci-Fi'],
    duration_minutes: 161,
    rating: 'PG-13',
    imdb_rating: 7.3,
    poster_url: '',
    status: 'now_showing',
    description: 'The people of Wakanda fight to protect their home.',
    release_date: '2024-11-11'
  },
  {
    id: '2',
    title: 'Avatar: The Way of Water',
    genre: ['Action', 'Adventure', 'Sci-Fi'],
    duration_minutes: 192,
    rating: 'PG-13',
    imdb_rating: 7.6,
    poster_url: '',
    status: 'now_showing',
    description: 'Jake Sully lives with his newfound family.',
    release_date: '2024-12-16'
  },
  {
    id: '3',
    title: 'The Batman',
    genre: ['Action', 'Crime', 'Drama'],
    duration_minutes: 176,
    rating: 'PG-13',
    imdb_rating: 7.8,
    poster_url: '',
    status: 'now_showing',
    description: 'When a sadistic serial killer begins murdering key political figures.',
    release_date: '2024-03-04'
  },
  {
    id: '4',
    title: 'Top Gun: Maverick',
    genre: ['Action', 'Drama'],
    duration_minutes: 130,
    rating: 'PG-13',
    imdb_rating: 8.3,
    poster_url: '',
    status: 'now_showing',
    description: 'After more than thirty years of service as a Navy pilot.',
    release_date: '2024-05-27'
  },
  {
    id: '5',
    title: 'Dune: Part Two',
    genre: ['Action', 'Adventure', 'Drama'],
    duration_minutes: 166,
    rating: 'PG-13',
    imdb_rating: 8.5,
    poster_url: '',
    status: 'coming_soon',
    description: 'Paul Atreides unites with Chani and the Fremen.',
    release_date: '2025-03-01'
  },
  {
    id: '6',
    title: 'Spider-Man: Beyond the Spider-Verse',
    genre: ['Animation', 'Action', 'Adventure'],
    duration_minutes: 140,
    rating: 'PG',
    imdb_rating: 8.7,
    poster_url: '',
    status: 'coming_soon',
    description: 'Miles Morales continues his adventures.',
    release_date: '2025-03-28'
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

const FilmCard = ({ film, onViewDetails }) => {
  const isComingSoon = film.status === 'coming_soon';
  
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 bg-white group cursor-pointer" onClick={() => onViewDetails(film)}>
      {/* Poster */}
      <div className="h-64 bg-gradient-to-br from-[#082c59] to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="w-20 h-20 text-white/30" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute bottom-4 left-4 right-4">
          <Badge className={isComingSoon ? 'bg-amber-500' : 'bg-green-500'}>
            {isComingSoon ? 'Coming Soon' : 'Now Showing'}
          </Badge>
        </div>
        {film.imdb_rating && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-lg">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-semibold text-sm">{film.imdb_rating}</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1 group-hover:text-[#082c59] transition-colors">
          {film.title}
        </h3>
        
        {/* Genres */}
        <div className="flex flex-wrap gap-1 mb-3">
          {film.genre?.slice(0, 3).map(g => (
            <Badge key={g} variant="outline" className={`text-xs ${GENRE_COLORS[g] || 'bg-slate-100 text-slate-700'}`}>
              {g}
            </Badge>
          ))}
        </div>
        
        {/* Info */}
        <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m</span>
          </div>
          <Badge variant="outline" className="text-xs">{film.rating}</Badge>
        </div>
        
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{film.description}</p>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            <span>{film.release_date}</span>
          </div>
          <Button className="bg-[#082c59] hover:bg-[#0a3a75]" size="sm">
            {isComingSoon ? 'Notify Me' : 'View Showtimes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function CinemaResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating');
  
  const city = searchParams.get('city') || '';
  const genre = searchParams.get('genre') || '';
  const showing = searchParams.get('showing') || 'now_showing';

  useEffect(() => {
    loadFilms();
  }, [city, genre, showing]);

  const loadFilms = async () => {
    setLoading(true);
    try {
      const res = await cinemaApi.getFilms({ status: showing, genre });
      if (res.data?.films?.length > 0) {
        setFilms(res.data.films);
      } else {
        // Filter mock data
        let filtered = [...MOCK_FILMS];
        if (showing) {
          filtered = filtered.filter(f => f.status === showing);
        }
        if (genre && genre !== 'All Genres') {
          filtered = filtered.filter(f => f.genre?.includes(genre));
        }
        setFilms(filtered.length > 0 ? filtered : MOCK_FILMS.filter(f => f.status === showing));
      }
    } catch (error) {
      console.error('Failed to load films:', error);
      setFilms(MOCK_FILMS.filter(f => showing ? f.status === showing : true));
    } finally {
      setLoading(false);
    }
  };

  const sortedFilms = [...films].sort((a, b) => {
    switch (sortBy) {
      case 'rating': return (b.imdb_rating || 0) - (a.imdb_rating || 0);
      case 'title': return a.title.localeCompare(b.title);
      case 'duration': return b.duration_minutes - a.duration_minutes;
      case 'newest': return new Date(b.release_date) - new Date(a.release_date);
      default: return 0;
    }
  });

  const handleViewDetails = (film) => {
    navigate(`/services/cinema/film/${film.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/services/cinema')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#082c59]">
                  {showing === 'now_showing' ? 'Now Showing' : 'Coming Soon'}
                </h1>
                <p className="text-sm text-gray-600">
                  {city && `${city} • `}
                  {genre && genre !== 'All Genres' && `${genre} • `}
                  {sortedFilms.length} films
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Toggle Showing */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={showing === 'now_showing' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(`/services/cinema/results?city=${city}&genre=${genre}&showing=now_showing`)}
                  className={showing === 'now_showing' ? 'bg-[#082c59]' : ''}
                >
                  <Play className="w-4 h-4 mr-1" /> Now
                </Button>
                <Button
                  variant={showing === 'coming_soon' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(`/services/cinema/results?city=${city}&genre=${genre}&showing=coming_soon`)}
                  className={showing === 'coming_soon' ? 'bg-[#082c59]' : ''}
                >
                  <Calendar className="w-4 h-4 mr-1" /> Soon
                </Button>
              </div>
              
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#082c59] mx-auto mb-4" />
            <p className="text-gray-600">Finding movies...</p>
          </div>
        ) : sortedFilms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg">
            <Film className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No films found</h2>
            <p className="text-gray-500 mb-4">Try a different filter or check back later</p>
            <Button onClick={() => navigate('/services/cinema')} className="bg-[#082c59]">
              Back to Search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedFilms.map(film => (
              <FilmCard 
                key={film.id} 
                film={film}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
