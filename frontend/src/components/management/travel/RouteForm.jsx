import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import OperatorSelector from '@/components/management/shared/OperatorSelector';

/**
 * RouteForm - Form component for creating/editing routes
 */
export function RouteForm({ 
  form, 
  onChange, 
  operators = [], 
  vehicles = [], 
  isAdmin = false, 
  selectedOperator, 
  onOperatorChange, 
  onVehicleSelect 
}) {
  const updateForm = (updates) => onChange({ ...form, ...updates });

  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      {/* Operator Selection - Always show if operators available */}
      <div className="col-span-2">
        <OperatorSelector
          value={selectedOperator?.id || form.operator_id || ''}
          onChange={(id, name) => {
            onOperatorChange?.({ id, name });
            updateForm({ operator_id: id, operator_name: name });
          }}
          operators={operators}
          label="Assigned Operator"
          testId="route-operator-selector"
        />
      </div>
      
      <div>
        <Label>From City *</Label>
        <Input 
          value={form.from_city || ''} 
          onChange={e => updateForm({ from_city: e.target.value })} 
          placeholder="e.g., Douala" 
        />
      </div>
      <div>
        <Label>To City *</Label>
        <Input 
          value={form.to_city || ''} 
          onChange={e => updateForm({ to_city: e.target.value })} 
          placeholder="e.g., Yaoundé" 
        />
      </div>
      <div>
        <Label>Departure Time</Label>
        <Input 
          type="time" 
          value={form.departure_time || ''} 
          onChange={e => updateForm({ departure_time: e.target.value })} 
        />
      </div>
      <div>
        <Label>Arrival Time</Label>
        <Input 
          type="time" 
          value={form.arrival_time || ''} 
          onChange={e => updateForm({ arrival_time: e.target.value })} 
        />
      </div>
      <div>
        <Label>Duration</Label>
        <Input 
          value={form.duration || ''} 
          onChange={e => updateForm({ duration: e.target.value })} 
          placeholder="e.g., 3h 30m" 
        />
      </div>
      <div>
        <Label>Price (FCFA) *</Label>
        <Input 
          type="number" 
          value={form.price || ''} 
          onChange={e => updateForm({ price: e.target.value })} 
          placeholder="5000" 
        />
      </div>
      <div className="col-span-2">
        <Label>Vehicle</Label>
        <Select value={form.vehicle_id || ''} onValueChange={onVehicleSelect}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Select vehicle" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {vehicles.map(v => (
              <SelectItem key={v.id} value={v.id}>
                {v.vehicle_name} ({v.total_seats} seats) - {v.vehicle_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        {isAdmin ? (
          <Select value={form.status || 'pending'} onValueChange={v => updateForm({ status: v })}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <>
            <Badge className={`mt-1 block w-fit capitalize text-xs ${
              form.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
              form.status === 'suspended' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>{form.status || 'pending'}</Badge>
            <p className="text-[11px] text-slate-400 mt-1">Only admins can change status</p>
          </>
        )}
      </div>
      <div>
        <Label>Total Seats</Label>
        <Input 
          type="number" 
          value={form.total_seats || ''} 
          onChange={e => updateForm({ total_seats: parseInt(e.target.value) || 0 })} 
          placeholder="Auto-filled from vehicle" 
        />
      </div>
      <div>
        <Label>Valid From</Label>
        <Input 
          type="date" 
          value={form.valid_from || ''} 
          onChange={e => updateForm({ valid_from: e.target.value })} 
        />
      </div>
      <div>
        <Label>Valid To</Label>
        <Input 
          type="date" 
          value={form.valid_to || ''} 
          onChange={e => updateForm({ valid_to: e.target.value })} 
        />
      </div>
      <div className="col-span-2 pt-3 border-t border-slate-200 mt-2">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Pickup / Boarding Location <span className="text-slate-400 font-normal normal-case tracking-normal">(shown on the customer map preview)</span></Label>
      </div>
      <div className="col-span-2">
        <Label>Pickup Address</Label>
        <Input
          value={form.pickup_address || ''}
          onChange={e => updateForm({ pickup_address: e.target.value })}
          placeholder="e.g. Vatican Express Terminal, Avenue Kennedy, Douala"
          data-testid="route-form-pickup-address"
        />
      </div>
      <div>
        <Label>Latitude <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
        <Input
          type="number"
          step="any"
          value={form.pickup_lat ?? ''}
          onChange={e => updateForm({ pickup_lat: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="4.0511"
          data-testid="route-form-pickup-lat"
        />
      </div>
      <div>
        <Label>Longitude</Label>
        <Input
          type="number"
          step="any"
          value={form.pickup_lon ?? ''}
          onChange={e => updateForm({ pickup_lon: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          placeholder="9.7679"
          data-testid="route-form-pickup-lon"
        />
      </div>
      <div className="col-span-2 pt-3 border-t border-slate-200 mt-2">
        <Label className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Trip Policies & Rules <span className="text-slate-400 font-normal normal-case tracking-normal">(one per line — shown to customers in the trip preview)</span></Label>
      </div>
      <div className="col-span-2">
        <Textarea
          rows={4}
          value={(form.policies || []).join('\n')}
          onChange={e => updateForm({
            policies: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
          })}
          placeholder={'Arrive 30 minutes before departure\nValid government-issued ID required\nFree cancellation up to 24 hours before departure'}
          data-testid="route-form-policies"
        />
      </div>
    </div>
  );
}

export default RouteForm;
