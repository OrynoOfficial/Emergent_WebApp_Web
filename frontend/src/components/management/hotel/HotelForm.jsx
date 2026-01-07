import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Upload, RefreshCw, X, Info, Check } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Kribi', 'Limbe', 'Buea', 'Bamenda'];
const HOTEL_AMENITIES = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'parking', 'room_service', 'concierge', 'business_center', 'laundry', 'airport_shuttle'];

// Image Uploader Component
function ImageUploader({ images, onImagesChange, maxImages = 10, minImages = 5 }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img.startsWith('/api') ? `${backendUrl}${img}` : img;

  const handleFileSelect = async (files) => {
    if (!files?.length) return;
    const filesToUpload = Array.from(files).slice(0, maxImages - images.length);
    if (!filesToUpload.length) { toast.error(`Maximum ${maxImages} images allowed`); return; }
    setUploading(true);
    const newImages = [...images];
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'hotels');
        const response = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data.success) newImages.push(response.data.file_url);
      } catch (error) { toast.error(`Failed to upload ${file.name}`); }
    }
    onImagesChange(newImages);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Hotel Images ({images.length}/{maxImages})</Label>
        <span className="text-xs text-slate-500">Min: {minImages}, Max: {maxImages}</span>
      </div>
      {images.length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-slate-50 p-2">
          <div className="flex gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group flex-shrink-0">
                <img src={getImageUrl(img)} alt={`Hotel ${idx + 1}`} className="h-20 w-28 object-cover rounded-lg border-2 border-white shadow-sm" />
                <button type="button" onClick={() => onImagesChange(images.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                  <X className="h-3 w-3" />
                </button>
                {idx === 0 && <span className="absolute bottom-1 left-1 bg-[#082c59] text-white text-[10px] px-1.5 py-0.5 rounded">Main</span>}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      {images.length < maxImages && (
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${dragActive ? 'border-[#082c59] bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} 
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDragOver={(e) => e.preventDefault()} 
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileSelect(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-[#082c59]" />
              <span className="text-sm text-slate-600">Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">Drop images here or <span className="text-[#082c59] font-medium">browse</span></p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB each</p>
            </>
          )}
        </div>
      )}
      {images.length < minImages && images.length > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Info className="h-3 w-3" />Add at least {minImages - images.length} more image(s)
        </p>
      )}
    </div>
  );
}

/**
 * HotelForm - Form component for creating/editing hotels
 */
export function HotelForm({ form, onChange, operators = [], isEditing = false }) {
  const updateForm = (updates) => onChange({ ...form, ...updates });

  return (
    <div className="space-y-6">
      <ImageUploader 
        images={form.images || []} 
        onImagesChange={(imgs) => updateForm({ images: imgs })} 
        maxImages={10} 
        minImages={5} 
      />
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Hotel Name *</Label>
          <Input 
            value={form.name || ''} 
            onChange={e => updateForm({ name: e.target.value })} 
            className="mt-1.5" 
          />
        </div>
        
        <div>
          <Label>City *</Label>
          <Select value={form.city || ''} onValueChange={v => updateForm({ city: v })}>
            <SelectTrigger className="bg-white mt-1.5">
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Star Rating</Label>
          <Select value={String(form.star_rating || 3)} onValueChange={v => updateForm({ star_rating: parseInt(v) })}>
            <SelectTrigger className="bg-white mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} Stars</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <Label>Operator</Label>
        <Select 
          value={form.operator_id || ''} 
          onValueChange={v => {
            const op = operators.find(o => (o._id || o.id) === v);
            updateForm({ operator_id: v, operator_name: op?.name || '' });
          }}
        >
          <SelectTrigger className="bg-white mt-1.5">
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent className="bg-white max-h-60">
            {operators.map(op => (
              <SelectItem key={op._id || op.id} value={op._id || op.id}>{op.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Address *</Label>
        <Input 
          value={form.address || ''} 
          onChange={e => updateForm({ address: e.target.value })} 
          className="mt-1.5" 
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <Input 
            value={form.phone || ''} 
            onChange={e => updateForm({ phone: e.target.value })} 
            className="mt-1.5" 
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input 
            type="email" 
            value={form.email || ''} 
            onChange={e => updateForm({ email: e.target.value })} 
            className="mt-1.5" 
          />
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Amenities</Label>
        <div className="flex flex-wrap gap-2">
          {HOTEL_AMENITIES.map(a => (
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
              {a.replace('_', ' ')}
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

export default HotelForm;
