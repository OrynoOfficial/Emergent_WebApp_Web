import React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Film, MapPin, Monitor, Clock, Star, Edit } from 'lucide-react';

/**
 * Read-only details modal for a Cinema or a Film. Pure presentational —
 * parent decides what to display via `viewingItem` and `viewingType`.
 */
export default function CinemaViewDialog({
  open,
  onOpenChange,
  viewingItem,
  viewingType,
  onEdit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-[#082c59]">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
