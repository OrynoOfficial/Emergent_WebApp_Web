import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      {isAdmin && operators.length > 0 && (
        <div className="col-span-2">
          <Label>Operator</Label>
          <Select value={selectedOperator?.id || ''} onValueChange={(id) => {
            const op = operators.find(o => o.id === id);
            onOperatorChange({ id, name: op?.name || '' });
          }}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Select operator" /></SelectTrigger>
            <SelectContent className="bg-white">
              {operators.map(op => (<SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label>From City</Label>
        <Input 
          value={form.from_city || ''} 
          onChange={e => updateForm({ from_city: e.target.value })} 
          placeholder="e.g., Douala" 
        />
      </div>
      <div>
        <Label>To City</Label>
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
        <Label>Price (FCFA)</Label>
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
          <SelectTrigger className="bg-white"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent className="bg-white">
            {vehicles.map(v => (<SelectItem key={v.id} value={v.id}>{v.vehicle_name} ({v.total_seats} seats)</SelectItem>))}
          </SelectContent>
        </Select>
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
