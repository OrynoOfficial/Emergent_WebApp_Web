// Rich event preview modal — opened from the EventsResults grid by clicking
// "View Details". Mirrors the travel-results vehicle preview pattern: shows
// EVERYTHING the customer needs before pivoting to the booking page.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Calendar, Clock, Ticket, Users, X, ChevronLeft, ChevronRight,
  Building2, Theater, Flame, Sparkles, CheckCircle2, AlertCircle, Image as ImageIcon,
  Phone, Mail, Star,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy · HH:mm') : iso;
}

function availabilityChip(c) {
  const avail = c.available_units ?? 0;
  const total = c.total_units ?? 0;
  if (avail <= 0) return { text: 'Sold out', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle };
  if (total > 0 && avail / total <= 0.2) return { text: `Only ${avail} left`, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame };
  return { text: `${avail} left`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles };
}

// Lightweight zone/layout visualisation — purely informational. Cinema-style
// seat-level picking happens on the dedicated booking page.
function LayoutPreview({ location }) {
  if (!location) return null;
  const type = location.layout_type;

  if (type === 'visual_grid') {
    const rows = Math.min(Number(location.grid_rows) || 8, 16);
    const cols = Math.min(Number(location.grid_cols) || 12, 24);
    const aisle = Number(location.grid_aisle_after) || 0;
    return (
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-3/4 h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 mb-2" />
          <p className="text-[10px] uppercase tracking-widest text-slate-400 -mt-1 mb-1">STAGE / SCREEN</p>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-0.5">
              {Array.from({ length: cols }).map((_, c) => (
                <React.Fragment key={c}>
                  <div className="w-2.5 h-2.5 rounded-sm bg-indigo-200" />
                  {aisle > 0 && c + 1 === aisle && <div className="w-2" />}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-3">
          {rows}×{cols} grid · {location.capacity} seats
        </p>
      </div>
    );
  }

  if (type === 'zones' && (location.zones || []).length) {
    return (
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {location.zones.map((z, i) => (
            <div key={i} className="bg-white border-2 border-indigo-100 rounded-lg p-2.5 text-center">
              <p className="text-xs font-bold text-indigo-900 truncate">{z.name}</p>
              <p className="text-[10px] text-slate-500">{z.capacity} seats</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-3">
          {(location.zones || []).length} zones · {location.capacity} total seats
        </p>
      </div>
    );
  }

  // simple
  const kind = location.simple_kind || 'theater_rows';
  const icons = { theater_rows: Theater, banquet_round: Users, open_air: MapPin, standing: Users, mixed: Building2 };
  const Ico = icons[kind] || Theater;
  return (
    <div className="bg-slate-50 rounded-xl p-6 text-center">
      <Ico className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
      <p className="text-sm font-semibold text-slate-700 capitalize">{kind.replace(/_/g, ' ')}</p>
      <p className="text-xs text-slate-500 mt-1">{location.capacity} capacity</p>
    </div>
  );
}

export default function EventPreviewModal({ open, onOpenChange, event }) {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const isShowtime = !!event?._showtime;

  useEffect(() => {
    if (!open || !event) return;
    setPhotoIdx(0);
    if (isShowtime && event.location_id) {
      setLoadingLoc(true);
      api.get(`/event-locations/${event.location_id}`)
        .then(r => setLocation(r.data))
        .catch(() => setLocation(null))
        .finally(() => setLoadingLoc(false));
    } else {
      setLocation(null);
    }
  }, [open, event, isShowtime]);

  const photos = useMemo(() => {
    if (!event) return [];
    const showtimeImages = event.images || [];
    const locationImages = location?.images || [];
    const legacyImages = event.cover_image ? [event.cover_image, ...(event.images || [])] : event.images || [];
    const all = isShowtime ? [...showtimeImages, ...locationImages] : legacyImages;
    return all.filter(Boolean);
  }, [event, location, isShowtime]);

  if (!event) return null;

  const classes = event.classes || [];
  const policies = location?.policies || [];
  const lat = location?.latitude;
  const lng = location?.longitude;
  const hasMap = lat != null && lng != null;
  const mapUrl = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`
    : null;

  const handleBook = () => {
    onOpenChange(false);
    if (isShowtime) {
      navigate(`/services/showtimes/${event.id}`);
    } else {
      // Legacy event — keep the old flow.
      sessionStorage.setItem('selectedEvent', JSON.stringify(event));
      navigate('/services/events/booking');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-white p-0 max-h-[92vh] overflow-y-auto" data-testid="event-preview-modal">
        <DialogTitle className="sr-only">Event Details</DialogTitle>
        {/* Top photo carousel */}
        <div className="relative h-72 bg-gradient-to-br from-indigo-100 to-pink-100">
          {photos.length > 0 ? (
            <>
              <img src={photos[photoIdx]} alt={event.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"
                    aria-label="Previous photo"
                  ><ChevronLeft className="w-4 h-4" /></button>
                  <button
                    onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"
                    aria-label="Next photo"
                  ><ChevronRight className="w-4 h-4" /></button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`h-2 rounded-full transition-all ${i === photoIdx ? 'bg-white w-8' : 'bg-white/50 w-2'}`}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-16 h-16 text-white/60" /></div>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
            aria-label="Close"
            data-testid="event-preview-close"
          ><X className="w-4 h-4" /></button>
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex items-center gap-2 mb-1">
              {event.type && <Badge className="bg-pink-500 text-white border-0 capitalize">{event.type}</Badge>}
              {isShowtime ? (
                <Badge className="bg-indigo-500 text-white border-0">New venue</Badge>
              ) : (
                <Badge variant="outline" className="bg-white/90 text-slate-700 border-0">Legacy</Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white drop-shadow" data-testid="event-preview-title">{event.name}</h2>
          </div>
        </div>

        {/* Body — left scroll, right sticky CTA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-pink-50/30">
          <div className="lg:col-span-2 p-5 space-y-4">
            {/* Quick facts — single card */}
            <Card className="border-pink-100 shadow-sm" data-testid="event-preview-quickfacts">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-pink-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">Date</p>
                      <p className="text-xs font-bold truncate">{fmtWhen(event.start_datetime || event.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-pink-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">Doors</p>
                      <p className="text-xs font-bold truncate">{event.doors_open_at || event.time || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-pink-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">Venue</p>
                      <p className="text-xs font-bold truncate">{event.venue || event.location_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-pink-600 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">Capacity</p>
                      <p className="text-xs font-bold">{location?.capacity ?? event.total_capacity ?? '—'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About — own card */}
            {(event.description || event.showtime_description) && (
              <Card className="border-pink-100 shadow-sm" data-testid="event-preview-about">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-pink-600" /> About this event
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{event.description || event.showtime_description}</p>
                </CardContent>
              </Card>
            )}

            {/* Operator — own card */}
            {(event.operator_name || event.operator_id) && (
              <Card className="border-pink-100 shadow-sm" data-testid="event-preview-operator">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {event.operator_logo_url ? (
                      <img src={event.operator_logo_url} alt={event.operator_name} className="w-11 h-11 rounded-full object-cover border-2 border-white shadow" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-pink-200 flex items-center justify-center text-pink-700 font-bold text-lg">
                        {(event.operator_name || '?').charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase font-semibold text-pink-600">Organised by</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{event.operator_name}</p>
                    </div>
                    {(event.contact_phone || event.contact_email) && (
                      <div className="flex flex-col items-end gap-1 text-xs text-slate-600">
                        {event.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{event.contact_phone}</span>}
                        {event.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{event.contact_email}</span>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map — own card */}
            {hasMap && (
              <Card className="border-pink-100 shadow-sm overflow-hidden" data-testid="event-preview-map">
                <div className="px-4 pt-4 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-pink-600" /> Location
                  </h3>
                </div>
                <iframe
                  title="Venue map"
                  src={mapUrl}
                  className="w-full h-52 border-0 border-t border-pink-100"
                  loading="lazy"
                />
                <div className="px-4 py-2 text-xs text-slate-500 border-t border-pink-100 bg-pink-50/40">
                  {location?.address && <>{location.address} · </>}
                  {location?.city || event.city}
                  {' · '}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                    target="_blank" rel="noreferrer"
                    className="text-pink-600 hover:underline font-medium"
                  >Open in Maps</a>
                </div>
              </Card>
            )}

            {/* Seating layout — own card */}
            {isShowtime && location && (
              <Card className="border-pink-100 shadow-sm" data-testid="event-preview-seating">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Theater className="w-4 h-4 text-pink-600" /> Seating arrangement
                  </h3>
                  <LayoutPreview location={location} />
                </CardContent>
              </Card>
            )}

            {/* Venue policies — own card */}
            {policies.length > 0 && (
              <Card className="border-pink-100 shadow-sm" data-testid="event-preview-policies-card">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-pink-600" /> Venue policies
                  </h3>
                  <ul className="space-y-1.5" data-testid="event-preview-policies">
                    {policies.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right — sticky ticket panel */}
          <aside className="lg:sticky lg:top-0 lg:self-start p-5 space-y-3" data-testid="event-preview-panel">
            <Card className="border-pink-200 shadow-md">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs uppercase font-semibold text-slate-500">Starting from</p>
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
                    <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" /> {event.rating || 4.5}
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-pink-600">{formatFCFA(event.priceFrom || 0)}</p>

                {isShowtime && classes.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-pink-100">
                    <p className="text-[10px] uppercase font-semibold text-slate-500">Ticket classes</p>
                    {classes.map(c => {
                      const chip = availabilityChip(c);
                      const ChipIcon = chip.icon;
                      return (
                        <div key={c.id} className="flex items-center justify-between bg-pink-50/50 border border-pink-100 rounded-lg p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || '#3b82f6' }} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0 rounded-full border ${chip.color}`}>
                                <ChipIcon className="w-2.5 h-2.5" /> {chip.text}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-pink-700 whitespace-nowrap">{formatFCFA(c.price)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  onClick={handleBook}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white h-11 shadow shadow-pink-500/30"
                  data-testid="event-preview-book-btn"
                >
                  <Ticket className="w-4 h-4 mr-2" /> Proceed to Booking
                </Button>
                <p className="text-[10px] text-center text-slate-500">Pick your class & pay on the next page.</p>
                {loadingLoc && <p className="text-[10px] text-slate-400 text-center">Loading venue details…</p>}
              </CardContent>
            </Card>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
