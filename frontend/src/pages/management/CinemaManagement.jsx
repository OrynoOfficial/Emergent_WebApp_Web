import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Film, Plus, Edit, Trash2, MapPin, Clock, DollarSign, Calendar,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Monitor, Ticket, Users, Star, Eye, Banknote, Receipt,
  Replace as ReplaceIcon
} from 'lucide-react';
import WalkInBookingModal from '@/components/management/shared/WalkInBookingModal';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';
import { activityLogger } from '@/utils/activityLogger';
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';
import ViewModeToggle from '@/components/common/ViewModeToggle';
import Pagination from '@/components/common/Pagination';
import { Search } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const PAGE_SIZE = 12;

const CHART_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
const CINEMA_AMENITIES = ['3d', 'imax', 'dolby_atmos', 'vip_seating', 'parking', 'snack_bar', 'lounge', 'wheelchair_access'];

const DEFAULT_CINEMA_FORM = {
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  screens: [],
  amenities: [],
  operating_hours: {},
  images: [],
  operator_id: '',
  operator_name: ''
};

const DEFAULT_MOVIE_FORM = {
  title: '',
  genre: '',
  duration: '',
  rating: 'PG-13',
  description: '',
  poster_url: '',
  trailer_url: '',
  director: '',
  cast: '',
  language: 'English',
  release_date: '',
  imdb_rating: '',
  status: 'now_showing', // now_showing | coming_soon
};

const DEFAULT_SHOWTIME_FORM = {
  cinema_id: '',
  film_id: '',
  screen_name: '',
  screen_type: '2d',
  show_date: '',
  show_time: '',
  end_time: '',
  price: '',
  vip_price: '',
  total_seats: 100,
};

const SCREEN_TYPES = ['2d', '3d', 'imax', 'dolby_atmos', 'vip'];
const MOVIE_STATUSES = [
  { value: 'now_showing', label: 'Now Showing' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

// Cinema specific dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

// Business Analytics
const BusinessAnalytics = ({ cinemas, movies }) => {
  const analyticsData = useMemo(() => {
    // Fixed monthly trend data
    const monthlyTrend = [
      { month: 'Jan', tickets: 485, revenue: 1250000 },
      { month: 'Feb', tickets: 620, revenue: 1680000 },
      { month: 'Mar', tickets: 780, revenue: 2150000 },
      { month: 'Apr', tickets: 695, revenue: 1920000 },
      { month: 'May', tickets: 890, revenue: 2550000 },
      { month: 'Jun', tickets: 1050, revenue: 3100000 }
    ];

    return { monthlyTrend };
  }, [cinemas, movies]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="tickets" stroke="#EF4444" strokeWidth={2} name="Tickets Sold" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Component
export default function CinemaManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cinemas, setCinemas] = useState([]);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [replaceShowtime, setReplaceShowtime] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedCinema, setSelectedCinema] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isCinemaDialogOpen, setIsCinemaDialogOpen] = useState(false);
  const [isMovieDialogOpen, setIsMovieDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('cinema');
  const [editingCinema, setEditingCinema] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null);
  const [cinemaForm, setCinemaForm] = useState(DEFAULT_CINEMA_FORM);
  const [movieForm, setMovieForm] = useState(DEFAULT_MOVIE_FORM);
  const [isShowtimeDialogOpen, setIsShowtimeDialogOpen] = useState(false);
  const [showtimeForm, setShowtimeForm] = useState(DEFAULT_SHOWTIME_FORM);
  const [editingShowtime, setEditingShowtime] = useState(null);

  // Use the cinema dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [cinemaViewMode, setCinemaViewMode] = useState('grid');
  const [movieViewMode, setMovieViewMode] = useState('grid');
  const [cinemaSearch, setCinemaSearch] = useState('');
  const [movieSearch, setMovieSearch] = useState('');
  const [cinemaPage, setCinemaPage] = useState(1);
  const [moviePage, setMoviePage] = useState(1);
  const dashboardData = useRealDashboardData('cinema', '30days', scopeOperatorId);

  const filteredCinemas = useMemo(() => {
    if (!cinemaSearch) return cinemas;
    const s = cinemaSearch.toLowerCase();
    return cinemas.filter(c =>
      (c.name || '').toLowerCase().includes(s) ||
      (c.city || '').toLowerCase().includes(s) ||
      (c.address || '').toLowerCase().includes(s)
    );
  }, [cinemas, cinemaSearch]);

  const filteredMovies = useMemo(() => {
    if (!movieSearch) return movies;
    const s = movieSearch.toLowerCase();
    return movies.filter(m =>
      (m.title || '').toLowerCase().includes(s) ||
      (Array.isArray(m.genre) ? m.genre.join(',') : (m.genre || '')).toLowerCase().includes(s)
    );
  }, [movies, movieSearch]);

  useEffect(() => { setCinemaPage(1); }, [cinemaSearch]);
  useEffect(() => { setMoviePage(1); }, [movieSearch]);
  const cinemaTotalPages = Math.max(1, Math.ceil(filteredCinemas.length / PAGE_SIZE));
  const movieTotalPages = Math.max(1, Math.ceil(filteredMovies.length / PAGE_SIZE));
  const pagedCinemas = useMemo(
    () => filteredCinemas.slice((cinemaPage - 1) * PAGE_SIZE, cinemaPage * PAGE_SIZE),
    [filteredCinemas, cinemaPage]
  );
  const pagedMovies = useMemo(
    () => filteredMovies.slice((moviePage - 1) * PAGE_SIZE, moviePage * PAGE_SIZE),
    [filteredMovies, moviePage]
  );

  const handleViewItem = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(item.id, type === 'cinema' ? item.name : item.title);
  };

  const loadCinemas = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/cinema/${params}`);
      setCinemas(res.data.cinemas || res.data || []);
      
      try {
        const opRes = await api.get('/operators/');
        setOperators(opRes.data.operators || opRes.data || []);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    } catch (error) {
      console.error('Failed to load cinemas:', error);
      setCinemas([]);
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  const loadMovies = useCallback(async () => {
    try {
      const res = await api.get('/cinema/films');
      setMovies(res.data.films || res.data || []);
    } catch (error) {
      console.error('Failed to load films:', error);
      setMovies([]);
    }
  }, []);

  const loadShowtimes = useCallback(async () => {
    try {
      const res = await api.get('/cinema/showtimes/operator');
      setShowtimes(res.data.showtimes || []);
    } catch (error) {
      console.error('Failed to load showtimes:', error);
      setShowtimes([]);
    }
  }, []);

  useEffect(() => {
    loadCinemas();
    loadShowtimes();
  }, [loadCinemas, loadShowtimes]);

  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  const openCinemaDialog = (cinema = null) => {
    setEditingCinema(cinema);
    setCinemaForm(cinema ? { ...cinema, operator_id: cinema.operator_id || '', operator_name: cinema.operator_name || '' } : DEFAULT_CINEMA_FORM);
    setIsCinemaDialogOpen(true);
  };

  const handleSaveCinema = async () => {
    try {
      const operator = operators.find(op => (op._id || op.id) === cinemaForm.operator_id);
      const dataToSend = {
        ...cinemaForm,
        operator_name: operator?.name || cinemaForm.operator_name || ''
      };
      
      if (editingCinema) {
        await api.put(`/cinema/${editingCinema.id}`, dataToSend);
        toast.success('Cinema updated');
      } else {
        await api.post('/cinema/', dataToSend);
        toast.success('Cinema added');
      }
      setIsCinemaDialogOpen(false);
      loadCinemas();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDeleteCinema = async (id) => {
    if (!confirm('Delete this cinema?')) return;
    try {
      await api.delete(`/cinema/${id}`);
      toast.success('Cinema deleted');
      loadCinemas();
      if (selectedCinema?.id === id) setSelectedCinema(null);
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openMovieDialog = (movie = null) => {
    setEditingMovie(movie);
    setMovieForm(movie ? {
      title: movie.title || '',
      genre: Array.isArray(movie.genre) ? movie.genre.join(', ') : (movie.genre || ''),
      duration: movie.duration_minutes ? String(movie.duration_minutes) : (movie.duration || ''),
      rating: movie.rating || 'PG-13',
      description: movie.description || '',
      poster_url: movie.poster_url || '',
      trailer_url: movie.trailer_url || '',
      director: movie.director || '',
      cast: Array.isArray(movie.cast) ? movie.cast.join(', ') : (movie.cast || ''),
      language: movie.language || 'English',
      release_date: movie.release_date || '',
      imdb_rating: movie.imdb_rating?.toString() || '',
      status: movie.status || 'now_showing',
    } : DEFAULT_MOVIE_FORM);
    setIsMovieDialogOpen(true);
  };

  const handleSaveMovie = async () => {
    try {
      const durationMin = parseInt(movieForm.duration) || 120;
      const genreArr = movieForm.genre ? movieForm.genre.split(',').map(g => g.trim()).filter(Boolean) : [];
      const castArr = movieForm.cast ? movieForm.cast.split(',').map(c => c.trim()).filter(Boolean) : [];

      const params = new URLSearchParams();
      params.append('title', movieForm.title);
      params.append('duration_minutes', String(durationMin));
      genreArr.forEach(g => params.append('genre', g));
      castArr.forEach(c => params.append('cast', c));
      if (movieForm.description) params.append('description', movieForm.description);
      params.append('rating', movieForm.rating || 'PG-13');
      if (movieForm.director) params.append('director', movieForm.director);
      if (movieForm.language) params.append('language', movieForm.language);
      if (movieForm.poster_url) params.append('poster_url', movieForm.poster_url);
      if (movieForm.trailer_url) params.append('trailer_url', movieForm.trailer_url);
      if (movieForm.release_date) params.append('release_date', movieForm.release_date);
      if (movieForm.imdb_rating) params.append('imdb_rating', String(parseFloat(movieForm.imdb_rating)));
      if (movieForm.status) params.append('status', movieForm.status);

      if (editingMovie) {
        const filmId = editingMovie.id || editingMovie._id;
        await api.put(`/cinema/films/${filmId}?${params.toString()}`);
        toast.success('Film updated');
      } else {
        await api.post(`/cinema/films?${params.toString()}`);
        toast.success('Film added');
      }
      setIsMovieDialogOpen(false);
      loadMovies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save film');
    }
  };

  // ---- Showtime handlers ----
  const openShowtimeDialog = (showtime = null) => {
    setEditingShowtime(showtime);
    if (showtime) {
      setShowtimeForm({
        cinema_id: showtime.cinema_id || '',
        film_id: showtime.film_id || '',
        screen_name: showtime.screen_name || '',
        screen_type: showtime.screen_type || '2d',
        show_date: showtime.show_date || '',
        show_time: showtime.show_time || '',
        end_time: showtime.end_time || '',
        price: showtime.price?.toString() || '',
        vip_price: showtime.vip_price?.toString() || '',
        total_seats: showtime.total_seats || 100,
      });
    } else {
      setShowtimeForm(DEFAULT_SHOWTIME_FORM);
    }
    setIsShowtimeDialogOpen(true);
  };

  const handleSaveShowtime = async () => {
    if (!showtimeForm.cinema_id || !showtimeForm.film_id || !showtimeForm.screen_name || !showtimeForm.show_date || !showtimeForm.show_time || !showtimeForm.end_time || !showtimeForm.price) {
      toast.error('Cinema, film, screen, date, time, end time and price are required');
      return;
    }
    try {
      const params = new URLSearchParams();
      params.append('film_id', showtimeForm.film_id);
      params.append('screen_name', showtimeForm.screen_name);
      params.append('show_date', showtimeForm.show_date);
      params.append('show_time', showtimeForm.show_time);
      params.append('end_time', showtimeForm.end_time);
      params.append('price', String(parseFloat(showtimeForm.price)));
      params.append('screen_type', showtimeForm.screen_type || '2d');
      if (showtimeForm.vip_price) params.append('vip_price', String(parseFloat(showtimeForm.vip_price)));
      params.append('total_seats', String(parseInt(showtimeForm.total_seats) || 100));

      if (editingShowtime) {
        await api.put(`/cinema/showtimes/${editingShowtime.id}?${params.toString()}`);
        toast.success('Showtime updated');
      } else {
        await api.post(`/cinema/${showtimeForm.cinema_id}/showtimes?${params.toString()}`);
        toast.success('Showtime scheduled');
      }
      setIsShowtimeDialogOpen(false);
      loadShowtimes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save showtime');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Cinema Management Center</h1>
          <p className="text-gray-600">Manage cinemas, movies, analytics, and communications</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OperatorScopeFilter serviceType="cinema" value={scopeOperatorId} onChange={setScopeOperatorId} />
          <Button onClick={loadCinemas} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Film className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings"><Receipt className="h-4 w-4 mr-2" />Bookings</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ServiceExecutiveDashboard
            serviceType="Cinema"
            serviceIcon={<Film className="h-8 w-8" />}
            primaryColor="red"
            stats={dashboardData.stats}
            bookingsByStatus={dashboardData.bookingsByStatus}
            dailyTrend={dashboardData.dailyTrend}
            distribution={dashboardData.distribution}
            recentBookings={dashboardData.recentBookings}
            itemLabel="Cinemas"
            secondaryLabel="Screens"
            secondaryCount={dashboardData.secondaryCount}
          />
        </TabsContent>

        <TabsContent value="management" className="mt-6">
          <Tabs defaultValue="cinemas">
            <TabsList>
              <TabsTrigger value="cinemas">Cinemas</TabsTrigger>
              <TabsTrigger value="movies">Films ({movies.length})</TabsTrigger>
              <TabsTrigger value="showtimes" data-testid="tab-showtimes">Showtimes ({showtimes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cinemas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
                  <CardTitle>Cinemas</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search cinemas..."
                        value={cinemaSearch}
                        onChange={(e) => setCinemaSearch(e.target.value)}
                        className="pl-10 bg-white w-64"
                        data-testid="cinemas-search-input"
                      />
                    </div>
                    <ViewModeToggle value={cinemaViewMode} onChange={setCinemaViewMode} />
                    <PermissionGate permission="cinema.create">
                      <Button onClick={() => openCinemaDialog()} className="bg-[#082c59]" data-testid="add-cinema-btn">
                        <Plus className="w-4 h-4 mr-2" /> Add Cinema
                      </Button>
                    </PermissionGate>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : filteredCinemas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">{cinemaSearch ? 'No cinemas match your search' : 'No cinemas found.'}</div>
                  ) : cinemaViewMode === 'list' ? (
                    <div className="overflow-x-auto" data-testid="cinemas-list-view">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">City</th>
                            <th className="px-4 py-3">Screens</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCinemas.map(cinema => (
                            <tr key={cinema.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>
                              <td className="px-4 py-3 font-medium text-slate-900">{cinema.name}</td>
                              <td className="px-4 py-3 text-slate-700">{cinema.city || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{cinema.total_screens || (cinema.screens || []).length}</td>
                              <td className="px-4 py-3 text-slate-700">{cinema.phone || '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleViewItem(cinema, 'cinema'); }}>View</Button>
                                <PermissionGate permission="cinema.edit">
                                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openCinemaDialog(cinema); }}>Edit</Button>
                                </PermissionGate>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={cinemaViewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`cinemas-${cinemaViewMode}-view`}>
                      {pagedCinemas.map(cinema => (
                        <Card
                          key={cinema.id}
                          className={`cursor-pointer hover:shadow-lg transition-shadow ${selectedCinema?.id === cinema.id ? 'ring-2 ring-[#082c59]' : ''}`}
                          onClick={() => setSelectedCinema(cinema)}
                        >
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-semibold">{cinema.name}</h3>
                              <Badge variant="outline">{cinema.total_screens} Screens</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                              <MapPin className="w-4 h-4" />{cinema.city}
                            </div>
                            {cinemaViewMode === 'details' && cinema.description && (
                              <p className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-100">{cinema.description}</p>
                            )}
                            {cinema.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {cinema.amenities.slice(0, cinemaViewMode === 'details' ? 8 : 3).map(a => (
                                  <Badge key={a} variant="outline" className="text-xs uppercase">{a}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleViewItem(cinema, 'cinema'); }} title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="cinema.edit">
                                <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); openCinemaDialog(cinema); }}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="cinema.delete">
                                <Button size="sm" variant="outline" className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteCinema(cinema.id); }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <Pagination
                      page={cinemaPage}
                      totalPages={cinemaTotalPages}
                      onChange={setCinemaPage}
                      total={filteredCinemas.length}
                      pageSize={PAGE_SIZE}
                      itemLabel="cinema"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="movies">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
                  <CardTitle>Films</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search films..."
                        value={movieSearch}
                        onChange={(e) => setMovieSearch(e.target.value)}
                        className="pl-10 bg-white w-64"
                        data-testid="movies-search-input"
                      />
                    </div>
                    <ViewModeToggle value={movieViewMode} onChange={setMovieViewMode} />
                    <PermissionGate permission="cinema.edit">
                      <Button onClick={() => openMovieDialog()} className="bg-[#082c59]" data-testid="add-movie-btn">
                        <Plus className="w-4 h-4 mr-2" /> Add Movie
                      </Button>
                    </PermissionGate>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredMovies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">{movieSearch ? 'No films match your search' : 'No films. Add a film!'}</div>
                  ) : movieViewMode === 'list' ? (
                    <div className="overflow-x-auto" data-testid="movies-list-view">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Genre</th>
                            <th className="px-4 py-3">Duration</th>
                            <th className="px-4 py-3">Rating</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedMovies.map(movie => (
                            <tr key={movie.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{movie.title}</td>
                              <td className="px-4 py-3 text-slate-700">{Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{movie.duration || movie.duration_minutes || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{movie.rating || '—'}</td>
                              <td className="px-4 py-3 font-bold text-emerald-700">{formatFCFA(movie.ticket_price || 0)}</td>
                              <td className="px-4 py-3 text-right">
                                <Button size="sm" variant="ghost" onClick={() => handleViewItem(movie, 'movie')}>View</Button>
                                <PermissionGate permission="cinema.edit">
                                  <Button size="sm" variant="ghost" onClick={() => openMovieDialog(movie)}>Edit</Button>
                                </PermissionGate>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={movieViewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`movies-${movieViewMode}-view`}>
                      {pagedMovies.map(movie => (
                        <Card key={movie.id}>
                          <CardContent className="pt-6">
                            <h3 className="font-semibold mb-2">{movie.title}</h3>
                            <div className="space-y-1 text-sm text-gray-500">
                              <div className="flex items-center gap-2"><Film className="w-4 h-4" />{Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre}</div>
                              <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{movie.duration}</div>
                              <div className="flex items-center gap-2"><Star className="w-4 h-4" />{movie.rating}</div>
                              {movieViewMode === 'details' && movie.description && (
                                <p className="text-slate-600 pt-2 border-t border-slate-100">{movie.description}</p>
                              )}
                            </div>
                            <div className="mt-3 font-bold text-green-600">{formatFCFA(movie.ticket_price)}</div>
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" variant="outline" onClick={() => handleViewItem(movie, 'movie')} title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="cinema.edit">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => openMovieDialog(movie)}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="cinema.delete">
                                <Button size="sm" variant="outline" className="text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <Pagination
                      page={moviePage}
                      totalPages={movieTotalPages}
                      onChange={setMoviePage}
                      total={filteredMovies.length}
                      pageSize={PAGE_SIZE}
                      itemLabel="film"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="showtimes" data-testid="content-showtimes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Showtimes</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button onClick={loadShowtimes} variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <PermissionGate permission="cinema.manage_screenings">
                      <Button onClick={() => openShowtimeDialog()} className="bg-[#082c59]" size="sm" data-testid="add-showtime-btn">
                        <Plus className="w-4 h-4 mr-2" /> Add Showtime
                      </Button>
                    </PermissionGate>
                  </div>
                </CardHeader>
                <CardContent>
                  {showtimes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      No showtimes yet. Click <strong>"Add Showtime"</strong> to assign a film to a cinema, screen, date, time and price.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Film</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Cinema</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Screen</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Date · Time</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Seats</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Price</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-600">Status</th>
                            <th className="py-3 px-4 text-right font-semibold text-slate-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {showtimes.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50" data-testid={`showtime-row-${st.id}`}>
                              <td className="py-3 px-4 font-medium text-[#082c59]">{st.film_title || '—'}</td>
                              <td className="py-3 px-4 text-slate-700">{st.cinema_name || '—'}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1">
                                  <Monitor className="h-3.5 w-3.5 text-slate-400" />
                                  {st.screen_name || '—'}
                                  {st.screen_type && <span className="text-[10px] uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{st.screen_type}</span>}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                <span className="block">{st.show_date}</span>
                                <span className="text-xs text-slate-400">{st.show_time}{st.end_time ? ` – ${st.end_time}` : ''}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-xs">
                                  <span className="font-semibold">{st.available_seats ?? '—'}</span> / {st.total_seats ?? '—'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-700">
                                {st.price ? formatFCFA(st.price) : '—'}
                                {st.vip_price && <span className="block text-xs text-amber-700">VIP {formatFCFA(st.vip_price)}</span>}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${st.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {st.is_active !== false ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1 justify-end">
                                  <PermissionGate permission="cinema.manage_screenings">
                                    <Button size="sm" variant="outline" onClick={() => openShowtimeDialog(st)} className="h-8" data-testid={`edit-showtime-btn-${st.id}`}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </PermissionGate>
                                  <PermissionGate permission="cinema.manage_screenings">
                                    <Button size="sm" variant="outline" onClick={() => setReplaceShowtime(st)} className="h-8 text-[#082c59]" data-testid={`replace-showtime-btn-${st.id}`}>
                                      <ReplaceIcon className="w-4 h-4 mr-1" /> Replace
                                    </Button>
                                  </PermissionGate>
                                  <PermissionGate permission="cinema.manage_screenings">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-red-600 hover:bg-red-50"
                                      onClick={async () => {
                                        try {
                                          await api.delete(`/cinema/showtimes/${st.id}`);
                                          toast.success('Showtime deactivated');
                                          loadShowtimes();
                                        } catch (err) {
                                          toast.error(err.response?.data?.detail || 'Delete failed');
                                        }
                                      }}
                                      data-testid={`delete-showtime-btn-${st.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </PermissionGate>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <OperatorBookingsList serviceType="cinema" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Cinema"
            serviceTag="cinema"
            operatorId={scopeOperatorId}
            serviceIcon={<Film className="h-5 w-5 text-red-600" />}
            primaryColor="red"
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <BusinessAnalytics cinemas={cinemas} movies={movies} />
        </TabsContent>
      </Tabs>

      {/* Cinema Dialog */}
      <Dialog open={isCinemaDialogOpen} onOpenChange={setIsCinemaDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCinema ? 'Edit Cinema' : 'Add Cinema'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={cinemaForm.name} onChange={e => setCinemaForm(p => ({ ...p, name: e.target.value }))} placeholder="Canal Olympia Yaoundé" data-testid="cinema-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input value={cinemaForm.city} onChange={e => setCinemaForm(p => ({ ...p, city: e.target.value }))} placeholder="Yaoundé" data-testid="cinema-city-input" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={cinemaForm.phone} onChange={e => setCinemaForm(p => ({ ...p, phone: e.target.value }))} placeholder="+237..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Address</Label>
                <Input value={cinemaForm.address} onChange={e => setCinemaForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={cinemaForm.email} onChange={e => setCinemaForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@cinema.com" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={cinemaForm.description} onChange={e => setCinemaForm(p => ({ ...p, description: e.target.value }))} placeholder="About this cinema..." rows={2} />
            </div>

            {/* Screens management */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Screens</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCinemaForm(p => ({
                    ...p,
                    screens: [...(p.screens || []), { name: `Screen ${(p.screens?.length || 0) + 1}`, type: '2d', capacity: 100 }]
                  }))}
                  data-testid="add-screen-btn"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add screen
                </Button>
              </div>
              <div className="space-y-2">
                {(cinemaForm.screens || []).length === 0 && (
                  <p className="text-xs text-slate-500 italic">No screens yet. Click "Add screen" to add theater rooms.</p>
                )}
                {(cinemaForm.screens || []).map((screen, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded">
                    <Input
                      className="col-span-4 bg-white"
                      placeholder="Screen name"
                      value={screen.name || ''}
                      onChange={(e) => setCinemaForm(p => ({
                        ...p,
                        screens: p.screens.map((s, i) => i === idx ? { ...s, name: e.target.value } : s)
                      }))}
                    />
                    <Select
                      value={screen.type || '2d'}
                      onValueChange={(v) => setCinemaForm(p => ({
                        ...p,
                        screens: p.screens.map((s, i) => i === idx ? { ...s, type: v } : s)
                      }))}
                    >
                      <SelectTrigger className="col-span-3 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {SCREEN_TYPES.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-3 bg-white"
                      type="number"
                      placeholder="Seats"
                      value={screen.capacity || ''}
                      onChange={(e) => setCinemaForm(p => ({
                        ...p,
                        screens: p.screens.map((s, i) => i === idx ? { ...s, capacity: parseInt(e.target.value) || 0 } : s)
                      }))}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="col-span-2 text-red-500 h-8"
                      onClick={() => setCinemaForm(p => ({ ...p, screens: p.screens.filter((_, i) => i !== idx) }))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Operator</Label>
              <Select 
                value={cinemaForm.operator_id || ''} 
                onValueChange={v => {
                  const op = operators.find(o => (o._id || o.id) === v);
                  setCinemaForm(p => ({ 
                    ...p, 
                    operator_id: v,
                    operator_name: op?.name || ''
                  }));
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select an operator..." />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  {operators.map(op => (
                    <SelectItem key={op._id || op.id} value={op._id || op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amenities</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CINEMA_AMENITIES.map(amenity => (
                  <Badge
                    key={amenity}
                    variant={cinemaForm.amenities?.includes(amenity) ? 'default' : 'outline'}
                    className="cursor-pointer uppercase text-xs"
                    onClick={() => {
                      setCinemaForm(p => ({
                        ...p,
                        amenities: p.amenities?.includes(amenity)
                          ? p.amenities.filter(a => a !== amenity)
                          : [...(p.amenities || []), amenity]
                      }));
                    }}
                  >
                    {amenity.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCinemaDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCinema} className="bg-[#082c59]" data-testid="save-cinema-btn">{editingCinema ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movie Dialog */}
      <Dialog open={isMovieDialogOpen} onOpenChange={setIsMovieDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMovie ? 'Edit Film' : 'Add Film'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input value={movieForm.title} onChange={e => setMovieForm(p => ({ ...p, title: e.target.value }))} placeholder="Movie title" data-testid="movie-title-input" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={movieForm.status} onValueChange={v => setMovieForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {MOVIE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Cover / Poster Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {movieForm.poster_url && (
                  <img src={movieForm.poster_url} alt="Poster" className="h-20 w-14 object-cover rounded-lg border" />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('folder', 'films');
                      try {
                        const res = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = res.data?.file_url || res.data?.urls?.[0] || res.data?.files?.[0]?.url;
                        if (url) setMovieForm(p => ({ ...p, poster_url: url }));
                      } catch { toast.error('Upload failed'); }
                    }}
                    className="h-10"
                  />
                  <p className="text-xs text-slate-500 mt-1">Upload a cover/poster image (separate from the trailer)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Genre (comma-separated)</Label>
                <Input value={movieForm.genre} onChange={e => setMovieForm(p => ({ ...p, genre: e.target.value }))} placeholder="Action, Drama, Thriller" />
              </div>
              <div>
                <Label>Duration (minutes) *</Label>
                <Input type="number" value={movieForm.duration} onChange={e => setMovieForm(p => ({ ...p, duration: e.target.value }))} placeholder="120" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Rating</Label>
                <Select value={movieForm.rating} onValueChange={v => setMovieForm(p => ({ ...p, rating: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="G">G</SelectItem>
                    <SelectItem value="PG">PG</SelectItem>
                    <SelectItem value="PG-13">PG-13</SelectItem>
                    <SelectItem value="R">R</SelectItem>
                    <SelectItem value="NC-17">NC-17</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Input value={movieForm.language} onChange={e => setMovieForm(p => ({ ...p, language: e.target.value }))} placeholder="English" />
              </div>
              <div>
                <Label>IMDb Rating</Label>
                <Input type="number" step="0.1" max="10" value={movieForm.imdb_rating} onChange={e => setMovieForm(p => ({ ...p, imdb_rating: e.target.value }))} placeholder="8.2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Director</Label>
                <Input value={movieForm.director} onChange={e => setMovieForm(p => ({ ...p, director: e.target.value }))} placeholder="Director name" />
              </div>
              <div>
                <Label>Release Date</Label>
                <Input type="date" value={movieForm.release_date} onChange={e => setMovieForm(p => ({ ...p, release_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Cast (comma-separated)</Label>
              <Input value={movieForm.cast} onChange={e => setMovieForm(p => ({ ...p, cast: e.target.value }))} placeholder="Actor 1, Actor 2, Actor 3" />
            </div>

            <div>
              <Label>Trailer URL</Label>
              <Input value={movieForm.trailer_url} onChange={e => setMovieForm(p => ({ ...p, trailer_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
            </div>

            <div>
              <Label>Description / Synopsis</Label>
              <Textarea value={movieForm.description} onChange={e => setMovieForm(p => ({ ...p, description: e.target.value }))} placeholder="Movie description..." rows={3} />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Note:</strong> Showtimes (date, time, price) are managed separately in the <em>Showtimes</em> tab — one film can be assigned to multiple cinemas, screens and time slots, each with its own price.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovieDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMovie} className="bg-[#082c59]" data-testid="save-movie-btn">{editingMovie ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Showtime Dialog */}
      <Dialog open={isShowtimeDialogOpen} onOpenChange={setIsShowtimeDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" data-testid="showtime-dialog">
          <DialogHeader>
            <DialogTitle>{editingShowtime ? 'Edit Showtime' : 'Add Showtime'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
              A showtime assigns a film to a specific cinema, screen, date, time and price. Customers book this exact slot.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cinema *</Label>
                <Select
                  value={showtimeForm.cinema_id}
                  onValueChange={(v) => {
                    const cin = cinemas.find((c) => c.id === v);
                    const firstScreen = cin?.screens?.[0];
                    setShowtimeForm(p => ({
                      ...p,
                      cinema_id: v,
                      screen_name: firstScreen?.name || p.screen_name || '',
                      screen_type: firstScreen?.type || p.screen_type || '2d',
                      total_seats: firstScreen?.capacity || p.total_seats || 100,
                    }));
                  }}
                  disabled={!!editingShowtime}
                >
                  <SelectTrigger className="bg-white" data-testid="showtime-cinema-select"><SelectValue placeholder="Pick a cinema..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    {cinemas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.city ? `· ${c.city}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Film *</Label>
                <Select value={showtimeForm.film_id} onValueChange={(v) => setShowtimeForm(p => ({ ...p, film_id: v }))}>
                  <SelectTrigger className="bg-white" data-testid="showtime-film-select"><SelectValue placeholder="Pick a film..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    {movies.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Screen *</Label>
                {(() => {
                  const cin = cinemas.find((c) => c.id === showtimeForm.cinema_id);
                  const availableScreens = cin?.screens || [];
                  if (availableScreens.length > 0) {
                    return (
                      <Select
                        value={showtimeForm.screen_name}
                        onValueChange={(v) => {
                          const s = availableScreens.find((x) => x.name === v);
                          setShowtimeForm(p => ({
                            ...p,
                            screen_name: v,
                            screen_type: s?.type || p.screen_type,
                            total_seats: s?.capacity || p.total_seats,
                          }));
                        }}
                      >
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Pick a screen..." /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {availableScreens.map((s, i) => (
                            <SelectItem key={i} value={s.name}>{s.name} ({s.type || '2d'}, {s.capacity || 0} seats)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  return (
                    <Input
                      placeholder="e.g. Screen 1"
                      value={showtimeForm.screen_name}
                      onChange={(e) => setShowtimeForm(p => ({ ...p, screen_name: e.target.value }))}
                    />
                  );
                })()}
              </div>
              <div>
                <Label>Screen Type</Label>
                <Select value={showtimeForm.screen_type} onValueChange={(v) => setShowtimeForm(p => ({ ...p, screen_type: v }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {SCREEN_TYPES.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Seats *</Label>
                <Input type="number" value={showtimeForm.total_seats} onChange={(e) => setShowtimeForm(p => ({ ...p, total_seats: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={showtimeForm.show_date} onChange={(e) => setShowtimeForm(p => ({ ...p, show_date: e.target.value }))} />
              </div>
              <div>
                <Label>Start Time *</Label>
                <Input type="time" value={showtimeForm.show_time} onChange={(e) => setShowtimeForm(p => ({ ...p, show_time: e.target.value }))} />
              </div>
              <div>
                <Label>End Time *</Label>
                <Input type="time" value={showtimeForm.end_time} onChange={(e) => setShowtimeForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (FCFA) *</Label>
                <Input type="number" value={showtimeForm.price} onChange={(e) => setShowtimeForm(p => ({ ...p, price: e.target.value }))} placeholder="3500" data-testid="showtime-price-input" />
              </div>
              <div>
                <Label>VIP Price (FCFA, optional)</Label>
                <Input type="number" value={showtimeForm.vip_price} onChange={(e) => setShowtimeForm(p => ({ ...p, vip_price: e.target.value }))} placeholder="5000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShowtimeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShowtime} className="bg-[#082c59]" data-testid="save-showtime-btn">{editingShowtime ? 'Update' : 'Schedule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-rose-600" />
              {viewingType === 'cinema' ? 'Cinema Details' : 'Movie Details'}
            </DialogTitle>
          </DialogHeader>
          {viewingItem && viewingType === 'cinema' && (
            <div className="space-y-4 py-4">
              <div className="bg-rose-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-rose-900">{viewingItem.name}</h3>
                <p className="text-sm text-rose-700">{viewingItem.total_screens} screens • {viewingItem.total_seats} seats</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {viewingItem.city || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">{viewingItem.address || 'N/A'}</p>
                </div>
              </div>
              {viewingItem.amenities?.length > 0 && (
                <div>
                  <p className="text-slate-500 text-sm mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1">
                    {viewingItem.amenities.map(a => (
                      <Badge key={a} variant="outline" className="text-xs uppercase">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {viewingItem && viewingType === 'movie' && (
            <div className="space-y-4 py-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-bold text-lg text-purple-900">{viewingItem.title}</h3>
                <Badge className="mt-1">{viewingItem.genre}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Duration</p>
                  <p className="font-medium">{viewingItem.duration}</p>
                </div>
                <div>
                  <p className="text-slate-500">Rating</p>
                  <p className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" /> {viewingItem.rating}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Ticket Price</p>
                  <p className="font-bold text-green-600">{formatFCFA(viewingItem.ticket_price)}</p>
                </div>
              </div>
              {viewingItem.description && (
                <div>
                  <p className="text-slate-500 text-sm mb-1">Description</p>
                  <p className="text-sm bg-slate-50 p-3 rounded">{viewingItem.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (viewingType === 'cinema') openCinemaDialog(viewingItem);
              else openMovieDialog(viewingItem);
              setIsViewDialogOpen(false);
            }}>
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button onClick={() => setIsViewDialogOpen(false)} className="bg-[#082c59]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalkInBookingModal
        open={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        serviceType="cinema"
        services={cinemas.map((c) => ({ id: c.id, name: c.name, price: c.ticket_price }))}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          setActiveTab('bookings');
        }}
      />

      <ReplaceResourceModal
        open={!!replaceShowtime}
        onClose={() => setReplaceShowtime(null)}
        serviceType="cinema"
        oldResource={replaceShowtime}
        allResources={showtimes}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadShowtimes();
        }}
      />
    </div>
  );
}
