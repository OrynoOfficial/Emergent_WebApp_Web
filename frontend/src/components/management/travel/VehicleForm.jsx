import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid3X3 } from 'lucide-react';

const AMENITIES_OPTIONS = ['wifi', 'ac', 'power_outlet', 'restroom', 'tv_screen', 'reclining_seats', 'refreshments'];

/**
 * VehicleForm - Form component for creating/editing vehicles
 */
export function VehicleForm({ form, onChange, onOpenSeatLayout }) {
  const updateForm = (updates) => onChange({ ...form, ...updates });

  const toggleAmenity = (amenity) => {
    const amenities = form.amenities || [];
    updateForm({
      amenities: amenities.includes(amenity)
        ? amenities.filter(a => a !== amenity)
        : [...amenities, amenity]
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="col-span-2">
        <Label>Vehicle Name</Label>
        <Input 
          value={form.vehicle_name || ''} 
          onChange={e => updateForm({ vehicle_name: e.target.value })} 
          placeholder="e.g., Mercedes Sprinter #1" 
        />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={form.vehicle_type || 'normal'} onValueChange={v => updateForm({ vehicle_type: v })}>
          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="luxury">Luxury</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Plate Number</Label>
        <Input 
          value={form.plate_number || ''} 
          onChange={e => updateForm({ plate_number: e.target.value })} 
          placeholder="LT 1234 AB" 
        />
      </div>
      <div>
        <Label>Manufacturer</Label>
        <Input 
          value={form.manufacturer || ''} 
          onChange={e => updateForm({ manufacturer: e.target.value })} 
          placeholder="Mercedes" 
        />
      </div>
      <div>
        <Label>Model</Label>
        <Input 
          value={form.model || ''} 
          onChange={e => updateForm({ model: e.target.value })} 
          placeholder="Sprinter" 
        />
      </div>
      <div>
        <Label>Year</Label>
        <Input 
          type="number" 
          value={form.year || new Date().getFullYear()} 
          onChange={e => updateForm({ year: parseInt(e.target.value) })} 
        />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={form.maintenance_status || 'active'} onValueChange={v => updateForm({ maintenance_status: v })}>
          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">In Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label>Amenities</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {AMENITIES_OPTIONS.map(amenity => (
            <Badge
              key={amenity}
              variant={(form.amenities || []).includes(amenity) ? 'default' : 'outline'}
              className="cursor-pointer capitalize"
              onClick={() => toggleAmenity(amenity)}
            >
              {amenity.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <Label>Notes</Label>
        <Textarea 
          value={form.notes || ''} 
          onChange={e => updateForm({ notes: e.target.value })} 
          placeholder="Additional notes..." 
        />
      </div>
      <div className="col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <Label>Seat Layout</Label>
            <p className="text-sm text-slate-500">Configure the seat arrangement for this vehicle</p>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onOpenSeatLayout}
            className="gap-2"
          >
            <Grid3X3 className="h-4 w-4" />
            {form.seat_layout ? 'Edit Layout' : 'Configure Seats'}
          </Button>
        </div>
        {form.seat_layout && (
          <div className="mt-2 p-3 bg-[#082c59]/5 border border-[#082c59]/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Layout: {form.seat_layout.layout_type}</span>
              <span className="font-semibold text-[#082c59]">{form.seat_layout.total_seats} seats</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {form.seat_layout.rows} rows × {form.seat_layout.columns} columns
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VehicleForm;
