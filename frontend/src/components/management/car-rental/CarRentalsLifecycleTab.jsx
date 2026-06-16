// Car Rental Active Rentals & Returns — operator-side lifecycle dashboard.
//
// Mirrors the Banquet `RentalInventoryTab` Active + History sub-tabs but
// scoped to car rentals. Every car booking auto-creates an inventory hold
// (entity_type=car_rental). Operators here:
//   1. See live counts of pending returns + revenue
//   2. Mark a car as "Out" when the customer drives off
//   3. Confirm Return — optionally entering a damage_fee that posts back
//      to the customer's invoice (orders.booking_details.damage_charges)
//
// Stock effect of damage: car_rentals.total_units is decremented so a
// totalled vehicle stops appearing in availability counts.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PermissionGate from '@/components/common/PermissionGate';
import {
  Car, PackageOpen, AlertTriangle, CheckCircle2, ArrowRightCircle,
  RotateCcw, History, Loader2, ListOrdered,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';

function ConfirmReturnDialog({ open, onOpenChange, hold, onSaved }) {
  const [damaged, setDamaged] = useState(0);
  const [damageFee, setDamageFee] = useState(0);
  const [damageDesc, setDamageDesc] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) { setDamaged(0); setDamageFee(0); setDamageDesc(''); setNote(''); }
  }, [open]);

  const save = async () => {
    try {
      await api.post(`/inventory/holds/${hold.id}/confirm-return`, {
        damaged_quantity: damaged,
        damage_fee: Number(damageFee) || 0,
        damage_description: damageDesc || null,
        operator_note: note || null,
      });
      toast.success(damaged > 0
        ? `Returned — vehicle marked damaged, ${formatFCFA(damageFee)} billed.`
        : 'Returned — vehicle back in fleet.');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm return');
    }
  };

  if (!hold) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" data-testid="car-confirm-return-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" /> Confirm Vehicle Return
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-600" />
              {hold.item_name}
            </div>
            <div className="text-slate-600">Rented to <span className="font-medium">{hold.customer_name || '—'}</span></div>
            {hold.end_date && <div className="text-xs text-slate-500 mt-1">Due back: {hold.end_date}</div>}
          </div>
          <div>
            <Label>Damaged? (1 = yes, removes vehicle from fleet)</Label>
            <Input
              type="number" min="0" max={1}
              value={damaged}
              onChange={(e) => {
                const n = Math.max(0, Math.min(1, Number(e.target.value) || 0));
                setDamaged(n);
                if (n > 0 && !damageFee) setDamageFee(Number(hold.unit_price || 0) * 5); // suggest 5x daily rate as a starter
              }}
              data-testid="car-damaged-input"
            />
          </div>
          {damaged > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4" /> Vehicle will be removed from active fleet (total_units −1)
              </div>
              <div>
                <Label className="text-xs">Damage Fee (FCFA) — billed to customer&apos;s invoice</Label>
                <Input
                  type="number" min="0"
                  value={damageFee}
                  onChange={(e) => setDamageFee(e.target.value)}
                  data-testid="car-damage-fee-input"
                />
                <p className="text-[11px] text-slate-500 mt-1">Suggested: 5× daily rate ({formatFCFA((hold.unit_price || 0) * 5)})</p>
              </div>
              <div>
                <Label className="text-xs">Damage Description</Label>
                <Input
                  value={damageDesc}
                  onChange={(e) => setDamageDesc(e.target.value)}
                  placeholder="Bumper scratched, side mirror broken…"
                  data-testid="car-damage-description-input"
                />
              </div>
            </div>
          )}
          <div>
            <Label>Return Condition Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Returned with full tank, clean…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="car-confirm-return-save-btn">
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CarRentalsLifecycleTab({ scopeOperatorId }) {
  const [active, setActive] = useState('active');
  const [holds, setHolds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnHold, setReturnHold] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [holdsRes, sumRes] = await Promise.all([
        api.get('/inventory/holds', { params: { entity_type: 'car_rental' } }).catch(() => ({ data: { holds: [] } })),
        api.get('/inventory/active-rentals', { params: { entity_type: 'car_rental' } }).catch(() => ({ data: null })),
      ]);
      setHolds(holdsRes.data.holds || []);
      setSummary(sumRes.data || null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load car rental lifecycle');
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  const activeHolds = useMemo(() => holds.filter(h => h.status === 'reserved' || h.status === 'out'), [holds]);
  const historyHolds = useMemo(() => holds.filter(h => ['returned', 'damaged', 'cancelled'].includes(h.status)), [holds]);

  const markOut = async (hold) => {
    try {
      await api.post(`/inventory/holds/${hold.id}/mark-out`);
      toast.success(`${hold.item_name} marked as picked up`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-blue-50 border-blue-200" data-testid="car-summary-pending-return">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold uppercase">
                <RotateCcw className="w-3.5 h-3.5" /> Pending Return
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{summary.pending_return || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200" data-testid="car-summary-cars-out">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold uppercase">
                <PackageOpen className="w-3.5 h-3.5" /> Cars on the Road
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{summary.total_units_currently_out || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200" data-testid="car-summary-completed">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> Returned
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{summary.by_status?.returned || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 border-rose-200" data-testid="car-summary-damage-fees">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold uppercase">
                <AlertTriangle className="w-3.5 h-3.5" /> Damage Fees
              </div>
              <div className="text-lg font-bold text-rose-900 mt-1">{formatFCFA(summary.total_damage_fees_collected || 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="bg-emerald-50 border border-emerald-200">
          <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700" data-testid="car-active-subtab">
            <ListOrdered className="w-4 h-4 mr-1.5" /> Active Rentals ({activeHolds.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-emerald-700" data-testid="car-history-subtab">
            <History className="w-4 h-4 mr-1.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
          ) : activeHolds.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-200 mb-4" />
              <p className="text-slate-600 font-medium">No cars currently out.</p>
              <p className="text-sm text-slate-500 mt-1">When a customer books a vehicle, it shows up here for you to mark out & return.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeHolds.map(hold => (
                <Card key={hold.id} className="border-emerald-100 hover:shadow-md transition-shadow" data-testid={`car-active-hold-${hold.id}`}>
                  <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Car className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{hold.item_name || hold.entity_id}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>{hold.customer_name || 'Customer'}</span>
                          {hold.start_date && <><span>·</span><span>{hold.start_date} → {hold.end_date}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={hold.status === 'out' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'} data-testid={`car-hold-status-${hold.id}`}>
                        {hold.status === 'out' ? 'On the Road' : 'Reserved'}
                      </Badge>
                      {hold.status === 'reserved' && (
                        <PermissionGate permission="car_rental.edit">
                          <Button size="sm" variant="outline" className="h-7 border-emerald-300 text-emerald-700" onClick={() => markOut(hold)} data-testid={`car-mark-out-btn-${hold.id}`}>
                            <ArrowRightCircle className="w-3.5 h-3.5 mr-1" /> Mark Out
                          </Button>
                        </PermissionGate>
                      )}
                      <PermissionGate permission="car_rental.edit">
                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setReturnHold(hold)} data-testid={`car-return-btn-${hold.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Return
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
          ) : historyHolds.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="h-16 w-16 mx-auto text-slate-200 mb-4" />
              <p className="text-slate-600">No completed rentals yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {historyHolds.map(hold => (
                <Card key={hold.id} className="border-slate-200" data-testid={`car-history-hold-${hold.id}`}>
                  <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {hold.status === 'damaged' ? <AlertTriangle className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{hold.item_name}</div>
                        <div className="text-xs text-slate-500">{hold.customer_name || 'Customer'} {hold.damaged_quantity > 0 && <span className="text-rose-600 font-medium">· damaged</span>}</div>
                        {hold.damage_description && <div className="text-[11px] text-rose-700 mt-0.5 italic">&ldquo;{hold.damage_description}&rdquo;</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {hold.damage_fee > 0 && (
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase">Damage Fee</div>
                          <div className="font-bold text-rose-700">{formatFCFA(hold.damage_fee)}</div>
                        </div>
                      )}
                      <Badge className={
                        hold.status === 'damaged' ? 'bg-rose-500 text-white' :
                        hold.status === 'cancelled' ? 'bg-slate-500 text-white' :
                        'bg-emerald-500 text-white'
                      }>{hold.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmReturnDialog
        open={!!returnHold}
        onOpenChange={(o) => !o && setReturnHold(null)}
        hold={returnHold}
        onSaved={load}
      />
    </div>
  );
}
