import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Film, ChevronUp, ChevronDown } from 'lucide-react';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import api from '@/api/client';
import { toast } from 'sonner';
import { FILM_GENRE_OPTIONS, MOVIE_STATUSES } from '@/components/cinema/cinemaConstants';

/**
 * Dialog used to create or edit a Film. Pure presentational — all state lives
 * in the parent CinemaManagement page.
 */
export default function MovieFormDialog({
  open,
  onOpenChange,
  editingMovie,
  movieForm,
  setMovieForm,
  genreFieldExpanded,
  setGenreFieldExpanded,
  operators,
  onSubmit,
}) {
  return (
    <ServiceFormShell
      open={open}
      onOpenChange={onOpenChange}
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
      onSubmit={onSubmit}
      submitDataTestId="save-movie-btn"
    />
  );
}
