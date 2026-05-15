import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, Monitor, Clock, Banknote } from 'lucide-react';
import { WEEKDAY_OPTIONS, computeRecurringDates } from '@/components/cinema/cinemaConstants';

/**
 * Modal for creating or editing a Showtime. The form is fully driven by props
 * to keep the parent CinemaManagement page authoritative on state.
 */
export default function ShowtimeFormDialog({
  open,
  onOpenChange,
  editingShowtime,
  showtimeForm,
  setShowtimeForm,
  cinemas,
  movies,
  onSubmit,
}) {
  // Detect VIP-eligible screen so we can conditionally render the VIP price field.
  const selectedCinema = cinemas.find((c) => c.id === showtimeForm.cinema_id);
  const selectedScreen = (selectedCinema?.screens || []).find((s) => s.name === showtimeForm.screen_name);
  const vipRows = selectedScreen?.seat_layout?.vip_rows || [];
  const hasVip = vipRows.length > 0;

  const availableScreens = selectedCinema?.screens || [];
  const recurringPreview = computeRecurringDates(
    showtimeForm.show_date,
    showtimeForm.repeat_end_date,
    showtimeForm.repeat_days,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {!showtimeForm.cinema_id ? (
              <p className="text-xs text-slate-500 italic">Pick a cinema first to see available screens.</p>
            ) : availableScreens.length === 0 ? (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                This cinema has no screens configured yet. Open the cinema in the Cinemas tab → Edit → Screens & seat layout to add one.
              </div>
            ) : (
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
            )}
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
                {recurringPreview.length > 0 && (
                  <p className="text-[11px] text-slate-600">
                    This will create <span className="font-semibold text-[#082c59]">{recurringPreview.length}</span> showtime{recurringPreview.length === 1 ? '' : 's'}
                    {recurringPreview.length > 60 ? ' — too many, please narrow the range.' : '.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section: PRICE */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5"><Banknote className="h-3 w-3" /> 4 · Pricing</p>
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
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} className="bg-[#082c59]" data-testid="save-showtime-btn">{editingShowtime ? 'Update showtime' : 'Schedule showtime'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
