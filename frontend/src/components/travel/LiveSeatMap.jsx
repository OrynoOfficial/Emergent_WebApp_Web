import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Armchair, User, Lock, Clock, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/api/client';

const STATUS_STYLES = {
  available: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500 text-emerald-700 cursor-pointer',
  selected:  'bg-blue-500 border-blue-600 text-white shadow-lg ring-2 ring-blue-300 cursor-pointer',
  booked:    'bg-red-50 border-red-300 text-red-400 cursor-not-allowed opacity-70',
  reserved:  'bg-amber-100 border-amber-400 text-amber-600 cursor-not-allowed',
  blocked:   'bg-slate-200 border-slate-400 text-slate-400 cursor-not-allowed',
  own_reserved: 'bg-blue-500 border-blue-600 text-white shadow-lg ring-2 ring-blue-300 cursor-pointer',
};

const STATUS_ICONS = {
  selected:  Armchair,
  own_reserved: Armchair,
  booked:    User,
  reserved:  Clock,
  blocked:   Lock,
  available: Armchair,
};

export default function LiveSeatMap({
  routeId,
  departureDate,
  maxSeats = 1,
  selectedSeats = [],
  onSeatsChange,
  autoRefresh = true,
  refreshInterval = 10000,
  className
}) {
  const [seatData, setSeatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const refreshTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const wsRef = useRef(null);
  const currentUserId = useRef(null);

  // Get current user id from token
  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUserId.current = payload.user_id || payload.sub;
      }
    } catch { /* ignore */ }
  }, []);

  // ---- Fetch seat map from server ----
  const fetchSeats = useCallback(async (silent = false) => {
    if (!routeId || !departureDate) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/seat-bookings/', { params: { route_id: routeId, travel_date: departureDate } });
      setSeatData(data);

      // Reconcile: find seats this user has reserved on the server
      if (data.seat_map && currentUserId.current) {
        const myReserved = data.seat_map
          .filter(s => s.status === 'reserved' && s.user_id === currentUserId.current)
          .map(s => String(s.seat_number));

        // Respect the current passenger count — never pre-select more than maxSeats.
        // If the user has more reserved than they currently need, release the excess on the server.
        const capped = myReserved.slice(0, Math.max(0, Number(maxSeats) || 0));
        const excess = myReserved.filter(s => !capped.includes(s));
        if (excess.length > 0) {
          try {
            await api.post('/seat-bookings/release', null, {
              params: { route_id: routeId, travel_date: departureDate, seat_numbers: excess },
              paramsSerializer: (p) => {
                const parts = [];
                Object.entries(p).forEach(([k, v]) => {
                  if (Array.isArray(v)) v.forEach((val) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`));
                  else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
                });
                return parts.join('&');
              }
            });
          } catch { /* non-fatal */ }
        }

        // If server state differs from local, update local to match (capped)
        const localSet = new Set(selectedSeats.map(String));
        const serverSet = new Set(capped);
        if (localSet.size !== serverSet.size || ![...localSet].every(s => serverSet.has(s))) {
          onSeatsChange(capped);
          if (capped.length > 0) {
            setCountdown(new Date(Date.now() + 5 * 60 * 1000));
          } else {
            setCountdown(null);
          }
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('Failed to load seats:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [routeId, departureDate, maxSeats]);
  const syncSeats = useCallback(async (desiredSeats) => {
    if (!routeId || !departureDate) return false;
    setSyncing(true);
    try {
      const { data } = await api.post('/seat-bookings/sync', {
        route_id: routeId,
        travel_date: departureDate,
        desired_seats: desiredSeats.map(String),
      });
      // Update countdown from server response
      if (data.expires_at && desiredSeats.length > 0) {
        setCountdown(new Date(data.expires_at));
      } else if (desiredSeats.length === 0) {
        setCountdown(null);
      }
      // Refresh the seat map to get the real state
      await fetchSeats(true);
      return true;
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        toast.error(detail || 'Some seats were just taken by another user');
      } else {
        toast.error(detail || 'Failed to update seats');
      }
      // Refresh to get the real state
      await fetchSeats(true);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [routeId, departureDate, fetchSeats]);

  // ---- WebSocket for live updates ----
  const connectWs = useCallback(() => {
    if (!routeId || !departureDate) return;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${proto}//${host}/ws/seats/${routeId}/${departureDate}`);
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = () => fetchSeats(true);
      ws.onclose = () => {
        setWsConnected(false);
        // Reconnect after 3s
        setTimeout(() => connectWs(), 3000);
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    } catch { /* ignore */ }
  }, [routeId, departureDate, fetchSeats]);

  // Initial load + WS connect
  useEffect(() => {
    fetchSeats();
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchSeats, connectWs]);

  // HTTP polling fallback
  useEffect(() => {
    if (wsConnected || !autoRefresh) return;
    refreshTimerRef.current = setInterval(() => fetchSeats(true), refreshInterval);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [wsConnected, autoRefresh, refreshInterval, fetchSeats]);

  // Countdown timer
  useEffect(() => {
    if (!countdown) { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); return; }
    countdownTimerRef.current = setInterval(() => {
      if (countdown <= new Date()) {
        setCountdown(null);
        toast.warning('Your seat reservation has expired');
        fetchSeats(true);
      }
    }, 1000);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
  }, [countdown, fetchSeats]);

  // Release on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (selectedSeats.length > 0 && routeId && departureDate && currentUserId.current) {
        const params = new URLSearchParams({ route_id: routeId, travel_date: departureDate, user_id: currentUserId.current });
        navigator.sendBeacon?.(`${api.defaults.baseURL}/seat-bookings/release-beacon?${params}`);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [selectedSeats, routeId, departureDate]);

  // ---- Handle seat click ----
  const handleSeatClick = async (seat) => {
    if (seat.status === 'booked' || seat.status === 'blocked') return;
    if (syncing) return;

    const seatNum = String(seat.seat_number);
    const isMyReservation = seat.user_id === currentUserId.current;
    const isSelected = selectedSeats.map(String).includes(seatNum);

    // Can't click seats reserved by others
    if ((seat.status === 'reserved') && !isMyReservation && !isSelected) {
      toast.error('This seat is held by another user');
      return;
    }

    let newSeats;
    if (isSelected || isMyReservation) {
      // Deselect
      newSeats = selectedSeats.map(String).filter(s => s !== seatNum);
    } else if (selectedSeats.length >= maxSeats) {
      // Swap: remove oldest, add new
      newSeats = [...selectedSeats.map(String).slice(1), seatNum];
    } else {
      // Add
      newSeats = [...selectedSeats.map(String), seatNum];
    }

    // Optimistic UI update
    onSeatsChange(newSeats);

    // Sync with server
    const ok = await syncSeats(newSeats);
    if (!ok) {
      // Server rejected — fetchSeats already reconciled the state
    }
  };

  // ---- Determine visual status for each seat ----
  const getVisualStatus = (seat) => {
    const seatNum = String(seat.seat_number);
    const isSelected = selectedSeats.map(String).includes(seatNum);
    if (isSelected) return 'selected';
    if (seat.status === 'reserved' && seat.user_id === currentUserId.current) return 'own_reserved';
    if (seat.status === 'reserved') return 'reserved';
    return seat.status;
  };

  const formatCountdown = () => {
    if (!countdown) return null;
    const diff = countdown - new Date();
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // ---- Render states ----
  if (loading && !seatData) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Loading seat map...</p>
        </CardContent>
      </Card>
    );
  }

  if (!seatData) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600">Unable to load seat map</p>
          <Button onClick={() => fetchSeats()} className="mt-4 bg-[#082c59]">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { seat_map, statistics, layout } = seatData;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Armchair className="h-5 w-5 text-[#082c59]" />
            Seat Selection
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              "text-[10px] px-2 py-0.5",
              wsConnected ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-50 text-slate-500"
            )}>
              {wsConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {wsConnected ? 'Live' : 'Polling'}
            </Badge>
            {countdown && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-mono">
                <Clock className="h-3 w-3 mr-1" />
                {formatCountdown()}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => fetchSeats()} className="h-8 w-8 p-0" title="Refresh" disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {selectedSeats.length}/{maxSeats} selected
          {selectedSeats.length >= maxSeats && maxSeats > 0 && (
            <span className="text-blue-600 ml-2">Click another seat to swap</span>
          )}
          {syncing && <span className="text-amber-600 ml-2">Updating...</span>}
        </p>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
          {[
            { label: 'Available', style: 'bg-emerald-50 border-emerald-300' },
            { label: 'Yours',     style: 'bg-blue-500 border-blue-600 text-white' },
            { label: 'Held',      style: 'bg-amber-100 border-amber-400' },
            { label: 'Booked',    style: 'bg-red-50 border-red-300' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className={`w-3.5 h-3.5 rounded border ${item.style}`} />
              <span className="text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Bus body — driver cabin on top, then a tighter seat grid with a
            visible centre aisle. Smaller seat tiles (32px) so the whole
            layout fits in ~⅓ less vertical space. */}
        <div className="max-w-[280px] mx-auto">
          {/* Driver cabin (front of bus) */}
          <div className="relative h-10 bg-gradient-to-b from-slate-300 to-slate-200 rounded-t-3xl border-x-2 border-t-2 border-slate-300 flex items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Driver</span>
            <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-slate-400" />
          </div>

          {/* Cabin walls + seats */}
          <div className="border-x-2 border-slate-300 bg-slate-50/60 px-2 py-3">
            {(() => {
              const cols = layout?.columns || 4;
              const aisleAfter = layout?.aisle_after ?? Math.floor(cols / 2);
              // Render seats row by row so we can inject a visible aisle.
              const rows = [];
              for (let i = 0; i < seat_map.length; i += cols) {
                rows.push(seat_map.slice(i, i + cols));
              }
              return (
                <div className="space-y-1.5">
                  {rows.map((row, rIdx) => (
                    <div key={rIdx} className="flex items-center justify-center gap-1">
                      {row.map((seat, cIdx) => {
                        const visualStatus = getVisualStatus(seat);
                        const SeatIcon = STATUS_ICONS[visualStatus] || Armchair;
                        const isClickable = visualStatus === 'available' || visualStatus === 'selected' || visualStatus === 'own_reserved';
                        const seatBtn = (
                          <button
                            key={`s-${seat.seat_number}`}
                            onClick={() => handleSeatClick(seat)}
                            disabled={!isClickable || syncing}
                            className={cn(
                              "relative flex flex-col items-center justify-center rounded-md border-2 transition-all text-[10px] font-bold w-9 h-9 leading-none",
                              STATUS_STYLES[visualStatus] || STATUS_STYLES.available,
                              syncing && isClickable && "opacity-60",
                            )}
                            title={`Seat ${seat.seat_number} — ${visualStatus}`}
                            data-testid={`seat-${seat.seat_number}`}
                          >
                            <SeatIcon className="w-3 h-3 mb-0.5" />
                            <span className="text-[9px]">{seat.seat_number}</span>
                          </button>
                        );
                        // Insert the aisle marker AFTER the column at index `aisleAfter - 1`.
                        // The aisle is a thin dashed strip representing the walking corridor.
                        if (cIdx === aisleAfter - 1 && cIdx < row.length - 1) {
                          return (
                            <React.Fragment key={`f-${seat.seat_number}`}>
                              {seatBtn}
                              <div
                                className="w-3 h-9 flex items-center justify-center"
                                aria-hidden="true"
                              >
                                <div className="w-px h-full border-l border-dashed border-slate-300" />
                              </div>
                            </React.Fragment>
                          );
                        }
                        return seatBtn;
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Bus rear */}
          <div className="h-3 bg-slate-200 rounded-b-2xl border-x-2 border-b-2 border-slate-300 flex items-center justify-center">
            <span className="text-[8px] uppercase tracking-widest text-slate-400">REAR</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between mt-3 text-[11px] text-slate-500 max-w-[280px] mx-auto">
          <span>{statistics?.available || 0} avail</span>
          <span>{statistics?.booked || 0} booked</span>
          <span>{statistics?.reserved || 0} held</span>
        </div>
      </CardContent>
    </Card>
  );
}
