import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Film, Clock, MapPin, ArrowLeft, Calendar, Armchair, Plus, Minus, Loader2 } from 'lucide-react';
import { cinemaApi } from '@/api/management';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 12;

export default function CinemaBooking() {
  const { showtimeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [showtime, setShowtime] = useState(null);
  const [film, setFilm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState(['A3', 'A4', 'B5', 'B6', 'C7', 'D8', 'D9', 'E10']);
  const [ticketCounts, setTicketCounts] = useState({ adult: 1, child: 0, senior: 0 });

  useEffect(() => {
    loadData();
  }, [showtimeId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Mock data
      setShowtime({
        id: showtimeId,
        cinema_name: 'CanalOlympia Yaoundé',
        city: 'Yaoundé',
        screen_name: 'Screen 1',
        screen_type: '3d',
        show_date: searchParams.get('date') || '2025-01-15',
        show_time: '14:00',
        price: 5000,
        total_seats: 96
      });
      setFilm({
        id: searchParams.get('film'),
        title: 'Black Panther: Wakanda Forever',
        duration_minutes: 161,
        rating: 'PG-13'
      });
    } catch (error) {
      console.error('Failed to load showtime:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seatId) => {
    if (bookedSeats.includes(seatId)) return;
    setSelectedSeats(prev => 
      prev.includes(seatId) 
        ? prev.filter(s => s !== seatId)
        : prev.length < getTotalTickets() ? [...prev, seatId] : prev
    );
  };

  const getTotalTickets = () => ticketCounts.adult + ticketCounts.child + ticketCounts.senior;

  const calculateTotal = () => {
    const basePrice = showtime?.price || 0;
    return (ticketCounts.adult * basePrice) + 
           (ticketCounts.child * basePrice * 0.5) + 
           (ticketCounts.senior * basePrice * 0.7);
  };

  const [booking, setBooking] = useState(false);

  const handleBooking = async () => {
    if (selectedSeats.length !== getTotalTickets()) {
      toast.error(`Please select ${getTotalTickets()} seats`);
      return;
    }
    
    setBooking(true);
    try {
      // Call the cinema booking API - seats should be in the body as a list
      const response = await api.post(`/cinema/showtimes/${showtimeId}/book`, selectedSeats);
      
      toast.success(`Booking confirmed! Booking ID: ${response.data.booking_id}`);
      navigate('/orders', { 
        state: { 
          bookingId: response.data.booking_id,
          service: 'cinema',
          message: 'Cinema booking confirmed!'
        }
      });
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error(error.response?.data?.detail || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-black/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Movie & Showtime Info */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{film?.title}</h1>
                <div className="flex flex-wrap gap-4 text-gray-300">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {showtime?.cinema_name}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {showtime?.show_date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {showtime?.show_time}</span>
                  <Badge className="uppercase">{showtime?.screen_type}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{formatFCFA(showtime?.price)}</div>
                <div className="text-gray-400 text-sm">per ticket</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seat Selection */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Select Your Seats</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Screen */}
                <div className="relative mb-8">
                  <div className="h-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full mb-2"></div>
                  <p className="text-center text-gray-500 text-sm">SCREEN</p>
                </div>

                {/* Seats Grid */}
                <div className="flex flex-col items-center gap-2 mb-6">
                  {ROWS.map(row => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="w-6 text-gray-500 text-sm">{row}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: SEATS_PER_ROW }, (_, i) => {
                          const seatId = `${row}${i + 1}`;
                          const isBooked = bookedSeats.includes(seatId);
                          const isSelected = selectedSeats.includes(seatId);
                          return (
                            <button
                              key={seatId}
                              onClick={() => toggleSeat(seatId)}
                              disabled={isBooked}
                              className={`w-7 h-7 rounded-t-lg text-xs font-medium transition-colors ${
                                isBooked ? 'bg-gray-600 text-gray-500 cursor-not-allowed' :
                                isSelected ? 'bg-[#082c59] text-white' :
                                'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                      <span className="w-6 text-gray-500 text-sm">{row}</span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-700 rounded-t-lg"></div>
                    <span className="text-gray-400">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#082c59] rounded-t-lg"></div>
                    <span className="text-gray-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-600 rounded-t-lg"></div>
                    <span className="text-gray-400">Booked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Summary */}
          <div>
            <Card className="bg-gray-800 border-gray-700 sticky top-4">
              <CardHeader>
                <CardTitle className="text-white">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ticket Types */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white">Adult</div>
                      <div className="text-gray-400 text-sm">{formatFCFA(showtime?.price)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, adult: Math.max(0, p.adult - 1) }))}><Minus className="w-4 h-4" /></Button>
                      <span className="w-8 text-center text-white">{ticketCounts.adult}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, adult: p.adult + 1 }))}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white">Child (50% off)</div>
                      <div className="text-gray-400 text-sm">{formatFCFA((showtime?.price || 0) * 0.5)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, child: Math.max(0, p.child - 1) }))}><Minus className="w-4 h-4" /></Button>
                      <span className="w-8 text-center text-white">{ticketCounts.child}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, child: p.child + 1 }))}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white">Senior (30% off)</div>
                      <div className="text-gray-400 text-sm">{formatFCFA((showtime?.price || 0) * 0.7)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, senior: Math.max(0, p.senior - 1) }))}><Minus className="w-4 h-4" /></Button>
                      <span className="w-8 text-center text-white">{ticketCounts.senior}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8 border-gray-600" onClick={() => setTicketCounts(p => ({ ...p, senior: p.senior + 1 }))}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>

                {/* Selected Seats */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-gray-400 text-sm mb-2">Selected Seats ({selectedSeats.length}/{getTotalTickets()})</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSeats.length > 0 ? selectedSeats.map(seat => (
                      <Badge key={seat} className="bg-[#082c59]">{seat}</Badge>
                    )) : <span className="text-gray-500 text-sm">No seats selected</span>}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between text-lg font-bold text-white">
                    <span>Total</span>
                    <span>{formatFCFA(calculateTotal())}</span>
                  </div>
                </div>

                <Button 
                  onClick={handleBooking} 
                  className="w-full bg-[#082c59] hover:bg-[#0a3a75] h-12" 
                  disabled={booking || getTotalTickets() === 0 || selectedSeats.length !== getTotalTickets()}
                >
                  {booking ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : selectedSeats.length !== getTotalTickets() 
                    ? `Select ${getTotalTickets() - selectedSeats.length} more seat(s)`
                    : 'Confirm Booking'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
