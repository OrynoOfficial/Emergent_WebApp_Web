import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, X, Loader2 } from 'lucide-react';
import api from '@/api/client';

const MENU_CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'mains', label: 'Main Courses' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'specials', label: 'Specials' },
  { value: 'sides', label: 'Sides' }
];

function MenuImageUploader({ image, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'menu-items');
      const res = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.file_url) onChange(res.data.file_url);
    } catch { /* skip */ }
    setUploading(false);
    e.target.value = '';
  };

  const getUrl = (img) => img?.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img;

  return (
    <div className="mt-1">
      {image ? (
        <div className="relative w-32 h-24 rounded-lg overflow-hidden border group">
          <img src={getUrl(image)} alt="" className="w-full h-full object-cover" />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
          <span className="text-sm text-slate-500">{uploading ? 'Uploading...' : 'Upload image'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

export function MenuItemForm({ form, onChange, isEditing = false }) {
  const updateForm = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Item Name *</Label>
        <Input
          value={form.name || ''}
          onChange={(e) => updateForm('name', e.target.value)}
          placeholder="e.g., Grilled Chicken"
          className="mt-1"
        />
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea
          value={form.description || ''}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder="Describe this dish..."
          rows={2}
          className="mt-1"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category *</Label>
          <Select value={form.category || ''} onValueChange={(v) => updateForm('category', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {MENU_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Price (FCFA) *</Label>
          <Input
            type="number"
            value={form.price || ''}
            onChange={(e) => updateForm('price', e.target.value)}
            placeholder="5000"
            className="mt-1"
          />
        </div>
      </div>
      
      <div>
        <Label>Image</Label>
        <MenuImageUploader
          image={form.image || ''}
          onChange={(url) => updateForm('image', url)}
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <Label className="cursor-pointer">Available</Label>
          <p className="text-sm text-slate-500">Is this item currently available?</p>
        </div>
        <Switch
          checked={form.is_available !== false}
          onCheckedChange={(checked) => updateForm('is_available', checked)}
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
        <div>
          <Label className="cursor-pointer">Popular Item</Label>
          <p className="text-sm text-slate-500">Mark as a popular/featured item</p>
        </div>
        <Switch
          checked={form.popular === true}
          onCheckedChange={(checked) => updateForm('popular', checked)}
        />
      </div>
    </div>
  );
}

export default MenuItemForm;
