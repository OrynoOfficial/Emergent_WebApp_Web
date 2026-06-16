// Rental Inventory — operator-side tab for BanquetManagement.
//
// Splits the legacy "rental_item" Banquet category into a dedicated
// inventory engine. Three sub-tabs:
//   1. Items     — CRUD on banquet_items + manual stock adjustments
//   2. Active    — list of holds (reserved + out), with Mark-Out / Confirm-Return / Damage actions
//   3. History   — returned + damaged holds with damage_fee totals
//
// The lifecycle:
//   booking created  →  hold = reserved
//   operator clicks  →  hold = out      (units physically leave the warehouse)
//   operator clicks  →  hold = returned (back in stock)
//      └ if damaged_quantity > 0  →  damaged units removed from total_units AND damage_fee billed to order
//
// All endpoints live under /api/inventory.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MiniImageUploader from '@/components/shared/MiniImageUploader';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import PermissionGate from '@/components/common/PermissionGate';
import {
  Armchair, Plus, Edit, Trash2, PackageOpen, Boxes, AlertTriangle,
  CheckCircle2, ArrowRightCircle, RotateCcw, History, Wrench, TrendingUp,
  TrendingDown, Loader2, ListOrdered,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { toast } from 'sonner';

const ITEM_CATEGORIES = [
  { value: 'seating',    label: 'Seating',     icon: Armchair },
  { value: 'tableware',  label: 'Tableware',   icon: Boxes },
  { value: 'linen',      label: 'Linen',       icon: PackageOpen },
  { value: 'decor',      label: 'Decor',       icon: Boxes },
  { value: 'other',      label: 'Other',       icon: Boxes },
];

const DEFAULT_ITEM = {
  name: '', description: '', category: 'seating', unit_price: '',
  total_units: '', images: [], operator_id: '', operator_name: '',
};

// ── Operator-side ItemEditor modal ──────────────────────────────────────────
function ItemEditor({ open, onOpenChange, editing, operators, onSaved }) {
  const [form, setForm] = useState(DEFAULT_ITEM);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '', description: editing.description || '',
        category: editing.category || 'seating',
        unit_price: editing.unit_price?.toString() || '',
        total_units: editing.total_units?.toString() || '',
        images: editing.images || [],
        operator_id: editing.operator_id || '',
        operator_name: editing.operator_name || '',
      });
    } else {
      setForm(DEFAULT_ITEM);
    }
  }, [editing, open]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    if (!form.operator_id && !editing) { toast.error('Pick an operator'); return; }
    if (!Number(form.unit_price) || Number(form.unit_price) <= 0) { toast.error('Unit price must be > 0'); return; }
    if (!Number(form.total_units) || Number(form.total_units) < 0) { toast.error('Total units must be ≥ 0'); return; }
    try {
      const op = operators.find(o => (o._id || o.id) === form.operator_id);
      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category,
        unit_price: Number(form.unit_price),
        total_units: Number(form.total_units),
        images: form.images || [],
        operator_id: form.operator_id || null,
        operator_name: op?.name || form.operator_name || '',
      };
      if (editing) {
        await api.put(`/inventory/banquet-items/${editing.id}`, payload);
        toast.success('Rental item updated');
      } else {
        await api.post('/inventory/banquet-items', payload);
        toast.success('Rental item created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save item');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" data-testid="rental-item-editor">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Armchair className="w-5 h-5" />
            {editing ? 'Edit Rental Item' : 'New Rental Item'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase text-slate-500 font-semibold">Photos</Label>
            <div className="mt-1.5">
              <MiniImageUploader
                images={form.images}
                onChange={(imgs) => setForm(p => ({ ...p, images: imgs }))}
                max={3}
                folder="banquet-items"
                accent="amber"
                helperText="Up to 3 photos. The first is the cover."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Item Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tiffany Gold Chair"
                data-testid="rental-item-name"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger data-testid="rental-item-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Price (FCFA)</Label>
              <Input
                type="number" min="0"
                value={form.unit_price}
                onChange={(e) => setForm(p => ({ ...p, unit_price: e.target.value }))}
                placeholder="2000"
                data-testid="rental-item-unit-price"
              />
            </div>
            <div>
              <Label>Total Stock</Label>
              <Input
                type="number" min="0"
                value={form.total_units}
                onChange={(e) => setForm(p => ({ ...p, total_units: e.target.value }))}
                placeholder="200"
                data-testid="rental-item-total-units"
              />
              <p className="text-[11px] text-slate-500 mt-1">How many units you own.</p>
            </div>
            {!editing && (
              <div className="col-span-2">
                <OperatorSelector
                  value={form.operator_id}
                  onChange={(id, name) => setForm(p => ({ ...p, operator_id: id, operator_name: name }))}
                  operators={operators}
                  testId="rental-item-operator-selector"
                />
              </div>
            )}
            <div className="col-span-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Notes about the item — material, color, dimensions…"
                rows={2}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="save-rental-item-btn">
            {editing ? 'Update Item' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock-adjust dialog ─────────────────────────────────────────────────────
function StockAdjustDialog({ open, onOpenChange, item, onSaved }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { if (open) { setDelta(''); setReason(''); } }, [open]);

  const save = async () => {
    const d = parseInt(delta, 10);
    if (!d || d === 0) { toast.error('Delta must be non-zero'); return; }
    try {
      await api.post(`/inventory/banquet-items/${item.id}/adjust-stock`, { delta: d, reason });
      toast.success(`Stock adjusted by ${d > 0 ? '+' : ''}${d}`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" data-testid="stock-adjust-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Wrench className="w-5 h-5" /> Adjust Stock — {item?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
            <div>Current total: <span className="font-semibold">{item?.total_units || 0} units</span></div>
            <div>Available now: <span className="font-semibold text-emerald-700">{item?.available_units || 0}</span></div>
          </div>
          <div>
            <Label>Adjustment (use negative for losses / write-offs)</Label>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. +20  or  -5"
              data-testid="stock-delta-input"
            />
          </div>
          <div>
            <Label>Reason (recommended)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bought 20 more chairs / Lost during transport"
              data-testid="stock-reason-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="save-stock-adjust-btn">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Return/Damage dialog ────────────────────────────────────────────────────
function ConfirmReturnDialog({ open, onOpenChange, hold, onSaved }) {
  const [damaged, setDamaged] = useState(0);
  const [damageFee, setDamageFee] = useState(0);
  const [damageDesc, setDamageDesc] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setDamaged(0);
      // Suggest damage fee = unit_price × damaged_qty as a default once user enters quantity
      setDamageFee(0);
      setDamageDesc('');
      setNote('');
    }
  }, [open]);

  // Auto-suggest damage fee = damaged_qty × unit_price (only when fee is 0 = untouched).
  const onDamagedChange = (raw) => {
    const n = Math.max(0, Math.min(Number(raw) || 0, hold?.quantity || 0));
    setDamaged(n);
    if (!damageFee || damageFee === Number((damaged) * (hold?.unit_price || 0))) {
      setDamageFee(n * (hold?.unit_price || 0));
    }
  };

  const save = async () => {
    try {
      await api.post(`/inventory/holds/${hold.id}/confirm-return`, {
        damaged_quantity: damaged,
        damage_fee: Number(damageFee) || 0,
        damage_description: damageDesc || null,
        operator_note: note || null,
      });
      toast.success(damaged > 0
        ? `Returned — ${damaged} damaged units removed from stock, ${formatFCFA(damageFee)} billed.`
        : 'Returned — all units back in stock.');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm return');
    }
  };

  if (!hold) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" data-testid="confirm-return-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" /> Confirm Return
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="font-semibold">{hold.item_name}</div>
            <div className="text-slate-600">Rented {hold.quantity} units to <span className="font-medium">{hold.customer_name || '—'}</span></div>
            {hold.end_date && <div className="text-xs text-slate-500 mt-1">Due back: {hold.end_date}</div>}
          </div>
          <div>
            <Label>Damaged units (0 = all returned safely)</Label>
            <Input
              type="number" min="0" max={hold.quantity}
              value={damaged}
              onChange={(e) => onDamagedChange(e.target.value)}
              data-testid="damaged-quantity-input"
            />
          </div>
          {damaged > 0 && (
            <>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4" /> {damaged} damaged units will be removed from stock
                </div>
                <div>
                  <Label className="text-xs">Damage Fee (FCFA) — billed to customer&apos;s invoice</Label>
                  <Input
                    type="number" min="0"
                    value={damageFee}
                    onChange={(e) => setDamageFee(e.target.value)}
                    data-testid="damage-fee-input"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Suggested: {formatFCFA(damaged * (hold.unit_price || 0))} ({damaged} × {formatFCFA(hold.unit_price || 0)})</p>
                </div>
                <div>
                  <Label className="text-xs">Damage Description (optional)</Label>
                  <Input
                    value={damageDesc}
                    onChange={(e) => setDamageDesc(e.target.value)}
                    placeholder="Broken leg, stained linen…"
                    data-testid="damage-description-input"
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Returned in great condition…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-return-save-btn">
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Items sub-tab ───────────────────────────────────────────────────────────
function ItemsSubTab({ items, loading, operators, onReload }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockItem, setStockItem] = useState(null);

  const handleDelete = async (item) => {
    if (!confirm(`Deactivate "${item.name}"?`)) return;
    try {
      await api.delete(`/inventory/banquet-items/${item.id}`);
      toast.success('Item deactivated');
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Armchair className="h-4 w-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-800">Rental Items</h2>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 px-1.5 py-0">{items.length}</Badge>
            <span className="hidden md:inline text-xs text-slate-500 ml-2">Physical items you rent out — chairs, plates, linens, etc.</span>
          </div>
          <PermissionGate permission="banquets.create">
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white h-8" size="sm" data-testid="add-rental-item-btn">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Item
            </Button>
          </PermissionGate>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Armchair className="h-16 w-16 mx-auto text-amber-200 mb-4" />
          <p className="text-slate-600 font-medium">No rental items yet.</p>
          <p className="text-sm text-slate-500 mt-1">Add chairs, plates, linens, or any rentable inventory to start tracking stock.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const cover = item.images?.[0];
            const lowStock = (item.available_units || 0) < (item.total_units || 0) * 0.2;
            return (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow border-amber-100" data-testid={`rental-item-card-${item.id}`}>
                <div className="relative h-32 bg-gradient-to-br from-amber-100 to-orange-100">
                  {cover ? (
                    <img src={cover} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Armchair className="w-12 h-12 text-amber-400" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-white/95 text-amber-700 text-[10px] capitalize">{item.category}</Badge>
                  </div>
                  {lowStock && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-rose-500 text-white border-0 text-[10px]">Low Stock</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                      <p className="text-[11px] text-slate-500">{item.operator_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-amber-700 font-bold text-sm">{formatFCFA(item.unit_price || 0)}</div>
                      <div className="text-[10px] text-slate-500">/ unit</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-100">
                    <div className="bg-emerald-50 rounded p-1.5 text-center">
                      <div className="text-[10px] text-emerald-700 font-semibold uppercase">Available</div>
                      <div className="text-base font-bold text-emerald-800">{item.available_units || 0}</div>
                    </div>
                    <div className="bg-slate-50 rounded p-1.5 text-center">
                      <div className="text-[10px] text-slate-600 font-semibold uppercase">Total</div>
                      <div className="text-base font-bold text-slate-800">{item.total_units || 0}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <PermissionGate permission="banquets.edit">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setStockItem(item)} data-testid={`adjust-stock-btn-${item.id}`}>
                        <Wrench className="w-3 h-3 mr-1" /> Stock
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="banquets.edit">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(item); setEditorOpen(true); }} data-testid={`edit-rental-item-btn-${item.id}`}>
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="banquets.delete">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(item)} data-testid={`delete-rental-item-btn-${item.id}`}>
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

      <ItemEditor
        open={editorOpen} onOpenChange={setEditorOpen}
        editing={editing} operators={operators}
        onSaved={onReload}
      />
      <StockAdjustDialog
        open={!!stockItem} onOpenChange={(o) => !o && setStockItem(null)}
        item={stockItem} onSaved={onReload}
      />
    </div>
  );
}

// ── Active Rentals sub-tab ──────────────────────────────────────────────────
function ActiveRentalsSubTab({ holds, summary, loading, onReload }) {
  const [returnHold, setReturnHold] = useState(null);

  const active = useMemo(() => holds.filter(h => h.status === 'reserved' || h.status === 'out'), [holds]);

  const markOut = async (hold) => {
    try {
      await api.post(`/inventory/holds/${hold.id}/mark-out`);
      toast.success(`${hold.item_name} marked as out`);
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-blue-50 border-blue-200" data-testid="summary-pending-return">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold uppercase">
                <RotateCcw className="w-3.5 h-3.5" /> Pending Return
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{summary.pending_return || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200" data-testid="summary-units-out">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold uppercase">
                <PackageOpen className="w-3.5 h-3.5" /> Units Currently Out
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{summary.total_units_currently_out || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200" data-testid="summary-completed">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> Returned
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{summary.by_status?.returned || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 border-rose-200" data-testid="summary-damage-fees">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold uppercase">
                <AlertTriangle className="w-3.5 h-3.5" /> Damage Fees
              </div>
              <div className="text-lg font-bold text-rose-900 mt-1">{formatFCFA(summary.total_damage_fees_collected || 0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-amber-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-amber-800">Active Rentals</h2>
          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 px-1.5 py-0">{active.length}</Badge>
          <span className="hidden md:inline text-xs text-slate-500 ml-2">Confirm returns or report damage as items come back.</span>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
      ) : active.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-200 mb-4" />
          <p className="text-slate-600 font-medium">All rentals returned!</p>
          <p className="text-sm text-slate-500 mt-1">No items currently on rent.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {active.map(hold => (
            <Card key={hold.id} className="border-amber-100 hover:shadow-md transition-shadow" data-testid={`active-hold-${hold.id}`}>
              <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Armchair className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{hold.item_name || hold.entity_id}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>× {hold.quantity}</span>
                      <span>·</span>
                      <span>{hold.customer_name || 'Customer'}</span>
                      {hold.end_date && <><span>·</span><span>Due {hold.end_date}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={hold.status === 'out'
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-500 text-white'} data-testid={`hold-status-${hold.id}`}>
                    {hold.status}
                  </Badge>
                  {hold.status === 'reserved' && (
                    <PermissionGate permission="banquets.edit">
                      <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700" onClick={() => markOut(hold)} data-testid={`mark-out-btn-${hold.id}`}>
                        <ArrowRightCircle className="w-3.5 h-3.5 mr-1" /> Mark Out
                      </Button>
                    </PermissionGate>
                  )}
                  <PermissionGate permission="banquets.edit">
                    <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setReturnHold(hold)} data-testid={`return-btn-${hold.id}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Return
                    </Button>
                  </PermissionGate>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmReturnDialog
        open={!!returnHold} onOpenChange={(o) => !o && setReturnHold(null)}
        hold={returnHold} onSaved={onReload}
      />
    </div>
  );
}

// ── History sub-tab ─────────────────────────────────────────────────────────
function HistorySubTab({ holds, loading }) {
  const completed = useMemo(
    () => holds.filter(h => ['returned', 'damaged', 'cancelled'].includes(h.status)),
    [holds]
  );

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-700">Rental History</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{completed.length}</Badge>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 mx-auto animate-spin" /></div>
      ) : completed.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="h-16 w-16 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-600">No completed rentals yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {completed.map(hold => (
            <Card key={hold.id} className="border-slate-200" data-testid={`history-hold-${hold.id}`}>
              <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {hold.status === 'damaged' ? <AlertTriangle className="w-5 h-5 text-rose-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{hold.item_name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>× {hold.quantity}</span>
                      <span>·</span>
                      <span>{hold.customer_name || 'Customer'}</span>
                      {hold.damaged_quantity > 0 && (
                        <><span>·</span><span className="text-rose-600 font-medium">{hold.damaged_quantity} damaged</span></>
                      )}
                    </div>
                    {hold.damage_description && (
                      <div className="text-[11px] text-rose-700 mt-0.5 italic">&ldquo;{hold.damage_description}&rdquo;</div>
                    )}
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
                  }>
                    {hold.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main exported tab ───────────────────────────────────────────────────────
export default function RentalInventoryTab({ operators = [], scopeOperatorId }) {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [holds, setHolds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? { operator_id: scopeOperatorId } : {};
      const [itemsRes, holdsRes, summaryRes] = await Promise.all([
        api.get('/inventory/banquet-items', { params: { ...params, is_active: true } }),
        api.get('/inventory/holds', { params: { entity_type: 'banquet_item' } }).catch(() => ({ data: { holds: [] } })),
        api.get('/inventory/active-rentals', { params: { entity_type: 'banquet_item' } }).catch(() => ({ data: null })),
      ]);
      setItems(itemsRes.data.items || []);
      setHolds(holdsRes.data.holds || []);
      setSummary(summaryRes.data || null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load rental inventory');
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-amber-50 border border-amber-200">
          <TabsTrigger value="items" className="data-[state=active]:bg-white data-[state=active]:text-amber-700" data-testid="rental-items-subtab">
            <Armchair className="w-4 h-4 mr-1.5" /> Items ({items.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:text-amber-700" data-testid="active-rentals-subtab">
            <ListOrdered className="w-4 h-4 mr-1.5" /> Active Rentals ({summary?.pending_return || 0})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-amber-700" data-testid="history-subtab">
            <History className="w-4 h-4 mr-1.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <ItemsSubTab items={items} loading={loading} operators={operators} onReload={load} />
        </TabsContent>
        <TabsContent value="active" className="mt-4">
          <ActiveRentalsSubTab holds={holds} summary={summary} loading={loading} onReload={load} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistorySubTab holds={holds} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
