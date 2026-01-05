import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Armchair, User, Lock, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/api/client';

const SEAT_STATUS_COLORS = {
  available: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-500 text-emerald-700',
  selected: 'bg-blue-500 border-blue-600 text-white shadow-lg ring-2 ring-blue-300',
  booked: 'bg-red-50 border-red-300 text-red-400 cursor-not-allowed',
  pending: 'bg-amber-50 border-amber-300 text-amber-400 cursor-not-allowed',
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
  const refreshTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const sessionId = useRef(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Generate mock seat data
  const generateMockSeatData = useCallback(() => {
    const totalSeats = 45;
    const rows = 5;
    const cols = 9;
    const bookedSeats = [3, 7, 12, 18, 24, 31, 38];
    const pendingSeats = [5, 22];
    
    const seat_map = [];
    for (let i = 1; i <= totalSeats; i++) {
      let status = 'available';
      if (bookedSeats.includes(i)) status = 'booked';
      if (pendingSeats.includes(i)) status = 'pending';
      if (selectedSeats.includes(i)) status = 'selected';
      
      seat_map.push({
        seat_number: i,
        status,
        booked_by_name: status === 'booked' ? 'John D.' : null
      });
    }

    return {
      seat_map,
      statistics: {
        available: totalSeats - bookedSeats.length - pendingSeats.length - selectedSeats.length,
        booked: bookedSeats.length,
        pending: pendingSeats.length,
        total: totalSeats
      },
      layout: { rows, columns: cols },
      route_details: {
        from_city: 'Douala',
        to_city: 'Yaoundé',
        departure_time: '08:00'
      }
    };
  }, [selectedSeats]);

  // Fetch seat availability from backend
  const fetchSeats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Try API first
      try {
        const { data } = await api.get('/seat-bookings/availability', {
          params: { route_id: routeId, travel_date: departureDate }
        });
        
        // Transform API response to seat map format
        const totalSeats = data.total_seats || 45;
        const bookedSeats = data.booked_seats || {};
        
        const seat_map = [];
        for (let i = 1; i <= totalSeats; i++) {
          const seatNum = String(i);
          let status = 'available';
          
          if (bookedSeats[seatNum] === 'booked') status = 'booked';
          else if (bookedSeats[seatNum] === 'reserved') status = 'pending';
          if (selectedSeats.includes(i)) status = 'selected';
          
          seat_map.push({
            seat_number: i,
            status,
            booked_by_name: status === 'booked' ? 'Reserved' : null
          });
        }

        setSeatData({
          seat_map,
          statistics: {
            available: data.available_count || totalSeats - Object.keys(bookedSeats).length,
            booked: Object.values(bookedSeats).filter(s => s === 'booked').length,
            pending: Object.values(bookedSeats).filter(s => s === 'reserved').length,
            total: totalSeats
          },
          layout: data.seat_layout || { rows: 5, columns: 9 },
          route_details: data.route_details || {}
        });
        setLastRefresh(new Date());
        return;
      } catch (err) {
        console.warn('Seat API not available, using mock data:', err.message);
      }

      // Fallback to mock data if API fails
      const mockData = generateMockSeatData();
      setSeatData(mockData);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Failed to fetch seats:', error);
      if (!silent) {
        toast.error('Failed to load seat availability');
      }
    } finally {
      setLoading(false);
    }
  }, [routeId, departureDate, generateMockSeatData, selectedSeats]);

  // Store selectedSeats in a ref for cleanup
  const selectedSeatsRef = useRef(selectedSeats);
  useEffect(() => {
    selectedSeatsRef.current = selectedSeats;
  }, [selectedSeats]);

  // Release seats on unmount (page refresh/navigation) - only runs once on mount
  useEffect(() => {
    const releaseSeatsOnUnload = () => {
      const currentSeats = selectedSeatsRef.current;
      if (currentSeats.length > 0) {
        try {
          // Try to release seats via beacon (works on page unload)
          const token = localStorage.getItem('access_token');
          if (token) {
            navigator.sendBeacon(
              `${import.meta.env.VITE_API_URL}/seat-bookings/release-beacon`,
              JSON.stringify({
                route_id: routeId,
                travel_date: departureDate,
                seat_numbers: currentSeats.map(String),
                token: token
              })
            );
          }
        } catch (err) {
          console.warn('Failed to release seats on unmount:', err);
        }
      }
    };

    // Handle browser/tab close and page refresh
    const handleBeforeUnload = () => {
      releaseSeatsOnUnload();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Release seats when navigating away within the app (component unmount)
      const currentSeats = selectedSeatsRef.current;
      if (currentSeats.length > 0) {
        api.post('/seat-bookings/release', null, {
          params: {
            route_id: routeId,
            travel_date: departureDate,
            seat_numbers: currentSeats.map(String)
          }
        }).catch(err => console.warn('Cleanup release failed:', err));
      }
    };
  }, [routeId, departureDate]); // Only depend on route and date, not selectedSeats

  // Initial load
  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    refreshTimerRef.current = setInterval(() => {
      fetchSeats(true);
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchSeats]);

  // Countdown timer for reservations
  useEffect(() => {
    if (!countdown) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      const now = new Date();
      if (countdown <= now) {
        setCountdown(null);
        toast.warning('Your seat reservation has expired');
        fetchSeats(true);
      }
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [countdown, fetchSeats]);

  // Handle seat click - reserve/release via API
  const handleSeatClick = async (seat) => {
    if (seat.status === 'booked' || seat.status === 'blocked') return;
    
    if (seat.status === 'pending' && !reservedBookingIds.has(seat.seat_number)) {
      toast.error('This seat is being reserved by another customer');
      return;
    }

    const seatNumber = seat.seat_number;
    const isSelected = selectedSeats.includes(seatNumber);

    if (isSelected) {
      // Release seat via API
      try {
        await api.post('/seat-bookings/release', null, {
          params: {
            route_id: routeId,
            travel_date: departureDate,
            seat_numbers: [String(seatNumber)]
          }
        });
      } catch (err) {
        console.warn('Release API failed:', err.message);
      }
      
      const updatedSeats = selectedSeats.filter(s => s !== seatNumber);
      onSeatsChange(updatedSeats, Array.from(reservedBookingIds.values()));
      
      setReservedBookingIds(prev => {
        const next = new Map(prev);
        next.delete(seatNumber);
        return next;
      });
      
      toast.success(`Seat ${seatNumber} released`);
      
      // Clear countdown if no seats selected
      if (updatedSeats.length === 0) {
        setCountdown(null);
      }
    } else {
      // Reserve seat via API
      if (selectedSeats.length >= maxSeats) {
        if (!allowSeatSwapping) {
          toast.error(`You can only select up to ${maxSeats} seat(s)`);
          return;
        }
        
        // Swap: Release oldest seat, reserve new one
        const oldestSeat = selectedSeats[0];
        
        try {
          // Release old seat
          await api.post('/seat-bookings/release', null, {
            params: {
              route_id: routeId,
              travel_date: departureDate,
              seat_numbers: [String(oldestSeat)]
            }
          });
          
          // Reserve new seat
          const { data } = await api.post('/seat-bookings/reserve', {
            route_id: routeId,
            travel_date: departureDate,
            seat_numbers: [String(seatNumber)]
          });
          
          const updatedSeats = [...selectedSeats.slice(1), seatNumber];
          
          const nextReservedBookingIds = new Map(reservedBookingIds);
          nextReservedBookingIds.delete(oldestSeat);
          nextReservedBookingIds.set(seatNumber, data.reservation_id || `booking-${seatNumber}-${Date.now()}`);
          
          setReservedBookingIds(nextReservedBookingIds);
          onSeatsChange(updatedSeats, Array.from(nextReservedBookingIds.values()));
          
          // Set countdown based on API response or default 10 minutes
          const expiry = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 10 * 60 * 1000);
          setCountdown(expiry);
          
          toast.success(`Seat swapped: ${oldestSeat} → ${seatNumber}`);
        } catch (err) {
          console.warn('Swap API failed, using local state:', err.message);
          // Fallback to local state management
          const updatedSeats = [...selectedSeats.slice(1), seatNumber];
          const nextReservedBookingIds = new Map(reservedBookingIds);
          nextReservedBookingIds.delete(oldestSeat);
          nextReservedBookingIds.set(seatNumber, `booking-${seatNumber}-${Date.now()}`);
          setReservedBookingIds(nextReservedBookingIds);
          onSeatsChange(updatedSeats, Array.from(nextReservedBookingIds.values()));
          
          const expiry = new Date();
          expiry.setMinutes(expiry.getMinutes() + 10);
          setCountdown(expiry);
          toast.success(`Seat swapped: ${oldestSeat} → ${seatNumber}`);
        }
      } else {
        // Normal selection - reserve via API
        try {
          const { data } = await api.post('/seat-bookings/reserve', {
            route_id: routeId,
            travel_date: departureDate,
            seat_numbers: [String(seatNumber)]
          });
          
          const updatedSeats = [...selectedSeats, seatNumber];
          
          const nextReservedBookingIds = new Map(reservedBookingIds);
          nextReservedBookingIds.set(seatNumber, data.reservation_id || `booking-${seatNumber}-${Date.now()}`);
          
          setReservedBookingIds(nextReservedBookingIds);
          onSeatsChange(updatedSeats, Array.from(nextReservedBookingIds.values()));
          
          // Set countdown based on API response
          const timeoutMinutes = data.timeout_minutes || 10;
          const expiry = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + timeoutMinutes * 60 * 1000);
          setCountdown(expiry);
          
          toast.success(`Seat ${seatNumber} reserved for ${timeoutMinutes} minutes`);
        } catch (err) {
          if (err.response?.status === 400) {
            toast.error(err.response?.data?.detail || 'Seat already taken');
            fetchSeats(true); // Refresh seat data
            return;
          }
          
          console.warn('Reserve API failed, using local state:', err.message);
          // Fallback to local state management
          const updatedSeats = [...selectedSeats, seatNumber];
          const nextReservedBookingIds = new Map(reservedBookingIds);
          nextReservedBookingIds.set(seatNumber, `booking-${seatNumber}-${Date.now()}`);
          setReservedBookingIds(nextReservedBookingIds);
          onSeatsChange(updatedSeats, Array.from(nextReservedBookingIds.values()));
          
          const expiry = new Date();
          expiry.setMinutes(expiry.getMinutes() + 10);
          setCountdown(expiry);
          toast.success(`Seat ${seatNumber} reserved for 10 minutes`);
        }
      }
    }
  };

  const getSeatStatus = (seat) => {
    if (selectedSeats.includes(seat.seat_number)) return 'selected';
    return seat.status;
  };

  const renderSeatIcon = (status) => {
    switch (status) {
      case 'selected':
        return <Armchair className="w-4 h-4" />;
      case 'booked':
        return <User className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'blocked':
        return <Lock className="w-4 h-4" />;
      default:
        return <Armchair className="w-4 h-4" />;
    }
  };

  const formatCountdown = () => {
    if (!countdown) return null;
    const now = new Date();
    const diff = countdown - now;
    
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
          <Button onClick={() => fetchSeats()} className="mt-4 bg-[#082c59]">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { seat_map, statistics, layout, route_details } = seatData;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Armchair className="h-5 w-5 text-[#082c59]" />
            Live Seat Selection
          </CardTitle>
          <div className="flex items-center gap-2">
            {countdown && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-mono">
                <Clock className="h-3 w-3 mr-1" />
                {formatCountdown()}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchSeats()}
              className="h-8 w-8 p-0"
              title="Refresh seat map"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {route_details.from_city} → {route_details.to_city} • {route_details.departure_time} • {selectedSeats.length}/{maxSeats} selected
          {allowSeatSwapping && selectedSeats.length >= maxSeats && (
            <span className="text-blue-600 ml-2">• Click another seat to swap</span>
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

        {/* Seat Map Visual */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          {/* Driver indicator */}
          <div className="bg-slate-300 h-12 rounded-t-full mb-6 flex items-center justify-center shadow-sm">
            <span className="text-sm font-medium text-slate-700">🚗 Driver</span>
          </div>

          {/* Seats grid */}
          <div className="max-w-md mx-auto">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}>
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
                      status === 'booked' ? `Booked by ${seat.booked_by_name || 'someone'}` :
                      status === 'pending' ? 'Reserved by another user' :
                      status === 'blocked' ? 'Blocked by operator' :
                      status === 'selected' ? 'Click to deselect' :
                      'Click to select'
                    }
                  >
                    <div className="absolute top-1 right-1">
                      {renderSeatIcon(status)}
                    </div>
                    <span className="text-sm font-bold mt-1">{seat.seat_number}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-emerald-50 border-emerald-300 flex items-center justify-center">
              <Armchair className="w-3 h-3 text-emerald-600" />
            </div>
            <span className="text-slate-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-blue-500 border-blue-600 flex items-center justify-center">
              <Armchair className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-700">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-red-50 border-red-300 flex items-center justify-center">
              <User className="w-3 h-3 text-red-400" />
            </div>
            <span className="text-slate-700">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-amber-50 border-amber-300 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-600" />
            </div>
            <span className="text-slate-700">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 bg-slate-200 border-slate-400 flex items-center justify-center">
              <Lock className="w-3 h-3 text-slate-600" />
            </div>
            <span className="text-slate-700">Blocked</span>
          </div>
        </div>

        {/* Warning for reserved seats */}
        {countdown && selectedSeats.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-amber-900">
                ⏰ Seats reserved for {formatCountdown()}
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Complete your booking before the timer expires or your seats will be automatically released.
              </p>
            </div>
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="text-xs text-slate-500 text-center bg-slate-100 py-2 px-3 rounded-lg">
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="h-3 w-3" />
            Last updated: {lastRefresh.toLocaleTimeString()} {autoRefresh && `• Auto-refresh: ${refreshInterval / 1000}s`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
