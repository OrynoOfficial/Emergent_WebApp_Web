import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Film, Clock, Star, Ticket, Loader2, Search, SlidersHorizontal, Heart, Sparkles, PlayCircle,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cinemaApi } from '@/api/management';
import { useFavourites } from '@/hooks/useFavourites';
import SubscribeButton from '@/components/shared/SubscribeButton';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';

const PAGE_SIZE = 12;

const GENRE_OPTIONS = [
  'Thriller', 'Action', 'Comedy', 'Horror', 'Documentary', 'Adventure',
  'Crime', 'Drama', 'Romance', 'Sci-Fi', 'Musical', 'Fantasy',
  'Family/Children', 'Animation',
];

const RATING_OPTIONS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

const GENRE_COLORS = {
  Action:    'bg-red-500/20 text-red-300 border-red-500/40',
  Comedy:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  Drama:     'bg-blue-500/20 text-blue-300 border-blue-500/40',
  Horror:    'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'Sci-Fi':  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  Romance:   'bg-pink-500/20 text-pink-300 border-pink-500/40',
  Animation: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Adventure: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Crime:     'bg-slate-500/20 text-slate-200 border-slate-500/40',
};

const RATING_COLORS = {
  G:       'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  PG:      'bg-sky-500/20 text-sky-300 border-sky-500/40',
  'PG-13': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  R:       'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'NC-17': 'bg-red-600/20 text-red-300 border-red-500/40',
};

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const FilmPosterFallback = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80';

// Premium Grid Card
function FilmCardGrid({ film, onViewDetails, isFav, toggleFav }) {
  const isComingSoon = film.status === 'coming_soon';
  return (
    <div
      className="group relative cursor-pointer"
      onClick={() => onViewDetails(film)}
      data-testid={`film-card-${film.id || film._id}`}
    >
      {/* Glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-cyan-500/0 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <Card className="relative overflow-hidden bg-slate-900 border border-slate-800 group-hover:border-cyan-500/40 rounded-2xl transition-all duration-300 transform group-hover:-translate-y-1.5">
        {/* Poster */}
        <div className="relative h-72 overflow-hidden">
          <img
            src={film.poster_url || FilmPosterFallback}
            alt={film.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Top corners */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            <SubscribeButton operatorId={film.operator_id} operatorName={film.operator_name} variant="icon" />
            <button
              onClick={(e) => { e.stopPropagation(); toggleFav?.(film); }}
              className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition border border-white/10"
              data-testid={`favourite-${film.id || film._id}`}
            >
              <Heart className={`h-4 w-4 ${isFav?.(film._id || film.id) ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            </button>
          </div>
          <Badge className={`absolute top-3 left-3 backdrop-blur-sm border ${
            isComingSoon ? 'bg-amber-500/30 text-amber-100 border-amber-400/40' : 'bg-cyan-500/30 text-cyan-100 border-cyan-400/40'
          }`}>
            {isComingSoon ? 'Coming Soon' : 'Now Showing'}
          </Badge>

          {/* Center play on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-14 h-14 rounded-full bg-cyan-500/90 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.7)] backdrop-blur-sm">
              <PlayCircle className="w-8 h-8 text-slate-950" />
            </div>
          </div>

          {/* IMDb / rating */}
          {film.imdb_rating && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-amber-500/90 text-slate-950 text-xs font-bold px-2 py-1 rounded-full shadow-md">
              <Star className="w-3 h-3 fill-slate-950" /> {film.imdb_rating}
            </div>
          )}
        </div>

        {/* Info */}
        <CardContent className="p-4 bg-gradient-to-b from-slate-900 to-slate-950">
          <h3 className="font-bold text-base text-white line-clamp-1 mb-1.5 group-hover:text-cyan-300 transition-colors">{film.title}</h3>
          <div className="flex flex-wrap gap-1 mb-2.5">
            {film.genre?.slice(0, 3).map((g) => (
              <Badge key={g} variant="outline" className={`text-[10px] border ${GENRE_COLORS[g] || 'bg-slate-700/40 text-slate-300 border-slate-600/40'}`}>{g}</Badge>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(film.duration_minutes)}</span>
            <Badge variant="outline" className={`text-[10px] border ${RATING_COLORS[film.rating] || 'border-slate-600/40 text-slate-300'}`}>{film.rating || 'NR'}</Badge>
          </div>
          {film.description && (
            <p className="text-xs text-slate-400 line-clamp-2 mb-3">{film.description}</p>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">From</div>
              <div className="text-lg font-bold text-cyan-300 tabular-nums">{formatFCFA(film.price_from || 3500)}</div>
            </div>
            <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg shadow-md shadow-cyan-500/30" data-testid={`get-tickets-${film.id || film._id}`}>
              <Ticket className="w-3.5 h-3.5 mr-1" /> Tickets
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Premium List/Details Card (horizontal)
function FilmCardList({ film, onViewDetails, isFav, toggleFav }) {
  const isComingSoon = film.status === 'coming_soon';
  return (
    <Card
      className="overflow-hidden bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all cursor-pointer group"
      onClick={() => onViewDetails(film)}
    >
      <div className="flex flex-col md:flex-row">
        <div className="md:w-56 h-64 md:h-auto relative flex-shrink-0">
          <img src={film.poster_url || FilmPosterFallback} alt={film.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-900 md:bg-gradient-to-r md:from-transparent md:to-slate-900" />
          <Badge className={`absolute top-3 left-3 backdrop-blur-sm border ${isComingSoon ? 'bg-amber-500/30 text-amber-100 border-amber-400/40' : 'bg-cyan-500/30 text-cyan-100 border-cyan-400/40'}`}>
            {isComingSoon ? 'Coming Soon' : 'Now Showing'}
          </Badge>
          {film.imdb_rating && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-amber-500/90 text-slate-950 text-xs font-bold px-2 py-1 rounded-full">
              <Star className="w-3 h-3 fill-slate-950" /> {film.imdb_rating}
            </div>
          )}
        </div>
        <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-1 mb-2">
              {film.genre?.map((g) => (
                <Badge key={g} variant="outline" className={`text-[10px] border ${GENRE_COLORS[g] || 'bg-slate-700/40 text-slate-300 border-slate-600/40'}`}>{g}</Badge>
              ))}
              <Badge variant="outline" className={`text-[10px] border ${RATING_COLORS[film.rating] || 'border-slate-600/40 text-slate-300'}`}>{film.rating || 'NR'}</Badge>
            </div>
            <h3 className="font-bold text-xl text-white mb-2 group-hover:text-cyan-300 transition-colors">{film.title}</h3>
            <p className="text-slate-400 mb-4 line-clamp-2 text-sm">{film.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(film.duration_minutes)}</span>
              {film.director && <span>Dir. {film.director}</span>}
              {film.language && <span>{film.language}</span>}
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Tickets from</div>
              <div className="text-2xl font-bold text-cyan-300 tabular-nums">{formatFCFA(film.price_from || 3500)}</div>
            </div>
            <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg shadow-md shadow-cyan-500/30">
              <Ticket className="w-4 h-4 mr-2" /> Get tickets
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

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
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [page, setPage] = useState(1);

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const dateValid = isValid(parseISO(date));
  const showingParam = searchParams.get('showing') || 'all';
  const genreParam = searchParams.get('genre') || '';

  // Sync the status filter with the URL `showing` param when it changes
  useEffect(() => {
    setStatusFilter(showingParam === 'now_showing' || showingParam === 'coming_soon' ? showingParam : 'all');
  }, [showingParam]);

  // Pre-select the genre coming from the search page
  useEffect(() => {
    if (genreParam && genreParam !== 'All Genres') {
      setSelectedGenres([genreParam]);
    }
  }, [genreParam]);

  useEffect(() => { loadFilms(); /* eslint-disable-next-line */ }, [searchParams]);

  const loadFilms = async () => {
    setLoading(true);
    try {
      const params = {};
      if (city) params.city = city;
      const res = await cinemaApi.listFilms(params);
      setFilms(res.data.films || res.data || []);
    } catch (e) {
      console.error('Failed to load films:', e);
      setFilms([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (g) => {
    setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedGenres([]);
    setRatingFilter('all');
    setDurationFilter('all');
  };

  const filteredFilms = useMemo(() => {
    let filtered = [...films];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((f) => f.title?.toLowerCase().includes(q) || f.genre?.some((g) => g.toLowerCase().includes(q)));
    }
    if (statusFilter !== 'all') filtered = filtered.filter((f) => f.status === statusFilter);
    if (selectedGenres.length > 0) {
      // OR-match: include films that have ANY of the selected genres
      const lowered = selectedGenres.map((g) => g.toLowerCase());
      filtered = filtered.filter((f) => {
        const filmGenres = Array.isArray(f.genre) ? f.genre : (f.genre ? [f.genre] : []);
        return filmGenres.some((fg) => lowered.includes(String(fg).toLowerCase()));
      });
    }
    if (ratingFilter !== 'all') {
      filtered = filtered.filter((f) => f.rating === ratingFilter);
    }
    if (durationFilter !== 'all') {
      filtered = filtered.filter((f) => {
        const d = f.duration_minutes || 0;
        if (durationFilter === 'short') return d > 0 && d <= 90;
        if (durationFilter === 'medium') return d > 90 && d <= 120;
        if (durationFilter === 'long') return d > 120;
        return true;
      });
    }
    switch (sortBy) {
      case 'title':    return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'duration': return filtered.sort((a, b) => a.duration_minutes - b.duration_minutes);
      case 'rating':
      default:         return filtered.sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0));
    }
  }, [films, sortBy, searchQuery, statusFilter, selectedGenres, ratingFilter, durationFilter]);

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sortBy, selectedGenres, ratingFilter, durationFilter]);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-cyan-200/80 tracking-wide uppercase text-xs">Loading movies…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Ambient cyan glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-cyan-400/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative bg-black/40 backdrop-blur-xl border-b border-cyan-500/10 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/services/cinema')} className="gap-2 text-cyan-300 hover:bg-cyan-500/10" data-testid="cinema-results-back">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex-1">
              <p className="text-cyan-400/70 text-[11px] tracking-[0.3em] uppercase mb-0.5 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Now playing</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Movies {city && <span className="text-cyan-300">in {city}</span>}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {filteredFilms.length} movie{filteredFilms.length !== 1 ? 's' : ''} available · {dateValid ? format(parseISO(date), 'EEE, MMM d, yyyy') : date}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search movies, genres…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/60 border-slate-700/60 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/40"
                data-testid="cinema-results-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-slate-800/60 border-slate-700/60 text-white">
                <Film className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="all">All movies</SelectItem>
                <SelectItem value="now_showing">Now Showing</SelectItem>
                <SelectItem value="coming_soon">Coming Soon</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-32 bg-slate-800/60 border-slate-700/60 text-white" data-testid="filter-rating">
                <Star className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="all">Any rating</SelectItem>
                {RATING_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={durationFilter} onValueChange={setDurationFilter}>
              <SelectTrigger className="w-40 bg-slate-800/60 border-slate-700/60 text-white" data-testid="filter-duration">
                <Clock className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="all">Any length</SelectItem>
                <SelectItem value="short">Under 90 min</SelectItem>
                <SelectItem value="medium">90 – 120 min</SelectItem>
                <SelectItem value="long">Over 120 min</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-slate-800/60 border-slate-700/60 text-white">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="title">Title A-Z</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center bg-slate-800/60 border border-slate-700/60 rounded-lg p-1">
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
            {(searchQuery || statusFilter !== 'all' || selectedGenres.length > 0 || ratingFilter !== 'all' || durationFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-cyan-300 hover:bg-cyan-500/10"
                data-testid="clear-filters-btn"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Genre chips — expandable */}
          <div className="mt-3" data-testid="genre-filter-section">
            <button
              type="button"
              onClick={() => setGenresExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-300/80 hover:text-cyan-200 transition-colors"
              data-testid="genre-filter-toggle"
            >
              <span>Genres</span>
              {selectedGenres.length > 0 && (
                <span className="bg-cyan-500/30 text-cyan-100 border border-cyan-400/40 rounded-full px-2 py-0.5 text-[10px]">
                  {selectedGenres.length}
                </span>
              )}
              {genresExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {genresExpanded && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GENRE_OPTIONS.map((g) => {
                  const active = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      data-testid={`genre-chip-${g}`}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        active
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-cyan-500/60 hover:text-cyan-200'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {filteredFilms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
              <Film className="w-10 h-10 text-cyan-400/60" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No movies found</h3>
            <p className="text-slate-400 mb-5">Try adjusting your search or filters</p>
            <Button onClick={() => navigate('/services/cinema')} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold">
              Modify search
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="cinema-results-grid">
            {pagedFilms.map((film) => (
              <FilmCardGrid key={film.id || film._id} film={film} onViewDetails={handleViewDetails} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : viewMode === 'details' ? (
          <div className="space-y-5" data-testid="cinema-results-details">
            {pagedFilms.map((film) => (
              <FilmCardList key={film.id || film._id} film={film} onViewDetails={handleViewDetails} isFav={isFav} toggleFav={toggleFav} />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden bg-slate-900 border-slate-800" data-testid="cinema-results-list">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 border-b border-slate-700 text-left text-xs uppercase tracking-wider text-slate-400">
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
                    <tr key={film.id || film._id} className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors" onClick={() => handleViewDetails(film)}>
                      <td className="px-4 py-3 font-medium text-white">{film.title}</td>
                      <td className="px-4 py-3 text-slate-300">{film.genre?.slice(0, 2).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDuration(film.duration_minutes)}</td>
                      <td className="px-4 py-3">
                        {film.imdb_rating ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {film.imdb_rating}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={film.status === 'coming_soon' ? 'bg-amber-500/30 text-amber-100 border border-amber-400/40' : 'bg-cyan-500/30 text-cyan-100 border border-cyan-400/40'}>
                          {film.status === 'coming_soon' ? 'Coming Soon' : 'Now Showing'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-cyan-300 tabular-nums">{formatFCFA(film.price_from || 3500)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold" onClick={(e) => { e.stopPropagation(); handleViewDetails(film); }}>
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
          <div className="mt-8">
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
