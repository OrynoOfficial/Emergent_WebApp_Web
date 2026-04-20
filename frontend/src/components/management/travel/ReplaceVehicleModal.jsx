import React, { useState, useMemo } from 'react';
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
import { Bus, AlertTriangle, ArrowRight, Loader2, Users, CheckCircle2 } from 'lucide-react';
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

export default function ReplaceVehicleModal({ open, onClose, oldVehicle, allVehicles, onSuccess }) {
  const [step, setStep] = useState('form'); // 'form' | 'preview' | 'done'
  const [newVehicleId, setNewVehicleId] = useState('');
  const [reason, setReason] = useState('breakdown');
  const [reasonNote, setReasonNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const candidates = useMemo(() => {
    if (!allVehicles || !oldVehicle) return [];
    return allVehicles.filter(v =>
      v.id !== oldVehicle.id &&
      v.operator_id === oldVehicle.operator_id &&
      v.maintenance_status !== 'retired'
    );
  }, [allVehicles, oldVehicle]);

  const newVehicle = useMemo(
    () => candidates.find(v => v.id === newVehicleId),
    [candidates, newVehicleId]
  );

  const reset = () => {
    setStep('form');
    setNewVehicleId('');
    setReason('breakdown');
    setReasonNote('');
    setPreview(null);
    setResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  const handleDryRun = async () => {
    if (!newVehicleId) {
      toast.error('Pick a replacement vehicle');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/operator/resources/reassign', {
        service_type: 'travel',
        old_resource_id: oldVehicle.id,
        new_resource_id: newVehicleId,
        reason,
        reason_note: reasonNote || null,
        dry_run: true,
      });
      setPreview(res.data);
      setStep('preview');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.post('/operator/resources/reassign', {
        service_type: 'travel',
        old_resource_id: oldVehicle.id,
        new_resource_id: newVehicleId,
        reason,
        reason_note: reasonNote || null,
        dry_run: false,
      });
      setResult(res.data);
      setStep('done');
      toast.success(`${res.data.affected_count} booking(s) updated`);
      onSuccess?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reassignment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!oldVehicle) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="replace-vehicle-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#082c59]">
            <Bus className="h-5 w-5" />
            Replace Vehicle
          </DialogTitle>
          <DialogDescription>
            Swap {oldVehicle.vehicle_name} ({oldVehicle.plate_number}) on all active bookings. Customers and admins will be notified.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 py-2">
            {/* Old vehicle card */}
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Bus className="h-8 w-8 text-red-500" />
                <div className="flex-1">
                  <p className="text-xs uppercase text-red-600 font-semibold">Being replaced</p>
                  <p className="font-bold text-slate-900">{oldVehicle.vehicle_name}</p>
                  <p className="text-sm text-slate-500 font-mono">{oldVehicle.plate_number}</p>
                </div>
                <Badge variant="outline" className="text-xs">{oldVehicle.total_seats} seats</Badge>
              </CardContent>
            </Card>

            {/* New vehicle picker */}
            <div>
              <Label htmlFor="new-vehicle" className="text-sm font-semibold mb-1.5 block">Replacement vehicle</Label>
              {candidates.length === 0 ? (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  No eligible replacement vehicle. Add another vehicle to your fleet first.
                </div>
              ) : (
                <Select value={newVehicleId} onValueChange={setNewVehicleId}>
                  <SelectTrigger data-testid="replace-vehicle-select">
                    <SelectValue placeholder="Pick a replacement from your fleet" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vehicle_name} · {v.plate_number} · {v.total_seats} seats
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {newVehicle && newVehicle.total_seats < (oldVehicle.total_seats || 0) && (
                <div className="mt-2 text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  New vehicle has fewer seats ({newVehicle.total_seats} vs {oldVehicle.total_seats}). Overflow bookings may need manual handling.
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason" className="text-sm font-semibold mb-1.5 block">Reason</Label>
              <div className="flex flex-wrap gap-2" data-testid="replace-vehicle-reasons">
                {REASONS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                      reason === r.value ? `${r.tone} ring-2 ring-offset-1 ring-[#082c59]` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                    data-testid={`reason-${r.value}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional note */}
            <div>
              <Label htmlFor="note" className="text-sm font-semibold mb-1.5 block">Note to passengers <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea
                id="note"
                data-testid="replace-vehicle-note"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="E.g. Engine issue on Route 12 — new bus same departure time."
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4 py-2" data-testid="replace-vehicle-preview">
            {/* Visual swap */}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <div className="flex-1 text-right">
                  <p className="text-xs uppercase text-slate-500">From</p>
                  <p className="font-bold">{preview.from?.vehicle_name}</p>
                  <p className="font-mono text-xs text-slate-500">{preview.from?.plate_number}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#082c59]" />
                <div className="flex-1">
                  <p className="text-xs uppercase text-emerald-600">To</p>
                  <p className="font-bold">{preview.to?.vehicle_name}</p>
                  <p className="font-mono text-xs text-slate-500">{preview.to?.plate_number}</p>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#082c59] text-white">
              <Users className="h-5 w-5" />
              <p className="text-sm">
                <span className="font-bold text-lg" data-testid="affected-count">{preview.affected_count}</span>{' '}
                active booking(s) will be updated.{' '}
                {preview.affected_count > 0 && <>Customers, your team, and admins will be notified.</>}
              </p>
            </div>

            {/* Sample orders */}
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
                {preview.preview_truncated && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t">
                    … and more (showing first 20)
                  </div>
                )}
              </div>
            )}

            {preview.affected_count === 0 && (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                No active bookings reference this vehicle. You can still proceed — future bookings will use the new vehicle automatically.
              </div>
            )}
          </div>
        )}

        {step === 'done' && result && (
          <div className="py-6 text-center space-y-3" data-testid="replace-vehicle-done">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Reassignment complete</h3>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{result.affected_count}</span> booking(s) updated.
              Notifications sent to{' '}
              <span className="font-semibold">{result.notifications_sent?.customers || 0}</span> customer(s),{' '}
              <span className="font-semibold">{result.notifications_sent?.operator_users || 0}</span> team member(s),{' '}
              <span className="font-semibold">{result.notifications_sent?.admins || 0}</span> admin(s).
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading} data-testid="replace-cancel-btn">
                Cancel
              </Button>
              <Button
                onClick={handleDryRun}
                disabled={loading || !newVehicleId}
                className="bg-[#082c59] hover:bg-[#0a3a73]"
                data-testid="replace-preview-btn"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Preview impact
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')} disabled={loading} data-testid="replace-back-btn">
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-[#082c59] hover:bg-[#0a3a73]"
                data-testid="replace-confirm-btn"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm & notify {preview?.affected_count || 0} booking(s)
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose} className="bg-[#082c59] hover:bg-[#0a3a73]" data-testid="replace-close-btn">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
