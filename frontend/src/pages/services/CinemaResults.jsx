import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Film, Clock, Star, Ticket, Loader2, Search, SlidersHorizontal, Heart } from 'lucide-react';
import { cinemaApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import { formatFCFA } from '@/utils/currency';
import { format } from 'date-fns';

const PAGE_SIZE = 12;

const GENRE_COLORS = {
  'Action': 'bg-red-500 text-white',
  'Comedy': 'bg-yellow-500 text-white',
  'Drama': 'bg-blue-500 text-white',
  'Horror': 'bg-purple-500 text-white',
  'Sci-Fi': 'bg-cyan-500 text-white',
  'Romance': 'bg-pink-500 text-white',
  'Animation': 'bg-green-500 text-white',
  'Adventure': 'bg-orange-500 text-white',
  'Crime': 'bg-slate-600 text-white'
};

// Grid View Film Card
const FilmCardGrid = ({ film, onViewDetails, isFav, toggleFav }) => {
  // Favourites handled by parent via isFav/toggleFav props
  const isComingSoon = film.status === 'coming_soon';
  const defaultPoster = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400';
  
  return (
    <Card className="group overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer" onClick={() => onViewDetails(film)}>
      {/* Poster */}
      <div className="h-72 relative overflow-hidden">
        <img
          src={film.poster_url || defaultPoster}
          alt={film.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Favorite & Subscribe buttons */}
        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <SubscribeButton operatorId={film.operator_id} operatorName={film.operator_name} variant="icon" />
          <button
            onClick={(e) => { e.stopPropagation(); if(toggleFav) toggleFav(film);  }}
            className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all"
          >
            <Heart className={`h-5 w-5 ${(isFav && isFav(film._id || film.id)) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </button>
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <Badge className={isComingSoon ? 'bg-amber-500' : 'bg-emerald-500'}>
            {isComingSoon ? 'Coming Soon' : 'Now Showing'}
          </Badge>
        </div>
        
        {/* IMDB Rating */}
        {film.imdb_rating && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-semibold text-sm">{film.imdb_rating}</span>
          </div>
        )}
        
        {/* Bottom Info */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">{film.title}</h3>
          <div className="flex flex-wrap gap-1">
            {film.genre?.slice(0, 2).map(g => (
              <Badge key={g} className={`text-xs ${GENRE_COLORS[g] || 'bg-slate-500 text-white'}`}>
                {g}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <CardContent className="p-5">
        {/* Duration & Rating */}
        <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m</span>
          </div>
          <Badge variant="outline" className="text-xs">{film.rating}</Badge>
        </div>
        
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{film.description}</p>
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <div className="text-xl font-bold text-[#082c59]">{formatFCFA(film.price_from || 3500)}</div>
          </div>
          <Button className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
            <Ticket className="w-4 h-4 mr-2" /> Get Tickets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// List View Film Card
const FilmCardList = ({ film, onViewDetails, isFav, toggleFav }) => {
  const isComingSoon = film.status === 'coming_soon';
  const defaultPoster = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400';
  
  return (
    <Card className="overflow-hidden bg-white rounded-2xl border-0 shadow-md hover:shadow-xl transition-all cursor-pointer" onClick={() => onViewDetails(film)}>
      <div className="flex flex-col md:flex-row">
        {/* Poster Section */}
        <div className="md:w-1/4 h-64 md:h-auto relative">
          <img
            src={film.poster_url || defaultPoster}
            alt={film.title}
            className="w-full h-full object-cover"
          />
          <Badge className={`absolute top-3 left-3 ${isComingSoon ? 'bg-amber-500' : 'bg-emerald-500'}`}>
            {isComingSoon ? 'Coming Soon' : 'Now Showing'}
          </Badge>
          {film.imdb_rating && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {film.imdb_rating}
            </div>
          )}
        </div>
        
        {/* Content Section */}
        <div className="md:w-3/4 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {film.genre?.map(g => (
                <Badge key={g} className={`text-xs ${GENRE_COLORS[g] || 'bg-slate-500 text-white'}`}>
                  {g}
                </Badge>
              ))}
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">{film.title}</h3>
            <p className="text-slate-600 mb-4">{film.description}</p>
            
            {/* Info */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m</span>
              </div>
              <Badge variant="outline">{film.rating}</Badge>
            </div>
          </div>
          
          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div>
              <div className="text-sm text-slate-500">Tickets from</div>
              <div className="text-2xl font-bold text-[#082c59]">{formatFCFA(film.price_from || 3500)}</div>
            </div>
            <Button className="bg-[#082c59] hover:bg-[#0a3a75] rounded-xl">
              <Ticket className="w-4 h-4 mr-2" /> Get Tickets
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function CinemaResults() {

  const { isFav, toggleFav } = useFavourites('cinema');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [films, setFilms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadFilms();
  }, [searchParams]);

  const loadFilms = async () => {
    setLoading(true);
    try {
      const res = await cinemaApi.listFilms({ city });
      setFilms(res.data.films || res.data || []);
    } catch (error) {
      console.error('Failed to load films:', error);
      setFilms([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFilms = useMemo(() => {
    let filtered = [...films];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.title?.toLowerCase().includes(query) ||
        f.genre?.some(g => g.toLowerCase().includes(query))
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    
    switch (sortBy) {
      case 'title':
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'duration':
        return filtered.sort((a, b) => a.duration_minutes - b.duration_minutes);
      case 'rating':
      default:
        return filtered.sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0));
    }
  }, [films, sortBy, searchQuery, statusFilter]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredFilms.length / PAGE_SIZE));
  const pagedFilms = useMemo(
    () => filteredFilms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredFilms, page]
  );

  const handleViewDetails = (film) => {
    sessionStorage.setItem('selectedFilm', JSON.stringify({ ...film, date, city }));
    navigate(`/services/cinema/film/${film.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Loading movies...</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/cinema')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#082c59]">Movies {city && `in ${city}`}</h1>
              <p className="text-sm text-slate-500">
                {filteredFilms.length} movies available • {format(new Date(date), 'EEE, MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white">
                <Film className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Movies</SelectItem>
                <SelectItem value="now_showing">Now Showing</SelectItem>
                <SelectItem value="coming_soon">Coming Soon</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredFilms.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No movies found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/cinema')} className="bg-[#082c59]">
              Modify Search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="cinema-results-grid">
            {pagedFilms.map((film) => (
              <FilmCardGrid key={film.id} film={film} onViewDetails={handleViewDetails} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : viewMode === 'details' ? (
          <div className="space-y-6" data-testid="cinema-results-details">
            {pagedFilms.map((film) => (
              <FilmCardList key={film.id} film={film} onViewDetails={handleViewDetails} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          /* List view — compact rows */
          <Card className="overflow-hidden" data-testid="cinema-results-list">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Genre</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFilms.map((film) => (
                    <tr key={film.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => handleViewDetails(film)}>
                      <td className="px-4 py-3 font-medium text-slate-900">{film.title}</td>
                      <td className="px-4 py-3 text-slate-700">{film.genre?.slice(0, 2).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{film.duration_minutes ? `${Math.floor(film.duration_minutes / 60)}h ${film.duration_minutes % 60}m` : '—'}</td>
                      <td className="px-4 py-3">
                        {film.imdb_rating ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {film.imdb_rating}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={film.status === 'coming_soon' ? 'bg-amber-500' : 'bg-emerald-500'}>
                          {film.status === 'coming_soon' ? 'Coming Soon' : 'Now Showing'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#082c59]">{formatFCFA(film.price_from || 3500)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="bg-[#082c59] hover:bg-[#0a3a75]" onClick={(e) => { e.stopPropagation(); handleViewDetails(film); }}>
                          <Ticket className="w-4 h-4 mr-1" /> Tickets
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {filteredFilms.length > 0 && (
          <div className="mt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              total={filteredFilms.length}
              pageSize={PAGE_SIZE}
              itemLabel="movie"
            />
          </div>
        )}
      </div>
    </div>
  );
}