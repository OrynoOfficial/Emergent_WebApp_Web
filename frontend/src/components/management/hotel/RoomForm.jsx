import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, RefreshCw, X, Check } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'penthouse', 'family', 'executive'];
const ROOM_AMENITIES = ['wifi', 'tv', 'air_conditioning', 'mini_bar', 'safe', 'balcony', 'sea_view', 'city_view', 'room_service', 'jacuzzi', 'kitchenette', 'workspace'];

// Room Image Uploader Component
function RoomImageUploader({ images, onImagesChange, maxImages = 5 }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img.startsWith('/api') ? `${backendUrl}${img}` : img;

  const handleFileSelect = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const newImages = [...images];
    for (const file of Array.from(files).slice(0, maxImages - images.length)) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'rooms');
        const response = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data.success) newImages.push(response.data.file_url);
      } catch (error) { toast.error(`Failed to upload`); }
    }
    onImagesChange(newImages);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Room Images ({images.length}/{maxImages})</Label>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={getImageUrl(img)} alt={`Room ${idx + 1}`} className="h-16 w-24 object-cover rounded border" />
              <button 
                type="button" 
                onClick={() => onImagesChange(images.filter((_, i) => i !== idx))} 
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload Images
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * RoomForm - Form component for creating/editing rooms
 */
export function RoomForm({ form, onChange, isEditing = false }) {
  const updateForm = (updates) => onChange({ ...form, ...updates });

  return (
    <div className="space-y-6">
      <RoomImageUploader 
        images={form.images || []} 
        onImagesChange={(imgs) => updateForm({ images: imgs })} 
        maxImages={5} 
      />
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Room Name *</Label>
          <Input 
            value={form.room_name || ''} 
            onChange={e => updateForm({ room_name: e.target.value })} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Room Type</Label>
          <Select value={form.room_type || 'standard'} onValueChange={v => updateForm({ room_type: v })}>
            <SelectTrigger className="bg-white mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {ROOM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label>Price/Night *</Label>
          <Input 
            type="number" 
            value={form.base_price || ''} 
            onChange={e => updateForm({ base_price: e.target.value })} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Capacity</Label>
          <Input 
            type="number" 
            value={form.capacity || 2} 
            onChange={e => updateForm({ capacity: parseInt(e.target.value) || 1 })} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Total Rooms</Label>
          <Input 
            type="number" 
            min="1" 
            value={form.total_rooms || 1} 
            onChange={e => { 
              const t = parseInt(e.target.value) || 1; 
              updateForm({ total_rooms: t, available_rooms: Math.min(form.available_rooms || t, t) }); 
            }} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Available</Label>
          <Input 
            type="number" 
            min="0" 
            max={form.total_rooms || 1} 
            value={form.available_rooms ?? form.total_rooms ?? 1} 
            onChange={e => updateForm({ available_rooms: Math.min(parseInt(e.target.value) || 0, form.total_rooms || 1) })} 
            className="mt-1.5" 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Bed Type</Label>
          <Select value={form.bed_type || 'double'} onValueChange={v => updateForm({ bed_type: v })}>
            <SelectTrigger className="bg-white mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="queen">Queen</SelectItem>
              <SelectItem value="king">King</SelectItem>
              <SelectItem value="twin">Twin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Floor</Label>
          <Input 
            type="number" 
            value={form.floor || 1} 
            onChange={e => updateForm({ floor: parseInt(e.target.value) || 1 })} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Size (m²)</Label>
          <Input 
            type="number" 
            value={form.size_sqm || 25} 
            onChange={e => updateForm({ size_sqm: parseInt(e.target.value) || 25 })} 
            className="mt-1.5" 
          />
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Room Amenities</Label>
        <div className="flex flex-wrap gap-2">
          {ROOM_AMENITIES.map(a => (
            <Badge 
              key={a} 
              variant={(form.amenities || []).includes(a) ? 'default' : 'outline'} 
              className={`cursor-pointer capitalize ${(form.amenities || []).includes(a) ? 'bg-[#082c59]' : 'hover:bg-slate-100'}`} 
              onClick={() => updateForm({ 
                amenities: (form.amenities || []).includes(a) 
                  ? (form.amenities || []).filter(x => x !== a) 
                  : [...(form.amenities || []), a] 
              })}
            >
              {(form.amenities || []).includes(a) && <Check className="w-3 h-3 mr-1" />}
              {a.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea 
          value={form.description || ''} 
          onChange={e => updateForm({ description: e.target.value })} 
          rows={3} 
          className="mt-1.5" 
        />
      </div>
    </div>
  );
}

export default RoomForm;
