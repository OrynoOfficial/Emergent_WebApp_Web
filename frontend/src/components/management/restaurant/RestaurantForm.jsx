import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const CUISINE_TYPES = [
  { value: 'african', label: 'African' },
  { value: 'french', label: 'French' },
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'indian', label: 'Indian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'american', label: 'American' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'fusion', label: 'Fusion' },
  { value: 'local', label: 'Local' }
];

const FEATURES = [
  { value: 'parking', label: 'Parking' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'outdoor_seating', label: 'Outdoor Seating' },
  { value: 'live_music', label: 'Live Music' },
  { value: 'private_room', label: 'Private Room' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'wheelchair_accessible', label: 'Wheelchair Accessible' }
];

const PRICE_RANGES = [
  { value: 'budget', label: '$ - Budget' },
  { value: 'moderate', label: '$$ - Moderate' },
  { value: 'upscale', label: '$$$ - Upscale' },
  { value: 'fine_dining', label: '$$$$ - Fine Dining' }
];

export function RestaurantForm({ form, onChange, operators = [], isEditing = false }) {
  const updateForm = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  const toggleArrayValue = (field, value) => {
    const current = form[field] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateForm(field, updated);
  };

  return (
    <ScrollArea className="max-h-[60vh] pr-4">
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Basic Information</h4>
          
          <div>
            <Label>Restaurant Name *</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Enter restaurant name"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description || ''}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Describe your restaurant..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Location</h4>
          
          <div>
            <Label>Address</Label>
            <Input
              value={form.address || ''}
              onChange={(e) => updateForm('address', e.target.value)}
              placeholder="Street address"
              className="mt-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City *</Label>
              <Input
                value={form.city || ''}
                onChange={(e) => updateForm('city', e.target.value)}
                placeholder="City"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={form.country || 'Cameroon'}
                onChange={(e) => updateForm('country', e.target.value)}
                placeholder="Country"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Contact</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone || ''}
                onChange={(e) => updateForm('phone', e.target.value)}
                placeholder="+237 6XX XXX XXX"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email || ''}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="contact@restaurant.com"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Operator Assignment */}
        {operators.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900 border-b pb-2">Operator</h4>
            <div>
              <Label>Assign to Operator</Label>
              <Select value={form.operator_id || ''} onValueChange={(v) => {
                const op = operators.find(o => o.id === v);
                updateForm('operator_id', v === 'none' ? '' : v);
                updateForm('operator_name', op?.name || '');
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">No operator</SelectItem>
                  {operators.map(op => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Classification */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Classification</h4>
          
          <div>
            <Label>Price Range</Label>
            <Select value={form.price_range || 'moderate'} onValueChange={(v) => updateForm('price_range', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {PRICE_RANGES.map(pr => (
                  <SelectItem key={pr.value} value={pr.value}>{pr.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="mb-2 block">Cuisine Types</Label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg">
              {CUISINE_TYPES.map(ct => (
                <label key={ct.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={(form.cuisine_type || []).includes(ct.value)}
                    onCheckedChange={() => toggleArrayValue('cuisine_type', ct.value)}
                  />
                  <span className="text-sm">{ct.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Features & Amenities</h4>
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg">
            {FEATURES.map(f => (
              <label key={f.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(form.features || []).includes(f.value)}
                  onCheckedChange={() => toggleArrayValue('features', f.value)}
                />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Images */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Images</h4>
          <div>
            <Label>Image URLs (one per line)</Label>
            <Textarea
              value={(form.images || []).join('\n')}
              onChange={(e) => updateForm('images', e.target.value.split('\n').filter(url => url.trim()))}
              placeholder="https://example.com/image1.jpg\nhttps://example.com/image2.jpg"
              rows={3}
              className="mt-1 font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export default RestaurantForm;
