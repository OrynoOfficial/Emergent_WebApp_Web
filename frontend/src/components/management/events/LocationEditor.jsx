// Location editor modal — extracted from LocationsAndShowtimesTabs.jsx.
// Adds data-testids to all input fields (address, description, lat/lng, zones).
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import { Building2, Theater, Mic, Plus, Trash2 } from 'lucide-react';
import api from '@/api/client';
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

export default function LocationEditor({ open, onOpenChange, editing, operators, onSaved }) {
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
              <Textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Premium concert venue with state-of-the-art acoustics…" data-testid="location-description-input" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Douala" data-testid="location-city-input" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Akwa Boulevard" data-testid="location-address-input" />
            </div>
            <div>
              <Label>Latitude</Label>
              <Input type="number" step="0.000001" value={form.latitude || ''} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="4.0511" data-testid="location-lat-input" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" step="0.000001" value={form.longitude || ''} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="9.7679" data-testid="location-lng-input" />
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
                    <SelectTrigger data-testid="location-simple-kind-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{SIMPLE_KINDS.map(k => <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {form.layout_type === 'visual_grid' && (
                <>
                  <div><Label className="text-[10px] uppercase">Rows</Label><Input type="number" value={form.grid_rows} onChange={e => setForm(p => ({ ...p, grid_rows: e.target.value }))} data-testid="location-grid-rows-input" /></div>
                  <div><Label className="text-[10px] uppercase">Cols</Label><Input type="number" value={form.grid_cols} onChange={e => setForm(p => ({ ...p, grid_cols: e.target.value }))} data-testid="location-grid-cols-input" /></div>
                  <div><Label className="text-[10px] uppercase">Aisle after col</Label><Input type="number" value={form.grid_aisle_after} onChange={e => setForm(p => ({ ...p, grid_aisle_after: e.target.value }))} data-testid="location-grid-aisle-input" /></div>
                </>
              )}
            </div>
            {form.layout_type === 'zones' && (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide">Zones</Label>
                {(form.zones || []).map((z, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={z.name}
                      onChange={e => updateZone(idx, { name: e.target.value })}
                      placeholder="Zone name (Front Row, VIP Tables…)"
                      data-testid={`location-zone-name-${idx}`}
                    />
                    <Input
                      className="w-28"
                      type="number"
                      value={z.capacity}
                      onChange={e => updateZone(idx, { capacity: e.target.value })}
                      placeholder="Cap"
                      data-testid={`location-zone-capacity-${idx}`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, zones: p.zones.filter((_, i) => i !== idx) }))}
                      className="text-rose-500 hover:bg-rose-50 rounded p-1.5"
                      data-testid={`location-zone-remove-${idx}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm(p => ({ ...p, zones: [...p.zones, { name: '', capacity: 0 }] }))}
                  className="text-xs h-7"
                  data-testid="location-zone-add-btn"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add zone
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Policies (one per line)</Label>
            <Textarea
              rows={3}
              value={(form.policies || []).join('\n')}
              onChange={e => setForm(p => ({ ...p, policies: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
              placeholder={'No outside drinks\nPhoto ID required\nDoors open 30 min before start'}
              data-testid="location-policies-input"
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
