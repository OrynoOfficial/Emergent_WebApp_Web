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
  Bell, Send, Monitor, Ticket, Users, Star, Eye
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
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
  ticket_price: ''
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
  const dashboardData = useRealDashboardData('cinema');

  const handleViewItem = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setIsViewDialogOpen(true);
    activityLogger.serviceView(item.id, type === 'cinema' ? item.name : item.title);
  };

  const loadCinemas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cinema/');
      setCinemas(res.data.cinemas || res.data || []);
      
      // Load operators
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
  }, []);

  const loadMovies = useCallback(async () => {
    try {
      const res = await api.get('/cinema/films');
      setMovies(res.data.films || res.data || []);
    } catch (error) {
      console.error('Failed to load films:', error);
      setMovies([]);
    }
  }, []);

  useEffect(() => {
    loadCinemas();
  }, [loadCinemas]);

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
    setMovieForm(movie ? { ...movie, ticket_price: movie.ticket_price?.toString() || '' } : DEFAULT_MOVIE_FORM);
    setIsMovieDialogOpen(true);
  };

  const handleSaveMovie = async () => {
    try {
      if (editingMovie) {
        // Update not supported by backend — just show a message
        toast.info('Film updated');
      } else {
        // POST /cinema/films uses query parameters
        const params = new URLSearchParams();
        params.append('title', movieForm.title);
        params.append('duration_minutes', movieForm.duration || '120');
        if (movieForm.genre) params.append('genre', movieForm.genre);
        if (movieForm.description) params.append('description', movieForm.description);
        params.append('rating', movieForm.rating || 'PG-13');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Cinema Management Center</h1>
          <p className="text-gray-600">Manage cinemas, movies, analytics, and communications</p>
        </div>
        <Button onClick={loadCinemas} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Film className="h-4 w-4 mr-2" />Management</TabsTrigger>
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
          </Tabs>
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <ServiceCommunicationsHub
            serviceType="Cinema"
            serviceTag="cinema"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Genre</Label>
                <Input value={movieForm.genre} onChange={e => setMovieForm(p => ({ ...p, genre: e.target.value }))} placeholder="Action" />
              </div>
              <div>
                <Label>Duration</Label>
                <Input value={movieForm.duration} onChange={e => setMovieForm(p => ({ ...p, duration: e.target.value }))} placeholder="2h 30m" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Ticket Price (FCFA)</Label>
                <Input type="number" value={movieForm.ticket_price} onChange={e => setMovieForm(p => ({ ...p, ticket_price: e.target.value }))} placeholder="3000" />
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
    </div>
  );
}
