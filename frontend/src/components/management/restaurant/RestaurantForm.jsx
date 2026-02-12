import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import api from '@/api/client';

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

        {/* Images - Upload */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 border-b pb-2">Images</h4>
          <ImageUploader
            images={form.images || []}
            onChange={(imgs) => updateForm('images', imgs)}
            maxImages={6}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

export default RestaurantForm;
