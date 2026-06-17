import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Upload, X, Loader2 } from 'lucide-react';
import api from '@/api/client';
import OperatorSelector from '@/components/management/shared/OperatorSelector';
import CancellationPolicyPicker from '@/components/refunds/CancellationPolicyPicker';
import GeocodePinRow from '@/components/shared/GeocodePinRow';

// Reusable Image Uploader component
function ImageUploader({ images, onChange, maxImages = 6 }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > maxImages) {
      return alert(`Maximum ${maxImages} images allowed`);
    }

    setUploading(true);
    const newUrls = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'restaurants');
        const res = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (res.data?.file_url) newUrls.push(res.data.file_url);
      } catch { /* skip failed uploads */ }
    }
    onChange([...images, ...newUrls]);
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {images.map((img, i) => (
          <div key={i} className="relative aspect-video rounded-lg overflow-hidden border bg-slate-50 group">
            <img src={img.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img} alt="" className="w-full h-full object-cover" />
            <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <label className="aspect-video rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Upload className="w-5 h-5 text-slate-400" />}
            <span className="text-[10px] text-slate-400 mt-1">{uploading ? 'Uploading...' : 'Upload'}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
      <p className="text-[10px] text-slate-400">{images.length}/{maxImages} images</p>
    </div>
  );
}

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
  // Optional `extra` lets callers update multiple fields atomically without
  // racing two setState calls (e.g. editing address invalidates the pin).
  const updateForm = (field, value, extra) => {
    onChange({ ...form, [field]: value, ...(extra || {}) });
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
              onChange={(e) => updateForm('address', e.target.value, { latitude: null, longitude: null })}
              placeholder="Street address"
              className="mt-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City *</Label>
              <Input
                value={form.city || ''}
                onChange={(e) => updateForm('city', e.target.value, { latitude: null, longitude: null })}
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

          {/* One-click geocoder — stamps a precise lat/lon pin on the
              restaurant doc so the customer-facing live map zooms to the
              actual venue. Operator can re-pin or clear at any time. */}
          <GeocodePinRow
            city={form.city}
            address={form.address}
            latitude={typeof form.latitude === 'number' ? form.latitude : null}
            longitude={typeof form.longitude === 'number' ? form.longitude : null}
            onPin={({ lat, lon }) => updateForm('latitude', lat, { longitude: lon })}
            onClear={() => updateForm('latitude', null, { longitude: null })}
            testIdPrefix="restaurant-form-geocode"
          />
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
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Operator</h4>
          <OperatorSelector
            value={form.operator_id || ''}
            onChange={(id, name) => onChange({ ...form, operator_id: id, operator_name: name })}
            operators={operators}
            helperText="The restaurant will be owned by the selected operator. Admins can search any operator; operators are auto-assigned to their own organisation."
            testId="restaurant-operator-selector"
          />
        </div>

        {/* Classification */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Classification</h4>
          
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Avg cost (per 2 people)</Label>
              <Input
                type="number"
                min={0}
                value={form.average_cost_for_two ?? ''}
                onChange={(e) => updateForm('average_cost_for_two', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="e.g. 25000"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Currency</Label>
              <Select value={form.currency || 'XAF'} onValueChange={(v) => updateForm('currency', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="XAF">XAF (FCFA)</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={form.website || ''}
                onChange={(e) => updateForm('website', e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
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

        {/* Capacity & Reservations */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Capacity & Reservations</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total tables</Label>
              <Input
                type="number"
                min={0}
                value={form.total_tables ?? ''}
                onChange={(e) => updateForm('total_tables', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                placeholder="e.g. 20"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Max capacity (guests)</Label>
              <Input
                type="number"
                min={0}
                value={form.max_capacity ?? ''}
                onChange={(e) => updateForm('max_capacity', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                placeholder="e.g. 80"
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-800">Accept reservations</p>
              <p className="text-[11px] text-slate-500">Guests can book tables online ahead of time.</p>
            </div>
            <Switch
              checked={form.accepts_reservations !== false}
              onCheckedChange={(v) => updateForm('accepts_reservations', v)}
            />
          </label>
        </div>

        {/* Opening hours (free text — 7-day picker would be over-engineered for now) */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Opening hours</h4>
          <Textarea
            value={form._opening_hours_text || (form.opening_hours && typeof form.opening_hours === 'object' ? Object.entries(form.opening_hours).map(([d, h]) => `${d}: ${h}`).join('\n') : '')}
            onChange={(e) => {
              const text = e.target.value;
              const parsed = {};
              text.split('\n').forEach((line) => {
                const m = line.match(/^([^:]+):\s*(.+)$/);
                if (m) parsed[m[1].trim().toLowerCase()] = m[2].trim();
              });
              onChange({ ...form, opening_hours: parsed, _opening_hours_text: text });
            }}
            rows={4}
            placeholder={"Monday: 11:00 - 23:00\nTuesday: 11:00 - 23:00\nWednesday: 11:00 - 23:00\nThursday: 11:00 - 23:00\nFriday: 11:00 - 00:00\nSaturday: 12:00 - 00:00\nSunday: Closed"}
            className="mt-1 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-500">One day per line: <code>day: hours</code></p>
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

        {/* Images - Upload */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Images</h4>
          <ImageUploader
            images={form.images || []}
            onChange={(imgs) => updateForm('images', imgs)}
            maxImages={6}
          />
        </div>

        {/* Refund policy override (listing-level) */}
        <div data-testid="restaurant-form-refund-policy" className="space-y-3 pt-3 border-t border-slate-200">
          <h4 className="font-medium text-slate-900">Refund Policy <span className="text-slate-400 text-xs font-normal">(overrides operator default)</span></h4>
          <CancellationPolicyPicker
            serviceType="restaurant"
            scope="listing"
            value={form.refund_policy}
            onChange={(v) => updateForm('refund_policy', v)}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

export default RestaurantForm;
