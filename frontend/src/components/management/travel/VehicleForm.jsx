import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Grid3X3, Upload, RefreshCw, X, Building2 } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import OperatorSelector from '@/components/management/shared/OperatorSelector';

const AMENITIES_OPTIONS = ['wifi', 'ac', 'power_outlet', 'restroom', 'tv_screen', 'reclining_seats', 'refreshments'];

// Image Uploader Component
function VehicleImageUploader({ images, onImagesChange, maxImages = 8 }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  const handleFileSelect = async (files) => {
    if (!files?.length) return;
    const filesToUpload = Array.from(files).slice(0, maxImages - (images || []).length);
    if (!filesToUpload.length) { 
      toast.error(`Maximum ${maxImages} images allowed`); 
      return; 
    }
    
    setUploading(true);
    const newImages = [...(images || [])];
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'vehicles');
        const response = await api.post('/uploads/', formData, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });
        if (response.data.success) {
          newImages.push(response.data.file_url);
        }
      } catch (error) { 
        toast.error(`Failed to upload ${file.name}`); 
      }
    }
    
    onImagesChange(newImages);
    setUploading(false);
  };

  const removeImage = (idx) => {
    const newImages = (images || []).filter((_, i) => i !== idx);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Vehicle Images ({(images || []).length}/{maxImages})</Label>
      </div>
      
      {(images || []).length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-slate-50 p-2">
          <div className="flex gap-2">
            {(images || []).map((img, idx) => (
              <div key={idx} className="relative group flex-shrink-0">
                <img 
                  src={getImageUrl(img)} 
                  alt={`Vehicle ${idx + 1}`} 
                  className="h-20 w-28 object-cover rounded-lg border-2 border-white shadow-sm" 
                />
                <button 
                  type="button" 
                  onClick={() => removeImage(idx)} 
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <X className="h-3 w-3" />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Main
                  </span>
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      
      {(images || []).length < maxImages && (
        <div className="flex gap-2">
          <input 
            ref={fileInputRef} 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => handleFileSelect(e.target.files)} 
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Images
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * VehicleForm - Form component for creating/editing vehicles
 */
export function VehicleForm({ form, onChange, onOpenSeatLayout, operators = [] }) {
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
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="grid grid-cols-2 gap-4 py-4">
        {/* Vehicle Images */}
        <div className="col-span-2">
          <VehicleImageUploader 
            images={form.images || []} 
            onImagesChange={(imgs) => updateForm({ images: imgs })} 
            maxImages={8} 
          />
        </div>
        
        {/* Operator Selection */}
        <div className="col-span-2">
          <OperatorSelector
            value={form.operator_id || ''}
            onChange={(id, name) => updateForm({ operator_id: id, operator_name: name })}
            operators={operators}
            label="Assigned Operator"
            testId="vehicle-operator-selector"
          />
        </div>
        
        <div className="col-span-2">
          <Label>Vehicle Name *</Label>
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
                className={`cursor-pointer capitalize ${(form.amenities || []).includes(amenity) ? 'bg-blue-600' : ''}`}
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
            placeholder="Additional notes about this vehicle..." 
            rows={3}
          />
        </div>
        
        <div className="col-span-2">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Seat Layout</Label>
              <p className="text-sm text-slate-500">Configure seat arrangement</p>
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
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Layout: {form.seat_layout.layout_type}</span>
                <span className="font-semibold text-blue-600">{form.seat_layout.total_seats} seats</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {form.seat_layout.rows} rows × {form.seat_layout.columns} columns
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

export default VehicleForm;
