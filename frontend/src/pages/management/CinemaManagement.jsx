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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

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
  show_times: [],
  ticket_price: '',
  poster_url: '',
  director: '',
  language: 'English'
};

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

  // Use the cinema dashboard data hook
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const dashboardData = useRealDashboardData('cinema', '30days', scopeOperatorId);

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
      show_times: movie.show_times || [],
      ticket_price: movie.ticket_price?.toString() || '',
      poster_url: movie.poster_url || '',
      director: movie.director || '',
      language: movie.language || 'English'
    } : DEFAULT_MOVIE_FORM);
    setIsMovieDialogOpen(true);
  };

  const handleSaveMovie = async () => {
    try {
      const durationMin = parseInt(movieForm.duration) || 120;
      const genreArr = movieForm.genre ? movieForm.genre.split(',').map(g => g.trim()).filter(Boolean) : [];
      
      const params = new URLSearchParams();
      params.append('title', movieForm.title);
      params.append('duration_minutes', String(durationMin));
      genreArr.forEach(g => params.append('genre', g));
      if (movieForm.description) params.append('description', movieForm.description);
      params.append('rating', movieForm.rating || 'PG-13');
      if (movieForm.director) params.append('director', movieForm.director);
      if (movieForm.language) params.append('language', movieForm.language);
      if (movieForm.poster_url) params.append('poster_url', movieForm.poster_url);

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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Cinemas</CardTitle>
                  <PermissionGate permission="cinema.create">
                    <Button onClick={() => openCinemaDialog()} className="bg-[#082c59]" data-testid="add-cinema-btn">
                      <Plus className="w-4 h-4 mr-2" /> Add Cinema
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : cinemas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No cinemas found.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cinemas.map(cinema => (
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
                            {cinema.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {cinema.amenities.slice(0, 3).map(a => (
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="movies">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Films</CardTitle>
                  <PermissionGate permission="cinema.edit">
                    <Button onClick={() => openMovieDialog()} className="bg-[#082c59]" data-testid="add-movie-btn">
                      <Plus className="w-4 h-4 mr-2" /> Add Movie
                    </Button>
                  </PermissionGate>
                </CardHeader>
                <CardContent>
                  {movies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No films. Add a film!</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {movies.map(movie => (
                        <Card key={movie.id}>
                          <CardContent className="pt-6">
                            <h3 className="font-semibold mb-2">{movie.title}</h3>
                            <div className="space-y-1 text-sm text-gray-500">
                              <div className="flex items-center gap-2"><Film className="w-4 h-4" />{movie.genre}</div>
                              <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{movie.duration}</div>
                              <div className="flex items-center gap-2"><Star className="w-4 h-4" />{movie.rating}</div>
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
                  </div>
                </CardHeader>
                <CardContent>
                  {showtimes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      No showtimes yet. Add one from the film detail page or via your scheduling tool.
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
                                        if (!window.confirm('Deactivate this showtime?')) return;
                                        try {
                                          await api.delete(`/cinema/showtimes/${st.id}`);
                                          loadShowtimes();
                                        } catch (err) {
                                          alert(err.response?.data?.detail || 'Delete failed');
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
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{editingCinema ? 'Edit Cinema' : 'Add Cinema'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name</Label>
              <Input value={cinemaForm.name} onChange={e => setCinemaForm(p => ({ ...p, name: e.target.value }))} placeholder="Cinema name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input value={cinemaForm.city} onChange={e => setCinemaForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" />
              </div>
              <div>
                <Label>Screens</Label>
                <Input type="number" value={cinemaForm.total_screens} onChange={e => setCinemaForm(p => ({ ...p, total_screens: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={cinemaForm.address} onChange={e => setCinemaForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
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
            <Button onClick={handleSaveCinema} className="bg-[#082c59]">{editingCinema ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movie Dialog */}
      <Dialog open={isMovieDialogOpen} onOpenChange={setIsMovieDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{editingMovie ? 'Edit Movie' : 'Add Movie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input value={movieForm.title} onChange={e => setMovieForm(p => ({ ...p, title: e.target.value }))} placeholder="Movie title" />
            </div>
            <div>
              <Label>Cover Image</Label>
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
                  <p className="text-xs text-slate-500 mt-1">Upload a cover/poster image for this film</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Genre</Label>
                <Input value={movieForm.genre} onChange={e => setMovieForm(p => ({ ...p, genre: e.target.value }))} placeholder="Action, Drama" />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
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
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Director</Label>
                <Input value={movieForm.director} onChange={e => setMovieForm(p => ({ ...p, director: e.target.value }))} placeholder="Director name" />
              </div>
              <div>
                <Label>Language</Label>
                <Input value={movieForm.language} onChange={e => setMovieForm(p => ({ ...p, language: e.target.value }))} placeholder="English" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={movieForm.description} onChange={e => setMovieForm(p => ({ ...p, description: e.target.value }))} placeholder="Movie description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovieDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMovie} className="bg-[#082c59]">{editingMovie ? 'Update' : 'Add'}</Button>
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
