// Locations + Showtimes sub-tabs for EventsManagement. The heavy editors
// live in their own files now (LocationEditor.jsx / ShowtimeEditor.jsx).
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PermissionGate from '@/components/common/PermissionGate';
import {
  Plus, Edit, Trash2, MapPin, Ticket, Loader2,
  Building2, Clock,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';
import SwipableImages from './SwipableImages';
import LocationEditor from './LocationEditor';
import ShowtimeEditor from './ShowtimeEditor';

// ── Locations sub-tab ────────────────────────────────────────────────────────
export function LocationsSubTab({ operators, scopeOperatorId, onReload }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Default to active-only — soft-deleted locations should disappear from
      // the management grid immediately after a Deactivate action.
      const params = { is_active: true, ...(scopeOperatorId ? { operator_id: scopeOperatorId } : {}) };
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
      // Hide cancelled showtimes from the management grid — they're "deleted"
      // from the operator's perspective. Backend keeps the row so historical
      // orders can still resolve `service_id`.
      const showtimes = (sRes.data.showtimes || []).filter(s => s.status !== 'cancelled');
      setShowtimes(showtimes);
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
