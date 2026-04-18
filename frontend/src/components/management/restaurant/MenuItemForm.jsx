import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Loader2, ImagePlus, AlertTriangle } from 'lucide-react';
import api from '@/api/client';

const MENU_CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'mains', label: 'Main Courses' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'specials', label: 'Specials' },
  { value: 'sides', label: 'Sides' }
];

const MAX_IMAGES = 3;

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Gluten',
  'Fish', 'Shellfish', 'Soy', 'Sesame', 'Celery'
];

const ALLERGEN_COLORS = {
  Peanuts: 'bg-amber-100 text-amber-700 border-amber-300',
  'Tree Nuts': 'bg-orange-100 text-orange-700 border-orange-300',
  Dairy: 'bg-blue-100 text-blue-700 border-blue-300',
  Eggs: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Gluten: 'bg-rose-100 text-rose-700 border-rose-300',
  Fish: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  Shellfish: 'bg-teal-100 text-teal-700 border-teal-300',
  Soy: 'bg-lime-100 text-lime-700 border-lime-300',
  Sesame: 'bg-stone-100 text-stone-700 border-stone-300',
  Celery: 'bg-green-100 text-green-700 border-green-300',
};

function MultiImageUploader({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const getUrl = (img) => img?.startsWith('/api') ? `${import.meta.env.VITE_BACKEND_URL || ''}${img}` : img;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'menu-items');
      const res = await api.post('/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.file_url) {
        onChange([...images, res.data.file_url].slice(0, MAX_IMAGES));
      }
    } catch { /* skip */ }
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-2 flex-wrap">
        {images.map((img, idx) => (
          <div key={idx} className="relative w-24 h-20 rounded-lg overflow-hidden border group">
            <img src={getUrl(img)} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <span className="absolute bottom-0.5 left-0.5 bg-black/50 text-white text-[9px] px-1 rounded">{idx + 1}/{MAX_IMAGES}</span>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <label className="w-24 h-20 inline-flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <ImagePlus className="w-5 h-5 text-slate-400" />
            )}
            <span className="text-[10px] text-slate-500 mt-1">{uploading ? 'Uploading...' : `Add (${images.length}/${MAX_IMAGES})`}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}

export function MenuItemForm({ form, onChange, isEditing = false }) {
  // Local state for raw ingredients text so commas/periods are not eaten
  const [ingredientsText, setIngredientsText] = useState('');

  // Sync ingredientsText from form on mount or when form.ingredients changes externally
  useEffect(() => {
    const arr = form.ingredients || [];
    setIngredientsText(arr.join(', '));
  }, [form.ingredients?.length]);

  const updateForm = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  // Build images array from both old `image` field and new `images` field
  const currentImages = form.images?.length > 0
    ? form.images
    : form.image
      ? [form.image]
      : [];

  const handleImagesChange = (newImages) => {
    // Single onChange call to avoid stale closure bug
    onChange({ ...form, images: newImages, image: newImages[0] || '' });
  };

  // Parse ingredients text to array (called on blur to persist)
  const commitIngredients = () => {
    const arr = ingredientsText
      ? ingredientsText.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    updateForm('ingredients', arr);
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
        <Label>Images (up to {MAX_IMAGES})</Label>
        <MultiImageUploader
          images={currentImages}
          onChange={handleImagesChange}
        />
      </div>

      <div>
        <Label>Ingredients</Label>
        <p className="text-xs text-slate-500 mb-1">Enter ingredients separated by commas</p>
        <Textarea
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          onBlur={commitIngredients}
          placeholder="e.g., Chicken, Tomatoes, Onions, Garlic, Palm Oil"
          rows={2}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          Allergens
        </Label>
        <p className="text-xs text-slate-500 mb-2">Select allergens present in this dish</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_ALLERGENS.map(allergen => {
            const isSelected = (form.allergens || []).includes(allergen);
            const colorClass = ALLERGEN_COLORS[allergen] || 'bg-slate-100 text-slate-700 border-slate-300';
            return (
              <button
                key={allergen}
                type="button"
                onClick={() => {
                  const current = form.allergens || [];
                  const updated = isSelected
                    ? current.filter(a => a !== allergen)
                    : [...current, allergen];
                  updateForm('allergens', updated);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isSelected
                    ? `${colorClass} ring-1 ring-offset-1 ring-current`
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {allergen}
              </button>
            );
          })}
        </div>
        {(form.allergens || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(form.allergens || []).map(a => (
              <Badge key={a} variant="outline" className={`text-[10px] ${ALLERGEN_COLORS[a] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                {a}
                <button type="button" onClick={() => updateForm('allergens', (form.allergens || []).filter(x => x !== a))} className="ml-1 hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
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
    </div>
  );
}

export default MenuItemForm;
