import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Film, Clock, Star, Calendar, Ticket, Loader2, Users, Monitor, MapPin, Crown,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';

const GENRE_COLORS = {
  Action:    'bg-red-100 text-red-700',
  Comedy:    'bg-yellow-100 text-yellow-700',
  Drama:     'bg-blue-100 text-blue-700',
  Horror:    'bg-purple-100 text-purple-700',
  'Sci-Fi':  'bg-cyan-100 text-cyan-700',
  Romance:   'bg-pink-100 text-pink-700',
  Animation: 'bg-green-100 text-green-700',
  Adventure: 'bg-orange-100 text-orange-700',
  Crime:     'bg-slate-100 text-slate-700',
  Thriller:  'bg-rose-100 text-rose-700',
};

const SCREEN_TYPE_LABELS = {
  '2d':           { label: '2D',           color: 'bg-gray-200 text-gray-800' },
  '3d':           { label: '3D',           color: 'bg-blue-200 text-blue-800' },
  'imax':         { label: 'IMAX',         color: 'bg-purple-200 text-purple-800' },
  'vip':          { label: 'VIP',          color: 'bg-amber-200 text-amber-800' },
  'dolby_atmos':  { label: 'Dolby Atmos',  color: 'bg-indigo-200 text-indigo-800' },
};

const POSTER_FALLBACK = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80';

// Resolve a film poster URL. Backend stores API-relative paths like `/api/static/films/...`;
// prefix them with the page origin so the kubernetes ingress routes them to the backend.
function resolvePoster(url) {
  if (!url) return POSTER_FALLBACK;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${window.location.origin}${url}`;
  return url;
}

function formatDateLabel(yyyymmdd) {
  try {
    const d = parseISO(yyyymmdd);
    if (!isValid(d)) return yyyymmdd;
    return format(d, 'EEEE, MMMM d');
  } catch {
    return yyyymmdd;
  }
}

function ShowtimeCard({ st, onSelect }) {
  const screen = SCREEN_TYPE_LABELS[st.screen_type] || { label: (st.screen_type || '—').toUpperCase(), color: 'bg-gray-200 text-gray-800' };
  const seatsLeft = st.available_seats ?? st.total_seats ?? 0;
  const soldOut = seatsLeft <= 0;
  // Pull a richer date object so we can render day + month prominently on the card.
  let dateLabel = null;
  try {
    const d = parseISO(st.show_date);
    if (isValid(d)) dateLabel = { dow: format(d, 'EEE'), day: format(d, 'd'), mon: format(d, 'MMM') };
  } catch { /* fallthrough — date label stays null */ }
  const hasVip = st.vip_price != null && st.vip_price !== 0;
  return (
    <button
      type="button"
      onClick={() => !soldOut && onSelect(st)}
      disabled={soldOut}
      data-testid={`showtime-card-${st.id}`}
      className={`relative text-left rounded-2xl border bg-white p-4 transition-all duration-200 overflow-hidden ${
        soldOut
          ? 'border-slate-200 opacity-60 cursor-not-allowed'
          : 'border-slate-200 shadow-sm hover:shadow-xl hover:shadow-cyan-500/15 hover:-translate-y-0.5 hover:border-cyan-400 cursor-pointer'
      }`}
    >
      {/* Top accent bar — same hover language as the result Movie cards */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${soldOut ? 'bg-slate-200' : 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400'}`} />

      {/* HEADER: prominent date · time · screen */}
      <div className="flex items-start gap-3 mb-3 pt-1">
        {dateLabel && (
          <div className="flex-shrink-0 w-12 text-center bg-cyan-50 border border-cyan-200 rounded-lg py-1">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-cyan-700/80">{dateLabel.dow}</div>
            <div className="text-xl font-extrabold leading-none text-cyan-700 tabular-nums">{dateLabel.day}</div>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-cyan-700/80">{dateLabel.mon}</div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none" data-testid={`showtime-time-${st.id}`}>
              {st.show_time}
            </div>
            {st.end_time && <span className="text-xs text-slate-500 font-medium">→ {st.end_time}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge className={`text-[10px] ${screen.color}`} data-testid={`showtime-screen-${st.id}`}>{screen.label}</Badge>
            {hasVip && (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-0.5">
                <Crown className="h-2.5 w-2.5" /> VIP
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* MIDDLE: cinema + screen line */}
      <div className="space-y-1 mb-3 text-xs">
        {st.cinema_name && (
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <MapPin className="w-3.5 h-3.5 text-cyan-600" /> {st.cinema_name}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-500">
          <Monitor className="w-3.5 h-3.5" /> {st.screen_name || '—'}
        </div>
      </div>

      {/* FOOTER: price + seats-left */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">From</div>
          <div className="text-lg font-bold text-cyan-700 tabular-nums" data-testid={`showtime-price-${st.id}`}>
            {st.price != null ? formatFCFA(st.price) : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center justify-end gap-1">
            <Users className="w-3 h-3" /> Seats
          </div>
          <div
            className={`text-sm font-semibold tabular-nums ${
              soldOut ? 'text-rose-500' : seatsLeft <= 5 ? 'text-amber-600' : 'text-emerald-600'
            }`}
            data-testid={`showtime-seats-${st.id}`}
          >
            {soldOut ? 'Sold out' : `${seatsLeft} left`}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function FilmDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cityScope = searchParams.get('city') || '';

  const [film, setFilm] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [screenFilter, setScreenFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [filmRes, showtimesRes] = await Promise.all([
          api.get(`/cinema/films/${id}`).catch(() => null),
          api.get(`/cinema/films/${id}/showtimes`, { params: cityScope ? { city: cityScope } : {} }).catch(() => null),
        ]);
        if (cancelled) return;
        setFilm(filmRes?.data || null);
        setShowtimes(showtimesRes?.data?.showtimes || []);
      } catch (e) {
        console.error('Failed to load film details:', e);
        if (!cancelled) { setFilm(null); setShowtimes([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, cityScope]);

  const dateOptions = useMemo(() => {
    const set = new Set(showtimes.map((s) => s.show_date).filter(Boolean));
    return Array.from(set).sort();
  }, [showtimes]);

  const screenOptions = useMemo(() => {
    const set = new Set(showtimes.map((s) => s.screen_type).filter(Boolean));
    return Array.from(set).sort();
  }, [showtimes]);

  const groupedShowtimes = useMemo(() => {
    const list = showtimes
      .filter((s) => dateFilter === 'all' || s.show_date === dateFilter)
      .filter((s) => screenFilter === 'all' || s.screen_type === screenFilter);
    const byDate = new Map();
    for (const s of list) {
      const d = s.show_date || 'TBD';
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(s);
    }
    const result = [];
    for (const date of Array.from(byDate.keys()).sort()) {
      const group = byDate.get(date).slice().sort((a, b) => (a.show_time || '').localeCompare(b.show_time || ''));
      result.push({ date, showtimes: group });
    }
    return result;
  }, [showtimes, dateFilter, screenFilter]);

  const cinemaNames = useMemo(() => {
    const set = new Set();
    for (const s of showtimes) {
      if (s.cinema_name) set.add(s.cinema_name);
    }
    return Array.from(set).sort();
  }, [showtimes]);

  const handleSelectShowtime = (showtime) => {
    sessionStorage.setItem('cinemaBookingData', JSON.stringify({
      film,
      showtime,
      date: showtime.show_date,
    }));
    navigate(`/services/cinema/booking/${showtime.id}?film=${film.id}&date=${showtime.show_date}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (!film) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center text-slate-900">
        <div className="text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold mb-2">Film not found</h2>
          <Button onClick={() => navigate('/services/cinema')} className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold" data-testid="film-details-back-to-cinema">
            Back to Cinema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      {/* Top bar */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" className="text-cyan-700 hover:bg-cyan-50" onClick={() => navigate(-1)} data-testid="film-details-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="w-full md:w-80 flex-shrink-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden relative bg-slate-200 shadow-xl shadow-cyan-500/10 border border-slate-200">
              <img
                src={resolvePoster(film.poster_url)}
                alt={film.title}
                onError={(e) => { e.currentTarget.src = POSTER_FALLBACK; }}
                className="w-full h-full object-cover"
                data-testid="film-poster-image"
              />
              {film.imdb_rating != null && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-amber-400/60 shadow">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <span className="text-slate-900 font-bold">{film.imdb_rating}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info — cyan-tinted card to match cinema accent */}
          <div className="flex-1 rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-cyan-50/40 border-2 border-cyan-200 shadow-lg shadow-cyan-500/10 p-6 md:p-7" data-testid="film-info-card">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4" data-testid="film-title">{film.title}</h1>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-4">
              {film.genre?.map((g) => (
                <Badge key={g} className={GENRE_COLORS[g] || 'bg-slate-200 text-slate-700'}>{g}</Badge>
              ))}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-slate-600 mb-6 text-sm">
              {film.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {Math.floor(film.duration_minutes / 60)}h {film.duration_minutes % 60}m
                </span>
              )}
              {film.rating && (
                <Badge variant="outline" className="border-slate-300 text-slate-700 bg-white">{film.rating}</Badge>
              )}
              {film.release_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {film.release_date}
                </span>
              )}
            </div>

            {/* Description */}
            {film.description && (
              <p className="text-slate-700 mb-6 leading-relaxed">{film.description}</p>
            )}

            {/* Cast & crew + Cinema */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {film.director && (
                <div>
                  <span className="text-slate-500">Director:</span>
                  <span className="ml-2 text-slate-900 font-medium">{film.director}</span>
                </div>
              )}
              {film.cast?.length > 0 && (
                <div>
                  <span className="text-slate-500">Cast:</span>
                  <span className="ml-2 text-slate-900 font-medium">{film.cast.join(', ')}</span>
                </div>
              )}
              {cinemaNames.length > 0 && (
                <div data-testid="film-cinema-names">
                  <span className="text-slate-500 inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Cinema:</span>
                  <span className="ml-2 text-slate-900 font-medium">{cinemaNames.join(', ')}</span>
                </div>
              )}
              {film.language && (
                <div>
                  <span className="text-slate-500">Language:</span>
                  <span className="ml-2 text-slate-900 font-medium">{film.language}</span>
                </div>
              )}
              {film.subtitles?.length > 0 && (
                <div>
                  <span className="text-slate-500">Subtitles:</span>
                  <span className="ml-2 text-slate-900 font-medium">{film.subtitles.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <Card className="bg-white border-slate-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-cyan-600" /> Select Showtime
              </h2>

              <div className="flex flex-wrap gap-3">
                {/* Date filter — default "All dates" */}
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-48 bg-white border-slate-300 text-slate-900" data-testid="showtime-date-filter">
                    <Calendar className="w-4 h-4 mr-2 text-cyan-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="all">All dates</SelectItem>
                    {dateOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {formatDateLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Screen filter — replaces the previous City filter */}
                <Select value={screenFilter} onValueChange={setScreenFilter}>
                  <SelectTrigger className="w-44 bg-white border-slate-300 text-slate-900" data-testid="showtime-screen-filter">
                    <Monitor className="w-4 h-4 mr-2 text-cyan-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                    <SelectItem value="all">All screens</SelectItem>
                    {screenOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SCREEN_TYPE_LABELS[s]?.label || s.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {groupedShowtimes.length === 0 ? (
              <div className="text-center py-12" data-testid="no-showtimes-message">
                <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No showtimes match these filters.</p>
              </div>
            ) : (
              <div className="space-y-8" data-testid="showtime-groups">
                {groupedShowtimes.map(({ date, showtimes: group }) => (
                  <div key={date} data-testid={`showtime-group-${date}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Calendar className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-base font-semibold text-slate-900">{formatDateLabel(date)}</h3>
                      <span className="text-xs text-slate-500">
                        {group.length} showtime{group.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.map((st) => (
                        <ShowtimeCard key={st.id} st={st} onSelect={handleSelectShowtime} />
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
