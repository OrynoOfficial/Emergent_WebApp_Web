import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, ArrowRight, Loader2, Users, CheckCircle2, Undo2,
  Bus, Building2, Car, CalendarDays, Package as PackageIcon, Shirt, Clapperboard,
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const REASONS = [
  { value: 'breakdown', label: 'Breakdown', tone: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'maintenance', label: 'Maintenance', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'upgrade', label: 'Upgrade', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'overbooking', label: 'Overbooking', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'weather', label: 'Weather', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'other', label: 'Other', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const SERVICE_PRESETS = {
  travel: {
    icon: Bus,
    noun: 'Vehicle',
    bookingNoun: 'bus',
    label: (v) => v.plate_number || v.vehicle_name,
    subtitle: (v) => v.vehicle_name || `${v.manufacturer || ''} ${v.model || ''}`.trim(),
    meta: (v) => `${v.total_seats || '—'} seats`,
    candidateFilter: (v, old) => v.operator_id === old.operator_id && v.maintenance_status !== 'retired',
  },
  car_rental: {
    icon: Car,
    noun: 'Car',
    bookingNoun: 'car',
    label: (v) => v.plate_number || v.license_plate || v.model || v.make,
    subtitle: (v) => [v.make, v.model, v.year].filter(Boolean).join(' '),
    meta: (v) => `${v.seats || '—'} seats · ${v.transmission || '—'}`,
    candidateFilter: (v, old) => v.operator_id === old.operator_id && v.is_available !== false,
  },
  hotel: {
    icon: Building2,
    noun: 'Room',
    bookingNoun: 'room',
    label: (v) => v.room_name || v.room_number || v.room_type,
    subtitle: (v) => `${v.room_type || 'Room'} · Floor ${v.floor || 1}`,
    meta: (v) => `${v.capacity || '—'} guests · ${v.beds || '—'} bed(s)`,
    // Rooms must share the same hotel_id to be swappable.
    candidateFilter: (v, old) => v.hotel_id === old.hotel_id && v.status !== 'maintenance',
  },
  event: {
    icon: CalendarDays,
    noun: 'Event',
    bookingNoun: 'event',
    label: (v) => v.name || v.title,
    subtitle: (v) => v.venue_name || v.event_type || 'Event',
    meta: (v) => v.start_date ? String(v.start_date).slice(0, 10) : (v.city || '—'),
    candidateFilter: (v, old) => v.operator_id === old.operator_id,
  },
  package: {
    icon: PackageIcon,
    noun: 'Shipment',
    bookingNoun: 'shipment',
    label: (v) => v.tracking_number || v.name || 'Shipment',
    subtitle: (v) => v.destination_city ? `${v.origin_city || ''} → ${v.destination_city}`.trim() : (v.package_type || 'Package'),
    meta: (v) => `${v.weight_kg || 0} kg · ${v.status || 'pending'}`,
    candidateFilter: (v, old) => v.operator_id === old.operator_id,
  },
  restaurant: {
    icon: Building2,
    noun: 'Restaurant',
    bookingNoun: 'reservation',
    label: (v) => v.name,
    subtitle: (v) => v.city || v.address || 'Restaurant',
    meta: (v) => (v.cuisine_type || []).slice(0, 2).join(', ') || '—',
    candidateFilter: (v, old) => v.operator_id === old.operator_id && v.status !== 'inactive',
  },
  banquet: {
    icon: Building2,
    noun: 'Hall',
    bookingNoun: 'banquet',
    label: (v) => v.name,
    subtitle: (v) => v.city ? `${v.address || ''}${v.address ? ', ' : ''}${v.city}` : (v.venue_type || 'Hall'),
    meta: (v) => `${v.capacity_min || 0}-${v.capacity_max || 0} guests`,
    candidateFilter: (v, old) => v.operator_id === old.operator_id,
  },
  laundry: {
    icon: Shirt,
    noun: 'Pressing Shop',
    bookingNoun: 'pressing shop',
    label: (v) => v.name,
    subtitle: (v) => v.address || v.city || 'Shop',
    meta: (v) => v.city || '—',
    candidateFilter: (v, old) => v.operator_id === old.operator_id,
  },
  cinema: {
    icon: Clapperboard,
    noun: 'Showtime',
    bookingNoun: 'showing',
    label: (v) => v.film_title || v.screen_name,
    subtitle: (v) => `${v.cinema_name || 'Cinema'} · ${v.screen_name || '—'}`,
    meta: (v) => `${v.show_date || ''} ${v.show_time || ''}`.trim() || '—',
    candidateFilter: (v, old) => v.cinema_id === old.cinema_id && v.is_active !== false,
  },
};

export default function ReplaceResourceModal({
  open, onClose, serviceType = 'travel',
  oldResource, allResources, onSuccess,
}) {
  const [step, setStep] = useState('form');
  const [newResourceId, setNewResourceId] = useState('');
  const [reason, setReason] = useState('breakdown');
  const [reasonNote, setReasonNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [undoRemainingSec, setUndoRemainingSec] = useState(0);

  const preset = SERVICE_PRESETS[serviceType] || SERVICE_PRESETS.travel;
  const Icon = preset.icon;

  const candidates = useMemo(() => {
    if (!allResources || !oldResource) return [];
    return allResources.filter(v =>
      v.id !== oldResource.id && preset.candidateFilter(v, oldResource)
    );
  }, [allResources, oldResource, preset]);

  const newResource = useMemo(
    () => candidates.find(v => v.id === newResourceId),
    [candidates, newResourceId]
  );

  // Undo countdown
  useEffect(() => {
    if (step !== 'done' || !result?.event_id) return;
    setUndoRemainingSec(5 * 60);
    const t = setInterval(() => {
      setUndoRemainingSec(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step, result]);

  const reset = () => {
    setStep('form'); setNewResourceId(''); setReason('breakdown');
    setReasonNote(''); setPreview(null); setResult(null); setLoading(false);
    setUndoRemainingSec(0);
  };

  const handleClose = () => { if (loading) return; reset(); onClose?.(); };

  const handleDryRun = async () => {
    if (!newResourceId) { toast.error(`Pick a replacement ${preset.noun.toLowerCase()}`); return; }
    setLoading(true);
    try {
      const res = await api.post('/operator/resources/reassign', {
        service_type: serviceType,
        old_resource_id: oldResource.id,
        new_resource_id: newResourceId,
        reason, reason_note: reasonNote || null, dry_run: true,
      });
      setPreview(res.data); setStep('preview');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Preview failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.post('/operator/resources/reassign', {
        service_type: serviceType,
        old_resource_id: oldResource.id,
        new_resource_id: newResourceId,
        reason, reason_note: reasonNote || null, dry_run: false,
      });
      setResult(res.data); setStep('done');
      toast.success(`${res.data.affected_count} booking(s) updated`);
      onSuccess?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reassignment failed');
    } finally { setLoading(false); }
  };

  const handleUndo = async () => {
    if (!result?.event_id) return;
    setLoading(true);
    try {
      const res = await api.post(`/operator/resources/reassignments/${result.event_id}/revert`);
      toast.success(`Undone. ${res.data.affected_count} booking(s) reverted.`);
      onSuccess?.(res.data);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Undo failed');
    } finally { setLoading(false); }
  };

  if (!oldResource) return null;

  const undoMin = Math.floor(undoRemainingSec / 60);
  const undoSec = undoRemainingSec % 60;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="replace-resource-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#082c59]">
            <Icon className="h-5 w-5" /> Replace {preset.noun}
          </DialogTitle>
          <DialogDescription>
            Swap {preset.label(oldResource)} on all active bookings. Customers and admins will be notified.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 py-2">
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-8 w-8 text-red-500" />
                <div className="flex-1">
                  <p className="text-xs uppercase text-red-600 font-semibold">Being replaced</p>
                  <p className="font-bold text-slate-900">{preset.subtitle(oldResource)}</p>
                  <p className="text-sm text-slate-500 font-mono">{preset.label(oldResource)}</p>
                </div>
                <Badge variant="outline" className="text-xs">{preset.meta(oldResource)}</Badge>
              </CardContent>
            </Card>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Replacement {preset.noun.toLowerCase()}</Label>
              {candidates.length === 0 ? (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  No eligible replacement. Add another {preset.noun.toLowerCase()} first.
                </div>
              ) : (
                <Select value={newResourceId} onValueChange={setNewResourceId}>
                  <SelectTrigger data-testid="replace-resource-select">
                    <SelectValue placeholder={`Pick a replacement ${preset.noun.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {preset.subtitle(v)} · {preset.label(v)} · {preset.meta(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Reason</Label>
              <div className="flex flex-wrap gap-2" data-testid="replace-resource-reasons">
                {REASONS.map(r => (
                  <button key={r.value} type="button" onClick={() => setReason(r.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                      reason === r.value ? `${r.tone} ring-2 ring-offset-1 ring-[#082c59]` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    data-testid={`reason-${r.value}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Note to passengers <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Textarea data-testid="replace-resource-note" value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Context shown to affected customers." rows={3} />
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4 py-2" data-testid="replace-resource-preview">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <div className="flex-1 text-right">
                  <p className="text-xs uppercase text-slate-500">From</p>
                  <p className="font-bold">{preview.from?.vehicle_name || preview.from?.car_name || preview.from?.room_name || preview.from?.name || preview.from?.film_title || '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{preview.from?.plate_number || preview.from?.room_number || preview.from?.model || preview.from?.venue_name || preview.from?.destination || preview.from?.city || preview.from?.show_date || '—'}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#082c59]" />
                <div className="flex-1">
                  <p className="text-xs uppercase text-emerald-600">To</p>
                  <p className="font-bold">{preview.to?.vehicle_name || preview.to?.car_name || preview.to?.room_name || preview.to?.name || preview.to?.film_title || '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{preview.to?.plate_number || preview.to?.room_number || preview.to?.model || preview.to?.venue_name || preview.to?.destination || preview.to?.city || preview.to?.show_date || '—'}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#082c59] text-white">
              <Users className="h-5 w-5" />
              <p className="text-sm">
                <span className="font-bold text-lg" data-testid="affected-count">{preview.affected_count}</span>{' '}
                active booking(s) will be updated.
                {preview.affected_count > 0 && <> Customers, your team, and admins will be notified.</>}
              </p>
            </div>

            {preview.preview_orders?.length > 0 && (
              <div className="border rounded-lg">
                <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50 border-b">
                  Sample of affected bookings
                </div>
                <div className="max-h-56 overflow-y-auto divide-y">
                  {preview.preview_orders.slice(0, 20).map(o => (
                    <div key={o.order_number} className="px-3 py-2 text-sm flex items-center justify-between">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#082c59]">{o.order_number}</p>
                        <p className="text-xs text-slate-500">{o.customer_name || '—'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{o.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.affected_count === 0 && (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                No active bookings reference this {preset.noun.toLowerCase()}. Future bookings will use the new one automatically.
              </div>
            )}
          </div>
        )}

        {step === 'done' && result && (
          <div className="py-4 text-center space-y-3" data-testid="replace-resource-done">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Reassignment complete</h3>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{result.affected_count}</span> booking(s) updated.
              Notifications sent to{' '}
              <span className="font-semibold">{result.notifications_sent?.customers || 0}</span> customer(s),{' '}
              <span className="font-semibold">{result.notifications_sent?.operator_users || 0}</span> team member(s),{' '}
              <span className="font-semibold">{result.notifications_sent?.admins || 0}</span> admin(s).
            </p>
            {undoRemainingSec > 0 ? (
              <div className="mt-3 p-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50">
                <p className="text-xs text-amber-800 mb-2">
                  Made a mistake? You can undo this for {String(undoMin).padStart(2, '0')}:{String(undoSec).padStart(2, '0')} more.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={loading}
                  className="border-amber-400 text-amber-800 hover:bg-amber-100"
                  data-testid="replace-undo-btn"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                  Undo this reassignment
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Undo window expired.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading} data-testid="replace-cancel-btn">Cancel</Button>
              <Button onClick={handleDryRun} disabled={loading || !newResourceId}
                className="bg-[#082c59] hover:bg-[#0a3a73]" data-testid="replace-preview-btn">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Preview impact
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')} disabled={loading} data-testid="replace-back-btn">Back</Button>
              <Button onClick={handleConfirm} disabled={loading}
                className="bg-[#082c59] hover:bg-[#0a3a73]" data-testid="replace-confirm-btn">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm &amp; notify {preview?.affected_count || 0} booking(s)
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose} className="bg-[#082c59] hover:bg-[#0a3a73]" data-testid="replace-close-btn">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
