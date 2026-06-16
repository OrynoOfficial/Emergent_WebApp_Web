// Event Locations + Showtimes management — compact CRUD that pairs with the
// new backend `/api/event-locations` and `/api/event-showtimes` endpoints.
// Renders inside EventsManagement.jsx as two tabs.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import PermissionGate from '@/components/common/PermissionGate';
import {
  Plus, Edit, Trash2, MapPin, Ticket, Loader2, Sparkles, Users, Clock,
  Building2, Theater, Tent, Mic, ImageIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';

const LAYOUT_OPTIONS = [
  { value: 'simple',      label: 'Simple — single capacity', icon: Building2 },
  { value: 'visual_grid', label: 'Visual grid (rows × cols)', icon: Theater },
  { value: 'zones',       label: 'Named zones with capacities', icon: Mic },
];
const SIMPLE_KINDS = ['theater_rows', 'banquet_round', 'open_air', 'standing', 'mixed'];

const DEFAULT_LOC = {
  name: '', description: '', city: '', address: '', latitude: '', longitude: '',
  layout_type: 'simple', capacity: 100, simple_kind: 'theater_rows',
  grid_rows: 10, grid_cols: 12, grid_aisle_after: 6,
  zones: [{ id: '', name: 'General', capacity: 100 }],
  policies: [], images: [], operator_id: '', operator_name: '',
};

const DEFAULT_CLASS = { name: '', price: 5000, total_units: 100, color: '#3b82f6', perks: [] };

// ── Swipable image strip ─────────────────────────────────────────────────────
function SwipableImages({ images = [], height = 'h-40' }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) {
    return <div className={`${height} bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center`}>
      <ImageIcon className="w-10 h-10 text-indigo-300" />
    </div>;
  }
  return (
    <div className={`${height} relative bg-slate-100 overflow-hidden`}>
      <img src={images[idx]} alt="" className="w-full h-full object-cover transition-opacity" />
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Location Editor ──────────────────────────────────────────────────────────
function LocationEditor({ open, onOpenChange, editing, operators, onSaved }) {
  const [form, setForm] = useState(DEFAULT_LOC);
  useEffect(() => {
    setForm(editing ? { ...DEFAULT_LOC, ...editing } : DEFAULT_LOC);
  }, [editing, open]);

  const updateZone = (idx, patch) => setForm(p => ({
    ...p, zones: p.zones.map((z, i) => i === idx ? { ...z, ...patch } : z),
  }));

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Location name is required'); return; }
    if (!form.city?.trim()) { toast.error('City is required'); return; }
    if (!form.operator_id && !editing) { toast.error('Pick an operator'); return; }
    try {
      const op = operators.find(o => (o._id || o.id) === form.operator_id);
      const payload = {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        capacity: Number(form.capacity) || 0,
        grid_rows: form.grid_rows ? Number(form.grid_rows) : null,
        grid_cols: form.grid_cols ? Number(form.grid_cols) : null,
        grid_aisle_after: form.grid_aisle_after ? Number(form.grid_aisle_after) : null,
        zones: form.layout_type === 'zones'
          ? (form.zones || []).map(z => ({ ...z, capacity: Number(z.capacity) || 0 }))
          : [],
        operator_name: op?.name || form.operator_name || '',
      };
      if (editing) {
        await api.put(`/event-locations/${editing.id}`, payload);
        toast.success('Location updated');
      } else {
        await api.post('/event-locations/', payload);
        toast.success('Location created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save location');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[92vh] overflow-y-auto" data-testid="location-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <Building2 className="w-5 h-5" />
            {editing ? 'Edit Location' : 'Create Location'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase text-slate-500 font-semibold">Photos (swipable on the customer side)</Label>
            <MiniImageUploader
              images={form.images}
              onChange={(imgs) => setForm(p => ({ ...p, images: imgs }))}
              max={6} folder="event-locations" accent="indigo"
              helperText="Up to 6 photos. First is the cover."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Location Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Palais des Sports — Main Hall" data-testid="location-name-input" />
            </div>
            <div className="col-span-2">
              <Label>Description (optional)</Label>
              <Textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Premium concert venue with state-of-the-art acoustics…" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" data-testid="location-city-input" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Akwa Boulevard" />
            </div>
            <div>
              <Label>Latitude</Label>
              <Input type="number" step="0.000001" value={form.latitude || ''} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="4.0511" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" step="0.000001" value={form.longitude || ''} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="9.7679" />
            </div>
            {!editing && (
              <div className="col-span-2">
                <OperatorSelector
                  value={form.operator_id}
                  onChange={(id, name) => setForm(p => ({ ...p, operator_id: id, operator_name: name }))}
                  operators={operators}
                  testId="location-operator-selector"
                />
              </div>
            )}
          </div>

          {/* Seating plan */}
          <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
              <Theater className="w-4 h-4" /> Seating Plan
            </div>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUT_OPTIONS.map(opt => {
                const Ico = opt.icon;
                const active = form.layout_type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, layout_type: opt.value }))}
                    className={`p-2.5 rounded-lg border-2 text-left transition-colors ${
                      active ? 'bg-white border-indigo-500 shadow-sm' : 'bg-white/60 border-transparent hover:border-indigo-200'
                    }`}
                    data-testid={`layout-option-${opt.value}`}
                  >
                    <Ico className={`w-4 h-4 mb-1 ${active ? 'text-indigo-700' : 'text-slate-500'}`} />
                    <p className={`text-[11px] font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide">Total Capacity</Label>
                <Input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} data-testid="location-capacity-input" />
              </div>
              {form.layout_type === 'simple' && (
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide">Layout Kind</Label>
                  <Select value={form.simple_kind} onValueChange={v => setForm(p => ({ ...p, simple_kind: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIMPLE_KINDS.map(k => <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.layout_type === 'visual_grid' && (
                <>
                  <div><Label className="text-[10px] uppercase">Rows</Label><Input type="number" value={form.grid_rows} onChange={e => setForm(p => ({ ...p, grid_rows: e.target.value }))} /></div>
                  <div><Label className="text-[10px] uppercase">Cols</Label><Input type="number" value={form.grid_cols} onChange={e => setForm(p => ({ ...p, grid_cols: e.target.value }))} /></div>
                  <div><Label className="text-[10px] uppercase">Aisle after col</Label><Input type="number" value={form.grid_aisle_after} onChange={e => setForm(p => ({ ...p, grid_aisle_after: e.target.value }))} /></div>
                </>
              )}
            </div>
            {form.layout_type === 'zones' && (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">Zones</Label>
                {(form.zones || []).map((z, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input className="flex-1" value={z.name} onChange={e => updateZone(idx, { name: e.target.value })} placeholder="Zone name (Front Row, VIP Tables…)" />
                    <Input className="w-28" type="number" value={z.capacity} onChange={e => updateZone(idx, { capacity: e.target.value })} placeholder="Cap" />
                    <button type="button" onClick={() => setForm(p => ({ ...p, zones: p.zones.filter((_, i) => i !== idx) }))} className="text-rose-500 hover:bg-rose-50 rounded p-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setForm(p => ({ ...p, zones: [...p.zones, { name: '', capacity: 0 }] }))} className="text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" /> Add zone
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Policies (one per line)</Label>
            <Textarea rows={3} value={(form.policies || []).join('\n')}
              onChange={e => setForm(p => ({ ...p, policies: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
              placeholder={'No outside drinks\nPhoto ID required\nDoors open 30 min before start'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="save-location-btn">
            {editing ? 'Update' : 'Create Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Showtime Editor (uses a Location + defines classes) ─────────────────────
function ShowtimeEditor({ open, onOpenChange, editing, locations, onSaved }) {
  const [form, setForm] = useState({
    location_id: '', title: '', description: '', event_type: 'concert',
    start_datetime: '', end_datetime: '', images: [],
    classes: [{ ...DEFAULT_CLASS, name: 'Standard' }],
  });
  useEffect(() => {
    if (editing) {
      setForm({
        ...editing,
        classes: editing.classes?.length ? editing.classes : [{ ...DEFAULT_CLASS, name: 'Standard' }],
      });
    } else {
      setForm({
        location_id: '', title: '', description: '', event_type: 'concert',
        start_datetime: '', end_datetime: '', images: [],
        classes: [{ ...DEFAULT_CLASS, name: 'Standard' }],
      });
    }
  }, [editing, open]);

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
          <div>
            <Label className="text-xs uppercase text-slate-500 font-semibold">Event Posters</Label>
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
              <Textarea rows={2} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's special about this event?" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['concert', 'conference', 'workshop', 'festival', 'sports', 'exhibition', 'party', 'other'].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Doors Open (optional)</Label>
              <Input value={form.doors_open_at || ''} onChange={e => setForm(p => ({ ...p, doors_open_at: e.target.value }))} placeholder="19:30" />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={form.start_datetime} onChange={e => setForm(p => ({ ...p, start_datetime: e.target.value }))} data-testid="showtime-start-input" />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={form.end_datetime} onChange={e => setForm(p => ({ ...p, end_datetime: e.target.value }))} data-testid="showtime-end-input" />
            </div>
          </div>

          {/* Ticket classes */}
          <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <Ticket className="w-4 h-4" /> Ticket Classes
              </div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setForm(p => ({ ...p, classes: [...p.classes, { ...DEFAULT_CLASS, name: '' }] }))}>
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
                  <Input type="color" value={c.color || '#3b82f6'} onChange={e => updateClass(idx, { color: e.target.value })} className="h-9 p-1" />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button type="button" onClick={() => setForm(p => ({ ...p, classes: p.classes.filter((_, i) => i !== idx) }))}
                    className="text-rose-500 hover:bg-rose-50 rounded p-1.5" disabled={form.classes.length <= 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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

// ── Locations sub-tab ────────────────────────────────────────────────────────
export function LocationsSubTab({ operators, scopeOperatorId, onReload }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? { operator_id: scopeOperatorId } : {};
      const r = await api.get('/event-locations/', { params });
      setItems(r.data.locations || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (loc) => {
    if (!confirm(`Deactivate "${loc.name}"?`)) return;
    try {
      await api.delete(`/event-locations/${loc.id}`);
      toast.success('Location deactivated');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-indigo-700" />
            <h2 className="text-sm font-semibold text-indigo-800">Locations</h2>
            <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700 px-1.5 py-0">{items.length}</Badge>
            <span className="hidden md:inline text-xs text-slate-500 ml-2">Halls, open-air venues, theatres — the where of every event.</span>
          </div>
          <PermissionGate permission="events.create">
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8" size="sm" data-testid="add-location-btn">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Location
            </Button>
          </PermissionGate>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-14 w-14 mx-auto text-indigo-200 mb-3" />
          <p className="text-slate-600 font-medium">No locations yet.</p>
          <p className="text-sm text-slate-500">Add the venues where your events take place.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(loc => (
            <Card key={loc.id} className="overflow-hidden hover:shadow-lg transition-shadow border-indigo-100" data-testid={`location-card-${loc.id}`}>
              <SwipableImages images={loc.images} />
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{loc.name}</h3>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {loc.city}{loc.address ? ` · ${loc.address}` : ''}</p>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-700 border-0 capitalize text-[10px]">{loc.layout_type?.replace('_', ' ')}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-50">
                  <div className="bg-indigo-50 rounded p-1.5 text-center">
                    <div className="text-[9px] text-indigo-700 font-semibold uppercase">Capacity</div>
                    <div className="text-base font-bold text-indigo-800">{loc.capacity}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-1.5 text-center">
                    <div className="text-[9px] text-slate-600 font-semibold uppercase">Zones</div>
                    <div className="text-base font-bold text-slate-800">{(loc.zones || []).length || '—'}</div>
                  </div>
                  <div className="bg-emerald-50 rounded p-1.5 text-center">
                    <div className="text-[9px] text-emerald-700 font-semibold uppercase">Policies</div>
                    <div className="text-base font-bold text-emerald-800">{(loc.policies || []).length}</div>
                  </div>
                </div>
                <div className="flex gap-1 pt-1">
                  <PermissionGate permission="events.edit">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(loc); setOpen(true); }} data-testid={`edit-location-btn-${loc.id}`}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </PermissionGate>
                  <PermissionGate permission="events.delete">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(loc)} data-testid={`delete-location-btn-${loc.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </PermissionGate>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LocationEditor
        open={open} onOpenChange={setOpen}
        editing={editing} operators={operators}
        onSaved={() => { load(); onReload?.(); }}
      />
    </div>
  );
}

// ── Showtimes sub-tab ────────────────────────────────────────────────────────
export function ShowtimesSubTab({ scopeOperatorId, onReload }) {
  const [showtimes, setShowtimes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? { operator_id: scopeOperatorId } : {};
      const [sRes, lRes] = await Promise.all([
        api.get('/event-showtimes/', { params }),
        api.get('/event-locations/', { params: { ...params, is_active: true } }),
      ]);
      setShowtimes(sRes.data.showtimes || []);
      setLocations(lRes.data.locations || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (s) => {
    if (!confirm(`Cancel "${s.title}"?`)) return;
    try {
      await api.delete(`/event-showtimes/${s.id}`);
      toast.success('Showtime cancelled');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Ticket className="h-4 w-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-800">Showtimes</h2>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 px-1.5 py-0">{showtimes.length}</Badge>
            <span className="hidden md:inline text-xs text-slate-500 ml-2">A scheduled event at a Location with its own ticket classes.</span>
          </div>
          {locations.length > 0 && (
            <PermissionGate permission="events.create">
              <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white h-8" size="sm" data-testid="add-showtime-btn">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Showtime
              </Button>
            </PermissionGate>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
      ) : locations.length === 0 ? (
        <Card className="p-12 text-center bg-amber-50/40 border-amber-200">
          <Building2 className="h-14 w-14 mx-auto text-amber-300 mb-3" />
          <p className="text-amber-900 font-semibold">Create a Location first</p>
          <p className="text-sm text-amber-700/80 mt-1">A Showtime needs a Location to run at. Add a venue on the Locations tab to unlock this section.</p>
        </Card>
      ) : showtimes.length === 0 ? (
        <Card className="p-12 text-center">
          <Ticket className="h-14 w-14 mx-auto text-amber-200 mb-3" />
          <p className="text-slate-600 font-medium">No showtimes scheduled yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showtimes.map(s => {
            const totalCap = (s.classes || []).reduce((sum, c) => sum + (c.total_units || 0), 0);
            const totalAvail = (s.classes || []).reduce((sum, c) => sum + (c.available_units || 0), 0);
            const sold = totalCap - totalAvail;
            return (
              <Card key={s.id} className="overflow-hidden hover:shadow-lg transition-shadow border-amber-100" data-testid={`showtime-card-${s.id}`}>
                <SwipableImages images={s.images} height="h-32" />
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm truncate">{s.title}</h3>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location_name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {s.start_datetime?.slice(0, 16).replace('T', ' ')}</p>
                    </div>
                    <Badge className={
                      s.status === 'sold_out' ? 'bg-rose-100 text-rose-700 border-0 text-[10px]' :
                      s.status === 'published' ? 'bg-emerald-100 text-emerald-700 border-0 text-[10px]' :
                      s.status === 'cancelled' ? 'bg-slate-200 text-slate-600 border-0 text-[10px]' :
                      'bg-amber-100 text-amber-700 border-0 text-[10px]'
                    }>{s.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(s.classes || []).map((c) => (
                      <Badge key={c.id} className="text-[10px] border" style={{ borderColor: c.color, color: c.color, background: `${c.color}10` }}>
                        {c.name} · {formatFCFA(c.price)} · {c.available_units}/{c.total_units}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-50">
                    <div className="bg-amber-50 rounded p-1.5 text-center">
                      <div className="text-[9px] text-amber-700 font-semibold uppercase">Classes</div>
                      <div className="text-base font-bold text-amber-800">{(s.classes || []).length}</div>
                    </div>
                    <div className="bg-emerald-50 rounded p-1.5 text-center">
                      <div className="text-[9px] text-emerald-700 font-semibold uppercase">Sold</div>
                      <div className="text-base font-bold text-emerald-800">{sold}</div>
                    </div>
                    <div className="bg-blue-50 rounded p-1.5 text-center">
                      <div className="text-[9px] text-blue-700 font-semibold uppercase">Available</div>
                      <div className="text-base font-bold text-blue-800">{totalAvail}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <PermissionGate permission="events.edit">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(s); setOpen(true); }} data-testid={`edit-showtime-btn-${s.id}`}>
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="events.delete">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(s)} data-testid={`cancel-showtime-btn-${s.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </PermissionGate>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ShowtimeEditor
        open={open} onOpenChange={setOpen}
        editing={editing} locations={locations}
        onSaved={() => { load(); onReload?.(); }}
      />
    </div>
  );
}
