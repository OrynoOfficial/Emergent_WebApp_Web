import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Film, Plus, Edit, Trash2, MapPin, Clock, DollarSign, Calendar,
  LayoutDashboard, BarChart2, MessageSquare, TrendingUp, RefreshCw,
  Bell, Send, Monitor, Ticket, Users, Star, Eye, Banknote, Receipt,
  Replace as ReplaceIcon, LayoutGrid, Armchair, Sparkles, Phone, Mail,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import WalkInBookingModal from '@/components/management/shared/WalkInBookingModal';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import CinemaSeatBuilder from '@/components/cinema/CinemaSeatBuilder';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
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
  genre: [],
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
  operator_id: '',
  operator_name: '',
};

const FILM_GENRE_OPTIONS = [
  'Thriller', 'Action', 'Comedy', 'Horror', 'Documentary', 'Adventure',
  'Crime', 'Drama', 'Romance', 'Sci-Fi', 'Musical', 'Fantasy',
  'Family/Children', 'Animation',
];

const DEFAULT_SHOWTIME_FORM = {
  cinema_id: '',
  film_id: '',
  screen_name: '',
  screen_type: '2d',
  show_date: '',
  show_time: '',
  end_time: '',
  price: '',
  vip_price: '', // Only used when the selected screen has VIP rows configured
  child_price: '', // Optional — when blank, the Child counter is hidden on the booking page
  senior_price: '', // Optional — when blank, the Senior counter is hidden on the booking page
  total_seats: 100,
  // Recurrence (front-end only; expanded into multiple showtimes on save)
  repeat_mode: 'single', // 'single' | 'recurring'
  repeat_end_date: '',
  repeat_days: [], // array of 0-6 (Sun..Sat)
};

const WEEKDAY_OPTIONS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

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
  const [genreFieldExpanded, setGenreFieldExpanded] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState('cinema');
  const [editingCinema, setEditingCinema] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null);
  const [cinemaForm, setCinemaForm] = useState(DEFAULT_CINEMA_FORM);
  const [movieForm, setMovieForm] = useState(DEFAULT_MOVIE_FORM);
  // Which screen row in the cinema dialog has its seat-builder expanded.
  const [expandedScreenIdx, setExpandedScreenIdx] = useState(null);

  // Bulk selection state
  const [selectedCinemaIds, setSelectedCinemaIds] = useState(new Set());
  const [selectedMovieIds, setSelectedMovieIds] = useState(new Set());
  const [isShowtimeDialogOpen, setIsShowtimeDialogOpen] = useState(false);
  const [showtimeForm, setShowtimeForm] = useState(DEFAULT_SHOWTIME_FORM);
  const [editingShowtime, setEditingShowtime] = useState(null);
  // Inline-edit state for showtimes table rows
  const [inlineEditShowtimeId, setInlineEditShowtimeId] = useState(null);
  const [inlineShowtimeDraft, setInlineShowtimeDraft] = useState({});
  const [inlineShowtimeSaving, setInlineShowtimeSaving] = useState(false);

  // Showtime filters + pagination state
  const [showtimeSearch, setShowtimeSearch] = useState('');
  const [showtimeCinemaFilter, setShowtimeCinemaFilter] = useState('all');
  const [showtimeDateFilter, setShowtimeDateFilter] = useState('all');
  const [showtimePage, setShowtimePage] = useState(1);

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
  useEffect(() => { setShowtimePage(1); }, [showtimeSearch, showtimeCinemaFilter, showtimeDateFilter]);
  const cinemaTotalPages = Math.max(1, Math.ceil(filteredCinemas.length / PAGE_SIZE));
  const movieTotalPages = Math.max(1, Math.ceil(filteredMovies.length / PAGE_SIZE));

  const filteredShowtimes = useMemo(() => {
    const q = showtimeSearch.trim().toLowerCase();
    return (showtimes || []).filter((st) => {
      if (q) {
        const hay = `${st.film_title || ''} ${st.cinema_name || ''} ${st.screen_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (showtimeCinemaFilter !== 'all' && st.cinema_id !== showtimeCinemaFilter) return false;
      if (showtimeDateFilter !== 'all' && st.show_date !== showtimeDateFilter) return false;
      return true;
    });
  }, [showtimes, showtimeSearch, showtimeCinemaFilter, showtimeDateFilter]);
  const showtimeTotalPages = Math.max(1, Math.ceil(filteredShowtimes.length / PAGE_SIZE));
  const pagedShowtimes = useMemo(
    () => filteredShowtimes.slice((showtimePage - 1) * PAGE_SIZE, showtimePage * PAGE_SIZE),
    [filteredShowtimes, showtimePage]
  );
  const showtimeDateOptions = useMemo(() => {
    const set = new Set((showtimes || []).map((s) => s.show_date).filter(Boolean));
    return Array.from(set).sort();
  }, [showtimes]);
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
      const res = await api.get(`/cinema/management/my-cinemas${params}`);
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
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/cinema/management/my-films${params}`);
      setMovies(res.data.films || res.data || []);
    } catch (error) {
      console.error('Failed to load films:', error);
      setMovies([]);
    }
  }, [scopeOperatorId]);

  const loadShowtimes = useCallback(async () => {
    try {
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/cinema/showtimes/operator${params}`);
      setShowtimes(res.data.showtimes || []);
    } catch (error) {
      console.error('Failed to load showtimes:', error);
      setShowtimes([]);
    }
  }, [scopeOperatorId]);

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
    setExpandedScreenIdx(null);
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

  const handleBulkDeleteCinemas = async () => {
    const ids = Array.from(selectedCinemaIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} cinema${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await api.delete(`/cinema/${id}`);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSelectedCinemaIds(new Set());
    if (selectedCinema && ids.includes(selectedCinema.id)) setSelectedCinema(null);
    toast.success(`${okCount} deleted${failCount ? ` · ${failCount} failed` : ''}`);
    loadCinemas();
  };

  const handleDeleteMovie = async (id) => {
    if (!confirm('Delete this film?')) return;
    try {
      await api.delete(`/cinema/films/${id}`);
      toast.success('Film deleted');
      loadMovies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleBulkDeleteMovies = async () => {
    const ids = Array.from(selectedMovieIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} film${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await api.delete(`/cinema/films/${id}`);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setSelectedMovieIds(new Set());
    toast.success(`${okCount} deleted${failCount ? ` · ${failCount} failed` : ''}`);
    loadMovies();
  };

  const toggleCinemaSelected = (id) => {
    setSelectedCinemaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMovieSelected = (id) => {
    setSelectedMovieIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openMovieDialog = (movie = null) => {
    setEditingMovie(movie);
    setMovieForm(movie ? {
      title: movie.title || '',
      genre: Array.isArray(movie.genre) ? movie.genre : (movie.genre ? String(movie.genre).split(',').map(g => g.trim()).filter(Boolean) : []),
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
    setGenreFieldExpanded(false);
    setIsMovieDialogOpen(true);
  };

  const handleSaveMovie = async () => {
    try {
      const durationMin = parseInt(movieForm.duration) || 120;
      const genreArr = Array.isArray(movieForm.genre) ? movieForm.genre : [];
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
      if (movieForm.operator_id) params.append('operator_id', movieForm.operator_id);
      if (movieForm.operator_name) params.append('operator_name', movieForm.operator_name);

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
  const handleInlineSaveShowtime = async (st) => {
    setInlineShowtimeSaving(true);
    try {
      const payload = {};
      if (inlineShowtimeDraft.screen_name !== undefined && inlineShowtimeDraft.screen_name !== st.screen_name) payload.screen_name = inlineShowtimeDraft.screen_name;
      if (inlineShowtimeDraft.show_date !== undefined && inlineShowtimeDraft.show_date !== st.show_date) payload.show_date = inlineShowtimeDraft.show_date;
      if (inlineShowtimeDraft.show_time !== undefined && inlineShowtimeDraft.show_time !== st.show_time) payload.show_time = inlineShowtimeDraft.show_time;
      if (inlineShowtimeDraft.end_time !== undefined && inlineShowtimeDraft.end_time !== st.end_time) payload.end_time = inlineShowtimeDraft.end_time;
      if (inlineShowtimeDraft.total_seats !== undefined && inlineShowtimeDraft.total_seats !== st.total_seats) payload.total_seats = parseInt(inlineShowtimeDraft.total_seats, 10);
      if (inlineShowtimeDraft.price !== undefined && Number(inlineShowtimeDraft.price) !== Number(st.price)) payload.price = parseFloat(inlineShowtimeDraft.price);
      if (Object.keys(payload).length === 0) {
        toast.info('No changes');
        setInlineEditShowtimeId(null);
        setInlineShowtimeDraft({});
        return;
      }
      await api.put(`/cinema/showtimes/${st.id}`, payload);
      toast.success('Showtime updated');
      setInlineEditShowtimeId(null);
      setInlineShowtimeDraft({});
      loadShowtimes();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setInlineShowtimeSaving(false);
    }
  };


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
        vip_price: showtime.vip_price != null ? String(showtime.vip_price) : '',
        child_price: showtime.child_price != null ? String(showtime.child_price) : '',
        senior_price: showtime.senior_price != null ? String(showtime.senior_price) : '',
        total_seats: showtime.total_seats || 100,
        repeat_mode: 'single',
        repeat_end_date: '',
        repeat_days: [],
      });
    } else {
      setShowtimeForm(DEFAULT_SHOWTIME_FORM);
    }
    setIsShowtimeDialogOpen(true);
  };

  // Expand recurrence to a list of concrete dates between [start, end] inclusive,
  // keeping only the dates whose JS weekday is in repeat_days.
  const computeRecurringDates = (startStr, endStr, daysOfWeek) => {
    if (!startStr || !endStr || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const out = [];
    const cur = new Date(start);
    while (cur <= end) {
      if (daysOfWeek.includes(cur.getDay())) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        out.push(`${y}-${m}-${d}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const handleSaveShowtime = async () => {
    if (!showtimeForm.cinema_id || !showtimeForm.film_id || !showtimeForm.screen_name || !showtimeForm.show_date || !showtimeForm.show_time || !showtimeForm.end_time || !showtimeForm.price) {
      toast.error('Cinema, film, screen, date, time, end time and price are required');
      return;
    }

    // Decide the list of dates to create (recurring) or update (single edit)
    let datesToCreate = [showtimeForm.show_date];
    if (!editingShowtime && showtimeForm.repeat_mode === 'recurring') {
      if (!showtimeForm.repeat_end_date || showtimeForm.repeat_days.length === 0) {
        toast.error('Pick an end date and at least one day of the week for the recurrence');
        return;
      }
      datesToCreate = computeRecurringDates(
        showtimeForm.show_date,
        showtimeForm.repeat_end_date,
        showtimeForm.repeat_days
      );
      if (datesToCreate.length === 0) {
        toast.error('No matching dates in the selected range — check the days and dates');
        return;
      }
      if (datesToCreate.length > 60) {
        toast.error(`That recurrence would create ${datesToCreate.length} showtimes — please narrow the range (max 60).`);
        return;
      }
    }

    try {
      if (editingShowtime) {
        const payload = {
          film_id: showtimeForm.film_id,
          screen_name: showtimeForm.screen_name,
          show_date: showtimeForm.show_date,
          show_time: showtimeForm.show_time,
          end_time: showtimeForm.end_time,
          price: parseFloat(showtimeForm.price),
          screen_type: showtimeForm.screen_type || '2d',
          total_seats: parseInt(showtimeForm.total_seats, 10) || 100,
        };
        if (showtimeForm.vip_price !== '' && showtimeForm.vip_price != null) {
          payload.vip_price = parseFloat(showtimeForm.vip_price);
        }
        if (showtimeForm.child_price !== '' && showtimeForm.child_price != null) {
          payload.child_price = parseFloat(showtimeForm.child_price);
        }
        if (showtimeForm.senior_price !== '' && showtimeForm.senior_price != null) {
          payload.senior_price = parseFloat(showtimeForm.senior_price);
        }
        await api.put(`/cinema/showtimes/${editingShowtime.id}`, payload);
        toast.success('Showtime updated');
      } else {
        // Create one showtime per resolved date
        let created = 0;
        const failures = [];
        for (const d of datesToCreate) {
          const params = new URLSearchParams();
          params.append('film_id', showtimeForm.film_id);
          params.append('screen_name', showtimeForm.screen_name);
          params.append('show_date', d);
          params.append('show_time', showtimeForm.show_time);
          params.append('end_time', showtimeForm.end_time);
          params.append('price', String(parseFloat(showtimeForm.price)));
          params.append('screen_type', showtimeForm.screen_type || '2d');
          params.append('total_seats', String(parseInt(showtimeForm.total_seats) || 100));
          if (showtimeForm.vip_price !== '' && showtimeForm.vip_price != null) {
            params.append('vip_price', String(parseFloat(showtimeForm.vip_price)));
          }
          if (showtimeForm.child_price !== '' && showtimeForm.child_price != null) {
            params.append('child_price', String(parseFloat(showtimeForm.child_price)));
          }
          if (showtimeForm.senior_price !== '' && showtimeForm.senior_price != null) {
            params.append('senior_price', String(parseFloat(showtimeForm.senior_price)));
          }
          try {
            await api.post(`/cinema/${showtimeForm.cinema_id}/showtimes?${params.toString()}`);
            created += 1;
          } catch (e) {
            failures.push(d);
          }
        }
        if (created > 0 && failures.length === 0) {
          toast.success(created === 1 ? 'Showtime scheduled' : `Scheduled ${created} showtimes`);
        } else if (created > 0 && failures.length > 0) {
          toast.warning(`Scheduled ${created} showtimes, ${failures.length} failed`);
        } else {
          toast.error('Failed to schedule any showtimes');
          return;
        }
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="management"><Film className="h-4 w-4 mr-2" />Management</TabsTrigger>
          <TabsTrigger value="communications"><MessageSquare className="h-4 w-4 mr-2" />Communications</TabsTrigger>
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
            recentBookingsSlot={
              <OperatorBookingsList serviceType="cinema" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
            }
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
                    {selectedCinemaIds.size > 0 && (
                      <PermissionGate permission="cinema.delete">
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={handleBulkDeleteCinemas}
                          data-testid="bulk-delete-cinemas-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete selected ({selectedCinemaIds.size})
                        </Button>
                      </PermissionGate>
                    )}
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
                            <th className="px-4 py-3 w-10">
                              <Checkbox
                                checked={pagedCinemas.length > 0 && pagedCinemas.every(c => selectedCinemaIds.has(c.id))}
                                onCheckedChange={(v) => {
                                  setSelectedCinemaIds(prev => {
                                    const next = new Set(prev);
                                    if (v) pagedCinemas.forEach(c => next.add(c.id));
                                    else pagedCinemas.forEach(c => next.delete(c.id));
                                    return next;
                                  });
                                }}
                                aria-label="Select all cinemas"
                                data-testid="select-all-cinemas-checkbox"
                              />
                            </th>
                            <th className="px-4 py-3">Photo</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">City</th>
                            <th className="px-4 py-3">Screens</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCinemas.map(cinema => (
                            <tr key={cinema.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`cinema-row-${cinema.id}`}>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedCinemaIds.has(cinema.id)}
                                  onCheckedChange={() => toggleCinemaSelected(cinema.id)}
                                  aria-label={`Select ${cinema.name}`}
                                  data-testid={`select-cinema-${cinema.id}`}
                                />
                              </td>
                              <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>
                                {(cinema.images && cinema.images[0]) ? (
                                  <img src={cinema.images[0]} alt={cinema.name} className="h-10 w-14 object-cover rounded" />
                                ) : (
                                  <div className="h-10 w-14 rounded bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                                    <Monitor className="h-4 w-4 text-white" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>{cinema.name}</td>
                              <td className="px-4 py-3 text-slate-700 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>{cinema.city || '—'}</td>
                              <td className="px-4 py-3 text-slate-700 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>{cinema.total_screens || (cinema.screens || []).length}</td>
                              <td className="px-4 py-3 text-slate-700 cursor-pointer" onClick={() => setSelectedCinema(cinema)}>{cinema.phone || '—'}</td>
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
                          className={`relative cursor-pointer overflow-hidden border border-slate-200 hover:border-cyan-400 hover:shadow-xl transition-all duration-300 group ${selectedCinema?.id === cinema.id ? 'ring-2 ring-cyan-500 border-cyan-500 shadow-lg' : ''}`}
                          onClick={() => setSelectedCinema(cinema)}
                          data-testid={`cinema-card-${cinema.id}`}
                        >
                          <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur rounded shadow-sm p-1" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedCinemaIds.has(cinema.id)}
                              onCheckedChange={() => toggleCinemaSelected(cinema.id)}
                              aria-label={`Select ${cinema.name}`}
                              data-testid={`select-cinema-card-${cinema.id}`}
                            />
                          </div>
                          {/* Status badge top-right */}
                          <Badge
                            className={`absolute top-3 right-3 z-10 backdrop-blur-sm border ${
                              cinema.status === 'inactive'
                                ? 'bg-slate-500/90 text-white border-slate-400'
                                : 'bg-emerald-500/90 text-white border-emerald-400'
                            }`}
                          >
                            {cinema.status === 'inactive' ? 'Inactive' : 'Active'}
                          </Badge>

                          {/* Hero — image or cinema-themed gradient with screens preview */}
                          {(cinema.images && cinema.images[0]) ? (
                            <div className="relative h-40 w-full overflow-hidden">
                              <img src={cinema.images[0]} alt={cinema.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                              {cinema.rating > 0 && (
                                <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-amber-500 text-slate-950 text-xs font-bold px-2 py-1 rounded-full">
                                  <Star className="w-3 h-3 fill-slate-950" /> {cinema.rating?.toFixed?.(1) || cinema.rating}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="relative h-40 w-full bg-gradient-to-br from-cyan-700 via-cyan-600 to-slate-900 flex items-center justify-center overflow-hidden">
                              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)' }} />
                              <Monitor className="h-14 w-14 text-white/80" />
                              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-0.5">
                                {Array.from({ length: Math.min((cinema.screens || []).length || 1, 8) }, (_, i) => (
                                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-300/60" />
                                ))}
                              </div>
                            </div>
                          )}

                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-1 group-hover:text-cyan-700 transition-colors">{cinema.name}</h3>
                            </div>
                            {/* Location row */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="truncate">{cinema.city || '—'}{cinema.address ? ` · ${cinema.address}` : ''}</span>
                            </div>

                            {/* Coloured screen-type tags */}
                            {(cinema.screens || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {Array.from(new Set((cinema.screens || []).map(s => s.type || s.screen_type || '2d'))).slice(0, 5).map((t) => (
                                  <Badge
                                    key={t}
                                    className={`text-[10px] uppercase tracking-wider border ${
                                      t === 'imax'        ? 'bg-violet-100 text-violet-700 border-violet-300' :
                                      t === '3d'          ? 'bg-cyan-100 text-cyan-700 border-cyan-300' :
                                      t === 'dolby_atmos' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                      t === 'vip'         ? 'bg-rose-100 text-rose-700 border-rose-300' :
                                                            'bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    {t}
                                  </Badge>
                                ))}
                                <Badge variant="outline" className="text-[10px] bg-white">
                                  <Monitor className="w-2.5 h-2.5 mr-0.5" />
                                  {cinema.total_screens || (cinema.screens || []).length} screen{((cinema.screens || []).length || 0) !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            )}

                            {/* Quick stats row — capacity / contact */}
                            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded">
                                <Armchair className="w-3.5 h-3.5 text-cyan-600" />
                                <span className="text-slate-600 tabular-nums">
                                  {(cinema.screens || []).reduce((sum, s) => sum + (s.capacity || 0), 0) || '—'} seats
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded">
                                <Phone className="w-3.5 h-3.5 text-cyan-600" />
                                <span className="text-slate-600 truncate">{cinema.phone || '—'}</span>
                              </div>
                            </div>

                            {cinemaViewMode === 'details' && cinema.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3 italic">{cinema.description}</p>
                            )}
                            {cinema.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {cinema.amenities.slice(0, cinemaViewMode === 'details' ? 6 : 3).map(a => (
                                  <Badge key={a} variant="outline" className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                                    <Sparkles className="w-2.5 h-2.5 mr-0.5 text-cyan-500" />{a.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                                {cinema.amenities.length > (cinemaViewMode === 'details' ? 6 : 3) && (
                                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200">+{cinema.amenities.length - (cinemaViewMode === 'details' ? 6 : 3)}</Badge>
                                )}
                              </div>
                            )}

                            <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleViewItem(cinema, 'cinema'); }} title="View Details" className="px-3">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <PermissionGate permission="cinema.edit">
                                <Button size="sm" variant="outline" className="flex-1 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700" onClick={(e) => { e.stopPropagation(); openCinemaDialog(cinema); }}>
                                  <Edit className="w-4 h-4 mr-1" /> Edit
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="cinema.delete">
                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-300 px-3" onClick={(e) => { e.stopPropagation(); handleDeleteCinema(cinema.id); }}>
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
                    {selectedMovieIds.size > 0 && (
                      <PermissionGate permission="cinema.delete">
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={handleBulkDeleteMovies}
                          data-testid="bulk-delete-movies-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete selected ({selectedMovieIds.size})
                        </Button>
                      </PermissionGate>
                    )}
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
                            <th className="px-4 py-3 w-10">
                              <Checkbox
                                checked={pagedMovies.length > 0 && pagedMovies.every(m => selectedMovieIds.has(m.id || m._id))}
                                onCheckedChange={(v) => {
                                  setSelectedMovieIds(prev => {
                                    const next = new Set(prev);
                                    if (v) pagedMovies.forEach(m => next.add(m.id || m._id));
                                    else pagedMovies.forEach(m => next.delete(m.id || m._id));
                                    return next;
                                  });
                                }}
                                aria-label="Select all films"
                                data-testid="select-all-movies-checkbox"
                              />
                            </th>
                            <th className="px-4 py-3">Poster</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Genre</th>
                            <th className="px-4 py-3">Duration</th>
                            <th className="px-4 py-3">Rating</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedMovies.map(movie => {
                            const movieId = movie.id || movie._id;
                            return (
                              <tr key={movieId} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`movie-row-${movieId}`}>
                                <td className="px-4 py-3">
                                  <Checkbox
                                    checked={selectedMovieIds.has(movieId)}
                                    onCheckedChange={() => toggleMovieSelected(movieId)}
                                    aria-label={`Select ${movie.title}`}
                                    data-testid={`select-movie-${movieId}`}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  {movie.poster_url ? (
                                    <img src={movie.poster_url} alt={movie.title} className="h-14 w-10 object-cover rounded shadow-sm" />
                                  ) : (
                                    <div className="h-14 w-10 rounded bg-gradient-to-br from-red-700 to-rose-600 flex items-center justify-center">
                                      <Film className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-900">{movie.title}</td>
                                <td className="px-4 py-3 text-slate-700">{Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre || '—'}</td>
                                <td className="px-4 py-3 text-slate-700">{movie.duration_minutes ? `${movie.duration_minutes} min` : (movie.duration ? `${movie.duration} min` : '—')}</td>
                                <td className="px-4 py-3 text-slate-700">{movie.rating || '—'}</td>
                                <td className="px-4 py-3 text-right">
                                  <Button size="sm" variant="ghost" onClick={() => handleViewItem(movie, 'movie')}>View</Button>
                                  <PermissionGate permission="cinema.edit">
                                    <Button size="sm" variant="ghost" onClick={() => openMovieDialog(movie)}>Edit</Button>
                                  </PermissionGate>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={movieViewMode === 'details' ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'} data-testid={`movies-${movieViewMode}-view`}>
                      {pagedMovies.map(movie => {
                        const movieId = movie.id || movie._id;
                        return (
                          <Card key={movieId} className="relative overflow-hidden" data-testid={`movie-card-${movieId}`}>
                            <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur rounded shadow-sm p-1">
                              <Checkbox
                                checked={selectedMovieIds.has(movieId)}
                                onCheckedChange={() => toggleMovieSelected(movieId)}
                                aria-label={`Select ${movie.title}`}
                                data-testid={`select-movie-card-${movieId}`}
                              />
                            </div>
                            {movie.poster_url ? (
                              <div className="h-44 w-full overflow-hidden">
                                <img src={movie.poster_url} alt={movie.title} className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-44 w-full bg-gradient-to-br from-red-700 via-rose-600 to-fuchsia-600 flex items-center justify-center">
                                <Film className="h-12 w-12 text-white/80" />
                              </div>
                            )}
                            {movie.status === 'coming_soon' && (
                              <Badge className="absolute top-3 right-3 bg-amber-400 text-slate-900">Coming Soon</Badge>
                            )}
                            <CardContent className="pt-4">
                              <h3 className="font-semibold mb-2 line-clamp-1">{movie.title}</h3>
                              <div className="space-y-1 text-sm text-gray-500">
                                <div className="flex items-center gap-2"><Film className="w-4 h-4" />{Array.isArray(movie.genre) ? movie.genre.join(', ') : (movie.genre || '—')}</div>
                                <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{movie.duration_minutes ? `${movie.duration_minutes} min` : (movie.duration ? `${movie.duration} min` : '—')}</div>
                                <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />{movie.rating || '—'}{movie.imdb_rating ? ` · IMDb ${movie.imdb_rating}` : ''}</div>
                                {movieViewMode === 'details' && movie.description && (
                                  <p className="text-slate-600 pt-2 border-t border-slate-100 line-clamp-3">{movie.description}</p>
                                )}
                              </div>
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
                                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDeleteMovie(movieId)} title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
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
                    <PermissionGate permissions={["cinema.manage_screenings", "operator.services.edit"]}>
                      <Button onClick={() => openShowtimeDialog()} className="bg-[#082c59]" size="sm" data-testid="add-showtime-btn">
                        <Plus className="w-4 h-4 mr-2" /> Add Showtime
                      </Button>
                    </PermissionGate>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters row */}
                  <div className="flex flex-col md:flex-row gap-2 md:items-center mb-4">
                    <div className="relative md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search film, cinema, screen…"
                        value={showtimeSearch}
                        onChange={(e) => setShowtimeSearch(e.target.value)}
                        className="pl-9 bg-white"
                        data-testid="showtime-search-input"
                      />
                    </div>
                    <Select value={showtimeCinemaFilter} onValueChange={setShowtimeCinemaFilter}>
                      <SelectTrigger className="md:w-56 bg-white" data-testid="showtime-cinema-filter">
                        <SelectValue placeholder="All cinemas" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All cinemas</SelectItem>
                        {(cinemas || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={showtimeDateFilter} onValueChange={setShowtimeDateFilter}>
                      <SelectTrigger className="md:w-44 bg-white" data-testid="showtime-date-filter">
                        <SelectValue placeholder="All dates" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All dates</SelectItem>
                        {showtimeDateOptions.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(showtimeSearch || showtimeCinemaFilter !== 'all' || showtimeDateFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowtimeSearch(''); setShowtimeCinemaFilter('all'); setShowtimeDateFilter('all'); }}
                        data-testid="showtime-clear-filters"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>

                  {showtimes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      No showtimes yet. Click <strong>"Add Showtime"</strong> to assign a film to a cinema, screen, date, time and price.
                    </div>
                  ) : filteredShowtimes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      No showtimes match the current filters.
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
                          {pagedShowtimes.map((st) => {
                            const isEdit = inlineEditShowtimeId === st.id;
                            const draft = isEdit ? inlineShowtimeDraft : st;
                            const setDraft = (patch) => setInlineShowtimeDraft(p => ({ ...p, ...patch }));
                            return (
                              <tr key={st.id} className="hover:bg-slate-50" data-testid={`showtime-row-${st.id}`}>
                                <td className="py-3 px-4 font-medium text-[#082c59]">{st.film_title || '—'}</td>
                                <td className="py-3 px-4 text-slate-700">{st.cinema_name || '—'}</td>
                                <td className="py-3 px-4">
                                  {isEdit ? (
                                    <Input
                                      className="h-8 w-32"
                                      value={draft.screen_name || ''}
                                      onChange={(e) => setDraft({ screen_name: e.target.value })}
                                      data-testid={`inline-screen-${st.id}`}
                                    />
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <Monitor className="h-3.5 w-3.5 text-slate-400" />
                                      {st.screen_name || '—'}
                                      {st.screen_type && <span className="text-[10px] uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{st.screen_type}</span>}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {isEdit ? (
                                    <div className="flex flex-col gap-1">
                                      <Input className="h-8 w-32" type="date" value={draft.show_date || ''} onChange={(e) => setDraft({ show_date: e.target.value })} data-testid={`inline-date-${st.id}`} />
                                      <div className="flex gap-1">
                                        <Input className="h-8 w-20" type="time" value={draft.show_time || ''} onChange={(e) => setDraft({ show_time: e.target.value })} data-testid={`inline-time-${st.id}`} />
                                        <Input className="h-8 w-20" type="time" value={draft.end_time || ''} onChange={(e) => setDraft({ end_time: e.target.value })} />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="block">{st.show_date}</span>
                                      <span className="text-xs text-slate-400">{st.show_time}{st.end_time ? ` – ${st.end_time}` : ''}</span>
                                    </>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                {isEdit ? (
                                    <Input
                                      className="h-8 w-20"
                                      type="number"
                                      value={draft.total_seats || 0}
                                      onChange={(e) => setDraft({ total_seats: parseInt(e.target.value) || 0 })}
                                      data-testid={`inline-seats-${st.id}`}
                                    />
                                  ) : (
                                    <span className="text-xs">
                                      <span className="font-semibold">{st.available_seats ?? '—'}</span> / {st.total_seats ?? '—'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {isEdit ? (
                                    <Input className="h-8 w-24" type="number" placeholder="Price" value={draft.price ?? ''} onChange={(e) => setDraft({ price: e.target.value })} data-testid={`inline-price-${st.id}`} />
                                  ) : (
                                    <>{st.price ? formatFCFA(st.price) : '—'}</>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${st.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {st.is_active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1 justify-end">
                                    {!isEdit && (
                                      <PermissionGate permissions={["cinema.manage_screenings", "operator.services.edit"]}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8"
                                          onClick={() => openShowtimeDialog(st)}
                                          data-testid={`edit-showtime-btn-${st.id}`}
                                          title="Edit showtime"
                                        >
                                          <Edit className="w-4 h-4 mr-1" /> Edit
                                        </Button>
                                      </PermissionGate>
                                    )}
                                    {isEdit && (
                                      <>
                                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleInlineSaveShowtime(st)} disabled={inlineShowtimeSaving} data-testid={`inline-save-${st.id}`}>
                                          {inlineShowtimeSaving ? '...' : 'Save'}
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setInlineEditShowtimeId(null); setInlineShowtimeDraft({}); }} data-testid={`inline-cancel-${st.id}`}>
                                          Cancel
                                        </Button>
                                      </>
                                    )}
                                    {!isEdit && (
                                      <>
                                        <PermissionGate permissions={["cinema.manage_screenings", "operator.services.edit"]}>
                                          <Button size="sm" variant="outline" onClick={() => setReplaceShowtime(st)} className="h-8 text-[#082c59]" data-testid={`replace-showtime-btn-${st.id}`}>
                                            <ReplaceIcon className="w-4 h-4 mr-1" /> Replace
                                          </Button>
                                        </PermissionGate>
                                        <PermissionGate permissions={["cinema.manage_screenings", "operator.services.edit"]}>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-red-600 hover:bg-red-50"
                                            onClick={async () => {
                                              if (!window.confirm(`Delete showtime for "${st.film_title || 'this film'}" on ${st.show_date} at ${st.show_time}? This will permanently remove it from the system.`)) return;
                                              try {
                                                await api.delete(`/cinema/showtimes/${st.id}`);
                                                toast.success('Showtime deleted');
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
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredShowtimes.length > 0 && (
                    <div className="mt-4">
                      <Pagination
                        page={showtimePage}
                        totalPages={showtimeTotalPages}
                        onChange={setShowtimePage}
                        total={filteredShowtimes.length}
                        pageSize={PAGE_SIZE}
                        itemLabel="showtime"
                      />
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
            operatorId={scopeOperatorId}
            serviceIcon={<Film className="h-5 w-5 text-red-600" />}
            primaryColor="red"
          />
        </TabsContent>

      </Tabs>

      {/* Cinema Dialog */}
      <ServiceFormShell
        open={isCinemaDialogOpen}
        onOpenChange={setIsCinemaDialogOpen}
        icon={Monitor}
        title={editingCinema ? 'Edit Cinema' : 'Add New Cinema'}
        subtitle={editingCinema
          ? 'Update venue info, screens and amenities. Customers see this on the cinema page.'
          : 'Register a new cinema venue — name, screens, amenities and contact info.'}
        editing={!!editingCinema}
        accent="red"
        leftColumn={
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Venue photos</Label>
              <div className="mt-2">
                <MiniImageUploader
                  images={cinemaForm.images || []}
                  onChange={(imgs) => setCinemaForm(p => ({ ...p, images: imgs }))}
                  max={3}
                  folder="cinemas"
                  accent="red"
                  helperText="Up to 3 photos of the venue. The first is the cover."
                />
              </div>
            </div>
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
                <Label>Screens & seat layout</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCinemaForm(p => ({
                    ...p,
                    screens: [...(p.screens || []), { name: `Screen ${(p.screens?.length || 0) + 1}`, type: '2d', capacity: 96, seat_layout: { rows: 8, cols: 12, aisle_after_col: [6], vip_rows: [], blocked: [] } }]
                  }))}
                  data-testid="add-screen-btn"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add screen
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1 mb-2">Each screen can have its own seat layout. The layout is used at booking time for visual seat selection.</p>
              <div className="space-y-3">
                {(cinemaForm.screens || []).length === 0 && (
                  <p className="text-xs text-slate-500 italic">No screens yet. Click "Add screen" to add theater rooms.</p>
                )}
                {(cinemaForm.screens || []).map((screen, idx) => {
                  const layout = screen.seat_layout || { rows: 8, cols: 12, aisle_after_col: [6], vip_rows: [], blocked: [] };
                  const computedCapacity = (layout.rows || 0) * (layout.cols || 0) - (layout.blocked || []).length;
                  return (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 items-center p-3">
                        <Input
                          className="col-span-4 bg-white"
                          placeholder="Screen name"
                          value={screen.name || ''}
                          onChange={(e) => setCinemaForm(p => ({
                            ...p,
                            screens: p.screens.map((s, i) => i === idx ? { ...s, name: e.target.value } : s)
                          }))}
                          data-testid={`screen-name-${idx}`}
                        />
                        <Select
                          value={screen.type || '2d'}
                          onValueChange={(v) => setCinemaForm(p => ({
                            ...p,
                            screens: p.screens.map((s, i) => i === idx ? { ...s, type: v } : s)
                          }))}
                        >
                          <SelectTrigger className="col-span-3 bg-white" data-testid={`screen-type-${idx}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {SCREEN_TYPES.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="col-span-3 flex items-center gap-1.5 px-2 py-1.5 bg-white rounded border border-slate-200 text-xs">
                          <Armchair className="h-3.5 w-3.5 text-slate-500" />
                          <span className="font-semibold text-slate-700 tabular-nums">{computedCapacity}</span>
                          <span className="text-slate-500">seats</span>
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-cyan-700 border-cyan-300 bg-cyan-50 hover:bg-cyan-100"
                            onClick={() => setExpandedScreenIdx(expandedScreenIdx === idx ? null : idx)}
                            data-testid={`screen-toggle-builder-${idx}`}
                          >
                            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                            {expandedScreenIdx === idx ? 'Hide' : 'Layout'}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-500 h-8"
                            onClick={() => setCinemaForm(p => ({ ...p, screens: p.screens.filter((_, i) => i !== idx) }))}
                            data-testid={`screen-delete-${idx}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {expandedScreenIdx === idx && (
                        <div className="p-3 pt-0">
                          <CinemaSeatBuilder
                            value={layout}
                            onChange={(newLayout) => setCinemaForm(p => ({
                              ...p,
                              screens: p.screens.map((s, i) => i === idx
                                ? { ...s, seat_layout: newLayout, capacity: (newLayout.rows || 0) * (newLayout.cols || 0) - (newLayout.blocked || []).length }
                                : s),
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <OperatorSelector
                value={cinemaForm.operator_id || ''}
                onChange={(id, name) => setCinemaForm(p => ({ ...p, operator_id: id, operator_name: name }))}
                operators={operators}
                testId="cinema-operator-selector"
              />
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
        }
        preview={
          <GenericPreviewCard
            cover={(cinemaForm.images || [])[0]}
            thumbs={(cinemaForm.images || []).slice(1, 3)}
            icon={Monitor}
            badgeText="Cinema"
            badgeClass="bg-red-500 text-white"
            placeholderColor="from-red-700 via-red-600 to-rose-600"
            title={cinemaForm.name || 'Cinema name'}
            subtitle={cinemaForm.phone || cinemaForm.email || 'Contact'}
            location={[cinemaForm.address, cinemaForm.city].filter(Boolean).join(' · ') || 'Address · City'}
            tags={cinemaForm.amenities || []}
            tagsAccentClass="bg-red-50 text-red-700"
            priceLabel="Screens"
            priceValue={(cinemaForm.screens || []).length > 0
              ? `${cinemaForm.screens.length} screen${cinemaForm.screens.length === 1 ? '' : 's'}`
              : '—'}
            accentTextClass="text-red-700"
          />
        }
        submitting={false}
        submitLabel={editingCinema ? 'Update Cinema' : 'Add Cinema'}
        onSubmit={handleSaveCinema}
        submitDataTestId="save-cinema-btn"
      />

      {/* Movie Dialog */}
      <ServiceFormShell
        open={isMovieDialogOpen}
        onOpenChange={setIsMovieDialogOpen}
        icon={Film}
        title={editingMovie ? 'Edit Film' : 'Add New Film'}
        subtitle={editingMovie
          ? 'Refresh poster, synopsis, cast and ratings.'
          : 'Add a new film to your catalogue. Showtimes are scheduled separately.'}
        editing={!!editingMovie}
        accent="red"
        leftColumn={
          <div className="space-y-4">
            <OperatorSelector
              value={movieForm.operator_id || ''}
              onChange={(id, name) => setMovieForm(p => ({ ...p, operator_id: id, operator_name: name }))}
              operators={operators}
              testId="film-operator-selector"
              helperText="Films are owned by an operator (admin can pick any; operators auto-assigned)."
            />
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
                <Label>Genre</Label>
                <button
                  type="button"
                  onClick={() => setGenreFieldExpanded((v) => !v)}
                  className="w-full mt-1 flex items-center justify-between gap-2 bg-white border border-input rounded-md px-3 py-2 text-sm hover:border-slate-400 transition-colors"
                  data-testid="genre-picker-toggle"
                >
                  <span className="flex flex-wrap items-center gap-1 text-left">
                    {movieForm.genre.length === 0 ? (
                      <span className="text-slate-400">Select one or more genres…</span>
                    ) : (
                      movieForm.genre.map((g) => (
                        <span key={g} className="inline-flex items-center bg-red-50 text-red-700 border border-red-200 text-[11px] px-1.5 py-0.5 rounded-full">
                          {g}
                        </span>
                      ))
                    )}
                  </span>
                  {genreFieldExpanded
                    ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                </button>
                {genreFieldExpanded && (
                  <div className="mt-2 p-2 border rounded-md bg-slate-50 flex flex-wrap gap-1.5" data-testid="genre-picker-options">
                    {FILM_GENRE_OPTIONS.map((g) => {
                      const active = movieForm.genre.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setMovieForm((p) => ({
                            ...p,
                            genre: active ? p.genre.filter((x) => x !== g) : [...p.genre, g],
                          }))}
                          data-testid={`genre-option-${g}`}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            active
                              ? 'bg-red-500 text-white border-red-500 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-red-300 hover:text-red-600'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                )}
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
        }
        preview={
          <GenericPreviewCard
            cover={movieForm.poster_url}
            icon={Film}
            badgeText={movieForm.status === 'coming_soon' ? 'Coming Soon' : 'Now Showing'}
            badgeClass={movieForm.status === 'coming_soon' ? 'bg-amber-400 text-slate-900' : 'bg-red-500 text-white'}
            placeholderColor="from-red-700 via-rose-600 to-fuchsia-600"
            title={movieForm.title || 'Film title'}
            subtitle={[movieForm.director && `Dir. ${movieForm.director}`, movieForm.language].filter(Boolean).join(' · ') || 'Director · Language'}
            location={[movieForm.duration && `${movieForm.duration} min`, movieForm.rating, movieForm.release_date].filter(Boolean).join(' · ') || 'Duration · Rating · Release'}
            rating={movieForm.imdb_rating || null}
            tags={Array.isArray(movieForm.genre) ? movieForm.genre : []}
            tagsAccentClass="bg-red-50 text-red-700"
            priceLabel="Cast"
            priceValue={(movieForm.cast || '').split(',').slice(0, 3).map(c => c.trim()).filter(Boolean).join(', ') || '—'}
            accentTextClass="text-slate-900 text-sm"
          />
        }
        submitting={false}
        submitLabel={editingMovie ? 'Update Film' : 'Add Film'}
        onSubmit={handleSaveMovie}
        submitDataTestId="save-movie-btn"
      />

      {/* Showtime Dialog — styled with a gradient header + grouped sections */}
      <Dialog open={isShowtimeDialogOpen} onOpenChange={setIsShowtimeDialogOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden max-h-[92vh]" data-testid="showtime-dialog">
          {/* Hero */}
          <div className="bg-gradient-to-br from-red-700 via-red-600 to-rose-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">{editingShowtime ? 'Edit showtime' : 'Schedule a new showtime'}</h2>
                <p className="text-xs text-white/80">Assign a film to a cinema, screen, date, time and price.</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 160px)' }}>
            {/* Section: WHAT */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">1 · What's playing</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cinema *</Label>
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
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Film *</Label>
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
            </div>

            {/* Section: WHERE */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Monitor className="h-3 w-3" /> 2 · Which screen</p>
              {(() => {
                const cin = cinemas.find((c) => c.id === showtimeForm.cinema_id);
                const availableScreens = cin?.screens || [];
                const selectedScreen = availableScreens.find((s) => s.name === showtimeForm.screen_name);
                if (!showtimeForm.cinema_id) {
                  return <p className="text-xs text-slate-500 italic">Pick a cinema first to see available screens.</p>;
                }
                if (availableScreens.length === 0) {
                  return (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                      This cinema has no screens configured yet. Open the cinema in the Cinemas tab → Edit → Screens & seat layout to add one.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Screen *</Label>
                      <Select
                        value={showtimeForm.screen_name}
                        onValueChange={(v) => {
                          const s = availableScreens.find((x) => x.name === v);
                          const layout = s?.seat_layout;
                          const computedSeats = layout
                            ? (layout.rows || 0) * (layout.cols || 0) - ((layout.blocked || []).length)
                            : (s?.capacity || 0);
                          setShowtimeForm(p => ({
                            ...p,
                            screen_name: v,
                            screen_type: s?.type || '2d',
                            total_seats: computedSeats,
                          }));
                        }}
                      >
                        <SelectTrigger className="bg-white" data-testid="showtime-screen-select"><SelectValue placeholder="Pick a screen..." /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {availableScreens.map((s, i) => {
                            const layout = s.seat_layout;
                            const seatsCount = layout
                              ? (layout.rows || 0) * (layout.cols || 0) - ((layout.blocked || []).length)
                              : (s.capacity || 0);
                            return (
                              <SelectItem key={i} value={s.name}>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium">{s.name}</span>
                                  <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded">{s.type || '2d'}</span>
                                  <span className="text-slate-500 text-xs">· {seatsCount} seats</span>
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Read-only screen summary — auto-derived from the selected screen */}
                    {selectedScreen && (
                      <div className="grid grid-cols-3 gap-3 text-xs bg-white rounded-md border border-slate-200 p-3">
                        <div>
                          <p className="text-slate-500 mb-0.5">Format</p>
                          <p className="font-semibold text-slate-700 uppercase">{selectedScreen.type || '2d'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Capacity</p>
                          <p className="font-semibold text-slate-700 tabular-nums">{showtimeForm.total_seats} seats</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Layout</p>
                          <p className="font-semibold text-slate-700 tabular-nums">
                            {selectedScreen.seat_layout
                              ? `${selectedScreen.seat_layout.rows}r × ${selectedScreen.seat_layout.cols}c`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Section: WHEN */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Clock className="h-3 w-3" /> 3 · When</p>
                {!editingShowtime && (
                  <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[11px]" data-testid="showtime-repeat-mode">
                    <button
                      type="button"
                      onClick={() => setShowtimeForm(p => ({ ...p, repeat_mode: 'single' }))}
                      data-testid="repeat-mode-single"
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${
                        showtimeForm.repeat_mode === 'single' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      One date
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowtimeForm(p => ({ ...p, repeat_mode: 'recurring' }))}
                      data-testid="repeat-mode-recurring"
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${
                        showtimeForm.repeat_mode === 'recurring' ? 'bg-[#082c59] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Recurring
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{showtimeForm.repeat_mode === 'recurring' ? 'Start date *' : 'Date *'}</Label>
                  <Input className="bg-white" type="date" value={showtimeForm.show_date} onChange={(e) => setShowtimeForm(p => ({ ...p, show_date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Start *</Label>
                  <Input className="bg-white" type="time" value={showtimeForm.show_time} onChange={(e) => setShowtimeForm(p => ({ ...p, show_time: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">End *</Label>
                  <Input className="bg-white" type="time" value={showtimeForm.end_time} onChange={(e) => setShowtimeForm(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>

              {showtimeForm.repeat_mode === 'recurring' && !editingShowtime && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3" data-testid="recurring-section">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">End date *</Label>
                      <Input
                        className="bg-white"
                        type="date"
                        value={showtimeForm.repeat_end_date}
                        min={showtimeForm.show_date || undefined}
                        onChange={(e) => setShowtimeForm(p => ({ ...p, repeat_end_date: e.target.value }))}
                        data-testid="repeat-end-date-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Repeat on *</Label>
                    <div className="flex flex-wrap gap-1.5" data-testid="repeat-days-picker">
                      {WEEKDAY_OPTIONS.map((d) => {
                        const active = showtimeForm.repeat_days.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setShowtimeForm((p) => ({
                              ...p,
                              repeat_days: active ? p.repeat_days.filter((x) => x !== d.value) : [...p.repeat_days, d.value],
                            }))}
                            data-testid={`repeat-day-${d.short}`}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                              active
                                ? 'bg-[#082c59] text-white border-[#082c59] shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#082c59]/40 hover:text-[#082c59]'
                            }`}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const preview = computeRecurringDates(
                      showtimeForm.show_date,
                      showtimeForm.repeat_end_date,
                      showtimeForm.repeat_days
                    );
                    if (preview.length === 0) return null;
                    return (
                      <p className="text-[11px] text-slate-600">
                        This will create <span className="font-semibold text-[#082c59]">{preview.length}</span> showtime{preview.length === 1 ? '' : 's'}
                        {preview.length > 60 ? ' — too many, please narrow the range.' : '.'}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Section: PRICE */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5"><Banknote className="h-3 w-3" /> 4 · Pricing</p>
              {(() => {
                // Detect VIP-eligible screen: a screen with non-empty vip_rows in
                // its seat_layout. When found, we expose a VIP price field so
                // operators can charge a premium for those rows.
                const selectedCinema = cinemas.find((c) => c.id === showtimeForm.cinema_id);
                const selectedScreen = (selectedCinema?.screens || []).find((s) => s.name === showtimeForm.screen_name);
                const vipRows = selectedScreen?.seat_layout?.vip_rows || [];
                const hasVip = vipRows.length > 0;
                return (
                  <>
                    <div className={hasVip ? 'grid grid-cols-2 gap-3' : ''}>
                      <div>
                        <Label className="text-xs">Regular ticket price (FCFA) *</Label>
                        <Input
                          className="bg-white"
                          type="number"
                          value={showtimeForm.price}
                          onChange={(e) => setShowtimeForm((p) => ({ ...p, price: e.target.value }))}
                          placeholder="3500"
                          data-testid="showtime-price-input"
                        />
                      </div>
                      {hasVip && (
                        <div data-testid="showtime-vip-price-block">
                          <Label className="text-xs">VIP ticket price (FCFA) *</Label>
                          <Input
                            className="bg-white"
                            type="number"
                            value={showtimeForm.vip_price}
                            onChange={(e) => setShowtimeForm((p) => ({ ...p, vip_price: e.target.value }))}
                            placeholder="7500"
                            data-testid="showtime-vip-price-input"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-700/80 mt-1.5">
                      {hasVip
                        ? `Row${vipRows.length === 1 ? '' : 's'} ${vipRows.join(', ')} are VIP on this screen — those seats charge the VIP price; every other seat uses the regular price.`
                        : 'A single flat price applies to every seat on this showtime. To enable VIP pricing, mark rows as VIP in the Cinema → Screens & seat layout step.'}
                    </p>

                    {/* Optional discounted ticket tiers — when left blank the
                        Child / Senior counters are hidden on the booking page. */}
                    <div className="mt-3 pt-3 border-t border-emerald-200/70">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700/80 mb-2">Discount tiers (optional)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Child price (FCFA)</Label>
                          <Input
                            className="bg-white"
                            type="number"
                            value={showtimeForm.child_price}
                            onChange={(e) => setShowtimeForm((p) => ({ ...p, child_price: e.target.value }))}
                            placeholder="Leave blank to hide"
                            data-testid="showtime-child-price-input"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Senior price (FCFA)</Label>
                          <Input
                            className="bg-white"
                            type="number"
                            value={showtimeForm.senior_price}
                            onChange={(e) => setShowtimeForm((p) => ({ ...p, senior_price: e.target.value }))}
                            placeholder="Leave blank to hide"
                            data-testid="showtime-senior-price-input"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-700/70 mt-1.5">When left empty, the Child / Senior ticket type will not appear on the booking page — only Adult.</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setIsShowtimeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShowtime} className="bg-[#082c59]" data-testid="save-showtime-btn">{editingShowtime ? 'Update showtime' : 'Schedule showtime'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl bg-white p-0 overflow-hidden max-h-[92vh]">
          {viewingItem && viewingType === 'cinema' && (
            <div className="overflow-y-auto max-h-[92vh]">
              {/* Hero */}
              {(viewingItem.images && viewingItem.images[0]) ? (
                <div className="relative h-56 w-full">
                  <img src={viewingItem.images[0]} alt={viewingItem.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6 text-white">
                    <Badge className="bg-red-500 text-white mb-2">Cinema</Badge>
                    <h2 className="text-3xl font-bold">{viewingItem.name}</h2>
                    <p className="text-sm flex items-center gap-1 mt-1 text-white/90"><MapPin className="h-4 w-4" /> {viewingItem.address || viewingItem.city || '—'}</p>
                  </div>
                </div>
              ) : (
                <div className="relative h-56 w-full bg-gradient-to-br from-red-700 via-red-600 to-rose-600 flex items-end p-6">
                  <Monitor className="absolute right-6 top-6 h-20 w-20 text-white/15" />
                  <div className="text-white">
                    <Badge className="bg-white text-red-700 mb-2">Cinema</Badge>
                    <h2 className="text-3xl font-bold">{viewingItem.name}</h2>
                    <p className="text-sm flex items-center gap-1 mt-1 text-white/90"><MapPin className="h-4 w-4" /> {viewingItem.address || viewingItem.city || '—'}</p>
                  </div>
                </div>
              )}

              {/* Image strip */}
              {viewingItem.images && viewingItem.images.length > 1 && (
                <div className="grid grid-cols-3 gap-2 px-6 pt-4">
                  {viewingItem.images.slice(1, 4).map((img, idx) => (
                    <img key={idx} src={img} alt="" className="h-24 w-full object-cover rounded-lg" />
                  ))}
                </div>
              )}

              <div className="px-6 pb-6 pt-4 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase">Screens</p>
                    <p className="text-lg font-semibold text-slate-900">{viewingItem.total_screens || (viewingItem.screens || []).length}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase">Seats</p>
                    <p className="text-lg font-semibold text-slate-900">{viewingItem.total_seats || (viewingItem.screens || []).reduce((s, x) => s + (x.capacity || 0), 0) || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase">Phone</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{viewingItem.phone || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 uppercase">Email</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{viewingItem.email || '—'}</p>
                  </div>
                </div>

                {viewingItem.description && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">About</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{viewingItem.description}</p>
                  </div>
                )}

                {viewingItem.amenities?.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingItem.amenities.map(a => (
                        <Badge key={a} variant="outline" className="text-xs uppercase bg-red-50 border-red-200 text-red-700">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {viewingItem.screens?.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Theater rooms</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {viewingItem.screens.map((s, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded p-3 text-sm">
                          <div className="font-medium text-slate-900">{s.name || `Screen ${i + 1}`}</div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Badge variant="outline" className="uppercase text-xs">{s.type || '2d'}</Badge>
                            <span>{s.capacity || 0} seats</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewingItem && viewingType === 'movie' && (
            <div className="overflow-y-auto max-h-[92vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                {/* Poster */}
                <div className="md:col-span-1 bg-slate-900 flex items-center justify-center md:min-h-[500px] p-6">
                  {viewingItem.poster_url ? (
                    <img src={viewingItem.poster_url} alt={viewingItem.title} className="max-h-[460px] w-auto rounded-lg shadow-2xl" />
                  ) : (
                    <div className="h-[400px] w-full max-w-[280px] rounded-lg bg-gradient-to-br from-red-700 via-rose-600 to-fuchsia-600 flex items-center justify-center">
                      <Film className="h-16 w-16 text-white/60" />
                    </div>
                  )}
                </div>
                {/* Details */}
                <div className="md:col-span-2 p-6 space-y-4">
                  <div>
                    {viewingItem.status === 'coming_soon' ? (
                      <Badge className="bg-amber-400 text-slate-900 mb-2">Coming Soon</Badge>
                    ) : (
                      <Badge className="bg-red-500 text-white mb-2">Now Showing</Badge>
                    )}
                    <h2 className="text-2xl font-bold text-slate-900">{viewingItem.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {viewingItem.director ? `Directed by ${viewingItem.director}` : ''}
                      {viewingItem.release_date ? `${viewingItem.director ? ' · ' : ''}${viewingItem.release_date}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(viewingItem.genre) ? viewingItem.genre : (viewingItem.genre || '').split(',')).map(g => g.toString().trim()).filter(Boolean).map(g => (
                      <Badge key={g} variant="outline" className="bg-red-50 border-red-200 text-red-700">{g}</Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Duration</p>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Clock className="h-4 w-4" />{viewingItem.duration_minutes ? `${viewingItem.duration_minutes} min` : (viewingItem.duration ? `${viewingItem.duration} min` : '—')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Rating</p>
                      <p className="text-sm font-semibold text-slate-900">{viewingItem.rating || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Language</p>
                      <p className="text-sm font-semibold text-slate-900">{viewingItem.language || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">IMDb</p>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />{viewingItem.imdb_rating || '—'}</p>
                    </div>
                  </div>

                  {viewingItem.description && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Synopsis</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{viewingItem.description}</p>
                    </div>
                  )}

                  {(viewingItem.cast && (Array.isArray(viewingItem.cast) ? viewingItem.cast : viewingItem.cast.split(',')).filter(Boolean).length > 0) && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">Cast</p>
                      <p className="text-sm text-slate-700">
                        {(Array.isArray(viewingItem.cast) ? viewingItem.cast : viewingItem.cast.split(',')).map(c => c.toString().trim()).filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {viewingItem.trailer_url && (
                    <a
                      href={viewingItem.trailer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      <Film className="h-4 w-4" /> Watch trailer ↗
                    </a>
                  )}

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Showtimes & ticket prices for this film are managed in the <strong>Showtimes</strong> tab — one film can play in multiple cinemas at different prices.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t bg-slate-50">
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
