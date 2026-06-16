// Customer-side Event Showtime detail + booking page. Mirrors the cinema
// booking pattern but adapted to the Location → Showtime architecture:
// - One showtime carries N ticket "classes" (VIP / Standard / ...).
// - Booking decrements `available_units` atomically per class on the backend.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, MapPin, Calendar, Clock, Ticket, Users, Loader2, CheckCircle2,
  Plus, Minus, Flame, Sparkles, Image as ImageIcon, AlertCircle, Building2,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy · HH:mm') : iso;
}

function availabilityChip(c) {
  const avail = c.available_units ?? 0;
  const total = c.total_units ?? 0;
  if (avail <= 0) return { text: 'Sold out', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle };
  if (total > 0 && avail / total <= 0.2) return { text: `Only ${avail} left`, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame };
  return { text: `${avail} available`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles };
}

export default function ShowtimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showtime, setShowtime] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [posterIdx, setPosterIdx] = useState(0);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const sRes = await api.get(`/event-showtimes/${id}`);
        setShowtime(sRes.data);
        if (sRes.data?.location_id) {
          try {
            const lRes = await api.get(`/event-locations/${sRes.data.location_id}`);
            setLocation(lRes.data);
          } catch (err) { console.warn('Location fetch failed:', err); }
        }
        const firstAvailable = (sRes.data.classes || []).find(c => (c.available_units ?? 0) > 0);
        if (firstAvailable) setSelectedClassId(firstAvailable.id);
      } catch (err) {
        toast.error('Showtime not found');
        navigate('/services/events');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (user) {
      setContact(c => ({
        ...c,
        name: c.name || user.name || '',
        email: c.email || user.email || '',
        phone: c.phone || user.phone || '',
      }));
    }
  }, [user]);

  const selectedClass = useMemo(
    () => (showtime?.classes || []).find(c => c.id === selectedClassId),
    [showtime, selectedClassId]
  );

  const subtotal = selectedClass ? Number(selectedClass.price) * quantity : 0;
  const maxQty = selectedClass ? Math.max(1, Math.min(10, selectedClass.available_units || 0)) : 1;
  const isPastShowtime = useMemo(() => {
    if (!showtime?.start_datetime) return false;
    const d = parseISO(showtime.start_datetime);
    return isValid(d) && d.getTime() < Date.now();
  }, [showtime]);

  const handleBook = async () => {
    if (!selectedClassId) { toast.error('Pick a ticket class'); return; }
    if (quantity < 1) { toast.error('Quantity must be at least 1'); return; }
    if (!contact.name?.trim()) { toast.error('Your name is required'); return; }
    setBooking(true);
    try {
      const res = await api.post('/event-showtimes/book', {
        showtime_id: showtime.id,
        class_id: selectedClassId,
        quantity,
        contact_name: contact.name,
        contact_phone: contact.phone || null,
        contact_email: contact.email || null,
      });
      toast.success(`${quantity} × ${selectedClass.name} ticket(s) reserved — complete payment to confirm`);
      navigate(`/orders?highlight=${res.data.order_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally { setBooking(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading event…</p>
        </div>
      </div>
    );
  }
  if (!showtime) return null;

  const posters = showtime.images || [];
  const policies = location?.policies || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2" data-testid="showtime-back-btn">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {showtime.operator_logo_url && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <img src={showtime.operator_logo_url} alt={showtime.operator_name} className="w-6 h-6 rounded-full object-cover" />
              <span>{showtime.operator_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — event details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Posters carousel */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-72 relative bg-gradient-to-br from-indigo-200 to-purple-200" data-testid="showtime-poster">
              {posters.length > 0 ? (
                <>
                  <img src={posters[posterIdx]} alt={showtime.title} className="w-full h-full object-cover" />
                  {posters.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {posters.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPosterIdx(i)}
                          className={`w-2 h-2 rounded-full transition ${i === posterIdx ? 'bg-white w-6' : 'bg-white/50'}`}
                          aria-label={`Poster ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-14 h-14 text-white/70" />
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge className="bg-amber-500 text-white border-0 capitalize">{showtime.event_type || 'event'}</Badge>
                {isPastShowtime && <Badge className="bg-slate-700 text-white border-0">Past</Badge>}
                {showtime.status === 'sold_out' && <Badge className="bg-rose-600 text-white border-0">Sold out</Badge>}
              </div>
            </div>
            <CardContent className="p-5 space-y-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900" data-testid="showtime-title">{showtime.title}</h1>
                {showtime.description && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{showtime.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">When</p>
                    <p className="text-sm font-semibold text-slate-800">{fmtDateTime(showtime.start_datetime)}</p>
                    {showtime.doors_open_at && (
                      <p className="text-[11px] text-slate-500">Doors {showtime.doors_open_at}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">Where</p>
                    <p className="text-sm font-semibold text-slate-800">{showtime.location_name}</p>
                    {location && (
                      <p className="text-[11px] text-slate-500">{location.city}{location.address ? ` · ${location.address}` : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Venue card */}
          {location && (
            <Card className="border-indigo-100">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{location.name}</p>
                    {location.description && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{location.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {location.capacity} cap</span>
                      <span className="capitalize">{location.layout_type?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                {policies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1.5">Venue policies</p>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {policies.map((p, i) => <li key={i} className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" /> {p}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — ticket class picker + booking */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-amber-200 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="w-5 h-5 text-amber-700" />
                <h2 className="font-bold text-slate-900">Pick your tickets</h2>
              </div>
              <div className="space-y-2" data-testid="ticket-classes">
                {(showtime.classes || []).map(c => {
                  const isActive = selectedClassId === c.id;
                  const soldOut = (c.available_units ?? 0) <= 0;
                  const chip = availabilityChip(c);
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={soldOut || isPastShowtime}
                      onClick={() => { setSelectedClassId(c.id); setQuantity(1); }}
                      className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                        soldOut || isPastShowtime ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' :
                        isActive ? 'border-amber-500 bg-amber-50 shadow' : 'border-slate-200 hover:border-amber-300 bg-white'
                      }`}
                      data-testid={`class-option-${c.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: c.color || '#3b82f6' }}
                          />
                          <span className="font-semibold text-sm text-slate-900 truncate">{c.name}</span>
                        </div>
                        <span className="font-bold text-amber-700 text-sm whitespace-nowrap">{formatFCFA(c.price)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${chip.color}`}>
                          <ChipIcon className="w-3 h-3" /> {chip.text}
                        </span>
                        {(c.perks || []).slice(0, 2).map((p, i) => (
                          <span key={i} className="text-[10px] text-slate-500">• {p}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quantity */}
              {selectedClass && !isPastShowtime && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Quantity</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm" variant="outline" className="w-8 h-8 p-0"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        data-testid="qty-decrement"
                      ><Minus className="w-3.5 h-3.5" /></Button>
                      <span className="font-bold w-8 text-center" data-testid="qty-value">{quantity}</span>
                      <Button
                        size="sm" variant="outline" className="w-8 h-8 p-0"
                        onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                        disabled={quantity >= maxQty}
                        data-testid="qty-increment"
                      ><Plus className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Up to {maxQty} per order</p>
                </div>
              )}

              {/* Contact */}
              {selectedClass && !isPastShowtime && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs uppercase font-semibold text-slate-500">Your details</p>
                  <div>
                    <Label className="text-[10px]">Name *</Label>
                    <Input value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} className="h-9 text-sm" data-testid="contact-name-input" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Email</Label>
                      <Input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} className="h-9 text-sm" data-testid="contact-email-input" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Phone</Label>
                      <Input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} className="h-9 text-sm" data-testid="contact-phone-input" />
                    </div>
                  </div>
                </div>
              )}

              {/* Total + CTA */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs uppercase font-semibold text-slate-500">Total</span>
                  <span className="text-2xl font-bold text-amber-700" data-testid="total-amount">{formatFCFA(subtotal)}</span>
                </div>
                <Button
                  onClick={handleBook}
                  disabled={!selectedClass || booking || isPastShowtime || (selectedClass?.available_units ?? 0) <= 0}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11"
                  data-testid="book-now-btn"
                >
                  {booking ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving…</>
                  ) : isPastShowtime ? (
                    <><AlertCircle className="w-4 h-4 mr-2" /> Event has ended</>
                  ) : (
                    <><Ticket className="w-4 h-4 mr-2" /> Reserve {quantity > 1 ? `${quantity} tickets` : 'ticket'}</>
                  )}
                </Button>
                <p className="text-[10px] text-slate-500 mt-2 text-center">You'll complete payment after reservation.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
