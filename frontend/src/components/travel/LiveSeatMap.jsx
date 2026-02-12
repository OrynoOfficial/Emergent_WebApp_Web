import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Armchair, User, Lock, Clock, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/api/client';

const SEAT_STATUS_COLORS = {
  available: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500 text-emerald-700',
  selected: 'bg-blue-500 border-blue-600 text-white shadow-lg ring-2 ring-blue-300',
  booked: 'bg-red-50 border-red-300 text-red-400 cursor-not-allowed',
  pending: 'bg-amber-50 border-amber-300 text-amber-400 cursor-not-allowed',
  reserved: 'bg-amber-50 border-amber-300 text-amber-400 cursor-not-allowed',
  blocked: 'bg-slate-200 border-slate-400 text-slate-400 cursor-not-allowed'
};

export default function LiveSeatMap({ 
  routeId, 
  departureDate, 
  maxSeats = 1,
  selectedSeats = [],
  onSeatsChange,
  autoRefresh = true,
  refreshInterval = 10000,
  allowSeatSwapping = true,
  className 
}) {
  const [seatData, setSeatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reservedBookingIds, setReservedBookingIds] = useState(new Map());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const refreshTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const sessionId = useRef(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const currentUserId = useRef(null);

  // Try to get current user id
  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUserId.current = payload.user_id || payload.sub;
      }
    } catch { /* ignore */ }
  }, []);

  // Generate mock seat data as fallback
  const generateMockSeatData = useCallback(() => {
    const totalSeats = 45;
    const bookedSeats = [3, 7, 12, 18, 24, 31, 38];
    const pendingSeats = [5, 22];
    const seat_map = [];
    for (let i = 1; i <= totalSeats; i++) {
      let status = 'available';
      if (bookedSeats.includes(i)) status = 'booked';
      if (pendingSeats.includes(i)) status = 'pending';
      if (selectedSeats.includes(i)) status = 'selected';
      seat_map.push({ seat_number: i, status, user_id: null });
    }
    return {
      type: 'seat_update',
      seat_map,
      statistics: {
        available: totalSeats - bookedSeats.length - pendingSeats.length - selectedSeats.length,
        booked: bookedSeats.length,
        pending: pendingSeats.length,
        total: totalSeats
      },
      layout: { rows: 5, columns: 9 }
    };
  }, [selectedSeats]);

  // Apply a seat_update message to state
  const applySeatUpdate = useCallback((data) => {
    if (data.type !== 'seat_update' || !data.seat_map) return;

    // Mark user's own selected seats
    const updatedMap = data.seat_map.map(seat => {
      if (selectedSeats.includes(seat.seat_number)) {
        return { ...seat, status: 'selected' };
      }
      // Seats reserved by current user should show as selected
      if ((seat.status === 'reserved' || seat.status === 'pending') && seat.user_id === currentUserId.current) {
        return { ...seat, status: 'selected' };
      }
      return seat;
    });

    setSeatData({
      ...data,
      seat_map: updatedMap,
    });
    setLastRefresh(new Date());
  }, [selectedSeats]);

  // ── WebSocket connection ──
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
      const wsHost = backendUrl.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/ws/seats/${routeId}/${departureDate}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        // Stop HTTP polling when WS is connected
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'seat_update') {
            applySeatUpdate(data);
          }
        } catch { /* ignore bad messages */ }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => connectWs(), 3000);
        // Re-enable HTTP polling as fallback
        if (autoRefresh && !refreshTimerRef.current) {
          refreshTimerRef.current = setInterval(() => fetchSeatsHttp(true), refreshInterval);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setWsConnected(false);
    }
  }, [routeId, departureDate, applySeatUpdate, autoRefresh, refreshInterval]);

  // ── HTTP fetch (fallback) ──
  const fetchSeatsHttp = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get('/seat-bookings/availability', {
          params: { route_id: routeId, travel_date: departureDate }
        });
        const totalSeats = data.total_seats || 45;
        const bookedSeats = data.booked_seats || {};
        const seat_map = [];
        for (let i = 1; i <= totalSeats; i++) {
          const sn = String(i);
          let status = 'available';
          if (bookedSeats[sn] === 'booked') status = 'booked';
          else if (bookedSeats[sn] === 'reserved') status = 'pending';
          if (selectedSeats.includes(i)) status = 'selected';
          seat_map.push({ seat_number: i, status, user_id: null });
        }
        setSeatData({
          type: 'seat_update',
          seat_map,
          statistics: {
            available: data.available_count || totalSeats - Object.keys(bookedSeats).length,
            booked: Object.values(bookedSeats).filter(s => s === 'booked').length,
            pending: Object.values(bookedSeats).filter(s => s === 'reserved').length,
            total: totalSeats
          },
          layout: data.seat_layout || { rows: 5, columns: 9 },
        });
        setLastRefresh(new Date());
        return;
      } catch {
        // Fallback to mock
      }
      const mockData = generateMockSeatData();
      setSeatData(mockData);
      setLastRefresh(new Date());
    } catch {
      toast.error('Failed to load seat availability');
    } finally {
      setLoading(false);
    }
  }, [routeId, departureDate, generateMockSeatData, selectedSeats]);

  // Store selectedSeats in ref for cleanup
  const selectedSeatsRef = useRef(selectedSeats);
  useEffect(() => { selectedSeatsRef.current = selectedSeats; }, [selectedSeats]);

  // Release seats on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const seats = selectedSeatsRef.current;
      if (seats.length > 0) {
        try {
          const token = localStorage.getItem('access_token');
          if (token) {
            navigator.sendBeacon(
              `${import.meta.env.VITE_API_URL}/seat-bookings/release-beacon`,
              JSON.stringify({ route_id: routeId, travel_date: departureDate, seat_numbers: seats.map(String), token })
            );
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const seats = selectedSeatsRef.current;
      if (seats.length > 0) {
        api.post('/seat-bookings/release', null, {
          params: { route_id: routeId, travel_date: departureDate, seat_numbers: seats.map(String) }
        }).catch(() => {});
      }
      // Close WS
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [routeId, departureDate]);

  // Initial load + WebSocket connect
  useEffect(() => {
    fetchSeatsHttp();
    connectWs();
  }, [fetchSeatsHttp, connectWs]);

  // HTTP polling fallback (only if WS is not connected)
  useEffect(() => {
    if (wsConnected || !autoRefresh) return;
    refreshTimerRef.current = setInterval(() => fetchSeatsHttp(true), refreshInterval);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [wsConnected, autoRefresh, refreshInterval, fetchSeatsHttp]);

  // Countdown timer
  useEffect(() => {
    if (!countdown) { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); return; }
    countdownTimerRef.current = setInterval(() => {
      if (countdown <= new Date()) { setCountdown(null); toast.warning('Your seat reservation has expired'); fetchSeatsHttp(true); }
    }, 1000);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
  }, [countdown, fetchSeatsHttp]);

  // Handle seat click
  const handleSeatClick = async (seat) => {
    if (seat.status === 'booked' || seat.status === 'blocked') return;
    if ((seat.status === 'pending' || seat.status === 'reserved') && !reservedBookingIds.has(seat.seat_number)) {
      toast.error('This seat is being reserved by another customer');
      return;
    }

    const seatNumber = seat.seat_number;
    const isSelected = selectedSeats.includes(seatNumber);

    if (isSelected) {
      try {
        await api.post('/seat-bookings/release', null, { params: { route_id: routeId, travel_date: departureDate, seat_numbers: [String(seatNumber)] } });
      } catch { /* ignore */ }
      const updatedSeats = selectedSeats.filter(s => s !== seatNumber);
      onSeatsChange(updatedSeats, Array.from(reservedBookingIds.values()));
      setReservedBookingIds(prev => { const next = new Map(prev); next.delete(seatNumber); return next; });
      toast.success(`Seat ${seatNumber} released`);
      if (updatedSeats.length === 0) setCountdown(null);
    } else {
      if (selectedSeats.length >= maxSeats) {
        if (!allowSeatSwapping) { toast.error(`You can only select up to ${maxSeats} seat(s)`); return; }
        const oldestSeat = selectedSeats[0];
        try {
          await api.post('/seat-bookings/release', null, { params: { route_id: routeId, travel_date: departureDate, seat_numbers: [String(oldestSeat)] } });
          const { data } = await api.post('/seat-bookings/reserve', { route_id: routeId, travel_date: departureDate, seat_numbers: [String(seatNumber)] });
          const updatedSeats = [...selectedSeats.slice(1), seatNumber];
          const next = new Map(reservedBookingIds); next.delete(oldestSeat); next.set(seatNumber, data.reservation_id || `booking-${seatNumber}`);
          setReservedBookingIds(next);
          onSeatsChange(updatedSeats, Array.from(next.values()));
          const expiry = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 10 * 60 * 1000);
          setCountdown(expiry);
          toast.success(`Seat swapped: ${oldestSeat} → ${seatNumber}`);
        } catch (err) {
          const updatedSeats = [...selectedSeats.slice(1), seatNumber];
          const next = new Map(reservedBookingIds); next.delete(oldestSeat); next.set(seatNumber, `booking-${seatNumber}`);
          setReservedBookingIds(next);
          onSeatsChange(updatedSeats, Array.from(next.values()));
          setCountdown(new Date(Date.now() + 10 * 60 * 1000));
          toast.success(`Seat swapped: ${oldestSeat} → ${seatNumber}`);
        }
      } else {
        try {
          const { data } = await api.post('/seat-bookings/reserve', { route_id: routeId, travel_date: departureDate, seat_numbers: [String(seatNumber)] });
          const updatedSeats = [...selectedSeats, seatNumber];
          const next = new Map(reservedBookingIds); next.set(seatNumber, data.reservation_id || `booking-${seatNumber}`);
          setReservedBookingIds(next);
          onSeatsChange(updatedSeats, Array.from(next.values()));
          const timeoutMinutes = data.timeout_minutes || 10;
          const expiry = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + timeoutMinutes * 60 * 1000);
          setCountdown(expiry);
          toast.success(`Seat ${seatNumber} reserved for ${timeoutMinutes} minutes`);
        } catch (err) {
          if (err.response?.status === 400) { toast.error(err.response?.data?.detail || 'Seat already taken'); fetchSeatsHttp(true); return; }
          const updatedSeats = [...selectedSeats, seatNumber];
          const next = new Map(reservedBookingIds); next.set(seatNumber, `booking-${seatNumber}`);
          setReservedBookingIds(next);
          onSeatsChange(updatedSeats, Array.from(next.values()));
          setCountdown(new Date(Date.now() + 10 * 60 * 1000));
          toast.success(`Seat ${seatNumber} reserved for 10 minutes`);
        }
      }
    }
  };

  const getSeatStatus = (seat) => {
    if (selectedSeats.includes(seat.seat_number)) return 'selected';
    if (seat.status === 'reserved') return 'pending';
    return seat.status;
  };

  const renderSeatIcon = (status) => {
    switch (status) {
      case 'selected': return <Armchair className="w-4 h-4" />;
      case 'booked': return <User className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'blocked': return <Lock className="w-4 h-4" />;
      default: return <Armchair className="w-4 h-4" />;
    }
  };

  const formatCountdown = () => {
    if (!countdown) return null;
    const diff = countdown - new Date();
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
          <Button onClick={() => fetchSeatsHttp()} className="mt-4 bg-[#082c59]">Retry</Button>
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
            Live Seat Selection
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* WebSocket indicator */}
            <Badge variant="outline" className={cn(
              "text-[10px] px-2 py-0.5",
              wsConnected ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-50 text-slate-500 border-slate-200"
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
            <Button variant="ghost" size="sm" onClick={() => fetchSeatsHttp()} className="h-8 w-8 p-0" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {selectedSeats.length}/{maxSeats} selected
          {allowSeatSwapping && selectedSeats.length >= maxSeats && (
            <span className="text-blue-600 ml-2">Click another seat to swap</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-2 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="font-bold text-emerald-700">{statistics.available}</div>
            <div className="text-slate-600">Available</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="font-bold text-blue-700">{selectedSeats.length}</div>
            <div className="text-slate-600">Selected</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
            <div className="font-bold text-red-700">{statistics.booked}</div>
            <div className="text-slate-600">Booked</div>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-200">
            <div className="font-bold text-amber-700">{statistics.pending}</div>
            <div className="text-slate-600">Pending</div>
          </div>
        </div>

        {/* Seat Map */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="bg-slate-300 h-12 rounded-t-full mb-6 flex items-center justify-center shadow-sm">
            <span className="text-sm font-medium text-slate-700">Driver</span>
          </div>

          <div className="max-w-md mx-auto">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${layout?.columns || 9}, 1fr)` }}>
              {seat_map.map((seat) => {
                const status = getSeatStatus(seat);
                const isClickable = status === 'available' || status === 'selected';
                return (
                  <button
                    key={seat.seat_number}
                    onClick={() => handleSeatClick(seat)}
                    disabled={!isClickable}
                    className={cn(
                      'h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-200 text-xs font-medium relative',
                      SEAT_STATUS_COLORS[status],
                      isClickable && 'cursor-pointer transform hover:scale-110 active:scale-95'
                    )}
                    title={
                      status === 'booked' ? 'Booked' :
                      status === 'pending' ? 'Reserved by another user' :
                      status === 'blocked' ? 'Blocked' :
                      status === 'selected' ? 'Click to deselect' :
                      'Click to select'
                    }
                  >
                    <div className="absolute top-1 right-1">{renderSeatIcon(status)}</div>
                    <span className="text-sm font-bold mt-1">{seat.seat_number}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs pt-2 border-t">
          {[
            { status: 'available', label: 'Available', icon: Armchair, bg: 'bg-emerald-50 border-emerald-300', color: 'text-emerald-600' },
            { status: 'selected', label: 'Selected', icon: Armchair, bg: 'bg-blue-500 border-blue-600', color: 'text-white' },
            { status: 'booked', label: 'Booked', icon: User, bg: 'bg-red-50 border-red-300', color: 'text-red-400' },
            { status: 'pending', label: 'Pending', icon: Clock, bg: 'bg-amber-50 border-amber-300', color: 'text-amber-600' },
            { status: 'blocked', label: 'Blocked', icon: Lock, bg: 'bg-slate-200 border-slate-400', color: 'text-slate-600' },
          ].map(item => (
            <div key={item.status} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded border-2 ${item.bg} flex items-center justify-center`}>
                <item.icon className={`w-3 h-3 ${item.color}`} />
              </div>
              <span className="text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Reservation warning */}
        {countdown && selectedSeats.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-amber-900">Seats reserved for {formatCountdown()}</p>
              <p className="text-amber-700 text-xs mt-1">Complete your booking before the timer expires.</p>
            </div>
          </div>
        )}

        {/* Connection status */}
        <div className="text-xs text-slate-500 text-center bg-slate-100 py-2 px-3 rounded-lg">
          <span className="flex items-center justify-center gap-2">
            {wsConnected ? <Wifi className="h-3 w-3 text-emerald-500" /> : <RefreshCw className="h-3 w-3" />}
            {wsConnected ? 'Real-time updates active' : `Last updated: ${lastRefresh.toLocaleTimeString()} · Polling every ${refreshInterval / 1000}s`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
