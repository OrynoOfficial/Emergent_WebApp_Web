// Showtime editor modal — extracted from LocationsAndShowtimesTabs.jsx.
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import { Ticket, Plus, Trash2, ImagePlus, Loader2, X } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';

const DEFAULT_CLASS = { name: '', price: 5000, total_units: 100, color: '#3b82f6', perks: [] };
const EVENT_TYPES = ['concert', 'conference', 'workshop', 'festival', 'sports', 'exhibition', 'party', 'other'];

export default function ShowtimeEditor({ open, onOpenChange, editing, locations, onSaved }) {
  const [form, setForm] = useState({
    location_id: '', title: '', description: '', event_type: 'concert',
    start_datetime: '', end_datetime: '', poster_url: '', images: [],
    status: 'published',
    classes: [{ ...DEFAULT_CLASS, name: 'Standard' }],
    refund_policy: null,
  });
  const [posterUploading, setPosterUploading] = useState(false);
  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        poster_url: editing.poster_url || '',
        status: editing.status || 'published',
        classes: editing.classes?.length ? editing.classes : [{ ...DEFAULT_CLASS, name: 'Standard' }],
        refund_policy: editing.refund_policy || null,
      });
    } else {
      setForm({
        location_id: '', title: '', description: '', event_type: 'concert',
        start_datetime: '', end_datetime: '', poster_url: '', images: [],
        status: 'published',
        classes: [{ ...DEFAULT_CLASS, name: 'Standard' }],
        refund_policy: null,
      });
    }
  }, [editing, open]);

  const uploadPoster = async (file) => {
    if (!file) return;
    const fd = new FormData();
    // Backend `/api/uploads/` (single) expects field name 'file' — using
    // 'files' silently 422s and was causing the editor to white-screen.
    fd.append('file', file);
    fd.append('folder', 'event-showtimes');
    setPosterUploading(true);
    try {
      const res = await api.post('/uploads/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data?.file_url || res.data?.urls?.[0] || res.data?.files?.[0]?.url;
      if (url) setForm((p) => ({ ...p, poster_url: url }));
      else toast.error('Upload succeeded but no URL was returned');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Poster upload failed');
    } finally {
      setPosterUploading(false);
    }
  };

  const updateClass = (idx, patch) => setForm(p => ({
    ...p, classes: p.classes.map((c, i) => i === idx ? { ...c, ...patch } : c),
  }));

  const save = async () => {
    if (!form.location_id) { toast.error('Pick a location'); return; }
    if (!form.title?.trim()) { toast.error('Event title is required'); return; }
    if (!form.start_datetime || !form.end_datetime) { toast.error('Start and end times are required'); return; }
    if (!form.classes?.length || form.classes.some(c => !c.name?.trim())) { toast.error('Each ticket class needs a name'); return; }
    try {
      const payload = {
        ...form,
        classes: form.classes.map(c => ({
          ...c, price: Number(c.price) || 0, total_units: Number(c.total_units) || 0,
        })),
      };
      if (editing) {
        await api.put(`/event-showtimes/${editing.id}`, payload);
        toast.success('Showtime updated');
      } else {
        await api.post('/event-showtimes/', payload);
        toast.success('Showtime created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save showtime');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[92vh] overflow-y-auto" data-testid="showtime-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Ticket className="w-5 h-5" />
            {editing ? 'Edit Showtime' : 'Create Showtime'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Event Poster — single hero image used on the customer booking page */}
          <div>
            <Label className="text-xs uppercase text-slate-500 font-semibold flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" /> Event Poster
              <span className="text-[10px] font-normal normal-case text-slate-400 ml-1">— the hero image customers see when booking</span>
            </Label>
            <div className="mt-1.5">
              {form.poster_url ? (
                <div className="relative h-40 w-full rounded-xl overflow-hidden border-2 border-pink-200 bg-slate-100 group">
                  <img src={form.poster_url} alt="Event poster" className="absolute inset-0 w-full h-full object-cover" data-testid="poster-preview" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <label className="text-xs text-white bg-pink-600 hover:bg-pink-700 px-3 py-1.5 rounded-lg cursor-pointer font-semibold inline-flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" /> Replace
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPoster(e.target.files?.[0])} data-testid="poster-replace-input" />
                    </label>
                    <Button
                      type="button" size="sm" variant="destructive"
                      onClick={() => setForm((p) => ({ ...p, poster_url: '' }))}
                      data-testid="poster-clear-btn"
                      className="h-7 px-2.5"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 w-full rounded-xl border-2 border-dashed border-pink-300 bg-pink-50/50 hover:bg-pink-50 cursor-pointer transition-colors" data-testid="poster-upload-dropzone">
                  {posterUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 text-pink-600 animate-spin mb-1.5" />
                      <span className="text-xs text-pink-700 font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-6 h-6 text-pink-500 mb-1.5" />
                      <span className="text-sm text-pink-700 font-semibold">Click to upload event poster</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">JPG / PNG · up to 5 MB · recommended 1200×675</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPoster(e.target.files?.[0])} data-testid="poster-upload-input" />
                </label>
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase text-slate-500 font-semibold">Additional Gallery</Label>
            <MiniImageUploader images={form.images} onChange={imgs => setForm(p => ({ ...p, images: imgs }))} max={4} folder="event-showtimes" accent="amber" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Location</Label>
              <Select value={form.location_id} onValueChange={v => setForm(p => ({ ...p, location_id: v }))}>
                <SelectTrigger data-testid="showtime-location-select"><SelectValue placeholder="Pick a venue…" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} — {l.city} ({l.capacity} cap)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Event Title</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Wakanda Night — Live Concert" data-testid="showtime-title-input" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's special about this event?" data-testid="showtime-description-input" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v }))}>
                <SelectTrigger data-testid="showtime-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Doors Open (optional)</Label>
              <Input value={form.doors_open_at || ''} onChange={e => setForm(p => ({ ...p, doors_open_at: e.target.value }))} placeholder="19:30" data-testid="showtime-doors-input" />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={form.start_datetime} onChange={e => setForm(p => ({ ...p, start_datetime: e.target.value }))} data-testid="showtime-start-input" />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={form.end_datetime} onChange={e => setForm(p => ({ ...p, end_datetime: e.target.value }))} data-testid="showtime-end-input" />
            </div>
            <div className="col-span-2">
              <Label className="flex items-center gap-2">
                Visibility
                <span className="text-[10px] font-normal text-slate-400 normal-case">— Draft is hidden from customers until you publish</span>
              </Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="showtime-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published" data-testid="status-option-published">🟢 Active — visible to customers</SelectItem>
                  <SelectItem value="draft" data-testid="status-option-draft">⚪ Draft — saved but hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <Ticket className="w-4 h-4" /> Ticket Classes
              </div>
              <Button
                type="button" size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setForm(p => ({ ...p, classes: [...p.classes, { ...DEFAULT_CLASS, name: '' }] }))}
                data-testid="showtime-class-add-btn"
              >
                <Plus className="w-3 h-3 mr-1" /> Add class
              </Button>
            </div>
            {form.classes.map((c, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white rounded-lg p-2 border border-amber-100">
                <div className="col-span-3">
                  <Label className="text-[10px] uppercase tracking-wide">Name</Label>
                  <Input value={c.name} onChange={e => updateClass(idx, { name: e.target.value })} placeholder="VIP / Standard / Backstage…" data-testid={`class-name-${idx}`} />
                </div>
                <div className="col-span-3">
                  <Label className="text-[10px] uppercase tracking-wide">Price (FCFA)</Label>
                  <Input type="number" value={c.price} onChange={e => updateClass(idx, { price: e.target.value })} data-testid={`class-price-${idx}`} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide">Seats</Label>
                  <Input type="number" value={c.total_units} onChange={e => updateClass(idx, { total_units: e.target.value })} data-testid={`class-total-${idx}`} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide">Color</Label>
                  <Input type="color" value={c.color || '#3b82f6'} onChange={e => updateClass(idx, { color: e.target.value })} className="h-9 p-1" data-testid={`class-color-${idx}`} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, classes: p.classes.filter((_, i) => i !== idx) }))}
                    className="text-rose-500 hover:bg-rose-50 rounded p-1.5"
                    disabled={form.classes.length <= 1}
                    data-testid={`class-remove-${idx}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Listing-level refund policy override */}
          <div className="rounded-xl border-2 border-slate-100 bg-slate-50/50 p-3 space-y-2" data-testid="event-showtime-refund-policy">
            <Label className="text-xs uppercase text-slate-500 font-semibold">
              Refund Policy <span className="text-[10px] font-normal normal-case text-slate-400 ml-1">— overrides operator default for this event</span>
            </Label>
            <CancellationPolicyPicker
              serviceType="event"
              scope="listing"
              value={form.refund_policy}
              onChange={(v) => setForm(p => ({ ...p, refund_policy: v }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="save-showtime-btn">
            {editing ? 'Update' : 'Create Showtime'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
