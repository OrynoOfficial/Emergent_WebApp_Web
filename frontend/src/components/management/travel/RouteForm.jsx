import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

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
      {operators.length > 0 && (
        <div className="col-span-2">
          <Label className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Assigned Operator
          </Label>
          <Select 
            value={selectedOperator?.id || form.operator_id || ''} 
            onValueChange={(id) => {
              const op = operators.find(o => (o.id || o._id) === id);
              onOperatorChange({ id, name: op?.name || '' });
              updateForm({ operator_id: id, operator_name: op?.name || '' });
            }}
          >
            <SelectTrigger className="bg-white border-indigo-200 focus:ring-indigo-500">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {operators.map(op => (
                <SelectItem key={op.id || op._id} value={op.id || op._id}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedOperator?.name || form.operator_name) && (
            <p className="text-xs text-indigo-600 mt-1">
              Currently assigned to: <span className="font-semibold">{selectedOperator?.name || form.operator_name}</span>
            </p>
          )}
        </div>
      )}
      
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
        <Select value={form.status || 'active'} onValueChange={v => updateForm({ status: v })}>
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
    </div>
  );
}

export default RouteForm;
